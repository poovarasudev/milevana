// REM-03..09, REM-11 — feature layer against the FakeAdapter and a fake
// NotificationClient: watches, CRUD, auto-complete + roll-forward, snooze,
// mute, schedule rebuild rules, permission ask, sign-out clear, tap routing.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  resetNotificationsForTests, setNotificationsFactory,
} from '../../data/notifications';
import type {
  NotificationClient, NotificationPermissionState, ReminderNotificationData,
  ScheduledReminder,
} from '../../data/notifications';
import type { ReminderInput } from '../../data/repos/reminderRepo';
import type { ReminderDoc } from '../../data/schema/reminder';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { initI18n } from '../../i18n';
import { resetAppStore, useAppStore } from '../appStore';
import { startEntriesWatch } from '../entries';
import {
  clearScheduledNotifications, createReminder, deleteReminder,
  dismissNotifNotice, isReminderSnoozed, isVehicleMuted, markReminderDone,
  rebuildNotifications, registerReminderNavigator, setVehicleMuted,
  showNotifNotice, snoozeReminder, startReminders, stopReminders,
  syncReminderWatches, updateReminder,
} from '../reminders';
import { resetRuntimeForTests } from '../runtime';
import { FakeAdapter } from './fakeAdapter';

const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });
const DAY = 86_400_000;
const nowS = () => Math.floor(Date.now() / 1000);
const inDays = (d: number) => ts(nowS() + d * 86400);

const vehicleDoc = (over: Record<string, unknown> = {}) => ({
  name: 'City Runner', type: 'car', fuelTypes: ['petrol'], odometerUnit: 'km',
  currency: 'INR', color: 'c01', startOdometer: 0,
  lastOdometer: 10_000, lastOdometerAt: ts(1), archived: false,
  ownerId: 'u-me', memberIds: ['u-me'],
  members: { 'u-me': { role: 'owner', joinedAt: ts(1) } },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
});

const userDoc = (muted: string[] = []) => ({
  isLinked: false,
  settings: {
    currency: 'INR', distanceUnit: 'km', volumeUnit: 'litres',
    efficiencyFormat: 'km_per_l', dateFormat: 'DD/MM/YYYY', theme: 'system',
    locale: 'en', backupFrequency: 'weekly', mutedReminderVehicleIds: muted,
  },
  schemaVersion: 1, createdAt: ts(1),
});

/** A full stored doc, for seeding the fake store before watchers attach. */
const reminderDoc = (over: Record<string, unknown> = {}): ReminderDoc => ({
  title: 'Insurance', subject: { kind: 'expense', category: 'Insurance' },
  dateTrigger: { dueDate: inDays(10) },
  leadDays: 7, leadDistance: 500, status: 'active',
  createdBy: 'u-me', schemaVersion: 1, createdAt: ts(1), updatedAt: ts(1),
  ...over,
} as ReminderDoc);

/** A create/update payload (no server-owned fields). */
const reminderInput = (over: Record<string, unknown> = {}): ReminderInput => ({
  title: 'Insurance', subject: { kind: 'expense', category: 'Insurance' },
  dateTrigger: { dueDate: inDays(10) },
  leadDays: 7, leadDistance: 500, status: 'active',
  ...over,
} as ReminderInput);

const entryDoc = (over: Record<string, unknown> = {}) => ({
  type: 'expense', date: ts(nowS()), amount: { minor: 5000, currency: 'INR' },
  category: 'Insurance', attachments: [], uploaderUids: [],
  createdBy: 'u-me', createdByName: 'Me', updatedBy: 'u-me',
  schemaVersion: 1, createdAt: ts(nowS()), updatedAt: ts(nowS()),
  ...over,
});

/** Valid service entry: amount must equal the line cost sum (LD-03). */
const serviceEntry = (lines: { serviceType: string; costMinor: number }[], over: Record<string, unknown> = {}) => ({
  type: 'service', date: ts(nowS()), category: 'workshop',
  details: { lines: lines.map((l, i) => ({ id: `l${i}`, ...l })) },
  amount: { minor: lines.reduce((s, l) => s + l.costMinor, 0), currency: 'INR' },
  attachments: [], uploaderUids: [],
  createdBy: 'u-me', createdByName: 'Me', updatedBy: 'u-me',
  schemaVersion: 1, createdAt: ts(nowS()), updatedAt: ts(nowS()),
  ...over,
});

class FakeNotifs implements NotificationClient {
  promptsSupported = true;
  perm: NotificationPermissionState = 'granted';
  scheduled: ScheduledReminder[] = [];
  asked = 0;
  cleared = 0;
  settingsOpened = 0;
  initial: ReminderNotificationData | null = null;
  private cbs: ((d: ReminderNotificationData) => void)[] = [];

  async getPermissionState() { return this.perm; }
  async requestPermission() { this.asked++; return this.perm; }
  async replaceSchedule(items: ScheduledReminder[]) { this.scheduled = items; }
  async clearAll() { this.cleared++; this.scheduled = []; }
  onResponse(cb: (d: ReminderNotificationData) => void) {
    this.cbs.push(cb);
    return () => { this.cbs = this.cbs.filter((c) => c !== cb); };
  }
  emitResponse(d: ReminderNotificationData) { this.cbs.forEach((c) => c(d)); }
  async consumeInitialResponse() { const d = this.initial; this.initial = null; return d; }
  openSystemSettings() { this.settingsOpened++; }
}

let adapter: FakeAdapter;
let notifs: FakeNotifs;
let stops: (() => void)[] = [];

const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) await new Promise<void>((r) => setTimeout(r, 0));
};

/** Boot the reminders session machinery with v1 as the selected vehicle. */
async function boot(vehicleOver: Record<string, unknown> = {}) {
  adapter.docs.set('vehicles/v1', vehicleDoc(vehicleOver));
  useAppStore.setState({
    user: { uid: 'u-me', isAnonymous: true, displayName: null, email: null },
    vehicles: [{ ...vehicleDoc(vehicleOver), id: 'v1' } as never],
    vehiclesLoaded: true,
    selectedVehicleId: 'v1',
    entriesVehicleId: 'v1',
  });
  startReminders();
  await flush();
}

const watchEntries = () => stops.push(startEntriesWatch('v1'));

const reminderAt = async (id: string) =>
  adapter.docs.get(`vehicles/v1/reminders/${id}`) as unknown as ReminderDoc | undefined;

beforeAll(() => initI18n('en'));

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
  resetNotificationsForTests();
  adapter = new FakeAdapter('native');
  setFirebaseFactory(() => adapter);
  notifs = new FakeNotifs();
  setNotificationsFactory(() => notifs);
  resetRuntimeForTests();
  adapter.user = { uid: 'u-me', isAnonymous: true, displayName: null, email: null };
  stops = [];
});

afterEach(() => {
  stops.forEach((s) => s());
  stopReminders();
});

// --- watches + scheduling (REM-03) ---------------------------------------------

describe('watches + scheduling (REM-03)', () => {
  test('startReminders attaches a reminders watch per non-archived vehicle and fills the read model', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    expect(useAppStore.getState().reminders.v1?.[0]?.title).toBe('Insurance');
    expect(useAppStore.getState().remindersArrived.v1).toBe(true);
  });

  test('a rebuild schedules lead + due + one overdue at 9:00 local', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(3);
    expect(notifs.scheduled.map((s) => s.data.kind).sort())
      .toEqual(['due', 'lead', 'overdue']);
    for (const s of notifs.scheduled) {
      const at = new Date(s.at);
      expect(at.getHours()).toBe(9);
      expect(at.getMinutes()).toBe(0);
    }
    // RD-10: reminder title + vehicle name + due text — never amount or plate.
    const lead = notifs.scheduled.find((s) => s.data.kind === 'lead')!;
    expect(lead.title).toBe('Insurance');
    expect(lead.body).toContain('City Runner');
    expect(lead.body).not.toContain('₹');
    expect(lead.data).toMatchObject({ action: 'open', vehicleId: 'v1', reminderId: 'r1' });
  });

  test('an amount reminder schedules with action expense + prefill data (REM-11)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({
      title: 'Car loan', amountMinor: 1_200_000,
      subject: { kind: 'expense', category: 'Loan EMI' },
      dateTrigger: { dueDate: inDays(10), repeatEveryMonths: 1 },
    }));
    await boot();
    await rebuildNotifications();
    const due = notifs.scheduled.find((s) => s.data.kind === 'due')!;
    expect(due.data.action).toBe('expense');
    expect(due.data.category).toBe('Loan EMI');
    expect(due.data.amountMinor).toBe(1_200_000);
    // the visible text still carries no amount (RD-10)
    expect(due.body).not.toContain('12000');
  });

  test('permission denied → nothing is scheduled but reminders still load', async () => {
    notifs.perm = 'denied';
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(0);
    expect(useAppStore.getState().reminders.v1).toHaveLength(1);
    expect(useAppStore.getState().notifPermission).toBe('denied');
  });

  test('archived vehicles are never watched or scheduled', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot({ archived: true });
    syncReminderWatches();
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(0);
    expect(useAppStore.getState().reminders.v1).toBeUndefined();
  });

  test('the schedule is capped at the soonest 60 within 60 days', async () => {
    for (let i = 0; i < 40; i++) {
      adapter.docs.set(`vehicles/v1/reminders/r${i}`, reminderDoc({ title: `R${i}` }));
    }
    await boot();
    await rebuildNotifications();
    expect(notifs.scheduled.length).toBeLessThanOrEqual(60);
    const horizon = Date.now() + 60 * DAY;
    expect(notifs.scheduled.every((s) => s.at <= horizon)).toBe(true);
  });

  test('an odometer "now" alert fires once per due value (dedupe)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', {
      ...reminderDoc(), dateTrigger: undefined,
      title: 'Oil', subject: { kind: 'service', serviceType: 'engine_oil' },
      odometerTrigger: { dueOdometer: 10_400 }, // 10,000 >= 10,400 − 500 → in lead
    });
    await boot();
    await rebuildNotifications();
    expect(notifs.scheduled.map((s) => s.data.kind)).toEqual(['odoNow']);
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(0); // deduped — not scheduled again
  });

  test('sign-out clears every scheduled notification (FR-OUT-05)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await rebuildNotifications();
    expect(notifs.scheduled.length).toBeGreaterThan(0);
    await clearScheduledNotifications();
    expect(notifs.cleared).toBe(1);
    expect(notifs.scheduled).toHaveLength(0);
  });

  test('notification taps route through the registered navigator', async () => {
    await boot();
    const seen: ReminderNotificationData[] = [];
    registerReminderNavigator((d) => seen.push(d));
    notifs.emitResponse({ kind: 'due', vehicleId: 'v1', reminderId: 'r1', action: 'open' });
    expect(seen).toEqual([{ kind: 'due', vehicleId: 'v1', reminderId: 'r1', action: 'open' }]);
  });
});

// --- CRUD + permission ask (REM-05 / REM-08) --------------------------------------

describe('CRUD + permission ask (REM-05/08)', () => {
  test('createReminder writes a valid doc and asks permission exactly once', async () => {
    await boot();
    const id = await createReminder('v1', reminderInput({ title: 'PUC' }));
    expect(id).toBeTruthy();
    expect(await reminderAt(id)).toMatchObject({
      title: 'PUC', status: 'active', createdBy: 'u-me',
    });
    expect(notifs.asked).toBe(1);
    await createReminder('v1', reminderInput({ title: 'Second' }));
    expect(notifs.asked).toBe(1); // once per user, never again (RD-08)
  });

  test('no prompt and no notice where prompts are unsupported (Android ≤12)', async () => {
    notifs.promptsSupported = false;
    await boot();
    await createReminder('v1', reminderInput());
    expect(notifs.asked).toBe(0);
    useAppStore.setState({ notifPermission: 'denied' });
    expect(showNotifNotice()).toBe(false); // RD-08: no notice on older Android
  });

  test('denied permission → one-time dismissible notice (RD-08)', async () => {
    notifs.perm = 'denied';
    await boot();
    await createReminder('v1', reminderInput());
    await flush();
    expect(showNotifNotice()).toBe(true);
    await dismissNotifNotice();
    expect(showNotifNotice()).toBe(false);
  });

  test('an odometer trigger on an hours vehicle is rejected', async () => {
    await boot({ odometerUnit: 'hours' });
    await expect(createReminder('v1', {
      ...reminderInput(), dateTrigger: undefined,
      odometerTrigger: { dueOdometer: 100 },
    } as ReminderInput)).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('the 51st reminder is rejected (RD-09)', async () => {
    for (let i = 0; i < 50; i++) {
      adapter.docs.set(`vehicles/v1/reminders/r${i}`, reminderDoc({ title: `R${i}` }));
    }
    await boot();
    await expect(createReminder('v1', reminderInput()))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('an archived vehicle cannot create/update/delete', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot({ archived: true });
    useAppStore.setState({
      reminders: { v1: [{ ...reminderDoc(), id: 'r1', pending: false }] },
    });
    await expect(createReminder('v1', reminderInput()))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(updateReminder('v1', 'r1', { title: 'x' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(deleteReminder('v1', 'r1'))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('update preserves createdBy and clears the snooze when triggers change (RD-06)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({ createdBy: 'u-other' }));
    await boot();
    await snoozeReminder('r1', 'nextWeek');
    expect(isReminderSnoozed('r1')).toBe(true);
    const due = inDays(30);
    await updateReminder('v1', 'r1', { dateTrigger: { dueDate: due } });
    const doc = await reminderAt('r1');
    expect(doc?.createdBy).toBe('u-other');
    expect(doc?.dateTrigger?.dueDate.seconds).toBe(due.seconds);
    expect(isReminderSnoozed('r1')).toBe(false);
  });

  test('a title-only update keeps the snooze', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await snoozeReminder('r1', 'nextWeek');
    await updateReminder('v1', 'r1', { title: 'Renamed' });
    expect(isReminderSnoozed('r1')).toBe(true);
  });
});

// --- auto-complete + roll-forward (REM-06) ----------------------------------------

describe('auto-complete (REM-06)', () => {
  test('a matching expense completes a one-off reminder', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    watchEntries();
    adapter.setDoc('vehicles/v1/entries/e1', entryDoc({ category: 'Insurance' }));
    await flush();
    const doc = await reminderAt('r1');
    expect(doc?.status).toBe('done');
    expect(doc?.completedByEntryId).toBe('e1');
    expect(doc?.completedAt).toBeDefined();
  });

  test('a service line completes its reminder; the entry category alone does not', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({
      subject: { kind: 'service', serviceType: 'engine_oil' },
    }));
    await boot();
    watchEntries();
    adapter.setDoc('vehicles/v1/entries/e0', serviceEntry(
      [{ serviceType: 'tyres', costMinor: 100 }], { category: 'engine_oil' },
    ));
    await flush();
    expect((await reminderAt('r1'))?.status).toBe('active');
    adapter.setDoc('vehicles/v1/entries/e1', serviceEntry(
      [{ serviceType: 'engine_oil', costMinor: 500 }],
    ));
    await flush();
    expect((await reminderAt('r1'))?.status).toBe('done');
  });

  test('an entry dated before the reminder was created does not complete it (RD-04)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({ createdAt: ts(nowS()) }));
    adapter.docs.set('vehicles/v1/entries/e-old', entryDoc({
      category: 'Insurance', date: ts(nowS() - 5 * 86400),
    }));
    await boot();
    watchEntries();
    await flush();
    expect((await reminderAt('r1'))?.status).toBe('active');
  });

  test('a custom reminder never auto-completes', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({ subject: { kind: 'custom' } }));
    await boot();
    watchEntries();
    adapter.setDoc('vehicles/v1/entries/e1', entryDoc({ category: 'Insurance' }));
    await flush();
    expect((await reminderAt('r1'))?.status).toBe('active');
  });

  test('a repeating reminder rolls both triggers forward from the entry', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({
      subject: { kind: 'service', serviceType: 'general_service' },
      dateTrigger: { dueDate: inDays(5), repeatEveryMonths: 12 },
      odometerTrigger: { dueOdometer: 15_000, repeatEveryDistance: 10_000 },
    }));
    await boot();
    watchEntries();
    const entryDate = ts(nowS());
    adapter.setDoc('vehicles/v1/entries/e1', serviceEntry(
      [{ serviceType: 'general_service', costMinor: 900 }],
      { odometer: 52_000, date: entryDate },
    ));
    await flush();
    const doc = await reminderAt('r1');
    expect(doc?.status).toBe('active');
    expect(doc?.completedByEntryId).toBe('e1');
    expect(doc?.odometerTrigger?.dueOdometer).toBe(62_000); // 52,000 + 10,000
    const rolled = new Date(doc!.dateTrigger!.dueDate.seconds * 1000);
    const expected = new Date(entryDate.seconds * 1000);
    expected.setFullYear(expected.getFullYear() + 1);
    expect(rolled.getFullYear()).toBe(expected.getFullYear());
    expect(rolled.getMonth()).toBe(expected.getMonth());
  });
});

// --- mark done + snooze (REM-07) ---------------------------------------------------

describe('mark done + snooze (REM-07)', () => {
  test('mark done completes a one-off for every member (shared doc)', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await markReminderDone('v1', 'r1');
    const doc = await reminderAt('r1');
    expect(doc?.status).toBe('done');
    expect(doc?.completedByEntryId).toBeUndefined();
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(0);
  });

  test('mark done on a repeating reminder rolls from today + lastOdometer', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc({
      dateTrigger: { dueDate: inDays(3), repeatEveryMonths: 1 },
      odometerTrigger: { dueOdometer: 12_000, repeatEveryDistance: 5_000 },
    }));
    await boot();
    await markReminderDone('v1', 'r1');
    const doc = await reminderAt('r1');
    expect(doc?.status).toBe('active');
    expect(doc?.odometerTrigger?.dueOdometer).toBe(15_000); // 10,000 + 5,000
    const expected = new Date(); expected.setMonth(expected.getMonth() + 1);
    expect(new Date(doc!.dateTrigger!.dueDate.seconds * 1000).getMonth())
      .toBe(expected.getMonth());
  });

  test('snooze persists per user on the device and ends at 9:00', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    await boot();
    await snoozeReminder('r1', 'threeDays');
    const until = useAppStore.getState().snoozes.r1;
    const end = new Date(until);
    expect(end.getHours()).toBe(9);
    expect(until).toBeGreaterThan(Date.now() + 2 * DAY);
    expect(until).toBeLessThanOrEqual(Date.now() + 4 * DAY);
    // a fresh session restores it from local flags
    stopReminders();
    useAppStore.setState({ snoozes: {} });
    startReminders();
    await flush();
    expect(useAppStore.getState().snoozes.r1).toBe(until);
  });
});

// --- per-vehicle mute (REM-09) -----------------------------------------------------

describe('per-vehicle mute (REM-09)', () => {
  const setUserDoc = (muted: string[] = []) => {
    adapter.docs.set('users/u-me', userDoc(muted));
    useAppStore.setState({ userDoc: userDoc(muted) as never });
  };

  test('mute writes settings.mutedReminderVehicleIds and drops the vehicle from the schedule', async () => {
    adapter.docs.set('vehicles/v1/reminders/r1', reminderDoc());
    setUserDoc();
    await boot();
    await setVehicleMuted('v1', true);
    expect(
      (adapter.docs.get('users/u-me') as ReturnType<typeof userDoc>).settings
        .mutedReminderVehicleIds,
    ).toEqual(['v1']);
    // simulate the user-doc watch delivering the write
    setUserDoc(['v1']);
    expect(isVehicleMuted('v1')).toBe(true);
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(0);
    await setVehicleMuted('v1', false);
    setUserDoc([]);
    expect(isVehicleMuted('v1')).toBe(false);
    await rebuildNotifications();
    expect(notifs.scheduled).toHaveLength(3);
  });
});
