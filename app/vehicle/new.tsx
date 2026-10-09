// Add a vehicle (FND-VEH-01). Defaults come from the user's settings
// (currency, distance unit); saving goes through the repository and the new
// vehicle becomes the selected scope (DR-15).

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { RepoError } from '../../src/data/adapter';
import { reportNonFatal } from '../../src/features/reporting';
import { selectVehicle } from '../../src/features/session';
import { createVehicle } from '../../src/features/vehicleActions';
import { t } from '../../src/i18n';
import { DialogFrame } from '../../src/ui/DialogFrame';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Header } from '../../src/ui/kit';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { useTheme } from '../../src/ui/theme';
import {
  defaultValues, toVehicleInput, VehicleForm, VehicleFormValues,
} from '../../src/ui/VehicleForm';

function NewVehicleScreen() {
  const th = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (v: VehicleFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const id = await createVehicle(toVehicleInput(v));
      await selectVehicle(id);
      router.replace('/(tabs)');
    } catch (e) {
      if (e instanceof RepoError && e.message === 'name-taken') {
        setError(t('vehicleForm.nameTaken'));
      } else {
        reportNonFatal(e, { stage: 'vehicle-create' });
        setError(t('vehicleForm.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <DialogFrame>
        <Header title={t('vehicleForm.newTitle')} />
        <VehicleForm
          initial={defaultValues()}
          locked={false}
          saving={saving}
          error={error}
          onSubmit={(v) => void onSubmit(v)}
          submitLabel={t('vehicleForm.save')}
        />
      </DialogFrame>
    </KeyboardAvoidingView>
  );
}

export default function NewVehicle() {
  return (
    <ErrorBoundary screen="vehicle-new">
      <NewVehicleScreen />
    </ErrorBoundary>
  );
}
