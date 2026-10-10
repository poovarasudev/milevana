// LOG-03 — entry-domain helpers: service totals, trip figures, the
// non-blocking odometer sanity check (LD-05), the fixed category lists
// (LD-06, DR-03) and History filtering/search (LD-11). Pure functions only —
// no Firestore, no React.

import type { Timestamp } from '../data/schema/common';
import type { EntryDoc, ServiceDetailsDoc, TripDetailsDoc } from '../data/schema/entry';

// --- categories (LD-06, DR-03: stored values are the English names) ----------

export const OTHER_CATEGORY = 'Other';

export const EXPENSE_CATEGORIES = [
  'Insurance', 'Road tax', 'FASTag/toll', 'Parking', 'Fine/challan',
  'PUC certificate', 'Registration/permit', 'Loan EMI', 'Cleaning', 'Accessories',
] as const;

export const SERVICE_TYPES = [
  { id: 'general_service', label: 'General service' }, // i18n-allow
  { id: 'engine_oil', label: 'Engine oil' }, // i18n-allow
  { id: 'oil_filter', label: 'Oil filter' }, // i18n-allow
  { id: 'air_filter', label: 'Air filter' }, // i18n-allow
  { id: 'brake_pads', label: 'Brake pads' }, // i18n-allow
  { id: 'tyres', label: 'Tyres' }, // i18n-allow
  { id: 'battery', label: 'Battery' }, // i18n-allow
  { id: 'coolant', label: 'Coolant' }, // i18n-allow
  { id: 'wheel_alignment', label: 'Wheel alignment/balancing' }, // i18n-allow
  { id: 'clutch', label: 'Clutch' }, // i18n-allow
  { id: 'ac_service', label: 'AC service' }, // i18n-allow
] as const;
export type ServiceTypeId = (typeof SERVICE_TYPES)[number]['id'] | 'other';
export const SERVICE_LINE_MAX = 20; // LD-08: 1–20 lines; the form rejects 21+

export const INCOME_CATEGORIES = ['Ride-hailing', 'Delivery', 'Rental', 'Reimbursement'] as const;

export const PLATFORM_SUGGESTIONS = ['Uber', 'Ola', 'Rapido', 'Swiggy', 'Zomato'] as const;

export const TRIP_PURPOSES = ['business', 'personal'] as const;

export function serviceTypeLabel(id: string, otherLabel?: string): string {
  const known = SERVICE_TYPES.find((s) => s.id === id);
  if (known) return known.label;
  return otherLabel ?? id;
}

// --- service total (LD-03/Appendix E) ---------------------------------------

export function serviceTotal(
  lines: Pick<ServiceDetailsDoc['lines'][number], 'costMinor'>[],
  labourMinor = 0,
  discountMinor = 0,
): number {
  const sum = lines.reduce((s, l) => s + l.costMinor, 0) + labourMinor - discountMinor;
  return Math.max(0, sum);
}

// --- trips (LD-09) ----------------------------------------------------------

/** Rate is in thousandths of a minor unit per distance/hour unit. */
export function tripFigures(
  startOdometer: number,
  endOdometer: number,
  ratePerUnitMilli?: number,
): { distance: number; reimbursementMinor?: number } {
  const distance = endOdometer - startOdometer;
  if (ratePerUnitMilli === undefined) return { distance };
  // distance has ≤1 decimal; work in milli-units for an exact half-up result
  const distanceMilli = BigInt(Math.round(distance * 1000));
  const reimbursementMinor = Number(
    (2n * BigInt(ratePerUnitMilli) * distanceMilli + 1_000_000n) / 2_000_000n,
  );
  return { distance, reimbursementMinor };
}

// --- odometer sanity check (LD-05) ------------------------------------------

export interface OdometerSource {
  id: string;
  odometer?: number;
  date: Timestamp;
  createdAt: Timestamp;
  details?: unknown;
}

export interface OdometerReading {
  value: number;
  date: Timestamp;
  createdAt: Timestamp;
}

export interface OdometerWarning {
  kind: 'lower' | 'higher';
  value: number;
  date: Timestamp;
}

const cmpTs = (a: Timestamp, b: Timestamp) => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;
const cmpReading = (a: OdometerReading, b: OdometerReading) =>
  cmpTs(a.date, b.date) || cmpTs(a.createdAt, b.createdAt);

/**
 * Every entry with an odometer is a reading; a trip contributes BOTH its start
 * and its end reading at the trip's own date (LD-05).
 */
export function odometerReadings(entries: OdometerSource[], excludeId?: string): OdometerReading[] {
  const out: OdometerReading[] = [];
  for (const e of entries) {
    if (excludeId !== undefined && e.id === excludeId) continue;
    const d = e.details as TripDetailsDoc | undefined;
    if (d && typeof d.startOdometer === 'number') {
      out.push({ value: d.startOdometer, date: e.date, createdAt: e.createdAt });
    }
    if (e.odometer !== undefined) {
      out.push({ value: e.odometer, date: e.date, createdAt: e.createdAt });
    }
  }
  return out;
}

/**
 * Non-blocking sanity check. A candidate reads "lower" if a reading on an
 * earlier (date, createdAt) position exceeds it, "higher" if a reading on a
 * later position is below it. The strongest violation is reported.
 */
export function odometerCheck(
  entries: OdometerSource[],
  candidate: { odometer: number; date: Timestamp; createdAt?: Timestamp },
  excludeId?: string,
): OdometerWarning | null {
  // A candidate without createdAt (a brand-new entry) sorts after everything
  // already saved on the same date.
  const cand: OdometerReading = {
    value: candidate.odometer,
    date: candidate.date,
    createdAt: candidate.createdAt ?? { seconds: Number.MAX_SAFE_INTEGER, nanoseconds: 0 },
  };
  const earlier: OdometerReading[] = [];
  const later: OdometerReading[] = [];
  for (const r of odometerReadings(entries, excludeId)) {
    if (cmpReading(r, cand) < 0) earlier.push(r);
    else later.push(r);
  }
  const maxEarlier = earlier.reduce<OdometerReading | null>(
    (m, r) => (m === null || r.value > m.value ? r : m), null,
  );
  if (maxEarlier && candidate.odometer < maxEarlier.value) {
    return { kind: 'lower', value: maxEarlier.value, date: maxEarlier.date };
  }
  const minLater = later.reduce<OdometerReading | null>(
    (m, r) => (m === null || r.value < m.value ? r : m), null,
  );
  if (minLater && candidate.odometer > minLater.value) {
    return { kind: 'higher', value: minLater.value, date: minLater.date };
  }
  return null;
}

// --- history filtering & search (LD-11/LD-12) --------------------------------

export interface EntryFilter {
  /** empty array or undefined = all types */
  types?: string[];
  /** inclusive calendar-day bounds */
  from?: Date;
  to?: Date;
  query?: string;
}

function haystack(e: Pick<EntryDoc, 'type' | 'date'> & {
  notes?: string; category?: string; details?: unknown;
}): string[] {
  const parts: (string | undefined)[] = [e.notes, e.category];
  const d = e.details as Record<string, unknown> | undefined;
  if (d) {
    // templateName: inspection entries are found by their checklist name
    // (CHK-09) — item notes inside details.items[].note are NOT searched.
    parts.push(d.stationName as string, d.platform as string, d.from as string, d.to as string, d.templateName as string);
    if (Array.isArray(d.lines)) {
      for (const l of d.lines as { serviceType?: string; otherLabel?: string }[]) {
        parts.push(l.serviceType, l.otherLabel, l.serviceType ? serviceTypeLabel(l.serviceType, l.otherLabel) : undefined);
      }
    }
  }
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0);
}

/**
 * Search matches notes, category, service line-item types/labels, station,
 * platform and trip from/to — case-insensitive substring. Amounts are never
 * searched (LD-11).
 */
export function entryMatchesQuery(e: EntryDoc, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack(e).some((p) => p.toLowerCase().includes(q));
}

const DAY_MS = 86_400_000;

/** Pure in-memory filter — filtering never triggers extra reads (LD-12). */
export function filterEntries<T extends Pick<EntryDoc, 'type' | 'date'>>(
  entries: T[],
  filter: EntryFilter,
): T[] {
  const types = filter.types && filter.types.length > 0 ? new Set(filter.types) : null;
  const fromMs = filter.from
    ? new Date(filter.from.getFullYear(), filter.from.getMonth(), filter.from.getDate()).getTime()
    : undefined;
  const toMs = filter.to
    ? new Date(filter.to.getFullYear(), filter.to.getMonth(), filter.to.getDate()).getTime() + DAY_MS
    : undefined;
  const q = (filter.query ?? '').trim().toLowerCase();
  return entries.filter((e) => {
    if (types && !types.has(e.type)) return false;
    const ms = e.date.seconds * 1000;
    if (fromMs !== undefined && ms < fromMs) return false;
    if (toMs !== undefined && ms >= toMs) return false;
    if (q && !haystack(e).some((p) => p.toLowerCase().includes(q))) return false;
    return true;
  });
}
