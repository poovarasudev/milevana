// Reminders route (REM-04): More → Reminders opens the selected vehicle's
// list — or a specific vehicle's when `?vehicle=` is set (notification taps —
// RD-10). `?focus=` highlights one reminder.

import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import type { ReminderRecord } from '../src/data/repos/reminderRepo';
import { useAppStore } from '../src/features/appStore';
import { expenseCategoryFor } from '../src/domain/reminders';
import { t } from '../src/i18n';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { Header } from '../src/ui/kit';
import { NoVehicle } from '../src/ui/Empty';
import { RemindersList, ReminderPreset } from '../src/ui/RemindersList';
import { useTheme } from '../src/ui/theme';

function RemindersScreen() {
  const th = useTheme();
  const params = useLocalSearchParams<{ vehicle?: string; focus?: string }>();
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === (params.vehicle ?? s.selectedVehicleId)));

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header
        title={t('reminders.title')}
        subtitle={vehicle ? t('reminders.forVehicle', { vehicle: vehicle.name }) : undefined}
      />
      {!vehicle ? (
        <NoVehicle />
      ) : (
        <RemindersList
          vehicle={vehicle}
          focusId={params.focus}
          onAdd={(preset) =>
            router.push({
              pathname: '/reminder/[id]',
              params: {
                id: 'new',
                vehicle: vehicle.id,
                ...(preset ? { preset: preset as ReminderPreset } : {}),
              },
            })
          }
          onEdit={(id) =>
            router.push({ pathname: '/reminder/[id]', params: { id, vehicle: vehicle.id } })
          }
          onLogExpense={(r: ReminderRecord) =>
            router.push({
              pathname: '/entry/[type]',
              params: {
                type: 'expense',
                vehicle: vehicle.id,
                category: expenseCategoryFor(r),
                ...(r.amountMinor !== undefined ? { amountMinor: String(r.amountMinor) } : {}),
              },
            })
          }
        />
      )}
    </View>
  );
}

export default function Reminders() {
  return (
    <ErrorBoundary screen="reminders">
      <RemindersScreen />
    </ErrorBoundary>
  );
}
