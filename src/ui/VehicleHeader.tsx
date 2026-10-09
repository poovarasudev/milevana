import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNumber } from '../domain/money';
import type { Vehicle } from '../domain/types';
import { Icon, T } from './kit';
import { useTheme } from './theme';

export function VehicleHeader({ vehicle }: { vehicle: Vehicle }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Switch vehicle" onPress={() => router.push('/switcher')} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T size={22} weight="semi" style={{ letterSpacing: -0.4 }} numberOfLines={1}>{vehicle.name}</T>
          <Icon name="chevron-down" />
        </View>
        <T size={13} color={t.muted}>
          {[vehicle.plate, `${formatNumber(vehicle.lastOdometer)} ${vehicle.odometerUnit}`].filter(Boolean).join(' · ')}
        </T>
      </Pressable>
    </View>
  );
}
