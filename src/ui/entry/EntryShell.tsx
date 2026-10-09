// Shared entry-form shell (LOG-04): date & time (default now, to the minute —
// LD-04), the shared odometer field with the non-blocking sanity warning
// (LD-05), notes (≤500), and the Save/Delete row. Web Save is disabled while
// offline (FR-ERR-07); archived vehicles and other members' entries render
// read-only (DR-13, LD-13).

import { ReactNode, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { tsFromMillis, tsToMillis } from '../../data/schema/common';
import type { EntryRecord } from '../../data/repos/entryRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { odometerCheck } from '../../domain/entries';
import { useAppStore } from '../../features/appStore';
import { formatDate, useSettings, type SettingsDoc } from '../../features/format';
import { adapter } from '../../features/runtime';
import { t } from '../../i18n';
import { DateTimeField, toMinute } from '../DateTimeField';
import { Banner, Button, Field, T } from '../kit';
import { KEYBOARD_BEHAVIOR } from '../platform';
import { useTheme } from '../theme';
import { odometerToText, parseOdometer } from './fields';

/** Shared scalar fields every form carries. */
export interface SharedFields {
  date: Date;
  setDate: (d: Date) => void;
  /** True when the current date is in the future — shown as a note (LD-04). */
  futureDate: boolean;
  odometerText: string;
  setOdometerText: (s: string) => void;
  notes: string;
  setNotes: (s: string) => void;
}

/** New entries default to the current local date and time to the minute (LD-04). */
export function useSharedFields(entry?: EntryRecord): SharedFields {
  const [date, setDateState] = useState(
    () => new Date(toMinute(entry ? tsToMillis(entry.date) : Date.now())),
  );
  const [futureDate, setFutureDate] = useState(
    () => entry !== undefined && tsToMillis(entry.date) > Date.now(),
  );
  const setDate = (d: Date) => {
    setDateState(d);
    setFutureDate(d.getTime() > Date.now());
  };
  const [odometerText, setOdometerText] = useState(odometerToText(entry?.odometer));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  return { date, setDate, futureDate, odometerText, setOdometerText, notes, setNotes };
}

function isWeb(): boolean {
  try {
    return adapter().platform === 'web';
  } catch {
    return false;
  }
}

/** Banner text explaining why a form renders read-only (DR-13 / LD-13). */
export function readonlyReason(
  vehicle: { archived: boolean },
  entry?: { createdByName?: string },
): string {
  if (vehicle.archived) return t('vehicleForm.archivedReadonly');
  if (entry) return t('entryForm.viewOnly', { name: entry.createdByName ?? '' });
  return '';
}

/**
 * Inline warning text when the candidate odometer is out of order against the
 * vehicle's other readings (trip start+end included). Never blocks (LD-05).
 */
export function odometerWarning(
  entries: EntryRecord[],
  candidate: number | 'invalid' | undefined,
  date: Date,
  excludeId: string | undefined,
  dateFormat: SettingsDoc['dateFormat'],
): string | null {
  if (typeof candidate !== 'number') return null;
  const w = odometerCheck(
    entries,
    { odometer: candidate, date: tsFromMillis(date.getTime()) },
    excludeId,
  );
  if (!w) return null;
  return t(w.kind === 'lower' ? 'entryForm.odoWarnLower' : 'entryForm.odoWarnHigher', {
    value: w.value,
    date: formatDate(w.date, dateFormat),
  });
}

export function EntryShell({ children, shared, vehicle, entries, excludeId, odometerMode = 'optional', showDate = true, readOnly, readonlyReason, saving, error, submitLabel, onSubmit, onDelete }: {
  children: ReactNode;
  shared: SharedFields;
  vehicle: VehicleRecord;
  /** Sibling entries for the odometer sanity check. */
  entries: EntryRecord[];
  excludeId?: string;
  /** 'required' (fuel), 'optional' (money forms) or 'none' (trip carries its own). */
  odometerMode?: 'required' | 'optional' | 'none';
  showDate?: boolean;
  readOnly?: boolean;
  /** Why the form is read-only (other member's entry / archived). */
  readonlyReason?: string;
  saving?: boolean;
  error?: string | null;
  submitLabel: string;
  /** Called once the shared fields validate; the section decides the rest. */
  onSubmit: () => void;
  onDelete?: () => void;
}) {
  const th = useTheme();
  const settings = useSettings();
  const online = useAppStore((s) => s.online);
  const web = isWeb();
  const unitLabel = t(`units.${vehicle.odometerUnit}`);
  const [odoError, setOdoError] = useState<string>();

  const parsed = parseOdometer(shared.odometerText);
  const warn = odometerMode !== 'none'
    ? odometerWarning(entries, parsed, shared.date, excludeId, settings.dateFormat)
    : null;
  const saveBlocked = !!readOnly || !!saving || (web && !online);

  const trySubmit = () => {
    if (odometerMode !== 'none') {
      if (parsed === 'invalid') {
        setOdoError(t('vehicleForm.odometerInvalid'));
        return;
      }
      if (odometerMode === 'required' && parsed === undefined) {
        setOdoError(t('entryForm.odometerRequired'));
        return;
      }
    }
    setOdoError(undefined);
    onSubmit();
  };

  return (
    <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {readonlyReason ? <Banner icon="eye-off" text={readonlyReason} tone="info" /> : null}
        {web && !online && !readOnly ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}
        {showDate && (
          <>
            <DateTimeField
              label={t('entryForm.date')}
              value={shared.date}
              onChange={shared.setDate}
              disabled={readOnly}
            />
            {shared.futureDate && (
              <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 20 }}>
                {t('entryForm.futureDate')}
              </T>
            )}
          </>
        )}
        {children}
        {odometerMode !== 'none' && (
          <Field
            label={`${t('entryForm.odometer')} (${unitLabel})${odometerMode === 'required' ? ' *' : ''}`}
            value={shared.odometerText}
            onChangeText={shared.setOdometerText}
            keyboardType="decimal-pad"
            editable={!readOnly}
            error={odoError}
            testID="entry.odometer"
          />
        )}
        {warn ? (
          <T size={12} color={th.danger} style={{ marginTop: -14, marginBottom: 20 }}>
            {warn}
          </T>
        ) : null}
        <Field
          label={t('entryForm.notes')}
          value={shared.notes}
          onChangeText={shared.setNotes}
          multiline
          maxLength={500}
          editable={!readOnly}
          testID="entry.notes"
        />
        {error ? (
          <T size={13} color={th.danger} style={{ marginBottom: 12 }}>{error}</T>
        ) : null}
        {!readOnly && (
          <Button title={submitLabel} onPress={trySubmit} disabled={saveBlocked} />
        )}
        {onDelete && !readOnly ? (
          <View style={{ marginTop: 12 }}>
            <Button title={t('common.delete')} kind="danger" onPress={onDelete} />
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
