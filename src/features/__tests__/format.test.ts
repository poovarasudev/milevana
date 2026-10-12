import { USER_DEFAULTS } from '../../data/repos/userRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { displayOdometer } from '../format';

// Regression: the vehicle detail screen labels a value "Start odometer" and used
// to print the current odometer there (found on the 2026-10-12 web run).
describe('displayOdometer', () => {
  const vehicle = {
    startOdometer: 1000,
    lastOdometer: 1400,
    odometerUnit: 'km',
  } as unknown as VehicleRecord;
  const settings = { ...USER_DEFAULTS, distanceUnit: 'km' } as never;

  it('defaults to the current odometer', () => {
    expect(displayOdometer(vehicle, settings)).toContain('1,400');
  });

  it('shows the start odometer when asked', () => {
    const out = displayOdometer(vehicle, settings, 'start');
    expect(out).toContain('1,000');
    expect(out).not.toContain('1,400');
  });
});
