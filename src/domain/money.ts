// Money is stored as integer minor units with an ISO 4217 currency code;
// never as floats and never converted between currencies (FR-DATA-13, NFR-08,
// FR-SET-03, OQ-29). Minor-unit exponents come from the table below (OQ-31).
//
// Formatting (DR-07 ◐): the symbol sits before the number, the decimal
// separator is '.', INR uses Indian digit grouping (12,34,567.00) and every
// other currency uses international grouping. Funds, metal and test codes
// (XAU, XTS, XXX, BOV, CLF, UYW, ...) are not selectable.

/** Minor-unit exponent per selectable ISO 4217 currency (0, 2 or 3). */
export const CURRENCY_EXPONENTS: Record<string, 0 | 2 | 3> = {
  // exponent 0
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // exponent 3
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // exponent 2 (all other active codes)
  AED: 2, AFN: 2, ALL: 2, AMD: 2, ANG: 2, AOA: 2, ARS: 2, AUD: 2,
  AWG: 2, AZN: 2, BAM: 2, BBD: 2, BDT: 2, BGN: 2, BMD: 2, BND: 2,
  BOB: 2, BRL: 2, BSD: 2, BTN: 2, BWP: 2, BYN: 2, BZD: 2, CAD: 2,
  CDF: 2, CHF: 2, CNY: 2, COP: 2, CRC: 2, CUP: 2, CVE: 2, CZK: 2,
  DKK: 2, DOP: 2, DZD: 2, EGP: 2, ERN: 2, ETB: 2, EUR: 2, FJD: 2,
  FKP: 2, GBP: 2, GEL: 2, GHS: 2, GIP: 2, GMD: 2, GTQ: 2, GYD: 2,
  HKD: 2, HNL: 2, HTG: 2, HUF: 2, IDR: 2, ILS: 2, INR: 2, IRR: 2,
  JMD: 2, KES: 2, KGS: 2, KHR: 2, KPW: 2, KYD: 2, KZT: 2, LAK: 2,
  LBP: 2, LKR: 2, LRD: 2, LSL: 2, MAD: 2, MDL: 2, MKD: 2, MMK: 2,
  MNT: 2, MOP: 2, MUR: 2, MVR: 2, MWK: 2, MXN: 2, MYR: 2, MZN: 2,
  NAD: 2, NGN: 2, NIO: 2, NOK: 2, NPR: 2, NZD: 2, PAB: 2, PEN: 2,
  PGK: 2, PHP: 2, PKR: 2, PLN: 2, QAR: 2, RON: 2, RSD: 2, RUB: 2,
  SAR: 2, SBD: 2, SCR: 2, SDG: 2, SEK: 2, SGD: 2, SHP: 2, SLE: 2,
  SOS: 2, SRD: 2, SSP: 2, STN: 2, SVC: 2, SYP: 2, SZL: 2, THB: 2,
  TJS: 2, TMT: 2, TOP: 2, TRY: 2, TTD: 2, TWD: 2, TZS: 2, UAH: 2,
  USD: 2, UYU: 2, UZS: 2, VED: 2, VES: 2, WST: 2, XCD: 2, XCG: 2,
  YER: 2, ZAR: 2, ZMW: 2, ZWL: 2,
};

/** ISO codes that exist but are not selectable (funds, metals, test, other exponents). */
export const NON_SELECTABLE_CURRENCIES = new Set([
  'XAU', 'XAG', 'XPD', 'XPT', 'XDR', 'XBA', 'XBB', 'XBC', 'XBD', 'XSU', 'XUA',
  'XTS', 'XXX', 'XAD',
  'BOV', 'CHE', 'CHW', 'COU', 'MXV', 'USN', // funds codes
  'MGA', 'MRU', // exponent 1 (1/5 subunit)
  'CLF', 'UYW', // exponent 4
]);

export const SELECTABLE_CURRENCIES: string[] = Object.keys(CURRENCY_EXPONENTS)
  .filter((c) => !NON_SELECTABLE_CURRENCIES.has(c))
  .sort();

export interface Money {
  minor: number;
  currency: string;
}

export function isSelectableCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(CURRENCY_EXPONENTS, code) && !NON_SELECTABLE_CURRENCIES.has(code);
}

export function exponentOf(currency: string): number {
  const e = CURRENCY_EXPONENTS[currency];
  return e === undefined ? 2 : e;
}

/** Exact minor units → decimal number (uses the currency's exponent). */
export function minorToDecimal(minor: number, currency: string): number {
  const exp = exponentOf(currency);
  return minor / 10 ** exp;
}

/**
 * Decimal → minor units, rounded half-up to the minor unit (LD-03 ◐).
 * Implemented with string arithmetic so no floating-point drift is stored.
 */
export function decimalToMinor(value: number | string, currency: string): number {
  const exp = exponentOf(currency);
  const s = typeof value === 'number' ? String(value) : value.trim();
  const neg = s.startsWith('-');
  const abs = neg ? s.slice(1) : s;
  if (!/^\d+(\.\d+)?$/.test(abs)) throw new Error('invalid decimal amount');
  const [intPart, fracPart = ''] = abs.split('.');
  const kept = fracPart.slice(0, exp).padEnd(exp, '0');
  const roundUp = fracPart.length > exp && Number(fracPart[exp]) >= 5;
  let minor = BigInt(intPart) * BigInt(10 ** exp) + BigInt(kept === '' ? 0 : kept);
  if (roundUp) minor += 1n;
  const out = neg ? -minor : minor;
  if (out > BigInt(Number.MAX_SAFE_INTEGER) || out < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('amount out of range');
  }
  return Number(out);
}

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩',
  RUB: '₽', BRL: 'R$', TRY: '₺', ILS: '₪', THB: '฿', VND: '₫', PHP: '₱',
  AUD: 'A$', CAD: 'C$', HKD: 'HK$', NZD: 'NZ$', SGD: 'S$', TWD: 'NT$',
  MXN: 'MX$', ZAR: 'R', CHF: 'CHF ', NOK: 'kr ', SEK: 'kr ', DKK: 'kr ',
  PLN: 'zł ', CZK: 'Kč ', HUF: 'Ft ',
};

function groupDigits(intDigits: string, indian: boolean): string {
  if (intDigits.length <= 3) return intDigits;
  if (indian) {
    const last3 = intDigits.slice(-3);
    const rest = intDigits.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format a stored amount for display. The amount keeps its own currency — the
 * Currency setting only chooses the default for new vehicles and the format
 * style (symbol position and grouping), never a conversion (OQ-29, FR-SET-03).
 */
export function formatAmount(amount: Money, opts: { showSign?: boolean } = {}): string {
  const { minor, currency } = amount;
  const exp = exponentOf(currency);
  const neg = minor < 0;
  const digits = String(Math.abs(minor)).padStart(exp + 1, '0');
  const intPart = exp === 0 ? digits : digits.slice(0, -exp);
  const fracPart = exp === 0 ? '' : digits.slice(-exp);
  const grouped = groupDigits(intPart, currency === 'INR');
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  const sign = neg ? '-' : opts.showSign ? '+' : '';
  return `${sign}${symbol}${grouped}${fracPart ? '.' + fracPart : ''}`;
}

// --- Compatibility shims for the existing first-slice screens (removed in 1B) ---
/** @deprecated kept for the local-store UI slice; new code uses decimalToMinor. */
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

/** @deprecated kept for the local-store UI slice; new code uses formatAmount. */
export function formatMoney(minor: number, symbol = '₹', showSign = false): string {
  const neg = minor < 0;
  const abs = Math.abs(minor) / 100;
  const hasFraction = Math.abs(minor) % 100 !== 0;
  const body = abs.toLocaleString('en-IN', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  const sign = neg ? '-' : showSign ? '+' : '';
  return `${sign}${symbol}${body}`;
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
