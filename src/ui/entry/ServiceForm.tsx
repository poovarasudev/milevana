// Service form (LOG-08): one entry per garage visit — 1..20 line items, each
// a service type from the fixed list (or 'other' + free-text label, LD-06)
// and a cost; optional labour and discount; the total is lines + labour −
// discount floored at zero and stored as `amount.minor`. The entry's
// `category` is a single pick from the same Services list (OQ-43).

import { useState } from 'react';
import { View } from 'react-native';
import { tsFromMillis } from '../../data/schema/common';
import type { ServiceDetailsDoc } from '../../data/schema/entry';
import { OTHER_CATEGORY, SERVICE_LINE_MAX, SERVICE_TYPES, serviceTotal, serviceTypeLabel } from '../../domain/entries';
import { formatAmount, minorToDecimal, parseMinor } from '../../domain/money';
import { t } from '../../i18n';
import { Chip, Field, IconButton, Label, T } from '../kit';
import { Picker } from '../Picker';
import { useTheme } from '../theme';
import { ChoiceChips, NumberField, parseOdometer } from './fields';
import { EntryShell, readonlyReason, useSharedFields } from './EntryShell';
import type { EntryFormProps } from './types';

const OTHER = '__other__';
const OTHER_TYPE = 'other';

interface LineState {
  key: string;
  serviceType: string; // id or 'other'
  otherLabel: string;
  cost: string;
}

let lineSeq = 0;
const newLine = (): LineState => ({ key: `l${++lineSeq}`, serviceType: '', otherLabel: '', cost: '' });

function categoryState(entry?: { category?: string }): { pick: string; other: string } {
  const c = entry?.category;
  if (!c) return { pick: '', other: '' };
  return SERVICE_TYPES.some((s) => s.label === c) ? { pick: c, other: '' } : { pick: OTHER, other: c };
}

export function ServiceForm({ vehicle, entry, entries, readOnly, saving, saveError, onSubmit, onDelete }: EntryFormProps) {
  const th = useTheme();
  const shared = useSharedFields(entry);
  const details = entry?.details as ServiceDetailsDoc | undefined;
  const seed = categoryState(entry);

  const [lines, setLines] = useState<LineState[]>(() =>
    details?.lines.map((l) => ({
      key: l.id,
      serviceType: l.serviceType,
      otherLabel: l.otherLabel ?? '',
      cost: String(minorToDecimal(l.costMinor, vehicle.currency)),
    })) ?? [newLine()],
  );
  const [labour, setLabour] = useState(
    details?.labourMinor !== undefined ? String(minorToDecimal(details.labourMinor, vehicle.currency)) : '',
  );
  const [discount, setDiscount] = useState(
    details?.discountMinor !== undefined ? String(minorToDecimal(details.discountMinor, vehicle.currency)) : '',
  );
  const [pick, setPick] = useState(seed.pick);
  const [otherCat, setOtherCat] = useState(seed.other);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const setLine = (key: string, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // live total for display
  const parsedLines = lines.map((l) => parseMinor(l.cost, vehicle.currency, { allowZero: true }));
  const labourMinor = labour.trim() === '' ? 0 : parseMinor(labour, vehicle.currency, { allowZero: true });
  const discountMinor = discount.trim() === '' ? 0 : parseMinor(discount, vehicle.currency, { allowZero: true });
  const totalsKnown =
    parsedLines.every((c) => c !== undefined) && labourMinor !== undefined && discountMinor !== undefined;
  const totalMinor = totalsKnown
    ? serviceTotal(
        lines.map((l, i) => ({ costMinor: parsedLines[i]! })),
        labourMinor,
        discountMinor,
      )
    : undefined;

  const catOptions = [
    ...SERVICE_TYPES.map((s) => ({ value: s.label, label: s.label })),
    { value: OTHER, label: OTHER_CATEGORY },
  ];

  const submit = () => {
    const next: Record<string, string> = {};
    const category = pick === OTHER ? otherCat.trim() : pick;
    if (!category) next.category = t('entryForm.categoryRequired');
    if (lines.length < 1 || lines.length > SERVICE_LINE_MAX) {
      next.lines = t('entryForm.service.lineCount', { max: SERVICE_LINE_MAX });
    }
    if (lines.some((l) => !l.serviceType)) next.lines = t('entryForm.service.typeRequired');
    if (lines.some((l) => l.serviceType === OTHER_TYPE && !l.otherLabel.trim())) {
      next.lines = t('entryForm.service.otherRequired');
    }
    if (parsedLines.some((c) => c === undefined)) next.lines = t('entryForm.service.costInvalid');
    if (labour.trim() !== '' && labourMinor === undefined) next.labour = t('entryForm.amountInvalid');
    if (discount.trim() !== '' && discountMinor === undefined) next.discount = t('entryForm.amountInvalid');
    if (totalMinor === undefined) next.total = t('entryForm.service.costInvalid');
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    const det: ServiceDetailsDoc = {
      lines: lines.map((l, i) => ({
        id: `line-${i + 1}`,
        serviceType: l.serviceType,
        ...(l.serviceType === OTHER_TYPE ? { otherLabel: l.otherLabel.trim() } : {}),
        costMinor: parsedLines[i]!,
      })),
      ...(labourMinor ? { labourMinor } : {}),
      ...(discountMinor ? { discountMinor } : {}),
    };
    const date = tsFromMillis(shared.date.getTime());
    const odo = parseOdometer(shared.odometerText);
    const amount = { minor: totalMinor!, currency: vehicle.currency };
    if (entry) {
      onSubmit({
        patch: {
          date,
          odometer: typeof odo === 'number' ? odo : null,
          amount,
          category,
          details: det,
          notes: shared.notes.trim() ? shared.notes.trim() : null,
        },
      });
    } else {
      onSubmit({
        input: {
          type: 'service', date,
          odometer: typeof odo === 'number' ? odo : undefined,
          amount, category, details: det,
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
      odometerMode="optional"
      readOnly={readOnly}
      readonlyReason={readOnly ? readonlyReason(vehicle, entry) : undefined}
      saving={saving}
      error={saveError}
      submitLabel={entry ? t('common.save') : t('entryForm.saveEntry')}
      onSubmit={submit}
      onDelete={onDelete}
    >
      <Label>{t('entryForm.service.lines')}</Label>
      {lines.map((l, li) => (
        <View
          key={l.key}
          style={{
            borderWidth: 1, borderColor: th.border, borderRadius: 16,
            padding: 12, marginBottom: 12, gap: 0, backgroundColor: th.card,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Picker
                label=""
                valueLabel={l.serviceType ? serviceTypeLabel(l.serviceType, l.otherLabel) : t('entryForm.service.pickType')}
                options={[
                  ...SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label })),
                  { value: OTHER_TYPE, label: OTHER_CATEGORY },
                ]}
                disabled={readOnly}
                onPick={(v) => setLine(l.key, { serviceType: v })}
              />
            </View>
            {lines.length > 1 && !readOnly && (
              <IconButton
                icon="close"
                accessibilityLabel={t('entryForm.service.removeLine')}
                onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                color={th.muted}
              />
            )}
          </View>
          {l.serviceType === OTHER_TYPE && (
            <Field
              label={t('entryForm.service.otherLabel')}
              value={l.otherLabel}
              onChangeText={(s) => setLine(l.key, { otherLabel: s })}
              maxLength={60}
              editable={!readOnly}
            />
          )}
          <NumberField
            label={`${t('entryForm.service.cost')} (${vehicle.currency})`}
            value={l.cost}
            onChangeText={(s) => setLine(l.key, { cost: s })}
            disabled={readOnly}
            testID={`service.line.${li}.cost`}
          />
        </View>
      ))}
      {errs.lines ? <T size={12} color={th.danger} style={{ marginBottom: 8 }}>{errs.lines}</T> : null}
      {!readOnly && lines.length < SERVICE_LINE_MAX && (
        <View style={{ marginBottom: 20 }}>
          <Chip
            label={t('entryForm.service.addLine')}
            active={false}
            onPress={() => setLines((ls) => [...ls, newLine()])}
          />
        </View>
      )}
      <NumberField
        label={`${t('entryForm.service.labour')} (${vehicle.currency})`}
        value={labour}
        onChangeText={setLabour}
        error={errs.labour}
        disabled={readOnly}
        testID="service.labour"
      />
      <NumberField
        label={`${t('entryForm.service.discount')} (${vehicle.currency})`}
        value={discount}
        onChangeText={setDiscount}
        error={errs.discount}
        disabled={readOnly}
        testID="service.discount"
      />
      {totalMinor !== undefined && (
        <View style={{ marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between' }}>
          <T weight="semi" size={16}>{t('entryForm.service.total')}</T>
          <T weight="bold" size={17}>{formatAmount({ minor: totalMinor, currency: vehicle.currency })}</T>
        </View>
      )}
      <ChoiceChips
        label={t('entryForm.category')}
        options={catOptions}
        value={pick}
        disabled={readOnly}
        error={errs.category}
        onPick={setPick}
      />
      {pick === OTHER && (
        <Field
          label={t('entryForm.otherCategory')}
          value={otherCat}
          onChangeText={setOtherCat}
          maxLength={60}
          editable={!readOnly}
        />
      )}
    </EntryShell>
  );
}
