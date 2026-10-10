// Checklists route (CHK-02): More → Checklists opens the selected vehicle's
// templates — replacing the "Coming soon" row (FR-NAV-05, AC-D16).

import { View } from 'react-native';
import { useAppStore } from '../src/features/appStore';
import { t } from '../src/i18n';
import { ChecklistsList } from '../src/ui/ChecklistsList';
import { NoVehicle } from '../src/ui/Empty';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Header } from '../src/ui/kit';
import { useTheme } from '../src/ui/theme';

function ChecklistsScreen() {
  const th = useTheme();
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === s.selectedVehicleId));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        title={t('checklists.title')}
        subtitle={vehicle?.name}
      />
      {!vehicle ? <NoVehicle /> : <ChecklistsList vehicle={vehicle} />}
    </View>
  );
}

export default function Checklists() {
  return (
    <ErrorBoundary screen="checklists">
      <ChecklistsScreen />
    </ErrorBoundary>
  );
}
