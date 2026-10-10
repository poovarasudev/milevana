// Account deletion engine (REL-05..09, VD-04/05/07/08/09). One run, six
// ordered steps recorded in users/{uid}.deletion.completedSteps:
//
//   handoffs → vehicles → memberships → invites → user → account
//
// Order from VD-04: hand off owned shared vehicles, delete the vehicles only
// the user drives, leave memberships, delete created invites, delete the user
// document, delete the Firebase account, then wipe local state. Every step is
// idempotent and server-confirmed, so a killed or failed run resumes safely
// (REL-07): completedSteps skip finished work and each step re-checks live
// state before writing. The local marker mirrors the record so a restart
// after the user document is gone cannot recreate it (OQ-39 recreate path).
//
// Drive receipts and backups are kept — deleting them is out of scope (VD-04)
// and would also touch files owned-by-others via sharing.

import { RepoError } from '../data/adapter';
import { localFlags } from '../data/localFlags';
import type { DeletionDoc } from '../data/schema/user';
import { buildDeletionPlan, memberCandidates } from '../domain/deletion';
import type { DeletionPlan, DeletionStepName } from '../domain/deletion';
import { adapter, getRepos } from './runtime';
import { useAppStore } from './appStore';

/** The user's choice per shared owned vehicle: vehicleId → new owner uid, or
 * a place in `deletes` when the vehicle should be deleted instead. */
export interface DeletionChoices {
  handoffs: Record<string, string>;
  deletes?: string[];
}

export class DeletionError extends RepoError {
  constructor(code: RepoError['code'], message?: string) {
    super(code, message);
    this.name = 'DeletionError';
  }
}

const isGone = (e: unknown): e is RepoError =>
  e instanceof RepoError && (e.code === 'not-found' || e.code === 'permission-denied');

function uidOrThrow(): string {
  const u = adapter().currentUser();
  if (!u) throw new DeletionError('unavailable', 'no signed-in user');
  return u.uid;
}

function setStep(step: DeletionStepName | null): void {
  useAppStore.setState({ deletionStep: step });
}

/** Live plan for the summary screen (and for the engine itself). */
export async function buildMyDeletionPlan(): Promise<DeletionPlan> {
  const uid = uidOrThrow();
  const vehicles = await getRepos().vehicles.listMine();
  return buildDeletionPlan(uid, vehicles);
}

/**
 * Load the in-progress record (doc first — the server copy is authoritative —
 * then the local marker). When the user document is already gone the marker
 * is all that remains; the only step left is 'account'.
 */
export async function loadDeletionRecord(uid: string): Promise<DeletionDoc | null> {
  const repos = getRepos();
  const user = await repos.users.getUser(uid);
  if (user?.deletion && user.deletion.status !== 'done') {
    await localFlags.saveDeletion(uid, user.deletion);
    return user.deletion;
  }
  const marker = (await localFlags.deletion(uid)) as DeletionDoc | null;
  return marker && marker.status !== 'done' ? marker : null;
}

/** Persist a completed step — doc when it still exists, marker always. */
async function markStep(uid: string, record: DeletionDoc, step: DeletionStepName): Promise<DeletionDoc> {
  const next: DeletionDoc = { ...record, completedSteps: [...record.completedSteps, step] };
  const repos = getRepos();
  const user = await repos.users.getUser(uid).catch(() => null);
  if (user) {
    try {
      await repos.users.setDeletion(uid, next);
    } catch (e) {
      // The doc may have been deleted by the 'user' step already.
      if (!isGone(e)) throw e;
    }
  }
  await localFlags.saveDeletion(uid, next);
  useAppStore.setState({ deletionRecord: next });
  return next;
}

/** Delete a vehicle subtree; already-deleted is fine (resume-safe). */
async function deleteVehicleIdempotent(vehicleId: string): Promise<void> {
  try {
    await getRepos().vehicles.delete(vehicleId);
  } catch (e) {
    if (!isGone(e)) throw e;
  }
}

/** Leave a vehicle; already-left / gone is fine. */
async function leaveIdempotent(vehicleId: string): Promise<void> {
  try {
    await getRepos().vehicles.leave(vehicleId);
  } catch (e) {
    if (!isGone(e)) throw e;
  }
}

/**
 * Handoffs step (VD-05): for each owned vehicle that still has other members,
 * transfer to the recorded choice — falling back to the next longest-standing
 * member when the chosen one left mid-run (SC-REL05-03). A vehicle left with
 * no other members is deleted instead. Ownership moves in one write with no
 * acceptance; pending invites are cleaned up by the invites step (VD-04).
 */
async function runHandoffs(uid: string, record: DeletionDoc): Promise<void> {
  const repos = getRepos();
  const deleteSet = new Set(record.deletes ?? []);
  for (const v of await repos.vehicles.listMine()) {
    if (v.ownerId !== uid) continue; // already handed off, or only a member
    if (deleteSet.has(v.id)) continue; // user chose delete — the vehicles step does it
    let candidates = memberCandidates(v, uid);
    if (candidates.length === 0) {
      await deleteVehicleIdempotent(v.id); // became unshared mid-run
      continue;
    }
    const chosen = record.handoffs[v.id];
    const ordered = [chosen, ...candidates.map((c) => c.uid)]
      .filter((u, i, a): u is string => !!u && a.indexOf(u) === i);
    let done = false;
    for (const target of ordered) {
      try {
        await repos.vehicles.transferOwnership(v.id, target);
        record.handoffs[v.id] = target;
        done = true;
        break;
      } catch (e) {
        if (isGone(e)) {
          const fresh = await repos.vehicles.get(v.id);
          if (!fresh || fresh.ownerId !== uid) {
            done = true; // already handed off (or deleted) — nothing to do
            break;
          }
          candidates = memberCandidates(fresh, uid);
          if (!candidates.some((c) => c.uid === target)) continue; // target left — next candidate
          throw e; // still owner, target still a member — a real failure
        }
        throw e;
      }
    }
    if (!done) {
      const fresh = await repos.vehicles.get(v.id);
      if (fresh && fresh.ownerId === uid) {
        if (memberCandidates(fresh, uid).length === 0) await deleteVehicleIdempotent(v.id);
        else throw new DeletionError('aborted', 'no remaining handoff member');
      }
    }
  }
}

/**
 * Vehicles step: delete every vehicle the user still owns. Handoffs already
 * ran, so anything left is an unshared vehicle or one the user chose to
 * delete (absent from the record's handoffs map).
 */
async function runVehicleDeletes(uid: string): Promise<void> {
  const repos = getRepos();
  for (const v of await repos.vehicles.listMine()) {
    if (v.ownerId !== uid) continue;
    await deleteVehicleIdempotent(v.id);
  }
}

/** Memberships step: leave every vehicle owned by someone else (VD-04). */
async function runMembershipLeaves(uid: string): Promise<void> {
  const repos = getRepos();
  for (const v of await repos.vehicles.listMine()) {
    if (v.ownerId === uid) continue;
    if (!v.memberIds.includes(uid)) continue;
    await leaveIdempotent(v.id);
  }
}

/** Invites step: delete every invite the user created (VD-04). */
async function runInviteDeletes(): Promise<void> {
  const repos = getRepos();
  for (const inv of await repos.invites.listMine()) {
    try {
      await repos.invites.cancel(inv.code);
    } catch (e) {
      if (!isGone(e)) throw e;
    }
  }
}

/**
 * Run a deletion to completion. With `choices` a fresh record is created
 * (first run from the summary screen); without them the in-progress record
 * resumes (REL-07 — the record's handoffs map is the confirmed choice set).
 */
export async function runDeletion(choices?: DeletionChoices): Promise<void> {
  const repos = getRepos();
  const uid = uidOrThrow();

  let record: DeletionDoc | null = choices
    ? {
        status: 'in-progress',
        startedAt: adapter().now(),
        handoffs: { ...choices.handoffs },
        deletes: [...(choices.deletes ?? [])],
        completedSteps: [],
      }
    : await loadDeletionRecord(uid);
  if (!record) throw new DeletionError('not-found', 'no deletion in progress');
  if (choices) {
    // Persist before any destructive work (VD-04: progress in users/{uid}).
    await repos.users.setDeletion(uid, record);
  }
  await localFlags.saveDeletion(uid, record);
  useAppStore.setState({ deletionRecord: record, deletionStep: null });

  const done = (s: DeletionStepName) => record!.completedSteps.includes(s);
  const step = async (name: DeletionStepName, fn: () => Promise<void>) => {
    if (done(name)) return;
    setStep(name);
    await fn();
    record = await markStep(uid, record!, name);
  };

  try {
    await step('handoffs', () => runHandoffs(uid, record!));
    await step('vehicles', () => runVehicleDeletes(uid));
    await step('memberships', () => runMembershipLeaves(uid));
    await step('invites', runInviteDeletes);
    await step('user', async () => {
      // Marker first — after the doc is gone it is the only resume source
      // and it stops a restart recreating the document (VD-04).
      await localFlags.saveDeletion(uid, { ...record!, completedSteps: [...record!.completedSteps, 'user'] });
      await repos.users.deleteUserDoc(uid);
    });
    // 'account' is last and can never be recorded — the record lives in the
    // document and account this step deletes. A resume re-attempts it.
    if (!done('account')) {
      setStep('account');
      await adapter().deleteAccount();
      // VD-04: local cache, notifications and the Google session are cleared.
      // The Drive/reminder cleanups load lazily — they are best-effort, and
      // the node emulator suite has no React Native to import them with.
      await localFlags.clearFor(uid);
      await import('./driveCleanup').then((m) => m.clearDriveSession()).catch(() => undefined);
      await import('./reminders').then((m) => m.clearScheduledNotifications()).catch(() => undefined);
      await adapter().clearPersistence().catch(() => undefined);
      useAppStore.setState({ deletionRecord: null, deletionStep: null });
    }
  } catch (e) {
    setStep(null);
    throw e;
  }
}

/** Fresh Google sign-in so the account step satisfies requires-recent-login. */
export async function reauthenticateForDeletion(): Promise<void> {
  await adapter().reauthenticateWithGoogle();
}

/**
 * Session-entry check (REL-07): returns the in-progress deletion record when
 * this uid has one — the app then shows the resume gate instead of the normal
 * session bootstrap. Called before ensureUser so the marker is seen even when
 * the user document is already deleted.
 */
export async function pendingDeletion(uid: string): Promise<DeletionDoc | null> {
  return loadDeletionRecord(uid);
}

export type { DeletionPlan, DeletionStepName };
export { DELETION_STEPS } from '../domain/deletion';
