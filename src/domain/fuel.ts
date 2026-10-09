// LOG-02 — pure fuel logic (LD-01, LD-02, LD-03): the "any two of price per
// unit, quantity and total" solver, mileage between consecutive full fills of
// the same fuel, and the fixed per-fuel unit rules (CNG kg, EV kWh, liquid
// fuels follow the Volume setting). Money stays in integer minor units and
// prices in thousandths of a minor unit — no floats are ever stored.

import { FUEL_TYPES, type Timestamp } from '../data/schema/common';
import {
  formatEfficiency, KM_PER_MILE, LITRES_PER_UK_GALLON, LITRES_PER_US_GALLON,
  type StoredDistanceUnit, type VolumeUnit,
} from './units';
import { decimalToMinor, exponentOf, minorToDecimal } from './money';
import type { FuelDetailsDoc } from '../data/schema/entry';
import type { SettingsDoc } from '../data/schema/user';

export type FuelType = (typeof FUEL_TYPES)[number];

export type QuantityUnit = FuelDetailsDoc['quantityUnit'];

export interface FuelAmounts {
  /** quantity in `quantityUnit`, at most 3 decimals */
  quantity?: number;
  /** price per quantity unit, in thousandths of a minor unit */
  pricePerUnitMilli?: number;
  /** total, integer minor units */
  totalMinor?: number;
}

/** round(n / d) half-up with exact integer arithmetic — n, d > 0. */
function roundDivHalfUp(n: bigint, d: bigint): bigint {
  return (2n * n + d) / (2n * d);
}

const toQtyMilli = (q: number) => BigInt(Math.round(q * 1000));

/**
 * Given any two of price/quantity/total, derive the third (LD-03):
 *  total = price × quantity, rounded half-up to the minor unit;
 *  price = total ÷ quantity, rounded half-up to the milli-unit;
 *  quantity = total ÷ price, rounded to 3 decimals.
 * The two most recently edited fields count as entered — the caller passes
 * only those; when all three arrive they are returned untouched.
 */
export function solveFuel(inputs: FuelAmounts): FuelAmounts {
  const q = inputs.quantity !== undefined && inputs.quantity > 0 ? inputs.quantity : undefined;
  const p = inputs.pricePerUnitMilli !== undefined && inputs.pricePerUnitMilli > 0 ? inputs.pricePerUnitMilli : undefined;
  const t = inputs.totalMinor !== undefined && inputs.totalMinor > 0 ? inputs.totalMinor : undefined;
  const out: FuelAmounts = { ...inputs };
  if (p !== undefined && q !== undefined && t === undefined) {
    out.totalMinor = Number(roundDivHalfUp(BigInt(p) * toQtyMilli(q), 1_000_000n));
  } else if (t !== undefined && q !== undefined && p === undefined) {
    out.pricePerUnitMilli = Number(roundDivHalfUp(BigInt(t) * 1_000_000n, toQtyMilli(q)));
  } else if (t !== undefined && p !== undefined && q === undefined) {
    out.quantity = Number(roundDivHalfUp(BigInt(t) * 1_000_000n, BigInt(p))) / 1000;
  }
  return out;
}

// --- mileage ---------------------------------------------------------------

/** What a fuel entry contributes to a mileage computation. */
export interface MileageEntry {
  id: string;
  fuelType: string;
  odometer?: number;
  quantity: number;
  quantityUnit: string;
  fullTank: boolean;
  missedPrevious: boolean;
  date: Timestamp;
  createdAt: Timestamp;
}

const cmpTs = (a: Timestamp, b: Timestamp) => a.seconds - b.seconds || a.nanoseconds - b.nanoseconds;

/** Flatten a fuel EntryRecord into the shape fuelMileage needs. */
export function toMileageEntry(e: {
  id: string; type: string; date: Timestamp;
  createdAt: { seconds: number; nanoseconds: number }; odometer?: number; details?: unknown;
}): MileageEntry | null {
  const d = e.details as FuelDetailsDoc | undefined;
  if (e.type !== 'fuel' || !d) return null;
  return {
    id: e.id, fuelType: d.fuelType, odometer: e.odometer, quantity: d.quantity,
    quantityUnit: d.quantityUnit, fullTank: d.fullTank,
    missedPrevious: d.missedPrevious, date: e.date, createdAt: e.createdAt,
  };
}

/** Canonical quantity: litres for liquid fuels, kg for CNG, kWh for electric. */
export function canonicalQuantity(quantity: number, unit: string): number {
  if (unit === 'gal_us') return quantity * LITRES_PER_US_GALLON;
  if (unit === 'gal_uk') return quantity * LITRES_PER_UK_GALLON;
  return quantity;
}

/**
 * Mileage per fuel entry — Map<entryId, rate> where the rate is distance (in
 * the vehicle's odometer unit) per canonical fuel unit (L / kg / kWh).
 * LD-01: computed only for a full fill that follows an earlier full fill of
 * the SAME fuel; the divisor is the later full fill's quantity plus every
 * partial fill of that fuel in between; `missedPrevious` on the later fill or
 * any in-between fill suppresses the interval. Entries are ordered by entry
 * date, then creation time (same order as the odometer check, LD-05).
 */
export function fuelMileage(entries: MileageEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  const byFuel = new Map<string, MileageEntry[]>();
  for (const e of entries) {
    if (!byFuel.has(e.fuelType)) byFuel.set(e.fuelType, []);
    byFuel.get(e.fuelType)!.push(e);
  }
  for (const group of byFuel.values()) {
    const sorted = [...group].sort(
      (a, b) => cmpTs(a.date, b.date) || cmpTs(a.createdAt, b.createdAt),
    );
    let prevFull: MileageEntry | null = null;
    let since: MileageEntry[] = []; // entries after prevFull (partials + any)
    for (const e of sorted) {
      if (e.fullTank && e.odometer !== undefined) {
        if (prevFull !== null) {
          const missed = e.missedPrevious || since.some((x) => x.missedPrevious);
          const distance = e.odometer - prevFull.odometer!;
          const qty = since
            .concat(e)
            .reduce((s, x) => s + canonicalQuantity(x.quantity, x.quantityUnit), 0);
          if (!missed && distance > 0 && qty > 0) out.set(e.id, distance / qty);
        }
        prevFull = e;
        since = [];
      } else {
        since.push(e);
      }
    }
  }
  return out;
}

/** Display a mileage rate per the fixed unit rules (OQ-42, DR-07). */
export function formatMileage(
  rate: number | undefined,
  fuelType: string,
  vehicleUnit: StoredDistanceUnit,
  settings: Pick<SettingsDoc, 'efficiencyFormat' | 'volumeUnit'>,
): string | null {
  if (rate === undefined || vehicleUnit === 'hours') return null;
  if (fuelType === 'electric') return `${rate.toFixed(1)} ${vehicleUnit}/kWh`;
  if (fuelType === 'cng') return `${rate.toFixed(1)} ${vehicleUnit}/kg`;
  // liquid fuels: canonical km/l → the Efficiency format setting
  const kmPerLitre = vehicleUnit === 'mi' ? rate * KM_PER_MILE : rate;
  return formatEfficiency(kmPerLitre, settings.efficiencyFormat, settings.volumeUnit);
}

// --- form defaults (LD-02) --------------------------------------------------

const LIQUID_UNITS: QuantityUnit[] = ['L', 'gal_us', 'gal_uk'];

/** Units the per-entry picker offers for a fuel type. */
export function quantityUnitsFor(fuelType: FuelType): QuantityUnit[] {
  if (fuelType === 'cng') return ['kg'];
  if (fuelType === 'electric') return ['kWh'];
  return LIQUID_UNITS;
}

/** Default quantity unit: Volume setting for liquid fuels, fixed otherwise. */
export function defaultQuantityUnit(fuelType: FuelType, volume: VolumeUnit): QuantityUnit {
  if (fuelType === 'cng') return 'kg';
  if (fuelType === 'electric') return 'kWh';
  return volume === 'litres' ? 'L' : volume;
}

/** The vehicle's first fuel type, overridden by the last used one (LD-02). */
export function defaultFuelType(
  fuelTypes: readonly FuelType[],
  fuelEntries: Pick<MileageEntry, 'fuelType' | 'date' | 'createdAt'>[],
): FuelType {
  const sorted = [...fuelEntries].sort(
    (a, b) => cmpTs(a.date, b.date) || cmpTs(a.createdAt, b.createdAt),
  );
  const last = sorted[sorted.length - 1]?.fuelType as FuelType | undefined;
  return last !== undefined && fuelTypes.includes(last) ? last : fuelTypes[0];
}

// --- the fuel form's two-of-three input state (LD-03) -------------------------

export type FuelFieldKey = 'quantity' | 'price' | 'total';

export interface FuelInputState {
  /** raw text the user typed (empty string = untouched/cleared) */
  quantity: string;
  price: string;
  total: string;
  /** most-recently-edited keys, newest last — the two valid ones are inputs */
  order: FuelFieldKey[];
}

export const emptyFuelInputs: FuelInputState = { quantity: '', price: '', total: '', order: [] };

export function fuelEdit(s: FuelInputState, key: FuelFieldKey, text: string): FuelInputState {
  return {
    ...s,
    [key]: text,
    order: [...s.order.filter((k) => k !== key), key],
  };
}

/** Quantity text → number, or undefined when empty/invalid/not ≤3 decimals. */
export function parseQuantity(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? n : undefined;
}

/**
 * Price text (major units, up to 3 decimals) → thousandths of a minor unit.
 * '1.459' INR → 145,900 milli-paise. Returns undefined when invalid or zero.
 */
export function parsePriceMilli(text: string, currency: string): number | undefined {
  const t = text.trim();
  const m = /^(\d+)(?:\.(\d{1,3}))?$/.exec(t);
  if (!m) return undefined;
  const milli = BigInt(m[1]) * 1000n + BigInt((m[2] ?? '').padEnd(3, '0'));
  const scaled = milli * BigInt(10) ** BigInt(exponentOf(currency));
  if (scaled === 0n || scaled > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  return Number(scaled);
}

/** Total text (major units) → integer minor units; undefined when invalid/zero. */
export function parseTotalMinor(text: string, currency: string): number | undefined {
  try {
    const minor = decimalToMinor(text, currency);
    return minor > 0 ? minor : undefined;
  } catch {
    return undefined;
  }
}

/** milli-minor per unit → display text in major units (up to 3 decimals). */
export function formatPriceMilli(milli: number, currency: string): string {
  const major = milli / 1000 / 10 ** exponentOf(currency);
  return String(parseFloat(major.toFixed(6)));
}

export function formatQuantity(q: number): string {
  return String(parseFloat(q.toFixed(3)));
}

export interface FuelResolved {
  /** the field currently derived from the other two, if any */
  computed?: FuelFieldKey;
  amounts: FuelAmounts;
  /** display text for the computed field */
  computedText?: string;
  /** true when both parsed inputs are positive and the third exists */
  complete: boolean;
}

/**
 * Resolve the input state: the two most recently edited fields are the
 * inputs; the third recalculates (LD-03). Derivation only happens when both
 * inputs parse to positive values — while the user is mid-edit everything
 * shows raw text.
 */
export function fuelResolved(s: FuelInputState, currency: string): FuelResolved {
  const parsed: FuelAmounts = {
    quantity: parseQuantity(s.quantity),
    pricePerUnitMilli: parsePriceMilli(s.price, currency),
    totalMinor: parseTotalMinor(s.total, currency),
  };
  const inputs = s.order.slice(-2);
  const computed = (['quantity', 'price', 'total'] as FuelFieldKey[]).find(
    (k) => !inputs.includes(k),
  );
  if (inputs.length !== 2 || computed === undefined) {
    return { amounts: parsed, complete: false };
  }
  const solved = solveFuel({
    quantity: inputs.includes('quantity') ? parsed.quantity : undefined,
    pricePerUnitMilli: inputs.includes('price') ? parsed.pricePerUnitMilli : undefined,
    totalMinor: inputs.includes('total') ? parsed.totalMinor : undefined,
  });
  const computedText =
    computed === 'quantity' && solved.quantity !== undefined ? formatQuantity(solved.quantity)
    : computed === 'price' && solved.pricePerUnitMilli !== undefined ? formatPriceMilli(solved.pricePerUnitMilli, currency)
    : computed === 'total' && solved.totalMinor !== undefined ? String(minorToDecimal(solved.totalMinor, currency))
    : undefined;
  if (computedText === undefined) return { amounts: parsed, complete: false };
  return { computed, amounts: solved, computedText, complete: true };
}
