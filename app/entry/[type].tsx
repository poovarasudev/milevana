// Entry form route (LOG-04/13): Add sheet types open their real forms here;
// `?id=` opens the same form pre-filled for edit (read-only for other
// members' entries and archived vehicles — LD-13/DR-13). Inspection stays a
// placeholder (out of scope for Logging).

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ENTRY_TYPES } from '../../src/data/schema/common';
import { useAppStore } from '../../src/features/appStore';
import { createEntry, requestDelete, updateEntry } from '../../src/features/entries';
import { t } from '../../src/i18n';
import { EntryForm } from '../../src/ui/entry/EntryForm';
import type { EntryFormResult } from '../../src/ui/entry/types';
import { Header, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

export default function EntryScreen() {
  const th = useTheme();
  const { type, id } = useLocalSearchParams<{ type: string; id?: string }>();
  const kind = (ENTRY_TYPES as readonly string[]).includes(type ?? '') ? type! : 'expense';
  const vehicle = useAppStore((s) => s.vehicles.find((v) => v.id === s.selectedVehicleId));
  const entries = useAppStore((s) => s.entries);
  const arrived = useAppStore((s) => s.entriesArrived);
  const entry = id ? entries.find((e) => e.id === id) : undefined;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (v: EntryFormResult) => {
    if (!vehicle) return;
    setSaving(true);
    setError(null);
    try {
      if (entry && 'patch' in v) {
        await updateEntry(vehicle.id, entry.id, v.patch);
      } else if ('input' in v) {
        await createEntry(vehicle.id, v.input);
      }
      router.back();
    } catch {
      setError(t('vehicleForm.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <Header title={entry ? t('entryForm.editTitle', { type: t(`entryTypes.${kind}`) }) : t(`entryTypes.${kind}`)} />
      {!vehicle ? (
        <T color={th.muted} style={{ padding: 20 }}>{t('addSheet.chooseVehicle')}</T>
      ) : id && !entry ? (
        arrived ? (
          <T color={th.muted} style={{ padding: 20 }}>{t('entryForm.notFound')}</T>
        ) : (
          <ActivityIndicator color={th.primary} style={{ marginTop: 40 }} />
        )
      ) : (
        <EntryForm
          vehicle={vehicle}
          type={kind}
          entry={entry}
          entries={entries}
          saving={saving}
          saveError={error}
          onSubmit={(v) => void submit(v)}
          onDelete={entry ? () => { requestDelete(vehicle.id, entry); router.back(); } : undefined}
        />
      )}
    </View>
  );
}
