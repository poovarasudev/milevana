// LOG-03 — service totals, trip figures, the non-blocking odometer check and
// the fixed category lists (SC-LOG03-01..04), plus History filtering (LD-11).

import {
  EXPENSE_CATEGORIES, filterEntries, INCOME_CATEGORIES, odometerCheck,
  OTHER_CATEGORY, PLATFORM_SUGGESTIONS, SERVICE_LINE_MAX, SERVICE_TYPES,
  serviceTotal, tripFigures, type OdometerSource,
} from '../entries';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const day = (iso: string) => ts(Math.floor(new Date(`${iso}T12:00:00`).getTime() / 1000));

describe('serviceTotal (Appendix E, SC-LOG03-01)', () => {
  test('lines + labour − discount', () => {
    expect(serviceTotal([{ costMinor: 1200 }, { costMinor: 400 }], 300, 100)).toBe(1800);
  });
  test('discount larger than the sum floors at zero', () => {
    expect(serviceTotal([{ costMinor: 1200 }], 0, 5000)).toBe(0);
  });
  test('a zero-cost line is accepted into the sum', () => {
    expect(serviceTotal([{ costMinor: 0 }, { costMinor: 400 }])).toBe(400);
  });
});

describe('tripFigures (LD-09, SC-LOG03-02)', () => {
  test('distance is end − start', () => {
    expect(tripFigures(1000, 1042)).toEqual({ distance: 42 });
  });
  test('a rate yields a reimbursement rounded half-up to the minor unit', () => {
    // ₹12/km → 1,200,000 milli-minor; 42 km ⇒ 504.00 → 50400 minor
    expect(tripFigures(1000, 1042, 1_200_000)).toEqual({ distance: 42, reimbursementMinor: 50_400 });
    // half-up: 0.333 km at ₹10/km → 3.33 minor → 3
    expect(tripFigures(1000, 1000.5, 66_700).reimbursementMinor).toBe(33); // 0.5 km × 0.667/km
  });
  test('zero distance with a rate still resolves to 0', () => {
    expect(tripFigures(500, 500, 1_200_000).reimbursementMinor).toBe(0);
  });
});

describe('odometerCheck (LD-05, SC-LOG03-03)', () => {
  // Readings: entry 9 Oct 10,000; trip 15 Oct 10,200→10,260; entry 20 Oct 10,500.
  const entries: OdometerSource[] = [
    { id: 'e1', odometer: 10_000, date: day('2025-10-09'), createdAt: ts(1) },
    {
      id: 't1', odometer: 10_260, date: day('2025-10-15'), createdAt: ts(2),
      details: { startAt: day('2025-10-15'), endAt: day('2025-10-15'), startOdometer: 10_200, endOdometer: 10_260 },
    },
    { id: 'e3', odometer: 10_500, date: day('2025-10-20'), createdAt: ts(3) },
  ];

  test('lower than an earlier reading warns but never blocks', () => {
    const w = odometerCheck(entries, { odometer: 9_800, date: day('2025-10-12') });
    expect(w).toMatchObject({ kind: 'lower', value: 10_000 });
  });

  test('higher than a later reading warns', () => {
    const w = odometerCheck(entries, { odometer: 10_700, date: day('2025-10-12') });
    expect(w).toMatchObject({ kind: 'higher', value: 10_200 }); // trip start counts
  });

  test('a candidate inside the ordered range is clean', () => {
    // 12 Oct sits between the 9 Oct reading (10,000) and the 15 Oct trip
    // start (10,200) — so 10,150 fits, 10,900 on 25 Oct follows 10,500.
    expect(odometerCheck(entries, { odometer: 10_150, date: day('2025-10-12') })).toBeNull();
    expect(odometerCheck(entries, { odometer: 10_900, date: day('2025-10-25') })).toBeNull();
  });

  test('the trip start counts as a reading at the trip’s own date', () => {
    // candidate 12 Oct sits between the 9 Oct and 15 Oct readings
    const w = odometerCheck(entries, { odometer: 10_150, date: day('2025-10-16') });
    // 10,150 on 16 Oct is lower than 10,260 (the trip end) and 10,500 later
    expect(w).toMatchObject({ kind: 'lower' });
  });

  test('excluding the entry being edited avoids self-comparison', () => {
    const w = odometerCheck(entries, { odometer: 10_500, date: day('2025-10-20') }, 'e3');
    expect(w).toBeNull();
  });
});

describe('category lists (LD-06, DR-03, SC-LOG03-04)', () => {
  test('expense list matches the SRS: 10 categories plus Other', () => {
    expect(EXPENSE_CATEGORIES).toEqual([
      'Insurance', 'Road tax', 'FASTag/toll', 'Parking', 'Fine/challan',
      'PUC certificate', 'Registration/permit', 'Loan EMI', 'Cleaning', 'Accessories',
    ]);
    expect(OTHER_CATEGORY).toBe('Other');
  });

  test('service list: 11 lowercase ids plus other', () => {
    expect(SERVICE_TYPES.map((s) => s.id)).toEqual([
      'general_service', 'engine_oil', 'oil_filter', 'air_filter', 'brake_pads',
      'tyres', 'battery', 'coolant', 'wheel_alignment', 'clutch', 'ac_service',
    ]);
    expect(SERVICE_TYPES.every((s) => /^[a-z_]+$/.test(s.id))).toBe(true);
    expect(SERVICE_LINE_MAX).toBe(20);
  });

  test('income list: 4 categories plus Other; platform suggestions exist', () => {
    expect(INCOME_CATEGORIES).toEqual(['Ride-hailing', 'Delivery', 'Rental', 'Reimbursement']);
    expect(PLATFORM_SUGGESTIONS).toContain('Uber');
    expect(PLATFORM_SUGGESTIONS).toContain('Zomato');
  });
});

describe('filterEntries — type chips, inclusive dates, search (LD-11)', () => {
  const mk = (over: Record<string, unknown>): any => ({
    id: 'x', type: 'expense', date: day('2025-10-10'), createdAt: ts(1), ...over,
  });
  const list = [
    mk({ id: 'f', type: 'fuel', date: day('2025-10-01') }),
    mk({ id: 'x', type: 'expense', date: day('2025-10-10'), category: 'Parking', notes: 'mall' }),
    mk({ id: 's', type: 'service', date: day('2025-10-20'), details: { lines: [{ id: 'l1', serviceType: 'engine_oil', costMinor: 1 }] } }),
    mk({ id: 'i', type: 'income', date: day('2025-10-31'), details: { platform: 'Uber' } }),
  ];

  test('type filter accepts several types at once', () => {
    expect(filterEntries(list, { types: ['fuel', 'service'] }).map((e) => e.id)).toEqual(['f', 's']);
    expect(filterEntries(list, {}).map((e) => e.id)).toEqual(['f', 'x', 's', 'i']);
    expect(filterEntries(list, { types: [] }).length).toBe(list.length); // none chosen ⇒ all
  });

  test('the date range is inclusive on both ends', () => {
    const from = new Date('2025-10-10T00:00:00');
    const to = new Date('2025-10-20T23:59:59');
    expect(filterEntries(list, { from, to }).map((e) => e.id)).toEqual(['x', 's']);
  });

  test('search matches notes, category, service line types, platform, station, from/to — not amounts', () => {
    expect(filterEntries(list, { query: 'mall' }).map((e) => e.id)).toEqual(['x']);
    expect(filterEntries(list, { query: 'PARKING' }).map((e) => e.id)).toEqual(['x']); // case-insensitive
    expect(filterEntries(list, { query: 'engine' }).map((e) => e.id)).toEqual(['s']);
    expect(filterEntries(list, { query: 'uber' }).map((e) => e.id)).toEqual(['i']);
    const trip = mk({ id: 'tr', type: 'trip', date: day('2025-10-05'), details: { from: 'Home', to: 'Office', startOdometer: 1, endOdometer: 2 } });
    const fuel = mk({ id: 'fu', type: 'fuel', details: { stationName: 'Shell highway' } });
    const income = mk({ id: 'am', type: 'income', amount: { minor: 50000, currency: 'INR' } });
    expect(filterEntries([...list, trip], { query: 'office' }).map((e) => e.id)).toEqual(['tr']);
    expect(filterEntries([...list, fuel], { query: 'shell' }).map((e) => e.id)).toEqual(['fu']);
    // amounts are never searched
    expect(filterEntries([income], { query: '500' })).toEqual([]);
    expect(filterEntries([income], { query: '' })).toEqual([income]);
  });

  test('filters and search combine', () => {
    expect(filterEntries(list, { types: ['expense'], query: 'mall' }).map((e) => e.id)).toEqual(['x']);
    expect(filterEntries(list, { types: ['expense'], query: 'engine' })).toEqual([]);
  });
});

describe('odometer readings include a trip’s start and end (LD-05)', () => {
  test('trip start is a reading but cannot raise lastOdometer (repo-side)', () => {
    const trip: OdometerSource = {
      id: 't', odometer: 10_260, date: day('2025-10-15'), createdAt: ts(2),
      details: { startAt: day('2025-10-15'), endAt: day('2025-10-15'), startOdometer: 10_200, endOdometer: 10_260 },
    };
    // A candidate of 10,250 on 14 Oct reads fine against the trip END
    // (10,260) alone — it is the START reading (10,200) that flags it.
    const w = odometerCheck([trip], { odometer: 10_250, date: day('2025-10-14') });
    expect(w).toMatchObject({ kind: 'higher', value: 10_200 });
  });
});
