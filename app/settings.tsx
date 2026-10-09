import { ScrollView, Pressable, View } from 'react-native';
import { useStore } from '../src/data/store';
import type { EfficiencyFormat, ThemeMode } from '../src/domain/types';
import { Card, Chip, Header, Icon, Label, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

const FORMATS: { id: EfficiencyFormat; l: string; d: string }[] = [
  { id: 'kml', l: 'km/l', d: 'Kilometres per litre' },
  { id: 'l100', l: 'L/100 km', d: 'Litres per 100 kilometres' },
  { id: 'mpg', l: 'mpg', d: 'Miles per gallon' },
];

export default function Settings() {
  const t = useTheme();
  const s = useStore((x) => x.settings);
  const set = useStore((x) => x.setSettings);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
        <Card style={{ marginBottom: 16 }}>
          {[['Currency', 'INR · ₹'], ['Distance', 'km'], ['Volume', 'Litres'], ['Date format', 'DD/MM/YYYY'], ['Language', 'English']].map(([l, v]) => (
            <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
              <T weight="semi">{l}</T><T color={t.muted}>{v}</T>
            </View>
          ))}
        </Card>
        <Label>EFFICIENCY FORMAT</Label>
        <Card style={{ marginBottom: 16, paddingVertical: 4 }}>
          {FORMATS.map((f) => (
            <Pressable key={f.id} accessibilityRole="radio" accessibilityState={{ selected: s.efficiency === f.id }} onPress={() => set({ efficiency: f.id })}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, minHeight: 56 }}>
              <View style={{ flex: 1 }}><T weight="semi">{f.l}</T><T size={13} color={t.muted}>{f.d}</T></View>
              {s.efficiency === f.id && <Icon name="check" color={t.primary} />}
            </Pressable>
          ))}
        </Card>
        <Label>THEME</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
            <Chip key={m} label={m[0].toUpperCase() + m.slice(1)} active={s.theme === m} onPress={() => set({ theme: m })} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
