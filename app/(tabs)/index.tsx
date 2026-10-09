// Dashboard: the "Upcoming & overdue" card (REM-10) plus the spend, per-unit
// cost, fuel headline, income-vs-cost and recent-entries figures (RPT-13).

import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { useAppStore } from '../../src/features/appStore';
import { t } from '../../src/i18n';
import { useScopedVehicle } from '../../src/ui/ComingSoonTab';
import { NoVehicle } from '../../src/ui/Empty';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Button } from '../../src/ui/kit';
import { Notices } from '../../src/ui/Notices';
import { DashboardCards } from '../../src/ui/reports/DashboardCards';
import { useTheme } from '../../src/ui/theme';
import { UpcomingCard } from '../../src/ui/UpcomingCard';
import { VehicleHeader } from '../../src/ui/VehicleHeader';

function DashboardTab() {
  const th = useTheme();
  const loaded = useAppStore((s) => s.vehiclesLoaded);
  const vehicle = useScopedVehicle();

  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: th.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={th.primary} /></View>;
  }
  if (!vehicle) return <NoVehicle />;

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <VehicleHeader vehicle={vehicle} />
      <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 120, gap: 16 }}>
        <View style={{ paddingHorizontal: 20 }}>
          <Notices />
        </View>
        <UpcomingCard
          vehicle={vehicle}
          onOpenReminder={(id) =>
            router.push({ pathname: '/reminder/[id]', params: { id, vehicle: vehicle.id } })
          }
          onSeeAll={() => router.push({ pathname: '/reminders', params: { vehicle: vehicle.id } })}
          onAdd={() => router.push({ pathname: '/reminder/[id]', params: { id: 'new', vehicle: vehicle.id } })}
        />
        <DashboardCards vehicle={vehicle} />
      </ScrollView>
      <View style={{ position: 'absolute', right: 20, bottom: 20, left: 20 }}>
        <Button title={t('nav.addEntry')} icon="plus" onPress={() => router.push('/add')} />
      </View>
    </View>
  );
}

export default function Dashboard() {
  return (
    <ErrorBoundary screen="dashboard">
      <DashboardTab />
    </ErrorBoundary>
  );
}
