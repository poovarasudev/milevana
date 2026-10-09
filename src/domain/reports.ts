// Pure report metrics — RPT-02/03/12/13. Every function is timezone-local
// calendar math over the loaded entry set; nothing here touches Firestore.
//
// Types are structural (`ReportEntryLike` / `ReportVehicleLike`) so both
// validated EntryRecords and test fixtures satisfy them.

import type { Timestamp } from '../data/schema/common';
import type { FuelDetailsDoc, ServiceDetailsDoc, TripDetailsDoc, IncomeDetailsDoc } from '../data/schema/entry';
import {
  EXPENSE_CATEGORIES, odometerReadings, SERVICE_TYPES, serviceTypeLabel,
  type OdometerReading,
} from './entries';
import { fuelMileage, toMileageEntry } from './fuel';
import { usesDistanceMetrics, type StoredDistanceUnit } from './units';

const DAY_MS = 86_400_000;

// --- structural input types --------------------------------------------------

export interface ReportEntryLike {
  id: string;
  type: string;
  date: Timestamp;
  createdAt: Timestamp;
  odometer?: number;
  amount?: { minor: number; currency: string };
  category?: string;
  details?: unknown;
}

export interface ReportVehicleLike {
  id: string;
  name: string;
  currency: string;
  odometerUnit: StoredDistanceUnit;
  fuelTypes: string[];
  startOdometer: number;
  createdAt: Timestamp;
  archived?: boolean;
}

// --- ranges (PD-01) ----------------------------------------------------------

export type ReportRangeId =
  | 'this_month' | 'last_3_months' | 'last_12_months'
  | 'financial_year' | 'all_time' | 'custom';

export const REPORT_RANGE_IDS: ReportRangeId[] = [
  'this_month', 'last_3_months', 'last_12_months', 'financial_year', 'all_time', 'custom',
];

/** Inclusive local-day period; endMs is the period's last millisecond. */
export interface ReportPeriod { startMs: number; endMs: number }

const dayStartMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayEndMs = (d: Date) => dayStartMs(d) + DAY_MS - 1;

/** Calendar month subtraction that clamps the day (31 Jan − 1 month = 31 Dec). */
const subMonths = (d: Date, n: number): Date => {
  const m = new Date(d.getFullYear(), d.getMonth() - n, 1);
  const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  return new Date(m.getFullYear(), m.getMonth(), Math.min(d.getDate(), lastDay));
};

export function resolveRange(
  id: ReportRangeId,
  opts: { now?: Date; createdAt?: Timestamp; custom?: { start: Date; end: Date } } = {},
): ReportPeriod | null {
  const now = opts.now ?? new Date();
  const endMs = dayEndMs(now);
  switch (id) {
    case 'this_month':
      return { startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), endMs };
    case 'last_3_months':
      return { startMs: dayStartMs(subMonths(now, 3)), endMs };
    case 'last_12_months':
      return { startMs: dayStartMs(subMonths(now, 12)), endMs };
    case 'financial_year': {
      // FY runs April–March: the FY containing `now` starts the most recent 1 April.
      const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      return { startMs: new Date(y, 3, 1).getTime(), endMs };
    }
    case 'all_time':
      return {
        startMs: opts.createdAt ? dayStartMs(new Date(tsToMillis(opts.createdAt))) : dayStartMs(now),
        endMs,
      };
    case 'custom': {
      const c = opts.custom;
      if (!c) return null;
      const s = dayStartMs(c.start);
      const e = dayEndMs(c.end);
      return s > e ? null : { startMs: s, endMs: e };
    }
  }
}

const tsToMillis = (t: Timestamp) => t.seconds * 1000 + Math.floor(t.nanoseconds / 1e6);

export const inPeriod = (date: Timestamp, p: ReportPeriod): boolean => {
  const ms = tsToMillis(date);
  return ms >= p.startMs && ms <= p.endMs;
};

/**
 * Days a period overlaps the vehicle's lifetime, ending today (PD-02):
 * the denominator for cost per day clamps to [vehicle.createdAt, now].
 */
export function periodDays(p: ReportPeriod, createdAt: Timestamp, now: Date = new Date()): number {
  const s = Math.max(p.startMs, dayStartMs(new Date(tsToMillis(createdAt))));
  const e = Math.min(p.endMs, dayEndMs(now));
  return e < s ? 0 : Math.round((e - s + 1) / DAY_MS);
}

// --- distance & cost (PD-02, OQ-48) ------------------------------------------

const cmpReading = (a: OdometerReading, b: OdometerReading) =>
  (a.date.seconds - b.date.seconds || a.date.nanoseconds - b.date.nanoseconds) ||
  (a.createdAt.seconds - b.createdAt.seconds || a.createdAt.nanoseconds - b.createdAt.nanoseconds);

/**
 * OQ-48: last reading in the period minus the last reading before it; the
 * vehicle's startOdometer counts as a reading at creation (OQ-49). When the
 * period starts at or before the vehicle existed there is no "before", so the
 * earliest in-period reading is the baseline (covers All time and a vehicle
 * created inside the range).
 */
export function periodDistance(
  entries: ReportEntryLike[],
  p: ReportPeriod,
  vehicle: Pick<ReportVehicleLike, 'startOdometer' | 'createdAt'>,
): number | undefined {
  const before: OdometerReading[] = [];
  const inside: OdometerReading[] = [];
  const start: OdometerReading = {
    value: vehicle.startOdometer, date: vehicle.createdAt, createdAt: vehicle.createdAt,
  };
  for (const r of [...odometerReadings(entries), start]) {
    const ms = tsToMillis(r.date);
    if (ms < p.startMs) before.push(r);
    else if (ms <= p.endMs) inside.push(r);
  }
  inside.sort(cmpReading);
  before.sort(cmpReading);
  if (inside.length === 0) return undefined;
  const last = inside[inside.length - 1];
  const base = before.length > 0
    ? before[before.length - 1]
    : inside.length > 1 ? inside[0] : undefined;
  if (!base) return undefined;
  const distance = last.value - base.value;
  return distance > 0 ? distance : undefined;
}

/** Cost = fuel + service + expense amounts (LD-10): no income, no reimbursement. */
export const periodCost = (entries: ReportEntryLike[], p: ReportPeriod): number =>
  entries.reduce((s, e) =>
    (e.type === 'fuel' || e.type === 'service' || e.type === 'expense') && e.amount && inPeriod(e.date, p)
      ? s + e.amount.minor : s, 0);

export const periodIncome = (entries: ReportEntryLike[], p: ReportPeriod): number =>
  entries.reduce((s, e) => e.type === 'income' && e.amount && inPeriod(e.date, p) ? s + e.amount.minor : s, 0);

/** Cost per distance unit in fractional minor units — display rounds it (PD-02). */
export const costPerKm = (costMinor: number, distance?: number): number | undefined =>
  distance !== undefined && distance > 0 ? costMinor / distance : undefined;

export const costPerDay = (
  costMinor: number, p: ReportPeriod, createdAt: Timestamp, now: Date = new Date(),
): number | undefined => {
  const days = periodDays(p, createdAt, now);
  return days > 0 ? costMinor / days : undefined;
};

export interface CostSplit { fuel: number; service: number; expense: number }

export const costSplit = (entries: ReportEntryLike[], p: ReportPeriod): CostSplit => {
  const split: CostSplit = { fuel: 0, service: 0, expense: 0 };
  for (const e of entries) {
    if (!e.amount || !inPeriod(e.date, p)) continue;
    if (e.type === 'fuel' || e.type === 'service' || e.type === 'expense') {
      split[e.type as keyof CostSplit] += e.amount.minor;
    }
  }
  return split;
};

// --- shared figure shapes ----------------------------------------------------

/** Distance figures keyed by odometer unit; never merged across units (OQ-19). */
export type UnitDistances = Partial<Record<StoredDistanceUnit, number>>;
/** Per-unit money rates (minor units per distance unit); 'hours' never appears. */
export type UnitRates = Partial<Record<'km' | 'mi', number>>;

export interface MonthSpend { year: number; month: number; fuel: number; service: number; expense: number }
export interface MonthIncome { year: number; month: number; income: number; cost: number }

export interface TrendPoint { entryId: string; ms: number; value: number }
export interface TrendSeries {
  fuelType: string;
  vehicleId: string;
  vehicleName: string;
  /** the vehicle's stored odometer unit — mileage points display per it (OQ-19) */
  unit: StoredDistanceUnit;
  points: TrendPoint[];
}
export interface PricePoint { entryId: string; ms: number; pricePerUnitMilli: number; unit: string }
export interface PriceSeries {
  fuelType: string;
  vehicleId: string;
  vehicleName: string;
  points: PricePoint[];
}

export interface CategoryTotal {
  /** 'service' or 'expense' for a known category; 'other' groups every Other/free-text value (PD-04). */
  kind: 'service' | 'expense' | 'other';
  label: string;
  minor: number;
}

export interface ServiceTypeRow {
  /** service-type id, 'other:<label>', 'labour' or 'discount'. */
  key: string;
  label: string;
  visits: number;
  lastMs: number;
  totalMinor: number;
  special?: 'labour' | 'discount';
}

export interface IncomeSection {
  incomeMinor: number;
  costMinor: number;
  netMinor: number;
  monthly: MonthIncome[];
  platforms: { platform: string; minor: number }[];
  profitPerKmByUnit: UnitRates;
  /** internal: per-unit net for merging */
  netMinorByUnit: UnitDistances;
}

export interface TripsSection {
  businessByUnit: UnitDistances;
  personalByUnit: UnitDistances;
  reimbursementMinor: number;
}

export interface ReportFigures {
  overview: {
    costMinor: number;
    costPerDayMinor?: number;
    distanceByUnit: UnitDistances;
    costPerKmByUnit: UnitRates;
    split: CostSplit;
    /** internal: per-unit cost for merging */
    costMinorByUnit: UnitDistances;
  };
  monthly: MonthSpend[];
  fuel: {
    mileage: TrendSeries[];
    price: PriceSeries[];
    costPerKmByUnit: UnitRates;
    /** internal: per-unit fuel cost for merging */
    costMinorByUnit: UnitDistances;
    ev: { home: number; public: number; unspecified: number };
  };
  services: { categories: CategoryTotal[]; history: ServiceTypeRow[] };
  income: IncomeSection | null;
  trips: TripsSection;
  /** in-period entry counts per section — drives 'No data for this period' (PD-06) */
  counts: { fuel: number; serviceExpense: number; trips: number; income: number };
}

export interface VehicleReport extends ReportFigures {
  kind: 'vehicle';
  vehicle: ReportVehicleLike;
  currency: string;
}

export interface CurrencyReport extends ReportFigures {
  kind: 'currency';
  currency: string;
  vehicleIds: string[];
}

// --- calendar-month buckets ---------------------------------------------------

const monthBuckets = (p: ReportPeriod): { year: number; month: number }[] => {
  const out: { year: number; month: number }[] = [];
  const end = new Date(p.endMs);
  let cur = new Date(new Date(p.startMs).getFullYear(), new Date(p.startMs).getMonth(), 1);
  while (cur.getFullYear() < end.getFullYear() ||
         (cur.getFullYear() === end.getFullYear() && cur.getMonth() <= end.getMonth())) {
    out.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  return out;
};


const EXPENSE_LABELS = new Set<string>(EXPENSE_CATEGORIES);
const SERVICE_LABELS = new Set<string>(SERVICE_TYPES.map((s) => s.label));

export const hasIncomeEntries = (entries: ReportEntryLike[]): boolean =>
  entries.some((e) => e.type === 'income' && e.amount !== undefined);

// --- per-vehicle report --------------------------------------------------------

export function vehicleReport(
  vehicle: ReportVehicleLike,
  entries: ReportEntryLike[],
  p: ReportPeriod,
  opts: { now?: Date } = {},
): VehicleReport {
  const now = opts.now ?? new Date();
  const unit = vehicle.odometerUnit;
  const distanceMetrics = usesDistanceMetrics(unit);

  const distance = distanceMetrics ? periodDistance(entries, p, vehicle) : undefined;
  const costMinor = periodCost(entries, p);

  const distanceByUnit: UnitDistances = distance !== undefined ? { [unit]: distance } : {};
  const costMinorByUnit: UnitDistances = { [unit]: costMinor };
  const costPerKmByUnit: UnitRates =
    distance !== undefined && unit !== 'hours'
      ? { [unit as 'km' | 'mi']: costPerKm(costMinor, distance) } : {};

  const monthly: MonthSpend[] = monthBuckets(p).map((b) => ({ ...b, fuel: 0, service: 0, expense: 0 }));
  const monthIndex = new Map(monthly.map((b, i) => [`${b.year}-${b.month}`, i]));
  for (const e of entries) {
    if (!e.amount || !inPeriod(e.date, p)) continue;
    if (e.type !== 'fuel' && e.type !== 'service' && e.type !== 'expense') continue;
    const d = new Date(tsToMillis(e.date));
    const bucket = monthly[monthIndex.get(`${d.getFullYear()}-${d.getMonth() + 1}`)!];
    bucket[e.type as keyof CostSplit] += e.amount.minor;
  }

  // --- fuel (PD-03): trends computed over the whole entry set so a fill in
  // the period can use a previous full fill outside it. ---
  const mileageMap = fuelMileage(entries.map((e) => toMileageEntry(e)).filter((e): e is NonNullable<typeof e> => e !== null));
  const mileageSeries = new Map<string, TrendSeries>();
  const priceSeries = new Map<string, PriceSeries>();
  const ev = { home: 0, public: 0, unspecified: 0 };
  let fuelCostMinor = 0;
  for (const e of entries) {
    if (e.type !== 'fuel' || !inPeriod(e.date, p)) continue;
    if (e.amount) fuelCostMinor += e.amount.minor;
    const det = e.details as FuelDetailsDoc | undefined;
    if (!det) continue;
    const ms = tsToMillis(e.date);
    const m = mileageMap.get(e.id);
    if (m !== undefined) {
      const s = mileageSeries.get(det.fuelType) ?? { fuelType: det.fuelType, vehicleId: vehicle.id, vehicleName: vehicle.name, unit, points: [] };
      s.points.push({ entryId: e.id, ms, value: m });
      mileageSeries.set(det.fuelType, s);
    }
    if (det.pricePerUnitMilli !== undefined) {
      const s = priceSeries.get(det.fuelType) ?? { fuelType: det.fuelType, vehicleId: vehicle.id, vehicleName: vehicle.name, points: [] };
      s.points.push({ entryId: e.id, ms, pricePerUnitMilli: det.pricePerUnitMilli, unit: det.quantityUnit });
      priceSeries.set(det.fuelType, s);
    }
    if (det.fuelType === 'electric' && e.amount) {
      const key = det.chargingLocation === 'home' ? 'home' : det.chargingLocation === 'public' ? 'public' : 'unspecified';
      ev[key] += e.amount.minor;
    }
  }
  for (const s of [...mileageSeries.values(), ...priceSeries.values()]) s.points.sort((a, b) => a.ms - b.ms);
  const fuelCostPerKmByUnit: UnitRates =
    distance !== undefined && unit !== 'hours' && fuelCostMinor > 0
      ? { [unit as 'km' | 'mi']: costPerKm(fuelCostMinor, distance) } : {};

  // --- services & expenses (PD-04) ---
  const catMap = new Map<string, CategoryTotal>();
  const bumpCat = (kind: CategoryTotal['kind'], label: string, minor: number) => {
    const key = `${kind}:${label}`;
    const row = catMap.get(key) ?? { kind, label, minor: 0 };
    row.minor += minor;
    catMap.set(key, row);
  };
  const histMap = new Map<string, ServiceTypeRow>();
  for (const e of entries) {
    if (!inPeriod(e.date, p) || !e.amount) continue;
    if (e.type === 'expense') {
      const known = e.category !== undefined && EXPENSE_LABELS.has(e.category);
      bumpCat(known ? 'expense' : 'other', known ? e.category! : 'Other', e.amount.minor);
    } else if (e.type === 'service') {
      const known = e.category !== undefined && SERVICE_LABELS.has(e.category);
      bumpCat(known ? 'service' : 'other', known ? e.category! : 'Other', e.amount.minor);
      const det = e.details as ServiceDetailsDoc | undefined;
      if (!det) continue;
      const ms = tsToMillis(e.date);
      const seen = new Set<string>();
      const rowFor = (key: string, label: string, special?: 'labour' | 'discount') => {
        const row = histMap.get(key) ?? { key, label, visits: 0, lastMs: 0, totalMinor: 0, special };
        row.lastMs = Math.max(row.lastMs, ms);
        histMap.set(key, row);
        return row;
      };
      for (const line of det.lines) {
        const key = line.serviceType === 'other' ? `other:${line.otherLabel ?? ''}` : line.serviceType;
        const row = rowFor(key, serviceTypeLabel(line.serviceType, line.otherLabel));
        row.totalMinor += line.costMinor;
        if (!seen.has(key)) { row.visits += 1; seen.add(key); }
      }
      if (det.labourMinor) {
        const row = rowFor('labour', 'Labour', 'labour');
        row.totalMinor += det.labourMinor;
        if (!seen.has('labour')) { row.visits += 1; seen.add('labour'); }
      }
      if (det.discountMinor) {
        const row = rowFor('discount', 'Discount', 'discount');
        row.totalMinor += det.discountMinor;
        if (!seen.has('discount')) { row.visits += 1; seen.add('discount'); }
      }
    }
  }
  const categories = [...catMap.values()].sort((a, b) => b.minor - a.minor || a.label.localeCompare(b.label));
  const history = [...histMap.values()]
    .sort((a, b) => (a.special ? 1 : 0) - (b.special ? 1 : 0) || b.totalMinor - a.totalMinor);

  // --- income & profit (PD-05) ---
  const income = hasIncomeEntries(entries) ? incomeSection(entries, p, unit, distance) : null;

  // --- trips (OQ-44): distance per unit; reimbursement kept separate ---
  const trips: TripsSection = { businessByUnit: {}, personalByUnit: {}, reimbursementMinor: 0 };
  const counts = { fuel: 0, serviceExpense: 0, trips: 0, income: 0 };
  for (const e of entries) {
    if (!inPeriod(e.date, p)) continue;
    if (e.type === 'fuel') counts.fuel += 1;
    else if (e.type === 'service' || e.type === 'expense') counts.serviceExpense += 1;
    else if (e.type === 'trip') counts.trips += 1;
    else if (e.type === 'income') counts.income += 1;
    if (e.type !== 'trip') continue;
    const det = e.details as TripDetailsDoc | undefined;
    if (!det) continue;
    const bucket = det.purpose === 'business' ? trips.businessByUnit : trips.personalByUnit;
    bucket[unit] = (bucket[unit] ?? 0) + det.distance;
    if (det.reimbursementMinor) trips.reimbursementMinor += det.reimbursementMinor;
  }

  return {
    kind: 'vehicle',
    vehicle,
    currency: vehicle.currency,
    overview: {
      costMinor,
      costPerDayMinor: costPerDay(costMinor, p, vehicle.createdAt, now),
      distanceByUnit,
      costPerKmByUnit,
      split: costSplit(entries, p),
      costMinorByUnit,
    },
    monthly,
    fuel: {
      mileage: [...mileageSeries.values()],
      price: [...priceSeries.values()],
      costPerKmByUnit: fuelCostPerKmByUnit,
      costMinorByUnit: fuelCostMinor > 0 ? { [unit]: fuelCostMinor } : {},
      ev,
    },
    services: { categories, history },
    income,
    trips,
    counts,
  };
}

const incomeSection = (
  entries: ReportEntryLike[],
  p: ReportPeriod,
  unit: StoredDistanceUnit,
  distance?: number,
): IncomeSection => {
  const monthly: MonthIncome[] = monthBuckets(p).map((b) => ({ ...b, income: 0, cost: 0 }));
  const monthIndex = new Map(monthly.map((b, i) => [`${b.year}-${b.month}`, i]));
  const platforms = new Map<string, number>();
  let incomeMinor = 0;
  let costMinor = 0;
  for (const e of entries) {
    if (!inPeriod(e.date, p)) continue;
    const d = new Date(tsToMillis(e.date));
    const idx = monthIndex.get(`${d.getFullYear()}-${d.getMonth() + 1}`)!;
    if (e.type === 'income' && e.amount) {
      incomeMinor += e.amount.minor;
      monthly[idx].income += e.amount.minor;
      const platform = (e.details as IncomeDetailsDoc | undefined)?.platform?.trim() || 'Not specified';
      platforms.set(platform, (platforms.get(platform) ?? 0) + e.amount.minor);
    } else if ((e.type === 'fuel' || e.type === 'service' || e.type === 'expense') && e.amount) {
      costMinor += e.amount.minor;
      monthly[idx].cost += e.amount.minor;
    }
  }
  const netMinor = incomeMinor - costMinor;
  return {
    incomeMinor,
    costMinor,
    netMinor,
    monthly,
    platforms: [...platforms.entries()]
      .map(([platform, minor]) => ({ platform, minor }))
      .sort((a, b) => b.minor - a.minor || a.platform.localeCompare(b.platform)),
    profitPerKmByUnit: distance !== undefined && unit !== 'hours'
      ? { [unit as 'km' | 'mi']: netMinor / distance }
      : {},
    netMinorByUnit: { [unit]: netMinor },
  };
};

// --- All-vehicles aggregation (PD-08) -----------------------------------------

const addUnits = (a: UnitDistances, b: UnitDistances): UnitDistances => {
  const out: UnitDistances = { ...a };
  for (const k of ['km', 'mi', 'hours'] as const) {
    if (b[k] !== undefined) out[k] = (out[k] ?? 0) + b[k]!;
  }
  return out;
};

const rateByUnit = (costByUnit: UnitDistances, distanceByUnit: UnitDistances): UnitRates => {
  const out: UnitRates = {};
  for (const k of ['km', 'mi'] as const) {
    const c = costByUnit[k];
    const d = distanceByUnit[k];
    if (c !== undefined && d !== undefined && d > 0) out[k] = c / d;
  }
  return out;
};

/**
 * Merge per-vehicle reports into currency blocks (PD-08). Archived vehicles
 * are dropped unless includeArchived. Totals stay inside their currency;
 * distance and rate figures stay inside their odometer unit.
 */
export function aggregateReports(
  reports: VehicleReport[],
  opts: { includeArchived?: boolean } = {},
): CurrencyReport[] {
  const blocks = new Map<string, CurrencyReport>();
  const fuelSeries = new Map<string, { mileage: TrendSeries[]; price: Map<string, PriceSeries> }>();
  const catMerge = new Map<string, Map<string, CategoryTotal>>();
  const histMerge = new Map<string, Map<string, ServiceTypeRow>>();
  const monthMerge = new Map<string, Map<string, MonthSpend>>();
  const incomeMerge = new Map<string, {
    monthly: Map<string, MonthIncome>;
    platforms: Map<string, number>;
    hasIncome: boolean;
  }>();

  const blockFor = (currency: string): CurrencyReport => {
    let b = blocks.get(currency);
    if (!b) {
      b = {
        kind: 'currency', currency, vehicleIds: [],
        overview: { costMinor: 0, distanceByUnit: {}, costPerKmByUnit: {}, costMinorByUnit: {}, split: { fuel: 0, service: 0, expense: 0 } },
        monthly: [],
        fuel: { mileage: [], price: [], costPerKmByUnit: {}, costMinorByUnit: {}, ev: { home: 0, public: 0, unspecified: 0 } },
        services: { categories: [], history: [] },
        income: null,
        trips: { businessByUnit: {}, personalByUnit: {}, reimbursementMinor: 0 },
        counts: { fuel: 0, serviceExpense: 0, trips: 0, income: 0 },
      };
      blocks.set(currency, b);
      fuelSeries.set(currency, { mileage: [], price: new Map() });
      catMerge.set(currency, new Map());
      histMerge.set(currency, new Map());
      monthMerge.set(currency, new Map());
      incomeMerge.set(currency, { monthly: new Map(), platforms: new Map(), hasIncome: false });
    }
    return b;
  };

  for (const r of reports) {
    if (r.vehicle.archived && !opts.includeArchived) continue;
    const b = blockFor(r.currency);
    b.vehicleIds.push(r.vehicle.id);

    const o = b.overview;
    o.costMinor += r.overview.costMinor;
    if (r.overview.costPerDayMinor !== undefined) {
      o.costPerDayMinor = (o.costPerDayMinor ?? 0) + r.overview.costPerDayMinor;
    }
    o.distanceByUnit = addUnits(o.distanceByUnit, r.overview.distanceByUnit);
    o.costMinorByUnit = addUnits(o.costMinorByUnit, r.overview.costMinorByUnit);
    o.split.fuel += r.overview.split.fuel;
    o.split.service += r.overview.split.service;
    o.split.expense += r.overview.split.expense;

    const mm = monthMerge.get(r.currency)!;
    for (const m of r.monthly) {
      const key = `${m.year}-${m.month}`;
      const row = mm.get(key) ?? { year: m.year, month: m.month, fuel: 0, service: 0, expense: 0 };
      row.fuel += m.fuel; row.service += m.service; row.expense += m.expense;
      mm.set(key, row);
    }

    const fs = fuelSeries.get(r.currency)!;
    fs.mileage.push(...r.fuel.mileage);
    for (const s of r.fuel.price) {
      const existing = fs.price.get(s.fuelType);
      if (existing) existing.points.push(...s.points);
      else fs.price.set(s.fuelType, { ...s, points: [...s.points] });
    }
    b.fuel.costMinorByUnit = addUnits(b.fuel.costMinorByUnit, r.fuel.costMinorByUnit);
    b.fuel.ev.home += r.fuel.ev.home;
    b.fuel.ev.public += r.fuel.ev.public;
    b.fuel.ev.unspecified += r.fuel.ev.unspecified;

    const cm = catMerge.get(r.currency)!;
    for (const c of r.services.categories) {
      const key = `${c.kind}:${c.label}`;
      const row = cm.get(key) ?? { kind: c.kind, label: c.label, minor: 0 };
      row.minor += c.minor;
      cm.set(key, row);
    }
    const hm = histMerge.get(r.currency)!;
    for (const h of r.services.history) {
      const row = hm.get(h.key) ?? { key: h.key, label: h.label, visits: 0, lastMs: 0, totalMinor: 0, special: h.special };
      row.visits += h.visits;
      row.lastMs = Math.max(row.lastMs, h.lastMs);
      row.totalMinor += h.totalMinor;
      hm.set(h.key, row);
    }

    const im = incomeMerge.get(r.currency)!;
    if (r.income) {
      im.hasIncome = true;
      for (const m of r.income.monthly) {
        const key = `${m.year}-${m.month}`;
        const row = im.monthly.get(key) ?? { year: m.year, month: m.month, income: 0, cost: 0 };
        row.income += m.income; row.cost += m.cost;
        im.monthly.set(key, row);
      }
      for (const pf of r.income.platforms) {
        im.platforms.set(pf.platform, (im.platforms.get(pf.platform) ?? 0) + pf.minor);
      }
    }
    // every vehicle contributes cost/net to its unit — an income-vehicle's
    // profit per km rides on the whole unit group
    if (r.income) {
      for (const k of ['km', 'mi', 'hours'] as const) {
        const n = r.income.netMinorByUnit[k];
        if (n !== undefined) {
          const cur = (b.income?.netMinorByUnit?.[k] ?? 0) + n;
          (b as { _netByUnit?: UnitDistances })._netByUnit = { ...(b as { _netByUnit?: UnitDistances })._netByUnit, [k]: cur };
        }
      }
    }

    b.trips.businessByUnit = addUnits(b.trips.businessByUnit, r.trips.businessByUnit);
    b.trips.personalByUnit = addUnits(b.trips.personalByUnit, r.trips.personalByUnit);
    b.trips.reimbursementMinor += r.trips.reimbursementMinor;
    b.counts.fuel += r.counts.fuel;
    b.counts.serviceExpense += r.counts.serviceExpense;
    b.counts.trips += r.counts.trips;
    b.counts.income += r.counts.income;
  }

  const out: CurrencyReport[] = [];
  for (const [currency, b] of blocks) {
    b.overview.costPerKmByUnit = rateByUnit(b.overview.costMinorByUnit, b.overview.distanceByUnit);
    b.monthly = [...monthMerge.get(currency)!.values()].sort((a, c) => a.year - c.year || a.month - c.month);
    const fs = fuelSeries.get(currency)!;
    b.fuel.mileage = fs.mileage;
    b.fuel.price = [...fs.price.values()].map((s) => ({ ...s, points: [...s.points].sort((x, y) => x.ms - y.ms) }));
    b.fuel.costPerKmByUnit = rateByUnit(b.fuel.costMinorByUnit, b.overview.distanceByUnit);
    b.services.categories = [...catMerge.get(currency)!.values()]
      .sort((a, c) => c.minor - a.minor || a.label.localeCompare(c.label));
    b.services.history = [...histMerge.get(currency)!.values()]
      .sort((a, c) => (a.special ? 1 : 0) - (c.special ? 1 : 0) || c.totalMinor - a.totalMinor);
    const im = incomeMerge.get(currency)!;
    if (im.hasIncome) {
      const netByUnit = (b as { _netByUnit?: UnitDistances })._netByUnit ?? {};
      const incomeMinor = [...im.monthly.values()].reduce((s, m) => s + m.income, 0);
      const costMinor = [...im.monthly.values()].reduce((s, m) => s + m.cost, 0);
      b.income = {
        incomeMinor,
        costMinor,
        netMinor: incomeMinor - costMinor,
        monthly: [...im.monthly.values()].sort((a, c) => a.year - c.year || a.month - c.month),
        platforms: [...im.platforms.entries()]
          .map(([platform, minor]) => ({ platform, minor }))
          .sort((a, c) => c.minor - a.minor || a.platform.localeCompare(c.platform)),
        profitPerKmByUnit: rateByUnit(netByUnit, b.overview.distanceByUnit),
        netMinorByUnit: netByUnit,
      };
      delete (b as { _netByUnit?: UnitDistances })._netByUnit;
    }
    out.push(b);
  }
  return out.sort((a, b) => a.currency.localeCompare(b.currency));
}

// --- bi-fuel (OQ-48) ----------------------------------------------------------

/** A bi-fuel vehicle is exactly petrol + CNG (LD-04/D5). */
export const isBiFuel = (fuelTypes: string[]): boolean =>
  fuelTypes.length === 2 && fuelTypes.includes('petrol') && fuelTypes.includes('cng');

// --- dashboard figures (PD-09) ------------------------------------------------

export interface DashboardFigures {
  distanceMetrics: boolean;
  biFuel: boolean;
  /** 'Last mileage' for ordinary vehicles; 'cost per km' (all-time) for petrol+CNG bi-fuel. */
  headline: { kind: 'mileage' | 'costPerKm'; fuelType?: string; value?: number } | null;
  monthSpendMinor: number;
  prevMonthSpendMinor: number;
  monthCostPerKm?: number;
  costPerKm90?: number;
  /** 'This month's income vs cost'; present only when the vehicle has income entries. */
  incomeVsCost?: { income: number; cost: number };
  hasIncome: boolean;
}

export function dashboardFigures(
  vehicle: ReportVehicleLike,
  entries: ReportEntryLike[],
  now: Date = new Date(),
): DashboardFigures {
  const distanceMetrics = usesDistanceMetrics(vehicle.odometerUnit);
  const biFuel = isBiFuel(vehicle.fuelTypes);
  const monthP: ReportPeriod = {
    startMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
    endMs: dayEndMs(now),
  };
  const prevMonthP: ReportPeriod = {
    startMs: new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(),
    endMs: new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1,
  };
  const window90: ReportPeriod = {
    startMs: dayStartMs(new Date(now.getTime() - 90 * DAY_MS)),
    endMs: dayEndMs(now),
  };

  const monthSpendMinor = periodCost(entries, monthP);
  const prevMonthSpendMinor = periodCost(entries, prevMonthP);
  const monthDistance = distanceMetrics ? periodDistance(entries, monthP, vehicle) : undefined;
  const distance90 = distanceMetrics ? periodDistance(entries, window90, vehicle) : undefined;

  let headline: DashboardFigures['headline'] = null;
  if (distanceMetrics) {
    if (biFuel) {
      const allP = resolveRange('all_time', { now, createdAt: vehicle.createdAt })!;
      headline = { kind: 'costPerKm', value: costPerKm(periodCost(entries, allP), periodDistance(entries, allP, vehicle)) };
    } else {
      const firstFuel = vehicle.fuelTypes[0];
      const mileage = fuelMileage(
        entries.map((e) => toMileageEntry(e)).filter((e): e is NonNullable<typeof e> => e !== null),
      );
      let value: number | undefined;
      let bestMs = -1;
      for (const e of entries) {
        if (e.type !== 'fuel') continue;
        const det = e.details as FuelDetailsDoc | undefined;
        if (det?.fuelType !== firstFuel) continue;
        const m = mileage.get(e.id);
        if (m !== undefined) {
          const ms = tsToMillis(e.date);
          if (ms > bestMs) { bestMs = ms; value = m; }
        }
      }
      headline = { kind: 'mileage', fuelType: firstFuel, value };
    }
  }

  const hasIncome = hasIncomeEntries(entries);
  return {
    distanceMetrics,
    biFuel,
    headline,
    monthSpendMinor,
    prevMonthSpendMinor,
    monthCostPerKm: distanceMetrics ? costPerKm(monthSpendMinor, monthDistance) : undefined,
    costPerKm90: distanceMetrics ? costPerKm(periodCost(entries, window90), distance90) : undefined,
    incomeVsCost: hasIncome ? { income: periodIncome(entries, monthP), cost: monthSpendMinor } : undefined,
    hasIncome,
  };
}
