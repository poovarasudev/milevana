// Tab placeholder (DR-17): with a vehicle selected the tab names the vehicle
// and shows "Coming soon"; the Add sheet button is hidden with no vehicle
// (AC-D16 area). Reports may be scoped to all vehicles (AC-D25).

import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppStore } from '../features/appStore';
import { t } from '../i18n';
import { NoVehicle } from './Empty';
import { Button, Card, T } from './kit';
import { Notices } from './Notices';
import { useTheme } from './theme';
import { VehicleHeader } from './VehicleHeader';

export function useScopedVehicle() {
  const vehicles = useAppStore((s) => s.vehicles);
  const selectedId = useAppStore((s) => s.selectedVehicleId);
  return vehicles.find((v) => v.id === selectedId && !v.archived) ?? null;
}

export function ComingSoonTab({ tabKey, showAdd }: { tabKey: 'dashboard' | 'history' | 'reports'; showAdd?: boolean }) {
  const th = useTheme();
  const loaded = useAppStore((s) => s.vehiclesLoaded);
  const all = useAppStore((s) => s.reportsAllVehicles) && tabKey === 'reports';
  const vehicle = useScopedVehicle();

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.primary} /></View>;
  }
  if (!vehicle && !all) return <NoVehicle />;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <VehicleHeader vehicle={vehicle} allVehicles={all} />
      <View style={{ flex: 1, padding: 20 }}>
        <Notices />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Card style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
            <T size={20} weight="semi">{t('dashboard.comingSoon')}</T>
            <T size={14} color={th.muted} style={{ textAlign: 'center' }}>
              {t('dashboard.scoped', {
                tab: t(`tabs.${tabKey}`),
                vehicle: all ? t('nav.allVehicles') : vehicle?.name ?? '',
              })}
            </T>
          </Card>
        </View>
      </View>
      {showAdd && vehicle ? (
        <View style={{ position: 'absolute', right: 20, bottom: 20, left: 20 }}>
          <Button title={t('nav.addEntry')} icon="plus" onPress={() => router.push('/add')} />
        </View>
      ) : null}
    </View>
  );
}
