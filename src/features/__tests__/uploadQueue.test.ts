// DRV-12 (SC-DRV12-01/02/04/05): FIFO one-at-a-time processing, the retry
// schedule (1, 5, 15 min then hourly), 'failed' after 5 attempts with manual
// Retry, restart durability via AsyncStorage, cancellation on entry/vehicle
// delete, and uploaderUids updated on success.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setFirebaseFactory } from '../../data/firebase';
import { resetDriveForTests, setDriveFactory, DriveError } from '../../data/drive/client';
import { resetLocalFilesForTests, setLocalFilesFactory, type LocalFiles } from '../../data/localFiles';
import { resetRuntimeForTests, getRepos } from '../runtime';
import { resetAppStore, useAppStore } from '../appStore';
import { localFlags } from '../../data/localFlags';
import type { AttachmentDoc } from '../../data/schema/entry';
import {
  cancelEntryUploads, cancelUpload, enqueueUpload, kickUploadQueue,
  listUploads, retryUpload, sweepOrphanedStaging,
  resetUploadQueueForTests,
} from '../uploadQueue';
import { FakeAdapter } from './fakeAdapter';
import { FakeDriveClient } from './fakeDrive';

const uid = 'u-owner';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

let adapter: FakeAdapter;
let client: FakeDriveClient;
let files: { existing: Set<string>; removed: string[] };

function fakeLocalFiles(): LocalFiles {
  return {
    exists: async (u) => files.existing.has(u),
    remove: async (u) => { files.removed.push(u); files.existing.delete(u); },
    size: async (u) => (files.existing.has(u) ? 1 : null),
    listStaging: async () => [...files.existing].map((uri) => ({ uri, sizeBytes: 1 })),
    listCache: async () => [],
    stage: async (src) => ({ uri: src, sizeBytes: 1 }),
    writeStaging: async (name) => ({ uri: `st/${name}`, sizeBytes: 1 }),
    readBytes: async () => new Uint8Array(0),
    cachePath: (n) => `cache/${n}`,
    tempPath: (n) => `tmp/${n}`,
    clearTemp: async () => undefined,
    clearCache: async () => undefined,
  };
}

let vehicleId: string;
let entryId: string;

const att = (id: string, status: AttachmentDoc['status'] = 'queued'): AttachmentDoc => ({
  id, ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 100,
  status, sharedWithUids: [],
});

const item = (attachmentId: string, uri?: string) => ({
  vehicleId, entryId, attachmentId,
  uri: uri ?? `file:///stage/${attachmentId}.jpg`,
  name: `2024-01-01_expense_${attachmentId}.jpg`,
  mimeType: 'image/jpeg',
});

beforeEach(async () => {
  resetUploadQueueForTests();
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetDriveForTests();
  resetLocalFilesForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Owner', email: null };
  adapter.online = true;
  setFirebaseFactory(() => adapter);
  client = new FakeDriveClient();
  setDriveFactory(() => client);
  files = { existing: new Set(), removed: [] };
  setLocalFilesFactory(fakeLocalFiles);
  await getRepos().users.ensureUser(uid, { isLinked: true });
  await localFlags.setBool(uid, 'driveGranted', true);
  vehicleId = await getRepos().vehicles.create({
    name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  });
  entryId = await getRepos().entries.create(vehicleId, {
    type: 'expense', date: ts(100), amount: { minor: 500, currency: 'INR' }, category: 'cleaning',
    attachments: [att('a1')],
  });
});

describe('processing (DRV-12)', () => {
  it('uploads the staged file, marks the attachment and adds the uploader (SC-DRV12-01)', async () => {
    files.existing.add('file:///stage/a1.jpg');
    await enqueueUpload(uid, item('a1'));
    await kickUploadQueue(uid);
    const entry = (await getRepos().entries.get(vehicleId, entryId))!;
    const a = entry.attachments![0];
    expect(a.status).toBe('uploaded');
    expect(a.driveFileId).toBeTruthy();
    expect(entry.uploaderUids).toContain(uid);
    expect(await listUploads(uid)).toHaveLength(0);
    expect(files.removed).toContain('file:///stage/a1.jpg'); // staged copy freed
    // File landed under Receipts/<vehicle>/.
    const up = client.uploads[0];
    expect(up.name).toBe('2024-01-01_expense_a1.jpg');
    const folder = client.files.get(up.parentId)!;
    const d = (await getRepos().users.getUser(uid))!.drive!;
    expect(folder.parentId).toBe(d.receiptsFolderId);
  });

  it('waits while offline or ungranted without consuming attempts', async () => {
    files.existing.add('file:///stage/a1.jpg');
    adapter.online = false;
    await enqueueUpload(uid, item('a1'));
    await kickUploadQueue(uid);
    let q = await listUploads(uid);
    expect(q[0].attempts).toBe(0);
    adapter.online = true;
    await localFlags.setBool(uid, 'driveGranted', false);
    await kickUploadQueue(uid);
    q = await listUploads(uid);
    expect(q[0].attempts).toBe(0); // grant waits silently
  });

  it('processes FIFO and one at a time (SC-DRV12-04)', async () => {
    await getRepos().entries.update(vehicleId, entryId, { attachments: [att('a1'), att('a2')] });
    files.existing.add('file:///stage/a1.jpg').add('file:///stage/a2.jpg');
    await enqueueUpload(uid, item('a1'));
    await enqueueUpload(uid, item('a2'));
    await kickUploadQueue(uid);
    expect(client.uploads.map((u) => u.name)).toEqual([
      '2024-01-01_expense_a1.jpg', '2024-01-01_expense_a2.jpg',
    ]);
  });

  it('backs off 1/5/15 min then hourly and fails after 5 attempts (ED-09)', async () => {
    files.existing.add('file:///stage/a1.jpg');
    adapter.online = false; // enqueue without processing
    await enqueueUpload(uid, item('a1'));
    adapter.online = true;
    client.failNext.upload = new DriveError('network');
    const t0 = Date.now();
    await kickUploadQueue(uid);
    let q = (await listUploads(uid))[0];
    expect(q.attempts).toBe(1);
    expect(q.nextAt).toBeGreaterThanOrEqual(t0 + 60_000); // 1 min

    // Drive keeps failing; force nextAt into the past and kick again.
    for (let i = 2; i <= 5; i++) {
      client.failNext.upload = new DriveError('network');
      const list = await listUploads(uid);
      await localFlags.setJson(uid, 'receiptQueue', list.map((x) => ({ ...x, nextAt: 0 })));
      await kickUploadQueue(uid);
      q = (await listUploads(uid))[0];
      expect(q.attempts).toBe(i);
      if (i === 2) expect(q.nextAt).toBeGreaterThanOrEqual(Date.now() + 5 * 60_000 - 1000);
      if (i === 3) expect(q.nextAt).toBeGreaterThanOrEqual(Date.now() + 15 * 60_000 - 1000);
      if (i === 4) expect(q.nextAt).toBeGreaterThanOrEqual(Date.now() + 60 * 60_000 - 1000);
    }
    expect(q.state).toBe('failed');
    const entry = (await getRepos().entries.get(vehicleId, entryId))!;
    expect(entry.attachments![0].status).toBe('failed');
  });

  it('manual Retry re-queues a failed item (ED-09)', async () => {
    files.existing.add('file:///stage/a1.jpg');
    adapter.online = false;
    await enqueueUpload(uid, item('a1'));
    const list = await listUploads(uid);
    await localFlags.setJson(uid, 'receiptQueue', list.map((x) => ({ ...x, state: 'failed', attempts: 5 })));
    await retryUpload(uid, 'a1');
    const q = (await listUploads(uid))[0];
    expect(q.state).toBe('queued');
    expect(q.attempts).toBe(0);
    adapter.online = true;
    await kickUploadQueue(uid);
    expect(await listUploads(uid)).toHaveLength(0);
    expect((await getRepos().entries.get(vehicleId, entryId))!.attachments![0].status).toBe('uploaded');
  });

  it('drops items whose entry/attachment is gone and cancels on delete', async () => {
    files.existing.add('file:///stage/a1.jpg');
    await enqueueUpload(uid, item('ghost'));
    await kickUploadQueue(uid);
    expect(await listUploads(uid)).toHaveLength(0); // attachment not on the entry

    await enqueueUpload(uid, item('a1'));
    await cancelEntryUploads(uid, entryId);
    expect(await listUploads(uid)).toHaveLength(0);

    await enqueueUpload(uid, item('a1'));
    await cancelUpload(uid, 'a1');
    expect(await listUploads(uid)).toHaveLength(0);
  });

  it('marks the attachment failed when the staged file is gone', async () => {
    adapter.online = false;
    await enqueueUpload(uid, item('a1')); // uri never staged
    adapter.online = true;
    await kickUploadQueue(uid);
    expect(await listUploads(uid)).toHaveLength(0);
    expect((await getRepos().entries.get(vehicleId, entryId))!.attachments![0].status).toBe('failed');
  });

  it('sets the storage-full notice while keeping the item queued (SC-DRV12-03)', async () => {
    files.existing.add('file:///stage/a1.jpg');
    adapter.online = false;
    await enqueueUpload(uid, item('a1'));
    adapter.online = true;
    client.failNext.upload = new DriveError('storage-full');
    await kickUploadQueue(uid);
    const q = (await listUploads(uid))[0];
    expect(q.state).toBe('queued');
    expect(q.lastError).toBe('storage-full');
    expect(useAppStore.getState().receiptStorageFull).toBe(true);
  });

  it('keeps queued items across a restart and sweeps orphaned staging', async () => {
    files.existing.add('file:///stage/a1.jpg');
    files.existing.add('file:///stage/orphan.jpg');
    adapter.online = false; // leave the item queued for the "restart"
    await enqueueUpload(uid, item('a1'));
    // "Restart": fresh process against the same AsyncStorage + Firestore
    // (the FakeAdapter doc store stands in for Firestore, so it survives).
    resetRuntimeForTests();
    resetDriveForTests();
    resetLocalFilesForTests();
    adapter.online = true;
    setFirebaseFactory(() => adapter);
    client = new FakeDriveClient();
    setDriveFactory(() => client);
    setLocalFilesFactory(fakeLocalFiles);
    await sweepOrphanedStaging(uid);
    expect(files.existing.has('file:///stage/a1.jpg')).toBe(true); // still queued — kept
    expect(files.existing.has('file:///stage/orphan.jpg')).toBe(false); // orphaned — swept
    await kickUploadQueue(uid);
    expect(client.uploads).toHaveLength(1); // upload resumes, no duplicate
  });
});
afterEach(() => resetUploadQueueForTests());
