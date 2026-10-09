// FND-AUTH-01/05, FND-SHL-04, FND-OBS-03 — bootstrap phases, the Connect gate,
// selection resolution (MRU) and the access-lost flag.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { FirebaseConfigError } from '../../data/firebaseConfig';
import { localFlags } from '../../data/localFlags';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { resetAppStore, useAppStore } from '../appStore';
import { getRepos, resetRuntimeForTests } from '../runtime';
import {
  handleVehicleList, resolveSelection, selectVehicle, startSession, retryBootstrap,
} from '../session';
import { FakeAdapter } from './fakeAdapter';

const flush = async (n = 8) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

let adapter: FakeAdapter;
let stop: (() => void) | null = null;

function boot(platform: 'native' | 'web' = 'native'): void {
  adapter = new FakeAdapter(platform);
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  stop = startSession();
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
});

afterEach(() => {
  stop?.();
  stop = null;
});

test('native first launch bootstraps anonymously and seeds the user doc (FR-AUTH-02, DR-03f)', async () => {
  boot('native');
  adapter.setUser(null); // auth listener's initial null
  await flush();
  const st = useAppStore.getState();
  expect(st.phase).toBe('ready');
  expect(st.user?.isAnonymous).toBe(true);
  const uid = st.user!.uid;
  expect(adapter.docs.has(`users/${uid}`)).toBe(true);
  expect(st.userDoc?.settings.currency).toBe('INR');
  expect(st.userDoc?.settings.distanceUnit).toBe('km');
});

test('offline bootstrap shows the Connect gate; Try now recovers (FR-AUTH-05)', async () => {
  boot('native');
  adapter.anonFail = new AuthError('unavailable');
  adapter.setUser(null);
  await flush();
  expect(useAppStore.getState().phase).toBe('connect');

  adapter.anonFail = null;
  retryBootstrap();
  await flush();
  expect(useAppStore.getState().phase).toBe('ready');
});

test('non-network bootstrap failure shows the error gate, not Connect', async () => {
  boot('native');
  adapter.anonFail = new AuthError('unknown');
  adapter.setUser(null);
  await flush();
  expect(useAppStore.getState().phase).toBe('error');
});

test('a failing adapter factory gates on config and names the missing vars', async () => {
  // Missing/invalid EXPO_PUBLIC_FIREBASE_* on web threw at startup and left a
  // blank screen; the config gate names the variables instead (runbook link).
  setFirebaseFactory(() => {
    throw new FirebaseConfigError(['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_APP_ID']);
  });
  resetRuntimeForTests();
  stop = startSession();
  await flush();
  const st = useAppStore.getState();
  expect(st.phase).toBe('config');
  expect(st.configMissingVars).toEqual([
    'EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_APP_ID',
  ]);
});

test('web visitor lands on the sign-in gate, never anonymous (FR-WEB-01)', async () => {
  boot('web');
  adapter.setUser(null);
  await flush();
  const st = useAppStore.getState();
  expect(st.phase).toBe('signin');
  expect(st.user).toBeNull();
});

test('a stored merge bundle gates navigation on merge-resume (FR-MERGE-10)', async () => {
  await localFlags.saveMergeRetry({ vehicles: [] } as never);
  boot('native');
  adapter.setUser(null);
  await flush();
  const st = useAppStore.getState();
  expect(st.phase).toBe('merge-resume');
  expect(st.mergeResumeAvailable).toBe(true);
});

test('the vehicle watch selects the only vehicle and restores MRU (DR-15)', async () => {
  boot('native');
  adapter.setUser(null);
  await flush();
  const repos = getRepos();
  const v1 = await repos.vehicles.create({
    name: 'Car One', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 100,
  });
  await flush();
  expect(useAppStore.getState().vehicles.map((v) => v.id)).toEqual([v1]);
  expect(useAppStore.getState().selectedVehicleId).toBe(v1);

  const v2 = await repos.vehicles.create({
    name: 'Car Two', type: 'bike', color: 'c02', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  });
  await flush();
  await selectVehicle(v2);
  const st = useAppStore.getState();
  expect(st.selectedVehicleId).toBe(v2);
  expect(st.mru[0]).toBe(v2); // MRU persisted for the next launch
  await expect(localFlags.mru(st.user!.uid)).resolves.toContain(v2);
});

test('resolveSelection: keep current > MRU > oldest active (DR-15)', () => {
  const mk = (id: string, created: number, archived = false): VehicleRecord =>
    ({
      id, pending: false, name: id, type: 'car', color: 'c01', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 0, lastOdometer: 0,
      ownerId: 'me', memberIds: ['me'], members: {}, archived,
      createdAt: { seconds: created, nanoseconds: 0 },
      updatedAt: { seconds: created, nanoseconds: 0 },
      updatedBy: 'me', schemaVersion: 1,
    }) as unknown as VehicleRecord;

  const a = mk('a', 1);
  const b = mk('b', 2);
  const c = mk('c', 3);
  expect(resolveSelection([a, b, c], [], 'b')).toBe('b'); // current survives
  expect(resolveSelection([a, b, c], ['c', 'a'], null)).toBe('c'); // MRU wins
  expect(resolveSelection([a, b, c], ['gone'], null)).toBe('a'); // oldest active
  expect(resolveSelection([mk('x', 5, true), a], [], null)).toBe('a'); // archived skipped
  expect(resolveSelection([], ['a'], null)).toBeNull();
});

test('losing the selected vehicle owned by someone else flags access-lost (FND-OBS-03)', () => {
  const shared = {
    id: 'v9', pending: false, name: 'Shared car', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 0, ownerId: 'someone-else',
    memberIds: ['me', 'someone-else'], members: {}, archived: false,
    createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 },
    updatedBy: 'someone-else', schemaVersion: 1,
  } as unknown as VehicleRecord;

  useAppStore.setState({
    user: { uid: 'me', isAnonymous: false, displayName: null, email: null },
    vehicles: [shared],
    selectedVehicleId: 'v9',
  });
  handleVehicleList([]); // membership revoked → watch emits without it
  const st = useAppStore.getState();
  expect(st.accessLost).toBe(true);
  expect(st.selectedVehicleId).toBeNull();
  expect(adapter.reports.length).toBeGreaterThan(0);
});

test('losing a vehicle I owned does not flag access-lost', () => {
  const mine = {
    id: 'v1', pending: false, name: 'Mine', type: 'car', color: 'c01',
    fuelTypes: ['petrol'], odometerUnit: 'km', currency: 'INR',
    startOdometer: 0, lastOdometer: 0, ownerId: 'me',
    memberIds: ['me'], members: {}, archived: false,
    createdAt: { seconds: 1, nanoseconds: 0 }, updatedAt: { seconds: 1, nanoseconds: 0 },
    updatedBy: 'me', schemaVersion: 1,
  } as unknown as VehicleRecord;
  useAppStore.setState({
    user: { uid: 'me', isAnonymous: true, displayName: null, email: null },
    vehicles: [mine],
    selectedVehicleId: 'v1',
  });
  handleVehicleList([]);
  expect(useAppStore.getState().accessLost).toBe(false);
});
