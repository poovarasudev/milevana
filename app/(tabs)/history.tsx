// History (LOG-11/12/14): the selected vehicle's full entry list — one watch,
// in-memory filters and search (LD-10/11/12: no extra reads), month-grouped
// rows, pull-to-refresh forces a server read, swipe-to-delete with the
// 5-second Undo snackbar, pending-sync markers on rows.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, View } from 'react-native';
import { ENTRY_TYPES } from '../../src/data/schema/common';
import { filterEntries } from '../../src/domain/entries';
import { fuelMileage, toMileageEntry, type MileageEntry } from '../../src/domain/fuel';
import { useAppStore } from '../../src/features/appStore';
import { refreshEntries, requestDelete, undoDelete, visibleEntries } from '../../src/features/entries';
import { t } from '../../src/i18n';
import { DateTimeField } from '../../src/ui/DateTimeField';
import { NoVehicle } from '../../src/ui/Empty';
import { EntryRow, monthSections } from '../../src/ui/HistoryList';
import { Button, Chip, Field, T } from '../../src/ui/kit';
import { Notices } from '../../src/ui/Notices';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { useScopedVehicle } from '../../src/ui/ComingSoonTab';
import { useTheme } from '../../src/ui/theme';
import { VehicleHeader } from '../../src/ui/VehicleHeader';

function HistoryTab() {
  const th = useTheme();
  const loaded = useAppStore((s) => s.vehiclesLoaded);
  const vehicle = useScopedVehicle();
  const entries = useAppStore((s) => s.entries);
  const arrived = useAppStore((s) => s.entriesArrived);
  const uid = useAppStore((s) => s.user?.uid);
  const pendingDeletes = useAppStore((s) => s.pendingDeletes);

  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<string[]>([]);
  const [from, setFrom] = useState<Date | undefined>();
  const [to, setTo] = useState<Date | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(() => visibleEntries(entries, pendingDeletes), [entries, pendingDeletes]);
  const filtered = useMemo(
    () => filterEntries(visible, { types, from, to, query }),
    [visible, types, from, to, query],
  );
  // Mileage intervals span consecutive fills in the FULL history — computing
  // them over the filtered subset would pair non-adjacent fills.
  const mileage = useMemo(
    () => fuelMileage(visible.map(toMileageEntry).filter((x): x is MileageEntry => x !== null)),
    [visible],
  );
  const sections = useMemo(() => monthSections(filtered), [filtered]);
  const filtersOn = types.length > 0 || !!from || !!to || query.trim().length > 0;
  const pending = Object.values(pendingDeletes).at(-1);

  if (!loaded || (vehicle && !arrived)) {
    return <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.primary} /></View>;
  }
  if (!vehicle) return <NoVehicle />;

  const toggleType = (x: string) =>
    setTypes((cur) => (cur.includes(x) ? cur.filter((v) => v !== x) : [...cur, x]));
  const refresh = async () => {
    setRefreshing(true);
    try { await refreshEntries(vehicle.id); } finally { setRefreshing(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <VehicleHeader vehicle={vehicle} />
      <View style={{ paddingHorizontal: 20 }}>
        <Notices />
        <Field
          label={t('history.search')}
          value={query}
          onChangeText={setQuery}
          placeholder={t('history.search')}
          autoCapitalize="none"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {ENTRY_TYPES.map((x) => (
              <Chip key={x} label={t(`entryTypes.${x}`)} active={types.includes(x)} onPress={() => toggleType(x)} />
            ))}
          </View>
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('history.dateFrom')} value={from} onChange={setFrom} onClear={() => setFrom(undefined)} mode="date" />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField label={t('history.dateTo')} value={to} onChange={setTo} onClear={() => setTo(undefined)} mode="date" />
          </View>
        </View>
        {filtersOn ? (
          <Button
            kind="text"
            title={t('history.clearFilters')}
            onPress={() => { setQuery(''); setTypes([]); setFrom(undefined); setTo(undefined); }}
          />
        ) : null}
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        renderSectionHeader={({ section }) => (
          <T size={13} weight="bold" color={th.muted} style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6, textTransform: 'uppercase' }}>
            {section.title}
          </T>
        )}
        renderItem={({ item }) => (
          <EntryRow
            entry={item}
            vehicle={vehicle}
            uid={uid}
            mileageRate={mileage.get(item.id)}
            onDelete={() => requestDelete(vehicle.id, item)}
          />
        )}
        ListEmptyComponent={
          <T color={th.muted} style={{ textAlign: 'center', marginTop: 40 }}>
            {filtersOn ? t('history.emptyFiltered') : t('history.empty')}
          </T>
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={th.primary} />}
        stickySectionHeadersEnabled={false}
      />
      {pending ? (
        <View style={{
          position: 'absolute', left: 16, right: 16, bottom: 88, flexDirection: 'row',
          alignItems: 'center', justifyContent: 'space-between', backgroundColor: th.text,
          borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
        }}>
          <T color={th.bg}>{t('history.deleted')}</T>
          <Pressable
            accessibilityRole="button"
            onPress={() => undoDelete(pending.entry.id)}
            style={{ minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center' }}
          >
            <T weight="bold" color={th.primarySoft}>{t('history.undo')}</T>
          </Pressable>
        </View>
      ) : null}
      <View style={{ position: 'absolute', right: 20, bottom: 20, left: 20 }}>
        <Button title={t('nav.addEntry')} icon="plus" onPress={() => router.push('/add')} />
      </View>
    </View>
  );
}

export default function History() {
  return (
    <ErrorBoundary screen="history">
      <HistoryTab />
    </ErrorBoundary>
  );
}
