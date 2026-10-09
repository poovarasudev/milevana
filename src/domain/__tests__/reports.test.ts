// RPT-02 / RPT-03 — pure report metrics: the six ranges, distance, cost,
// section figures and the Dashboard numbers. Fixtures follow
// docs/reports-test-scenarios.md, especially fixture "A".
//
// Fixture A: INR vehicle on km, created 1 Jan 2026, startOdometer 10,000.
// Readings 15 Aug 12,000 and 28 Sep 12,900. September entries: fuel 3,000,
// service 4,500, expense 1,500 (cost 9,000); income 20,000; one business
// trip with reimbursement 600. "Today" is 7 Oct 2026.

import { tsFromMillis, type Timestamp } from '../../data/schema/common';
import {
  aggregateReports, costPerDay, costPerKm, costSplit, dashboardFigures,
  inPeriod, isBiFuel, periodDays, periodDistance, resolveRange,
  vehicleReport, type ReportEntryLike, type ReportVehicleLike,
} from '../reports';

const ts = (y: number, mo: number, d: number, h = 0, mi = 0): Timestamp =>
  tsFromMillis(new Date(y, mo - 1, d, h, mi).getTime());

const NOW = new Date(2026, 9, 7, 15, 30); // 7 Oct 2026

const vehicle = (over: Partial<ReportVehicleLike> = {}): ReportVehicleLike => ({
  id: 'v1', name: 'Car', currency: 'INR', odometerUnit: 'km',
  fuelTypes: ['petrol'], startOdometer: 10_000,
  createdAt: ts(2026, 1, 1, 9), archived: false, ...over,
});

let seq = 0;
const entry = (over: Partial<ReportEntryLike>): ReportEntryLike => ({
  id: `e${++seq}`, type: 'expense', date: ts(2026, 9, 15), createdAt: ts(2026, 9, 15),
  ...over,
});

const costEntry = (type: 'fuel' | 'service' | 'expense' | 'income', minor: number, over: Partial<ReportEntryLike> = {}) =>
  entry({ type, amount: { minor, currency: 'INR' }, category: over.category ?? 'Parking', ...over });

// Fixture A entries
const fixtureA = (): { v: ReportVehicleLike; entries: ReportEntryLike[] } => ({
  v: vehicle(),
  entries: [
    // readings 15 Aug 12,000 / 28 Sep 12,900 live on fuel entries
    entry({ type: 'fuel', date: ts(2026, 8, 15), createdAt: ts(2026, 8, 15), odometer: 12_000, amount: { minor: 200_000, currency: 'INR' }, details: { fuelType: 'petrol', quantity: 20, quantityUnit: 'L', pricePerUnitMilli: 100_000, fullTank: true, missedPrevious: false } }),
    entry({ type: 'fuel', date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10), odometer: 12_900, amount: { minor: 300_000, currency: 'INR' }, details: { fuelType: 'petrol', quantity: 30, quantityUnit: 'L', pricePerUnitMilli: 100_000, fullTank: true, missedPrevious: false } }),
    entry({ type: 'service', date: ts(2026, 9, 5), createdAt: ts(2026, 9, 5), amount: { minor: 450_000, currency: 'INR' }, category: 'General service', details: { lines: [{ id: 'l1', serviceType: 'general_service', costMinor: 450_000 }] } }),
    entry({ type: 'expense', date: ts(2026, 9, 12), createdAt: ts(2026, 9, 12), amount: { minor: 150_000, currency: 'INR' }, category: 'Parking' }),
    entry({ type: 'income', date: ts(2026, 9, 20), createdAt: ts(2026, 9, 20), amount: { minor: 2_000_000, currency: 'INR' }, category: 'Ride-hailing', details: { platform: 'Uber' } }),
    entry({ type: 'trip', date: ts(2026, 9, 8), createdAt: ts(2026, 9, 8), odometer: 12_200, details: { startAt: ts(2026, 9, 8), endAt: ts(2026, 9, 8, 2), startOdometer: 12_080, endOdometer: 12_200, distance: 120, from: 'A', to: 'B', purpose: 'business', ratePerUnitMilli: 5_000, reimbursementMinor: 60_000 } }),
  ],
});

const SEP = resolveRange('custom', {
  now: NOW,
  custom: { start: new Date(2026, 8, 1), end: new Date(2026, 8, 30) },
})!;

// Bi-fuel fills shared by the fuel, dashboard and aggregation tests:
// petrol full 40 L @12,000 · petrol partial 10 L @12,300 ·
// petrol full 40 L @12,800 (mileage 16) · CNG full 5 kg @12,900.
const fills = (): ReportEntryLike[] => [
  entry({ type: 'fuel', date: ts(2026, 8, 1), createdAt: ts(2026, 8, 1), odometer: 12_000, amount: { minor: 200_000, currency: 'INR' }, details: { fuelType: 'petrol', quantity: 40, quantityUnit: 'L', pricePerUnitMilli: 50_000, fullTank: true, missedPrevious: false } }),
  entry({ type: 'fuel', date: ts(2026, 8, 15), createdAt: ts(2026, 8, 15), odometer: 12_300, amount: { minor: 50_000, currency: 'INR' }, details: { fuelType: 'petrol', quantity: 10, quantityUnit: 'L', pricePerUnitMilli: 50_000, fullTank: false, missedPrevious: false } }),
  entry({ type: 'fuel', date: ts(2026, 9, 1), createdAt: ts(2026, 9, 1), odometer: 12_800, amount: { minor: 400_000, currency: 'INR' }, details: { fuelType: 'petrol', quantity: 40, quantityUnit: 'L', pricePerUnitMilli: 100_000, fullTank: true, missedPrevious: false } }),
  entry({ type: 'fuel', date: ts(2026, 9, 5), createdAt: ts(2026, 9, 5), odometer: 12_900, amount: { minor: 80_000, currency: 'INR' }, details: { fuelType: 'cng', quantity: 5, quantityUnit: 'kg', pricePerUnitMilli: 16_000, fullTank: true, missedPrevious: false } }),
];

// --- SC-RPT02-01 — ranges -----------------------------------------------------

describe('resolveRange (RPT-02 #1, PD-01)', () => {
  test('This month covers 1–7 October with local day boundaries', () => {
    const p = resolveRange('this_month', { now: NOW })!;
    expect(new Date(p.startMs)).toEqual(new Date(2026, 9, 1, 0, 0, 0, 0));
    expect(p.endMs).toBe(new Date(2026, 9, 7, 23, 59, 59, 999).getTime());
  });

  test('Last 3 months and Last 12 months roll back the same day, inclusive', () => {
    const p3 = resolveRange('last_3_months', { now: NOW })!;
    expect(new Date(p3.startMs)).toEqual(new Date(2026, 6, 7));
    expect(p3.endMs).toBe(new Date(2026, 9, 7, 23, 59, 59, 999).getTime());
    const p12 = resolveRange('last_12_months', { now: NOW })!;
    expect(new Date(p12.startMs)).toEqual(new Date(2025, 9, 7));
    expect(p12.endMs).toBe(new Date(2026, 9, 7, 23, 59, 59, 999).getTime());
  });

  test('This financial year runs from the most recent 1 April', () => {
    const p = resolveRange('financial_year', { now: NOW })!;
    expect(new Date(p.startMs)).toEqual(new Date(2026, 3, 1));
    const feb = resolveRange('financial_year', { now: new Date(2027, 1, 15) })!;
    expect(new Date(feb.startMs)).toEqual(new Date(2026, 3, 1));
    const apr = resolveRange('financial_year', { now: new Date(2027, 3, 1) })!;
    expect(new Date(apr.startMs)).toEqual(new Date(2027, 3, 1));
    const mar = resolveRange('financial_year', { now: new Date(2026, 2, 31, 23, 30) })!;
    expect(new Date(mar.startMs)).toEqual(new Date(2025, 3, 1));
  });

  test('All time starts at vehicle creation', () => {
    const p = resolveRange('all_time', { now: NOW, createdAt: ts(2026, 1, 1, 9) })!;
    expect(p.startMs).toBe(new Date(2026, 0, 1).getTime());
    expect(p.endMs).toBe(new Date(2026, 9, 7, 23, 59, 59, 999).getTime());
  });

  test('custom rejects a start after its end and applies day boundaries', () => {
    expect(resolveRange('custom', {
      now: NOW,
      custom: { start: new Date(2026, 9, 10), end: new Date(2026, 9, 5) },
    })).toBeNull();
    const p = resolveRange('custom', {
      now: NOW,
      custom: { start: new Date(2026, 9, 2, 18), end: new Date(2026, 9, 5, 2) },
    })!;
    expect(p.startMs).toBe(new Date(2026, 9, 2).getTime());
    expect(p.endMs).toBe(new Date(2026, 9, 5, 23, 59, 59, 999).getTime());
  });

  test('inPeriod is inclusive of both boundary days', () => {
    const p = SEP;
    expect(inPeriod(ts(2026, 9, 1, 0, 0), p)).toBe(true);
    expect(inPeriod(ts(2026, 9, 30, 23, 59), p)).toBe(true);
    expect(inPeriod(ts(2026, 8, 31, 23, 59), p)).toBe(false);
    expect(inPeriod(ts(2026, 10, 1, 0, 0), p)).toBe(false);
  });
});

// --- SC-RPT02-02 / 03 / 04 / 05 — distance & cost ------------------------------

describe('distance and cost (RPT-02 #2 #3, OQ-48)', () => {
  test('fixture A, 1–30 Sep: last in-period reading minus last before = 900', () => {
    const { v, entries } = fixtureA();
    expect(periodDistance(entries, SEP, v)).toBe(900);
  });

  test('all-time distance = last reading − starting odometer = 2,900', () => {
    const { v, entries } = fixtureA();
    const p = resolveRange('all_time', { now: NOW, createdAt: v.createdAt })!;
    expect(periodDistance(entries, p, v)).toBe(2_900);
  });

  test('trip start and end odometers count as readings', () => {
    const { v, entries } = fixtureA();
    // Range containing only the trip (5–9 Sep): its start and end odometers
    // are the only in-period readings.
    const p = resolveRange('custom', {
      now: NOW,
      custom: { start: new Date(2026, 8, 5), end: new Date(2026, 8, 9) },
    })!;
    expect(periodDistance(entries, p, v)).toBe(12_200 - 12_000);
  });

  test('cost excludes income and trip reimbursements; cost per km/day', () => {
    const { v, entries } = fixtureA();
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.overview.costMinor).toBe(9_000 * 100);
    expect(r.overview.costPerKmByUnit.km).toBe(1_000); // 9,000 / 900 = ₹10.00
    expect(costPerDay(9_000 * 100, SEP, v.createdAt, NOW)).toBe(300 * 100);
    expect(r.overview.costPerDayMinor).toBe(300 * 100);
    expect(costPerKm(9_000 * 100, 900)).toBe(1_000);
  });
});

describe('distance edge cases (RPT-02 D4, PD-02)', () => {
  test('no readings, one reading, negative and zero all give no distance', () => {
    const v = vehicle();
    // no in-period reading at all (startOdometer is before the range)
    expect(periodDistance([], SEP, v)).toBeUndefined();
    // only the startOdometer exists, inside the period → one reading
    const fresh = vehicle({ createdAt: ts(2026, 9, 5), startOdometer: 10_000 });
    expect(periodDistance([], SEP, fresh)).toBeUndefined();
    // a single in-period reading still computes against the last reading
    // before the period (the start odometer, literal OQ-48 rule)
    const one = [entry({ odometer: 12_500, date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10) })];
    const p = resolveRange('custom', { now: NOW, custom: { start: new Date(2026, 8, 5), end: new Date(2026, 9, 30) } })!;
    expect(periodDistance(one, p, v)).toBe(2_500);
    // back-dated reading makes the result negative
    const neg = [
      entry({ odometer: 13_000, date: ts(2026, 8, 20), createdAt: ts(2026, 8, 20) }),
      entry({ odometer: 12_500, date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10) }),
    ];
    expect(periodDistance(neg, SEP, v)).toBeUndefined();
    // two identical readings → zero distance
    const zero = [
      entry({ odometer: 13_000, date: ts(2026, 8, 20), createdAt: ts(2026, 8, 20) }),
      entry({ odometer: 13_000, date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10) }),
    ];
    expect(periodDistance(zero, SEP, v)).toBeUndefined();
  });

  test('a vehicle created inside the range uses its start odometer as baseline', () => {
    const v = vehicle({ createdAt: ts(2026, 9, 5), startOdometer: 10_000 });
    const entries = [entry({ odometer: 10_500, date: ts(2026, 9, 6), createdAt: ts(2026, 9, 6) })];
    expect(periodDistance(entries, SEP, v)).toBe(500);
  });

  test('cost per day counts from vehicle creation and stops at today', () => {
    const v = vehicle();
    const before = resolveRange('custom', {
      now: NOW, custom: { start: new Date(2025, 11, 1), end: new Date(2026, 0, 31) },
    })!;
    // created 1 Jan → 31 days counted (1–31 Jan), not 62
    expect(periodDays(before, v.createdAt, NOW)).toBe(31);
    const future = resolveRange('custom', {
      now: NOW, custom: { start: new Date(2026, 9, 1), end: new Date(2026, 11, 31) },
    })!;
    // ends in the future → counts 1–7 Oct only
    expect(periodDays(future, v.createdAt, NOW)).toBe(7);
  });

  test('a range before the vehicle existed counts days from creation', () => {
    const v = vehicle({ createdAt: ts(2026, 1, 20) });
    const p = resolveRange('custom', {
      now: NOW, custom: { start: new Date(2026, 0, 1), end: new Date(2026, 0, 31) },
    })!;
    expect(periodDays(p, v.createdAt, NOW)).toBe(12); // 20–31 Jan inclusive
  });
});

describe('grouping and hours vehicles (RPT-02 #4 #5, OQ-11/OQ-19)', () => {
  test('an hours vehicle produces no distance-based figure', () => {
    const v = vehicle({ odometerUnit: 'hours' });
    const entries = [
      costEntry('fuel', 500 * 100, { date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10), odometer: 60, category: undefined }),
      costEntry('fuel', 300 * 100, { date: ts(2026, 9, 20), createdAt: ts(2026, 9, 20), odometer: 90, category: undefined }),
    ];
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.overview.distanceByUnit.hours).toBeUndefined();
    expect(r.overview.costPerKmByUnit).toEqual({});
    expect(r.overview.costMinor).toBe(800 * 100);
    expect(r.overview.costPerDayMinor).toBeDefined();
  });

  test('totals stay per currency and distance per odometer unit', () => {
    const inrKm = vehicle();
    const usdMi = vehicle({ id: 'v2', name: 'Truck', currency: 'USD', odometerUnit: 'mi', createdAt: ts(2026, 1, 1), startOdometer: 5_000 });
    const e1 = fixtureA().entries;
    const e2 = [
      entry({ type: 'expense', date: ts(2026, 9, 5), createdAt: ts(2026, 9, 5), odometer: 5_600, amount: { minor: 2_000, currency: 'USD' }, category: 'Parking' }),
      entry({ type: 'expense', date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10), odometer: 5_800, amount: { minor: 1_000, currency: 'USD' }, category: 'Tolls' }),
    ];
    const blocks = aggregateReports([
      vehicleReport(inrKm, e1, SEP, { now: NOW }),
      vehicleReport(usdMi, e2, SEP, { now: NOW }),
    ]);
    expect(blocks.map((b) => b.currency).sort()).toEqual(['INR', 'USD']);
    const usd = blocks.find((b) => b.currency === 'USD')!;
    expect(usd.overview.distanceByUnit.mi).toBe(800);
    expect(usd.overview.costPerKmByUnit.mi).toBeCloseTo(3_000 / 800, 5); // minor per mi
    const inr = blocks.find((b) => b.currency === 'INR')!;
    expect(inr.overview.distanceByUnit.km).toBe(900);
  });
});

// --- SC-RPT03 — section metrics ----------------------------------------------

describe('cost split and monthly spend (RPT-03 #1)', () => {
  test('fuel + service + expense sums to total cost', () => {
    const { entries } = fixtureA();
    const split = costSplit(entries, SEP);
    expect(split).toEqual({ fuel: 300_000, service: 450_000, expense: 150_000 });
    expect(split.fuel + split.service + split.expense).toBe(900_000);
  });

  test('monthly spend gives one bucket per calendar month in the range', () => {
    const { entries } = fixtureA();
    const p = resolveRange('custom', {
      now: NOW, custom: { start: new Date(2026, 7, 1), end: new Date(2026, 9, 31) },
    })!;
    const r = vehicleReport(vehicle(), entries, p, { now: NOW });
    expect(r.monthly.map((m) => `${m.year}-${m.month}`)).toEqual(['2026-8', '2026-9', '2026-10']);
    const sep = r.monthly[1];
    expect(sep.fuel + sep.service + sep.expense).toBe(900_000);
    expect(r.monthly[0].fuel).toBe(200_000); // the Aug fill
    const total = r.monthly.reduce((s, m) => s + m.fuel + m.service + m.expense, 0);
    expect(total).toBe(r.overview.costMinor);
  });
});

describe('income & profit (RPT-03 #2 #3, OQ-44/OQ-48, PD-05)', () => {
  test('net profit excludes trip reimbursement; reimbursement income counts', () => {
    const { v, entries } = fixtureA();
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.income).not.toBeNull();
    expect(r.income!.incomeMinor).toBe(2_000_000);
    expect(r.income!.costMinor).toBe(900_000);
    expect(r.income!.netMinor).toBe(1_100_000);
    expect(r.income!.profitPerKmByUnit.km).toBeCloseTo(1_100_000 / 900, 5); // ₹12.22/km
  });

  test('an income entry categorised "Reimbursement" counts as income', () => {
    const { v, entries } = fixtureA();
    const extra = costEntry('income', 50_000, { date: ts(2026, 9, 22), createdAt: ts(2026, 9, 22), category: 'Reimbursement' });
    const r = vehicleReport(v, [...entries, extra], SEP, { now: NOW });
    expect(r.income!.incomeMinor).toBe(2_050_000);
  });

  test('the section exists only when an income entry exists anywhere in time', () => {
    const v = vehicle();
    const noIncome = fixtureA().entries.filter((e) => e.type !== 'income');
    expect(vehicleReport(v, noIncome, SEP, { now: NOW }).income).toBeNull();
    // income outside the chosen period still makes the section exist
    const oldIncome = [costEntry('income', 100, { date: ts(2026, 0, 5), createdAt: ts(2026, 0, 5) })];
    const r = vehicleReport(v, [...noIncome, ...oldIncome], SEP, { now: NOW });
    expect(r.income).not.toBeNull();
    expect(r.income!.incomeMinor).toBe(0); // nothing in the period
  });

  test('income with no platform groups as "Not specified"', () => {
    const { v, entries } = fixtureA();
    const noPlatform = costEntry('income', 70_000, { date: ts(2026, 9, 21), createdAt: ts(2026, 9, 21), category: 'Delivery', details: {} });
    const r = vehicleReport(v, [...entries, noPlatform], SEP, { now: NOW });
    const platforms = Object.fromEntries(r.income!.platforms.map((p) => [p.platform, p.minor]));
    expect(platforms['Uber']).toBe(2_000_000);
    expect(platforms['Not specified']).toBe(70_000);
  });
});

describe('fuel section (RPT-03, PD-03, OQ-42)', () => {
  test('mileage trend has one point per fill with mileage, one series per fuel', () => {
    const v = vehicle({ fuelTypes: ['petrol', 'cng'] });
    const entries = fills();
    const p = resolveRange('all_time', { now: NOW, createdAt: v.createdAt })!;
    const r = vehicleReport(v, entries, p, { now: NOW });
    const petrol = r.fuel.mileage.find((s) => s.fuelType === 'petrol')!;
    // first petrol fill has no mileage; the second full fill does
    // (12,800 − 12,000) / (10 + 40) = 16 km/l
    expect(petrol.points).toHaveLength(1);
    expect(petrol.points[0].value).toBeCloseTo(16, 5);
    expect(r.fuel.mileage.find((s) => s.fuelType === 'cng')).toBeUndefined();
  });

  test('price trend carries the stored unit per fill', () => {
    const v = vehicle({ fuelTypes: ['petrol', 'cng'] });
    const r = vehicleReport(v, fills(), SEP, { now: NOW });
    const petrol = r.fuel.price.find((s) => s.fuelType === 'petrol')!;
    expect(petrol.points).toHaveLength(1);
    expect(petrol.points[0].pricePerUnitMilli).toBe(100_000);
    expect(petrol.points[0].unit).toBe('L');
    const cng = r.fuel.price.find((s) => s.fuelType === 'cng')!;
    expect(cng.points[0].unit).toBe('kg');
  });

  test('fuel cost per km = fuel cost ÷ period distance', () => {
    const v = vehicle({ fuelTypes: ['petrol', 'cng'] });
    const entries = [
      entry({ odometer: 12_000, date: ts(2026, 8, 20), createdAt: ts(2026, 8, 20) }),
      entry({ odometer: 12_900, date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10) }),
      costEntry('fuel', 450_000, { date: ts(2026, 9, 15), createdAt: ts(2026, 9, 15), category: undefined }),
    ];
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.fuel.costPerKmByUnit.km).toBe(500); // 450,000 / 900
  });

  test('EV charges split by location; missing location is "Not specified"', () => {
    const v = vehicle({ fuelTypes: ['electric'], odometerUnit: 'km' });
    const ev = (minor: number, loc?: 'home' | 'public', d = 10) =>
      entry({ type: 'fuel', date: ts(2026, 9, d), createdAt: ts(2026, 9, d), amount: { minor, currency: 'INR' }, details: { fuelType: 'electric', quantity: 10, quantityUnit: 'kWh', pricePerUnitMilli: 10_000, fullTank: true, missedPrevious: false, chargingLocation: loc } });
    const r = vehicleReport(v, [ev(100_000, 'home'), ev(200_000, 'public', 12), ev(50_000, undefined, 14)], SEP, { now: NOW });
    expect(r.fuel.ev).toEqual({ home: 100_000, public: 200_000, unspecified: 50_000 });
  });
});

describe('services & expenses (RPT-03, PD-04, LD-06)', () => {
  const svc = (minor: number, lines: { serviceType: string; otherLabel?: string; costMinor: number }[], over: Partial<ReportEntryLike> = {}) =>
    entry({ type: 'service', date: ts(2026, 9, 10), createdAt: ts(2026, 9, 10), amount: { minor, currency: 'INR' }, category: 'General service', details: { lines }, ...over });

  test('category totals combine expenses and services with a type tag and one Other bucket', () => {
    const entries = [
      costEntry('expense', 100_000, { category: 'Insurance' }),
      costEntry('expense', 20_000, { category: 'Custom thing' }), // Other free text
      costEntry('expense', 10_000, { category: 'Another custom' }),
      svc(60_000, [{ serviceType: 'engine_oil', costMinor: 60_000 }], { category: 'Engine oil' }),
      svc(30_000, [{ serviceType: 'tyres', costMinor: 30_000 }], { category: 'Bespoke check' }),
    ];
    const r = vehicleReport(vehicle(), entries, SEP, { now: NOW });
    const cats = Object.fromEntries(r.services.categories.map((c) => [`${c.kind}:${c.label}`, c.minor]));
    expect(cats['expense:Insurance']).toBe(100_000);
    expect(cats['service:Engine oil']).toBe(60_000);
    expect(cats['other:Other']).toBe(20_000 + 10_000 + 30_000);
  });

  test('service history lists visits, last date and line totals; labour and discount are separate rows', () => {
    const entries = [
      svc(100_000, [
        { serviceType: 'engine_oil', costMinor: 40_000 },
        { serviceType: 'oil_filter', costMinor: 20_000 },
      ], { date: ts(2026, 9, 3), createdAt: ts(2026, 9, 3), details: { lines: [{ id: 'a', serviceType: 'engine_oil', costMinor: 40_000 }, { id: 'b', serviceType: 'oil_filter', costMinor: 20_000 }], labourMinor: 30_000, discountMinor: 10_000 } }),
      svc(50_000, [{ serviceType: 'engine_oil', costMinor: 50_000 }], { date: ts(2026, 9, 20), createdAt: ts(2026, 9, 20) }),
      svc(15_000, [{ serviceType: 'other', otherLabel: 'Seat cover', costMinor: 15_000 }], { date: ts(2026, 9, 22), createdAt: ts(2026, 9, 22) }),
    ];
    const r = vehicleReport(vehicle(), entries, SEP, { now: NOW });
    const byKey = Object.fromEntries(r.services.history.map((h) => [h.key, h]));
    expect(byKey['engine_oil'].visits).toBe(2);
    expect(byKey['engine_oil'].totalMinor).toBe(90_000);
    expect(byKey['engine_oil'].lastMs).toBe(tsToMillisFor(ts(2026, 9, 20)));
    expect(byKey['other:Seat cover'].label).toBe('Seat cover');
    expect(byKey['labour'].totalMinor).toBe(30_000);
    expect(byKey['discount'].totalMinor).toBe(10_000);
  });
});

describe('trips (RPT-03 #5, OQ-44)', () => {
  test('business/personal distance and reimbursement, excluded from cost', () => {
    const v = vehicle();
    const entries = [
      entry({ type: 'trip', date: ts(2026, 9, 2), createdAt: ts(2026, 9, 2), odometer: 10_120, details: { startAt: ts(2026, 9, 2), endAt: ts(2026, 9, 2, 1), startOdometer: 10_000, endOdometer: 10_120, distance: 120, from: '', to: '', purpose: 'business', ratePerUnitMilli: 5_000, reimbursementMinor: 60_000 } }),
      entry({ type: 'trip', date: ts(2026, 9, 4), createdAt: ts(2026, 9, 4), odometer: 10_160, details: { startAt: ts(2026, 9, 4), endAt: ts(2026, 9, 4, 1), startOdometer: 10_120, endOdometer: 10_160, distance: 40, from: '', to: '', purpose: 'personal' } }),
      costEntry('fuel', 100_000, { date: ts(2026, 9, 5), createdAt: ts(2026, 9, 5), category: undefined }),
    ];
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.trips.businessByUnit.km).toBe(120);
    expect(r.trips.personalByUnit.km).toBe(40);
    expect(r.trips.reimbursementMinor).toBe(60_000);
    // reimbursement never joins cost or profit
    expect(r.overview.costMinor).toBe(100_000);
    expect(r.income).toBeNull();
  });

  test('trips without a rate contribute distance and no reimbursement', () => {
    const v = vehicle();
    const entries = [
      entry({ type: 'trip', date: ts(2026, 9, 2), createdAt: ts(2026, 9, 2), odometer: 10_050, details: { startAt: ts(2026, 9, 2), endAt: ts(2026, 9, 2, 1), startOdometer: 10_000, endOdometer: 10_050, distance: 50, from: '', to: '', purpose: 'business' } }),
    ];
    const r = vehicleReport(v, entries, SEP, { now: NOW });
    expect(r.trips.businessByUnit.km).toBe(50);
    expect(r.trips.reimbursementMinor).toBe(0);
  });
});

describe('dashboard figures (RPT-03/13, PD-09, OQ-48)', () => {
  test('bi-fuel detection is petrol + CNG exactly', () => {
    expect(isBiFuel(['petrol', 'cng'])).toBe(true);
    expect(isBiFuel(['cng', 'petrol'])).toBe(true);
    expect(isBiFuel(['petrol', 'diesel'])).toBe(false);
    expect(isBiFuel(['petrol', 'cng', 'diesel'])).toBe(false);
    expect(isBiFuel(['petrol'])).toBe(false);
  });

  test('last mileage comes from the first fuel; bi-fuel shows cost per km', () => {
    const v = vehicle({ fuelTypes: ['petrol', 'diesel'] });
    const entries = fills();
    const f = dashboardFigures(v, entries, NOW);
    expect(f.headline?.kind).toBe('mileage');
    expect(f.headline?.fuelType).toBe('petrol');
    expect(f.headline?.value).toBeCloseTo(16, 5);

    const bi = dashboardFigures(vehicle({ fuelTypes: ['petrol', 'cng'] }), fills(), NOW);
    expect(bi.headline?.kind).toBe('costPerKm');
  });

  test("this month's spend, previous month, 90-day cost per km and income-vs-cost", () => {
    const { v, entries } = fixtureA();
    const f = dashboardFigures(v, entries, NOW);
    expect(f.monthSpendMinor).toBe(0); // nothing logged in October yet
    expect(f.prevMonthSpendMinor).toBe(900_000); // September spend
    // last 90 days (≈9 Jul → 7 Oct): cost 11,000 over distance
    // 12,900 (last reading in window) − 10,000 (startOdometer, last before)
    expect(f.costPerKm90).toBeCloseTo(1_100_000 / 2_900, 5); // ≈ ₹3.79/km
    // vehicle HAS income entries (Sep) — the card exists with October zeros
    expect(f.incomeVsCost).toEqual({ income: 0, cost: 0 });
    const octIncome = costEntry('income', 500_000, { date: ts(2026, 10, 3), createdAt: ts(2026, 10, 3) });
    const f2 = dashboardFigures(v, [...entries, octIncome], NOW);
    expect(f2.incomeVsCost).toEqual({ income: 500_000, cost: 0 });
  });

  test('hours vehicle hides distance items; empty vehicle gives undefined figures', () => {
    const v = vehicle({ odometerUnit: 'hours' });
    const f = dashboardFigures(v, [], NOW);
    expect(f.distanceMetrics).toBe(false);
    expect(f.headline).toBeNull();
    expect(f.costPerKm90).toBeUndefined();
    expect(f.monthSpendMinor).toBe(0);
    expect(f.hasIncome).toBe(false);
  });
});

describe('All-vehicles aggregation (RPT-12, PD-08, OQ-19)', () => {
  test('archived vehicles excluded; load failures omitted by caller', () => {
    const { v, entries } = fixtureA();
    const archived = vehicle({ id: 'v2', name: 'Old', archived: true });
    const blocks = aggregateReports([
      vehicleReport(v, entries, SEP, { now: NOW }),
      vehicleReport(archived, entries, SEP, { now: NOW }),
    ]);
    expect(blocks).toHaveLength(1);
    const blocksWithArchived = aggregateReports(
      [vehicleReport(v, entries, SEP, { now: NOW }), vehicleReport(archived, entries, SEP, { now: NOW })],
      { includeArchived: true },
    );
    expect(blocksWithArchived[0].overview.costMinor).toBe(1_800_000);
  });

  test('income section appears per currency when any vehicle has income', () => {
    const { v, entries } = fixtureA();
    const v2 = vehicle({ id: 'v2', name: 'Van' });
    const noIncome = entries.filter((e) => e.type !== 'income');
    const blocks = aggregateReports([
      vehicleReport(v, entries, SEP, { now: NOW }),
      vehicleReport(v2, noIncome, SEP, { now: NOW }),
    ]);
    const inr = blocks.find((b) => b.currency === 'INR')!;
    expect(inr.income).not.toBeNull();
    expect(inr.income!.incomeMinor).toBe(2_000_000);
  });

  test('mileage stays per vehicle inside a currency block', () => {
    const v1 = vehicle();
    const v2 = vehicle({ id: 'v2', name: 'Bike' });
    const blocks = aggregateReports([
      vehicleReport(v1, fills(), SEP, { now: NOW }),
      vehicleReport(v2, fills(), SEP, { now: NOW }),
    ]);
    const inr = blocks.find((b) => b.currency === 'INR')!;
    expect(inr.fuel.mileage.length).toBe(2);
    expect(new Set(inr.fuel.mileage.map((s) => s.vehicleId)).size).toBe(2);
  });
});

function tsToMillisFor(t: Timestamp): number {
  return t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);
}
