// REL-05/06/07/08 — the account-deletion engine over the in-memory adapter:
// plan build, ordered steps, progress record, resume after failure, the
// mid-run member fallback and the anonymous "Delete all my data" path.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError, RepoError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { localFlags } from '../../data/localFlags';
import type { VehicleDoc } from '../../data/schema/vehicle';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { USER_DEFAULTS } from '../../data/repos/userRepo';
import { resetAppStore } from '../appStore';
import { getRepos, resetRuntimeForTests } from '../runtime';
import {
  buildMyDeletionPlan, loadDeletionRecord, pendingDeletion, reauthenticateForDeletion,
  runDeletion,
} from '../accountDeletion';
import { FakeAdapter } from './fakeAdapter';

const UID = 'u-del';
const ts = (seconds: number) => ({ seconds, nanoseconds: 0 });

let adapter: FakeAdapter;

function boot(linked = true): void {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.user = linked
    ? { uid: UID, isAnonymous: false, displayName: 'Del User', email: 'del@x.com' }
    : { uid: UID, isAnonymous: true, displayName: null, email: null };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
});

async function seedUser(): Promise<void> {
  await getRepos().users.ensureUser(UID, { displayName: 'Del User', email: 'del@x.com', isLinked: true });
}

const VEHICLE_INPUT = {
  name: 'V', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
  odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
};

async function ownedVehicle(name: string): Promise<string> {
  return getRepos().vehicles.create({ ...VEHICLE_INPUT, name });
}

/** Direct doc edit: add a member to an existing vehicle doc. */
function addMember(vehicleId: string, uid: string, joinedAtSec: number): void {
  const path = `vehicles/${vehicleId}`;
  const v = { ...adapter.docs.get(path) } as unknown as VehicleDoc & { id: string };
  v.memberIds = [...v.memberIds, uid];
  v.members = {
    ...v.members,
    [uid]: { role: 'member', name: `${uid} name`, email: `${uid}@x.com`, joinedAt: ts(joinedAtSec) },
  };
  adapter.docs.set(path, v as unknown as Record<string, unknown>);
}

/** A foreign-owned shared vehicle with the deleting user as a member. */
function foreignVehicle(id: string, name: string, owner: string): void {
  adapter.docs.set(`vehicles/${id}`, {
    name, type: 'car', color: 'c01', fuelTypes: ['petrol'], odometerUnit: 'km',
    currency: 'INR', startOdometer: 0, lastOdometer: 0, lastOdometerAt: ts(1),
    ownerId: owner, memberIds: [owner, UID],
    members: {
      [owner]: { role: 'owner', name: `${owner} name`, joinedAt: ts(1) },
      [UID]: { role: 'member', name: 'Del User', email: 'del@x.com', joinedAt: ts(5) },
    },
    archived: false, createdAt: ts(1), updatedAt: ts(1), updatedBy: owner, schemaVersion: 1,
  });
}

const veh = async (id: string): Promise<VehicleRecord> =>
  ({ ...(await getRepos().vehicles.get(id))!, id, pending: false }) as VehicleRecord;

test('buildMyDeletionPlan buckets owned/shared/foreign vehicles (SC-REL05-01)', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10);
  addMember(a, 'm2', 20);
  const b = await ownedVehicle('Solo B');
  foreignVehicle('c', 'Family C', 'other');

  const plan = await buildMyDeletionPlan();
  expect(plan.handoffs.map((h) => h.vehicle.id)).toEqual([a]);
  expect(plan.handoffs[0]!.candidates.map((c) => c.uid)).toEqual(['m1', 'm2']);
  expect(plan.deletes.map((d) => d.id)).toEqual([b]);
  expect(plan.leaves.map((l) => l.id)).toEqual(['c']);
});

test('a full run hands off, deletes, leaves, deletes invites, the user doc, then the account', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10);
  addMember(a, 'm2', 20);
  const b = await ownedVehicle('Solo B');
  foreignVehicle('c', 'Family C', 'other');
  await getRepos().invites.create(await veh(a), 'K7QXM2PA');

  await runDeletion({ handoffs: { [a]: 'm1' } });

  const aDoc = adapter.docs.get(`vehicles/${a}`)! as VehicleDoc;
  expect(aDoc.ownerId).toBe('m1');
  expect(aDoc.memberIds).not.toContain(UID); // handed off, then left
  expect(adapter.docs.has(`vehicles/${b}`)).toBe(false);
  const cDoc = adapter.docs.get('vehicles/c')! as VehicleDoc;
  expect(cDoc.memberIds).toEqual(['other']);
  expect(cDoc.members[UID]).toBeUndefined();
  expect(adapter.docs.has('invites/K7QXM2PA')).toBe(false);
  expect(adapter.docs.has(`users/${UID}`)).toBe(false);
  expect(adapter.deletedAccounts).toEqual([UID]); // account last
  expect(await localFlags.deletion(UID)).toBeNull(); // marker wiped
});

test('progress is recorded step by step; a failed account step resumes from the marker', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10);
  await ownedVehicle('Solo B');
  foreignVehicle('c', 'Family C', 'other');
  await getRepos().invites.create(await veh(a), 'K7QXM2PA');

  adapter.deleteAccountError = new RepoError('unavailable');
  await expect(runDeletion({ handoffs: { [a]: 'm1' } })).rejects.toMatchObject({ code: 'unavailable' });

  // Every data step is recorded; the user document is already gone, so the
  // local marker is the resume source (SC-REL05-03, VD-04).
  const marker = (await localFlags.deletion(UID))!;
  expect(marker.completedSteps).toEqual(['handoffs', 'vehicles', 'memberships', 'invites', 'user']);
  expect(adapter.docs.has(`users/${UID}`)).toBe(false);

  adapter.deleteAccountError = null;
  await runDeletion(); // resume: only the account step remains
  expect(adapter.deletedAccounts).toEqual([UID]);
  expect(await localFlags.deletion(UID)).toBeNull();
});

test('resume skips completed steps and finishes the rest (REL-07)', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10);
  foreignVehicle('c', 'Family C', 'other');
  await getRepos().invites.create(await veh(a), 'K7QXM2PA'); // created while UID owns A — still pending
  // Simulate a crashed run: handoffs already transferred A to m1, the solo
  // vehicle is already gone, and the record shows it.
  await getRepos().vehicles.transferOwnership(a, 'm1');
  const record = {
    status: 'in-progress',
    startedAt: ts(1),
    handoffs: { [a]: 'm1' },
    completedSteps: ['handoffs', 'vehicles'],
  };
  await getRepos().users.setDeletion(UID, record);

  await runDeletion();

  const cDoc = adapter.docs.get('vehicles/c')! as VehicleDoc;
  expect(cDoc.memberIds).toEqual(['other']);
  expect(adapter.docs.has('invites/K7QXM2PA')).toBe(false);
  expect(adapter.docs.has(`users/${UID}`)).toBe(false);
  expect(adapter.deletedAccounts).toEqual([UID]);
});

test('a marker-only resume (user doc gone) runs just the account step', async () => {
  boot();
  await localFlags.saveDeletion(UID, {
    status: 'in-progress', startedAt: ts(1), handoffs: {},
    completedSteps: ['handoffs', 'vehicles', 'memberships', 'invites', 'user'],
  });
  await runDeletion();
  expect(adapter.deletedAccounts).toEqual([UID]);
  expect(await localFlags.deletion(UID)).toBeNull();
});

test('the mid-run fallback hands to the next longest-standing member (SC-REL05-02/03)', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10); // chosen — will have left before the run
  addMember(a, 'm2', 20);
  // m1 left already: strip their membership.
  const doc = { ...adapter.docs.get(`vehicles/${a}`) } as unknown as VehicleDoc;
  doc.memberIds = doc.memberIds.filter((id) => id !== 'm1');
  delete doc.members['m1'];
  adapter.docs.set(`vehicles/${a}`, doc as unknown as Record<string, unknown>);

  await runDeletion({ handoffs: { [a]: 'm1' } });

  const aDoc = adapter.docs.get(`vehicles/${a}`)! as VehicleDoc;
  expect(aDoc.ownerId).toBe('m2');
});

test('"Delete instead" removes the shared vehicle rather than handing it off', async () => {
  boot();
  await seedUser();
  const a = await ownedVehicle('Shared A');
  addMember(a, 'm1', 10);

  await runDeletion({ handoffs: {}, deletes: [a] });

  expect(adapter.docs.has(`vehicles/${a}`)).toBe(false);
});

test('anonymous "Delete all my data" runs without re-auth and deletes the account', async () => {
  boot(false); // anonymous
  await getRepos().users.ensureUser(UID, { isLinked: false });
  const b = await ownedVehicle('Solo B');

  await runDeletion({ handoffs: {} });

  expect(adapter.docs.has(`vehicles/${b}`)).toBe(false);
  expect(adapter.docs.has(`users/${UID}`)).toBe(false);
  expect(adapter.deletedAccounts).toEqual([UID]);
});

test('reauthenticateForDeletion surfaces a wrong-account sign-in as user-mismatch', async () => {
  boot();
  adapter.reauthError = new AuthError('user-mismatch');
  await expect(reauthenticateForDeletion()).rejects.toMatchObject({ code: 'user-mismatch' });
});

test('runDeletion without a record or choices throws not-found', async () => {
  boot();
  await expect(runDeletion()).rejects.toMatchObject({ code: 'not-found' });
});

test('pendingDeletion finds an in-progress record in the doc or the marker', async () => {
  boot();
  await seedUser();
  expect(await pendingDeletion(UID)).toBeNull();

  const record = { status: 'in-progress', startedAt: ts(1), handoffs: {}, completedSteps: [] };
  await getRepos().users.setDeletion(UID, record);
  expect(await pendingDeletion(UID)).toMatchObject({ status: 'in-progress' });
  expect(await localFlags.deletion(UID)).toMatchObject({ status: 'in-progress' }); // mirrored

  // Doc gone but marker remains → still resumable.
  await getRepos().users.deleteUserDoc(UID);
  expect(await pendingDeletion(UID)).toMatchObject({ status: 'in-progress' });
});

test('a finished record does not resume', async () => {
  boot();
  await localFlags.saveDeletion(UID, {
    status: 'done', startedAt: ts(1), handoffs: {}, completedSteps: ['account'],
  });
  expect(await pendingDeletion(UID)).toBeNull();
  expect(await loadDeletionRecord(UID)).toBeNull();
});

test('the users doc carries no residual fields after ensureUser for tests', async () => {
  // Sanity guard for the fixtures above: ensureUser writes the seeded shape.
  boot();
  await seedUser();
  const u = await getRepos().users.getUser(UID);
  expect(u!.settings).toMatchObject(USER_DEFAULTS);
});
