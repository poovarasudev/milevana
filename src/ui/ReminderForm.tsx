// Reminder form (REM-05): subject (service type, expense category or custom
// title) with the title pre-filled, optional date and odometer triggers with
// repeats, adjustable lead days/distance, optional amount for recurring
// payments (REM-11). Validation and warnings follow RD-09; `hours` vehicles
// get no odometer trigger (OQ-11).

import { useState } from 'react';
import { View } from 'react-native';
import { useAppStore } from '../features/appStore';
import { adapter } from '../features/runtime';
import type { ReminderInput, ReminderPatch, ReminderRecord } from '../data/repos/reminderRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { tsFromMillis, tsToMillis } from '../data/schema/common';
import { EXPENSE_CATEGORIES, OTHER_CATEGORY, SERVICE_TYPES, serviceTypeLabel } from '../domain/entries';
import { minorToDecimal, parseMinor } from '../domain/money';
import {
  canUseOdometerTrigger, DEFAULT_LEAD_DAYS, DEFAULT_LEAD_DISTANCE,
  LEAD_DAYS, LEAD_DISTANCE, REPEAT_DISTANCE, REPEAT_MONTHS,
} from '../domain/reminders';
import { t } from '../i18n';
import { DateTimeField } from './DateTimeField';
import { ChoiceChips, NumberField, parseOdometer, ToggleRow } from './entry/fields';
import { Banner, Button, Field, T } from './kit';
import { Picker } from './Picker';
import { useTheme } from './theme';
import type { ReminderPreset } from './RemindersList';

export type ReminderFormResult = { input: ReminderInput } | { patch: ReminderPatch };

function isWeb(): boolean {
  try {
    return adapter().platform === 'web';
  } catch {
    return false;
  }
}

const OTHER = '__other__';

interface Seed {
  kind: 'service' | 'expense' | 'custom';
  serviceType: string;
  category: string;
  otherName: string;
  title: string;
  dateOn: boolean;
  dueDate?: Date;
  repeatMonths: string;
  odoOn: boolean;
  dueOdo: string;
  repeatDist: string;
  leadDays: string;
  leadDist: string;
  amount: string;
}

const dayOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function seedFromReminder(r: ReminderRecord, currency: string): Seed {
  const st = r.subject.serviceType ?? '';
  const cat = r.subject.category ?? '';
  return {
    kind: r.subject.kind,
    serviceType: r.subject.kind === 'service' && st !== 'other' ? st : st === 'other' ? OTHER : '',
    category: r.subject.kind === 'expense'
      ? (EXPENSE_CATEGORIES as readonly string[]).includes(cat) ? cat : OTHER
      : '',
    otherName:
      r.subject.kind === 'service' && st === 'other' ? r.title
      : r.subject.kind === 'expense' && !(EXPENSE_CATEGORIES as readonly string[]).includes(cat) ? cat
      : '',
    title: r.title,
    dateOn: !!r.dateTrigger,
    dueDate: r.dateTrigger ? new Date(tsToMillis(r.dateTrigger.dueDate)) : undefined,
    repeatMonths: r.dateTrigger?.repeatEveryMonths ? String(r.dateTrigger.repeatEveryMonths) : '',
    odoOn: !!r.odometerTrigger,
    dueOdo: r.odometerTrigger ? String(r.odometerTrigger.dueOdometer) : '',
    repeatDist: r.odometerTrigger?.repeatEveryDistance ? String(r.odometerTrigger.repeatEveryDistance) : '',
    leadDays: String(r.leadDays),
    leadDist: String(r.leadDistance),
    amount: r.amountMinor !== undefined ? String(minorToDecimal(r.amountMinor, currency)) : '',
  };
}

function seedFromPreset(preset: ReminderPreset, vehicle: VehicleRecord): Seed {
  const base: Seed = {
    kind: 'custom', serviceType: '', category: '', otherName: '', title: '',
    dateOn: false, repeatMonths: '', odoOn: false, dueOdo: '', repeatDist: '',
    leadDays: String(DEFAULT_LEAD_DAYS), leadDist: String(DEFAULT_LEAD_DISTANCE), amount: '',
  };
  if (preset === 'insurance') {
    return { ...base, kind: 'expense', category: 'Insurance', title: t('reminders.suggestInsurance'), dateOn: true };
  }
  if (preset === 'puc') {
    return { ...base, kind: 'expense', category: 'PUC certificate', title: t('reminders.suggestPuc'), dateOn: true };
  }
  const inYear = new Date();
  inYear.setFullYear(inYear.getFullYear() + 1);
  return {
    ...base, kind: 'service', serviceType: 'general_service',
    title: t('reminders.suggestService'), dateOn: true, dueDate: dayOnly(inYear),
    repeatMonths: '12',
    odoOn: canUseOdometerTrigger(vehicle.odometerUnit),
    dueOdo: String(Math.ceil(vehicle.lastOdometer + 10_000)),
    repeatDist: '10000',
  };
}

function seedNew(vehicle: VehicleRecord, preset?: ReminderPreset): Seed {
  if (preset) return seedFromPreset(preset, vehicle);
  return {
    kind: 'custom', serviceType: '', category: '', otherName: '', title: '',
    dateOn: false, repeatMonths: '', odoOn: false, dueOdo: '', repeatDist: '',
    leadDays: String(DEFAULT_LEAD_DAYS), leadDist: String(DEFAULT_LEAD_DISTANCE), amount: '',
  };
}

/** Whole positive/number parsing with a max (RD-09 ranges). */
function parseRange(text: string, min: number, max: number, integer: boolean): number | 'empty' | 'invalid' {
  const s = text.trim();
  if (s === '') return 'empty';
  const n = Number(s);
  if (!Number.isFinite(n) || (integer && !Number.isInteger(n)) || n < min || n > max) return 'invalid';
  return n;
}

export function ReminderForm({ vehicle, reminder, preset, saving, saveError, onSubmit, onDelete }: {
  vehicle: VehicleRecord;
  reminder?: ReminderRecord;
  preset?: ReminderPreset;
  saving?: boolean;
  saveError?: string | null;
  onSubmit: (v: ReminderFormResult) => void;
  onDelete?: () => void;
}) {
  const th = useTheme();
  const online = useAppStore((s) => s.online);
  const web = isWeb();
  const seed = reminder ? seedFromReminder(reminder, vehicle.currency) : seedNew(vehicle, preset);
  const [kind, setKind] = useState(seed.kind);
  const [serviceType, setServiceType] = useState(seed.serviceType);
  const [category, setCategory] = useState(seed.category);
  const [otherName, setOtherName] = useState(seed.otherName);
  const [title, setTitle] = useState(seed.title);
  const [titleTouched, setTitleTouched] = useState(!!reminder);
  const [dateOn, setDateOn] = useState(seed.dateOn);
  const [dueDate, setDueDate] = useState<Date | undefined>(seed.dueDate);
  const [repeatMonths, setRepeatMonths] = useState(seed.repeatMonths);
  const [odoOn, setOdoOn] = useState(seed.odoOn);
  const [dueOdo, setDueOdo] = useState(seed.dueOdo);
  const [repeatDist, setRepeatDist] = useState(seed.repeatDist);
  const [leadDays, setLeadDays] = useState(seed.leadDays);
  const [leadDist, setLeadDist] = useState(seed.leadDist);
  const [amount, setAmount] = useState(seed.amount);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const odoAllowed = canUseOdometerTrigger(vehicle.odometerUnit);
  const unit = t(`units.${vehicle.odometerUnit}`);

  // The title follows the subject until the user edits it (REM-05 #1).
  const fillTitle = (v: string) => { if (!titleTouched) setTitle(v); };
  const pickKind = (k: 'service' | 'expense' | 'custom') => { setKind(k); if (!titleTouched) setTitle(''); };
  const pickServiceType = (v: string) => {
    setServiceType(v);
    if (v !== OTHER) fillTitle(serviceTypeLabel(v));
  };
  const pickCategory = (v: string) => {
    setCategory(v);
    if (v !== OTHER) fillTitle(v);
  };

  const odoNum = parseOdometer(dueOdo);
  const pastDate = dateOn && dueDate !== undefined && dayOnly(dueDate).getTime() < dayOnly(new Date()).getTime();
  const odoBelow = odoOn && typeof odoNum === 'number' && odoNum <= vehicle.lastOdometer;

  const submit = () => {
    const next: Record<string, string> = {};
    const trimmedTitle = (kind === 'service' && serviceType === OTHER) || (kind === 'expense' && category === OTHER)
      ? (otherName.trim() || title.trim())
      : title.trim();
    const shownTitle = trimmedTitle || title.trim();
    if (!shownTitle) next.title = t('reminderForm.titleRequired');
    else if (shownTitle.length > 60) next.title = t('entryForm.textTooLong');

    if (kind === 'service' && !serviceType) next.subject = t('reminderForm.subjectRequired');
    if (kind === 'expense' && !category) next.subject = t('reminderForm.subjectRequired');

    if (!dateOn && !(odoOn && odoAllowed)) next.trigger = t('reminderForm.needTrigger');
    if (dateOn && !dueDate) next.dueDate = t('reminderForm.dueDateRequired');
    if (odoOn && odoAllowed && typeof odoNum !== 'number') next.dueOdo = t('vehicleForm.odometerInvalid');

    const repM = parseRange(repeatMonths, REPEAT_MONTHS.min, REPEAT_MONTHS.max, true);
    if (dateOn && repM === 'invalid') next.repeatMonths = t('reminderForm.repeatMonthsInvalid');
    const repD = parseRange(repeatDist, REPEAT_DISTANCE.min, REPEAT_DISTANCE.max, true);
    if (odoOn && repD === 'invalid') next.repeatDist = t('reminderForm.repeatDistanceInvalid');
    const ld = parseRange(leadDays, LEAD_DAYS.min, LEAD_DAYS.max, true);
    if (ld === 'invalid') next.leadDays = t('reminderForm.leadDaysInvalid');
    const ldist = parseRange(leadDist, LEAD_DISTANCE.min, LEAD_DISTANCE.max, true);
    if (ldist === 'invalid') next.leadDist = t('reminderForm.leadDistanceInvalid');

    let amountMinor: number | undefined;
    if (amount.trim()) {
      const minor = parseMinor(amount, vehicle.currency);
      if (minor === undefined || minor <= 0) next.amount = t('reminderForm.amountInvalid');
      else amountMinor = minor;
    }

    setErrs(next);
    if (Object.keys(next).length > 0) return;

    const subject: ReminderInput['subject'] =
      kind === 'service' ? { kind: 'service', serviceType: serviceType === OTHER ? 'other' : serviceType }
      : kind === 'expense' ? { kind: 'expense', category: category === OTHER ? otherName.trim() : category }
      : { kind: 'custom' };

    const dateTrigger = dateOn && dueDate
      ? { dueDate: tsFromMillis(dayOnly(dueDate).getTime()), ...(repM !== 'empty' ? { repeatEveryMonths: repM as number } : {}) }
      : undefined;
    const odometerTrigger = odoOn && odoAllowed && typeof odoNum === 'number'
      ? { dueOdometer: odoNum, ...(repD !== 'empty' ? { repeatEveryDistance: repD as number } : {}) }
      : undefined;

    if (reminder) {
      onSubmit({
        patch: {
          title: shownTitle,
          subject,
          dateTrigger: dateTrigger ?? null,
          odometerTrigger: odometerTrigger ?? null,
          leadDays: ld === 'empty' ? DEFAULT_LEAD_DAYS : (ld as number),
          leadDistance: ldist === 'empty' ? DEFAULT_LEAD_DISTANCE : (ldist as number),
          amountMinor: amountMinor ?? null,
        },
      });
    } else {
      onSubmit({
        input: {
          title: shownTitle,
          subject,
          dateTrigger,
          odometerTrigger,
          leadDays: ld === 'empty' ? DEFAULT_LEAD_DAYS : (ld as number),
          leadDistance: ldist === 'empty' ? DEFAULT_LEAD_DISTANCE : (ldist as number),
          amountMinor,
          status: 'active',
        },
      });
    }
  };

  const serviceOptions = [
    ...SERVICE_TYPES.map((s) => ({ value: s.id, label: s.label })),
    { value: OTHER, label: OTHER_CATEGORY },
  ];
  const categoryOptions = [
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
    { value: OTHER, label: OTHER_CATEGORY },
  ];
  const otherSubject = (kind === 'service' && serviceType === OTHER) || (kind === 'expense' && category === OTHER);

  return (
    <View>
      <ChoiceChips
        label={t('reminderForm.subject')}
        options={[
          { value: 'service', label: t('reminderForm.subjectService') },
          { value: 'expense', label: t('reminderForm.subjectExpense') },
          { value: 'custom', label: t('reminderForm.subjectCustom') },
        ]}
        value={kind}
        onPick={(v) => pickKind(v as 'service' | 'expense' | 'custom')}
        error={errs.subject}
      />
      {kind === 'service' && (
        <Picker
          label={t('reminderForm.serviceType')}
          valueLabel={serviceType === OTHER ? OTHER_CATEGORY : serviceType ? serviceTypeLabel(serviceType) : '—'}
          options={serviceOptions}
          onPick={pickServiceType}
        />
      )}
      {kind === 'expense' && (
        <Picker
          label={t('reminderForm.expenseCategory')}
          valueLabel={category === OTHER ? OTHER_CATEGORY : category || '—'}
          options={categoryOptions}
          onPick={pickCategory}
        />
      )}
      {otherSubject && (
        <Field
          label={t('reminderForm.otherName')}
          value={otherName}
          onChangeText={(v) => { setOtherName(v); if (!titleTouched) setTitle(v); }}
          maxLength={60}
        />
      )}
      <Field
        label={t('reminderForm.title')}
        value={title}
        onChangeText={(v) => { setTitle(v); setTitleTouched(true); }}
        placeholder={t('reminderForm.titlePlaceholder')}
        maxLength={60}
        error={errs.title}
        testID="reminder.title"
      />

      <ToggleRow label={t('reminderForm.byDate')} value={dateOn} onValueChange={setDateOn} />
      {dateOn && (
        <>
          <DateTimeField
            label={t('reminderForm.dueDate')}
            value={dueDate}
            onChange={(d) => setDueDate(dayOnly(d))}
            onClear={() => setDueDate(undefined)}
            mode="date"
          />
          {errs.dueDate ? <T size={12} color={th.danger} style={{ marginTop: -14, marginBottom: 20 }}>{errs.dueDate}</T> : null}
          {pastDate ? <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 20 }}>{t('reminderForm.pastDate')}</T> : null}
          <NumberField
            label={t('reminderForm.repeatMonths')}
            value={repeatMonths}
            onChangeText={setRepeatMonths}
            error={errs.repeatMonths}
            testID="reminder.repeatMonths"
          />
        </>
      )}

      {odoAllowed && (
        <>
          <ToggleRow label={t('reminderForm.byOdometer')} value={odoOn} onValueChange={setOdoOn} />
          {odoOn && (
            <>
              <NumberField
                label={`${t('reminderForm.dueOdometer')} (${unit})`}
                value={dueOdo}
                onChangeText={setDueOdo}
                error={errs.dueOdo}
                testID="reminder.dueOdometer"
              />
              {odoBelow ? <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 20 }}>{t('reminderForm.odoBelow')}</T> : null}
              <NumberField
                label={`${t('reminderForm.repeatDistance')} (${unit})`}
                value={repeatDist}
                onChangeText={setRepeatDist}
                error={errs.repeatDist}
                testID="reminder.repeatDistance"
              />
            </>
          )}
        </>
      )}

      {dateOn && (
        <NumberField
          label={t('reminderForm.leadDays')}
          value={leadDays}
          onChangeText={setLeadDays}
          error={errs.leadDays}
          testID="reminder.leadDays"
        />
      )}
      {odoOn && odoAllowed && (
        <NumberField
          label={`${t('reminderForm.leadDistance')} (${unit})`}
          value={leadDist}
          onChangeText={setLeadDist}
          error={errs.leadDist}
          testID="reminder.leadDistance"
        />
      )}

      <NumberField
        label={`${t('reminderForm.amount')} (${vehicle.currency})`}
        value={amount}
        onChangeText={setAmount}
        error={errs.amount}
        testID="reminder.amount"
      />
      <T size={12} color={th.muted} style={{ marginTop: -14, marginBottom: 20 }}>
        {t('reminderForm.amountHint')}
      </T>

      {web && !online ? <Banner icon="wifi-off" text={t('notices.offline')} /> : null}
      {errs.trigger ? <Banner icon="alert-circle-outline" text={errs.trigger} /> : null}
      {saveError ? <T size={13} color={th.danger} style={{ marginBottom: 12 }}>{saveError}</T> : null}
      <Button title={t('reminderForm.save')} onPress={submit} disabled={!!saving || (web && !online)} />
      {onDelete ? (
        <View style={{ marginTop: 12 }}>
          <Button title={t('common.delete')} kind="danger" onPress={onDelete} />
        </View>
      ) : null}
    </View>
  );
}
