// Display helpers for the Reports/Dashboard screens (PD-02..PD-07). Domain
// values stay in stored units + integer minor money; conversion to the user's
// display settings happens only at the edge.

import type { FuelType } from '../../domain/fuel';
import { formatNumber, formatRate } from '../../domain/money';
import {
  LITRES_PER_UK_GALLON,
  LITRES_PER_US_GALLON,
  KM_PER_MILE,
  displayDistance,
  type StoredDistanceUnit,
  type VolumeUnit,
} from '../../domain/units';
import type { SettingsDoc } from '../../features/format';
import { t } from '../../i18n';

/** distance text in the user's Distance setting (DR-08), same convention as
 *  the reminders due-text ('1,242 km' → '772.4 mi' when converted). */
export function distText(value: number, unit: StoredDistanceUnit, settings: SettingsDoc): string {
  const d = displayDistance(value, unit, settings.distanceUnit);
  const num = formatNumber(Number(d.value.toFixed(1)));
  return `${num} ${t(`units.${d.unit}`)}`;
}

/** rate conversion factor: minor per stored unit → minor per display unit. */
export function rateFactor(stored: StoredDistanceUnit, display: 'km' | 'mi'): number {
  if (stored === 'km' && display === 'mi') return KM_PER_MILE;
  if (stored === 'mi' && display === 'km') return 1 / KM_PER_MILE;
  return 1;
}

/** '₹12.00/km' style rate text in the display distance unit (PD-02). `hours`
 *  is never converted (OQ-11). */
export function rateText(
  minorPerUnit: number,
  currency: string,
  unit: StoredDistanceUnit,
  settings: SettingsDoc,
): string {
  const display = settings.distanceUnit === 'mi' ? 'mi' : 'km';
  const per = unit === 'hours' ? 'hours' : display;
  const rate = unit === 'hours' ? minorPerUnit : minorPerUnit * rateFactor(unit, display);
  return `${formatRate(rate, currency)}/${t(`units.${per}`)}`;
}

const LITRES_IN: Record<string, number> = {
  L: 1,
  gal_us: LITRES_PER_US_GALLON,
  gal_uk: LITRES_PER_UK_GALLON,
};

const LIQUID: readonly string[] = ['petrol', 'diesel', 'lpg'];

/** stored fuel-quantity unit → display quantity label + factor converting a
 *  price-per-stored-unit to price-per-display-unit (PD-04). Non-liquid units
 *  (kg, kWh) are never converted. */
export function quantityDisplay(
  unit: string,
  fuelType: string,
  volume: VolumeUnit,
): { label: string; factor: number } {
  if (!LIQUID.includes(fuelType) || !(unit in LITRES_IN)) {
    return { label: unitLabel(unit), factor: 1 };
  }
  const targetLitres = volume === 'litres' ? 1 : LITRES_IN[volume === 'gal_uk' ? 'gal_uk' : 'gal_us'];
  return { label: unitLabel(volume === 'litres' ? 'L' : volume), factor: targetLitres / LITRES_IN[unit] };
}

function unitLabel(unit: string): string {
  if (unit === 'gal_us') return 'gal (US)';
  if (unit === 'gal_uk') return 'gal (UK)';
  return unit;
}

/** '₹105.00/L' from a milli-minor-per-stored-unit price. */
export function priceText(
  milli: number,
  unit: string,
  fuelType: string,
  currency: string,
  settings: SettingsDoc,
): string {
  const q = quantityDisplay(unit, fuelType, settings.volumeUnit);
  return `${formatRate((milli / 1000) * q.factor, currency)}/${q.label}`;
}

/** numeric conversion of a stored-unit price to the display unit — used for
 *  the price-trend chart values so bars stay comparable across quantity units. */
export function priceValue(milli: number, unit: string, fuelType: string, settings: SettingsDoc): number {
  return (milli / 1000) * quantityDisplay(unit, fuelType, settings.volumeUnit).factor;
}

/** legend/series label: fuel name, or 'Vehicle · fuel' inside all-vehicles. */
export function seriesLabel(s: { fuelType: string; vehicleName: string }, multi: boolean): string {
  const fuel = t(`fuelTypes.${s.fuelType as FuelType}`) || s.fuelType;
  return multi && s.vehicleName ? `${s.vehicleName} · ${fuel}` : fuel;
}

export function monthShort(year: number, month: number): string {
  const name = t(`history.months.${month}`) || String(month + 1);
  return `${name.slice(0, 3)} ${String(year).slice(2)}`;
}

export function monthLong(year: number, month: number): string {
  const name = t(`history.months.${month}`) || String(month + 1);
  return `${name} ${year}`;
}

export type ChartPalette = {
  fuel: string;
  service: string;
  expense: string;
  income: string;
  cost: string;
  evHome: string;
  evPublic: string;
  evUnspecified: string;
  series: string[];
};

export const PALETTE: ChartPalette = {
  fuel: '#4C7BD9',
  service: '#2E8B7A',
  expense: '#C2410C',
  income: '#3E9B4F',
  cost: '#4C7BD9',
  evHome: '#2E8B7A',
  evPublic: '#4C7BD9',
  evUnspecified: '#8A8F98',
  series: ['#4C7BD9', '#2E8B7A', '#C2410C', '#8B5CF6', '#B8860B', '#C0392B'],
};
