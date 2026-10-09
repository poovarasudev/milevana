// Date/time input (LD-04): one row showing the formatted value; tapping opens
// the platform date (then time) picker on native, a numeric modal on web.
// New entries default to the current local date and time to the minute; a
// future date is accepted and the caller shows a "future date" note.

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { tsFromMillis } from '../data/schema/common';
import { formatDate, useSettings } from '../features/format';
import { t } from '../i18n';
import { Button, Icon, Label, T } from './kit';
import { font, useTheme } from './theme';

export const toMinute = (ms: number) => Math.floor(ms / 60_000) * 60_000;

export function formatTimeOfDay(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTimeValue(d: Date, dateFormat: string, mode: 'date' | 'datetime'): string {
  const date = formatDate(tsFromMillis(d.getTime()), dateFormat as 'DD/MM/YYYY');
  return mode === 'date' ? date : `${date}  ${formatTimeOfDay(d)}`;
}

function WebEditor({ value, mode, onDone, onCancel }: {
  value: Date; mode: 'date' | 'datetime';
  onDone: (d: Date) => void; onCancel: () => void;
}) {
  const th = useTheme();
  const [y, setY] = useState(String(value.getFullYear()));
  const [mo, setMo] = useState(String(value.getMonth() + 1));
  const [da, setDa] = useState(String(value.getDate()));
  const [hh, setHh] = useState(String(value.getHours()));
  const [mi, setMi] = useState(String(value.getMinutes()));

  const num = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
  const build = (): Date | null => {
    const d = new Date(
      num(y), num(mo) - 1, num(da),
      mode === 'date' ? 0 : num(hh), mode === 'date' ? 0 : num(mi), 0, 0,
    );
    // reject impossible dates like 31 Feb (Date rolls them over)
    return Number.isNaN(d.getTime()) || d.getDate() !== num(da) || d.getMonth() !== num(mo) - 1
      ? null
      : d;
  };

  const box = (v: string, set: (s: string) => void, a11y: string, w = 64) => (
    <TextInput
      value={v}
      onChangeText={set}
      keyboardType="number-pad"
      accessibilityLabel={a11y}
      placeholderTextColor={th.muted}
      style={{
        width: w, borderWidth: 1, borderColor: th.border, borderRadius: 12,
        paddingVertical: 10, paddingHorizontal: 12, textAlign: 'center',
        fontFamily: font.semi, fontSize: 16, color: th.text, backgroundColor: th.bg,
      }}
    />
  );

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,20,27,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: th.card, borderRadius: 20, padding: 20, gap: 14, width: '100%', maxWidth: 380 }}>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            {box(da, setDa, t('dateField.day'))}
            {box(mo, setMo, t('dateField.month'))}
            {box(y, setY, t('dateField.year'), 84)}
          </View>
          {mode === 'datetime' && (
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
              {box(hh, setHh, t('dateField.hour'))}
              <T size={18} weight="bold">:</T>
              {box(mi, setMi, t('dateField.minute'))}
            </View>
          )}
          <Button
            title={t('common.done')}
            onPress={() => { const d = build(); if (d) onDone(d); }}
          />
          <Button title={t('common.cancel')} kind="text" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function DateTimeField({ label, value, onChange, onClear, mode = 'datetime', disabled }: {
  label: string;
  /** undefined shows the "any" label — used by optional date filters. */
  value: Date | undefined;
  onChange: (d: Date) => void;
  onClear?: () => void;
  mode?: 'date' | 'datetime';
  disabled?: boolean;
}) {
  const th = useTheme();
  const settings = useSettings();
  const [step, setStep] = useState<null | 'date' | 'time'>(null); // native
  const [webOpen, setWebOpen] = useState(false);                  // web
  const cur = value ?? new Date();

  const mergeDate = (picked: Date) =>
    new Date(picked.getFullYear(), picked.getMonth(), picked.getDate(),
      cur.getHours(), cur.getMinutes(), 0, 0);
  const mergeTime = (picked: Date) =>
    new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(),
      picked.getHours(), picked.getMinutes(), 0, 0);

  const onNative = (e: DateTimePickerEvent, picked?: Date) => {
    if (e.type === 'dismissed' || !picked) {
      setStep(null);
      return;
    }
    if (step === 'date') {
      const merged = mergeDate(picked);
      if (mode === 'date') {
        onChange(merged);
        setStep(null);
      } else {
        onChange(merged);
        setStep('time');
      }
    } else {
      onChange(mergeTime(picked));
      setStep(null);
    }
  };

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'web') setWebOpen(true);
    else setStep('date');
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={open}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52,
          borderWidth: 1, borderRadius: 16, paddingHorizontal: 16,
          backgroundColor: th.card, borderColor: th.border, opacity: disabled ? 0.5 : 1,
        }}
      >
        <View style={{ flex: 1 }}>
          <T weight="semi" size={16} color={value ? th.text : th.muted}>
            {value ? formatDateTimeValue(value, settings.dateFormat, mode) : t('dateField.any')}
          </T>
        </View>
        {value && onClear && !disabled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.clear')}
            onPress={onClear}
            style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginRight: -8 }}
          >
            <Icon name="close-circle" color={th.muted} size={20} />
          </Pressable>
        ) : null}
        <Icon name={mode === 'date' ? 'calendar' : 'calendar-clock'} color={th.muted} />
      </Pressable>
      {step !== null && Platform.OS !== 'web' && (
        <DateTimePicker
          value={cur}
          mode={step}
          display="default"
          onChange={onNative}
        />
      )}
      {webOpen && (
        <WebEditor
          value={cur}
          mode={mode}
          onDone={(d) => { onChange(d); setWebOpen(false); }}
          onCancel={() => setWebOpen(false)}
        />
      )}
    </View>
  );
}
