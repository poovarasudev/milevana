// History rows and month grouping (LOG-11/12): one row per entry with type
// icon, date, summary, amount, odometer, logged-by name and pending-sync
// indicator. Rows open the matching edit form; deletable rows swipe to delete.

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { EntryRecord } from '../data/repos/entryRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { tsToMillis } from '../data/schema/common';
import type {
  FuelDetailsDoc, IncomeDetailsDoc, InspectionDetailsDoc, ServiceDetailsDoc,
  TripDetailsDoc,
} from '../data/schema/entry';
import { issuesBadge } from '../domain/checklists';
import { formatMileage } from '../domain/fuel';
import { formatAmount } from '../domain/money';
import { canDeleteEntry } from '../features/entries';
import { formatDate, useSettings } from '../features/format';
import { t } from '../i18n';
import { Card, Icon, T, type IconName } from './kit';
import { SwipeToDelete } from './SwipeRow';
import { useTheme } from './theme';

const ICONS: Record<string, IconName> = {
  fuel: 'gas-station',
  expense: 'wallet-outline',
  service: 'wrench',
  income: 'cash-plus',
  trip: 'map-marker-distance',
  inspection: 'clipboard-check-outline',
};

/** CHK-09: the issue badge count ('No issues' at 0). */
function inspectionIssues(e: EntryRecord): number {
  return (e.details as InspectionDetailsDoc | undefined)?.issueCount ?? 0;
}

function rowIcon(e: EntryRecord): IconName {
  const d = e.details as FuelDetailsDoc | undefined;
  if (e.type === 'fuel' && d?.fuelType === 'electric') return 'ev-station';
  return ICONS[e.type] ?? 'file-document-outline';
}

function rowTitle(e: EntryRecord): string {
  switch (e.type) {
    case 'fuel': {
      const d = e.details as FuelDetailsDoc;
      return t(`fuelTypes.${d?.fuelType ?? 'petrol'}`);
    }
    case 'trip': {
      const d = e.details as TripDetailsDoc;
      return d?.from || d?.to ? `${d.from || '—'} → ${d.to || '—'}` : t('history.tripNoRoute');
    }
    case 'inspection': {
      // CHK-09: the row names the checklist it ran from — readable even
      // after the template was renamed or deleted (snapshot).
      const d = e.details as InspectionDetailsDoc | undefined;
      return d?.templateName || t('entryTypes.inspection');
    }
    default:
      return e.category ?? t(`entryTypes.${e.type}`);
  }
}

function rowDetails(e: EntryRecord): string | null {
  const d = e.details as (FuelDetailsDoc & ServiceDetailsDoc & IncomeDetailsDoc) | undefined;
  if (e.type === 'fuel' && d?.stationName) return d.stationName;
  if (e.type === 'service' && d?.lines?.length) {
    return t('history.serviceItems', { count: d.lines.length });
  }
  if (e.type === 'income' && d?.platform) return d.platform;
  return null;
}

export function EntryRow({ entry, vehicle, uid, mileageRate, onDelete }: {
  entry: EntryRecord;
  vehicle: VehicleRecord;
  uid?: string;
  mileageRate?: number;
  onDelete: () => void;
}) {
  const th = useTheme();
  const settings = useSettings();
  const details = rowDetails(entry);
  const fuelType = (entry.details as FuelDetailsDoc | undefined)?.fuelType ?? 'petrol';
  const mileage = formatMileage(mileageRate, fuelType, vehicle.odometerUnit, settings);
  const deletable = canDeleteEntry(entry, vehicle, uid);
  const mine = entry.createdBy === uid;

  const row = (
    <Pressable
      onPress={() => router.push({ pathname: '/entry/[type]', params: { type: entry.type, id: entry.id } })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: th.card }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: th.tile, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={rowIcon(entry)} size={20} color={th.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T weight="semi" numberOfLines={1} style={{ flexShrink: 1 }}>{rowTitle(entry)}</T>
          {entry.pending ? <Icon name="clock-outline" size={13} color={th.muted} /> : null}
          {entry.type === 'inspection' ? (
            <View style={{
              borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
              backgroundColor: inspectionIssues(entry) > 0 ? th.dangerSoft : th.primarySoft,
            }}>
              <T size={11} weight="bold" color={inspectionIssues(entry) > 0 ? th.danger : th.primary}>
                {issuesBadge(inspectionIssues(entry), t)}
              </T>
            </View>
          ) : null}
        </View>
        <T size={12} color={th.muted} numberOfLines={1}>
          {formatDate(entry.date, settings.dateFormat)}
          {details ? ` · ${details}` : ''}
          {entry.odometer != null ? ` · ${entry.odometer} ${t(`units.${vehicle.odometerUnit}`)}` : ''}
        </T>
        {mileage ? <T size={12} color={th.primary}>{mileage}</T> : null}
        {!mine && entry.createdByName ? (
          <T size={12} color={th.muted}>{t('history.loggedBy', { name: entry.createdByName })}</T>
        ) : null}
      </View>
      {entry.amount ? (
        <T weight="bold" color={entry.type === 'income' ? th.primary : th.text}>
          {entry.type === 'income' ? '+' : '−'}{formatAmount(entry.amount)}
        </T>
      ) : null}
    </Pressable>
  );

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 8, overflow: 'hidden' }}>
      <SwipeToDelete disabled={!deletable} onDelete={onDelete}>{row}</SwipeToDelete>
    </Card>
  );
}

export interface HistorySection {
  title: string;
  data: EntryRecord[];
}

/** Group entries (already sorted newest-first) into calendar months. */
export function monthSections(entries: EntryRecord[], now = new Date()): HistorySection[] {
  const sections: HistorySection[] = [];
  for (const e of entries) {
    const d = new Date(tsToMillis(e.date));
    const label = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      ? t('history.thisMonth')
      : t('history.monthYear', { month: t(`history.months.${d.getMonth()}`), year: d.getFullYear() });
    const last = sections[sections.length - 1];
    if (last && last.title === label) last.data.push(e);
    else sections.push({ title: label, data: [e] });
  }
  return sections;
}
