// DRV-07/08 (SC-DRV08-01..03): manual backup uploads to Milevana/Backups with
// kind=manual and records lastBackupAt/lastBackupFileId; automatic backups
// run only when stale on native for a linked+granted account; retention keeps
// the newest 10 automatic files; failures set the "Last backup failed" flag
// and failed deletes land in the pending queue.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setFirebaseFactory } from '../../data/firebase';
import { DriveError, resetDriveForTests, setDriveFactory } from '../../data/drive/client';
import { resetRuntimeForTests, getRepos } from '../runtime';
import { resetAppStore } from '../appStore';
import { isDriveGranted } from '../driveAccess';
import {
  backupFailedFlag, deleteBackup, listBackups, listManualBackups,
  maybeRunAutomaticBackup, runBackup, RETAIN_AUTOMATIC_BACKUPS,
} from '../backup';
import { pendingDriveDeletes } from '../driveDeletes';
import { ensureDriveLayout } from '../../data/drive/folders';
import { localFlags } from '../../data/localFlags';
import { FakeAdapter } from './fakeAdapter';
import { FakeDriveClient } from './fakeDrive';

const uid = 'u-owner';
let adapter: FakeAdapter;
let client: FakeDriveClient;

async function seed(linked = true) {
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetDriveForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: !linked, displayName: 'Owner', email: 'o@x.com' };
  setFirebaseFactory(() => adapter);
  client = new FakeDriveClient();
  setDriveFactory(() => client);
  await getRepos().users.ensureUser(uid, { isLinked: linked });
  await localFlags.setBool(uid, 'driveGranted', true);
}

async function addVehicle() {
  return getRepos().vehicles.create({
    name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 100,
  });
}

describe('runBackup (DRV-07)', () => {
  it('uploads milevana-backup-*.json into Backups and records lastBackupAt', async () => {
    await seed();
    await addVehicle();
    const meta = await runBackup(uid, 'manual');
    expect(meta.name).toMatch(/^milevana-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json$/);
    expect(meta.properties?.kind).toBe('manual');
    const d = (await getRepos().users.getUser(uid))!.drive!;
    expect(meta.parents).toEqual([d.backupsFolderId]);
    expect(d.lastBackupFileId).toBe(meta.id);
    expect(d.lastBackupAt).toBeDefined();
    expect(await backupFailedFlag(uid)).toBe(false);
    // The file content parses back as a backup.
    const doc = JSON.parse([...client.files.values()].find((f) => f.id === meta.id)!.text!);
    expect(doc.formatVersion).toBe(1);
    expect(doc.vehicles[0].doc.name).toBe('Swift');
  });

  it('sets the failed flag on upload errors and clears on success', async () => {
    await seed();
    client.failNext.upload = new DriveError('network');
    await expect(runBackup(uid, 'manual')).rejects.toMatchObject({ code: 'network' });
    expect(await backupFailedFlag(uid)).toBe(true);
    await runBackup(uid, 'manual');
    expect(await backupFailedFlag(uid)).toBe(false);
  });
});

describe('list/delete backups', () => {
  it('lists manual backups only in "Your backups" and deletes them (ED-13)', async () => {
    await seed();
    const a = await runBackup(uid, 'manual');
    const all = await listBackups(uid);
    const manual = await listManualBackups(uid);
    expect(all.map((b) => b.fileId)).toContain(a.id);
    expect(manual.map((b) => b.fileId)).toEqual([a.id]);
    await deleteBackup(uid, a.id);
    expect(client.files.has(a.id)).toBe(false);
    const d = (await getRepos().users.getUser(uid))!.drive!;
    expect(d.lastBackupFileId).toBeUndefined();
  });
});

describe('maybeRunAutomaticBackup (DRV-08)', () => {
  it('skips when anonymous, off, ungranted or on web (SC-DRV08-02)', async () => {
    await seed(false); // anonymous user doc + anon auth user
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-anonymous');

    await seed();
    await getRepos().users.updateSettings(uid, { backupFrequency: 'off' });
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-off');

    await seed();
    await localFlags.setBool(uid, 'driveGranted', false);
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-no-grant');
    expect(await isDriveGranted(uid)).toBe(false);

    await seed();
    (adapter as { platform: 'native' | 'web' }).platform = 'web';
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-web');
  });

  it('runs when stale and skips when fresh (SC-DRV08-01)', async () => {
    await seed();
    expect(await maybeRunAutomaticBackup(uid)).toBe('ran'); // never backed up
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-fresh');
    const meta = (await listBackups(uid))[0];
    expect(meta.kind).toBe('automatic');
    // A manual backup resets the clock (ED-03).
    await runBackup(uid, 'manual');
    expect(await maybeRunAutomaticBackup(uid)).toBe('skipped-fresh');
  });

  it('fails silently but sets the flag (SC-DRV08-03)', async () => {
    await seed();
    client.failNext.upload = new DriveError('unavailable');
    expect(await maybeRunAutomaticBackup(uid)).toBe('failed');
    expect(await backupFailedFlag(uid)).toBe(true);
    expect(await maybeRunAutomaticBackup(uid)).toBe('ran'); // retries next open
  });

  it('keeps the newest 10 automatic backups, manual untouched (SC-DRV08-03)', async () => {
    await seed();
    await runBackup(uid, 'manual');
    const manual = (await listBackups(uid)).find((b) => b.kind === 'manual')!;
    // Plant 10 older automatic backups.
    const d = (await getRepos().users.getUser(uid))!.drive!;
    for (let i = 0; i < RETAIN_AUTOMATIC_BACKUPS; i++) {
      client.plant(`milevana-backup-2024-01-0${i}-0000.json`, d.backupsFolderId!, {
        properties: { kind: 'automatic' },
        createdTime: new Date(2024, 0, 1, i).toISOString(),
      });
    }
    await runBackup(uid, 'automatic'); // the 11th
    const backups = await listBackups(uid);
    const autos = backups.filter((b) => b.kind === 'automatic');
    const manuals = backups.filter((b) => b.kind === 'manual');
    expect(autos).toHaveLength(RETAIN_AUTOMATIC_BACKUPS);
    expect(manuals.map((b) => b.fileId)).toEqual([manual.fileId]);
    // The oldest planted automatic is gone.
    expect([...client.files.values()].some((f) => f.name === 'milevana-backup-2024-01-00-0000.json')).toBe(false);
  });

  it('queues a failed retention delete for the next run (DRV-14)', async () => {
    await seed();
    const layout = await ensureDriveLayout(uid, getRepos());
    // 11 automatics so retention deletes one.
    const planted: string[] = [];
    for (let i = 0; i <= RETAIN_AUTOMATIC_BACKUPS; i++) {
      planted.push(client.plant(`milevana-backup-2024-02-0${i}-0000.json`, layout.backupsFolderId, {
        properties: { kind: 'automatic' },
        createdTime: new Date(2024, 1, 1, i).toISOString(),
      }).id);
    }
    client.failNext.delete = new DriveError('network');
    await runBackup(uid, 'automatic');
    const pending = await pendingDriveDeletes(uid);
    expect(pending).toHaveLength(1);
    expect(client.files.has(pending[0].fileId)).toBe(true); // still in Drive
    expect(planted).toContain(pending[0].fileId);
  });
});
