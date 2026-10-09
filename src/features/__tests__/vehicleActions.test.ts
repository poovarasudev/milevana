// FND-VEH-01..04 — name uniqueness, typed-name delete match, the failed-delete
// marker and the web write timeout.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepoError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import type { VehicleInput } from '../../data/schema/vehicle';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { resetAppStore, useAppStore } from '../appStore';
import { resetRuntimeForTests, getRepos } from '../runtime';
import {
  createVehicle, deleteNameMatches, deleteVehicle, guardedWrite, updateVehicle,
  vehicleNameTaken, WEB_WRITE_TIMEOUT_MS,
} from '../vehicleActions';
import { FakeAdapter } from './fakeAdapter';

const input = (name: string): VehicleInput => ({
  name, type: 'car', color: 'c01', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', startOdometer: 0,
});

let adapter: FakeAdapter;

function boot(platform: 'native' | 'web' = 'web'): void {
  adapter = new FakeAdapter(platform);
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.setUser({ uid: 'me', isAnonymous: true, displayName: null, email: null });
  useAppStore.setState({ user: adapter.currentUser() });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
});

test('createVehicle rejects a duplicate name (case/space-insensitive)', async () => {
  boot('web');
  await createVehicle(input('My Car'));
  // refresh the read model the way the watch would
  useAppStore.setState({ vehicles: await getRepos().vehicles.listMine() });
  await expect(createVehicle(input('  my car '))).rejects.toMatchObject({ code: 'invalid-argument' });
  expect(vehicleNameTaken('MY CAR')).toBe(true);
  expect(vehicleNameTaken('Other', 'some-id')).toBe(false);
});

test('updateVehicle rejects a name taken by a different vehicle', async () => {
  boot('web');
  const a = await createVehicle(input('Alpha'));
  const b = await createVehicle(input('Beta'));
  useAppStore.setState({ vehicles: await getRepos().vehicles.listMine() });
  await expect(updateVehicle(b, { name: 'alpha' })).rejects.toMatchObject({ code: 'invalid-argument' });
  await updateVehicle(b, { name: 'Beta II' }); // same id excluded from the check
  useAppStore.setState({ vehicles: await getRepos().vehicles.listMine() });
  await expect(updateVehicle(a, { name: 'Beta II' })).rejects.toMatchObject({ code: 'invalid-argument' });
});

test('deleteNameMatches trims and ignores case (DR-14)', () => {
  const v = { name: 'City Runner' } as VehicleRecord;
  expect(deleteNameMatches(v, 'city runner')).toBe(true);
  expect(deleteNameMatches(v, '  City Runner  ')).toBe(true);
  expect(deleteNameMatches(v, 'city')).toBe(false);
  expect(deleteNameMatches(v, '')).toBe(false);
});

test('a failed delete is marked on-device for manual retry (DR-14)', async () => {
  boot('web');
  const id = await createVehicle(input('Doomed'));
  adapter.commitAck = { reject: new RepoError('unavailable') };
  await expect(deleteVehicle(id)).rejects.toMatchObject({ code: 'unavailable' });
  expect(useAppStore.getState().deleteFailedIds).toContain(id);
});

test('a successful delete clears a previous failed marker', async () => {
  boot('web');
  const id = await createVehicle(input('Phoenix'));
  adapter.commitAck = { reject: new RepoError('unavailable') };
  await expect(deleteVehicle(id)).rejects.toMatchObject({ code: 'unavailable' });
  adapter.commitAck = 'ok';
  await deleteVehicle(id);
  expect(useAppStore.getState().deleteFailedIds).not.toContain(id);
  expect(adapter.docs.has(`vehicles/${id}`)).toBe(false);
});

test('web writes time out after 15 s and flag the offline banner (DR-18)', async () => {
  jest.useFakeTimers();
  try {
    boot('web');
    const p = guardedWrite(new Promise<string>(() => undefined)); // never settles
    const assertion = expect(p).rejects.toMatchObject({ code: 'offline' });
    jest.advanceTimersByTime(WEB_WRITE_TIMEOUT_MS);
    await assertion;
    expect(useAppStore.getState().online).toBe(false);
  } finally {
    jest.useRealTimers();
  }
});

test('native writes never race the web timeout', async () => {
  boot('native');
  const result = await guardedWrite(Promise.resolve('done'));
  expect(result).toBe('done');
});
