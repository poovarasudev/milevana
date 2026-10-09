// DRV-11/12/13 (SC-DRV11-02, SC-DRV13-02): pick → pending (native staged uri,
// web blob held until save), web uploadPending, the 5-attachment cap and PDF
// size refusal, attach/remove lifecycle (Drive delete + cache evict + upload
// cancel), and missing-file detection marking the attachment 'missing'.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setFirebaseFactory } from '../../data/firebase';
import { resetDriveForTests, setDriveFactory, DriveError } from '../../data/drive/client';
import { resetLocalFilesForTests, setLocalFilesFactory, type LocalFiles } from '../../data/localFiles';
import {
  resetReceiptPickerForTests, setReceiptPickerFactory,
  ReceiptPickError, type PickedReceipt,
} from '../../data/receiptPick';
import { resetReceiptViewerForTests, setReceiptViewerFactory } from '../receiptView';
import { resetRuntimeForTests, getRepos } from '../runtime';
import { resetAppStore } from '../appStore';
import { localFlags } from '../../data/localFlags';
import type { AttachmentDoc } from '../../data/schema/entry';
import {
  discardPending, enqueuePendingReceipts, MAX_ATTACHMENTS, openReceipt,
  pickReceipt, receiptSource, removeAttachment,
  toAttachment, uploadPending, type PendingReceipt,
} from '../receipts';
import { listUploads, resetUploadQueueForTests } from '../uploadQueue';
import { pendingDriveDeletes } from '../driveDeletes';
import { FakeAdapter } from './fakeAdapter';
import { FakeDriveClient } from './fakeDrive';

const uid = 'u-owner';
const ts = (s: number) => ({ seconds: s, nanoseconds: 0 });

let adapter: FakeAdapter;
let client: FakeDriveClient;
let removedFiles: string[];
let nextPick: PickedReceipt | null;
let pickError: ReceiptPickError | null;
let viewerSource: { uri: string } | null;
let viewerError: DriveError | null;

function fakeLocalFiles(): LocalFiles {
  return {
    exists: async () => true,
    remove: async (u) => { removedFiles.push(u); },
    size: async () => 1,
    listStaging: async () => [],
    listCache: async () => [],
    stage: async (src) => ({ uri: src, sizeBytes: 1 }),
    writeStaging: async (n) => ({ uri: `st/${n}`, sizeBytes: 1 }),
    readBytes: async () => new Uint8Array(0),
    cachePath: (n) => `cache/${n}`,
    tempPath: (n) => `tmp/${n}`,
    clearTemp: async () => undefined,
    clearCache: async () => undefined,
  };
}

let vehicleId: string;

beforeEach(async () => {
  resetUploadQueueForTests();
  await AsyncStorage.clear();
  resetRuntimeForTests();
  resetAppStore();
  resetDriveForTests();
  resetLocalFilesForTests();
  resetReceiptPickerForTests();
  resetReceiptViewerForTests();
  adapter = new FakeAdapter('native');
  adapter.user = { uid, isAnonymous: false, displayName: 'Owner', email: 'o@x.com' };
  setFirebaseFactory(() => adapter);
  client = new FakeDriveClient();
  setDriveFactory(() => client);
  removedFiles = [];
  nextPick = { kind: 'image', mimeType: 'image/jpeg', uri: 'file:///picked.jpg', sizeBytes: 1234 };
  pickError = null;
  viewerSource = { uri: 'cache://a1' };
  viewerError = null;
  setLocalFilesFactory(fakeLocalFiles);
  setReceiptPickerFactory(() => ({
    pickImage: async () => { if (pickError) throw pickError; return nextPick; },
    pickPdf: async () => { if (pickError) throw pickError; return nextPick; },
    pickFile: async () => { if (pickError) throw pickError; return nextPick; },
  }));
  setReceiptViewerFactory(() => ({
    source: async () => { if (viewerError) throw viewerError; return viewerSource!; },
    open: async () => { if (viewerError) throw viewerError; },
    clear: async () => undefined,
  }));
  await getRepos().users.ensureUser(uid, { isLinked: true });
  await localFlags.setBool(uid, 'driveGranted', true);
  vehicleId = await getRepos().vehicles.create({
    name: 'Swift', type: 'car', color: 'c01', fuelTypes: ['petrol'],
    odometerUnit: 'km', currency: 'INR', startOdometer: 0,
  });
});

describe('pickReceipt (DRV-11)', () => {
  it('native pick stages a queued pending with a local uri', async () => {
    const p = await pickReceipt({ source: 'gallery', existingCount: 0 });
    expect(p).toMatchObject({ status: 'queued', uri: 'file:///picked.jpg', mimeType: 'image/jpeg' });
  });

  it('returns null on cancel and refuses beyond the 5-attachment cap (ED-07)', async () => {
    nextPick = null;
    expect(await pickReceipt({ source: 'camera', existingCount: 0 })).toBeNull();
    await expect(pickReceipt({ source: 'camera', existingCount: MAX_ATTACHMENTS }))
      .rejects.toMatchObject({ code: 'too-many' });
  });

  it('maps pdf-too-large and denied picker errors (ED-07)', async () => {
    pickError = new ReceiptPickError('pdf-too-large');
    await expect(pickReceipt({ source: 'pdf', existingCount: 0 })).rejects.toMatchObject({ code: 'pdf-too-large' });
    pickError = new ReceiptPickError('denied');
    await expect(pickReceipt({ source: 'camera', existingCount: 0 })).rejects.toMatchObject({ code: 'denied' });
  });

  it('web pick holds the blob until save (ED-14)', async () => {
    nextPick = { kind: 'image', mimeType: 'image/jpeg', blob: new Blob(['x']), sizeBytes: 1 };
    const p = await pickReceipt({ source: 'media', existingCount: 0 });
    expect(p?.blob).toBeInstanceOf(Blob);
    expect(p?.status).toBe('queued');
    expect(p?.driveFileId).toBeUndefined();
  });
});

describe('uploadPending + enqueuePendingReceipts (DRV-12)', () => {
  it('web: uploads the blob under Receipts/<vehicle>/ with the dated name', async () => {
    const p: PendingReceipt = {
      id: 'att1', mimeType: 'application/pdf', sizeBytes: 10,
      status: 'queued', blob: new Blob(['%PDF']),
    };
    const up = await uploadPending(uid, vehicleId, 'Swift', ts(new Date(2024, 0, 2).getTime() / 1000), 'expense', p);
    expect(up.status).toBe('uploaded');
    expect(up.driveFileId).toBeTruthy();
    const folderId = client.uploads[0].parentId;
    expect(client.uploads[0].name).toMatch(/^2024-01-02_expense_att1\.pdf$/);
    expect(client.files.get(folderId)!.name).toBe('Swift');
  });

  it('native: staged pendings join the FIFO queue after save', async () => {
    adapter.online = false; // freeze processing so we can inspect the queue
    const p: PendingReceipt = { id: 'att1', mimeType: 'image/jpeg', sizeBytes: 10, status: 'queued', uri: 'file:///s.jpg' };
    await enqueuePendingReceipts(uid, vehicleId, 'entry1', ts(100), 'fuel', [p]);
    const q = await listUploads(uid);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ entryId: 'entry1', attachmentId: 'att1', state: 'queued' });
    adapter.online = true;
  });

  it('toAttachment strips queue/pick internals', () => {
    const a = toAttachment(uid, { id: 'a1', mimeType: 'image/jpeg', sizeBytes: 5, status: 'uploaded', driveFileId: 'd1', uri: 'x', blob: new Blob() });
    expect(a).toEqual({
      id: 'a1', ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 5,
      status: 'uploaded', driveFileId: 'd1', sharedWithUids: [],
    });
  });
});

describe('removeAttachment / discardPending (DRV-14)', () => {
  it('removes the attachment from the entry and deletes the Drive file', async () => {
    const planted = client.plant('receipt.jpg', 'folder', {});
    const entryId = await getRepos().entries.create(vehicleId, {
      type: 'expense', date: ts(1), amount: { minor: 1, currency: 'INR' }, category: 'x',
      attachments: [{
        id: 'a1', ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 1,
        status: 'uploaded', driveFileId: planted.id, sharedWithUids: [],
      }],
    });
    await removeAttachment(uid, vehicleId, entryId, 'a1');
    expect((await getRepos().entries.get(vehicleId, entryId))!.attachments).toHaveLength(0);
    expect(client.files.has(planted.id)).toBe(false);
  });

  it('a failed Drive delete lands in the pending queue, not the entry write', async () => {
    const entryId = await getRepos().entries.create(vehicleId, {
      type: 'expense', date: ts(1), amount: { minor: 1, currency: 'INR' }, category: 'x',
      attachments: [{
        id: 'a1', ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 1,
        status: 'uploaded', driveFileId: 'd-fail', sharedWithUids: [],
      }],
    });
    client.failFileIds.set('d-fail', new DriveError('network'));
    await removeAttachment(uid, vehicleId, entryId, 'a1');
    expect((await getRepos().entries.get(vehicleId, entryId))!.attachments).toHaveLength(0);
    expect((await pendingDriveDeletes(uid)).map((p) => p.fileId)).toEqual(['d-fail']);
  });

  it('discardPending removes the staged file and any uploaded Drive file', async () => {
    const p: PendingReceipt = { id: 'a1', mimeType: 'image/jpeg', sizeBytes: 1, status: 'uploaded', uri: 'file:///s.jpg', driveFileId: 'd1' };
    client.plant('x', 'root'); // presence only
    await discardPending(uid, p);
    expect(removedFiles).toContain('file:///s.jpg');
    expect(client.deletes).toContain('d1');
  });
});

describe('viewing (DRV-13)', () => {
  const uploaded: AttachmentDoc = {
    id: 'a1', ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 1,
    status: 'uploaded', driveFileId: 'd1', sharedWithUids: [],
  };

  it('source returns the viewer source; not-uploaded returns null', async () => {
    const entry = { id: 'e1', attachments: [uploaded] } as never;
    expect(await receiptSource(uid, vehicleId, entry, uploaded)).toEqual(viewerSource);
    expect(await receiptSource(uid, vehicleId, entry, { ...uploaded, status: 'queued' })).toBeNull();
  });

  it('Drive not-found marks the attachment missing (ED-10)', async () => {
    viewerError = new DriveError('not-found');
    const entryId = await getRepos().entries.create(vehicleId, {
      type: 'expense', date: ts(1), amount: { minor: 1, currency: 'INR' }, category: 'x',
      attachments: [uploaded],
    });
    const entry = { ...(await getRepos().entries.get(vehicleId, entryId))!, id: entryId };
    expect(await openReceipt(uid, vehicleId, entry, uploaded)).toBe('missing');
    const after = (await getRepos().entries.get(vehicleId, entryId))!;
    expect(after.attachments![0].status).toBe('missing');
  });
});
afterEach(() => resetUploadQueueForTests());
