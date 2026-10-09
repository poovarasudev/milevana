// Settings-driven display helpers (DR-07/DR-08). Screens format through these
// so a settings change re-renders display values without touching stored data
// (FR-SET-03).

import { USER_DEFAULTS } from '../data/repos/userRepo';
import type { SettingsDoc } from '../data/schema/user';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import type { Timestamp } from '../data/schema/common';
import { displayDistance } from '../domain/units';
import { formatAmount, formatNumber, Money } from '../domain/money';
import { useAppStore } from './appStore';
import { t } from '../i18n';

/** Settings for the signed-in user; defaults before the doc lands. */
export function useSettings(): SettingsDoc {
  const doc = useAppStore((s) => s.userDoc);
  return doc?.settings ?? { ...USER_DEFAULTS, locale: 'en' };
}

export function formatDate(ts: Timestamp, format: SettingsDoc['dateFormat']): string {
  const d = new Date(ts.seconds * 1000);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  switch (format) {
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    default: return `${dd}/${mm}/${yyyy}`;
  }
}

/**
 * Vehicle odometer for display: converted to the Distance setting with one
 * decimal when converted; `hours` is never converted (FR-VEH-16).
 */
export function displayOdometer(vehicle: VehicleRecord, settings: SettingsDoc): string {
  const d = displayDistance(vehicle.lastOdometer, vehicle.odometerUnit, settings.distanceUnit);
  const unitLabel = t(`units.${d.unit}`);
  const num = d.converted ? d.value.toFixed(1) : formatNumber(d.value);
  return `${num} ${unitLabel}`;
}

/** The read-only preview line on Settings: currency · volume · efficiency · date. */
export function settingsPreview(settings: SettingsDoc): string {
  const money = formatAmount({ minor: 245000, currency: settings.currency } as Money);
  const volume = settings.volumeUnit === 'litres' ? '10.0 L' : settings.volumeUnit === 'gal_us' ? '2.6 gal (US)' : '2.2 gal (UK)';
  const eff = settings.efficiencyFormat === 'km_per_l' ? '18.4 km/l' : settings.efficiencyFormat === 'l_per_100km' ? '5.4 L/100 km' : '43.3 mpg';
  const date = formatDate({ seconds: 1_796_400_000, nanoseconds: 0 }, settings.dateFormat);
  return `${money} · ${volume} · ${eff} · ${date}`;
}

export type { SettingsDoc };
