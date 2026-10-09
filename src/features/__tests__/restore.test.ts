// DRV-09/10 (SC-DRV09-02, SC-DRV10-01/02/04/05): review compares a backup
// against owned vehicles by id (missing / differs / same / not-yours);
// execution writes whole docs in ≤500-op batches with the vehicle first,
// keep-current leaves current docs untouched, replace overwrites only what
// the backup holds, cancel stops after the current batch, and lastOdometer is
// recomputed afterwards.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setFirebaseFactory } from '../../data/firebase';
import { resetDriveForTests, setDriveFactory } from '../../data/drive/client';
import {
  BACKUP_FORMAT_VERSION, docToJson,
  type BackupDocument, type BackupVehicleJson,
} from '../../data/drive/backupFile';
import type { VehicleDoc } from '../../data/schema/vehicle';
import type { EntryDoc } from '../../data/schema/entry';
import { resetRuntimeForTests, getRepos } from '../runtime';
import { resetAppStore } from '../appStore';
import { planRestore, reviewBackup, runRestore } from '../restore';
import { localFlags } from '../../data/localFlags';
import { FakeAdapter } from './fakeAdapter';
import { FakeDriveClient } from './fakeDrive';

const uid = 'u-owner';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

let adapter: FakeAdapter;
let client: FakeDriveClient;

beforeEach(async () => {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetDriveForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Owner', email: 'o@x.com' };
  setFirebaseFactory(() => adapter);
  client = new FakeDriveClient();
  setDriveFactory(() => client);
  await getRepos().users.ensureUser(uid, { isLinked: true });
  await localFlags.setBool(uid, 'driveGranted', true);
});

const vehicleDoc = (over: Record<string, unknown> = {}): VehicleDoc => ({
  name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', startOdometer: 100,
  lastOdometer: 1200, lastOdometerAt: ts(50), archived: false,
  ownerId: uid, memberIds: [uid],
  members: { [uid]: { role: 'owner', name: 'Owner', joinedAt: ts(1) } },
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(9),
  ...over,
} as VehicleDoc);

const entryDoc = (over: Record<string, unknown> = {}): EntryDoc => ({
  type: 'expense', date: ts(100), odometer: 1200,
  amount: { minor: 5000, currency: 'INR' }, category: 'cleaning',
  attachments: [], uploaderUids: [uid],
  createdBy: uid, createdByName: 'Owner', updatedBy: uid,
  schemaVersion: 1, createdAt: ts(1), updatedAt: ts(3),
  ...over,
} as EntryDoc);

function backupVehicle(id: string, doc: VehicleDoc, entries: ({ id: string } & EntryDoc)[]): BackupVehicleJson {
  const { members, ...rest } = doc;
  return {
    id,
    doc: docToJson(rest as Record<string, unknown>),
    members: Object.entries(members).map(([muid, m]) => ({ uid: muid, ...(m.name ? { name: m.name } : {}), role: m.role })),
    entries: entries.map(({ id: eid, ...e }) => ({ id: eid, doc: docToJson(e as Record<string, unknown>) })),
    reminders: [],
    checklistTemplates: [],
  };
}

function plantBackup(vehicles: BackupVehicleJson[]): string {
  const doc: BackupDocument = {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date(2024, 0, 1).toISOString(),
    kind: 'manual',
    app: { name: 'Milevana', version: '1.0.0' },
    vehicles,
  };
  return client.plant('milevana-backup-2024-01-01-0000.json', 'backups', { text: JSON.stringify(doc) }).id;
}

describe('reviewBackup (DRV-09)', () => {
  it('marks missing, same, differs and not-yours vehicles', async () => {
    // same: an owned vehicle whose backup copy is identical
    const vid = await getRepos().vehicles.create({
      name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 100,
    });
    const curDoc = (await getRepos().vehicles.get(vid))!;
    // differs: same id in repo and backup, changed field in the backup copy
    adapter.setDoc('vehicles/v-diff', vehicleDoc({ name: 'Swift' }));
    const differsDoc = { ...vehicleDoc({}), name: 'Swift Sport' } as VehicleDoc;
    const fileId = plantBackup([
      backupVehicle(vid, curDoc, []),
      backupVehicle('v-missing', vehicleDoc({ name: 'Old Car' }), [entryDoc({})].map((e) => ({ id: 'e1', ...e }))),
      backupVehicle('v-diff', differsDoc, []),
      backupVehicle('v-theirs', vehicleDoc({ name: 'Theirs', ownerId: 'other', memberIds: ['other'], members: { other: { role: 'owner', joinedAt: ts(1) } } }), []),
    ]);
    const review = await reviewBackup(uid, fileId);
    const by = Object.fromEntries(review.vehicles.map((v) => [v.vehicleId, v.status]));
    expect(by[vid]).toBe('same');
    expect(by['v-missing']).toBe('missing');
    expect(by['v-diff']).toBe('differs');
    expect(by['v-theirs']).toBe('not-yours');
    expect(review.settingsAvailable).toBe(false);
  });

  it('marks differs when a child set or updatedAt differs (ED-05)', async () => {
    const vid = await getRepos().vehicles.create({
      name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 100,
    });
    const curDoc = (await getRepos().vehicles.get(vid))!;
    // Backup has an entry the current vehicle lacks → differs.
    const fileId = plantBackup([
      backupVehicle(vid, curDoc, [{ id: 'e-new', ...entryDoc({}) }]),
    ]);
    const review = await reviewBackup(uid, fileId);
    expect(review.vehicles[0].status).toBe('differs');
  });
});

describe('planRestore + runRestore (DRV-10)', () => {
  it('restores a missing vehicle with its entries and recomputes lastOdometer', async () => {
    const doc = vehicleDoc({ name: 'Old Car', lastOdometer: 9999 }); // stale in backup
    const fileId = plantBackup([
      backupVehicle('v-old', doc, [
        { id: 'e1', ...entryDoc({ odometer: 1200 }) },
        { id: 'e2', ...entryDoc({ odometer: 1500, date: ts(200) }) },
      ]),
    ]);
    const review = await reviewBackup(uid, fileId);
    const plan = await planRestore(uid, review, { replaceVehicleIds: [], restoreSettings: false });
    // vehicle op precedes its children
    expect(plan.ops[0].path).toBe('vehicles/v-old');
    expect(plan.touchedVehicles).toEqual(['v-old']);
    const res = await runRestore(uid, plan);
    expect(res.cancelled).toBe(false);
    const v = await getRepos().vehicles.get('v-old');
    expect(v!.name).toBe('Old Car');
    expect(v!.lastOdometer).toBe(1500); // recomputed, not the backup's 9999
    const entries = await getRepos().entries.list('v-old');
    expect(entries).toHaveLength(2);
    // New docs are authored by the caller; createdByName stays from the backup.
    expect(entries[0].createdBy).toBe(uid);
    expect(entries[0].createdByName).toBe('Owner');
  });

  it('keep-current leaves docs untouched; replace overwrites backup fields only (SC-DRV10-02)', async () => {
    const vid = await getRepos().vehicles.create({
      name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
      odometerUnit: 'km', currency: 'INR', startOdometer: 100,
    });
    const curDoc = (await getRepos().vehicles.get(vid))!;
    const fileId = plantBackup([
      backupVehicle(vid, { ...curDoc, name: 'Swift Sport' } as VehicleDoc, [{ id: 'e-miss', ...entryDoc({}) }]),
    ]);
    const review = await reviewBackup(uid, fileId);
    expect(review.vehicles[0].status).toBe('differs');

    // keep current → nothing written for the vehicle
    const keepPlan = await planRestore(uid, review, { replaceVehicleIds: [], restoreSettings: false });
    expect(keepPlan.ops).toHaveLength(0);
    expect(keepPlan.skippedKept).toBe(1);
    await runRestore(uid, keepPlan);
    expect((await getRepos().vehicles.get(vid))!.name).toBe('Swift');

    // replace → vehicle fields overwritten, missing child restored
    const repPlan = await planRestore(uid, review, { replaceVehicleIds: [vid], restoreSettings: false });
    await runRestore(uid, repPlan);
    expect((await getRepos().vehicles.get(vid))!.name).toBe('Swift Sport');
    expect(await getRepos().entries.get(vid, 'e-miss')).toBeTruthy();
  });

  it('skips not-yours vehicles entirely (SC-DRV10-05)', async () => {
    const fileId = plantBackup([
      backupVehicle('v-theirs', vehicleDoc({ name: 'Theirs', ownerId: 'other', memberIds: ['other'], members: { other: { role: 'owner', joinedAt: ts(1) } } }), []),
    ]);
    const review = await reviewBackup(uid, fileId);
    const plan = await planRestore(uid, review, { replaceVehicleIds: ['v-theirs'], restoreSettings: false });
    expect(plan.ops).toHaveLength(0);
    expect(plan.skippedNotYours).toBe(1);
  });

  it('batches at ≤500 ops, vehicle first, and cancel stops between batches', async () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ id: `e${i}`, ...entryDoc({ odometer: 100 + i }) }));
    const fileId = plantBackup([backupVehicle('v-big', vehicleDoc({ name: 'Big' }), many)]);
    const review = await reviewBackup(uid, fileId);
    const plan = await planRestore(uid, review, { replaceVehicleIds: [], restoreSettings: false });
    expect(plan.ops).toHaveLength(502); // 1 vehicle + 501 entries
    expect(plan.ops[0].path).toBe('vehicles/v-big');

    // cancel after the first batch (500 ops)
    let calls = 0;
    const res = await runRestore(uid, plan, { isCancelled: () => ++calls > 1 });
    expect(res.cancelled).toBe(true);
    expect(res.opsDone).toBe(500);

    // re-running is idempotent (ED-06)
    const res2 = await runRestore(uid, plan);
    expect(res2.cancelled).toBe(false);
    expect((await getRepos().entries.list('v-big'))).toHaveLength(501);
  });

  it('restores settings only when chosen', async () => {
    const fileId = plantBackup([]);
    // craft a backup with settings
    const raw = JSON.parse(client.files.get(fileId)!.text!);
    raw.settings = { ...raw.settings, currency: 'USD', theme: 'dark' };
    const doc: BackupDocument = {
      formatVersion: 1, createdAt: raw.createdAt, kind: 'manual',
      app: raw.app, settings: raw.settings, vehicles: [],
    };
    const fid2 = client.plant('b2.json', 'backups', { text: JSON.stringify(doc) }).id;
    const review = await reviewBackup(uid, fid2);
    expect(review.settingsAvailable).toBe(true);
    const plan = await planRestore(uid, review, { replaceVehicleIds: [], restoreSettings: true });
    const res = await runRestore(uid, plan);
    expect(res.settingsRestored).toBe(true);
    expect((await getRepos().users.getUser(uid))!.settings.currency).toBe('USD');
  });
});
