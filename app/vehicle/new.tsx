import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useStore } from '../../src/data/store';
import { VehicleForm, vehicleSchema } from '../../src/domain/validation';
import type { FuelType, VehicleType } from '../../src/domain/types';
import { VEHICLE_ICON } from '../../src/features/entryView';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { Button, Chip, Field, Header, Icon, Label, T } from '../../src/ui/kit';
import { useTheme, VEHICLE_COLORS } from '../../src/ui/theme';

const TYPES: VehicleType[] = ['car', 'bike', 'scooter', 'truck', 'bus', 'other'];
const FUELS: FuelType[] = ['petrol', 'diesel', 'cng', 'lpg', 'electric'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1).replace('cng', 'CNG').replace('lpg', 'LPG');

export default function NewVehicle() {
  const t = useTheme();
  const addVehicle = useStore((s) => s.addVehicle);
  const vehicles = useStore((s) => s.vehicles);
  const [more, setMore] = useState(false);
  const { control, handleSubmit, setError, formState: { errors } } = useForm<VehicleForm>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { name: '', type: 'car', fuelTypes: ['petrol'], odometerUnit: 'km', odometer: '', color: VEHICLE_COLORS[0], plate: '', make: '', model: '', year: '' },
  });

  const onSave = handleSubmit((v) => {
    if (vehicles.some((x) => x.name.toLowerCase() === v.name.trim().toLowerCase())) {
      setError('name', { message: 'You already have a vehicle with this name' });
      return;
    }
    addVehicle({
      name: v.name.trim(), type: v.type, fuelTypes: v.fuelTypes, odometerUnit: v.odometerUnit,
      startOdometer: Number(v.odometer), color: v.color,
      make: v.make || undefined, model: v.model || undefined, year: v.year ? Number(v.year) : undefined, plate: v.plate || undefined,
    });
    router.replace('/(tabs)');
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <Header title="New vehicle" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Controller control={control} name="name" render={({ field }) => (
          <Field label="NAME" placeholder="Swift Dzire" value={field.value} onChangeText={field.onChange} error={errors.name?.message} maxLength={60} />
        )} />
        <Label>TYPE</Label>
        <Controller control={control} name="type" render={({ field }) => (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            {TYPES.map((x) => (
              <Pressable key={x} accessibilityRole="button" accessibilityState={{ selected: field.value === x }} onPress={() => field.onChange(x)}
                style={{ flexGrow: 1, flexBasis: '30%', paddingVertical: 14, alignItems: 'center', gap: 4, borderRadius: 16, borderWidth: 1, backgroundColor: field.value === x ? t.primarySoft : t.card, borderColor: field.value === x ? t.primary : t.border }}>
                <Icon name={VEHICLE_ICON[x]} color={field.value === x ? t.primary : t.text} />
                <T size={13} weight="semi" color={field.value === x ? t.primary : t.text}>{cap(x)}</T>
              </Pressable>
            ))}
          </View>
        )} />
        <Label>FUEL TYPES</Label>
        <Controller control={control} name="fuelTypes" render={({ field }) => (
          <View style={{ marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FUELS.map((f) => (
                <Chip key={f} label={cap(f)} active={field.value.includes(f)}
                  onPress={() => field.onChange(field.value.includes(f) ? field.value.filter((x) => x !== f) : [...field.value, f])} />
              ))}
            </View>
            {errors.fuelTypes?.message ? <T size={12} color={t.danger} style={{ marginTop: 4 }}>{errors.fuelTypes.message}</T> : null}
          </View>
        )} />
        <Controller control={control} name="odometerUnit" render={({ field: unit }) => (
          <Controller control={control} name="odometer" render={({ field }) => (
            <View>
              <Field label="CURRENT ODOMETER" placeholder="0" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} suffix={unit.value} error={errors.odometer?.message} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 20 }}>
                {(['km', 'mi', 'hrs'] as const).map((u) => <Chip key={u} label={u} active={unit.value === u} onPress={() => unit.onChange(u)} />)}
              </View>
            </View>
          )} />
        )} />
        <Label>COLOUR</Label>
        <Controller control={control} name="color" render={({ field }) => (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {VEHICLE_COLORS.map((c) => (
              <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Colour ${c}`} onPress={() => field.onChange(c)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: field.value === c ? t.primary : t.bg }} />
            ))}
          </View>
        )} />
        <Pressable onPress={() => setMore(!more)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T weight="semi">More details</T>
            <T size={13} color={t.muted}>Make, model, year, plate · optional</T>
          </View>
          <Icon name={more ? 'chevron-up' : 'chevron-down'} />
        </Pressable>
        {more && (
          <View style={{ marginTop: 8 }}>
            {(['make', 'model', 'year', 'plate'] as const).map((k) => (
              <Controller key={k} control={control} name={k} render={({ field }) => (
                <Field label={k.toUpperCase()} value={field.value ?? ''} onChangeText={field.onChange} keyboardType={k === 'year' ? 'number-pad' : 'default'} error={errors[k]?.message} maxLength={k === 'plate' ? 15 : 60} autoCapitalize={k === 'plate' ? 'characters' : 'sentences'} />
              )} />
            ))}
          </View>
        )}
        <View style={{ marginTop: 16 }}><Button title="Save vehicle" onPress={onSave} /></View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
