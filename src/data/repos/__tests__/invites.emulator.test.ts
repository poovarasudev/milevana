// SHR-06 — invite and membership repository ops against the Firestore
// emulator with the real rules (SC-SHR06-02). Runs via `npm run
// test:emulator` inside `firebase emulators:exec`.
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { createWebAdapter } from '../../firebase.web';
import type { FirebaseAdapter } from '../../adapter';
import { createRepos, Repos } from '../index';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-milevana',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

function reposFor(uid: string, linked: boolean): Repos {
  const firestore = env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: linked ? 'google.com' : 'anonymous' },
    })
    .firestore();
  const adapter: FirebaseAdapter = createWebAdapter({
    firestore: firestore as never,
    user: {
      uid,
      isAnonymous: !linked,
      displayName: linked ? `${uid} Name` : null,
      email: linked ? `${uid}@example.com` : null,
    },
  });
  return createRepos(adapter);
}

const VEHICLE_INPUT = {
  name: 'Swift', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
  odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
};

const CODE = 'K7QXM2PA';

async function ownerVehicle(r: Repos) {
  const id = await r.vehicles.create(VEHICLE_INPUT);
  return { ...(await r.vehicles.get(id))!, id, pending: false };
}

async function inviteVehicle() {
  const owner = reposFor('owner', true);
  const vehicle = await ownerVehicle(owner);
  const invite = await owner.invites.create(vehicle, CODE);
  return { owner, vehicle, invite };
}

describe('inviteRepo', () => {
  it('create + get + listForVehicle (owner sees pending)', async () => {
    const { owner, vehicle } = await inviteVehicle();
    const got = await owner.invites.get(CODE);
    expect(got!.vehicleId).toBe(vehicle.id);
    expect(got!.expiresAt.seconds - got!.createdAt.seconds).toBe(7 * 24 * 3600);
    const list = await owner.invites.listForVehicle(vehicle.id);
    expect(list.map((i) => i.code)).toEqual([CODE]);
  });

  it('any signed-in user can read by exact code; anonymous included (SD-01)', async () => {
    await inviteVehicle();
    const anon = reposFor('looker', false);
    const got = await anon.invites.get(CODE);
    expect(got!.vehicleName).toBe('Swift');
    expect(got!.ownerName).toBe('owner Name');
  });

  it('join adds the member and marks the invite in one batch (SD-03)', async () => {
    const { vehicle, invite } = await inviteVehicle();
    const bob = reposFor('bob', true);
    const vid = await bob.invites.join(invite, { name: 'Bob', email: 'bob@example.com' });
    expect(vid).toBe(vehicle.id);

    const v = await bob.vehicles.get(vehicle.id);
    expect(v!.memberIds).toContain('bob');
    expect(v!.members.bob).toMatchObject({
      role: 'member', name: 'Bob', email: 'bob@example.com', inviteCode: CODE,
    });
    const used = await bob.invites.get(CODE);
    expect(used!.usedBy).toBe('bob');
    expect(used!.usedAt).toBeDefined();
  });

  it('a second join on the used invite fails (single-use, SC-SHR06-02)', async () => {
    const { invite } = await inviteVehicle();
    const bob = reposFor('bob', true);
    await bob.invites.join(invite, { name: 'Bob', email: 'bob@example.com' });
    const carol = reposFor('carol', true);
    await expect(
      carol.invites.join(invite, { name: 'Carol', email: 'carol@example.com' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('an anonymous user cannot join (FR-LINK-03)', async () => {
    const { invite } = await inviteVehicle();
    const anon = reposFor('anon', false);
    await expect(
      anon.invites.join(invite, { name: 'A', email: 'a@example.com' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('cancel deletes the invite; reads then miss', async () => {
    const { owner } = await inviteVehicle();
    await owner.invites.cancel(CODE);
    expect(await owner.invites.get(CODE)).toBeNull();
  });

  it('a non-owner cannot create, cancel or flag invites', async () => {
    const { owner, vehicle } = await inviteVehicle();
    const bob = reposFor('bob', true);
    await expect(bob.invites.create(vehicle, 'ZZZZZZZZ'))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(bob.invites.cancel(CODE))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await expect(bob.invites.setArchivedFlag(CODE, true))
      .rejects.toMatchObject({ code: 'permission-denied' });
    // The owner can mirror the archived flag (SHR-08).
    await owner.invites.setArchivedFlag(CODE, true);
    expect((await owner.invites.get(CODE))!.vehicleArchived).toBe(true);
  });
});

describe('membership ops', () => {
  async function sharedVehicle() {
    const { owner, vehicle, invite } = await inviteVehicle();
    const bob = reposFor('bob', true);
    await bob.invites.join(invite, { name: 'Bob', email: 'bob@example.com' });
    return { owner, bob, vehicle };
  }

  it('a member leaves: memberIds and members both shrink (SD-06)', async () => {
    const { owner, bob, vehicle } = await sharedVehicle();
    await bob.vehicles.leave(vehicle.id);
    const v = await owner.vehicles.get(vehicle.id);
    expect(v!.memberIds).toEqual(['owner']);
    expect(v!.members.bob).toBeUndefined();
    expect(await bob.vehicles.listMine()).toHaveLength(0);
  });

  it('the owner cannot leave directly (OQ-55)', async () => {
    const { owner, vehicle } = await sharedVehicle();
    await expect(owner.vehicles.leave(vehicle.id))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('the owner removes a member; members cannot remove', async () => {
    const { owner, bob, vehicle } = await sharedVehicle();
    await expect(bob.vehicles.removeMember(vehicle.id, 'owner'))
      .rejects.toMatchObject({ code: 'permission-denied' });
    await owner.vehicles.removeMember(vehicle.id, 'bob');
    const v = await owner.vehicles.get(vehicle.id);
    expect(v!.memberIds).toEqual(['owner']);
    expect(v!.members.bob).toBeUndefined();
    expect(await bob.vehicles.listMine()).toHaveLength(0);
  });

  it('transfer swaps ownerId and both roles in one write (SD-06)', async () => {
    const { owner, vehicle } = await sharedVehicle();
    await owner.vehicles.transferOwnership(vehicle.id, 'bob');
    const v = await owner.vehicles.get(vehicle.id);
    expect(v!.ownerId).toBe('bob');
    expect(v!.members.bob.role).toBe('owner');
    expect(v!.members.owner.role).toBe('member');
    // The new owner can now mint invites; the old owner cannot.
    const newOwner = reposFor('bob', true);
    await newOwner.invites.create({ ...v!, id: vehicle.id, pending: false }, 'AAAA2222');
    await expect(owner.invites.create({ ...v!, id: vehicle.id, pending: false }, 'BBBB3333'))
      .rejects.toMatchObject({ code: 'permission-denied' });
  });
});
