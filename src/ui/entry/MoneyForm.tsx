// Expense and income forms (LOG-07, LOG-09): a fixed category list plus
// "Other" with free text (LD-06 — the name text is stored on `category`),
// a positive amount in the vehicle's currency, optional odometer and notes.
// Income adds an optional platform field with suggestions that stay free
// text (LD-07: stored as `details.platform`).

import { useState } from 'react';
import { tsFromMillis } from '../../data/schema/common';
import type { IncomeDetailsDoc } from '../../data/schema/entry';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, OTHER_CATEGORY, PLATFORM_SUGGESTIONS } from '../../domain/entries';
import { minorToDecimal, parseMinor } from '../../domain/money';
import { t } from '../../i18n';
import { ChoiceChips, NumberField, parseOdometer } from './fields';
import { Field } from '../kit';
import { EntryShell, readonlyReason, useSharedFields } from './EntryShell';
import type { EntryFormProps } from './types';

const OTHER = '__other__';

function categoryState(
  list: readonly string[],
  entry?: { category?: string },
): { pick: string; other: string } {
  const c = entry?.category;
  if (!c) return { pick: '', other: '' };
  return list.includes(c) ? { pick: c, other: '' } : { pick: OTHER, other: c };
}

export function MoneyForm({ kind, vehicle, entry, entries, prefill, readOnly, saving, saveError, attachmentsNode, onSubmit, onDelete }: EntryFormProps & { kind: 'expense' | 'income' }) {
  const shared = useSharedFields(entry);
  const list = kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const seed = categoryState(list, entry ?? (prefill?.category ? { category: prefill.category } : undefined));
  const incomeDetails = (entry?.details ?? undefined) as IncomeDetailsDoc | undefined;

  const [pick, setPick] = useState(seed.pick);
  const [other, setOther] = useState(seed.other);
  const [amount, setAmount] = useState(
    entry?.amount ? String(minorToDecimal(entry.amount.minor, vehicle.currency))
    : prefill?.amountMinor !== undefined ? String(minorToDecimal(prefill.amountMinor, vehicle.currency))
    : '',
  );
  const [platform, setPlatform] = useState(incomeDetails?.platform ?? '');
  const [errs, setErrs] = useState<Record<string, string>>({});

  const options = [...list.map((c) => ({ value: c, label: c })), { value: OTHER, label: OTHER_CATEGORY }];

  const submit = () => {
    const next: Record<string, string> = {};
    const category = pick === OTHER ? other.trim() : pick;
    if (!category) next.category = t('entryForm.categoryRequired');
    if (pick === OTHER && other.trim().length > 60) next.category = t('entryForm.textTooLong');
    const minor = parseMinor(amount, vehicle.currency);
    if (minor === undefined) next.amount = t('entryForm.amountRequired');
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    const odo = parseOdometer(shared.odometerText);
    const date = tsFromMillis(shared.date.getTime());
    const details = kind === 'income' && platform.trim()
      ? { platform: platform.trim() }
      : undefined;
    if (entry) {
      onSubmit({
        patch: {
          date,
          odometer: typeof odo === 'number' ? odo : null,
          amount: { minor: minor!, currency: vehicle.currency },
          category,
          details: details ?? (kind === 'income' ? null : undefined),
          notes: shared.notes.trim() ? shared.notes.trim() : null,
        },
      });
    } else {
      onSubmit({
        input: {
          type: kind,
          date,
          odometer: typeof odo === 'number' ? odo : undefined,
          amount: { minor: minor!, currency: vehicle.currency },
          category,
          details,
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
      attachments={attachmentsNode}
      onDelete={onDelete}
    >
      <ChoiceChips
        label={t('entryForm.category')}
        options={options}
        value={pick}
        disabled={readOnly}
        error={errs.category}
        onPick={setPick}
      />
      {pick === OTHER && (
        <Field
          label={t('entryForm.otherCategory')}
          value={other}
          onChangeText={setOther}
          maxLength={60}
          editable={!readOnly}
        />
      )}
      <NumberField
        label={`${t('entryForm.amount')} (${vehicle.currency})`}
        value={amount}
        onChangeText={setAmount}
        error={errs.amount}
        disabled={readOnly}
        testID="money.amount"
      />
      {kind === 'income' && (
        <>
          <Field
            label={t('entryForm.income.platform')}
            value={platform}
            onChangeText={setPlatform}
            maxLength={60}
            editable={!readOnly}
            testID="income.platform"
          />
          {!readOnly && !platform.trim() && (
            <ChoiceChips
              options={PLATFORM_SUGGESTIONS.map((p) => ({ value: p, label: p }))}
              value={undefined}
              onPick={setPlatform}
            />
          )}
        </>
      )}
    </EntryShell>
  );
}
