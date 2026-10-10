// Reminder form route (REM-05): `/reminder/new` creates; `/reminder/<id>`
// edits. `?vehicle=` scopes to another vehicle (notification taps, quick-add);
// `?preset=` opens the create form pre-filled from a quick-add template
// (REM-04). Archived vehicles are read-only (RD-12/DR-13).

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { RepoError } from '../../src/data/adapter';
import { useAppStore } from '../../src/features/appStore';
import { createReminder, deleteReminder, updateReminder } from '../../src/features/reminders';
import { reportNonFatal } from '../../src/features/reporting';
import { MAX_REMINDERS_PER_VEHICLE } from '../../src/domain/reminders';
import { t } from '../../src/i18n';
import { DialogFrame } from '../../src/ui/DialogFrame';
import { ErrorBoundary } from '../../src/ui/ErrorBoundary';
import { Card, Header, T } from '../../src/ui/kit';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { ReminderForm, ReminderFormResult } from '../../src/ui/ReminderForm';
import type { ReminderPreset } from '../../src/ui/RemindersList';
import { useTheme } from '../../src/ui/theme';

const PRESETS: readonly string[] = ['insurance', 'puc', 'service'];

function ReminderScreen() {
  const th = useTheme();
  const params = useLocalSearchParams<{ id: string; vehicle?: string; preset?: string; title?: string }>();
  const isNew = params.id === 'new';
  const preset = PRESETS.includes(params.preset ?? '') ? (params.preset as ReminderPreset) : undefined;
  const vehicle = useAppStore((s) =>
    s.vehicles.find((v) => v.id === (params.vehicle ?? s.selectedVehicleId)));
  const reminders = useAppStore((s) => (vehicle ? s.reminders[vehicle.id] : undefined));
  const arrived = useAppStore((s) => (vehicle ? s.remindersArrived[vehicle.id] : false));
  const reminder = !isNew && vehicle ? reminders?.find((r) => r.id === params.id) : undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: ReminderFormResult) => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      if (reminder && 'patch' in v) {
        await updateReminder(vehicle.id, reminder.id, v.patch);
      } else if ('input' in v) {
        await createReminder(vehicle.id, v.input);
      }
      router.back();
    } catch (e) {
      if (e instanceof RepoError && e.message === 'reminder-limit') {
        setError(t('reminderForm.tooMany', { max: MAX_REMINDERS_PER_VEHICLE }));
      } else {
        reportNonFatal(e, { stage: 'reminder-save' });
        setError(t('reminders.saveFailed'));
      }
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!vehicle || !reminder) return;
    setSaving(true);
    try {
      await deleteReminder(vehicle.id, reminder.id);
      router.back();
    } catch (e) {
      reportNonFatal(e, { stage: 'reminder-delete', id: reminder.id });
      setError(t('reminders.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: th.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <DialogFrame>
        <Header
          title={isNew ? t('reminderForm.newTitle') : t('reminderForm.editTitle')}
          subtitle={vehicle?.name}
        />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {!vehicle ? (
            <T color={th.muted}>{t('reminderForm.chooseVehicle')}</T>
          ) : vehicle.archived ? (
            <Card><T size={13} color={th.muted}>{t('reminders.archivedReadonly')}</T></Card>
          ) : !isNew && !reminder ? (
            arrived ? (
              <T color={th.muted}>{t('reminderForm.notFound')}</T>
            ) : (
              <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
            )
          ) : (
            <ReminderForm
              key={reminder?.id ?? `new-${preset ?? ''}-${params.title ?? ''}`}
              vehicle={vehicle}
              reminder={reminder}
              preset={reminder ? undefined : preset}
              prefillTitle={reminder || preset ? undefined : params.title}
              saving={saving}
              saveError={error}
              onSubmit={(v) => void submit(v)}
              onDelete={reminder ? () => void onDelete() : undefined}
            />
          )}
        </ScrollView>
      </DialogFrame>
    </KeyboardAvoidingView>
  );
}

export default function ReminderRoute() {
  return (
    <ErrorBoundary screen="reminder-form">
      <ReminderScreen />
    </ErrorBoundary>
  );
}
