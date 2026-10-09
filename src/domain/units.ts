// Display-only unit conversion (FR-DATA-12, NFR-08). Stored values keep the
// vehicle's own unit; these functions convert for display and never mutate
// their input. Odometer unit `hours` is never converted and flags
// distance-based metrics as hidden (FR-VEH-16, OQ-11).

export type StoredDistanceUnit = 'km' | 'mi' | 'hours';
export type DisplayDistanceUnit = 'km' | 'mi';
export type VolumeUnit = 'litres' | 'gal_us' | 'gal_uk';
export type EfficiencyFormat = 'km_per_l' | 'l_per_100km' | 'mpg';

export const KM_PER_MILE = 1.609344;
export const LITRES_PER_US_GALLON = 3.785411784;
export const LITRES_PER_UK_GALLON = 4.54609;

/** Whether a vehicle's odometer unit supports distance-based metrics. */
export function usesDistanceMetrics(unit: StoredDistanceUnit): boolean {
  return unit !== 'hours';
}

/** Convert a distance between km and mi (exact factor). Returns null for `hours`. */
export function convertDistance(value: number, from: StoredDistanceUnit, to: DisplayDistanceUnit): number | null {
  if (from === 'hours') return null;
  if (from === to) return value;
  return from === 'km' ? value / KM_PER_MILE : value * KM_PER_MILE;
}

/**
 * Display a stored odometer/distance value in the user's Distance setting.
 * `hours` passes through unconverted and reports `hideDistanceMetrics`.
 */
export function displayDistance(
  value: number,
  storedUnit: StoredDistanceUnit,
  setting: DisplayDistanceUnit,
): { value: number; unit: string; converted: boolean; hideDistanceMetrics: boolean } {
  if (storedUnit === 'hours') {
    return { value, unit: 'hours', converted: false, hideDistanceMetrics: true };
  }
  const converted = convertDistance(value, storedUnit, setting);
  return { value: converted ?? value, unit: setting, converted: converted !== value, hideDistanceMetrics: false };
}

/** Convert a volume between litres, US gallons and UK gallons. */
export function convertVolume(litres: number, to: VolumeUnit): number {
  if (to === 'gal_us') return litres / LITRES_PER_US_GALLON;
  if (to === 'gal_uk') return litres / LITRES_PER_UK_GALLON;
  return litres;
}

export function volumeToLitres(value: number, from: VolumeUnit): number {
  if (from === 'gal_us') return value * LITRES_PER_US_GALLON;
  if (from === 'gal_uk') return value * LITRES_PER_UK_GALLON;
  return value;
}

/** Fuel efficiency: input is km/l; mpg uses US gallons unless Volume is UK gallons (DR-07 ◐). */
export function convertEfficiency(kmPerLitre: number, format: EfficiencyFormat, volume: VolumeUnit = 'litres'): number {
  if (format === 'l_per_100km') return 100 / kmPerLitre;
  if (format === 'mpg') {
    const litresPerGallon = volume === 'gal_uk' ? LITRES_PER_UK_GALLON : LITRES_PER_US_GALLON;
    return kmPerLitre * (litresPerGallon / KM_PER_MILE);
  }
  return kmPerLitre;
}

export const EFFICIENCY_LABEL: Record<EfficiencyFormat, string> = {
  km_per_l: 'km/l',
  l_per_100km: 'L/100 km',
  mpg: 'mpg',
};

/** Converted distance and volume display one decimal; efficiency one decimal (DR-07 ◐). */
export function formatDistance(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`;
}

export function formatVolume(value: number, unit: VolumeUnit): string {
  const label = unit === 'litres' ? 'L' : unit === 'gal_uk' ? 'gal (UK)' : 'gal (US)';
  return `${value.toFixed(1)} ${label}`;
}

export function formatEfficiency(kmPerLitre: number, format: EfficiencyFormat, volume: VolumeUnit = 'litres'): string {
  return `${convertEfficiency(kmPerLitre, format, volume).toFixed(1)} ${EFFICIENCY_LABEL[format]}`;
}
