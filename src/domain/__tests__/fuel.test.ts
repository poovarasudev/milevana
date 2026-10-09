// LOG-02 — the two-of-three fuel solver (LD-03) and mileage between
// consecutive full fills of the same fuel (LD-01/LD-02, OQ-30, OQ-42).

import {
  defaultFuelType, defaultQuantityUnit, emptyFuelInputs, fuelEdit,
  fuelResolved, formatMileage, fuelMileage, parsePriceMilli,
  quantityUnitsFor, solveFuel, type MileageEntry,
} from '../fuel';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const fill = (over: Partial<MileageEntry>): MileageEntry => ({
  id: 'e1', fuelType: 'petrol', odometer: 10_000, quantity: 40,
  quantityUnit: 'L', fullTank: true, missedPrevious: false,
  date: ts(100), createdAt: ts(100), ...over,
});

describe('solveFuel — two-of-three (LD-03, SC-LOG02-01)', () => {
  test('price + quantity ⇒ total, rounded half-up to the minor unit', () => {
    // 1.459 per litre for 12.5 litres → 18.2375 → 1824 minor
    const r = solveFuel({ pricePerUnitMilli: 145_900, quantity: 12.5 });
    expect(r.totalMinor).toBe(1824);
    expect(r.pricePerUnitMilli).toBe(145_900);
    expect(r.quantity).toBe(12.5);
  });

  test('price 102.5 × 10 L ⇒ total 1025.00 (SC-LOG05-01)', () => {
    // ₹102.50/L = 10,250 minor units = 10,250,000 milli-minor per litre
    const r = solveFuel({ pricePerUnitMilli: 10_250_000, quantity: 10 });
    expect(r.totalMinor).toBe(102_500); // 1025.00 in minor units
  });

  test('total + quantity ⇒ price, half-up to the milli-unit', () => {
    const r = solveFuel({ totalMinor: 1824, quantity: 12.5 });
    expect(r.pricePerUnitMilli).toBe(145_920); // 1.4592 per unit
  });

  test('total + price ⇒ quantity to 3 decimals', () => {
    const r = solveFuel({ totalMinor: 1824, pricePerUnitMilli: 145_900 });
    expect(r.quantity).toBe(12.502);
  });

  test('G7 round-trip: entering price then quantity then re-deriving keeps the stored total', () => {
    const first = solveFuel({ pricePerUnitMilli: 145_900, quantity: 12.5 });
    expect(first.totalMinor).toBe(1824);
    // The integer-minor total feeds back unchanged as an input.
    const again = solveFuel({ totalMinor: first.totalMinor, quantity: 12.5 });
    expect(again.totalMinor).toBe(1824);
    expect(again.pricePerUnitMilli).toBe(145_920);
  });

  test('three inputs are returned untouched — the form decides which two count', () => {
    const r = solveFuel({ pricePerUnitMilli: 1, quantity: 2, totalMinor: 99 });
    expect(r).toEqual({ pricePerUnitMilli: 1, quantity: 2, totalMinor: 99 });
  });

  test('missing or zero/negative inputs derive nothing', () => {
    expect(solveFuel({ pricePerUnitMilli: 145_900 })).toEqual({ pricePerUnitMilli: 145_900 });
    expect(solveFuel({ pricePerUnitMilli: 0, quantity: 12.5 })).toEqual({ pricePerUnitMilli: 0, quantity: 12.5 });
    expect(solveFuel({ totalMinor: -5, quantity: 12.5 })).toEqual({ totalMinor: -5, quantity: 12.5 });
  });
});

describe('fuelMileage — consecutive full fills (LD-01, SC-LOG02-02/03)', () => {
  test('a full fill 500 km after the previous full fill with 40 L ⇒ 12.5', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'b', odometer: 10_500 }),
    ]);
    expect(map.get('b')).toBeCloseTo(12.5, 5);
    expect(map.has('a')).toBe(false); // a fuel's first fill shows no mileage
  });

  test('a partial fill in between adds its quantity to the divisor', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'p', odometer: 10_200, quantity: 5, fullTank: false, date: ts(150), createdAt: ts(150) }),
      fill({ id: 'b', odometer: 10_500, date: ts(200), createdAt: ts(200) }),
    ]);
    expect(map.get('b')).toBeCloseTo(500 / 45, 5); // 11.111…
  });

  test('missedPrevious on the later fill ⇒ no mileage for that interval', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'b', odometer: 10_500, missedPrevious: true, date: ts(200), createdAt: ts(200) }),
    ]);
    expect(map.has('b')).toBe(false);
  });

  test('missedPrevious on an in-between fill ⇒ no mileage for that interval', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'p', odometer: 10_200, quantity: 5, fullTank: false, missedPrevious: true, date: ts(150), createdAt: ts(150) }),
      fill({ id: 'b', odometer: 10_500, date: ts(200), createdAt: ts(200) }),
    ]);
    expect(map.has('b')).toBe(false);
  });

  test('bi-fuel: petrol and CNG intervals never mix', () => {
    const map = fuelMileage([
      fill({ id: 'p1', fuelType: 'petrol', odometer: 10_000, quantity: 30, date: ts(100), createdAt: ts(100) }),
      fill({ id: 'c1', fuelType: 'cng', odometer: 10_100, quantity: 10, quantityUnit: 'kg', date: ts(110), createdAt: ts(110) }),
      fill({ id: 'p2', fuelType: 'petrol', odometer: 10_300, quantity: 20, date: ts(200), createdAt: ts(200) }),
      fill({ id: 'c2', fuelType: 'cng', odometer: 10_400, quantity: 15, quantityUnit: 'kg', date: ts(300), createdAt: ts(300) }),
    ]);
    expect(map.get('p2')).toBeCloseTo(300 / 20, 5); // petrol only: 15 km/l
    expect(map.get('c2')).toBeCloseTo(300 / 15, 5); // cng only: 20 km/kg
  });

  test('equal or lower odometer ⇒ no mileage', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'b', odometer: 10_000, date: ts(200), createdAt: ts(200) }),
      fill({ id: 'c', odometer: 9_900, date: ts(300), createdAt: ts(300) }),
    ]);
    expect(map.size).toBe(0);
  });

  test('a partial fill is never an interval boundary', () => {
    const map = fuelMileage([
      fill({ id: 'p1', odometer: 10_000, fullTank: false }),
      fill({ id: 'b', odometer: 10_400, date: ts(200), createdAt: ts(200) }),
    ]);
    expect(map.has('b')).toBe(false); // no earlier full fill
  });

  test('gallon quantities normalise to litres for the divisor', () => {
    const map = fuelMileage([
      fill({ id: 'a', odometer: 10_000 }),
      fill({ id: 'p', odometer: 10_200, quantity: 1, quantityUnit: 'gal_us', fullTank: false, date: ts(150), createdAt: ts(150) }),
      fill({ id: 'b', odometer: 10_500, date: ts(200), createdAt: ts(200) }),
    ]);
    expect(map.get('b')).toBeCloseTo(500 / (40 + 3.785411784), 5);
  });
});

describe('formatMileage — unit labels (OQ-42, SC-LOG02-04/05)', () => {
  const kmL = { efficiencyFormat: 'km_per_l' as const, volumeUnit: 'litres' as const };

  test('petrol follows the Efficiency format setting', () => {
    expect(formatMileage(12.5, 'petrol', 'km', kmL)).toBe('12.5 km/l');
    expect(formatMileage(12.5, 'diesel', 'km', { ...kmL, efficiencyFormat: 'l_per_100km' })).toBe('8.0 L/100 km');
    expect(formatMileage(12.5, 'petrol', 'km', { efficiencyFormat: 'mpg', volumeUnit: 'litres' })).toBe('29.4 mpg');
    expect(formatMileage(12.5, 'petrol', 'km', { efficiencyFormat: 'mpg', volumeUnit: 'gal_uk' })).toBe('35.3 mpg');
  });

  test('mile-based petrol figures convert to the canonical km/l before formatting', () => {
    // rate in mi/l → km/l; km/l display shows the converted value
    expect(formatMileage(10, 'petrol', 'mi', kmL)).toBe('16.1 km/l');
  });

  test('CNG is km/kg, or mi/kg for a mile-based vehicle — never the Efficiency setting', () => {
    expect(formatMileage(20, 'cng', 'km', { efficiencyFormat: 'mpg', volumeUnit: 'litres' })).toBe('20.0 km/kg');
    expect(formatMileage(20, 'cng', 'mi', kmL)).toBe('20.0 mi/kg');
  });

  test('electric is km/kWh, or mi/kWh for a mile-based vehicle', () => {
    expect(formatMileage(6, 'electric', 'km', kmL)).toBe('6.0 km/kWh');
    expect(formatMileage(6, 'electric', 'mi', kmL)).toBe('6.0 mi/kWh');
  });

  test('an hours vehicle is never shown a mileage figure', () => {
    expect(formatMileage(12.5, 'petrol', 'hours', kmL)).toBeNull();
    expect(formatMileage(12.5, 'cng', 'hours', kmL)).toBeNull();
  });

  test('no computed rate ⇒ nothing', () => {
    expect(formatMileage(undefined, 'petrol', 'km', kmL)).toBeNull();
  });
});

describe('fuel form defaults (LD-02)', () => {
  test('quantity unit follows the Volume setting for liquid fuels', () => {
    expect(defaultQuantityUnit('petrol', 'litres')).toBe('L');
    expect(defaultQuantityUnit('diesel', 'gal_us')).toBe('gal_us');
    expect(defaultQuantityUnit('lpg', 'gal_uk')).toBe('gal_uk');
    expect(defaultQuantityUnit('cng', 'litres')).toBe('kg');
    expect(defaultQuantityUnit('electric', 'gal_us')).toBe('kWh');
  });

  test('unit picker options per fuel', () => {
    expect(quantityUnitsFor('petrol')).toEqual(['L', 'gal_us', 'gal_uk']);
    expect(quantityUnitsFor('cng')).toEqual(['kg']);
    expect(quantityUnitsFor('electric')).toEqual(['kWh']);
  });

  test('default fuel type is the last used, else the vehicle’s first', () => {
    expect(defaultFuelType(['petrol', 'cng'], [])).toBe('petrol');
    const entries = [
      fill({ id: 'a', fuelType: 'cng', date: ts(100), createdAt: ts(100) }),
      fill({ id: 'b', fuelType: 'petrol', date: ts(200), createdAt: ts(200) }),
    ];
    expect(defaultFuelType(['petrol', 'cng'], entries)).toBe('petrol');
    // a last-used fuel the vehicle no longer has falls back to the first
    expect(defaultFuelType(['diesel'], entries)).toBe('diesel');
  });
});

describe('fuel input state — the two most recently edited fields count (LD-03)', () => {
  test('price then quantity ⇒ total derives', () => {
    let s = emptyFuelInputs;
    s = fuelEdit(s, 'price', '102.5');
    s = fuelEdit(s, 'quantity', '10');
    const r = fuelResolved(s, 'INR');
    expect(r.computed).toBe('total');
    expect(r.computedText).toBe('1025'); // ₹1025.00 displayed as major units
    expect(r.amounts.totalMinor).toBe(102_500);
  });

  test('editing the derived field makes the oldest input derive instead', () => {
    let s = emptyFuelInputs;
    s = fuelEdit(s, 'price', '102.5');
    s = fuelEdit(s, 'quantity', '10');
    s = fuelEdit(s, 'total', '2000');
    const r = fuelResolved(s, 'INR');
    expect(r.computed).toBe('price'); // price is now the stale field
    expect(r.computedText).toBe('200'); // 2000.00 / 10 = ₹200.000/L
  });

  test('an invalid input blocks derivation and shows raw text', () => {
    let s = emptyFuelInputs;
    s = fuelEdit(s, 'price', 'abc');
    s = fuelEdit(s, 'quantity', '10');
    expect(fuelResolved(s, 'INR').complete).toBe(false);
  });

  test('price parsing accepts 3 decimals of the major unit', () => {
    expect(parsePriceMilli('1.459', 'INR')).toBe(145_900);
    expect(parsePriceMilli('102.5', 'INR')).toBe(10_250_000);
    expect(parsePriceMilli('1.459', 'JPY')).toBe(1_459); // exponent 0
    expect(parsePriceMilli('0', 'INR')).toBeUndefined();
    expect(parsePriceMilli('1.4599', 'INR')).toBeUndefined();
  });
});
