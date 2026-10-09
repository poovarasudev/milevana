// REM-01 — domain tests covering every SC-REM01 scenario and each RD-nn
// decision-derived criterion (matching window D4, roll-forward D5, prediction
// D2, notification times D3, status/ordering D1, hours-vehicle D2).

import { tsFromMillis } from '../../data/schema/common';
import type { ReminderDoc } from '../../data/schema/reminder';
import {
  addMonthsClamped, capSchedule, canUseOdometerTrigger, entryCompletesReminder,
  entryMatchesReminder, isRepeating, orderReminders, perDayRate, planNotifications,
  predictDueMs, reminderInfo, reminderStatus, rollForward, snoozeEndMs, windowReadings,
} from '../reminders';
import type { OdometerReading } from '../entries';

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m, day, h);
const ts = (y: number, m: number, day: number, h = 12) => tsFromMillis(d(y, m, day, h).getTime());
const reading = (y: number, m: number, day: number, value: number): OdometerReading =>
  ({ value, date: ts(y, m, day), createdAt: ts(y, m, day) });

const NOW = d(2026, 9, 7); // 7 Oct 2026 — the scenarios' "today"

const base: ReminderDoc = {
  title: 'Oil change',
  subject: { kind: 'service', serviceType: 'engine_oil' },
  leadDays: 7,
  leadDistance: 500,
  status: 'active',
  createdBy: 'me',
  createdAt: ts(2026, 9, 1),
  updatedAt: ts(2026, 9, 1),
  schemaVersion: 1,
};
const rem = (over: Partial<ReminderDoc>): ReminderDoc => ({ ...base, ...over });

const serviceEntry = (lines: { serviceType: string }[], date = ts(2026, 9, 5)) => ({
  type: 'service', date, details: { lines: lines.map((l, i) => ({ id: `l${i}`, costMinor: 0, ...l })) },
});
const expenseEntry = (category: string, date = ts(2026, 9, 5)) => ({ type: 'expense', date, category });

// --- SC-REM01-01 / matching ---------------------------------------------------

describe('entryMatchesReminder (SC-REM01-01)', () => {
  it('service line of the type matches; expense category matches; custom never', () => {
    const svc = rem({});
    expect(entryMatchesReminder(serviceEntry([{ serviceType: 'engine_oil' }]), svc)).toBe(true);
    expect(entryMatchesReminder(serviceEntry([{ serviceType: 'tyres' }]), svc)).toBe(false);

    const exp = rem({ subject: { kind: 'expense', category: 'Insurance' } });
    expect(entryMatchesReminder(expenseEntry('Insurance'), exp)).toBe(true);
    expect(entryMatchesReminder(expenseEntry('Parking'), exp)).toBe(false);
    expect(entryMatchesReminder(serviceEntry([{ serviceType: 'engine_oil' }]), exp)).toBe(false);

    const custom = rem({ subject: { kind: 'custom' } });
    expect(entryMatchesReminder(serviceEntry([{ serviceType: 'engine_oil' }]), custom)).toBe(false);
    expect(entryMatchesReminder(expenseEntry('Wash'), custom)).toBe(false);
  });

  it("'Other' lines never match (RD-04)", () => {
    const other = rem({ subject: { kind: 'service', serviceType: 'other' } });
    expect(entryMatchesReminder(serviceEntry([{ serviceType: 'other' }]), other)).toBe(false);
  });

  it("a service entry's own category alone does not match (RD-04)", () => {
    const exp = rem({ subject: { kind: 'expense', category: 'Engine oil' } });
    expect(entryMatchesReminder({ ...serviceEntry([{ serviceType: 'tyres' }]), category: 'Engine oil' }, exp)).toBe(false);
  });
});

describe('entryCompletesReminder window (SC-REM01-02, D4)', () => {
  const r = rem({ subject: { kind: 'expense', category: 'Insurance' }, createdAt: ts(2026, 9, 1, 15) });
  it('entry dated before creation does not match; on/after does', () => {
    expect(entryCompletesReminder(expenseEntry('Insurance', ts(2026, 8, 30)), r)).toBe(false);
    expect(entryCompletesReminder(expenseEntry('Insurance', ts(2026, 9, 1, 8)), r)).toBe(true); // same day
    expect(entryCompletesReminder(expenseEntry('Insurance', ts(2026, 9, 2)), r)).toBe(true);
  });
  it('a done reminder is not completed again', () => {
    expect(entryCompletesReminder(expenseEntry('Insurance'), rem({ ...r, status: 'done' }))).toBe(false);
  });
});

// --- SC-REM01-03 / roll-forward ------------------------------------------------

describe('rollForward (SC-REM01-03, D5)', () => {
  it('clamps month arithmetic to the last day of the month', () => {
    expect(addMonthsClamped(d(2026, 0, 31), 1)).toEqual(d(2026, 1, 28)); // not a leap year
    expect(addMonthsClamped(d(2028, 0, 31), 1)).toEqual(d(2028, 1, 29)); // leap year
    expect(addMonthsClamped(d(2026, 2, 31), 1)).toEqual(d(2026, 3, 30));
    expect(addMonthsClamped(d(2026, 0, 15), 1)).toEqual(d(2026, 1, 15));
  });

  const repeating = rem({
    dateTrigger: { dueDate: ts(2026, 2, 1), repeatEveryMonths: 12 },
    odometerTrigger: { dueOdometer: 50_000, repeatEveryDistance: 10_000 },
  });

  it('a repeating reminder rolls both triggers from the completing entry', () => {
    const out = rollForward(repeating, {
      date: ts(2027, 2, 1), odometer: 52_000, lastOdometer: 51_000,
      completedAt: ts(2027, 2, 1), entryId: 'e1',
    });
    expect(out.status).toBe('active');
    expect(out.dateTrigger).toEqual({ dueDate: ts(2028, 2, 1), repeatEveryMonths: 12 });
    expect(out.odometerTrigger).toEqual({ dueOdometer: 62_000, repeatEveryDistance: 10_000 });
    expect(out.completedByEntryId).toBe('e1');
    expect(out.completedAt).toEqual(ts(2027, 2, 1));
  });

  it('an entry without an odometer rolls the odometer trigger from lastOdometer', () => {
    const out = rollForward(repeating, {
      date: ts(2027, 2, 1), lastOdometer: 51_000,
      completedAt: ts(2027, 2, 1), entryId: 'e2',
    });
    expect(out.odometerTrigger).toEqual({ dueOdometer: 61_000, repeatEveryDistance: 10_000 });
  });

  it('a one-off reminder becomes done and keeps its triggers as the record', () => {
    const oneOff = rem({ dateTrigger: { dueDate: ts(2026, 2, 1) }, odometerTrigger: { dueOdometer: 50_000 } });
    const out = rollForward(oneOff, { date: ts(2026, 2, 1), odometer: 52_000, lastOdometer: 51_000, completedAt: ts(2026, 2, 1), entryId: 'e3' });
    expect(out.status).toBe('done');
    expect(out.dateTrigger).toBeUndefined();
    expect(out.odometerTrigger).toBeUndefined();
    expect(out.completedByEntryId).toBe('e3');
  });

  it('a one-off trigger on a mixed reminder is dropped when the other repeats', () => {
    const mixed = rem({
      dateTrigger: { dueDate: ts(2026, 2, 1), repeatEveryMonths: 6 },
      odometerTrigger: { dueOdometer: 50_000 }, // one-off
    });
    const out = rollForward(mixed, { date: ts(2026, 2, 1), odometer: 50_500, lastOdometer: 50_000, completedAt: ts(2026, 2, 1), entryId: 'e4' });
    expect(out.status).toBe('active');
    expect(out.dateTrigger).toEqual({ dueDate: ts(2026, 8, 1), repeatEveryMonths: 6 });
    expect(out.odometerTrigger).toBeNull();
  });

  it('Mark done on a repeating reminder rolls from today + lastOdometer', () => {
    const out = rollForward(repeating, { date: ts(2026, 9, 7), lastOdometer: 48_000, completedAt: ts(2026, 9, 7) });
    expect(out.status).toBe('active');
    expect(out.dateTrigger!.dueDate).toEqual(ts(2027, 9, 7));
    expect(out.odometerTrigger!.dueOdometer).toBe(58_000);
    expect(out.completedByEntryId).toBeNull();
  });

  it('isRepeating detects either trigger', () => {
    expect(isRepeating(repeating)).toBe(true);
    expect(isRepeating(rem({ dateTrigger: { dueDate: ts(2027, 0, 1) } }))).toBe(false);
  });
});

// --- SC-REM01-04 / prediction ---------------------------------------------------

describe('prediction (SC-REM01-04, D2)', () => {
  const readings = [reading(2026, 7, 1, 40_000), reading(2026, 8, 30, 41_800)];

  it('(largest − smallest) / days between, ≥2 readings spanning ≥7 days', () => {
    expect(perDayRate(readings, NOW)).toBeCloseTo(30); // 1800/60
    expect(predictDueMs(42_500, readings, NOW)).not.toBeNull();
    // 30 Sep + 700/30 ≈ 23.3 days → ~23 Oct
    const pred = new Date(predictDueMs(42_500, readings, NOW)!);
    expect(pred.getMonth()).toBe(9);
    expect(pred.getDate()).toBe(23);
  });

  it('readings 5 days apart → no prediction; single reading → none', () => {
    const close = [reading(2026, 9, 1, 40_000), reading(2026, 9, 6, 40_300)];
    expect(perDayRate(close, NOW)).toBeNull();
    expect(predictDueMs(42_500, close, NOW)).toBeNull();
    expect(perDayRate([reading(2026, 8, 1, 40_000)], NOW)).toBeNull();
    expect(predictDueMs(42_500, [reading(2026, 8, 1, 40_000)], NOW)).toBeNull();
  });

  it('readings outside the 90-day window do not count', () => {
    const old = [reading(2026, 4, 1, 40_000), reading(2026, 4, 20, 41_000)];
    expect(windowReadings(old, NOW)).toHaveLength(0);
    expect(perDayRate(old, NOW)).toBeNull();
    // one in-window + one out-of-window is still only one reading
    const mixed = [reading(2026, 4, 1, 40_000), reading(2026, 8, 30, 41_800)];
    expect(perDayRate(mixed, NOW)).toBeNull();
  });

  it('already-past due predicts "now"; flat odometer gives no rate', () => {
    const flat = [reading(2026, 7, 1, 40_000), reading(2026, 8, 30, 40_000)];
    expect(perDayRate(flat, NOW)).toBeNull();
    const big = [reading(2026, 7, 1, 40_000), reading(2026, 8, 30, 43_000)];
    expect(predictDueMs(42_500, big, NOW)).toBe(NOW.getTime());
  });

  it('hours vehicles cannot use odometer triggers (OQ-11)', () => {
    expect(canUseOdometerTrigger('hours')).toBe(false);
    expect(canUseOdometerTrigger('km')).toBe(true);
    expect(canUseOdometerTrigger('mi')).toBe(true);
  });
});

// --- SC-REM01-05 / notification times -------------------------------------------

describe('planNotifications (SC-REM01-05, D3)', () => {
  const dateRem = rem({ dateTrigger: { dueDate: ts(2026, 10, 20) }, leadDays: 7 });

  it('lead at 9:00 7 days before, due at 9:00, overdue at 9:00 next day — nothing else', () => {
    const plan = planNotifications(dateRem, { lastOdometer: 0, readings: [] }, NOW);
    expect(plan.map((p) => p.kind)).toEqual(['lead', 'due', 'overdue']);
    const at = (k: string) => new Date(plan.find((p) => p.kind === k)!.at);
    expect(at('lead')).toEqual(new Date(2026, 10, 13, 9, 0, 0));
    expect(at('due')).toEqual(new Date(2026, 10, 20, 9, 0, 0));
    expect(at('overdue')).toEqual(new Date(2026, 10, 21, 9, 0, 0));
  });

  it('skips times already past; due-today reminder only schedules what remains', () => {
    const now = d(2026, 10, 20, 10); // 10:00 on the due date — the 9:00 slots are past
    const plan = planNotifications(dateRem, { lastOdometer: 0, readings: [] }, now);
    expect(plan.map((p) => p.kind)).toEqual(['overdue']);
  });

  it('leadDays is adjustable', () => {
    const r = rem({ dateTrigger: { dueDate: ts(2026, 10, 20) }, leadDays: 2 });
    const plan = planNotifications(r, { lastOdometer: 0, readings: [] }, NOW);
    expect(new Date(plan.find((p) => p.kind === 'lead')!.at)).toEqual(new Date(2026, 10, 18, 9));
  });

  it('predicted odometer reminder fires at 9:00 on the threshold-crossing day', () => {
    // rate 30/day, latest 41,800 on 30 Sep; due 42,500, lead 500 → threshold at
    // remaining 500: (42500-500-41800)/30 = 6.67 days after 30 Sep → 7 Oct 9:00
    const r = rem({ odometerTrigger: { dueOdometer: 42_500 }, leadDistance: 500 });
    const readings = [reading(2026, 7, 1, 40_000), reading(2026, 8, 30, 41_800)];
    const plan = planNotifications(r, { lastOdometer: 41_800, readings }, d(2026, 9, 1));
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('odoSoon');
    const at = new Date(plan[0].at);
    expect(at.getHours()).toBe(9);
  });

  it('within lead distance → immediate alert; past due counts as within lead', () => {
    const r = rem({ odometerTrigger: { dueOdometer: 42_500 }, leadDistance: 500 });
    const plan = planNotifications(r, { lastOdometer: 42_100, readings: [] }, NOW);
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe('odoNow');
    const past = planNotifications(r, { lastOdometer: 43_000, readings: [] }, NOW);
    expect(past[0].kind).toBe('odoNow');
  });

  it('no prediction and outside lead → nothing scheduled', () => {
    const r = rem({ odometerTrigger: { dueOdometer: 50_000 }, leadDistance: 500 });
    expect(planNotifications(r, { lastOdometer: 40_000, readings: [] }, NOW)).toHaveLength(0);
  });

  it('snoozed reminder plans nothing; done plans nothing', () => {
    const ctx = { lastOdometer: 0, readings: [], snoozedUntilMs: NOW.getTime() + DAY_MS_() };
    expect(planNotifications(dateRem, ctx, NOW)).toHaveLength(0);
    // snooze already ended → normal plan
    expect(planNotifications(dateRem, { ...ctx, snoozedUntilMs: NOW.getTime() - 1 }, NOW)).toHaveLength(3);
    expect(planNotifications(rem({ ...dateRem, status: 'done' }), { lastOdometer: 0, readings: [] }, NOW)).toHaveLength(0);
  });

  it('capSchedule keeps the soonest 60 within the next 60 days (RD-12)', () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ at: NOW.getTime() + (i + 1) * 86_400_000 / 2 }));
    const capped = capSchedule(items, NOW);
    expect(capped.length).toBeLessThanOrEqual(60);
    expect(capped.every((n) => n.at <= NOW.getTime() + 60 * 86_400_000)).toBe(true);
    // sorted ascending
    expect(capped.map((n) => n.at)).toEqual([...capped.map((n) => n.at)].sort((a, b) => a - b));
  });
});

function DAY_MS_() { return 86_400_000; }

// --- SC-REM01-06 / status + ordering --------------------------------------------

describe('reminderStatus (SC-REM01-06, D1)', () => {
  it('date reminder: due today / overdue from the next day / due soon inside lead', () => {
    const ctx = { lastOdometer: 0 };
    expect(reminderStatus(rem({ dateTrigger: { dueDate: ts(2026, 9, 7, 8) } }), ctx, NOW)).toBe('dueToday');
    expect(reminderStatus(rem({ dateTrigger: { dueDate: ts(2026, 9, 6, 23) } }), ctx, NOW)).toBe('overdue');
    expect(reminderStatus(rem({ dateTrigger: { dueDate: ts(2026, 9, 12) } }), ctx, NOW)).toBe('dueSoon'); // 5d ≤ lead 7
    expect(reminderStatus(rem({ dateTrigger: { dueDate: ts(2026, 10, 20) } }), ctx, NOW)).toBe('upcoming');
    expect(reminderStatus(rem({ dateTrigger: { dueDate: ts(2026, 9, 6) }, status: 'done' }), ctx, NOW)).toBe('done');
  });

  it('odometer reminder: overdue at/past due; due soon inside lead distance', () => {
    const r = rem({ odometerTrigger: { dueOdometer: 42_500 }, leadDistance: 500, dateTrigger: undefined });
    expect(reminderStatus(r, { lastOdometer: 42_500 }, NOW)).toBe('overdue');
    expect(reminderStatus(r, { lastOdometer: 42_100 }, NOW)).toBe('dueSoon');
    expect(reminderStatus(r, { lastOdometer: 41_000 }, NOW)).toBe('upcoming');
    // a predicted date passing alone does NOT make it overdue
    expect(reminderStatus(r, { lastOdometer: 41_000 }, NOW)).not.toBe('overdue');
  });

  it('both triggers: most urgent wins', () => {
    const r = rem({
      dateTrigger: { dueDate: ts(2026, 10, 20) },
      odometerTrigger: { dueOdometer: 42_500 },
    });
    expect(reminderStatus(r, { lastOdometer: 42_600 }, NOW)).toBe('overdue');
    expect(reminderStatus(r, { lastOdometer: 40_000 }, NOW)).toBe('upcoming');
  });
});

describe('orderReminders (SC-REM01-06, OQ-47)', () => {
  it('overdue first, then soonest due, unpredicted odometer last, done last', () => {
    const ctx = { lastOdometer: 41_000, readings: [] as OdometerReading[] };
    const rows = [
      { r: rem({ dateTrigger: { dueDate: ts(2026, 10, 1) } }), tag: 'nov' },
      { r: rem({ dateTrigger: { dueDate: ts(2026, 9, 1) } }), tag: 'overdue' },
      { r: rem({ odometerTrigger: { dueOdometer: 50_000 } }), tag: 'odo-nopred' },
      { r: rem({ dateTrigger: { dueDate: ts(2026, 9, 10) } }), tag: 'oct10' },
      { r: rem({ dateTrigger: { dueDate: ts(2026, 9, 2) }, status: 'done' }), tag: 'done' },
    ].map((x) => ({ ...x, info: reminderInfo(x.r, ctx, NOW) }));
    const ordered = orderReminders(rows).map((x) => x.tag);
    expect(ordered).toEqual(['overdue', 'oct10', 'nov', 'odo-nopred', 'done']);
  });

  it('a predicted odometer reminder sorts by its predicted date', () => {
    // predicted due ≈ 23 Oct — between the two dated ones
    const ctx = { lastOdometer: 41_800, readings: [reading(2026, 7, 1, 40_000), reading(2026, 8, 30, 41_800)] };
    const rows = [
      { r: rem({ dateTrigger: { dueDate: ts(2026, 10, 20) } }), tag: 'nov20' },
      { r: rem({ dateTrigger: { dueDate: ts(2026, 9, 10) } }), tag: 'oct10' },
      { r: rem({ odometerTrigger: { dueOdometer: 42_500 }, leadDistance: 0 }), tag: 'odo-pred' },
    ].map((x) => ({ ...x, info: reminderInfo(x.r, ctx, NOW) }));
    const ordered = orderReminders(rows).map((x) => x.tag);
    expect(ordered).toEqual(['oct10', 'odo-pred', 'nov20']);
  });
});

// --- snooze (RD-06) ---------------------------------------------------------------

describe('snoozeEndMs (SC-REM07-02, D2)', () => {
  it('tomorrow / 3 days / next week each end at 9:00 local', () => {
    const now = d(2026, 9, 7, 14);
    expect(new Date(snoozeEndMs('tomorrow', now))).toEqual(new Date(2026, 9, 8, 9));
    expect(new Date(snoozeEndMs('threeDays', now))).toEqual(new Date(2026, 9, 10, 9));
    expect(new Date(snoozeEndMs('nextWeek', now))).toEqual(new Date(2026, 9, 14, 9));
  });
});
