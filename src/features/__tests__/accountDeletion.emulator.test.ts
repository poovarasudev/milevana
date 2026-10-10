// REL-05/07 — the account-deletion engine end to end against the Firestore
// emulator with the real rules (SC-REL05-02/03, SC-REL07-03). The auth
// account itself is out of emulator scope, so the wrapped adapter records
// deleteAccount calls instead; every Firestore step runs for real.
/* eslint-disable import/no-duplicates -- the resolver maps both firebase and
   firebase.web to the platform file; they are distinct modules. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { RepoError, type FirebaseAdapter } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { createWebAdapter } from '../../data/firebase.web';
import { localFlags } from '../../data/localFlags';
import { createRepos, type Repos } from '../../data/repos';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { nowTimestamp } from '../../data/schema/common';
import { resetAppStore } from '../appStore';
import { resetRuntimeForTests } from '../runtime';
import { buildMyDeletionPlan, runDeletion } from '../accountDeletion';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-milevana',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
});

function reposFor(uid: string, linked = true): Repos {
  const firestore = env
    .authenticatedContext(uid, { firebase: { sign_in_provider: linked ? 'google.com' : 'anonymous' } })
    .firestore();
  return createRepos(
    createWebAdapter({
      firestore: firestore as never,
      user: {
        uid, isAnonymous: !linked,
        displayName: linked ? `${uid} name` : null,
        email: linked ? `${uid}@x.com` : null,
      },
    }),
  );
}

/** Install the runtime the engine uses; returns the deleted-account recorder. */
function runtimeFor(uid: string): { deleted: string[]; failingPaths: Set<string> } {
  const firestore = env
    .authenticatedContext(uid, { firebase: { sign_in_provider: 'google.com' } })
    .firestore();
  const base = createWebAdapter({
    firestore: firestore as never,
    user: { uid, isAnonymous: false, displayName: `${uid} name`, email: `${uid}@x.com` },
  });
  const deleted: string[] = [];
  const failingPaths = new Set<string>();
  const wrapped: FirebaseAdapter = {
    ...base,
    deleteDoc: (path) =>
      failingPaths.has(path) ? { ops: 0, ack: Promise.reject(new RepoError('unavailable', 'injected')) } : base.deleteDoc(path),
    deleteAccount: async () => { deleted.push(uid); },
  };
  setFirebaseFactory(() => wrapped);
  resetRuntimeForTests();
  return { deleted, failingPaths };
}

const UID = 'u-del';
const VEHICLE_INPUT = {
  name: 'V', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
  odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
};
const EXPENSE = () => ({
  type: 'expense' as const, date: nowTimestamp(), odometer: 1100,
  amount: { minor: 500, currency: 'INR' }, category: 'cleaning',
});

const veh = async (r: Repos, id: string): Promise<VehicleRecord> =>
  ({ ...(await r.vehicles.get(id))!, id, pending: false }) as VehicleRecord;

async function join(r: Repos, vehicle: VehicleRecord, code: string, name: string): Promise<void> {
  const owner = reposFor(vehicle.ownerId);
  const invite = await owner.invites.create(vehicle, code);
  await r.invites.join(invite, { name, email: `${name}@x.com` });
}

/** u-del: user doc, owns A (shared with bob+carol), owns B (solo), member of C. */
async function scenario() {
  const me = reposFor(UID);
  await me.users.ensureUser(UID, { isLinked: true, displayName: 'Del User', email: 'del@x.com' });
  const aId = await me.vehicles.create({ ...VEHICLE_INPUT, name: 'Shared A' });
  const bId = await me.vehicles.create({ ...VEHICLE_INPUT, name: 'Solo B' });
  const bob = reposFor('bob');
  const carol = reposFor('carol');
  await join(bob, await veh(me, aId), 'AAAA1111', 'Bob');
  await join(carol, await veh(me, aId), 'BBBB2222', 'Carol');
  await me.invites.create(await veh(me, aId), 'CCCC3333'); // pending

  const oscar = reposFor('oscar');
  const cId = await oscar.vehicles.create({ ...VEHICLE_INPUT, name: 'Oscar C' });
  await join(me, await veh(oscar, cId), 'DDDD4444', 'Del');
  const entryId = await me.entries.create(cId, EXPENSE());
  return { me, bob, carol, oscar, aId, bId, cId, entryId };
}

test('plan: shared→longest-standing, solo→delete, foreign→leave (SC-REL05-01)', async () => {
  const { aId, bId, cId } = await scenario();
  runtimeFor(UID);
  const plan = await buildMyDeletionPlan();
  expect(plan.handoffs.map((h) => h.vehicle.id)).toEqual([aId]);
  expect(plan.handoffs[0]!.candidates.map((c) => c.uid)).toEqual(['bob', 'carol']);
  expect(plan.deletes.map((d) => d.id)).toEqual([bId]);
  expect(plan.leaves.map((l) => l.id)).toEqual([cId]);
});

test('full run: handoff, subtree delete, leave, invites gone, user doc gone, account last (SC-REL05-02/03)', async () => {
  const { bob, carol, oscar, aId, bId, cId, entryId } = await scenario();
  const { deleted } = runtimeFor(UID);

  await runDeletion({ handoffs: { [aId]: 'bob' } });

  const a = (await bob.vehicles.get(aId))!;
  expect(a.ownerId).toBe('bob');
  expect(a.memberIds).toEqual(['bob', 'carol']); // u-del left after the handoff
  expect(a.members['u-del']).toBeUndefined();
  expect(a.members.bob.role).toBe('owner');
  // u-del is in no vehicle's members anywhere.
  expect((await carol.vehicles.get(aId))!.members['u-del']).toBeUndefined();

  // Solo vehicle and its subtree are gone.
  expect(await oscar.vehicles.get(bId)).toBeNull();

  // u-del left C; the entry they logged keeps their name (OQ-15/62).
  const c = (await oscar.vehicles.get(cId))!;
  expect(c.memberIds).toEqual(['oscar']);
  const entry = (await oscar.entries.get(cId, entryId))!;
  expect(entry.createdBy).toBe(UID);
  expect(entry.createdByName).toBe('u-del name');

  // Every invite u-del created is deleted — pending AND already used (VD-04).
  // The invite u-del used to join C belongs to oscar and stays.
  for (const code of ['AAAA1111', 'BBBB2222', 'CCCC3333']) {
    expect(await oscar.invites.get(code)).toBeNull();
  }
  expect((await oscar.invites.get('DDDD4444'))!.usedBy).toBe(UID);

  // User document gone; the local resume marker wiped; the auth account last.
  expect(await localFlags.deletion(UID)).toBeNull();
  expect(deleted).toEqual([UID]);
});

test('a failed step is recorded; resume completes without repeating work (SC-REL07-03)', async () => {
  const { bob, oscar, aId, bId } = await scenario();
  const { deleted, failingPaths } = runtimeFor(UID);

  // The invites step fails on the first delete.
  failingPaths.add('invites/AAAA1111');
  await expect(runDeletion({ handoffs: { [aId]: 'bob' } })).rejects.toMatchObject({ code: 'unavailable' });

  // handoffs, vehicles and memberships are recorded and done; invites ran last.
  const marker = (await localFlags.deletion(UID))!;
  expect(marker.completedSteps).toEqual(['handoffs', 'vehicles', 'memberships']);
  expect((await bob.vehicles.get(aId))!.ownerId).toBe('bob');
  expect(await oscar.vehicles.get(bId)).toBeNull();
  expect(await oscar.invites.get('AAAA1111')).not.toBeNull(); // still there
  expect((await reposFor(UID).users.getUser(UID))!.deletion?.completedSteps)
    .toEqual(['handoffs', 'vehicles', 'memberships']);

  failingPaths.clear();
  await runDeletion();
  expect(deleted).toEqual([UID]);
  expect(await localFlags.deletion(UID)).toBeNull();
});

test('the chosen member leaving mid-run falls back to the next one (SC-REL05-02/03)', async () => {
  const me = reposFor(UID);
  await me.users.ensureUser(UID, { isLinked: true });
  const aId = await me.vehicles.create({ ...VEHICLE_INPUT, name: 'Shared A' });
  const bob = reposFor('bob');
  const carol = reposFor('carol');
  await join(bob, await veh(me, aId), 'AAAA1111', 'Bob');
  await join(carol, await veh(me, aId), 'BBBB2222', 'Carol');
  // bob (the confirmed choice) leaves before the deletion runs.
  await bob.vehicles.leave(aId);

  runtimeFor(UID);
  await runDeletion({ handoffs: { [aId]: 'bob' } });

  const a = (await carol.vehicles.get(aId))!;
  expect(a.ownerId).toBe('carol');
  expect(a.memberIds).toEqual(['carol']);
});

test('"Delete instead" deletes a shared vehicle rather than handing it off', async () => {
  const me = reposFor(UID);
  await me.users.ensureUser(UID, { isLinked: true });
  const aId = await me.vehicles.create({ ...VEHICLE_INPUT, name: 'Shared A' });
  const bob = reposFor('bob');
  await join(bob, await veh(me, aId), 'AAAA1111', 'Bob');

  runtimeFor(UID);
  await runDeletion({ handoffs: {}, deletes: [aId] });

  expect(await bob.vehicles.get(aId)).toBeNull();
});
