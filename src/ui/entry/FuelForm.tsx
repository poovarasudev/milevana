// Fuel / EV-charging form (LOG-05, LOG-06): the two-of-three input
// (LD-03 — the two most recently edited fields are the inputs, the third
// recalculates), fuel-type and quantity-unit pickers (LD-02), Full tank /
// "Full charge" + Missed previous toggles, optional station, and the home /
// public charging location for electric. Odometer required. A live mileage
// preview shows what this fill would yield (LD-01).

import { useState } from 'react';
import { View } from 'react-native';
import { tsFromMillis } from '../../data/schema/common';
import type { FuelDetailsDoc } from '../../data/schema/entry';
import {
  defaultFuelType, defaultQuantityUnit, emptyFuelInputs, fuelEdit,
  fuelMileage, fuelResolved, formatMileage, formatPriceMilli, formatQuantity,
  quantityUnitsFor, toMileageEntry, type FuelInputState, type FuelType, type MileageEntry,
} from '../../domain/fuel';
import { minorToDecimal } from '../../domain/money';
import { useSettings } from '../../features/format';
import { t } from '../../i18n';
import { ChoiceChips, NumberField, parseOdometer, ToggleRow } from './fields';
import { Field, T } from '../kit';
import { useTheme } from '../theme';
import { EntryShell, readonlyReason, useSharedFields } from './EntryShell';
import type { EntryFormProps } from './types';

export function FuelForm({ vehicle, entry, entries, readOnly, saving, saveError, onSubmit, onDelete }: EntryFormProps) {
  const th = useTheme();
  const settings = useSettings();
  const shared = useSharedFields(entry);
  const details = entry?.details as FuelDetailsDoc | undefined;
  const prior = entries.map(toMileageEntry).filter((x): x is MileageEntry => x !== null);

  const [fuelType, setFuelType] = useState<FuelType>(
    () => details?.fuelType ?? defaultFuelType(vehicle.fuelTypes, prior),
  );
  const [unit, setUnit] = useState(
    () => details?.quantityUnit ?? defaultQuantityUnit(fuelType, settings.volumeUnit),
  );
  const [inputs, setInputs] = useState<FuelInputState>(() =>
    details && entry?.amount
      ? {
          quantity: formatQuantity(details.quantity),
          price: formatPriceMilli(details.pricePerUnitMilli, vehicle.currency),
          total: String(minorToDecimal(entry.amount.minor, vehicle.currency)),
          order: ['quantity', 'price', 'total'],
        }
      : emptyFuelInputs,
  );
  const [fullTank, setFullTank] = useState(details?.fullTank ?? true);
  const [missed, setMissed] = useState(details?.missedPrevious ?? false);
  const [station, setStation] = useState(details?.stationName ?? '');
  const [chargeLoc, setChargeLoc] = useState<'home' | 'public' | undefined>(details?.chargingLocation);
  const [err, setErr] = useState<string>();

  const isElectric = fuelType === 'electric';
  const resolved = fuelResolved(inputs, vehicle.currency);
  const fieldVal = (k: 'quantity' | 'price' | 'total') =>
    resolved.complete && resolved.computed === k ? (resolved.computedText ?? '') : inputs[k];

  // Live mileage preview: what this fill would yield against existing entries
  const odo = parseOdometer(shared.odometerText);
  const mileageText = (() => {
    if (typeof odo !== 'number' || !resolved.amounts.quantity) return null;
    const cand: MileageEntry = {
      id: '__cand__', fuelType, odometer: odo, quantity: resolved.amounts.quantity,
      quantityUnit: unit, fullTank, missedPrevious: missed,
      date: tsFromMillis(shared.date.getTime()),
      createdAt: entry?.createdAt ?? { seconds: Number.MAX_SAFE_INTEGER, nanoseconds: 0 },
    };
    const map = fuelMileage([...prior, cand]);
    return formatMileage(map.get('__cand__'), fuelType, vehicle.odometerUnit, settings);
  })();

  const submit = () => {
    const a = resolved.amounts;
    if (!resolved.complete || !a.quantity || !a.pricePerUnitMilli || !a.totalMinor) {
      setErr(t('entryForm.fuel.needTwo'));
      return;
    }
    setErr(undefined);
    const det: Record<string, unknown> = {
      fuelType, quantity: a.quantity, quantityUnit: unit,
      pricePerUnitMilli: a.pricePerUnitMilli, fullTank, missedPrevious: missed,
    };
    if (station.trim()) det.stationName = station.trim();
    if (isElectric && chargeLoc) det.chargingLocation = chargeLoc;
    const date = tsFromMillis(shared.date.getTime());
    const odoVal = typeof odo === 'number' ? odo : undefined;
    const amount = { minor: a.totalMinor, currency: vehicle.currency };
    if (entry) {
      onSubmit({
        patch: {
          date, odometer: odoVal, amount, details: det,
          notes: shared.notes.trim() ? shared.notes.trim() : null,
        },
      });
    } else {
      onSubmit({
        input: {
          type: 'fuel', date, odometer: odoVal, amount, details: det,
          notes: shared.notes.trim() || undefined,
        },
      });
    }
  };

  return (
    <EntryShell
      shared={shared}
      vehicle={vehicle}
      entries={entries}
      excludeId={entry?.id}
      odometerMode="required"
      readOnly={readOnly}
      readonlyReason={readOnly ? readonlyReason(vehicle, entry) : undefined}
      saving={saving}
      error={err ?? saveError}
      submitLabel={entry ? t('common.save') : t('entryForm.saveEntry')}
      onSubmit={submit}
      onDelete={onDelete}
    >
      <ChoiceChips
        label={t('entryForm.fuel.type')}
        options={vehicle.fuelTypes.map((f) => ({ value: f, label: t(`fuelTypes.${f}`) }))}
        value={fuelType}
        disabled={readOnly}
        onPick={(v) => {
          const f = v as FuelType;
          setFuelType(f);
          setUnit(defaultQuantityUnit(f, settings.volumeUnit));
          if (f !== 'electric') setChargeLoc(undefined);
        }}
      />
      <NumberField
        label={`${t('entryForm.fuel.quantity')} (${t(`quantityUnits.${unit}`)})`}
        value={fieldVal('quantity')}
        onChangeText={(s) => setInputs(fuelEdit(inputs, 'quantity', s))}
        disabled={readOnly}
        testID="fuel.quantity"
      />
      {quantityUnitsFor(fuelType).length > 1 && (
        <ChoiceChips
          label={t('entryForm.fuel.unit')}
          options={quantityUnitsFor(fuelType).map((u) => ({ value: u, label: t(`quantityUnits.${u}`) }))}
          value={unit}
          disabled={readOnly}
          onPick={(u) => setUnit(u as typeof unit)}
        />
      )}
      <NumberField
        label={`${t('entryForm.fuel.pricePerUnit')} (${vehicle.currency})`}
        value={fieldVal('price')}
        onChangeText={(s) => setInputs(fuelEdit(inputs, 'price', s))}
        disabled={readOnly}
        testID="fuel.price"
      />
      <NumberField
        label={`${t('entryForm.fuel.total')} (${vehicle.currency})`}
        value={fieldVal('total')}
        onChangeText={(s) => setInputs(fuelEdit(inputs, 'total', s))}
        disabled={readOnly}
        testID="fuel.total"
      />
      {isElectric && (
        <ChoiceChips
          label={t('entryForm.fuel.charging')}
          options={[
            { value: 'home', label: t('entryForm.fuel.home') },
            { value: 'public', label: t('entryForm.fuel.public') },
          ]}
          value={chargeLoc}
          disabled={readOnly}
          onPick={(v) => setChargeLoc(chargeLoc === v ? undefined : (v as 'home' | 'public'))}
        />
      )}
      <ToggleRow
        label={isElectric ? t('entryForm.fuel.fullCharge') : t('entryForm.fuel.fullTank')}
        value={fullTank}
        onValueChange={setFullTank}
        disabled={readOnly}
      />
      <ToggleRow
        label={t('entryForm.fuel.missed')}
        value={missed}
        onValueChange={setMissed}
        disabled={readOnly}
      />
      <Field
        label={t('entryForm.fuel.station')}
        value={station}
        onChangeText={setStation}
        maxLength={60}
        editable={!readOnly}
      />
      {mileageText && (
        <View style={{ marginTop: -8, marginBottom: 20 }}>
          <T size={13} color={th.primary} weight="semi">
            {t('entryForm.fuel.mileage', { value: mileageText })}
          </T>
        </View>
      )}
    </EntryShell>
  );
}
