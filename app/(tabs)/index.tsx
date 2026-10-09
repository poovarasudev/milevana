import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useStore, useSelectedVehicle } from '../../src/data/store';
import { formatMoney } from '../../src/domain/money';
import { formatEfficiency, lastMileage, monthKey, monthSpend } from '../../src/domain/stats';
import { Button, Card, T } from '../../src/ui/kit';
import { EntryRow } from '../../src/ui/EntryRow';
import { NoVehicle } from '../../src/ui/Empty';
import { useTheme } from '../../src/ui/theme';
import { VehicleHeader } from '../../src/ui/VehicleHeader';
import { useMemo } from 'react';

const nowMs = () => Date.now();

export default function Dashboard() {
  const t = useTheme();
  const v = useSelectedVehicle();
  const all = useStore((s) => s.entries);
  const eff = useStore((s) => s.settings.efficiency);
  const entries = useMemo(() => all.filter((e) => e.vehicleId === v?.id), [all, v?.id]);
  if (!v) return <NoVehicle />;

  const now = nowMs();
  const spend = monthSpend(entries, monthKey(now));
  const mileage = lastMileage(entries);
  const recent = [...entries].sort((a, b) => b.date - a.date).slice(0, 4);
  const monthName = new Date(now).toLocaleString('en', { month: 'long' }).toUpperCase();

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <VehicleHeader vehicle={v} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 100 }}>
        <Card>
          <T size={11} weight="semi" color={t.muted} style={{ letterSpacing: 1.2 }}>{monthName}</T>
          <T size={34} weight="semi" style={{ letterSpacing: -1, marginTop: 4 }}>{formatMoney(spend)}</T>
          <T size={13} color={t.muted}>Spent this month</T>
        </Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <T size={13} color={t.muted}>Last mileage</T>
            <T size={20} weight="semi" style={{ marginTop: 4 }}>{mileage ? formatEfficiency(mileage, eff) : '—'}</T>
          </Card>
          <Card style={{ flex: 1 }}>
            <T size={13} color={t.muted}>Next service</T>
            <T size={20} weight="semi" style={{ marginTop: 4 }}>—</T>
          </Card>
        </View>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T weight="semi" size={17}>Recent</T>
            {recent.length > 0 && <T weight="semi" color={t.primary} onPress={() => router.push('/(tabs)/history')}>See all</T>}
          </View>
          {recent.length === 0 ? (
            <T color={t.muted} style={{ marginVertical: 16 }}>No entries yet. Tap + to log your first fill-up.</T>
          ) : (
            recent.map((e) => <EntryRow key={e.id} entry={e} unit={v.odometerUnit} />)
          )}
        </Card>
      </ScrollView>
      <View style={{ position: 'absolute', right: 20, bottom: 20, left: 20 }}>
        <Button title="Add entry" icon="plus" onPress={() => router.push('/add')} />
      </View>
    </View>
  );
}
