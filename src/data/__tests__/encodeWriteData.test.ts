// Regression: Zod-parsed inputs keep absent optional fields as `key:
// undefined` (e.g. toVehicleInput's `make: v.make.trim() || undefined`).
// Firestore rejects undefined values, so the write encoder strips them —
// caught on-device where vehicle create died with a client-side
// FirebaseError instead of reaching the emulator.
import { arrayUnion, SERVER_TIMESTAMP } from '../adapter';
import { makeWriteEncoder } from '../encodeWrite';

const enc = {
  serverTimestamp: jest.fn(() => 'SERVER_TS'),
  arrayUnion: jest.fn((...els: unknown[]) => ({ union: els })),
  timestamp: jest.fn((s: number, n: number) => ({ ts: [s, n] })),
};
const encodeWriteData = makeWriteEncoder(enc);

describe('encodeWriteData undefined stripping', () => {
  it('drops undefined object keys, keeps null and falsy values', () => {
    const out = encodeWriteData({
      name: 'Car',
      make: undefined,
      model: undefined,
      count: 0,
      plate: null,
      archived: false,
    }) as Record<string, unknown>;
    expect('make' in out).toBe(false);
    expect('model' in out).toBe(false);
    expect(out.name).toBe('Car');
    expect(out.count).toBe(0);
    expect(out.plate).toBeNull();
    expect(out.archived).toBe(false);
  });

  it('strips undefined inside nested objects', () => {
    const out = encodeWriteData({
      details: { station: undefined, litres: 40 },
    }) as { details: Record<string, unknown> };
    expect('station' in out.details).toBe(false);
    expect(out.details.litres).toBe(40);
  });

  it('maps the platform sentinels', () => {
    expect(encodeWriteData(SERVER_TIMESTAMP)).toBe('SERVER_TS');
    expect(enc.serverTimestamp).toHaveBeenCalled();
    const out = encodeWriteData({ members: arrayUnion(['u2']), at: { seconds: 5, nanoseconds: 7 } }) as Record<string, unknown>;
    expect(out.members).toEqual({ union: ['u2'] });
    expect(out.at).toEqual({ ts: [5, 7] });
  });
});
