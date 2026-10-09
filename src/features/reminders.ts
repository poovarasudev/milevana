// Reminders feature layer (REM-03..11): one reminders watch per non-archived
// member vehicle, the rebuild loop that turns domain plans into the device's
// scheduled notification set, auto-complete on entry save, device-local
// snooze, per-user mute, the first-reminder permission ask and notification
// tap routing. Firestore access goes through repos only; platform behavior
// lives behind the NotificationClient abstraction.

import { AppState } from 'react-native';
import { RepoError, Unsubscribe } from '../data/adapter';
import { localFlags } from '../data/localFlags';
import {
  getNotifications, NotificationClient, NotificationPermissionState,
  ReminderNotificationData, ScheduledReminder,
} from '../data/notifications';
import { EntryRecord } from '../data/repos/entryRepo';
import { ReminderInput, ReminderPatch, ReminderRecord } from '../data/repos/reminderRepo';
import { USER_DEFAULTS } from '../data/repos/userRepo';
import { VehicleRecord } from '../data/repos/vehicleRepo';
import { SettingsDoc } from '../data/schema/user';
import { Timestamp, tsFromMillis, tsToMillis } from '../data/schema/common';
import { odometerReadings, OdometerReading } from '../domain/entries';
import { formatNumber } from '../domain/money';
import {
  canUseOdometerTrigger, capSchedule, DAY_MS, entryCompletesReminder,
  expenseCategoryFor, isRepeating, isSnoozed, MAX_REMINDERS_PER_VEHICLE,
  opensExpenseForm, orderReminders, planNotifications,
  PlannedNotification, ReminderInfo, reminderInfo, reminderStatus, rollForward,
  SnoozeChoice, snoozeEndMs,
} from '../domain/reminders';
import { displayDistance } from '../domain/units';
import { t } from '../i18n';
import { useAppStore } from './appStore';
import { formatDate } from './format';
import { reportNonFatal } from './reporting';
import { adapter, getRepos } from './runtime';
import { guardedWrite } from './vehicleActions';

// --- module state -------------------------------------------------------------

let sessionUid: string | null = null;
let reminderStops = new Map<string, Unsubscribe>();
let odoStops = new Map<string, Unsubscribe>();
let responseStop: Unsubscribe | null = null;
let foregroundStop: Unsubscribe | null = null;
let storeStop: Unsubscribe | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
let rebuildRunning = false;
let rebuildQueued = false;
/** Reminder ids with a completion write in flight — guards a rapid re-scan. */
const completing = new Set<string>();
/** Tap routing is registered by the root layout (keeps router out of here). */
let navigator: ((data: ReminderNotificationData) => void) | null = null;

const SNOOZES_KEY = 'remSnoozes'; // reminderId → end ms, device-local (RD-06)
const ODO_ALERTS_KEY = 'remOdoAlerted'; // reminderId → dueOdometer already fired
const PERM_ASKED_KEY = 'remPermAsked';
const NOTICE_OFF_KEY = 'remNotifNoticeOff';

function clientOrNull(): NotificationClient | null {
  try {
    return getNotifications();
  } catch {
    return null; // tests without a factory; platform files install one
  }
}

// --- session lifecycle (REM-03) -------------------------------------------------

/** Called from startWatchers once a user session exists. */
export function startReminders(): void {
  const uid = useAppStore.getState().user?.uid;
  if (!uid) return;
  sessionUid = uid;
  const client = clientOrNull();

  // Device-local state: snoozes (prune expired) and odometer alert dedupe.
  void localFlags.getJson<Record<string, number>>(uid, SNOOZES_KEY, {}).then((raw) => {
    const now = Date.now();
    const snoozes = Object.fromEntries(Object.entries(raw).filter(([, ms]) => ms > now));
    if (useAppStore.getState().user?.uid !== uid) return;
    useAppStore.setState({ snoozes });
    if (Object.keys(snoozes).length !== Object.keys(raw).length) {
      void localFlags.setJson(uid, SNOOZES_KEY, snoozes).catch(() => undefined);
    }
  });
  void localFlags.getJson<Record<string, number>>(uid, ODO_ALERTS_KEY, {}).then((alerts) => {
    if (useAppStore.getState().user?.uid === uid) useAppStore.setState({ odoAlerted: alerts });
  });
  void localFlags.getBool(uid, NOTICE_OFF_KEY).then((off) => {
    if (useAppStore.getState().user?.uid === uid) useAppStore.setState({ notifNoticeOff: off });
  });

  if (client) {
    void client.getPermissionState()
      .then((perm) => useAppStore.setState({ notifPermission: perm }))
      .catch(() => undefined);
    responseStop = client.onResponse((d) => routeNotification(d));
    void client.consumeInitialResponse()
      .then((d) => { if (d) routeNotification(d); })
      .catch(() => undefined);
  }

  // Foreground = app open: covers day rollovers and time-zone changes (RD-12).
  const fgSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') requestRebuild();
  });
  foregroundStop = () => fgSub.remove();

  // Vehicle selection changes which entry window feeds prediction.
  let lastEntriesVid = useAppStore.getState().entriesVehicleId;
  storeStop = useAppStore.subscribe((s) => {
    if (s.entriesVehicleId !== lastEntriesVid) {
      lastEntriesVid = s.entriesVehicleId;
      syncOdoWatches();
    }
  });

  syncReminderWatches();
  requestRebuild();
}

/** Session teardown — drop every watch and listener, clear module state. */
export function stopReminders(): void {
  sessionUid = null;
  for (const stop of reminderStops.values()) stop();
  reminderStops = new Map();
  for (const stop of odoStops.values()) stop();
  odoStops = new Map();
  responseStop?.();
  responseStop = null;
  foregroundStop?.();
  foregroundStop = null;
  storeStop?.();
  storeStop = null;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = null;
  rebuildRunning = false;
  rebuildQueued = false;
  completing.clear();
}

/** REM-03: sign-out clears every scheduled + presented notification. */
export async function clearScheduledNotifications(): Promise<void> {
  try {
    await clientOrNull()?.clearAll();
  } catch {
    // best effort — sign-out must still proceed
  }
}

/**
 * Attach a reminders watch per non-archived member vehicle (RD-12: the phone
 * schedules for all of them); detach watches for vehicles that left the list.
 * Called from handleVehicleList on every vehicle snapshot.
 */
export function syncReminderWatches(): void {
  const st = useAppStore.getState();
  const live = new Set(st.vehicles.filter((v) => !v.archived).map((v) => v.id));
  for (const [vid, stop] of [...reminderStops]) {
    if (!live.has(vid)) {
      stop();
      reminderStops.delete(vid);
      dropReminderState(vid);
    }
  }
  for (const vid of live) {
    if (reminderStops.has(vid)) continue;
    reminderStops.set(
      vid,
      getRepos().reminders.watch(
        vid,
        (list) => {
          const s = useAppStore.getState();
          useAppStore.setState({
            reminders: { ...s.reminders, [vid]: list },
            remindersArrived: { ...s.remindersArrived, [vid]: true },
          });
          syncOdoWatches();
          scanForCompletions(vid);
          requestRebuild();
        },
        { onError: (e) => reportNonFatal(e, { stage: 'watch-reminders' }) },
      ),
    );
  }
  syncOdoWatches();
  requestRebuild();
}

function dropReminderState(vehicleId: string): void {
  const st = useAppStore.getState();
  const reminders = { ...st.reminders };
  delete reminders[vehicleId];
  const odoEntries = { ...st.odoEntries };
  delete odoEntries[vehicleId];
  useAppStore.setState({ reminders, odoEntries });
}

/**
 * The 90-day readings window per vehicle that has an odometer trigger —
 * prediction input for scheduling (RD-02). The selected vehicle is covered by
 * the main entries watch and gets no second watch.
 */
function syncOdoWatches(): void {
  const st = useAppStore.getState();
  const need = new Set<string>();
  for (const v of st.vehicles) {
    if (v.archived || v.id === st.entriesVehicleId) continue;
    if ((st.reminders[v.id] ?? []).some((r) => r.status === 'active' && r.odometerTrigger)) {
      need.add(v.id);
    }
  }
  for (const [vid, stop] of [...odoStops]) {
    if (!need.has(vid)) {
      stop();
      odoStops.delete(vid);
      const odoEntries = { ...useAppStore.getState().odoEntries };
      delete odoEntries[vid];
      useAppStore.setState({ odoEntries });
    }
  }
  const cutoff = tsFromMillis(Date.now() - 90 * DAY_MS);
  for (const vid of need) {
    if (odoStops.has(vid)) continue;
    odoStops.set(
      vid,
      getRepos().entries.watchSince(
        vid,
        cutoff,
        (entries) => {
          const s = useAppStore.getState();
          useAppStore.setState({ odoEntries: { ...s.odoEntries, [vid]: entries } });
          scanForCompletions(vid);
          requestRebuild();
        },
        { onError: (e) => reportNonFatal(e, { stage: 'watch-odo-entries' }) },
      ),
    );
  }
}

// --- entries snapshot hook (called by startEntriesWatch in entries.ts) -----------

/**
 * A fresh entries snapshot for the selected vehicle: scan it for reminder
 * completions (REM-06) and rebuild the schedule (an entry can move
 * lastOdometer or add a prediction reading — REM-03).
 */
export function onEntriesSnapshot(vehicleId: string): void {
  if (!sessionUid) return;
  scanForCompletions(vehicleId);
  requestRebuild();
}

/**
 * Every active reminder the entry matches completes (RD-04). The entry must
 * be dated on/after the reminder's creation and must not be the one that
 * completed the current cycle (completedByEntryId) — that guard plus the
 * in-flight set is what makes watch-driven scanning terminate.
 */
function scanForCompletions(vehicleId: string): void {
  const st = useAppStore.getState();
  const reminders = (st.reminders[vehicleId] ?? []).filter((r) => r.status === 'active');
  if (reminders.length === 0) return;
  const entries =
    vehicleId === st.entriesVehicleId ? st.entries : (st.odoEntries[vehicleId] ?? []);
  if (entries.length === 0) return;
  const vehicle = st.vehicles.find((v) => v.id === vehicleId);
  const byDate = [...entries].sort(
    (a, b) => tsToMillis(a.date) - tsToMillis(b.date) || tsToMillis(a.createdAt) - tsToMillis(b.createdAt),
  );
  for (const r of reminders) {
    if (completing.has(r.id)) continue;
    const entry = byDate.find(
      (e) => e.id !== r.completedByEntryId && entryCompletesReminder(e, r),
    );
    if (!entry) continue;
    completing.add(r.id);
    void completeFromEntry(vehicleId, r, entry, vehicle).finally(() => completing.delete(r.id));
  }
}

async function completeFromEntry(
  vehicleId: string,
  reminder: ReminderRecord,
  entry: EntryRecord,
  vehicle: VehicleRecord | undefined,
): Promise<void> {
  try {
    const roll = rollForward(reminder, {
      date: entry.date,
      odometer: entry.odometer,
      lastOdometer: vehicle?.lastOdometer ?? entry.odometer ?? 0,
      completedAt: adapter().now(),
      entryId: entry.id,
    });
    await getRepos().reminders.update(vehicleId, reminder.id, roll);
  } catch (e) {
    reportNonFatal(e, { stage: 'reminder-autocomplete', id: reminder.id });
  }
}

// --- scheduling (REM-03) ---------------------------------------------------------

/** Debounced rebuild — every trigger funnels through here. */
export function requestRebuild(): void {
  if (!sessionUid) return;
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    rebuildTimer = null;
    void runRebuild();
  }, 300);
}

async function runRebuild(): Promise<void> {
  if (rebuildRunning) {
    rebuildQueued = true;
    return;
  }
  rebuildRunning = true;
  try {
    await rebuildNotifications();
  } catch (e) {
    reportNonFatal(e, { stage: 'reminder-rebuild' });
  }
  rebuildRunning = false;
  if (rebuildQueued) {
    rebuildQueued = false;
    void runRebuild();
  }
}

/** Readings for one vehicle: the entries watch's full set for the selected
 *  vehicle, the 90-day window otherwise. The start odometer counts as a
 *  reading dated at vehicle creation (RD-02 — in-window only, the domain
 *  filter does that). */
function readingsFor(vehicle: VehicleRecord, st: ReturnType<typeof useAppStore.getState>): OdometerReading[] {
  const entries =
    vehicle.id === st.entriesVehicleId ? st.entries : (st.odoEntries[vehicle.id] ?? []);
  const readings = odometerReadings(entries);
  readings.push({ value: vehicle.startOdometer, date: vehicle.lastOdometerAt, createdAt: vehicle.createdAt });
  return readings;
}

/**
 * Rebuild the device's scheduled notification set from current state:
 * non-archived, non-muted vehicles; active, un-snoozed reminders; deduped
 * odometer "now" alerts; capped to the soonest 60 within 60 days (RD-12).
 * No-op on web (the client is a no-op) and with permission denied the
 * scheduled set is emptied (RD-08).
 */
export async function rebuildNotifications(): Promise<void> {
  const client = clientOrNull();
  if (!client || !sessionUid) return;
  let perm: NotificationPermissionState;
  try {
    perm = await client.getPermissionState();
  } catch {
    return;
  }
  if (useAppStore.getState().notifPermission !== perm) {
    useAppStore.setState({ notifPermission: perm });
  }
  if (perm !== 'granted') {
    await client.replaceSchedule([]);
    return;
  }

  const st = useAppStore.getState();
  const settings = st.userDoc?.settings ?? ({ ...USER_DEFAULTS } as SettingsDoc);
  const muted = new Set(settings.mutedReminderVehicleIds);
  const now = new Date();
  const items: ScheduledReminder[] = [];
  /** reminderId → dueOdometer for odoNow plans that survive the cap. */
  const plannedOdo = new Map<string, number>();

  for (const v of st.vehicles) {
    if (v.archived || muted.has(v.id)) continue;
    const readings = readingsFor(v, st);
    for (const r of st.reminders[v.id] ?? []) {
      const plans = planNotifications(r, {
        lastOdometer: v.lastOdometer,
        readings,
        snoozedUntilMs: st.snoozes[r.id],
      }, now);
      for (const p of plans) {
        if (p.kind === 'odoNow') {
          if (st.odoAlerted[r.id] === r.odometerTrigger?.dueOdometer) continue;
          plannedOdo.set(r.id, r.odometerTrigger!.dueOdometer);
        }
        items.push(toScheduled(v, r, p, settings));
      }
    }
  }

  const capped = capSchedule(items, now);
  await client.replaceSchedule(capped);

  // Dedupe persists only for the alerts that actually shipped.
  const shipped = new Set(capped.map((c) => c.data.reminderId));
  const alerted = { ...st.odoAlerted };
  let dirty = false;
  for (const [rid, due] of plannedOdo) {
    if (shipped.has(rid) && alerted[rid] !== due) {
      alerted[rid] = due;
      dirty = true;
    }
  }
  if (dirty) {
    useAppStore.setState({ odoAlerted: alerted });
    void localFlags.setJson(sessionUid, ODO_ALERTS_KEY, alerted).catch(() => undefined);
  }
}

/** RD-10 content: title is the reminder's; body is "<vehicle> — <due text>".
 *  Amounts and plates never appear. */
function toScheduled(
  vehicle: VehicleRecord,
  reminder: ReminderRecord,
  plan: PlannedNotification,
  settings: SettingsDoc,
): ScheduledReminder {
  const due = dueTextForPlan(vehicle, reminder, plan, settings);
  const expense = opensExpenseForm(reminder);
  return {
    id: `${reminder.id}:${plan.kind}`,
    title: reminder.title,
    body: `${vehicle.name} — ${due}`,
    at: plan.at,
    data: {
      kind: plan.kind,
      vehicleId: vehicle.id,
      reminderId: reminder.id,
      action: expense ? 'expense' : 'open',
      ...(expense ? { category: expenseCategoryFor(reminder), amountMinor: reminder.amountMinor } : {}),
    },
  };
}

function dueTextForPlan(
  vehicle: VehicleRecord,
  reminder: ReminderRecord,
  plan: PlannedNotification,
  settings: SettingsDoc,
): string {
  const unit = t(`units.${vehicle.odometerUnit}`);
  const dist = (n: number) => {
    const d = displayDistance(n, vehicle.odometerUnit, settings.distanceUnit);
    return `${d.converted ? d.value.toFixed(1) : formatNumber(d.value)} ${t(`units.${d.unit}`)}`;
  };
  switch (plan.kind) {
    case 'lead':
    case 'due':
      return t('reminders.dueOn', {
        date: formatDate(reminder.dateTrigger!.dueDate, settings.dateFormat),
      });
    case 'overdue':
      return t('reminders.overdueOn', {
        date: formatDate(reminder.dateTrigger!.dueDate, settings.dateFormat),
      });
    case 'odoSoon':
      return t('reminders.dueInDistance', { distance: dist(reminder.leadDistance), unit });
    case 'odoNow': {
      const remaining = reminder.odometerTrigger!.dueOdometer - vehicle.lastOdometer;
      return remaining > 0
        ? t('reminders.dueInDistance', { distance: dist(remaining), unit })
        : t('reminders.overdueNow');
    }
  }
}

/** Notification tap → registered navigator (root layout wires the router). */
export function registerReminderNavigator(fn: (data: ReminderNotificationData) => void): void {
  navigator = fn;
}

function routeNotification(data: ReminderNotificationData): void {
  try {
    navigator?.(data);
  } catch (e) {
    reportNonFatal(e, { stage: 'reminder-nav' });
  }
}

// --- permission (REM-08 / RD-08) --------------------------------------------------

/** Ask for notification permission once per user, on the first reminder
 *  save. Never at install; never re-asks (system settings only). */
async function maybeAskPermission(): Promise<void> {
  const uid = useAppStore.getState().user?.uid;
  const client = clientOrNull();
  if (!uid || !client || !client.promptsSupported) return;
  const asked = await localFlags.getBool(uid, PERM_ASKED_KEY).catch(() => false);
  if (asked) return;
  await localFlags.setBool(uid, PERM_ASKED_KEY, true).catch(() => undefined);
  const state = await client.requestPermission().catch(() => 'unsupported' as const);
  useAppStore.setState({ notifPermission: state });
  requestRebuild();
}

/** Whether the Reminders screen shows the "notifications are off" notice. */
export function showNotifNotice(): boolean {
  const st = useAppStore.getState();
  const client = clientOrNull();
  return (
    !!client?.promptsSupported &&
    st.notifPermission === 'denied' &&
    !st.notifNoticeOff
  );
}

/** Dismiss the denied-notice once per user (RD-08: one-time). */
export async function dismissNotifNotice(): Promise<void> {
  const uid = useAppStore.getState().user?.uid;
  useAppStore.setState({ notifNoticeOff: true });
  if (uid) await localFlags.setBool(uid, NOTICE_OFF_KEY, true).catch(() => undefined);
}

export function openNotifSettings(): void {
  clientOrNull()?.openSystemSettings();
}

// --- CRUD (REM-05) -----------------------------------------------------------------

function vehicleOrThrow(vehicleId: string): VehicleRecord {
  const v = useAppStore.getState().vehicles.find((x) => x.id === vehicleId);
  if (!v) throw new RepoError('not-found', vehicleId);
  if (v.archived) throw new RepoError('invalid-argument', 'archived vehicle');
  return v;
}

export async function createReminder(vehicleId: string, input: ReminderInput): Promise<string> {
  const vehicle = vehicleOrThrow(vehicleId);
  if (!canUseOdometerTrigger(vehicle.odometerUnit) && input.odometerTrigger) {
    throw new RepoError('invalid-argument', 'hours vehicle cannot carry an odometer trigger');
  }
  const count = (useAppStore.getState().reminders[vehicleId] ?? []).length;
  if (count >= MAX_REMINDERS_PER_VEHICLE) {
    throw new RepoError('invalid-argument', 'reminder-limit');
  }
  const id = await guardedWrite(getRepos().reminders.create(vehicleId, input));
  await maybeAskPermission();
  requestRebuild();
  return id;
}

export async function updateReminder(
  vehicleId: string,
  id: string,
  patch: ReminderPatch,
): Promise<void> {
  vehicleOrThrow(vehicleId);
  const cur = (useAppStore.getState().reminders[vehicleId] ?? []).find((r) => r.id === id);
  await guardedWrite(getRepos().reminders.update(vehicleId, id, patch));
  // RD-06: changing the due date or due odometer clears the snooze.
  if (cur && triggersChanged(cur, patch)) await clearSnooze(id);
  requestRebuild();
}

export async function deleteReminder(vehicleId: string, id: string): Promise<void> {
  vehicleOrThrow(vehicleId);
  await guardedWrite(getRepos().reminders.delete(vehicleId, id));
  await clearSnooze(id);
  const st = useAppStore.getState();
  if (st.odoAlerted[id] !== undefined) {
    const alerts = { ...st.odoAlerted };
    delete alerts[id];
    useAppStore.setState({ odoAlerted: alerts });
    if (sessionUid) void localFlags.setJson(sessionUid, ODO_ALERTS_KEY, alerts).catch(() => undefined);
  }
  requestRebuild();
}

const tsSame = (a: Timestamp, b: Timestamp) =>
  a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;

function triggersChanged(cur: ReminderRecord, patch: ReminderPatch): boolean {
  if ('dateTrigger' in patch && patch.dateTrigger !== undefined) {
    const n = patch.dateTrigger;
    if (n === null) {
      if (cur.dateTrigger) return true;
    } else if (
      !cur.dateTrigger ||
      !tsSame(n.dueDate, cur.dateTrigger.dueDate) ||
      n.repeatEveryMonths !== cur.dateTrigger.repeatEveryMonths
    ) return true;
  }
  if ('odometerTrigger' in patch && patch.odometerTrigger !== undefined) {
    const n = patch.odometerTrigger;
    if (n === null) {
      if (cur.odometerTrigger) return true;
    } else if (
      !cur.odometerTrigger ||
      n.dueOdometer !== cur.odometerTrigger.dueOdometer ||
      n.repeatEveryDistance !== cur.odometerTrigger.repeatEveryDistance
    ) return true;
  }
  return false;
}

// --- Mark done + snooze (REM-07) ----------------------------------------------------

/** Mark done: one-off becomes done; repeating rolls forward from today and
 *  lastOdometer (RD-05). Shared document — completes for every member. */
export async function markReminderDone(vehicleId: string, reminderId: string): Promise<void> {
  const vehicle = vehicleOrThrow(vehicleId);
  const r = (useAppStore.getState().reminders[vehicleId] ?? []).find((x) => x.id === reminderId);
  if (!r || r.status === 'done') return;
  const now = adapter().now();
  const roll = rollForward(r, {
    date: now,
    lastOdometer: vehicle.lastOdometer,
    completedAt: now,
  });
  await guardedWrite(getRepos().reminders.update(vehicleId, reminderId, roll));
  await clearSnooze(reminderId);
  requestRebuild();
}

/** Snooze until 9:00 local on the chosen day — device-local, per user (RD-06). */
export async function snoozeReminder(reminderId: string, choice: SnoozeChoice): Promise<void> {
  const until = snoozeEndMs(choice, new Date());
  const snoozes = { ...useAppStore.getState().snoozes, [reminderId]: until };
  useAppStore.setState({ snoozes });
  if (sessionUid) await localFlags.setJson(sessionUid, SNOOZES_KEY, snoozes).catch(() => undefined);
  requestRebuild();
}

export async function cancelSnooze(reminderId: string): Promise<void> {
  await clearSnooze(reminderId);
  requestRebuild();
}

async function clearSnooze(reminderId: string): Promise<void> {
  const st = useAppStore.getState();
  if (st.snoozes[reminderId] === undefined) return;
  const snoozes = { ...st.snoozes };
  delete snoozes[reminderId];
  useAppStore.setState({ snoozes });
  if (sessionUid) await localFlags.setJson(sessionUid, SNOOZES_KEY, snoozes).catch(() => undefined);
}

export function isReminderSnoozed(reminderId: string, now = new Date()): boolean {
  return isSnoozed(useAppStore.getState().snoozes[reminderId], now);
}

// --- mute (REM-09 / RD-07) ------------------------------------------------------------

export function isVehicleMuted(vehicleId: string): boolean {
  const list = useAppStore.getState().userDoc?.settings.mutedReminderVehicleIds;
  return !!list?.includes(vehicleId);
}

/**
 * Mute affects only this user's phone: the id lives in the user's own
 * `settings.mutedReminderVehicleIds`, local-first on Android (OQ-46, FR-SET-07).
 */
export async function setVehicleMuted(vehicleId: string, muted: boolean): Promise<void> {
  const st = useAppStore.getState();
  const uid = st.user?.uid;
  if (!uid) return;
  const cur = st.userDoc?.settings.mutedReminderVehicleIds ?? [];
  const next = muted ? [...new Set([...cur, vehicleId])] : cur.filter((id) => id !== vehicleId);
  await guardedWrite(getRepos().users.updateSettings(uid, { mutedReminderVehicleIds: next }));
  requestRebuild();
}

// --- view models (REM-04 / REM-10) ------------------------------------------------------

export interface ReminderRow {
  reminder: ReminderRecord;
  info: ReminderInfo;
  snoozedUntilMs?: number;
}

/** Readings for the *selected* vehicle's read model (all watched entries). */
function vehicleReadings(vehicleId: string): OdometerReading[] {
  const st = useAppStore.getState();
  const vehicle = st.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return [];
  return readingsFor(vehicle, st);
}

/** Reminders of a vehicle sorted per OQ-47, with per-row computed info. */
export function reminderRows(vehicleId: string, now = new Date()): ReminderRow[] {
  const st = useAppStore.getState();
  const vehicle = st.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return [];
  const readings = vehicleReadings(vehicleId);
  const rows = (st.reminders[vehicleId] ?? []).map((r) => ({
    reminder: r,
    info: reminderInfo(r, { lastOdometer: vehicle.lastOdometer, readings }, now),
    snoozedUntilMs: st.snoozes[r.id],
  }));
  return orderReminders(rows);
}

/** The Dashboard card's rows: active and not snoozed, capped at 3 (RD-11). */
export function dashboardRows(vehicleId: string, now = new Date()): ReminderRow[] {
  return reminderRows(vehicleId, now)
    .filter((r) => r.reminder.status === 'active' && !isSnoozed(r.snoozedUntilMs, now))
    .slice(0, 3);
}

/**
 * Row due text (RD-11): 'Due 12 Nov 2026', 'Due in 1,200 km',
 * 'Overdue by 3 days'; both triggers join with '·'.
 */
export function reminderDueText(
  row: ReminderRow,
  vehicle: VehicleRecord,
  settings: SettingsDoc,
  now = new Date(),
): string {
  const r = row.reminder;
  if (r.status === 'done') {
    return r.completedAt ? t('reminders.completedOn', { date: formatDate(r.completedAt, settings.dateFormat) }) : t('reminders.statusDone');
  }
  const parts: string[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (r.dateTrigger) {
    const dueMs = new Date(
      new Date(tsToMillis(r.dateTrigger.dueDate)).getFullYear(),
      new Date(tsToMillis(r.dateTrigger.dueDate)).getMonth(),
      new Date(tsToMillis(r.dateTrigger.dueDate)).getDate(),
    ).getTime();
    const days = Math.round((dueMs - today) / DAY_MS);
    if (days < 0) {
      parts.push(t('reminders.overdueDays', { count: -days }));
    } else if (days === 0) {
      parts.push(t('reminders.dueToday'));
    } else {
      parts.push(t('reminders.dueOn', { date: formatDate(r.dateTrigger.dueDate, settings.dateFormat) }));
    }
  }
  if (r.odometerTrigger) {
    const remaining = r.odometerTrigger.dueOdometer - vehicle.lastOdometer;
    const d = displayDistance(Math.abs(remaining), vehicle.odometerUnit, settings.distanceUnit);
    const dist = `${d.converted ? d.value.toFixed(1) : formatNumber(d.value)} ${t(`units.${d.unit}`)}`;
    if (remaining <= 0) parts.push(t('reminders.overdueDistance', { distance: dist }));
    else parts.push(t('reminders.dueInDistance', { distance: dist }));
  }
  return parts.join(' · ');
}

export function reminderStatusLabel(status: ReminderInfo['status']): string {
  return t(`reminders.status.${status}`);
}

export { isRepeating, reminderStatus };
export type { ReminderNotificationData };
