// Vehicle form shared by Add and Edit (FND-VEH-01/02). Validation mirrors
// vehicleInputSchema/DR-05; units + currency + start odometer lock once the
// vehicle has entries (DR-01). Web disables Save while offline (OBS-02); the
// submit handler is re-entry-safe against double taps.

import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SELECTABLE_CURRENCIES } from '../domain/money';
import {
  FUEL_TYPES, ODOMETER_MAX, ODOMETER_UNITS, PLATE_MAX, SHORT_TEXT_MAX, VEHICLE_TYPES,
} from '../data/schema/common';
import type { VehicleInput } from '../data/schema/vehicle';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { useAppStore } from '../features/appStore';
import { VEHICLE_ICON } from '../features/icons';
import { adapter } from '../features/runtime';
import { t } from '../i18n';
import { Button, Chip, Field, Icon, Label, T } from './kit';
import { Picker } from './Picker';
import { PALETTE_IDS, paletteColor } from './palette';
import { dark, useTheme } from './theme';

export interface VehicleFormValues {
  name: string;
  type: VehicleInput['type'];
  fuelTypes: string[];
  odometerUnit: VehicleInput['odometerUnit'];
  odometer: string; // startOdometer text
  currency: string;
  color: string;
  make: string;
  model: string;
  year: string;
  plate: string;
}

export function valuesFromVehicle(v: VehicleRecord): VehicleFormValues {
  return {
    name: v.name,
    type: v.type,
    fuelTypes: [...v.fuelTypes],
    odometerUnit: v.odometerUnit,
    odometer: String(v.startOdometer),
    currency: v.currency,
    color: v.color,
    make: v.make ?? '',
    model: v.model ?? '',
    year: v.year ? String(v.year) : '',
    plate: v.plate ?? '',
  };
}

export function defaultValues(): VehicleFormValues {
  const s = useAppStore.getState().userDoc?.settings;
  return {
    name: '',
    type: 'car',
    fuelTypes: ['petrol'],
    odometerUnit: s?.distanceUnit ?? 'km',
    odometer: '0',
    currency: s?.currency ?? 'INR',
    color: PALETTE_IDS[0],
    make: '',
    model: '',
    year: '',
    plate: '',
  };
}

type Errors = Partial<Record<keyof VehicleFormValues, string>>;

function validate(v: VehicleFormValues): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = t('vehicleForm.nameRequired');
  else if (v.name.trim().length > SHORT_TEXT_MAX) e.name = t('vehicleForm.nameRequired');
  if (v.fuelTypes.length === 0) e.fuelTypes = t('vehicleForm.fuelError');
  if (!/^\d+(\.\d)?$/.test(v.odometer) || Number(v.odometer) > ODOMETER_MAX) {
    e.odometer = Number(v.odometer) > ODOMETER_MAX ? t('vehicleForm.odometerRange') : t('vehicleForm.odometerInvalid');
  }
  if (v.year) {
    const y = Number(v.year);
    if (!/^\d{4}$/.test(v.year) || y < 1950 || y > new Date().getFullYear() + 1) {
      e.year = t('vehicleForm.yearInvalid');
    }
  }
  return e;
}

function OptionRow({ label, value, options, onPick, disabled }: {
  label: string; value: string; options: readonly string[]; onPick: (v: string) => void; disabled?: boolean;
}) {
  return (
    <View style={{ marginBottom: 20, opacity: disabled ? 0.5 : 1 }}>
      <Label>{label}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip key={o} label={o} active={value === o} disabled={disabled} onPress={() => onPick(o)} />
        ))}
      </View>
    </View>
  );
}

export function VehicleForm({ initial, locked, saving, error, onSubmit, submitLabel }: {
  initial: VehicleFormValues;
  /** Units + currency + start odometer read-only (entries exist). */
  locked: boolean;
  saving: boolean;
  error?: string | null;
  onSubmit: (v: VehicleFormValues) => void;
  submitLabel: string;
}) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const webOffline = adapter().platform === 'web' && !online;
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [more, setMore] = useState(false);
  const scheme = th === dark ? 'dark' : 'light';
  const set = <K extends keyof VehicleFormValues>(k: K, val: VehicleFormValues[K]) =>
    setV((cur) => ({ ...cur, [k]: val }));

  const submit = () => {
    if (saving) return; // double-tap guard
    const e = validate(v);
    setErrors(e);
    if (Object.keys(e).length === 0) onSubmit(v);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Field
        label={t('vehicleForm.name')}
        placeholder={t('vehicleForm.namePlaceholder')}
        value={v.name}
        onChangeText={(x) => set('name', x)}
        error={errors.name}
        maxLength={SHORT_TEXT_MAX}
      />
      <Label>{t('vehicleForm.type')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {VEHICLE_TYPES.map((x) => (
          <Pressable
            key={x}
            accessibilityRole="button"
            accessibilityState={{ selected: v.type === x }}
            onPress={() => set('type', x)}
            style={{
              flexGrow: 1, flexBasis: '30%', paddingVertical: 14, minHeight: 48, alignItems: 'center', gap: 4,
              borderRadius: 16, borderWidth: 1,
              backgroundColor: v.type === x ? th.primarySoft : th.card,
              borderColor: v.type === x ? th.primary : th.border,
            }}
          >
            <Icon name={VEHICLE_ICON[x]} color={v.type === x ? th.primary : th.text} />
            <T size={13} weight="semi" color={v.type === x ? th.primary : th.text}>{t(`vehicleTypes.${x}`)}</T>
          </Pressable>
        ))}
      </View>
      <Label>{t('vehicleForm.fuelTypes')}</Label>
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FUEL_TYPES.map((f) => (
            <Chip
              key={f}
              label={t(`fuelTypes.${f}`)}
              active={v.fuelTypes.includes(f)}
              onPress={() => set('fuelTypes', v.fuelTypes.includes(f) ? v.fuelTypes.filter((x) => x !== f) : [...v.fuelTypes, f])}
            />
          ))}
        </View>
        {errors.fuelTypes ? <T size={12} color={th.danger} style={{ marginTop: 4 }}>{errors.fuelTypes}</T> : null}
      </View>
      <Field
        label={t('vehicleForm.currentOdometer')}
        placeholder="0" // i18n-allow — numeric placeholder
        keyboardType="decimal-pad"
        value={v.odometer}
        onChangeText={(x) => set('odometer', x)}
        suffix={t(`units.${v.odometerUnit}`)}
        error={errors.odometer}
        editable={!locked}
      />
      {locked ? <T size={12} color={th.muted} style={{ marginTop: -12, marginBottom: 16 }}>{t('vehicleForm.startLocked')}</T> : null}
      <OptionRow
        label={t('vehicleForm.odometerUnit')}
        value={v.odometerUnit}
        options={ODOMETER_UNITS}
        onPick={(u) => set('odometerUnit', u as VehicleFormValues['odometerUnit'])}
        disabled={locked}
      />
      <Picker
        label={t('vehicleForm.currency')}
        valueLabel={v.currency}
        options={SELECTABLE_CURRENCIES.map((c) => ({ value: c, label: c }))}
        onPick={(c) => set('currency', c)}
        disabled={locked}
      />
      {locked ? <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 16 }}>{t('vehicleForm.unitsLocked')}</T> : null}
      <Label>{t('vehicleForm.colour')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        {PALETTE_IDS.map((c, i) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={t('vehicleForm.colourLabel', { n: i + 1 })}
            accessibilityState={{ selected: v.color === c }}
            onPress={() => set('color', c)}
            style={{
              width: 44, height: 44, borderRadius: 22, backgroundColor: paletteColor(c, scheme).color,
              borderWidth: 3, borderColor: v.color === c ? th.primary : 'transparent',
            }}
          />
        ))}
      </View>
      <Pressable onPress={() => setMore(!more)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 48, gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T weight="semi">{t('vehicleForm.moreDetails')}</T>
          <T size={13} color={th.muted}>{t('vehicleForm.moreDetailsSub')}</T>
        </View>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} />
      </Pressable>
      {more && (
        <View style={{ marginTop: 8 }}>
          <Field label={t('vehicleForm.make')} value={v.make} onChangeText={(x) => set('make', x)} maxLength={SHORT_TEXT_MAX} />
          <Field label={t('vehicleForm.model')} value={v.model} onChangeText={(x) => set('model', x)} maxLength={SHORT_TEXT_MAX} />
          <Field label={t('vehicleForm.year')} value={v.year} onChangeText={(x) => set('year', x)} keyboardType="number-pad" error={errors.year} maxLength={4} />
          <Field label={t('vehicleForm.plate')} value={v.plate} onChangeText={(x) => set('plate', x)} maxLength={PLATE_MAX} autoCapitalize="characters" />
        </View>
      )}
      {error ? <T size={13} color={th.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
      <View style={{ marginTop: 8 }}>
        <Button title={submitLabel} onPress={submit} disabled={saving || webOffline} />
      </View>
    </ScrollView>
  );
}

/** Convert validated form values to a VehicleInput (create) payload. */
export function toVehicleInput(v: VehicleFormValues): VehicleInput {
  return {
    name: v.name.trim(),
    type: v.type,
    color: v.color,
    make: v.make.trim() || undefined,
    model: v.model.trim() || undefined,
    year: v.year ? Number(v.year) : undefined,
    plate: v.plate.trim() || undefined,
    fuelTypes: v.fuelTypes as VehicleInput['fuelTypes'],
    odometerUnit: v.odometerUnit,
    currency: v.currency,
    startOdometer: Number(v.odometer),
  };
}
