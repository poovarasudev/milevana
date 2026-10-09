// LOG-04/11/13/14 — per-vehicle entry watch, edit/delete authority (LD-13)
// and the 5-second delete-with-Undo window (LD-12).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { AppState } from 'react-native';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { resetAppStore, useAppStore } from '../appStore';
import { resetRuntimeForTests } from '../runtime';
import {
  canEditEntry, commitPendingDeletes, installDeleteFlush, requestDelete,
  startEntriesWatch, undoDelete, visibleEntries,
} from '../entries';
import { FakeAdapter } from './fakeAdapter';
import type { EntryDoc } from '../../data/schema/entry';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

const vehicleDoc = (over: Record<string, unknown> = {}) => ({
  name: 'Car', type: 'car', fuelTypes: ['petrol'], odometerUnit: 'km',
  currency: 'INR', color: 'c01', startOdometer: 0,
  lastOdometer: 0, lastOdometerAt: ts(1), archived: false,
  ownerId: 'u-owner', memberIds: ['u-owner', 'u-member'],
  members: {
    'u-owner': { role: 'owner', joinedAt: ts(1) },
    'u-member': { role: 'member', joinedAt: ts(1) },
  },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
});

const entryDoc = (createdBy: string, over: Record<string, unknown> = {}): EntryDoc => ({
  type: 'expense', date: ts(100), amount: { minor: 5000, currency: 'INR' },
  category: 'Parking', attachments: [], uploaderUids: [],
  createdBy, createdByName: createdBy === 'u-owner' ? 'Owner' : 'Member',
  updatedBy: createdBy, schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
});

let adapter: FakeAdapter;
let stops: (() => void)[] = [];

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

beforeEach(() => {
  jest.useRealTimers();
  resetAppStore();
  resetFirebaseForTests();
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.user = { uid: 'u-member', isAnonymous: false, displayName: 'Member', email: null };
  adapter.docs.set('vehicles/v1', vehicleDoc());
  adapter.docs.set('vehicles/v1/entries/e-mine', entryDoc('u-member'));
  adapter.docs.set('vehicles/v1/entries/e-other', entryDoc('u-owner'));
});

afterEach(() => {
  stops.forEach((s) => s());
  stops = [];
});

function seedEntry(over: Record<string, unknown>, id = 'e-mine') {
  adapter.docs.set(`vehicles/v1/entries/${id}`, entryDoc('u-member', over));
}

describe('startEntriesWatch (LOG-11)', () => {
  test('fills the read model newest first and stops cleanly', async () => {
    const stop = startEntriesWatch('v1');
    stops.push(stop);
    await Promise.resolve();
    const st = useAppStore.getState();
    expect(st.entriesVehicleId).toBe('v1');
    expect(st.entriesArrived).toBe(true);
    expect(st.entries.map((e) => e.id).sort()).toEqual(['e-mine', 'e-other']);
    stop();
    // the fake keeps the listener Set; it must be empty after unsubscribing
    expect([...adapter.queryListeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});

describe('authority (LD-13)', () => {
  const vehicle = () => useAppStore.getState().vehicles.find((v) => v.id === 'v1');
  const rec = (createdBy: string) =>
    ({ ...entryDoc(createdBy), id: 'x', pending: false }) as any;

  beforeEach(() => {
    useAppStore.setState({
      vehicles: [{ ...vehicleDoc(), id: 'v1' } as any],
      user: adapter.user,
    });
  });

  test('creator may edit; the owner may edit anyone\'s; another member cannot', () => {
    const v = vehicle()!;
    expect(canEditEntry(rec('u-member'), v, 'u-member')).toBe(true);
    expect(canEditEntry(rec('u-member'), v, 'u-owner')).toBe(true); // owner
    expect(canEditEntry(rec('u-owner'), v, 'u-member')).toBe(false); // member on owner's
    expect(canEditEntry(rec('u-member'), null, 'u-member')).toBe(false);
  });

  test('archived vehicles are read-only for everyone', () => {
    const v = { ...vehicle()!, archived: true };
    expect(canEditEntry(rec('u-member'), v, 'u-member')).toBe(false);
    expect(canEditEntry(rec('u-member'), v, 'u-owner')).toBe(false);
  });
});

describe('delete with Undo (LOG-14, LD-12)', () => {
  async function watched() {
    useAppStore.setState({
      vehicles: [{ ...vehicleDoc(), id: 'v1' } as any],
      user: adapter.user,
    });
    const stop = startEntriesWatch('v1');
    stops.push(stop);
    await Promise.resolve();
  }

  test('requestDelete hides the row at once with no write; expiry commits it', async () => {
    jest.useFakeTimers();
    try {
      await watched();
      const mine = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
      expect(requestDelete('v1', mine)).toBe(true);
      // hidden immediately, nothing written
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(true);
      expect(visibleEntries(useAppStore.getState().entries).map((e) => e.id)).toEqual(['e-other']);
      // after the window the real delete happens
      await jest.advanceTimersByTimeAsync(5100);
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(false);
      // and lastOdometer was recomputed by the repo (odometer doc removed)
      expect(useAppStore.getState().pendingDeletes['e-mine']).toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  test('Undo inside the window restores the row; no write ever happens', async () => {
    jest.useFakeTimers();
    try {
      await watched();
      const mine = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
      requestDelete('v1', mine);
      undoDelete('e-mine');
      await jest.advanceTimersByTimeAsync(10_000);
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(true);
      expect(visibleEntries(useAppStore.getState().entries).some((e) => e.id === 'e-mine')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('two deletes each keep their own window', async () => {
    jest.useFakeTimers();
    try {
      seedEntry({ notes: 'second' }, 'e-second');
      await watched();
      const a = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
      requestDelete('v1', a);
      await jest.advanceTimersByTimeAsync(3000);
      const b = useAppStore.getState().entries.find((e) => e.id === 'e-second')!;
      requestDelete('v1', b);
      // undo the LATEST only — the first delete still commits on its own clock
      undoDelete('e-second');
      await jest.advanceTimersByTimeAsync(2100); // a's window ends
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(false);
      expect(adapter.docs.has('vehicles/v1/entries/e-second')).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  test('backgrounding commits every pending delete at once', async () => {
    await watched();
    const mine = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
    requestDelete('v1', mine);
    commitPendingDeletes();
    await flush();
    expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(false);
  });

  test('a member is never offered delete on another member\'s entry', async () => {
    await watched();
    const other = useAppStore.getState().entries.find((e) => e.id === 'e-other')!;
    expect(requestDelete('v1', other)).toBe(false);
    expect(adapter.docs.has('vehicles/v1/entries/e-other')).toBe(true);
  });

  test('the owner CAN delete a member\'s entry', async () => {
    adapter.user = { uid: 'u-owner', isAnonymous: false, displayName: 'Owner', email: null };
    await watched();
    const other = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
    expect(requestDelete('v1', other)).toBe(true);
  });
});

describe('installDeleteFlush (LD-12 background commit)', () => {
  test('subscribes to AppState and commits on background', async () => {
    const events: Record<string, (state: string) => void> = {};
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      // @ts-expect-error test shim
      .mockImplementation((ev: string, cb: (state: string) => void) => {
        events[ev] = cb;
        return { remove: () => delete events[ev] };
      });
    try {
      useAppStore.setState({
        vehicles: [{ ...vehicleDoc(), id: 'v1' } as any],
        user: adapter.user,
      });
      const stopWatch = startEntriesWatch('v1');
      const stopFlush = installDeleteFlush();
      stops.push(stopWatch, stopFlush);
      await Promise.resolve();
      const mine = useAppStore.getState().entries.find((e) => e.id === 'e-mine')!;
      requestDelete('v1', mine);
      events['change']?.('active'); // still foreground — nothing commits
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(true);
      events['change']?.('background'); // backgrounding commits at once
      await flush();
      expect(adapter.docs.has('vehicles/v1/entries/e-mine')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
