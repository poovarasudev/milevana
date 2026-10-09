// Restore (DRV-09/10): pick a backup (latest preselected), review the
// per-vehicle comparison — missing vehicles restore outright, differing
// vehicles get a keep-current/replace choice, identical and not-owned
// vehicles are skipped — then a chunked write run with progress and Cancel
// (≤500-op batches; re-running after cancel/failure is safe — ED-06).

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { BackupFileError } from '../src/data/drive/backupFile';
import { BackupListItem, listBackups } from '../src/features/backup';
import { useAppStore } from '../src/features/appStore';
import {
  planRestore,
  RestorePlan,
  RestoreReview,
  reviewBackup,
  runRestore,
} from '../src/features/restore';
import { reportNonFatal } from '../src/features/reporting';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Button, Card, Chip, Header, Icon, Row, T } from '../src/ui/kit';
import { Notices } from '../src/ui/Notices';
import { useTheme } from '../src/ui/theme';

type Stage =
  | { kind: 'list' }
  | { kind: 'reviewing'; fileId: string }
  | { kind: 'review'; review: RestoreReview }
  | { kind: 'running'; plan: RestorePlan }
  | { kind: 'done'; plan: RestorePlan; cancelled: boolean };

function statusText(s: string): string {
  switch (s) {
    case 'missing': return t('restore.missing');
    case 'same': return t('restore.same');
    case 'not-yours': return t('restore.notYours');
    default: return t('restore.differs');
  }
}

function RestoreScreen() {
  const th = useTheme();
  const uid = useAppStore((s) => s.user?.uid);
  const [stage, setStage] = useState<Stage>({ kind: 'list' });
  const [backups, setBackups] = useState<BackupListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replaceIds, setReplaceIds] = useState<Set<string>>(new Set());
  const [withSettings, setWithSettings] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!uid) return;
    let live = true;
    listBackups(uid)
      .then((b) => { if (live) setBackups(b); })
      .catch(() => { if (live) setBackups([]); });
    return () => { live = false; };
  }, [uid]);

  const choose = async (fileId: string) => {
    if (!uid) return;
    setLoadError(null);
    setStage({ kind: 'reviewing', fileId });
    try {
      const review = await reviewBackup(uid, fileId);
      setReplaceIds(new Set());
      setWithSettings(review.settingsAvailable);
      setStage({ kind: 'review', review });
    } catch (e) {
      if (e instanceof BackupFileError) {
        setLoadError(e.code === 'unsupported-version' ? t('restore.updateApp') : t('restore.invalidFile'));
      } else {
        reportNonFatal(e, { stage: 'restore-review' });
        setLoadError(t('drive.unavailable'));
      }
      setStage({ kind: 'list' });
    }
  };

  const start = async () => {
    if (!uid || stage.kind !== 'review') return;
    try {
      const plan = await planRestore(uid, stage.review, {
        replaceVehicleIds: [...replaceIds],
        restoreSettings: withSettings,
      });
      cancelled.current = false;
      setProgress({ done: 0, total: plan.ops.length });
      setStage({ kind: 'running', plan });
      const res = await runRestore(uid, plan, {
        onProgress: (done, total) => setProgress({ done, total }),
        isCancelled: () => cancelled.current,
      });
      setStage({ kind: 'done', plan, cancelled: res.cancelled });
    } catch (e) {
      reportNonFatal(e, { stage: 'restore-run' });
      // Failed partway — back to the list; re-running is safe (ED-06).
      setLoadError(t('restore.failed'));
      setStage({ kind: 'list' });
    }
  };

  const back = () => router.back();

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={t('restore.title')} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Notices />
        {loadError ? (
          <Card style={{ borderColor: th.danger }}>
            <T size={13} weight="semi" color={th.danger}>{loadError}</T>
          </Card>
        ) : null}

        {stage.kind === 'list' || stage.kind === 'reviewing' ? (
          <Card style={{ paddingVertical: 4 }}>
            <T size={11} weight="semi" color={th.muted} style={{ letterSpacing: 1.2, paddingVertical: 10 }}>
              {t('restore.choose').toUpperCase()}
            </T>
            {backups === null || stage.kind === 'reviewing' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                <ActivityIndicator size="small" color={th.primary} />
                {stage.kind === 'reviewing' ? <T size={13} color={th.muted}>{t('restore.reviewing')}</T> : null}
              </View>
            ) : backups.length === 0 ? (
              <T size={13} color={th.muted} style={{ paddingBottom: 12 }}>{t('backup.noBackups')}</T>
            ) : (
              backups.map((b, i) => (
                <Row
                  key={b.fileId}
                  icon="file-document-outline"
                  title={b.name.replace(/^milevana-backup-|\.json$/g, '')}
                  sub={i === 0 ? t('restore.latest') : undefined}
                  onPress={() => void choose(b.fileId)}
                  right={<Icon name="chevron-right" color={th.muted} />}
                />
              ))
            )}
          </Card>
        ) : null}

        {stage.kind === 'review' ? (
          <>
            <Card style={{ paddingVertical: 4 }}>
              {stage.review.vehicles.length === 0 ? (
                <T size={13} color={th.muted} style={{ paddingVertical: 12 }}>{t('restore.empty')}</T>
              ) : (
                stage.review.vehicles.map((v) => (
                  <View key={v.vehicleId} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: th.divider }}>
                    <T weight="semi">{v.name}</T>
                    <T size={12} color={v.status === 'not-yours' ? th.danger : th.muted} style={{ marginTop: 2 }}>
                      {statusText(v.status)}
                    </T>
                    {v.status === 'differs' ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Chip
                          label={t('restore.keepCurrent')}
                          active={!replaceIds.has(v.vehicleId)}
                          onPress={() => setReplaceIds((s) => { const n = new Set(s); n.delete(v.vehicleId); return n; })}
                        />
                        <Chip
                          label={t('restore.replace')}
                          active={replaceIds.has(v.vehicleId)}
                          onPress={() => setReplaceIds((s) => new Set(s).add(v.vehicleId))}
                        />
                      </View>
                    ) : null}
                  </View>
                ))
              )}
            </Card>
            <Card style={{ gap: 12 }}>
              {stage.review.settingsAvailable ? (
                <Chip
                  label={t('restore.settings')}
                  active={withSettings}
                  onPress={() => setWithSettings(!withSettings)}
                />
              ) : null}
              <T size={12} color={th.muted} style={{ lineHeight: 18 }}>{t('restore.warnReturn')}</T>
              <Button title={t('restore.start')} icon="backup-restore" onPress={() => void start()} />
            </Card>
          </>
        ) : null}

        {stage.kind === 'running' ? (
          <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 24 }}>
            <ActivityIndicator color={th.primary} />
            <T size={13} color={th.muted}>
              {t('restore.restoring', { done: progress?.done ?? 0, total: progress?.total ?? 0 })}
            </T>
            <Button title={t('restore.cancel')} kind="secondary" onPress={() => { cancelled.current = true; }} />
          </Card>
        ) : null}

        {stage.kind === 'done' ? (
          <Card style={{ gap: 12 }}>
            <T weight="semi" size={16}>{stage.cancelled ? t('restore.cancelled') : t('restore.done')}</T>
            <T size={13} color={th.muted}>
              {t('restore.summary', {
                restored: stage.plan.touchedVehicles.length,
                kept: stage.plan.skippedKept + stage.plan.skippedSame,
                skipped: stage.plan.skippedNotYours,
              })}
            </T>
            <Button title={t('common.done')} onPress={back} />
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

export default function Restore() {
  return (
    <ErrorBoundary screen="restore">
      <RestoreScreen />
    </ErrorBoundary>
  );
}
