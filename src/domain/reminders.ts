// REM-01 — reminder domain: entry matching, roll-forward, km-per-day
// prediction, notification times, derived status and OQ-47 urgency ordering.
// Pure functions only — no Firestore, no React, no platform APIs.

import { Timestamp, tsFromMillis, tsToMillis } from '../data/schema/common';
import type { ServiceDetailsDoc } from '../data/schema/entry';
import type { ReminderDoc } from '../data/schema/reminder';
import type { OdometerReading } from './entries';

export const DAY_MS = 86_400_000;
/** RD-02: prediction uses readings dated in the last 90 days. */
export const PREDICTION_WINDOW_DAYS = 90;
export const PREDICTION_MIN_READINGS = 2;
export const PREDICTION_MIN_SPAN_DAYS = 7;
/** RD-12: at most the soonest 60 notifications inside the next 60 days. */
export const SCHEDULE_MAX = 60;
export const SCHEDULE_HORIZON_DAYS = 60;
/** Notifications fire at 9:00 local (RD-03). */
export const NOTIFY_HOUR = 9;
/** RD-09 limits. */
export const MAX_REMINDERS_PER_VEHICLE = 50;
export const REPEAT_MONTHS = { min: 1, max: 120 };
export const REPEAT_DISTANCE = { min: 1, max: 999_999 };
export const LEAD_DAYS = { min: 0, max: 365 };
export const LEAD_DISTANCE = { min: 0, max: 99_999 };
export const DEFAULT_LEAD_DAYS = 7;
export const DEFAULT_LEAD_DISTANCE = 500;

export type DerivedStatus = 'upcoming' | 'dueSoon' | 'dueToday' | 'overdue' | 'done';

// --- small date helpers ------------------------------------------------------

const dayStart = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const addDays = (d: Date, days: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());

const nineOClock = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), NOTIFY_HOUR, 0, 0, 0);

/**
 * Add whole months, clamping to the last day of the target month
 * (RD-05: 31 Jan + 1 month → 28/29 Feb).
 */
export function addMonthsClamped(d: Date, months: number): Date {
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1,
    d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return target;
}

// --- matching (RD-04) ---------------------------------------------------------

export interface MatchEntry {
  type: string;
  category?: string;
  date: Timestamp;
  details?: unknown;
}

/**
 * An entry matches a reminder's subject when a service line carries its
 * service type or an expense carries its category. Custom reminders and
 * 'other' service lines never match (RD-04).
 */
export function entryMatchesReminder(entry: MatchEntry, reminder: ReminderDoc): boolean {
  const s = reminder.subject;
  if (s.kind === 'service') {
    if (entry.type !== 'service' || !s.serviceType || s.serviceType === 'other') return false;
    const d = entry.details as ServiceDetailsDoc | undefined;
    return Array.isArray(d?.lines) && d.lines.some((l) => l.serviceType === s.serviceType);
  }
  if (s.kind === 'expense') {
    return entry.type === 'expense' && s.category !== undefined && entry.category === s.category;
  }
  return false;
}

/**
 * Completion gate: the reminder must be active, the entry must match, and the
 * entry's date must be on or after the reminder's creation *day* (RD-04).
 * Editing or deleting the entry later never reopens the reminder — nothing
 * here looks backwards.
 */
export function entryCompletesReminder(entry: MatchEntry, reminder: ReminderDoc): boolean {
  if (reminder.status !== 'active') return false;
  if (!entryMatchesReminder(entry, reminder)) return false;
  return dayStart(new Date(tsToMillis(entry.date))) >= dayStart(new Date(tsToMillis(reminder.createdAt)));
}

// --- roll-forward (RD-05) ------------------------------------------------------

export interface Completion {
  /** Entry date, or "today" for a manual Mark done. */
  date: Timestamp;
  /** Entry odometer; falls back to `lastOdometer` when absent. */
  odometer?: number;
  /** Vehicle's lastOdometer — the base when the entry has no odometer. */
  lastOdometer: number;
  /** When the completion is recorded (write time). */
  completedAt: Timestamp;
  /** Completing entry id, or undefined for a manual Mark done. */
  entryId?: string;
}

export interface RollResult {
  status: 'active' | 'done';
  completedAt: Timestamp;
  /** undefined = leave alone; null = remove the field. */
  completedByEntryId?: string | null;
  dateTrigger?: ReminderDoc['dateTrigger'] | null;
  odometerTrigger?: ReminderDoc['odometerTrigger'] | null;
}

/**
 * Compute the reminder's post-completion fields. Every repeating trigger rolls
 * forward from the completing entry (both together when both repeat); a
 * one-off trigger on a completed reminder is spent and dropped; when no
 * trigger survives the reminder becomes done.
 */
export function rollForward(reminder: ReminderDoc, c: Completion): RollResult {
  const out: RollResult = {
    status: 'done',
    completedAt: c.completedAt,
    completedByEntryId: c.entryId ?? null,
  };
  const dt = reminder.dateTrigger;
  const ot = reminder.odometerTrigger;
  if (dt?.repeatEveryMonths) {
    const next = addMonthsClamped(new Date(tsToMillis(c.date)), dt.repeatEveryMonths);
    out.dateTrigger = { dueDate: tsFromMillis(next.getTime()), repeatEveryMonths: dt.repeatEveryMonths };
  } else if (ot?.repeatEveryDistance) {
    // the date trigger is one-off and spent
    out.dateTrigger = null;
  }
  if (ot?.repeatEveryDistance) {
    out.odometerTrigger = {
      dueOdometer: (c.odometer ?? c.lastOdometer) + ot.repeatEveryDistance,
      repeatEveryDistance: ot.repeatEveryDistance,
    };
  } else if (dt?.repeatEveryMonths) {
    out.odometerTrigger = null;
  }
  if (out.dateTrigger || out.odometerTrigger) out.status = 'active';
  return out;
}

/** True when a completion would keep the reminder alive (at least one repeat). */
export function isRepeating(reminder: ReminderDoc): boolean {
  return !!(reminder.dateTrigger?.repeatEveryMonths || reminder.odometerTrigger?.repeatEveryDistance);
}

// --- prediction (RD-02) --------------------------------------------------------

/** Readings dated inside the 90-day window ending at `now`. */
export function windowReadings(readings: OdometerReading[], now: Date): OdometerReading[] {
  const cutoff = now.getTime() - PREDICTION_WINDOW_DAYS * DAY_MS;
  return readings.filter((r) => tsToMillis(r.date) >= cutoff);
}

/**
 * Average distance per day: (largest − smallest reading) / days between them.
 * Needs ≥2 in-window readings whose dates span ≥7 days; otherwise null.
 */
export function perDayRate(readings: OdometerReading[], now: Date): number | null {
  const w = windowReadings(readings, now);
  if (w.length < PREDICTION_MIN_READINGS) return null;
  let lo = w[0];
  let hi = w[0];
  for (const r of w) {
    if (r.value < lo.value) lo = r;
    if (r.value > hi.value) hi = r;
  }
  const days = Math.abs(tsToMillis(hi.date) - tsToMillis(lo.date)) / DAY_MS;
  if (days < PREDICTION_MIN_SPAN_DAYS) return null;
  const rate = (hi.value - lo.value) / days;
  return rate > 0 ? rate : null;
}

/** The in-window reading with the latest entry date. */
export function latestReading(readings: OdometerReading[], now: Date): OdometerReading | null {
  const w = windowReadings(readings, now);
  let best: OdometerReading | null = null;
  for (const r of w) {
    if (!best || tsToMillis(r.date) > tsToMillis(best.date)) best = r;
  }
  return best;
}

/**
 * Predicted due instant: latest reading's date + remaining/rate days
 * (RD-02). Returns null when there is no prediction.
 */
export function predictDueMs(dueOdometer: number, readings: OdometerReading[], now: Date): number | null {
  const rate = perDayRate(readings, now);
  const latest = latestReading(readings, now);
  if (rate === null || !latest) return null;
  const remaining = dueOdometer - latest.value;
  if (remaining <= 0) return now.getTime();
  return tsToMillis(latest.date) + (remaining / rate) * DAY_MS;
}

// --- derived status (RD-01) ----------------------------------------------------

const RANK: Record<DerivedStatus, number> = {
  overdue: 0, dueToday: 1, dueSoon: 2, upcoming: 3, done: 4,
};

export function reminderStatus(
  reminder: ReminderDoc,
  ctx: { lastOdometer: number },
  now: Date,
): DerivedStatus {
  if (reminder.status === 'done') return 'done';
  const today = dayStart(now);
  let best: DerivedStatus = 'upcoming';
  const bump = (s: DerivedStatus) => {
    if (RANK[s] < RANK[best]) best = s;
  };
  const dt = reminder.dateTrigger;
  if (dt) {
    const dueDay = dayStart(new Date(tsToMillis(dt.dueDate)));
    if (dueDay < today) bump('overdue');
    else if (dueDay === today) bump('dueToday');
    else if ((dueDay - today) / DAY_MS <= reminder.leadDays) bump('dueSoon');
  }
  const ot = reminder.odometerTrigger;
  if (ot) {
    if (ctx.lastOdometer >= ot.dueOdometer) bump('overdue');
    else if (ot.dueOdometer - ctx.lastOdometer <= reminder.leadDistance) bump('dueSoon');
  }
  return best;
}

// --- view-model rows (RD-11 ordering) -------------------------------------------

export interface ReminderInfo {
  status: DerivedStatus;
  /** Soonest known due instant: the date trigger's due date or the odometer
   * trigger's predicted due. Drives the "overdue first, then soonest" order. */
  effectiveDueMs: number | null;
  /** Odometer remaining distance (null when there is no odometer trigger). */
  remainingDistance: number | null;
  /** Predicted odometer due instant, when a prediction exists. */
  predictedDueMs: number | null;
  /** Whole days past the date trigger's due date, when overdue by date. */
  overdueDays: number | null;
  repeating: boolean;
}

export function reminderInfo(
  reminder: ReminderDoc,
  ctx: { lastOdometer: number; readings: OdometerReading[] },
  now: Date,
): ReminderInfo {
  const status = reminderStatus(reminder, ctx, now);
  const today = dayStart(now);
  let effectiveDueMs: number | null = null;
  let overdueDays: number | null = null;
  if (reminder.dateTrigger) {
    const dueMs = dayStart(new Date(tsToMillis(reminder.dateTrigger.dueDate)));
    effectiveDueMs = dueMs;
    if (dueDayDiff(today, dueMs) > 0) overdueDays = dueDayDiff(today, dueMs);
  }
  let predictedDueMs: number | null = null;
  let remainingDistance: number | null = null;
  if (reminder.odometerTrigger) {
    remainingDistance = reminder.odometerTrigger.dueOdometer - ctx.lastOdometer;
    predictedDueMs = predictDueMs(reminder.odometerTrigger.dueOdometer, ctx.readings, now);
    if (predictedDueMs !== null && (effectiveDueMs === null || predictedDueMs < effectiveDueMs)) {
      effectiveDueMs = predictedDueMs;
    }
  }
  return { status, effectiveDueMs, remainingDistance, predictedDueMs, overdueDays, repeating: isRepeating(reminder) };
}

const dueDayDiff = (a: number, b: number) => Math.round((a - b) / DAY_MS);

/**
 * OQ-47 order: overdue first, then soonest due; odometer reminders with no
 * prediction rank after dated ones; done last.
 */
export function orderReminders<T extends { info: ReminderInfo }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ra = RANK[a.info.status];
    const rb = RANK[b.info.status];
    if (ra !== rb) return ra - rb;
    if (a.info.status === 'done') return 0;
    const ea = a.info.effectiveDueMs ?? Number.MAX_SAFE_INTEGER;
    const eb = b.info.effectiveDueMs ?? Number.MAX_SAFE_INTEGER;
    if (ea !== eb) return ea - eb;
    const remA = a.info.remainingDistance ?? Number.MAX_SAFE_INTEGER;
    const remB = b.info.remainingDistance ?? Number.MAX_SAFE_INTEGER;
    return remA - remB;
  });
}

// --- notification times (RD-03) -------------------------------------------------

export type NotificationKind = 'lead' | 'due' | 'overdue' | 'odoSoon' | 'odoNow';

export interface PlannedNotification {
  kind: NotificationKind;
  /** Epoch ms at which to fire. */
  at: number;
}

export interface PlanContext {
  lastOdometer: number;
  readings: OdometerReading[];
  /** Device-local snooze end (ms epoch); the reminder stays silent until then. */
  snoozedUntilMs?: number;
}

/**
 * The notification plan for one reminder. Date triggers produce lead, due and
 * one overdue notification at 9:00 local — nothing more. Odometer triggers
 * produce a 9:00 notification on the day the predicted remaining distance
 * equals the lead distance, or 'odoNow' when the current reading is already
 * inside the lead window (the caller dedupes this immediate fire). Snoozed
 * and done reminders plan nothing.
 */
export function planNotifications(
  reminder: ReminderDoc,
  ctx: PlanContext,
  now: Date,
): PlannedNotification[] {
  if (reminder.status === 'done') return [];
  if (ctx.snoozedUntilMs !== undefined && ctx.snoozedUntilMs > now.getTime()) return [];
  const out: PlannedNotification[] = [];
  const nowMs = now.getTime();

  const dt = reminder.dateTrigger;
  if (dt) {
    const due = new Date(tsToMillis(dt.dueDate));
    for (const [kind, dayOffset] of [
      ['lead', -reminder.leadDays],
      ['due', 0],
      ['overdue', 1],
    ] as [NotificationKind, number][]) {
      const at = nineOClock(addDays(due, dayOffset)).getTime();
      if (at > nowMs) out.push({ kind, at });
    }
  }

  const ot = reminder.odometerTrigger;
  if (ot) {
    const rate = perDayRate(ctx.readings, now);
    const latest = latestReading(ctx.readings, now);
    const withinLead = ctx.lastOdometer >= ot.dueOdometer - reminder.leadDistance;
    if (withinLead) {
      out.push({ kind: 'odoNow', at: nowMs + 60_000 });
    } else if (rate !== null && latest) {
      // The date on which the predicted remaining distance equals leadDistance.
      const toThreshold = (ot.dueOdometer - reminder.leadDistance - latest.value) / rate;
      const thresholdMs = tsToMillis(latest.date) + toThreshold * DAY_MS;
      const nine = nineOClock(new Date(thresholdMs));
      out.push({ kind: 'odoSoon', at: nine.getTime() > nowMs ? nine.getTime() : nextNine(now).getTime() });
    }
    // No prediction: the schedule is built again when a new reading lands, and
    // 'odoNow' covers the moment a logged/picked-up reading enters the window.
  }
  return out;
}

const nextNine = (now: Date): Date => {
  const todayNine = nineOClock(now);
  return now.getTime() < todayNine.getTime() ? todayNine : nineOClock(addDays(now, 1));
};

/**
 * Apply the RD-12 quota: keep the soonest SCHEDULE_MAX notifications whose
 * fire time is inside the next SCHEDULE_HORIZON_DAYS days.
 */
export function capSchedule<T extends { at: number }>(items: T[], now: Date): T[] {
  const horizon = now.getTime() + SCHEDULE_HORIZON_DAYS * DAY_MS;
  return items
    .filter((n) => n.at <= horizon)
    .sort((a, b) => a.at - b.at)
    .slice(0, SCHEDULE_MAX);
}

// --- snooze (RD-06) --------------------------------------------------------------

export type SnoozeChoice = 'tomorrow' | 'threeDays' | 'nextWeek';

/** The snooze ends at 9:00 local on that day; 'next week' = +7 days. */
export function snoozeEndMs(choice: SnoozeChoice, now: Date): number {
  const days = choice === 'tomorrow' ? 1 : choice === 'threeDays' ? 3 : 7;
  return nineOClock(addDays(now, days)).getTime();
}

export function isSnoozed(snoozedUntilMs: number | undefined, now: Date): boolean {
  return snoozedUntilMs !== undefined && snoozedUntilMs > now.getTime();
}

// --- misc -----------------------------------------------------------------------

/** 'hours' vehicles cannot carry odometer triggers (OQ-11, RD-02). */
export function canUseOdometerTrigger(odometerUnit: string): boolean {
  return odometerUnit !== 'hours';
}

/** EMI-style reminders carry an amount; their taps open the expense form. */
export function opensExpenseForm(reminder: ReminderDoc): boolean {
  return reminder.amountMinor !== undefined;
}

/** The expense category an amount reminder pre-fills (RD-10). */
export function expenseCategoryFor(reminder: ReminderDoc): string {
  return reminder.subject.kind === 'expense' && reminder.subject.category
    ? reminder.subject.category
    : 'Loan EMI'; // i18n-allow — stored category name text (DR-03)
}
