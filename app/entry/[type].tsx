import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Switch, View } from 'react-native';
import { useSelectedVehicle, useStore } from '../../src/data/store';
import { formatMoney, toMinor } from '../../src/domain/money';
import type { EntryType, FuelType } from '../../src/domain/types';
import { ENTRY_LABEL } from '../../src/features/entryView';
import { KEYBOARD_BEHAVIOR } from '../../src/ui/platform';
import { Button, Card, Chip, Field, Header, T } from '../../src/ui/kit';
import { useTheme } from '../../src/ui/theme';

const cap = (s: string) => s[0].toUpperCase() + s.slice(1).replace('cng', 'CNG').replace('lpg', 'LPG');
const nowMs = () => Date.now();

export default function LogEntry() {
  const { type } = useLocalSearchParams<{ type: EntryType }>();
  const t = useTheme();
  const v = useSelectedVehicle();
  const addEntry = useStore((s) => s.addEntry);
  const [odo, setOdo] = useState(v ? String(v.lastOdometer) : '');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [fuel, setFuel] = useState<FuelType>(v?.fuelTypes[0] ?? 'petrol');
  const [full, setFull] = useState(true);
  const [missed, setMissed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (!v) return null;

  const isFuel = type === 'fuel';
  const total = isFuel ? toMinor(Number(qty || 0) * Number(price || 0)) : toMinor(Number(amount || 0));
  const delta = Number(odo) - v.lastOdometer;

  const save = () => {
    const e: Record<string, string> = {};
    if (odo && !/^\d+(\.\d)?$/.test(odo)) e.odo = 'Enter a number, one decimal at most';
    if (isFuel) {
      if (!(Number(qty) > 0)) e.qty = 'Enter quantity';
      if (!(Number(price) > 0)) e.price = 'Enter price';
      if (!odo) e.odo = 'Enter odometer';
    } else if (!(Number(amount) > 0)) e.amount = 'Enter amount';
    setErrors(e);
    if (Object.keys(e).length) return;
    addEntry({
      vehicleId: v.id, type, date: nowMs(), amountMinor: total,
      odometer: odo ? Number(odo) : undefined, notes: isFuel ? undefined : notes.trim() || undefined,
      details: isFuel ? { fuelType: fuel, quantity: Number(qty), pricePerUnitMinor: toMinor(Number(price)), fullTank: full, missedFill: missed } : undefined,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={KEYBOARD_BEHAVIOR}>
      <Header title={ENTRY_LABEL[type]} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Field label="ODOMETER" keyboardType="decimal-pad" value={odo} onChangeText={setOdo} suffix={v.odometerUnit} error={errors.odo} />
        {delta > 0 && <T size={13} color={t.muted} style={{ marginTop: -14, marginBottom: 16 }}>+{delta} {v.odometerUnit} since last entry</T>}
        {isFuel ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {v.fuelTypes.map((f) => <Chip key={f} label={cap(f)} active={fuel === f} onPress={() => setFuel(f)} />)}
            </View>
            <Field label="QUANTITY" keyboardType="decimal-pad" value={qty} onChangeText={setQty} suffix="L" error={errors.qty} />
            <Field label="PRICE / L" keyboardType="decimal-pad" value={price} onChangeText={setPrice} suffix="₹" error={errors.price} />
            <Card style={{ gap: 12, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}><T weight="semi">Full tank</T><T size={13} color={t.muted}>Needed to calculate mileage</T></View>
                <Switch value={full} onValueChange={setFull} accessibilityLabel="Full tank" />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}><T weight="semi">Missed a fill before this</T><T size={13} color={t.muted}>Skips mileage for this interval</T></View>
                <Switch value={missed} onValueChange={setMissed} accessibilityLabel="Missed a fill before this" />
              </View>
            </Card>
          </>
        ) : (
          <>
            <Field label="AMOUNT" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} suffix="₹" error={errors.amount} />
            <Field label="NOTES" value={notes} onChangeText={setNotes} maxLength={500} placeholder="Optional" />
          </>
        )}
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <T color={t.muted}>Total</T><T weight="semi" size={18}>{formatMoney(total)}</T>
        </Card>
        <Button title="Save entry" onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
