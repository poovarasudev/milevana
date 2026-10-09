// Shared entry-form primitives (LOG-04): chip rows, toggle rows and the text
// parsers that turn field text into stored values (odometer ≤1 decimal,
// amounts in integer minor units — LD-03).

import { Switch, View } from 'react-native';
import { ODOMETER_MAX } from '../../data/schema/common';
import { Chip, Field, Label, T } from '../kit';
import { useTheme } from '../theme';

/** '' → undefined; invalid text or >9,999,999.9 → 'invalid'; else the number. */
export function parseOdometer(text: string): number | 'invalid' | undefined {
  const s = text.trim();
  if (s === '') return undefined;
  if (!/^\d{1,7}(\.\d)?$/.test(s)) return 'invalid';
  const n = Number(s);
  return n <= ODOMETER_MAX ? n : 'invalid';
}

/** number → the field's text ('' when undefined). */
export function odometerToText(v: number | undefined): string {
  return v === undefined ? '' : String(v);
}

export function ChoiceChips({ label, options, value, onPick, disabled, error }: {
  label?: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onPick: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const th = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      {label ? <Label>{label}</Label> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={value === o.value}
            disabled={disabled}
            onPress={() => onPick(o.value)}
          />
        ))}
      </View>
      {error ? <T size={12} color={th.danger} style={{ marginTop: 4 }}>{error}</T> : null}
    </View>
  );
}

export function ToggleRow({ label, value, onValueChange, disabled }: {
  label: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean;
}) {
  const th = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, minHeight: 48 }}>
      <T weight="semi" size={15}>{label}</T>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: th.primary }}
        thumbColor="#FFFFFF" // i18n-allow — colour token
      />
    </View>
  );
}

/** Numeric text field with the shared Field chrome. */
export function NumberField({ label, value, onChangeText, suffix, error, placeholder, disabled, testID }: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  suffix?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChangeText}
      suffix={suffix}
      error={error}
      placeholder={placeholder ?? '0'}
      keyboardType="decimal-pad"
      editable={!disabled}
      testID={testID}
    />
  );
}
