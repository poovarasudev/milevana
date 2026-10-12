// Session + UI view-model store. Zustand holds ONLY UI/session state here
// (DR-15): the phase machine, the latest repository snapshots (a read model —
// writes always go through the repos), the device-local vehicle selection, and
// transient dialog flags. It never persists Firestore data.

import { create } from 'zustand';
import type { AuthUser, WriteOpRecord } from '../data/adapter';
import type { MalformedDocInfo } from '../data/repos/base';
import type { DeletionDoc, UserDoc } from '../data/schema/user';
import type { EntryRecord } from '../data/repos/entryRepo';
import type { ReminderRecord } from '../data/repos/reminderRepo';
import type { TemplateRecord } from '../data/repos/templateRepo';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import type { NotificationPermissionState } from '../data/notifications';

export type Phase =
  | 'booting' // auth listener not yet fired
  | 'config' // Firebase env config missing/invalid — names the EXPO_PUBLIC_* vars
  | 'connect' // no session, offline (native first launch) — "Connect to get started"
  | 'signin' // web signed-out visitor — Google sign-in screen
  | 'error' // sign-in failed with a non-network error — Retry offered
  | 'merge-resume' // stored merge data found at launch — "Finish moving your data"
  | 'deleting' // unfinished account deletion found — "Finish deleting your account" (REL-07)
  | 'ready';

export interface SyncIssue {
  id: string;
  /** RepoError code; 'permission-denied' renders as the access-lost message. */
  code: string;
  /** Op journal (kind + path) so Retry can resubmit the original change. */
  journal: WriteOpRecord[];
}

export interface ConflictInfo {
  vehicleCount: number;
  entryCount: number;
}

export interface MergeState {
  status: 'idle' | 'moving' | 'failed';
  /** Whether the discard-confirmation step is showing. */
  confirmDiscard: boolean;
}

interface AppState {
  phase: Phase;
  /** EXPO_PUBLIC_FIREBASE_* names whose value is missing/invalid (config gate). */
  configMissingVars: string[];
  /** Bumped when the signed-in uid changes so screens can reset local state. */
  sessionSeq: number;
  user: AuthUser | null;
  userDoc: UserDoc | null;
  /** Latest watchMine snapshot — read model only. */
  vehicles: VehicleRecord[];
  vehiclesLoaded: boolean;
  /** Latest entries watch snapshot for `entriesVehicleId` — read model only. */
  entries: EntryRecord[];
  entriesVehicleId: string | null;
  entriesArrived: boolean;
  /** Report cache: per-vehicle entry sets for the All-vehicles report (RPT-04).
   *  The selected vehicle is NOT stored here — it reuses `entries`. */
  reportEntries: Record<string, EntryRecord[]>;
  reportEntriesArrived: Record<string, boolean>;
  /** Vehicles whose report load failed — "Couldn't load <name>" (RPT-12). */
  reportEntriesFailed: Record<string, boolean>;
  /** Latest checklist templates watch for the selected vehicle (CHK-02). */
  templates: TemplateRecord[];
  templatesVehicleId: string | null;
  templatesArrived: boolean;
  /** Latest reminders watch snapshot per vehicle id (REM-04 read model). */
  reminders: Record<string, ReminderRecord[]>;
  /** Vehicles whose reminders watch has emitted at least once. */
  remindersArrived: Record<string, boolean>;
  /** 90-day-window entry snapshots for vehicles with odometer reminders —
   *  feeds prediction on devices that schedule (REM-01/RD-02). */
  odoEntries: Record<string, EntryRecord[]>;
  /** Device-local snooze ends (ms epoch) keyed by reminder id (RD-06). */
  snoozes: Record<string, number>;
  /** reminderId → dueOdometer already alerted for (odoNow dedupe, RD-03). */
  odoAlerted: Record<string, number>;
  /** Notification permission state last seen (REM-08; null = not probed). */
  notifPermission: NotificationPermissionState | null;
  /** User dismissed the "notifications are off" notice (RD-08: once). */
  notifNoticeOff: boolean;
  /** Rows hidden inside their 5-second Undo window (LD-12). No write has
   * happened yet — undo simply unhides. */
  pendingDeletes: Record<string, { vehicleId: string; entry: EntryRecord }>;
  online: boolean;
  quotaPaused: boolean;
  /** Unsynced local changes (pending docs ∪ in-flight commits). */
  pendingChanges: number;
  syncIssues: SyncIssue[];
  skippedDocs: MalformedDocInfo[];
  /** Selected vehicle vanished and it wasn't a local action (access lost). */
  accessLost: boolean;
  /** Owner-side watch denied — "Something went wrong" + Retry (DR-16). */
  ownerError: boolean;

  // selection (device-local, per uid)
  selectedVehicleId: string | null;
  reportsAllVehicles: boolean;
  mru: string[];

  // welcome / link prompt (device-local flags)
  welcomeSeen: boolean;
  linkPromptDismissed: boolean;
  linkPromptVisible: boolean;
  entryCountTotal: number;

  // auth flows
  linking: boolean;
  linkError: boolean;
  signinError: boolean;
  redirecting: boolean;
  conflict: ConflictInfo | null;
  conflictWarnStep: boolean;
  merge: MergeState;
  mergeResumeAvailable: boolean;
  signingOut: boolean;
  signOutPending: number | null; // null = dialog closed; number = open with count

  // account deletion (REL-05..09): the in-progress record from users/{uid}
  // (or the local marker once the doc is gone) and the step currently running.
  deletionRecord: DeletionDoc | null;
  deletionStep: string | null;

  // vehicle flags
  deleteFailedIds: string[];

  // receipt upload queue (DRV-12 read model)
  /** Attachments waiting to upload to Drive. */
  receiptQueuePending: number;
  /** True when a queued upload last failed with Drive 'storage-full'. */
  receiptStorageFull: boolean;
  /** Receipt share sync is running — the "Sharing receipts…" chip (SD-08). */
  shareSyncRunning: boolean;

  // patch helper — actions live in the feature modules
  set: (patch: Partial<AppState>) => void;
}

const initial: Omit<AppState, 'set'> = {
  phase: 'booting',
  configMissingVars: [],
  sessionSeq: 0,
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
  templates: [],
  templatesVehicleId: null,
  templatesArrived: false,
  reminders: {},
  remindersArrived: {},
  odoEntries: {},
  snoozes: {},
  odoAlerted: {},
  notifPermission: null,
  notifNoticeOff: false,
  pendingDeletes: {},
  online: true,
  quotaPaused: false,
  pendingChanges: 0,
  syncIssues: [],
  skippedDocs: [],
  accessLost: false,
  ownerError: false,
  selectedVehicleId: null,
  reportsAllVehicles: false,
  mru: [],
  welcomeSeen: false,
  linkPromptDismissed: false,
  linkPromptVisible: false,
  entryCountTotal: 0,
  linking: false,
  linkError: false,
  signinError: false,
  redirecting: false,
  conflict: null,
  conflictWarnStep: false,
  merge: { status: 'idle', confirmDiscard: false },
  mergeResumeAvailable: false,
  signingOut: false,
  signOutPending: null,
  deletionRecord: null,
  deletionStep: null,
  deleteFailedIds: [],
  receiptQueuePending: 0,
  receiptStorageFull: false,
  shareSyncRunning: false,
};

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  set: (patch) => set(patch),
}));

/**
 * Stable empty list for `useAppStore` selector fallbacks. The store uses raw
 * `useSyncExternalStore` (no selector memoization), so a selector that
 * returns a fresh `[]` loops forever — always fall back to this constant.
 */
export const EMPTY_LIST: never[] = [];

/** Reset the whole store — used by tests and full sign-out. */
export function resetAppStore(): void {
  useAppStore.setState({ ...initial });
}
