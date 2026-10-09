// DRV-05 (SC-DRV05-01..03): Milevana/Backups/Receipts layout persisted on
// users.drive, per-vehicle receipt folders keyed by vehicle id (renames don't
// move them), stale-id recovery without duplicates, receipt file naming.

import { resetFirebaseForTests, setFirebaseFactory } from '../../firebase';
import { createRepos, type Repos } from '../../repos';
import { resetDriveForTests, setDriveFactory } from '../client';
import {
  ensureDriveLayout, ensureVehicleReceiptFolder, receiptFileName,
  DRIVE_ROOT_NAME, BACKUPS_FOLDER, RECEIPTS_FOLDER,
} from '../folders';
import { FakeAdapter } from '../../../features/__tests__/fakeAdapter';
import { FakeDriveClient } from '../../../features/__tests__/fakeDrive';

let adapter: FakeAdapter;
let driveFake: FakeDriveClient;
let repos: Repos;
const uid = 'u1';

beforeEach(async () => {
  resetFirebaseForTests();
  resetDriveForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Owner', email: 'o@x.com' };
  setFirebaseFactory(() => adapter);
  driveFake = new FakeDriveClient();
  setDriveFactory(() => driveFake);
  repos = createRepos(adapter);
  await repos.users.ensureUser(uid, { language: 'en' });
});

describe('ensureDriveLayout', () => {
  it('creates Milevana/Backups/Receipts and stores the ids (SC-DRV05-01)', async () => {
    const layout = await ensureDriveLayout(uid, repos);
    const names = [...driveFake.files.values()].map((f) => `${f.name}@${f.parentId ?? 'root'}`);
    expect(names).toEqual(
      expect.arrayContaining([`${DRIVE_ROOT_NAME}@root`, `${BACKUPS_FOLDER}@${layout.rootFolderId}`, `${RECEIPTS_FOLDER}@${layout.rootFolderId}`]),
    );
    const d = (await repos.users.getUser(uid))!.drive!;
    expect(d.rootFolderId).toBe(layout.rootFolderId);
    expect(d.backupsFolderId).toBe(layout.backupsFolderId);
    expect(d.receiptsFolderId).toBe(layout.receiptsFolderId);
  });

  it('is idempotent — second call reuses stored ids', async () => {
    const a = await ensureDriveLayout(uid, repos);
    const count = driveFake.files.size;
    const b = await ensureDriveLayout(uid, repos);
    expect(b).toEqual(a);
    expect(driveFake.files.size).toBe(count);
  });

  it('recovers a stale folder id by name without duplicating (SC-DRV05-03)', async () => {
    const layout = await ensureDriveLayout(uid, repos);
    // Another device already created the folder; our stored id is stale.
    driveFake.files.delete(layout.rootFolderId);
    const realRoot = driveFake.plant('Milevana', undefined, { mimeType: 'application/vnd.google-apps.folder' });
    const next = await ensureDriveLayout(uid, repos);
    expect(next.rootFolderId).toBe(realRoot.id);
    expect([...driveFake.files.values()].filter((f) => f.name === 'Milevana')).toHaveLength(1);
  });
});

describe('ensureVehicleReceiptFolder', () => {
  it('creates Receipts/<vehicle> once, keyed by vehicle id (SC-DRV05-02)', async () => {
    const f1 = await ensureVehicleReceiptFolder(uid, 'veh1', 'Swift', repos);
    const d = (await repos.users.getUser(uid))!.drive!;
    expect(d.vehicleFolderIds.veh1).toBe(f1);
    // Rename: same folder, nothing recreated or moved.
    const f2 = await ensureVehicleReceiptFolder(uid, 'veh1', 'Swift Sport', repos);
    expect(f2).toBe(f1);
    // A second, same-name vehicle gets its own folder by id.
    const f3 = await ensureVehicleReceiptFolder(uid, 'veh2', 'Swift', repos);
    expect(f3).not.toBe(f1);
  });

  it('recreates a deleted vehicle folder under Receipts', async () => {
    const f1 = await ensureVehicleReceiptFolder(uid, 'veh1', 'Swift', repos);
    driveFake.files.delete(f1); // user trashed it in Drive
    const f2 = await ensureVehicleReceiptFolder(uid, 'veh1', 'Swift', repos);
    expect(f2).not.toBe(f1);
    const stored = driveFake.files.get(f2)!;
    const d = (await repos.users.getUser(uid))!.drive!;
    expect(stored.parentId).toBe(d.receiptsFolderId);
  });
});

describe('receiptFileName', () => {
  it('is <date>_<type>_<attachment id>.<ext> (ED-07)', () => {
    const name = receiptFileName({ seconds: new Date(2024, 2, 5).getTime() / 1000, nanoseconds: 0 }, 'fuel', 'att1', 'image/jpeg');
    expect(name).toBe('2024-03-05_fuel_att1.jpg');
    expect(receiptFileName({ seconds: 0, nanoseconds: 0 }, 'service', 'a2', 'application/pdf')).toMatch(/_service_a2\.pdf$/);
  });
});
