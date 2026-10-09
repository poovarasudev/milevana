// Identity flows (FND-AUTH-02..08): web Google sign-in, anonymous→Google link,
// the credential-already-in-use conflict (Move and switch / Switch without
// moving / Cancel), the persisted merge with resume + discard, and sign-out.

import { AuthError, CommitHandle, RepoError } from '../data/adapter';
import { localFlags } from '../data/localFlags';
import {
  exportBundle, ExportBundle, planImport, repoExportSource, runImport,
} from '../data/serializer';
import { ANON_AUTHOR_NAME } from '../data/schema/common';
import { useAppStore } from './appStore';
import { clearDriveSession } from './driveCleanup';
import { registerGateLauncher, resolveGate } from './linkPrompt';
import { clearScheduledNotifications } from './reminders';
import { adapter, getRepos } from './runtime';
import { reportNonFatal } from './reporting';
import { pauseSession, refreshSession, repairLinkedIdentity } from './session';
import { deviceLanguage } from '../i18n';

/** Time to wait for server confirmation of each merge batch (DR-11 ◐). */
export const MERGE_CONFIRM_MS = 30_000;

// --- web sign-in (FND-AUTH-02) ----------------------------------------------

export async function signInWeb(): Promise<void> {
  useAppStore.setState({ signinError: false, redirecting: false });
  try {
    await adapter().signInWithGoogle();
    // success → the auth listener enters the session
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'unknown';
    if (code === 'redirect-started') {
      useAppStore.setState({ redirecting: true });
      return;
    }
    if (code === 'cancelled') return; // silent (FR-ERR-06)
    reportNonFatal(e, { stage: 'web-signin', code });
    useAppStore.setState({ signinError: true });
  }
}

// --- link Google (FND-AUTH-03) ----------------------------------------------

export async function linkGoogle(): Promise<void> {
  const st = useAppStore.getState();
  if (!st.user || !st.user.isAnonymous || st.linking) return;
  useAppStore.setState({ linking: true, linkError: false });
  try {
    const u = await adapter().linkWithGoogle();
    // Same uid — DR-02: fill member profiles and rewrite 'Me' placeholders.
    await getRepos().users.markLinked(u.uid, u.displayName ?? undefined, u.email ?? undefined);
    await repairLinkedIdentity();
    useAppStore.setState({ linking: false, linkPromptVisible: false });
    resolveGate('linked');
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'unknown';
    if (code === 'credential-already-in-use') {
      await openConflict().catch((err) => {
        reportNonFatal(err, { stage: 'conflict-count' });
        useAppStore.setState({ linking: false, linkError: true });
      });
      return;
    }
    useAppStore.setState({ linking: false });
    if (code === 'cancelled' || code === 'redirect-started') {
      // silent — the user dismissed the picker (SC-AUTH03-03)
      resolveGate('cancelled');
      return;
    }
    reportNonFatal(e, { stage: 'link', code });
    useAppStore.setState({ linkError: true });
    resolveGate('failed');
  }
}

registerGateLauncher(linkGoogle);

// --- account conflict (FND-AUTH-05) -----------------------------------------

/** Count the anonymous account's owned vehicles + entries for the prompt. */
async function openConflict(): Promise<void> {
  const repos = getRepos();
  const owned = await repos.vehicles.listOwned();
  const entryCount = await repos.entries.countAcrossVehicles(owned.map((v) => v.id));
  useAppStore.setState({
    linking: false,
    conflict: { vehicleCount: owned.length, entryCount },
    conflictWarnStep: false,
  });
}

/** Cancel — nothing changes; the retained credential is dropped. */
export function conflictCancel(): void {
  adapter().discardRetainedCredential();
  useAppStore.setState({ conflict: null, conflictWarnStep: false });
  resolveGate('cancelled');
}

/** First step of "Switch without moving" — show the unrecoverable warning. */
export function conflictShowWarning(): void {
  useAppStore.setState({ conflictWarnStep: true });
}

export function conflictBack(): void {
  useAppStore.setState({ conflictWarnStep: false });
}

/** Confirmed switch: sign in with the retained credential; phone data stays. */
export async function conflictSwitchWithoutMoving(): Promise<void> {
  try {
    await adapter().signInWithRetainedCredential();
    // auth listener enters the Google session; the anonymous data is abandoned
    useAppStore.setState({ conflict: null, conflictWarnStep: false });
    resolveGate('linked');
  } catch (e) {
    reportNonFatal(e, { stage: 'conflict-switch' });
    // Expired/invalid credential — ask the user to retry linking (SC-AUTH05-06).
    adapter().discardRetainedCredential();
    useAppStore.setState({ conflict: null, conflictWarnStep: false, linkError: true });
    resolveGate('failed');
  }
}

/** "Move and switch" — serialize, persist, sign in, import (FR-MERGE-01). */
export async function conflictMoveAndSwitch(): Promise<void> {
  useAppStore.setState({
    conflict: null,
    conflictWarnStep: false,
    merge: { status: 'moving', confirmDiscard: false },
  });
  try {
    await runMerge();
    useAppStore.setState({ merge: { status: 'idle', confirmDiscard: false } });
    resolveGate('linked');
  } catch (e) {
    reportNonFatal(e, { stage: 'merge' });
    useAppStore.setState({ merge: { status: 'failed', confirmDiscard: false } });
    resolveGate('failed');
  }
}

// --- merge (FND-AUTH-06/07) --------------------------------------------------

function confirmBatch(h: CommitHandle): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    h.ack,
    new Promise<void>((_, reject) => {
      timer = setTimeout(
        () => reject(new RepoError('unavailable', 'merge-batch-timeout')),
        MERGE_CONFIRM_MS,
      );
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * The full move: serialize while still anonymous → persist privately → sign in
 * with the retained credential → ensure the Google user doc without touching
 * its settings (FR-MERGE-09) → import vehicle-first in ≤500-op batches →
 * clear the stored bundle. The auth listener swaps the session underneath us.
 */
async function runMerge(): Promise<void> {
  const a = adapter();
  const repos = getRepos();
  const bundle = await exportBundle(repoExportSource(repos), a.now());
  await localFlags.saveMergeRetry(bundle); // persisted BEFORE sign-in
  const u = await a.signInWithRetainedCredential();
  await importBundle(bundle, u.uid);
}

async function importBundle(bundle: ExportBundle, uid: string): Promise<void> {
  const a = adapter();
  const repos = getRepos();
  const u = a.currentUser();
  await repos.users.ensureUser(uid, {
    language: deviceLanguage(),
    isLinked: true,
    displayName: u?.displayName ?? undefined,
    email: u?.email ?? undefined,
  });
  const plan = planImport(bundle, uid, a.now(), {
    ownerName: u?.displayName ?? undefined,
    ownerEmail: u?.email ?? undefined,
    rewriteAuthorFrom: ANON_AUTHOR_NAME,
    authorName: u?.displayName ?? u?.email ?? undefined,
  });
  await runImport(a, plan, confirmBatch);
  await localFlags.clearMergeRetry();
  useAppStore.setState({ mergeResumeAvailable: false });
}

/** "Finish moving your data" — resume the stored merge at launch (AUTH-07). */
export async function resumeMerge(): Promise<void> {
  const bundle = await localFlags.loadMergeRetry();
  if (!bundle) {
    useAppStore.setState({
      phase: 'ready',
      mergeResumeAvailable: false,
      merge: { status: 'idle', confirmDiscard: false },
    });
    return;
  }
  useAppStore.setState({ merge: { status: 'moving', confirmDiscard: false } });
  try {
    let u = adapter().currentUser();
    if (!u) throw new AuthError('unavailable', 'no session');
    if (u.isAnonymous) {
      // Killed before the Google sign-in: the retained credential died with
      // the process, so relink — the picker re-prompts, conflicts, retains.
      try {
        await adapter().linkWithGoogle();
      } catch (e) {
        if (!(e instanceof AuthError) || e.code !== 'credential-already-in-use') throw e;
      }
      u = await adapter().signInWithRetainedCredential();
    }
    await importBundle(bundle, u.uid);
    useAppStore.setState({
      phase: 'ready',
      merge: { status: 'idle', confirmDiscard: false },
    });
  } catch (e) {
    const code = e instanceof AuthError ? e.code : 'unknown';
    if (code === 'cancelled') {
      // user backed out of the picker — stay on the resume gate
      useAppStore.setState({ merge: { status: 'idle', confirmDiscard: false } });
      return;
    }
    reportNonFatal(e, { stage: 'merge-resume' });
    useAppStore.setState({ merge: { status: 'failed', confirmDiscard: false } });
  }
}

/** Two-step discard — the stored data cannot be recovered (DR-10). */
export function askDiscardMerge(): void {
  useAppStore.setState({ merge: { ...useAppStore.getState().merge, confirmDiscard: true } });
}

export function cancelDiscardMerge(): void {
  useAppStore.setState({ merge: { ...useAppStore.getState().merge, confirmDiscard: false } });
}

export async function confirmDiscardMerge(): Promise<void> {
  await localFlags.clearMergeRetry();
  useAppStore.setState({
    merge: { status: 'idle', confirmDiscard: false },
    mergeResumeAvailable: false,
    phase: 'ready',
  });
}

// --- sign-out (FND-AUTH-08) --------------------------------------------------

let waitSyncUnsub: (() => void) | null = null;

export function requestSignOut(): void {
  const st = useAppStore.getState();
  if (!st.user || st.user.isAnonymous || st.signingOut) return;
  // Unsynced writes + queued receipt uploads both count (SC-DRV12-05).
  const n = st.pendingChanges + st.receiptQueuePending;
  if (n > 0 && adapter().platform === 'native') {
    useAppStore.setState({ signOutPending: n });
  } else {
    void doSignOut();
  }
}

export function signOutWaitAndSync(): void {
  waitSyncUnsub?.();
  // The pending ticker updates pendingChanges; when it hits zero, proceed.
  waitSyncUnsub = useAppStore.subscribe((s) => {
    if (s.signOutPending !== null && s.pendingChanges === 0) {
      waitSyncUnsub?.();
      waitSyncUnsub = null;
      void doSignOut();
    }
  });
}

export function signOutCancel(): void {
  waitSyncUnsub?.();
  waitSyncUnsub = null;
  useAppStore.setState({ signOutPending: null });
}

export async function signOutDiscard(): Promise<void> {
  useAppStore.setState({ signOutPending: null });
  await doSignOut();
}

async function doSignOut(): Promise<void> {
  const st = useAppStore.getState();
  if (!st.user || st.signingOut) return;
  const uid = st.user.uid;
  useAppStore.setState({ signingOut: true, signOutPending: null });
  try {
    // Retry data + device-local flags die with the session (FR-OUT-05).
    await localFlags.clearMergeRetry();
    await localFlags.clearFor(uid);
    await clearDriveSession(); // DRV-12/13: Drive session, receipt cache, temp
    pauseSession(); // stop watchers + reset before clearing the cache
    await clearScheduledNotifications(); // REM-03
    await adapter().clearPersistence();
    await adapter().signOut();
    // auth listener → null → anonymous bootstrap (native) or sign-in (web)
  } catch (e) {
    reportNonFatal(e, { stage: 'sign-out' });
    refreshSession();
  } finally {
    useAppStore.setState({ signingOut: false });
  }
}
