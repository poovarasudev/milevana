// Manual trip form (LOG-10): start/end date-time and odometers, distance
// derived as end − start (LD-09), from/to text, business/personal purpose and
// an optional rate per odometer unit whose reimbursement is stored in
// `details`. A trip carries no `amount` and no `category`, never creates an
// income entry, `date` is the start, and `odometer` is the end reading
// (LD-05). On `hours` vehicles the rate is per hour.

import { useState } from 'react';
import { View } from 'react-native';
import { tsFromMillis, tsToMillis } from '../../data/schema/common';
import type { TripDetailsDoc } from '../../data/schema/entry';
import { tripFigures, TRIP_PURPOSES } from '../../domain/entries';
import { formatAmount } from '../../domain/money';
import { formatDistance } from '../../domain/units';
import { useSettings } from '../../features/format';
import { formatPriceMilli, parsePriceMilli } from '../../domain/fuel';
import { t } from '../../i18n';
import { DateTimeField } from '../DateTimeField';
import { Field, T } from '../kit';
import { useTheme } from '../theme';
import { ChoiceChips, NumberField, odometerToText, parseOdometer } from './fields';
import { EntryShell, odometerWarning, readonlyReason } from './EntryShell';
import type { EntryFormProps } from './types';

type TripErrors = Record<string, string>;

export function TripForm({ vehicle, entry, entries, readOnly, saving, saveError, onSubmit, onDelete }: EntryFormProps) {
  const th = useTheme();
  const settings = useSettings();
  const d = entry?.details as TripDetailsDoc | undefined;
  const [startAt, setStartAt] = useState(() => new Date(d ? tsToMillis(d.startAt) : Date.now() - 60_000 * 60));
  const [futureStart, setFutureStart] = useState(
    () => (d ? tsToMillis(d.startAt) : Date.now() - 60_000 * 60) > Date.now(),
  );
  const setStart = (nd: Date) => {
    setStartAt(nd);
    setFutureStart(nd.getTime() > Date.now());
  };
  const [endAt, setEndAt] = useState(() => new Date(d ? tsToMillis(d.endAt) : Date.now()));
  const [startOdo, setStartOdo] = useState(d ? odometerToText(d.startOdometer) : '');
  const [endOdo, setEndOdo] = useState(d ? odometerToText(d.endOdometer) : (entry ? odometerToText(entry.odometer) : ''));
  const [from, setFrom] = useState(d?.from ?? '');
  const [to, setTo] = useState(d?.to ?? '');
  const [purpose, setPurpose] = useState<'business' | 'personal' | undefined>(d?.purpose);
  const [rateText, setRateText] = useState(
    d?.ratePerUnitMilli !== undefined ? formatPriceMilli(d.ratePerUnitMilli, vehicle.currency) : '',
  );
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [errs, setErrs] = useState<TripErrors>({});

  const unitLabel = t(`units.${vehicle.odometerUnit}`);
  const sOdo = parseOdometer(startOdo);
  const eOdo = parseOdometer(endOdo);
  const figures =
    typeof sOdo === 'number' && typeof eOdo === 'number' && eOdo >= sOdo
      ? tripFigures(sOdo, eOdo, rateText.trim() ? parsePriceMilli(rateText, vehicle.currency) : undefined)
      : undefined;

  const startWarn =
    typeof sOdo === 'number'
      ? odometerWarning(entries, sOdo, startAt, entry?.id, settings.dateFormat)
      : null;
  const endWarn =
    typeof eOdo === 'number'
      ? odometerWarning(entries, eOdo, endAt, entry?.id, settings.dateFormat)
      : null;

  const submit = () => {
    const next: TripErrors = {};
    if (typeof sOdo !== 'number') next.startOdo = t('entryForm.odometerRequired');
    if (typeof eOdo !== 'number') next.endOdo = t('entryForm.odometerRequired');
    if (!purpose) next.purpose = t('entryForm.trip.purposeRequired');
    if (typeof sOdo === 'number' && typeof eOdo === 'number' && eOdo < sOdo) {
      next.endOdo = t('entryForm.trip.endBelowStart');
    }
    if (endAt.getTime() < startAt.getTime()) next.end = t('entryForm.trip.endBeforeStart');
    if (rateText.trim() && parsePriceMilli(rateText, vehicle.currency) === undefined) {
      next.rate = t('entryForm.amountInvalid');
    }
    setErrs(next);
    if (Object.keys(next).length > 0) return;

    const det: TripDetailsDoc = {
      startAt: tsFromMillis(startAt.getTime()),
      endAt: tsFromMillis(endAt.getTime()),
      startOdometer: sOdo as number,
      endOdometer: eOdo as number,
      distance: (eOdo as number) - (sOdo as number),
      from: from.trim(),
      to: to.trim(),
      purpose: purpose!,
    };
    const rateMilli = rateText.trim() ? parsePriceMilli(rateText, vehicle.currency) : undefined;
    if (rateMilli !== undefined) {
      det.ratePerUnitMilli = rateMilli;
      const fig = tripFigures(sOdo as number, eOdo as number, rateMilli);
      if (fig.reimbursementMinor !== undefined) det.reimbursementMinor = fig.reimbursementMinor;
    }
    const date = tsFromMillis(startAt.getTime());
    if (entry) {
      onSubmit({
        patch: {
          date,
          odometer: eOdo as number,
          details: det,
          notes: notes.trim() ? notes.trim() : null,
        },
      });
    } else {
      onSubmit({
        input: {
          type: 'trip',
          date,
          odometer: eOdo as number,
          details: det,
          notes: notes.trim() || undefined,
        },
      });
    }
  };

  return (
    <EntryShell
      shared={{
        date: startAt,
        setDate: setStart,
        futureDate: futureStart,
        odometerText: '',
        setOdometerText: () => undefined,
        notes,
        setNotes,
      }}
      vehicle={vehicle}
      entries={entries}
      excludeId={entry?.id}
      odometerMode="none"
      showDate={false}
      readOnly={readOnly}
      readonlyReason={readOnly ? readonlyReason(vehicle, entry) : undefined}
      saving={saving}
      error={saveError}
      submitLabel={entry ? t('common.save') : t('entryForm.saveEntry')}
      onSubmit={submit}
      onDelete={onDelete}
    >
      <DateTimeField label={t('entryForm.trip.start')} value={startAt} onChange={setStart} disabled={readOnly} />
      {futureStart && (
        <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 20 }}>
          {t('entryForm.futureDate')}
        </T>
      )}
      <DateTimeField label={t('entryForm.trip.end')} value={endAt} onChange={setEndAt} disabled={readOnly} />
      {errs.end ? <T size={12} color={th.danger} style={{ marginTop: -14, marginBottom: 20 }}>{errs.end}</T> : null}
      <NumberField
        label={`${t('entryForm.trip.startOdometer')} (${unitLabel})`}
        value={startOdo}
        onChangeText={setStartOdo}
        error={errs.startOdo}
        disabled={readOnly}
        testID="trip.startOdometer"
      />
      {startWarn ? <T size={12} color={th.danger} style={{ marginTop: -14, marginBottom: 20 }}>{startWarn}</T> : null}
      <NumberField
        label={`${t('entryForm.trip.endOdometer')} (${unitLabel})`}
        value={endOdo}
        onChangeText={setEndOdo}
        error={errs.endOdo}
        disabled={readOnly}
        testID="trip.endOdometer"
      />
      {endWarn ? <T size={12} color={th.danger} style={{ marginTop: -14, marginBottom: 20 }}>{endWarn}</T> : null}
      {figures && (
        <View style={{ marginBottom: 20 }}>
          <T size={13} color={th.primary} weight="semi">
            {t('entryForm.trip.distance', { value: formatDistance(figures.distance, unitLabel) })}
          </T>
        </View>
      )}
      <Field label={t('entryForm.trip.from')} value={from} onChangeText={setFrom} maxLength={60} editable={!readOnly} />
      <Field label={t('entryForm.trip.to')} value={to} onChangeText={setTo} maxLength={60} editable={!readOnly} />
      <ChoiceChips
        label={t('entryForm.trip.purpose')}
        options={TRIP_PURPOSES.map((p) => ({ value: p, label: t(`entryForm.trip.${p}`) }))}
        value={purpose}
        onPick={(p) => setPurpose(p as 'business' | 'personal')}
        disabled={readOnly}
        error={errs.purpose}
      />
      <NumberField
        label={t('entryForm.trip.rate', { unit: unitLabel, currency: vehicle.currency })}
        value={rateText}
        onChangeText={setRateText}
        error={errs.rate}
        disabled={readOnly}
        testID="trip.rate"
      />
      {figures?.reimbursementMinor !== undefined && (
        <View style={{ marginBottom: 20 }}>
          <T size={13} color={th.primary} weight="semi">
            {t('entryForm.trip.reimbursement', {
              value: formatAmount({ minor: figures.reimbursementMinor, currency: vehicle.currency }),
            })}
          </T>
        </View>
      )}
    </EntryShell>
  );
}
