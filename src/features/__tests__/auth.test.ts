// FND-AUTH-03..08 — link Google, the credential-already-in-use conflict
// (counts, Move and switch, Switch without moving, Cancel), merge
// resume/discard and sign-out.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthError } from '../../data/adapter';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { localFlags } from '../../data/localFlags';
import { exportBundle, repoExportSource } from '../../data/serializer';
import type { VehicleInput } from '../../data/schema/vehicle';
import { resetAppStore, useAppStore } from '../appStore';
import { getRepos, resetRuntimeForTests } from '../runtime';
import {
  askDiscardMerge, confirmDiscardMerge, conflictCancel, conflictMoveAndSwitch,
  conflictShowWarning, conflictSwitchWithoutMoving, linkGoogle, requestSignOut,
  resumeMerge, signOutCancel, signOutDiscard,
} from '../auth';
import { FakeAdapter } from './fakeAdapter';

const ANON = { uid: 'anon-1', isAnonymous: true, displayName: null, email: null };
const GOOGLE = { uid: 'google-1', isAnonymous: false, displayName: 'G User', email: 'g@example.com' };

const input = (name: string): VehicleInput => ({
  name, type: 'car', color: 'c01', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', startOdometer: 0,
});

let adapter: FakeAdapter;

function boot(): void {
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  resetAppStore();
  adapter.setUser(ANON); // no session listener — tests drive actions directly
  useAppStore.setState({ user: ANON });
}

function openConflictSetup(): void {
  adapter.linkError = new AuthError('credential-already-in-use');
  adapter.retainedCredential = true;
  adapter.signInAs = GOOGLE;
}

const vehicleIdsFor = (uid: string): string[] =>
  [...adapter.docs.entries()]
    .filter(([p, d]) => p.startsWith('vehicles/') && p.split('/').length === 2 && d.ownerId === uid)
    .map(([p]) => p.split('/')[1]);

beforeEach(async () => {
  await AsyncStorage.clear();
  resetFirebaseForTests();
});

describe('link Google (FND-AUTH-03)', () => {
  it('links the same account, fills the owner member profile and rewrites "Me" (DR-02)', async () => {
    boot();
    const repos = getRepos();
    const vid = await repos.vehicles.create(input('Anon Car'));
    await repos.entries.create(vid, {
      type: 'expense', date: adapter.now(),
      amount: { minor: 5000, currency: 'INR' }, category: 'Parking',
    });

    await linkGoogle();
    const st = useAppStore.getState();
    expect(st.linking).toBe(false);
    expect(adapter.currentUser()!.uid).toBe('anon-1'); // same account linked
    expect(adapter.currentUser()!.isAnonymous).toBe(false);
    // DR-02: owner member profile + author rewrite
    const v = adapter.docs.get(`vehicles/${vid}`)!;
    expect((v.members as Record<string, { name?: string; email?: string }>)['anon-1']).toEqual(
      expect.objectContaining({ name: 'Test User', email: 'test@example.com' }),
    );
    const entries = [...adapter.docs.entries()].filter(([p]) => p.startsWith(`vehicles/${vid}/entries/`));
    expect(entries[0][1].createdByName).toBe('Test User');
  });

  it('a cancelled picker is silent', async () => {
    boot();
    adapter.linkError = new AuthError('cancelled');
    await linkGoogle();
    expect(useAppStore.getState().linkError).toBe(false);
    expect(useAppStore.getState().conflict).toBeNull();
  });

  it('other failures show the retryable error', async () => {
    boot();
    adapter.linkError = new AuthError('network');
    await linkGoogle();
    expect(useAppStore.getState().linkError).toBe(true);
  });
});

describe('account conflict (FND-AUTH-05)', () => {
  it('counts anonymous-owned vehicles and entries for the dialog', async () => {
    boot();
    const repos = getRepos();
    const v1 = await repos.vehicles.create(input('One'));
    await repos.vehicles.create(input('Two'));
    await repos.entries.create(v1, {
      type: 'expense', date: adapter.now(),
      amount: { minor: 100, currency: 'INR' }, category: 'Fuel',
    });
    openConflictSetup();
    await linkGoogle();
    expect(useAppStore.getState().conflict).toEqual({ vehicleCount: 2, entryCount: 1 });
  });

  it('Cancel drops the retained credential and changes nothing', async () => {
    boot();
    openConflictSetup();
    await linkGoogle();
    conflictCancel();
    expect(useAppStore.getState().conflict).toBeNull();
    expect(adapter.retainedCredential).toBe(false);
    expect(adapter.currentUser()!.uid).toBe('anon-1');
  });

  it('Switch without moving warns first, then signs into the Google account', async () => {
    boot();
    await getRepos().vehicles.create(input('Left behind'));
    openConflictSetup();
    await linkGoogle();
    conflictShowWarning();
    expect(useAppStore.getState().conflictWarnStep).toBe(true);
    await conflictSwitchWithoutMoving();
    expect(adapter.currentUser()!.uid).toBe('google-1');
    expect(useAppStore.getState().conflict).toBeNull();
    // Anonymous data stays on the device-side account — untouched.
    expect(vehicleIdsFor('anon-1')).toHaveLength(1);
    expect(vehicleIdsFor('google-1')).toHaveLength(0);
  });
});

describe('merge (FND-AUTH-06/07)', () => {
  it('Move and switch imports anonymous data under the Google uid (FR-MERGE-01)', async () => {
    boot();
    const repos = getRepos();
    const vid = await repos.vehicles.create(input('Mover'));
    await repos.entries.create(vid, {
      type: 'expense', date: adapter.now(),
      amount: { minor: 2500, currency: 'INR' }, category: 'Tolls',
    });
    openConflictSetup();
    await linkGoogle();
    await conflictMoveAndSwitch();

    expect(adapter.currentUser()!.uid).toBe('google-1');
    expect(useAppStore.getState().merge.status).toBe('idle');
    await expect(localFlags.loadMergeRetry()).resolves.toBeNull(); // bundle cleared

    const moved = vehicleIdsFor('google-1');
    expect(moved).toHaveLength(1);
    const vdoc = adapter.docs.get(`vehicles/${moved[0]}`)!;
    expect(vdoc.name).toBe('Mover');
    const movedEntries = [...adapter.docs.keys()].filter((p) =>
      p.startsWith(`vehicles/${moved[0]}/entries/`));
    expect(movedEntries).toHaveLength(1);
    expect(adapter.docs.get(movedEntries[0])!.createdByName).toBe('G User');
  });

  it('a failed merge persists the retry bundle (FR-MERGE-06)', async () => {
    boot();
    await getRepos().vehicles.create(input('Stuck'));
    openConflictSetup();
    await linkGoogle();
    // Break the merge after the conflict: the retained credential is gone,
    // so the Google sign-in step throws (e.g. process restarted mid-merge).
    adapter.signInAs = null;
    await conflictMoveAndSwitch();
    expect(useAppStore.getState().merge.status).toBe('failed');
    await expect(localFlags.loadMergeRetry()).resolves.not.toBeNull();
  });

  it('resume finishes a stored merge for the already-linked user (FR-MERGE-10)', async () => {
    boot();
    const repos = getRepos();
    await repos.vehicles.create(input('Resumed'));
    const bundle = await exportBundle(repoExportSource(repos), adapter.now());
    await localFlags.saveMergeRetry(bundle);

    adapter.setUser(GOOGLE); // restart state: Google session, bundle still stored
    useAppStore.setState({ user: GOOGLE, phase: 'merge-resume', mergeResumeAvailable: true });
    await resumeMerge();
    const st = useAppStore.getState();
    expect(st.phase).toBe('ready');
    expect(st.merge.status).toBe('idle');
    expect(vehicleIdsFor('google-1')).toHaveLength(1);
    await expect(localFlags.loadMergeRetry()).resolves.toBeNull();
  });

  it('discard requires the second step, then clears the bundle (DR-10)', async () => {
    boot();
    await localFlags.saveMergeRetry({ vehicles: [] } as never);
    useAppStore.setState({ phase: 'merge-resume', mergeResumeAvailable: true });
    askDiscardMerge();
    expect(useAppStore.getState().merge.confirmDiscard).toBe(true);
    await confirmDiscardMerge();
    const st = useAppStore.getState();
    expect(st.phase).toBe('ready');
    expect(st.mergeResumeAvailable).toBe(false);
    await expect(localFlags.loadMergeRetry()).resolves.toBeNull();
  });
});

describe('sign-out (FND-AUTH-08)', () => {
  it('with pending changes on native it asks first (DR-16); Discard proceeds', async () => {
    boot();
    adapter.setUser(GOOGLE);
    useAppStore.setState({ user: GOOGLE, pendingChanges: 3 });
    requestSignOut();
    expect(useAppStore.getState().signOutPending).toBe(3);
    signOutCancel();
    expect(useAppStore.getState().signOutPending).toBeNull();
    expect(adapter.currentUser()!.uid).toBe('google-1'); // still signed in

    useAppStore.setState({ pendingChanges: 3 });
    requestSignOut();
    await signOutDiscard();
    expect(adapter.currentUser()).toBeNull();
    expect(useAppStore.getState().signingOut).toBe(false);
  });

  it('with nothing pending it signs out immediately and wipes local state (FR-OUT-05)', async () => {
    boot();
    await localFlags.pushMru('google-1', 'v1');
    adapter.setUser(GOOGLE);
    useAppStore.setState({ user: GOOGLE, pendingChanges: 0 });
    requestSignOut();
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(adapter.currentUser()).toBeNull();
    await expect(localFlags.mru('google-1')).resolves.toEqual([]);
  });
});
