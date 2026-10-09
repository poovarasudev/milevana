import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSelectedVehicle, useStore } from '../../src/data/store';
import { formatMoney } from '../../src/domain/money';
import { monthKey, monthSpend } from '../../src/domain/stats';
import type { EntryType } from '../../src/domain/types';
import { ENTRY_LABEL } from '../../src/features/entryView';
import { EntryRow } from '../../src/ui/EntryRow';
import { NoVehicle } from '../../src/ui/Empty';
import { Card, Chip, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';
import { VehicleHeader } from '../../src/ui/VehicleHeader';

const FILTERS: EntryType[] = ['fuel', 'service', 'expense', 'income', 'trip'];

export default function History() {
  const t = useTheme();
  const v = useSelectedVehicle();
  const all = useStore((s) => s.entries);
  const [filter, setFilter] = useState<EntryType | null>(null);
  const entries = useMemo(() => all.filter((e) => e.vehicleId === v?.id), [all, v?.id]);
  const groups = useMemo(() => {
    const shown = entries.filter((e) => !filter || e.type === filter).sort((a, b) => b.date - a.date);
    const map = new Map<string, typeof shown>();
    shown.forEach((e) => map.set(monthKey(e.date), [...(map.get(monthKey(e.date)) ?? []), e]));
    return [...map.entries()];
  }, [entries, filter]);
  if (!v) return <NoVehicle />;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <VehicleHeader vehicle={v} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <T color={t.muted} size={13}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12, flexWrap: 'wrap' }}>
        <Chip label="All" active={!filter} onPress={() => setFilter(null)} />
        {FILTERS.map((f) => <Chip key={f} label={ENTRY_LABEL[f]} active={filter === f} onPress={() => setFilter(filter === f ? null : f)} />)}
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 40 }}>
        {groups.length === 0 && <T color={t.muted}>Nothing here yet.</T>}
        {groups.map(([key, items]) => {
          const [y, m] = key.split('-').map(Number);
          return (
            <Card key={key}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T size={11} weight="semi" color={t.muted} style={{ letterSpacing: 1.2 }}>
                  {new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' }).toUpperCase()}
                </T>
                <T weight="semi">{formatMoney(monthSpend(items, key))}</T>
              </View>
              {items.map((e) => <EntryRow key={e.id} entry={e} unit={v.odometerUnit} />)}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
