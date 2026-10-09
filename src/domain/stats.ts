import type { Entry, Settings } from './types';

export function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const isCost = (e: Entry) => e.type !== 'income' && e.type !== 'trip' && e.type !== 'inspection';

export function monthSpend(entries: Entry[], key: string): number {
  return entries.filter((e) => isCost(e) && monthKey(e.date) === key).reduce((s, e) => s + e.amountMinor, 0);
}

export function monthlySeries(entries: Entry[], months: number, now = Date.now()) {
  const out: { key: string; label: string; total: number }[] = [];
  const base = new Date(now);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = monthKey(d.getTime());
    out.push({ key, label: d.toLocaleString('en', { month: 'short' }), total: monthSpend(entries, key) });
  }
  return out;
}

/** Mileage between two consecutive full-tank fills; skipped when a fill was missed. */
export function lastMileage(entries: Entry[]): number | null {
  const fuel = entries
    .filter((e) => e.type === 'fuel' && e.details && e.odometer != null)
    .sort((a, b) => b.date - a.date);
  const [cur, prev] = fuel;
  if (!cur?.details || !prev || !cur.details.fullTank || cur.details.missedFill) return null;
  const dist = (cur.odometer ?? 0) - (prev.odometer ?? 0);
  return dist > 0 && cur.details.quantity > 0 ? dist / cur.details.quantity : null;
}

export function formatEfficiency(kmPerL: number, fmt: Settings['efficiency']): string {
  if (fmt === 'l100') return `${(100 / kmPerL).toFixed(1)} L/100 km`;
  if (fmt === 'mpg') return `${(kmPerL * 2.352145).toFixed(1)} mpg`;
  return `${kmPerL.toFixed(1)} km/l`;
}
