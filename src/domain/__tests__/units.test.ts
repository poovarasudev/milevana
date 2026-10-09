// FND-DAT-01: distance/volume/efficiency conversions both directions, hours
// behaviour, and display formatting.
import {
  convertDistance, convertEfficiency, convertVolume, displayDistance,
  formatDistance, formatEfficiency, formatVolume, usesDistanceMetrics,
  volumeToLitres,
} from '../units';

describe('distance conversion', () => {
  it('km <-> mi both directions with the exact factor', () => {
    expect(convertDistance(100, 'km', 'mi')).toBeCloseTo(62.1371, 4);
    expect(convertDistance(100, 'mi', 'km')).toBeCloseTo(160.9344, 4);
    expect(convertDistance(50, 'km', 'km')).toBe(50);
  });

  it('round-trips', () => {
    const mi = convertDistance(123.4, 'km', 'mi')!;
    expect(convertDistance(mi, 'mi', 'km')).toBeCloseTo(123.4, 6);
  });

  it('hours never converts and hides distance metrics', () => {
    expect(convertDistance(10, 'hours', 'km')).toBeNull();
    expect(usesDistanceMetrics('hours')).toBe(false);
    expect(usesDistanceMetrics('km')).toBe(true);
    const d = displayDistance(42, 'hours', 'km');
    expect(d.hideDistanceMetrics).toBe(true);
    expect(d.value).toBe(42);
  });
});

describe('volume conversion', () => {
  it('litres <-> US/UK gallons both directions', () => {
    expect(convertVolume(10, 'gal_us')).toBeCloseTo(2.6417, 4);
    expect(convertVolume(10, 'gal_uk')).toBeCloseTo(2.1997, 4);
    expect(volumeToLitres(1, 'gal_us')).toBeCloseTo(3.7854, 4);
    expect(volumeToLitres(1, 'gal_uk')).toBeCloseTo(4.5461, 4);
    expect(volumeToLitres(5, 'litres')).toBe(5);
  });
});

describe('efficiency', () => {
  it('km/l, L/100km, and mpg follow the volume setting (DR-07)', () => {
    expect(convertEfficiency(15, 'km_per_l')).toBe(15);
    expect(convertEfficiency(10, 'l_per_100km')).toBeCloseTo(10, 6);
    // mpg uses US gallons unless Volume is UK gallons.
    expect(convertEfficiency(10, 'mpg', 'litres')).toBeCloseTo(23.5215, 3);
    expect(convertEfficiency(10, 'mpg', 'gal_uk')).toBeCloseTo(28.2481, 3);
  });
});

describe('formatting', () => {
  it('formats distance, volume and efficiency', () => {
    expect(formatDistance(12.34, 'km')).toBe('12.3 km');
    expect(formatVolume(5.25, 'litres')).toBe('5.3 L');
    expect(formatVolume(2, 'gal_uk')).toBe('2.0 gal (UK)');
    expect(formatEfficiency(15, 'km_per_l')).toBe('15.0 km/l');
    expect(formatEfficiency(10, 'l_per_100km')).toBe('10.0 L/100 km');
    expect(formatEfficiency(10, 'mpg', 'gal_uk')).toBe('28.2 mpg');
  });
});
