// Backup & export (DRV-07/08/15/16, ED-13): states are 'Link Google to back
// up' (anonymous — the CSV export below still works), 'Allow Drive access'
// with the one-line explanation before consent (ED-02), then the working
// state — Last backup line or "Last backup failed. Retry", Back up now, the
// automatic-backup frequency (Android only — ED-14), 'Your backups' with a
// Delete action, Restore and the CSV export section. Drive files carry only
// the drive.file scope (ED-01).

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, View } from 'react-native';
import { REPORT_RANGE_IDS, type ReportRangeId } from '../src/domain/reports';
import { linkGoogle } from '../src/features/auth';
import {
  BackupListItem,
  backupFailedFlag,
  deleteBackup,
  listManualBackups,
  runBackup,
} from '../src/features/backup';
import { exportCsv } from '../src/features/csvExport';
import { useAppStore } from '../src/features/appStore';
import {
  driveWasRevoked,
  isDriveGranted,
  requestDriveAccess,
} from '../src/features/driveAccess';
import { DriveError } from '../src/data/drive/client';
import { adapter, getRepos } from '../src/features/runtime';
import { formatDate, useSettings } from '../src/features/format';
import { reportNonFatal } from '../src/features/reporting';
import { guardedWrite } from '../src/features/vehicleActions';
import { t } from '../src/i18n';
import { DateTimeField } from '../src/ui/DateTimeField';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Banner, Button, Card, Chip, Header, Icon, Row, T } from '../src/ui/kit';
import { Notices } from '../src/ui/Notices';
import { Picker } from '../src/ui/Picker';
import { useTheme } from '../src/ui/theme';

function fmtBackupTime(seconds: number, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
  const d = new Date(seconds * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate({ seconds, nanoseconds: 0 }, dateFormat)} ${hh}:${mm}`;
}

function BackupExportScreen() {
  const th = useTheme();
  const settings = useSettings();
  const user = useAppStore((s) => s.user);
  const userDoc = useAppStore((s) => s.userDoc);
  const vehicles = useAppStore((s) => s.vehicles);
  const linking = useAppStore((s) => s.linking);
  const linkError = useAppStore((s) => s.linkError);
  const online = useAppStore((s) => s.online);
  const uid = user?.uid;
  const anonymous = !user || user.isAnonymous;
  const web = adapter().platform === 'web';

  const [granted, setGranted] = useState<boolean | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [accessMsg, setAccessMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupListItem[] | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackupListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBackups = useCallback(async () => {
    if (!uid) return;
    try {
      setBackups(await listManualBackups(uid));
    } catch {
      setBackups([]);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid || anonymous) return;
    let live = true;
    void (async () => {
      const [g, r, f] = await Promise.all([
        isDriveGranted(uid), driveWasRevoked(uid), backupFailedFlag(uid),
      ]);
      if (!live) return;
      setGranted(g);
      setRevoked(r);
      setFailed(f);
      if (g) void loadBackups();
    })();
    return () => { live = false; };
  }, [uid, anonymous, loadBackups]);

  const allowDrive = async () => {
    if (!uid) return;
    const res = await requestDriveAccess(uid, userDoc?.email ?? user?.email ?? undefined);
    if (res.status === 'granted') {
      setGranted(true);
      setRevoked(false);
      setAccessMsg(null);
      void loadBackups();
      return;
    }
    setAccessMsg(
      res.status === 'account-mismatch' && res.message
        ? t('drive.useLinked', { email: res.message })
        : res.status === 'not-configured'
          ? t('drive.notConfigured')
          : res.status === 'unavailable'
            ? t('drive.unavailable')
            : t('drive.declined'),
    );
  };

  const backUpNow = async () => {
    if (!uid) return;
    setBackingUp(true);
    try {
      await runBackup(uid, 'manual');
      setFailed(false);
      void loadBackups();
    } catch (e) {
      if (e instanceof DriveError && (e.code === 'access-revoked' || e.code === 'access-declined')) {
        setGranted(false);
        setRevoked(e.code === 'access-revoked');
      } else {
        setFailed(true);
      }
      reportNonFatal(e, { stage: 'manual-backup' });
    } finally {
      setBackingUp(false);
    }
  };

  const confirmDelete = async () => {
    if (!uid || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBackup(uid, deleteTarget.fileId);
      setBackups((b) => b?.filter((x) => x.fileId !== deleteTarget.fileId) ?? null);
      setDeleteTarget(null);
    } catch (e) {
      reportNonFatal(e, { stage: 'backup-delete' });
    } finally {
      setDeleting(false);
    }
  };

  const lastBackupAt = userDoc?.drive?.lastBackupAt;

  // --- CSV export state -------------------------------------------------------
  const [scope, setScope] = useState<string>('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [rangeId, setRangeId] = useState<ReportRangeId>('all_time');
  const [custom, setCustom] = useState<{ startMs: number; endMs: number } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const doExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const out = await exportCsv({
        scope: scope === 'all' ? 'all' : scope,
        range: rangeId,
        custom: custom ? { start: new Date(custom.startMs), end: new Date(custom.endMs) } : undefined,
        includeArchived,
      });
      if (!out) {
        setExportMsg(t('backup.exportFailed'));
      } else if (out.entryCount === 0) {
        setExportMsg(t('backup.exportEmpty'));
      } else {
        setExportMsg(t('backup.exported'));
      }
    } catch (e) {
      reportNonFatal(e, { stage: 'csv-export' });
      setExportMsg(t('backup.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const pickRange = (id: ReportRangeId) => {
    if (id === 'custom') { setCustomOpen(true); return; }
    setRangeId(id);
  };

  const driveBusy = web && !online;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('backup.title')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Notices />
        {web && !online ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}

        {anonymous ? (
          <Card style={{ gap: 12 }}>
            <T weight="semi" size={16}>{t('backup.linkFirst')}</T>
            <T size={13} color={th.muted} style={{ lineHeight: 19 }}>{t('account.anonBody')}</T>
            {linkError ? <T size={13} color={th.danger}>{t('account.linkFailed')}</T> : null}
            <Button
              title={linking ? t('account.linking') : t('account.linkGoogle')}
              icon="google"
              disabled={linking}
              onPress={() => void linkGoogle()}
            />
          </Card>
        ) : granted === null ? (
          <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
            <ActivityIndicator color={th.primary} />
          </Card>
        ) : !granted ? (
          <Card style={{ gap: 12 }}>
            <T weight="semi" size={16}>{t('drive.explainTitle')}</T>
            <T size={13} color={th.muted} style={{ lineHeight: 19 }}>{t('drive.explain')}</T>
            {revoked ? <T size={13} color={th.danger}>{t('drive.removed')}</T> : null}
            {accessMsg ? <T size={13} color={th.danger}>{accessMsg}</T> : null}
            <Button
              title={t('drive.allow')}
              icon="google-drive"
              onPress={() => void allowDrive()}
            />
          </Card>
        ) : (
          <>
            <Card style={{ gap: 12 }}>
              {failed ? (
                <Banner icon="cloud-alert" text={t('backup.failed')} action={t('common.retry')} onAction={() => void backUpNow()} />
              ) : null}
              <T size={13} color={th.muted}>
                {lastBackupAt
                  ? t('backup.lastBackup', { time: fmtBackupTime(lastBackupAt.seconds, settings.dateFormat) })
                  : t('backup.neverBackedUp')}
              </T>
              <Button
                title={backingUp ? t('backup.backingUp') : t('backup.backUpNow')}
                icon="cloud-upload-outline"
                disabled={backingUp || driveBusy}
                onPress={() => void backUpNow()}
              />
            </Card>

            {!web ? (
              <Card>
                <Picker
                  label={t('backup.frequency')}
                  valueLabel={t(`backup.freq.${settings.backupFrequency}`)}
                  options={(['off', 'daily', 'weekly', 'monthly'] as const).map((f) => ({
                    value: f,
                    label: t(`backup.freq.${f}`),
                    sub: f === 'off' ? undefined : t('backup.frequencySub'),
                  }))}
                  onPick={(v) => {
                    if (!uid) return;
                    void guardedWrite(getRepos().users.updateSettings(uid, {
                      backupFrequency: v as typeof settings.backupFrequency,
                    })).catch((e) => reportNonFatal(e, { stage: 'backup-frequency' }));
                  }}
                />
              </Card>
            ) : null}

            <Card style={{ paddingVertical: 4 }}>
              <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2, paddingVertical: 10 }}>
                {t('backup.yourBackups').toUpperCase()}
              </T>
              {backups === null ? (
                <ActivityIndicator color={th.primary} style={{ paddingVertical: 12 }} />
              ) : backups.length === 0 ? (
                <T size={13} color={th.muted} style={{ paddingBottom: 12 }}>{t('backup.noBackups')}</T>
              ) : (
                backups.map((b) => (
                  <Row
                    key={b.fileId}
                    icon="file-document-outline"
                    title={b.name.replace(/^milevana-backup-|\.json$/g, '')}
                    right={
                      <Button
                        title={t('common.delete')}
                        kind="text"
                        onPress={() => setDeleteTarget(b)}
                      />
                    }
                  />
                ))
              )}
              <Row
                icon="backup-restore"
                title={t('backup.restore')}
                onPress={() => router.push('/restore' as never)}
                right={<Icon name="chevron-right" color={th.muted} />}
              />
            </Card>
          </>
        )}

        <Card style={{ gap: 8 }}>
          <T weight="semi" size={16}>{t('backup.exportTitle')}</T>
          <T size={13} color={th.muted} style={{ lineHeight: 19 }}>{t('backup.exportBody')}</T>
          <Picker
            label={t('backup.vehicle')}
            valueLabel={scope === 'all' ? t('backup.allVehicles') : vehicles.find((v) => v.id === scope)?.name ?? ''}
            options={[
              { value: 'all', label: t('backup.allVehicles') },
              ...vehicles.map((v) => ({ value: v.id, label: v.name })),
            ]}
            onPick={setScope}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {REPORT_RANGE_IDS.map((id) => (
              <Chip
                key={id}
                label={t(`reports.range.${id}`)}
                active={rangeId === id}
                onPress={() => pickRange(id)}
              />
            ))}
            {scope === 'all' && vehicles.some((v) => v.archived) ? (
              <Chip
                label={t('backup.includeArchived')}
                active={includeArchived}
                onPress={() => setIncludeArchived(!includeArchived)}
              />
            ) : null}
          </View>
          {exportMsg ? <T size={13} color={th.muted}>{exportMsg}</T> : null}
          <Button
            title={exporting ? t('backup.exporting') : t('backup.exportCsv')}
            icon="file-delimited-outline"
            disabled={exporting || (web && !online)}
            onPress={() => void doExport()}
          />
        </Card>
      </ScrollView>

      {customOpen ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setCustomOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <CustomRange
              initial={custom}
              onApply={(c) => { setCustom(c); setRangeId('custom'); setCustomOpen(false); }}
              onClose={() => setCustomOpen(false)}
            />
          </View>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setDeleteTarget(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: th.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420, gap: 12 }}>
              <T size={18} weight="semi">{t('backup.deleteTitle')}</T>
              <T size={13} color={th.muted}>{t('backup.deleteBody')}</T>
              <Button title={t('common.delete')} kind="danger" disabled={deleting} onPress={() => void confirmDelete()} />
              <Button title={t('common.cancel')} kind="text" onPress={() => setDeleteTarget(null)} />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function CustomRange({ initial, onApply, onClose }: {
  initial: { startMs: number; endMs: number } | null;
  onApply: (c: { startMs: number; endMs: number }) => void;
  onClose: () => void;
}) {
  const th = useTheme();
  const [start, setStart] = useState<Date | undefined>(initial ? new Date(initial.startMs) : undefined);
  const [end, setEnd] = useState<Date | undefined>(initial ? new Date(initial.endMs) : undefined);
  const [error, setError] = useState(false);
  const apply = () => {
    if (!start || !end || start.getTime() > end.getTime()) { setError(true); return; }
    onApply({ startMs: start.getTime(), endMs: end.getTime() });
  };
  return (
    <View style={{ backgroundColor: th.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420 }}>
      <T size={18} weight="semi" style={{ marginBottom: 12 }}>{t('reports.customTitle')}</T>
      <DateTimeField label={t('reports.from')} mode="date" value={start} onChange={setStart} />
      <DateTimeField label={t('reports.to')} mode="date" value={end} onChange={setEnd} />
      {error ? <T size={12} color={th.danger} style={{ marginTop: -12, marginBottom: 12 }}>{t('reports.rangeInvalid')}</T> : null}
      <Button title={t('reports.apply')} onPress={apply} />
      <Button title={t('common.cancel')} kind="text" onPress={onClose} />
    </View>
  );
}

export default function BackupExport() {
  return (
    <ErrorBoundary screen="backup-export">
      <BackupExportScreen />
    </ErrorBoundary>
  );
}
