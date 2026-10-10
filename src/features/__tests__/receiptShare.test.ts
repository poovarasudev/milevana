// SHR-14 (SC-SHR14-01/05, SD-08, OQ-56): the receipt share sync grants and
// revokes Drive reader access for current members, updates sharedWithUids,
// throttles per vehicle, caps at 200 receipts per run, skips email-less
// members, logs one non-fatal when the uploader can't write the entry, and
// never runs on web.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetDriveForTests, setDriveFactory, DriveError } from '../../data/drive/client';
import { resetFirebaseForTests, setFirebaseFactory } from '../../data/firebase';
import { localFlags } from '../../data/localFlags';
import type { AttachmentDoc } from '../../data/schema/entry';
import type { VehicleRecord } from '../../data/repos/vehicleRepo';
import { past } from '../../data/schema/__tests__/fixtures';
import { resetAppStore, useAppStore } from '../appStore';
import {
  installReceiptShareSync, resetShareSyncForTests, runShareSync, SHARE_SYNC_MAX_RECEIPTS,
} from '../receiptShare';
import { resetRuntimeForTests } from '../runtime';
import { FakeAdapter } from './fakeAdapter';
import { FakeDriveClient } from './fakeDrive';

const uid = 'me';
const VID = 'v1';

let adapter: FakeAdapter;
let drive: FakeDriveClient;

const attachment = (id: string, over: Partial<AttachmentDoc> = {}): AttachmentDoc => ({
  id, ownerUid: uid, mimeType: 'image/jpeg', sizeBytes: 100,
  status: 'uploaded', driveFileId: `d-${id}`, sharedWithUids: [], ...over,
});

const entryDoc = (id: string, atts: AttachmentDoc[], over: Record<string, unknown> = {}) => ({
  type: 'expense', date: past, odometer: 1200,
  amount: { minor: 25000, currency: 'INR' }, category: 'cleaning',
  attachments: atts, uploaderUids: [uid],
  createdBy: uid, createdByName: 'Me', updatedBy: uid,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...over,
});

function vehicleDoc(members: Record<string, { role: 'owner' | 'member'; name: string; email?: string; joinedAt: typeof past }>) {
  return {
    name: 'Swift', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
    odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
    lastOdometer: 1000, lastOdometerAt: past,
    ownerId: uid, memberIds: Object.keys(members), members, archived: false,
    createdAt: past, updatedAt: past, schemaVersion: 1 as const,
  };
}

const memberRec = (name: string, email?: string) => ({
  role: 'member' as const, name, ...(email ? { email } : {}), joinedAt: past,
});

function vehicle(
  members: Record<string, { role: 'owner' | 'member'; name: string; email?: string; joinedAt: typeof past }>,
): VehicleRecord {
  return { ...vehicleDoc(members), id: VID, pending: false };
}

function plant(
  vehicle: VehicleRecord,
  entries: { id: string; atts: AttachmentDoc[]; over?: Record<string, unknown> }[],
): void {
  adapter.docs.set(`vehicles/${VID}`, vehicleDoc(vehicle.members as never));
  for (const e of entries) {
    adapter.docs.set(`vehicles/${VID}/entries/${e.id}`, entryDoc(e.id, e.atts, e.over));
  }
  useAppStore.setState({ vehicles: [vehicle] });
}

function boot(platform: 'native' | 'web' = 'native'): void {
  adapter = new FakeAdapter(platform);
  setFirebaseFactory(() => adapter);
  resetRuntimeForTests();
  adapter.setUser({ uid, isAnonymous: false, displayName: 'Me', email: 'me@x.com' });
  useAppStore.setState({ user: adapter.currentUser(), online: true });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetAppStore();
  resetFirebaseForTests();
  resetDriveForTests();
  resetShareSyncForTests();
  drive = new FakeDriveClient();
  setDriveFactory(() => drive);
  jest.restoreAllMocks();
});

const grant = () => localFlags.setBool(uid, 'driveGranted', true);

describe('runShareSync (SHR-14)', () => {
  it('grants reader access to members with email and records sharedWithUids', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
      sam: memberRec('Sam'), // no email → skipped (SD-08)
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    await runShareSync(uid);

    expect(drive.permCalls).toEqual([{ op: 'add', fileId: 'd-a1', key: 'bob@x.com' }]);
    const doc = adapter.docs.get(`vehicles/${VID}/entries/e1`)!;
    expect((doc.attachments as AttachmentDoc[])[0].sharedWithUids).toEqual(['bob']);
  });

  it('revokes reader grants whose email is no longer a member (OQ-56)', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);
    // A stale reader grant for a departed member sits on the file.
    drive.permissions.set('d-a1', [
      { id: 'p1', type: 'user', role: 'reader', emailAddress: 'bob@x.com' },
      { id: 'p2', type: 'user', role: 'reader', emailAddress: 'gone@x.com' },
      { id: 'p3', type: 'user', role: 'owner', emailAddress: 'me@x.com' },
    ]);

    await runShareSync(uid);

    expect(drive.permCalls).toEqual([{ op: 'remove', fileId: 'd-a1', key: 'p2' }]);
    expect(drive.permissions.get('d-a1')!.map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('runs at most once per 15 minutes per vehicle', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    await runShareSync(uid);
    expect(drive.permCalls.length).toBe(1);

    // Second run immediately → throttled, no Drive traffic at all.
    await runShareSync(uid);
    expect(drive.permCalls.length).toBe(1);

    // After the interval it runs again (idempotent — no re-grant needed).
    jest.useFakeTimers().setSystemTime(Date.now() + 16 * 60 * 1000);
    await runShareSync(uid);
    jest.useRealTimers();
    expect(drive.permCalls.length).toBe(1); // listPermissions only, no new adds
  });

  it('handles at most 200 receipts per run; the rest next run', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    // 42 entries × 5 attachments (the schema cap) = 210 receipts.
    const entries = Array.from({ length: 42 }, (_, i) => ({
      id: `e${i}`,
      atts: Array.from({ length: 5 }, (_, j) => attachment(`a${i}-${j}`)),
    }));
    plant(v, entries);

    await runShareSync(uid);

    let shared = 0;
    for (const e of entries) {
      const doc = adapter.docs.get(`vehicles/${VID}/entries/${e.id}`)!;
      shared += (doc.attachments as AttachmentDoc[]).filter(
        (a) => a.sharedWithUids.length > 0,
      ).length;
    }
    expect(shared).toBe(SHARE_SYNC_MAX_RECEIPTS);
  });

  it('an uploader who is neither creator nor owner still changes Drive but logs one non-fatal (L15)', async () => {
    boot();
    await grant();
    const doc = vehicleDoc({
      own: { role: 'owner', name: 'Owner', email: 'o@x.com', joinedAt: past },
      me: memberRec('Me', 'me@x.com'),
      bob: memberRec('Bob', 'bob@x.com'),
    });
    doc.ownerId = 'own';
    adapter.docs.set(`vehicles/${VID}`, doc);
    // 'me' uploaded to an entry created by someone else; owner is 'own'.
    adapter.docs.set(`vehicles/${VID}/entries/e1`, entryDoc('e1', [attachment('a1')], {
      createdBy: 'sam', createdByName: 'Sam',
    }));
    useAppStore.setState({ vehicles: [{ ...doc, id: VID, pending: false } as VehicleRecord] });

    await runShareSync(uid);

    // Drive access was applied for all members…
    expect(drive.permCalls.filter((c) => c.op === 'add').map((c) => c.key).sort())
      .toEqual(['bob@x.com', 'o@x.com']);
    // …but sharedWithUids was NOT touched, and one non-fatal was logged.
    const entry = adapter.docs.get(`vehicles/${VID}/entries/e1`)!;
    expect((entry.attachments as AttachmentDoc[])[0].sharedWithUids).toEqual([]);
    expect(adapter.reports.filter((r) => (r.context as { stage?: string })?.stage === 'receipt-share'))
      .toHaveLength(1);
  });

  it('a Drive failure leaves the entry alone and the next run retries', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    drive.failNext.perm = new DriveError('network', 'down');
    await runShareSync(uid);
    expect((adapter.docs.get(`vehicles/${VID}/entries/e1`)!.attachments as AttachmentDoc[])[0].sharedWithUids)
      .toEqual([]);
    expect(drive.permCalls).toHaveLength(0); // listPermissions threw first

    // Failure consumed the slot — clear the throttle to simulate the next run.
    await localFlags.setJson(uid, 'shareSyncAt', {});
    resetShareSyncForTests();
    await runShareSync(uid);
    expect(drive.permCalls).toEqual([{ op: 'add', fileId: 'd-a1', key: 'bob@x.com' }]);
  });

  it('skips when anonymous, offline, unshared or without a Drive grant', async () => {
    boot();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    await runShareSync(uid); // no grant → nothing
    expect(drive.permCalls).toHaveLength(0);

    await grant();
    useAppStore.setState({ online: false });
    await runShareSync(uid);
    expect(drive.permCalls).toHaveLength(0);

    useAppStore.setState({ online: true });
    useAppStore.setState({ user: { uid, isAnonymous: true, displayName: null, email: null } });
    await runShareSync(uid);
    expect(drive.permCalls).toHaveLength(0);
  });

  it('does not run on web (SD-11)', async () => {
    boot('web');
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    const stop = installReceiptShareSync(uid);
    await runShareSync(uid);
    stop();
    expect(drive.permCalls).toHaveLength(0);
  });

  it('flags the run so the UI can show "Sharing receipts…" (SD-08)', async () => {
    boot();
    await grant();
    const v = vehicle({
      me: { role: 'owner', name: 'Me', email: 'me@x.com', joinedAt: past },
      bob: memberRec('Bob', 'bob@x.com'),
    });
    plant(v, [{ id: 'e1', atts: [attachment('a1')] }]);

    let runningMidSync = false;
    const orig = drive.listPermissions.bind(drive);
    jest.spyOn(drive, 'listPermissions').mockImplementation(async (id) => {
      runningMidSync = useAppStore.getState().shareSyncRunning;
      return orig(id);
    });

    await runShareSync(uid);
    expect(runningMidSync).toBe(true);
    expect(useAppStore.getState().shareSyncRunning).toBe(false);
  });
});
