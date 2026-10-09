import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSelectedVehicle } from '../src/data/store';
import { formatNumber } from '../src/domain/money';
import type { EntryType } from '../src/domain/types';
import { ENTRY_ICON, ENTRY_LABEL } from '../src/features/entryView';
import { Icon, T } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

const TYPES: EntryType[] = ['fuel', 'expense', 'service', 'income', 'trip', 'inspection'];
const AVAILABLE: EntryType[] = ['fuel', 'expense', 'service', 'income'];

export default function AddSheet() {
  const t = useTheme();
  const v = useSelectedVehicle();
  return (
    <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.45)' }}>
      <Pressable style={{ flex: 1 }} onPress={() => router.back()} accessibilityLabel="Close" />
      <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 }}>
        <T size={20} weight="semi">Add to {v?.name}</T>
        <T size={13} color={t.muted} style={{ marginBottom: 16 }}>Last odometer {v ? `${formatNumber(v.lastOdometer)} ${v.odometerUnit}` : ''}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {TYPES.map((x) => {
            const ok = AVAILABLE.includes(x);
            return (
              <Pressable key={x} disabled={!ok} accessibilityRole="button" accessibilityState={{ disabled: !ok }}
                onPress={() => { router.back(); router.push({ pathname: '/entry/[type]', params: { type: x } }); }}
                style={{ flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, backgroundColor: t.card, borderWidth: 1, borderColor: t.divider, opacity: ok ? 1 : 0.45 }}>
                <Icon name={ENTRY_ICON[x]} color={t.primary} />
                <T size={13} weight="semi">{ENTRY_LABEL[x]}</T>
                {!ok && <T size={10} color={t.muted}>Soon</T>}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
