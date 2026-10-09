// Money is stored as integer minor units (paise); never as floats.
export function toMinor(major: number): number {
  return Math.round(major * 100);
}

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
