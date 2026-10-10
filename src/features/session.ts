// Session bootstrap + per-user watches (FND-AUTH-01, FND-SHL-04, FND-OBS-02/03).
//
// Phases: booting → connect | signin | error | merge-resume → ready.
//  - Android with no session signs in anonymously; offline failure shows the
//    "Connect to get started" gate and retries on a backoff (FR-AUTH-05).
//  - Web with no session shows the Google sign-in screen (FR-WEB-01).
//  - A session without a user document recreates it with defaults (OQ-39).
//  - A stored merge bundle gates normal navigation with "Finish moving your
//    data" until retried or discarded (FR-MERGE-10).

import { AuthError, AuthUser, RepoError } from '../data/adapter';
import { FirebaseConfigError, missingFirebaseEnvVars } from '../data/firebaseConfig';
import { localFlags } from '../data/localFlags';
import type { MalformedDocInfo } from '../data/repos/base';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { useAppStore } from './appStore';
import { commitPendingDeletes, installDeleteFlush, startEntriesWatch } from './entries';
import { startTemplatesWatch } from './checklists';
import { maybeRunAutomaticBackup } from './backup';
import { installReceiptShareSync } from './receiptShare';
import { runPendingDriveDeletes } from './driveDeletes';
import { localFiles } from '../data/localFiles';
import { stopReportEntryWatches } from './reportData';
import { requestRebuild, startReminders, stopReminders, syncReminderWatches } from './reminders';
import { syncEntryWatch, stopEntryWatch } from './linkPrompt';
import { adapter, getRepos, setMalformedSink } from './runtime';
import { reportNonFatal } from './reporting';
import { installWriteObserver, recomputePending } from './sync';
import { installUploadDriver, refreshUploadQueueState, sweepOrphanedStaging } from './uploadQueue';
import { deviceLanguage, i18n, initI18n, resolveLocale } from '../i18n';

let lifecycleStops: (() => void)[] = [];
let sessionStops: (() => void)[] = [];
let entriesWatchStop: (() => void) | null = null;
let entriesWatchId: string | null = null;
let templatesWatchStop: (() => void) | null = null;
let templatesWatchId: string | null = null;
let started = false;
let sessionToken = 0;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let connectDelay = 4000;
let bootstrapInFlight = false;

/** Wire the lifecycle once from the root layout. */
export function startSession(): () => void {
  initI18n();
  if (started) return () => undefined;
  started = true;
  setMalformedSink(reportMalformedDoc);
  lifecycleStops.push(installWriteObserver());
  lifecycleStops.push(installDeleteFlush()); // LD-12: backgrounding commits deletes
  // ED-12: leftover CSV temp files go at every app start.
  try {
    void localFiles().clearTemp();
  } catch {
    // no local files impl (tests)
  }
  try {
    lifecycleStops.push(
      adapter().onAuthStateChanged((user) => {
        void handleAuthChange(user);
      }),
    );
    lifecycleStops.push(
      adapter().onConnectivityChanged((online) => {
        useAppStore.setState({ online });
      }),
    );
  } catch (e) {
    // Missing/invalid Firebase env config (web EXPO_PUBLIC_FIREBASE_*) must not
    // leave a blank screen — the config gate names the variables.
    const missing =
      e instanceof FirebaseConfigError ? e.missing : missingFirebaseEnvVars();
    useAppStore.setState({ phase: 'config', configMissingVars: missing });
  }
  return () => {
    started = false;
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    teardownSession();
    lifecycleStops.forEach((s) => s());
    lifecycleStops = [];
  };
}

function teardownSession(): void {
  sessionStops.forEach((s) => s());
  sessionStops = [];
  stopReminders();
  stopEntryWatch();
  stopReportEntryWatches();
  entriesWatchStop?.();
  entriesWatchStop = null;
  entriesWatchId = null;
  templatesWatchStop?.();
  templatesWatchStop = null;
  templatesWatchId = null;
  commitPendingDeletes(); // LD-12: leaving mid-window commits the deletes
}

/** History read-model watch follows the selected vehicle (LOG-11, LD-10). */
function syncSelectedEntriesWatch(): void {
  const vid = useAppStore.getState().selectedVehicleId;
  if (vid !== entriesWatchId) {
    entriesWatchStop?.();
    entriesWatchStop = null;
    entriesWatchId = vid;
    if (vid) entriesWatchStop = startEntriesWatch(vid);
  }
  if (vid !== templatesWatchId) {
    templatesWatchStop?.();
    templatesWatchStop = null;
    templatesWatchId = vid;
    // CHK-02: the templates watch follows the same selection.
    if (vid) templatesWatchStop = startTemplatesWatch(vid);
  }
}

/** Sign-out pre-step: stop watchers and invalidate in-flight session work so
 * clearPersistence runs on a quiet client (FR-OUT-02). */
export function pauseSession(): void {
  sessionToken++;
  teardownSession();
  useAppStore.setState({
    vehicles: [],
    vehiclesLoaded: false,
    entries: [],
    entriesVehicleId: null,
    entriesArrived: false,
    reportEntries: {},
    reportEntriesArrived: {},
    reportEntriesFailed: {},
    pendingDeletes: {},
    userDoc: null,
    selectedVehicleId: null,
    reportsAllVehicles: false,
    reminders: {},
    remindersArrived: {},
    templates: [],
    templatesVehicleId: null,
    templatesArrived: false,
    odoEntries: {},
    snoozes: {},
    odoAlerted: {},
    notifPermission: null,
    notifNoticeOff: false,
    syncIssues: [],
    skippedDocs: [],
    pendingChanges: 0,
    linkPromptVisible: false,
    conflict: null,
    conflictWarnStep: false,
    accessLost: false,
    ownerError: false,
  });
}

/** Re-enter after a failed sign-out (session state was paused). */
export function refreshSession(): void {
  void handleAuthChange(adapter().currentUser());
}

// --- bootstrap -------------------------------------------------------------

async function handleAuthChange(user: AuthUser | null): Promise<void> {
  const token = ++sessionToken;
  teardownSession();
  const st = useAppStore.getState();
  if (!user) {
    useAppStore.setState({
      phase: 'booting',
      sessionSeq: st.sessionSeq + 1,
      user: null,
      userDoc: null,
      vehicles: [],
      vehiclesLoaded: false,
      entries: [],
      entriesVehicleId: null,
      entriesArrived: false,
      reportEntries: {},
      reportEntriesArrived: {},
      reportEntriesFailed: {},
      pendingDeletes: {},
      selectedVehicleId: null,
      reportsAllVehicles: false,
      reminders: {},
      remindersArrived: {},
      templates: [],
      templatesVehicleId: null,
      templatesArrived: false,
      odoEntries: {},
      snoozes: {},
      odoAlerted: {},
      notifPermission: null,
      notifNoticeOff: false,
      mru: [],
      welcomeSeen: false,
      linkPromptDismissed: false,
      linkPromptVisible: false,
      entryCountTotal: 0,
      conflict: null,
      conflictWarnStep: false,
      mergeResumeAvailable: false,
      signOutPending: null,
      skippedDocs: [],
      accessLost: false,
      ownerError: false,
      deleteFailedIds: [],
      syncIssues: [],
      pendingChanges: 0,
      signinError: false,
    });
    if (adapter().platform === 'native') void attemptAnonymous(token);
    else useAppStore.setState({ phase: 'signin' });
    return;
  }
  // Ignore duplicate events for the session that is already running.
  if (st.user?.uid === user.uid && (st.phase === 'ready' || st.phase === 'merge-resume')) return;
  await enterSession(token, user);
}

/** Anonymous bootstrap — native only (FR-AUTH-02/05). */
async function attemptAnonymous(token: number): Promise<void> {
  if (bootstrapInFlight) return;
  bootstrapInFlight = true;
  try {
    await adapter().signInAnonymously();
    // the auth listener fires with the new user → enterSession
  } catch (e) {
    if (token !== sessionToken) return;
    const code = e instanceof AuthError ? e.code : 'unknown';
    if (code === 'network' || code === 'unavailable') {
      useAppStore.setState({ phase: 'connect' });
      scheduleConnectRetry();
    } else {
      reportNonFatal(e, { stage: 'bootstrap', code });
      useAppStore.setState({ phase: 'error' });
    }
  } finally {
    bootstrapInFlight = false;
  }
}

function scheduleConnectRetry(): void {
  if (connectTimer) return;
  connectTimer = setTimeout(() => {
    connectTimer = null;
    connectDelay = Math.min(connectDelay * 2, 30_000);
    void retryBootstrap();
  }, connectDelay);
}

/** "Try now" / Retry on the Connect and error gates, and the backoff loop. */
export function retryBootstrap(): void {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  connectDelay = 4000;
  if (useAppStore.getState().user) {
    // signed in but session setup failed (e.g. offline ensureUser)
    void handleAuthChange(adapter().currentUser());
  } else {
    void attemptAnonymous(sessionToken);
  }
}

// --- per-user session -------------------------------------------------------

async function enterSession(token: number, user: AuthUser): Promise<void> {
  const repos = getRepos();
  const uid = user.uid;
  useAppStore.setState({ user, phase: 'booting' });

  const [welcomeSeen, linkDismissed, mru, deleteFailedIds] = await Promise.all([
    localFlags.welcomeSeen(uid),
    localFlags.linkDismissed(uid),
    localFlags.mru(uid),
    localFlags.deleteFailed(uid),
  ]);
  if (token !== sessionToken) return;
  useAppStore.setState({ welcomeSeen, linkPromptDismissed: linkDismissed, mru, deleteFailedIds });

  try {
    // Create the user doc if missing (killed between sign-in and creation,
    // OQ-39). Never overwrites an existing document.
    await repos.users.ensureUser(uid, {
      language: deviceLanguage(),
      isLinked: !user.isAnonymous,
      displayName: user.displayName ?? undefined,
      email: user.email ?? undefined,
    });
  } catch (e) {
    if (token !== sessionToken) return;
    const code = e instanceof RepoError ? e.code : 'unknown';
    if (code === 'unavailable' || code === 'offline') {
      useAppStore.setState({ phase: 'connect' });
      scheduleConnectRetry();
    } else {
      reportNonFatal(e, { stage: 'ensure-user', code });
      useAppStore.setState({ phase: 'error' });
    }
    return;
  }

  const retryBundle = await localFlags.loadMergeRetry();
  if (token !== sessionToken) return;

  startWatchers(user);
  const inFlightMerge = useAppStore.getState().merge.status === 'moving';
  useAppStore.setState({
    mergeResumeAvailable: retryBundle !== null,
    phase: retryBundle && !inFlightMerge ? 'merge-resume' : 'ready',
  });

  // Idempotent DR-02 repair for linked users (a link killed mid-rewrite leaves
  // placeholders behind; a re-run touches only those rows).
  if (!user.isAnonymous) {
    void repairLinkedIdentity().catch((e) =>
      reportNonFatal(e, { stage: 'identity-repair' }));
  }
}

function startWatchers(user: AuthUser): void {
  const repos = getRepos();
  const uid = user.uid;

  sessionStops.push(
    repos.users.watchUser(
      uid,
      (doc) => {
        if (useAppStore.getState().user?.uid !== uid) return;
        const mutedBefore = useAppStore.getState().userDoc?.settings.mutedReminderVehicleIds;
        useAppStore.setState({ userDoc: doc });
        // REM-09: a mute-list change rebuilds the schedule.
        const mutedAfter = doc?.settings.mutedReminderVehicleIds;
        if (JSON.stringify(mutedBefore) !== JSON.stringify(mutedAfter)) requestRebuild();
        if (doc) {
          const loc = resolveLocale(doc.settings.locale);
          if (i18n.language !== loc) void i18n.changeLanguage(loc);
        } else {
          // user doc missing mid-session — recreate with defaults (OQ-39)
          void repos.users
            .ensureUser(uid, { language: deviceLanguage(), isLinked: !user.isAnonymous })
            .catch((e) => reportNonFatal(e, { stage: 'ensure-user' }));
        }
      },
      {
        onError: (e) => {
          reportNonFatal(e, { stage: 'watch-user' });
          useAppStore.setState({ ownerError: true });
        },
      },
    ),
  );

  sessionStops.push(
    repos.vehicles.watchMine(handleVehicleList, {
      onError: (e) => {
        reportNonFatal(e, { stage: 'watch-vehicles' });
        if (e instanceof RepoError && e.code === 'permission-denied') {
          // Owner-side read denial is unexpected — generic error + Retry (DR-16).
          useAppStore.setState({ ownerError: true });
        }
      },
    }),
  );

  const pendingTick = setInterval(recomputePending, 1500);
  sessionStops.push(() => clearInterval(pendingTick));

  // REM-03: reminder watches and the notification rebuild loop.
  startReminders();

  // DRV-08/12/14 — Drive housekeeping: the receipt upload queue driver, a
  // staging sweep for orphaned picks, pending Drive deletes, and the
  // automatic backup when the configured frequency is stale (Android only).
  sessionStops.push(installUploadDriver(uid));
  void refreshUploadQueueState(uid);
  void sweepOrphanedStaging(uid);
  void runPendingDriveDeletes(uid);
  void maybeRunAutomaticBackup(uid);
  // SHR-14: receipt share sync — app open + foreground, throttled per
  // vehicle; no-ops on web, offline, anonymous or without a Drive grant.
  sessionStops.push(installReceiptShareSync(uid));

  if (user.isAnonymous) {
    // populated once the vehicle list lands (handleVehicleList → syncEntryWatch)
  }
}

// --- vehicle list → selection (DR-15) --------------------------------------

export function handleVehicleList(list: VehicleRecord[]): void {
  const st = useAppStore.getState();
  const uid = st.user?.uid;
  const prev = st.vehicles;

  // Selected vehicle disappeared and it wasn't a local action — membership
  // was revoked or the vehicle was deleted on another device (FND-OBS-03).
  let accessLost = false;
  if (st.selectedVehicleId && !list.some((v) => v.id === st.selectedVehicleId)) {
    const gone = prev.find((v) => v.id === st.selectedVehicleId);
    if (gone && gone.ownerId !== uid) {
      accessLost = true;
      reportNonFatal(new RepoError('permission-denied'), { stage: 'access-lost', id: gone.id });
    }
  }

  const selectedVehicleId = resolveSelection(list, st.mru, st.selectedVehicleId);
  useAppStore.setState({
    vehicles: list,
    vehiclesLoaded: true,
    selectedVehicleId,
    accessLost: st.accessLost || accessLost,
  });
  syncEntryWatch(list);
  syncSelectedEntriesWatch();
  syncReminderWatches();
  requestRebuild();
  recomputePending();
}

/** Most-recently-used surviving vehicle, else oldest active (DR-15). */
export function resolveSelection(
  vehicles: VehicleRecord[],
  mru: string[],
  current: string | null,
): string | null {
  const active = vehicles.filter((v) => !v.archived);
  if (current && active.some((v) => v.id === current)) return current;
  for (const id of mru) {
    if (active.some((v) => v.id === id)) return id;
  }
  const first = [...active].sort((a, b) => a.createdAt.seconds - b.createdAt.seconds)[0];
  return first?.id ?? null;
}

export async function selectVehicle(vehicleId: string): Promise<void> {
  const st = useAppStore.getState();
  const uid = st.user?.uid;
  const mru = uid ? await localFlags.pushMru(uid, vehicleId) : st.mru;
  useAppStore.setState({ selectedVehicleId: vehicleId, mru, reportsAllVehicles: false });
  syncSelectedEntriesWatch();
}

/** "All vehicles" affects Reports only; other tabs keep the single selection. */
export function selectAllVehicles(): void {
  useAppStore.setState({ reportsAllVehicles: true });
}

// --- identity repair (DR-02) ------------------------------------------------

/**
 * After linking: fill the owner's member record with name/email and rewrite
 * 'Me' entry placeholders to the Google name. Idempotent — a re-run touches
 * only rows still carrying placeholders, so it is also safe on every launch.
 */
export async function repairLinkedIdentity(): Promise<void> {
  const user = adapter().currentUser();
  if (!user || user.isAnonymous) return;
  const repos = getRepos();
  const name = user.displayName ?? user.email;
  const owned = await repos.vehicles.listOwned();
  for (const v of owned) {
    await repos.vehicles.updateMemberProfile(v.id, user.displayName, user.email);
    if (!name) continue;
    const ids = await repos.entries.listPlaceholderAuthored(v.id);
    if (ids.length > 0) await repos.entries.setAuthorName(v.id, ids, name);
  }
}

// --- malformed docs (FND-OBS-03) --------------------------------------------

function reportMalformedDoc(info: MalformedDocInfo): void {
  reportNonFatal(new RepoError(info.code === 'newer-schema' ? 'invalid-argument' : 'invalid-argument'), {
    kind: info.kind,
    id: info.id,
    path: info.path,
    code: info.code,
  });
  const st = useAppStore.getState();
  if (st.skippedDocs.some((d) => d.path === info.path)) return;
  useAppStore.setState({ skippedDocs: [...st.skippedDocs, info] });
}
