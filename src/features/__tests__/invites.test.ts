// SHR-06/07/08 feature layer: create with the pending cap and link gate,
// lookupInvite states (SC-SHR08-04), the join flow's failure mapping, and
// leave/remove/transfer orchestration. FakeAdapter; the rules themselves are
// covered by the emulator + rules suites.

jest.mock('expo-crypto', () => ({
  // Deterministic bytes → deterministic codes, still alphabet-valid.
  getRandomBytesAsync: async (n: number) => new Uint8Array(n).fill(7),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { RepoError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import type { InviteRecord } from '../../data/repos/inviteRepo';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { INVITE_ALPHABET, inviteLink, MAX_PENDING_INVITES } from '../../domain/invites';
import { resetAppStore, useAppStore } from '../appStore';
import { Share } from 'react-native';
import {
  createInvite, joinWithInvite, JoinError, leaveVehicle,
  lookupInvite, removeMember, shareInvite, transferOwnership,
} from '../invites';
import { initI18n } from '../../i18n';
import { resetRuntimeForTests, getRepos } from '../runtime';
import { FakeAdapter } from './fakeAdapter';

let adapter: FakeAdapter;

const VEHICLE_INPUT = {
  name: 'Swift', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
  odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
};

function boot(platform: 'native' | 'web' = 'native', linked = true): void {
  adapter = new FakeAdapter(platform);
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.setUser({
    uid: 'me', isAnonymous: !linked,
    displayName: linked ? 'Me Name' : null, email: linked ? 'me@example.com' : null,
  });
  useAppStore.setState({ user: adapter.currentUser() });
}

async function vehicle(): Promise<VehicleRecord> {
  const id = await getRepos().vehicles.create(VEHICLE_INPUT);
  const v = { ...(await getRepos().vehicles.get(id))!, id, pending: false };
  useAppStore.setState({ vehicles: [v] });
  return v;
}

async function invite(v: VehicleRecord): Promise<InviteRecord> {
  const inv = await createInvite(v);
  return inv;
}

beforeAll(() => initI18n('en'));

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
  jest.restoreAllMocks();
});

describe('createInvite (SHR-07, SD-02/05)', () => {
  it('creates a code from the unambiguous alphabet and a poovarasu.dev link', async () => {
    boot();
    const inv = await invite(await vehicle());
    expect(inv.code).toHaveLength(8);
    for (const ch of inv.code) expect(INVITE_ALPHABET).toContain(ch);
    expect(inviteLink(inv.code)).toBe(`https://milevana.poovarasu.dev/join/${inv.code}`);
    expect((await getRepos().invites.get(inv.code))!.vehicleName).toBe('Swift');
  });

  it('an anonymous owner is sent through the link gate first (FR-LINK-03)', async () => {
    boot('native', false); // anonymous — no gate launcher in tests → gate fails
    await expect(createInvite(await vehicle())).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('refuses a sixth pending invite and a full vehicle (SC-SHR06-03, SD-05)', async () => {
    boot();
    const v = await vehicle();
    for (let i = 0; i < MAX_PENDING_INVITES; i++) {
      await getRepos().invites.create(v, `CODE000${i}`);
    }
    await expect(createInvite(v)).rejects.toMatchObject({ code: 'resource-exhausted' });

    const full = { ...v, memberIds: Array.from({ length: 10 }, (_, i) => `u${i}`) };
    for (const inv of await getRepos().invites.listForVehicle(v.id)) {
      await getRepos().invites.cancel(inv.code);
    }
    await expect(createInvite(full)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('a code collision retries with a fresh code (SD-02)', async () => {
    boot();
    const v = await vehicle();
    const spy = jest.spyOn(getRepos().invites, 'create');
    spy
      .mockRejectedValueOnce(new RepoError('permission-denied', 'collision'))
      .mockRejectedValueOnce(new RepoError('permission-denied', 'collision'));
    const inv = await createInvite(v);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(inv.code).toHaveLength(8);
  });

  it('gives up after five collisions', async () => {
    boot();
    const v = await vehicle();
    jest.spyOn(getRepos().invites, 'create')
      .mockRejectedValue(new RepoError('permission-denied', 'collision'));
    await expect(createInvite(v)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(getRepos().invites.create).toHaveBeenCalledTimes(5);
  });
});

describe('lookupInvite (SHR-08, SC-SHR08-04)', () => {
  it('invalid for bad input and unknown codes', async () => {
    boot();
    expect((await lookupInvite('not a code')).status).toBe('invalid');
    expect((await lookupInvite('K7QXM2PA')).status).toBe('invalid');
  });

  it('valid with vehicle and owner names for a pending invite', async () => {
    boot();
    const inv = await invite(await vehicle());
    useAppStore.setState({ vehicles: [] }); // a real joiner doesn't have it yet
    const res = await lookupInvite(` ${inv.code.toLowerCase()} `);
    expect(res.status).toBe('valid');
    if (res.status === 'valid') {
      expect(res.invite.vehicleName).toBe('Swift');
      expect(res.invite.ownerName).toBe('Me Name');
    }
  });

  it('used, expired and archived states', async () => {
    boot();
    const v = await vehicle();
    useAppStore.setState({ vehicles: [] });
    const used = await invite(v);
    await getRepos().invites.setArchivedFlag(used.code, true);
    adapter.docs.set(`invites/${used.code}`, {
      ...adapter.docs.get(`invites/${used.code}`)!, usedBy: 'x', usedAt: adapter.now(),
    });
    expect((await lookupInvite(used.code)).status).toBe('used');

    const exp = await invite(v);
    adapter.docs.set(`invites/${exp.code}`, {
      ...adapter.docs.get(`invites/${exp.code}`)!, expiresAt: { seconds: 1, nanoseconds: 0 },
    });
    expect((await lookupInvite(exp.code)).status).toBe('expired');

    const arc = await invite(v);
    expect((await lookupInvite(arc.code)).status).toBe('valid');
    adapter.docs.set(`invites/${arc.code}`, {
      ...adapter.docs.get(`invites/${arc.code}`)!, vehicleArchived: true,
    });
    expect((await lookupInvite(arc.code)).status).toBe('archived');
  });

  it('gone when the vehicle is deleted (permission-denied read)', async () => {
    boot();
    const inv = await invite(await vehicle());
    useAppStore.setState({ vehicles: [] });
    jest.spyOn(adapter, 'getDoc').mockRejectedValueOnce(new RepoError('permission-denied'));
    expect((await lookupInvite(inv.code)).status).toBe('gone');
  });

  it('member when the caller already belongs; offline when the store is offline', async () => {
    boot();
    const v = await vehicle();
    const inv = await invite(v);
    expect((await lookupInvite(inv.code)).status).toBe('member');
    useAppStore.setState({ vehicles: [] });
    useAppStore.setState({ online: false });
    expect((await lookupInvite(inv.code)).status).toBe('offline');
  });
});

describe('joinWithInvite (SHR-08, SD-03/04)', () => {
  it('writes the member record and marks the invite in one batch', async () => {
    boot();
    // Another user owns the vehicle; plant it + its invite directly.
    adapter.setUser({ uid: 'owner', isAnonymous: false, displayName: 'Owner', email: 'o@x.com' });
    const vid = await getRepos().vehicles.create(VEHICLE_INPUT);
    const vehicleDoc = { ...(await getRepos().vehicles.get(vid))!, id: vid, pending: false };
    const inv = await getRepos().invites.create(vehicleDoc, 'JOINCODE');
    adapter.setUser({ uid: 'me', isAnonymous: false, displayName: 'Me Name', email: 'me@x.com' });
    useAppStore.setState({ user: adapter.currentUser(), vehicles: [] });

    const joined = await joinWithInvite(inv);
    expect(joined).toBe(vid);
    const v = adapter.docs.get(`vehicles/${vid}`)!;
    expect(v.memberIds).toContain('me');
    expect((v.members as Record<string, { role: string }>).me.role).toBe('member');
    expect(adapter.docs.get(`invites/${inv.code}`)!.usedBy).toBe('me');
    expect(useAppStore.getState().selectedVehicleId).toBe(vid);
  });

  it('an anonymous joiner goes through the link gate (SC-SHR08-02)', async () => {
    boot('native', false);
    const inv = {
      code: 'JOINCODE', vehicleId: 'v1', vehicleName: 'Swift', ownerId: 'o',
      ownerName: 'O', createdBy: 'o', createdAt: adapter.now(),
      expiresAt: { seconds: adapter.now().seconds + 9999, nanoseconds: 0 },
    } as InviteRecord;
    // No gate launcher registered in tests → 'failed' → cancelled.
    await expect(joinWithInvite(inv)).rejects.toBeInstanceOf(JoinError);
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'cancelled' });
  });

  it('offline refuses before writing (SD-03)', async () => {
    boot();
    const inv = await invite(await vehicle());
    useAppStore.setState({ vehicles: [], online: false });
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'offline' });
    expect(adapter.docs.get(`invites/${inv.code}`)!.usedBy).toBeUndefined();
  });

  it('maps a denied join to used / expired / gone / full', async () => {
    boot();
    const v = await vehicle();
    useAppStore.setState({ vehicles: [] });
    const inv = await invite(v);
    const doc = () => adapter.docs.get(`invites/${inv.code}`)!;

    adapter.commitAck = { reject: new RepoError('permission-denied') };

    adapter.docs.set(`invites/${inv.code}`, { ...doc(), usedBy: 'other', usedAt: adapter.now() });
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'used' });
    adapter.docs.set(`invites/${inv.code}`, { ...doc(), usedBy: undefined });

    adapter.docs.set(`invites/${inv.code}`, { ...doc(), expiresAt: { seconds: 1, nanoseconds: 0 } });
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'expired' });
    adapter.docs.set(`invites/${inv.code}`, { ...doc(), expiresAt: { seconds: adapter.now().seconds + 9999, nanoseconds: 0 } });

    jest.spyOn(adapter, 'getDoc').mockRejectedValueOnce(new RepoError('permission-denied'));
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'gone' });

    // Still pending but denied → full (10 members / archived race).
    await expect(joinWithInvite(inv)).rejects.toMatchObject({ reason: 'full' });
  });
});

describe('membership ops (SHR-11/12/13)', () => {
  async function shared() {
    boot();
    const v = await vehicle();
    // Plant a second member directly.
    const doc = adapter.docs.get(`vehicles/${v.id}`)!;
    adapter.docs.set(`vehicles/${v.id}`, {
      ...doc,
      memberIds: ['me', 'bob'],
      members: {
        ...(doc.members as object),
        bob: { role: 'member', name: 'Bob', email: 'b@x.com', joinedAt: adapter.now() },
      },
    });
    const shared = { ...v, memberIds: ['me', 'bob'] };
    useAppStore.setState({ vehicles: [shared], selectedVehicleId: v.id });
    return shared;
  }

  it('owner cannot leave; member leave drops both fields', async () => {
    const v = await shared();
    await expect(leaveVehicle(v)).rejects.toMatchObject({ code: 'invalid-argument' });

    // Act as bob now.
    adapter.setUser({ uid: 'bob', isAnonymous: false, displayName: 'B', email: 'b@x.com' });
    useAppStore.setState({ user: adapter.currentUser() });
    await leaveVehicle(v);
    const doc = adapter.docs.get(`vehicles/${v.id}`)!;
    expect(doc.memberIds).toEqual(['me']);
    expect((doc.members as Record<string, unknown>).bob).toBeUndefined();
  });

  it('owner removes a member', async () => {
    const v = await shared();
    await removeMember(v, 'bob');
    const doc = adapter.docs.get(`vehicles/${v.id}`)!;
    expect(doc.memberIds).toEqual(['me']);
  });

  it('transfer swaps ownerId and roles', async () => {
    const v = await shared();
    await transferOwnership(v, 'bob');
    const doc = adapter.docs.get(`vehicles/${v.id}`)!;
    expect(doc.ownerId).toBe('bob');
    const members = doc.members as Record<string, { role: string }>;
    expect(members.bob.role).toBe('owner');
    expect(members.me.role).toBe('member');
  });
});

describe('shareInvite (SHR-07, SD-11)', () => {
  it('native sends the code + link through the system share sheet', async () => {
    boot('native');
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await expect(shareInvite('K7QXM2PA', 'Swift')).resolves.toBe('shared');
    const { message } = spy.mock.calls[0][0] as { message: string };
    expect(message).toContain('K7QX-M2PA');
    expect(message).toContain('https://milevana.poovarasu.dev/join/K7QXM2PA');
    expect(message).toContain('Swift');
  });

  it('web prefers navigator.share, falls back to the clipboard, then failed', async () => {
    boot('web');
    const nav = globalThis.navigator as { share?: unknown; clipboard?: unknown };
    nav.share = jest.fn().mockResolvedValue(undefined);
    await expect(shareInvite('K7QXM2PA', 'Swift')).resolves.toBe('shared');
    nav.share = undefined;
    const writeText = jest.fn().mockResolvedValue(undefined);
    nav.clipboard = { writeText };
    await expect(shareInvite('K7QXM2PA', 'Swift')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(
      'https://milevana.poovarasu.dev/join/K7QXM2PA');
    nav.clipboard = undefined;
    await expect(shareInvite('K7QXM2PA', 'Swift')).resolves.toBe('failed');
    nav.share = jest.fn().mockRejectedValue(new Error('abort'));
    await expect(shareInvite('K7QXM2PA', 'Swift')).resolves.toBe('failed');
    delete nav.share;
  });
});
