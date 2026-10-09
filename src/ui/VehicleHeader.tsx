// Top-bar switcher slot (FND-SHL-04): vehicle name + type icon + palette
// colour; tapping opens the switcher. Reports scope shows "All vehicles".

import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings, displayOdometer } from '../features/format';
import { VEHICLE_ICON } from '../features/icons';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { t } from '../i18n';
import { Icon, T } from './kit';
import { usePaletteColor } from './palette';
import { useTheme } from './theme';

export function VehicleHeader({ vehicle, allVehicles = false }: { vehicle: VehicleRecord | null; allVehicles?: boolean }) {
  const th = useTheme();
  const settings = useSettings();
  const insets = useSafeAreaInsets();
  const p = usePaletteColor(vehicle?.color ?? 'c01');
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.soft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={allVehicles || !vehicle ? 'car-multiple' : VEHICLE_ICON[vehicle.type]} color={p.color} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('nav.switchVehicle')}
        onPress={() => router.push('/switcher')}
        style={{ flex: 1, minHeight: 48, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <T size={22} weight="semi" style={{ letterSpacing: -0.4 }} numberOfLines={1}>
            {allVehicles ? t('nav.allVehicles') : vehicle?.name ?? ''}
          </T>
          <Icon name="chevron-down" />
        </View>
        {vehicle && !allVehicles ? (
          <T size={13} color={th.muted}>
            {[vehicle.plate, displayOdometer(vehicle, settings)].filter(Boolean).join(' · ')}
          </T>
        ) : allVehicles ? (
          <T size={13} color={th.muted}>{t('nav.allVehiclesHint')}</T>
        ) : null}
      </Pressable>
    </View>
  );
}
