// FND-DAT-01 (SC-DAT01-*): minor-unit math per ISO 4217 exponent, Indian vs
// international grouping, currency selectability.
import {
  decimalToMinor, exponentOf, formatAmount, isSelectableCurrency,
  minorToDecimal, NON_SELECTABLE_CURRENCIES, SELECTABLE_CURRENCIES,
} from '../money';

describe('minor-unit conversion', () => {
  it('exponent 2 currencies (INR, USD)', () => {
    expect(decimalToMinor('2450.00', 'INR')).toBe(245000);
    expect(decimalToMinor('12.34', 'USD')).toBe(1234);
    expect(minorToDecimal(1234, 'USD')).toBe(12.34);
    expect(minorToDecimal(245000, 'INR')).toBe(2450);
  });

  it('exponent 0 currencies (JPY)', () => {
    expect(exponentOf('JPY')).toBe(0);
    expect(decimalToMinor('1234', 'JPY')).toBe(1234);
    expect(minorToDecimal(1234, 'JPY')).toBe(1234);
  });

  it('exponent 3 currencies (KWD)', () => {
    expect(exponentOf('KWD')).toBe(3);
    expect(decimalToMinor('1.234', 'KWD')).toBe(1234);
    expect(minorToDecimal(1234, 'KWD')).toBe(1.234);
  });

  it('rounds half-up and never drifts on float input', () => {
    expect(decimalToMinor('1.005', 'INR')).toBe(101);
    expect(decimalToMinor('1.004', 'INR')).toBe(100);
    expect(decimalToMinor('0.575', 'USD')).toBe(58);
    // The classic float trap: 4.35*100 = 434.9999…
    expect(decimalToMinor(4.35, 'INR')).toBe(435);
  });

  it('rejects invalid input', () => {
    expect(() => decimalToMinor('abc', 'INR')).toThrow();
    expect(() => decimalToMinor('1.2.3', 'INR')).toThrow();
  });
});

describe('formatAmount', () => {
  it('formats the INR acceptance example', () => {
    expect(formatAmount({ minor: 245000, currency: 'INR' })).toBe('₹2,450.00');
  });

  it('uses Indian digit grouping for INR', () => {
    expect(formatAmount({ minor: 123456700, currency: 'INR' })).toBe('₹12,34,567.00');
    expect(formatAmount({ minor: 123456789, currency: 'INR' })).toBe('₹12,34,567.89');
  });

  it('uses international grouping for other currencies', () => {
    expect(formatAmount({ minor: 123456789, currency: 'USD' })).toBe('$1,234,567.89');
    expect(formatAmount({ minor: 123456789, currency: 'EUR' })).toBe('€1,234,567.89');
  });

  it('shows no decimals for exponent-0 currencies', () => {
    expect(formatAmount({ minor: 1234, currency: 'JPY' })).toBe('¥1,234');
  });

  it('shows three decimals for exponent-3 currencies', () => {
    expect(formatAmount({ minor: 1234, currency: 'KWD' })).toBe('KWD 1.234');
  });

  it('signs negatives and optional plus', () => {
    expect(formatAmount({ minor: -500, currency: 'INR' })).toBe('-₹5.00');
    expect(formatAmount({ minor: 500, currency: 'INR' }, { showSign: true })).toBe('+₹5.00');
  });

  it('falls back to the code prefix for currencies without a symbol', () => {
    expect(formatAmount({ minor: 100, currency: 'KWD' })).toBe('KWD 0.100');
  });
});

describe('currency selectability', () => {
  it('excludes funds, metals, test codes and non-0/2/3 exponents', () => {
    for (const c of ['XAU', 'XAG', 'XTS', 'XXX', 'BOV', 'CLF', 'UYW', 'MGA', 'MRU']) {
      expect(isSelectableCurrency(c)).toBe(false);
      expect(NON_SELECTABLE_CURRENCIES.has(c)).toBe(true);
    }
  });

  it('includes active codes and is sorted', () => {
    expect(isSelectableCurrency('INR')).toBe(true);
    expect(isSelectableCurrency('USD')).toBe(true);
    expect(SELECTABLE_CURRENCIES).toEqual([...SELECTABLE_CURRENCIES].sort());
    expect(SELECTABLE_CURRENCIES.length).toBeGreaterThan(100);
  });

  it('exponent lookup defaults to 2 for unknown codes', () => {
    expect(exponentOf('ZZZ')).toBe(2);
  });
});
