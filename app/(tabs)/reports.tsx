import { useLocalSearchParams } from 'expo-router';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { ReportsScreen } from '../../src/ui/reports/ReportsScreen';

export default function Reports() {
  // ?vehicle=<id> is the archived-vehicle report path from Vehicles (PD-08).
  const { vehicle } = useLocalSearchParams<{ vehicle?: string }>();
  return (
    <ErrorBoundary screen="reports">
      <ReportsScreen scopeVehicleId={typeof vehicle === 'string' ? vehicle : undefined} />
    </ErrorBoundary>
  );
}
