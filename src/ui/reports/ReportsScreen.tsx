// Reports tab (RPT-04..RPT-12): scope = selected vehicle, "All vehicles", or
// a deep-linked vehicle (?vehicle=id — the archived-vehicle path, PD-08).
// The range persists per scope in localFlags (PD-01). Entry data comes from
// the shared selected-vehicle watch plus sequential per-vehicle report
// watches (RPT-04); failed vehicles are skipped with a per-vehicle notice.

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView, View,
} from 'react-native';
import { localFlags } from '../../data/localFlags';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { aggregateReports, resolveRange, vehicleReport, type ReportPeriod, type ReportRangeId, REPORT_RANGE_IDS, type VehicleReport } from '../../domain/reports';
import { useAppStore } from '../../features/appStore';
import { visibleEntries, refreshEntries } from '../../features/entries';
import {
  entriesForReport, entriesArrivedForReport, reportEntriesFailed,
  refreshReportEntries, stopReportEntryWatches, syncReportEntryWatches,
} from '../../features/reportData';
import { t } from '../../i18n';
import { DateTimeField } from '../DateTimeField';
import { NoVehicle } from '../Empty';
import { Button, Card, Chip, Icon, T } from '../kit';
import { Notices } from '../Notices';
import { useTheme } from '../theme';
import { VehicleHeader } from '../VehicleHeader';
import { ReportFiguresView } from './ReportSections';

const rangeKey = (scope: string) => `reportRange.${scope}`;
type SavedRange = { id: ReportRangeId; custom?: { startMs: number; endMs: number } };

export function ReportsScreen({ scopeVehicleId }: { scopeVehicleId?: string }) {
  const th = useTheme();
  const loaded = useAppStore((s) => s.vehiclesLoaded);
  const vehicles = useAppStore((s) => s.vehicles);
  const selectedId = useAppStore((s) => s.selectedVehicleId);
  const allVehicles = useAppStore((s) => s.reportsAllVehicles);
  const uid = useAppStore((s) => s.user?.uid);
  // subscriptions so derived data recomputes as watches land
  const shared = useAppStore((s) => s.entries);
  const sharedId = useAppStore((s) => s.entriesVehicleId);
  const sharedArrived = useAppStore((s) => s.entriesArrived);
  const cached = useAppStore((s) => s.reportEntries);
  const arrived = useAppStore((s) => s.reportEntriesArrived);
  const failed = useAppStore((s) => s.reportEntriesFailed);
  const pendingDeletes = useAppStore((s) => s.pendingDeletes);

  const paramVehicle = scopeVehicleId ? vehicles.find((v) => v.id === scopeVehicleId) ?? null : null;
  const vehicle = paramVehicle ?? vehicles.find((v) => v.id === selectedId && !v.archived) ?? null;
  const all = allVehicles && !paramVehicle;
  const [includeArchived, setIncludeArchived] = useState(false);

  const scopeKey = paramVehicle ? paramVehicle.id : all ? 'all' : vehicle?.id ?? 'none';

  const [rangeId, setRangeId] = useState<ReportRangeId>('this_month');
  const [custom, setCustom] = useState<{ startMs: number; endMs: number } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  // PD-01: the chosen range persists per scope (vehicle id / 'all').
  useEffect(() => {
    if (!uid || scopeKey === 'none') return;
    let live = true;
    void localFlags.getJson<SavedRange>(uid, rangeKey(scopeKey), { id: 'this_month' }).then((s) => {
      if (!live) return;
      setRangeId(REPORT_RANGE_IDS.includes(s.id) ? s.id : 'this_month');
      setCustom(s.custom ?? null);
    });
    return () => { live = false; };
  }, [uid, scopeKey]);

  const pickRange = (id: ReportRangeId) => {
    if (id === 'custom') { setCustomOpen(true); return; }
    setRangeId(id);
    if (uid) void localFlags.setJson(uid, rangeKey(scopeKey), { id, custom });
  };
  const applyCustom = (c: { startMs: number; endMs: number }) => {
    setCustom(c);
    setRangeId('custom');
    setCustomOpen(false);
    if (uid) void localFlags.setJson(uid, rangeKey(scopeKey), { id: 'custom', custom: c });
  };

  const scopeVehicles = useMemo(
    () => (all
      ? vehicles.filter((v) => includeArchived || !v.archived)
      : vehicle ? [vehicle] : []),
    [all, includeArchived, vehicle, vehicles],
  );
  const scopeIds = scopeVehicles.map((v) => v.id);
  const scopeIdsKey = scopeIds.join(',');

  // RPT-04: keep report watches aligned with the scope; the shared vehicle is
  // skipped inside sync. Watches stop when the screen unmounts.
  useEffect(() => {
    if (!all && !paramVehicle) return; // single selected vehicle: shared watch only
    syncReportEntryWatches(scopeIds);
  }, [all, paramVehicle, scopeIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stopReportEntryWatches(), []);

  const now = useMemo(() => new Date(), []);

  const data = useMemo(() => {
    const periodFor = (v: VehicleRecord): ReportPeriod | null =>
      resolveRange(rangeId, {
        now,
        createdAt: v.createdAt,
        custom: custom ? { start: new Date(custom.startMs), end: new Date(custom.endMs) } : undefined,
      });
    const ready: VehicleReport[] = [];
    let pending = 0;
    let totalEntries = 0;
    const failedNames: string[] = [];
    for (const v of scopeVehicles) {
      if (reportEntriesFailed(v.id)) { failedNames.push(v.name); continue; }
      if (!entriesArrivedForReport(v.id)) { pending += 1; continue; }
      const p = periodFor(v);
      if (!p) continue;
      const list = visibleEntries(entriesForReport(v.id), pendingDeletes);
      totalEntries += list.length;
      ready.push(vehicleReport(v, list, p, { now }));
    }
    return {
      reports: ready,
      blocks: all ? aggregateReports(ready, { includeArchived: true }) : [],
      pending,
      failedNames,
      totalEntries,
      anyArrived: ready.length > 0 || failedNames.length > 0 || pending === 0,
    };
    // entries/state objects are the real inputs — the watches swap them by ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, includeArchived, scopeIdsKey, rangeId, custom, shared, sharedId, sharedArrived, cached, arrived, failed, pendingDeletes, now]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (sharedId && scopeIds.includes(sharedId)) await refreshEntries(sharedId);
      await refreshReportEntries(scopeIds);
    } finally {
      setRefreshing(false);
    }
  };

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.primary} /></View>;
  }
  if (!all && !vehicle) return <NoVehicle />;
  if (all && scopeVehicles.length === 0) return <NoVehicle />;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <VehicleHeader vehicle={paramVehicle ?? (all ? null : vehicle)} allVehicles={all} />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={th.primary} />}
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 120, gap: 16 }}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Notices />
          {paramVehicle?.archived ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name="archive-outline" size={16} color={th.muted} />
              <T size={12} color={th.muted}>{t('reports.archivedVehicle')}</T>
            </View>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          style={{ flexGrow: 0 }}
        >
          {REPORT_RANGE_IDS.map((id) => (
            <Chip
              key={id}
              label={id === 'custom' && custom && rangeId === 'custom'
                ? `${t('reports.range.custom')} · ${rangeLabel(custom)}`
                : t(`reports.range.${id}`)}
              active={rangeId === id}
              onPress={() => pickRange(id)}
            />
          ))}
          {all && vehicles.some((v) => v.archived) ? (
            <Chip
              label={t('reports.includeArchived')}
              active={includeArchived}
              onPress={() => setIncludeArchived(!includeArchived)}
            />
          ) : null}
        </ScrollView>

        {data.failedNames.map((name) => (
          <View key={name} style={{ paddingHorizontal: 20 }}>
            <Card style={{ borderColor: th.danger, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="alert-circle" color={th.danger} size={20} />
              <T size={13} weight="semi" color={th.danger} style={{ flex: 1 }}>{t('reports.couldntLoad', { name })}</T>
            </Card>
          </View>
        ))}

        {!data.anyArrived || data.pending === scopeVehicles.length ? (
          <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
            <ActivityIndicator color={th.primary} />
          </View>
        ) : data.totalEntries === 0 && data.reports.length === scopeVehicles.length - data.failedNames.length ? (
          <View style={{ paddingHorizontal: 20 }}>
            <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
              <T size={16} weight="semi">{t('reports.empty')}</T>
              <T size={13} color={th.muted}>{t('reports.emptyBody')}</T>
              {vehicle && !vehicle.archived ? (
                <Button kind="secondary" title={t('nav.addEntry')} icon="plus" onPress={() => router.push('/add')} />
              ) : null}
            </Card>
          </View>
        ) : (
          <>
            {data.pending > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
                <ActivityIndicator size="small" color={th.primary} />
                <T size={12} color={th.muted}>{t('reports.loadingVehicles', { count: data.pending })}</T>
              </View>
            ) : null}
            {all
              ? data.blocks.map((b) => (
                <View key={b.currency} style={{ gap: 16 }}>
                  {data.blocks.length > 1 ? (
                    <T size={13} weight="bold" style={{ paddingHorizontal: 20, letterSpacing: 1.1 }}>
                      {t('reports.currencyBlock', { currency: b.currency }).toUpperCase()}
                    </T>
                  ) : null}
                  <ReportFiguresView r={b} currency={b.currency} multi />
                </View>
              ))
              : data.reports.map((r) => (
                <ReportFiguresView key={r.vehicle.id} r={r} currency={r.currency} multi={false} />
              ))}
          </>
        )}
      </ScrollView>

      {customOpen ? (
        <CustomRangeModal
          initial={custom}
          onApply={applyCustom}
          onClose={() => setCustomOpen(false)}
        />
      ) : null}
    </View>
  );
}

function rangeLabel(c: { startMs: number; endMs: number }): string {
  const fmt = (ms: number) => {
    const d = new Date(ms);
    return `${d.getDate()} ${t(`history.months.${d.getMonth()}`).slice(0, 3)}`;
  };
  return `${fmt(c.startMs)}–${fmt(c.endMs)}`;
}

function CustomRangeModal({ initial, onApply, onClose }: {
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
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: th.card, borderRadius: 20, padding: 20, width: '100%', maxWidth: 420 }}>
          <T size={18} weight="semi" style={{ marginBottom: 12 }}>{t('reports.customTitle')}</T>
          <DateTimeField label={t('reports.from')} mode="date" value={start} onChange={setStart} />
          <DateTimeField label={t('reports.to')} mode="date" value={end} onChange={setEnd} />
          {error ? <T size={12} color={th.danger} style={{ marginTop: -12, marginBottom: 12 }}>{t('reports.rangeInvalid')}</T> : null}
          <Button title={t('reports.apply')} onPress={apply} />
          <Button title={t('common.cancel')} kind="text" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
