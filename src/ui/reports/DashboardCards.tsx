// Dashboard figures (RPT-13, PD-09): "Spent this month" with last month's
// comparison, per-unit cost figures (this month + 90 days), the fuel headline
// ('Last mileage', or all-time cost per unit for a petrol+CNG bi-fuel), the
// income-vs-cost card for income vehicles and the recent-entries list.
// Hours vehicles drop every distance figure (FR-VEH-16/OQ-11).

import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { tsToMillis } from '../../data/schema/common';
import { formatMileage, fuelMileage, toMileageEntry, type MileageEntry } from '../../domain/fuel';
import { formatAmount } from '../../domain/money';
import { dashboardFigures } from '../../domain/reports';
import { useAppStore } from '../../features/appStore';
import { requestDelete, visibleEntries } from '../../features/entries';
import { useSettings } from '../../features/format';
import { t } from '../../i18n';
import { EntryRow } from '../HistoryList';
import { Card, T } from '../kit';
import { useTheme } from '../theme';
import { rateText } from './reportDisplay';

const RECENT = 5;

export function DashboardCards({ vehicle }: { vehicle: VehicleRecord }) {
  const th = useTheme();
  const settings = useSettings();
  const uid = useAppStore((s) => s.user?.uid);
  const entries = useAppStore((s) => s.entries);
  const arrived = useAppStore((s) => s.entriesArrived);
  const pendingDeletes = useAppStore((s) => s.pendingDeletes);

  const fig = useMemo(
    () => dashboardFigures(vehicle, visibleEntries(entries, pendingDeletes)),
    [vehicle, entries, pendingDeletes],
  );

  const recent = useMemo(
    () => [...visibleEntries(entries, pendingDeletes)]
      .sort((a, b) => tsToMillis(b.date) - tsToMillis(a.date))
      .slice(0, RECENT),
    [entries, pendingDeletes],
  );
  const mileage = useMemo(
    () => fuelMileage(visibleEntries(entries, pendingDeletes).map(toMileageEntry).filter((x): x is MileageEntry => x !== null)),
    [entries, pendingDeletes],
  );

  if (!arrived) {
    return (
      <Card style={{ marginHorizontal: 20 }}>
        <T size={13} color={th.muted}>{t('dashboard.loadingEntries')}</T>
      </Card>
    );
  }

  const headlineText = fig.headline?.kind === 'mileage' && fig.headline.value !== undefined
    ? formatMileage(fig.headline.value, fig.headline.fuelType ?? 'petrol', vehicle.odometerUnit, settings)
    : null;

  return (
    <View style={{ gap: 16 }}>
      <Card style={{ marginHorizontal: 20, gap: 10 }} testID="dashboard-spend">
        <T size={13} color={th.muted}>{t('dashboard.spentThisMonth')}</T>
        <T size={30} weight="bold" style={{ letterSpacing: -0.6 }}>
          {formatAmount({ minor: fig.monthSpendMinor, currency: vehicle.currency })}
        </T>
        <T size={12} color={th.muted}>
          {t('dashboard.vsPrevMonth', { value: formatAmount({ minor: fig.prevMonthSpendMinor, currency: vehicle.currency }) })}
        </T>
        {fig.distanceMetrics ? (
          <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: th.divider, paddingTop: 10 }}>
            {fig.monthCostPerKm !== undefined ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={13} color={th.muted}>{t('dashboard.costPerUnit', { unit: t(`units.${vehicle.odometerUnit}`) })}</T>
                <T size={13} weight="semi">{rateText(fig.monthCostPerKm, vehicle.currency, vehicle.odometerUnit, settings)}</T>
              </View>
            ) : null}
            {fig.costPerKm90 !== undefined ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={13} color={th.muted}>{t('dashboard.costPerUnit90', { unit: t(`units.${vehicle.odometerUnit}`) })}</T>
                <T size={13} weight="semi">{rateText(fig.costPerKm90, vehicle.currency, vehicle.odometerUnit, settings)}</T>
              </View>
            ) : null}
          </View>
        ) : null}
      </Card>

      {fig.distanceMetrics && (headlineText || fig.headline?.kind === 'costPerKm') ? (
        <Card style={{ marginHorizontal: 20, gap: 6 }} testID="dashboard-headline">
          <T size={13} color={th.muted}>
            {fig.headline?.kind === 'costPerKm'
              ? t('dashboard.costPerUnit', { unit: t(`units.${vehicle.odometerUnit}`) })
              : t('dashboard.lastMileage')}
          </T>
          <T size={22} weight="bold">
            {fig.headline?.kind === 'costPerKm'
              ? fig.headline.value !== undefined
                ? rateText(fig.headline.value, vehicle.currency, vehicle.odometerUnit, settings)
                : '—'
              : headlineText ?? '—'}
          </T>
        </Card>
      ) : null}

      {fig.incomeVsCost ? (
        <Card style={{ marginHorizontal: 20, gap: 8 }} testID="dashboard-income">
          <T size={13} color={th.muted}>{t('dashboard.incomeVsCost')}</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color={th.muted}>{t('reports.income')}</T>
            <T size={13} weight="semi" color={th.income}>+{formatAmount({ minor: fig.incomeVsCost.income, currency: vehicle.currency })}</T>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T size={13} color={th.muted}>{t('reports.cost')}</T>
            <T size={13} weight="semi">−{formatAmount({ minor: fig.incomeVsCost.cost, currency: vehicle.currency })}</T>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: th.divider, paddingTop: 8 }}>
            <T size={13} weight="semi">{t('reports.netProfit')}</T>
            <T size={13} weight="bold" color={fig.incomeVsCost.income - fig.incomeVsCost.cost < 0 ? th.danger : th.income}>
              {formatAmount({ minor: fig.incomeVsCost.income - fig.incomeVsCost.cost, currency: vehicle.currency })}
            </T>
          </View>
        </Card>
      ) : null}

      <View testID="dashboard-recent">
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 6 }}>
          <T size={16} weight="semi" style={{ flex: 1 }}>{t('dashboard.recent')}</T>
          {recent.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/history')}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <T size={13} weight="bold" color={th.primary}>{t('dashboard.seeAll')}</T>
            </Pressable>
          ) : null}
        </View>
        {recent.length === 0 ? (
          <Card style={{ marginHorizontal: 20 }}>
            <T size={13} color={th.muted}>{t('dashboard.noDataHint')}</T>
          </Card>
        ) : (
          recent.map((e: EntryRecord) => (
            <EntryRow
              key={e.id}
              entry={e}
              vehicle={vehicle}
              uid={uid}
              mileageRate={mileage.get(e.id)}
              onDelete={() => requestDelete(vehicle.id, e)}
            />
          ))
        )}
      </View>
    </View>
  );
}
