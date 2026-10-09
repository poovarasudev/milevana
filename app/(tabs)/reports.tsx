import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSelectedVehicle, useStore } from '../../src/data/store';
import { formatMoney } from '../../src/domain/money';
import { monthlySeries } from '../../src/domain/stats';
import { NoVehicle } from '../../src/ui/Empty';
import { Card, Chip, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';
import { VehicleHeader } from '../../src/ui/VehicleHeader';

const RANGES = [{ l: '3M', m: 3 }, { l: '6M', m: 6 }, { l: '1Y', m: 12 }];

export default function Reports() {
  const t = useTheme();
  const v = useSelectedVehicle();
  const all = useStore((s) => s.entries);
  const [months, setMonths] = useState(6);
  const entries = useMemo(() => all.filter((e) => e.vehicleId === v?.id), [all, v?.id]);
  const series = useMemo(() => monthlySeries(entries, months), [entries, months]);
  if (!v) return <NoVehicle />;
  const total = series.reduce((s, x) => s + x.total, 0);
  const max = Math.max(1, ...series.map((x) => x.total));
  const peak = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]);
  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amountMinor, 0);
  const cost = entries.filter((e) => ['fuel', 'expense', 'service'].includes(e.type)).reduce((s, e) => s + e.amountMinor, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <VehicleHeader vehicle={v} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 16, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {RANGES.map((r) => <Chip key={r.l} label={r.l} active={months === r.m} onPress={() => setMonths(r.m)} />)}
        </View>
        <Card>
          <T size={11} weight="semi" color={t.muted} style={{ letterSpacing: 1.2 }}>MONTHLY SPEND</T>
          <T size={30} weight="semi" style={{ marginTop: 4 }}>{formatMoney(total)}</T>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 16 }}>
            {series.map((s) => (
              <View key={s.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <View accessibilityLabel={`${s.label} ${formatMoney(s.total)}`} style={{ width: '100%', height: Math.max(4, (s.total / max) * 96), borderRadius: 8, backgroundColor: s === peak && s.total > 0 ? t.primary : t.primarySoft }} />
                <T size={12} color={t.muted}>{s.label[0]}</T>
              </View>
            ))}
          </View>
        </Card>
        <Card>
          <T weight="semi" size={17}>Income vs cost</T>
          <T size={26} weight="semi" color={income - cost >= 0 ? t.income : t.danger} style={{ marginTop: 8 }}>
            {formatMoney(income - cost, '₹', true)}
          </T>
          <T size={13} color={t.muted}>{income > 0 ? `Cost is ${Math.round((cost / income) * 100)}% of income` : 'Log income to compare'}</T>
        </Card>
      </ScrollView>
    </View>
  );
}
