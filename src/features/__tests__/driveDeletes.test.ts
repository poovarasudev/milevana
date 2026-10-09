// DRV-14 D1/D2 (SC-DRV14-01/03): failed Drive deletes queue locally, retry on
// app open/sign-in, drop after 5 failed attempts, and never block Firestore
// writes. Plus the 100 MB LRU receipt cache (ED-10): touch/cap/evict/clear.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetDriveForTests, setDriveFactory, DriveError } from '../../data/drive/client';
import { resetLocalFilesForTests, setLocalFilesFactory, type LocalFiles } from '../../data/localFiles';
import { localFlags } from '../../data/localFlags';
import {
  deleteDriveFileOrQueue, pendingDriveDeletes, queueDriveDelete, runPendingDriveDeletes,
} from '../driveDeletes';
import {
  cachedReceiptUri, clearReceiptCache, evictReceipt, receiptToCache, RECEIPT_CACHE_CAP_BYTES,
} from '../receiptCache';
import { FakeDriveClient } from './fakeDrive';

const uid = 'u1';
let client: FakeDriveClient;
let existing: Set<string>;
let removed: string[];

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDriveForTests();
  resetLocalFilesForTests();
  client = new FakeDriveClient();
  setDriveFactory(() => client);
  existing = new Set();
  removed = [];
  const f: LocalFiles = {
    exists: async (u) => existing.has(u),
    remove: async (u) => { removed.push(u); existing.delete(u); },
    size: async () => 0,
    listStaging: async () => [],
    listCache: async () => [...existing].map((uri) => ({ uri, sizeBytes: 1 })),
    stage: async (s) => ({ uri: s, sizeBytes: 1 }),
    writeStaging: async (n) => ({ uri: n, sizeBytes: 1 }),
    readBytes: async () => new Uint8Array(0),
    cachePath: (n) => n,
    tempPath: (n) => n,
    clearTemp: async () => undefined,
    clearCache: async () => { existing.clear(); },
  };
  setLocalFilesFactory(() => f);
  await localFlags.setBool(uid, 'driveGranted', true);
});

describe('pending Drive deletes (DRV-14)', () => {
  it('deletes immediately when granted; queues when not', async () => {
    client.plant('f', 'root');
    const id = [...client.files.keys()][0];
    await deleteDriveFileOrQueue(uid, id);
    expect(client.deletes).toEqual([id]);
    expect(await pendingDriveDeletes(uid)).toHaveLength(0);

    await localFlags.setBool(uid, 'driveGranted', false);
    await deleteDriveFileOrQueue(uid, 'f-x');
    expect(await pendingDriveDeletes(uid)).toEqual([{ fileId: 'f-x', attempts: 0 }]);
  });

  it('failed deletes queue; a later run retries and clears them', async () => {
    client.failFileIds.set('f-bad', new DriveError('network'));
    await deleteDriveFileOrQueue(uid, 'f-bad');
    expect(await pendingDriveDeletes(uid)).toEqual([{ fileId: 'f-bad', attempts: 0 }]);
    client.failFileIds.delete('f-bad');
    expect(await runPendingDriveDeletes(uid)).toBe(1); // retried and removed
    expect(await pendingDriveDeletes(uid)).toHaveLength(0);
  });

  it('drops entries after 5 failed attempts (ED-16)', async () => {
    client.failFileIds.set('f-stubborn', new DriveError('network'));
    await queueDriveDelete(uid, 'f-stubborn');
    for (let i = 0; i < 5; i++) await runPendingDriveDeletes(uid);
    expect(await pendingDriveDeletes(uid)).toHaveLength(0);
  });

  it('an access failure aborts the sweep without consuming attempts', async () => {
    await queueDriveDelete(uid, 'f1');
    await queueDriveDelete(uid, 'f2');
    client.failNext.delete = new DriveError('access-revoked');
    const done = await runPendingDriveDeletes(uid);
    expect(done).toBe(0);
    const left = await pendingDriveDeletes(uid);
    expect(left).toHaveLength(2);
    expect(left.every((p) => p.attempts === 0)).toBe(true);
  });
});

describe('receipt cache LRU (ED-10)', () => {
  it('caches and returns uris; missing files are dropped from the index', async () => {
    existing.add('cache/a');
    await receiptToCache('a1', 'cache/a', 10);
    expect(await cachedReceiptUri('a1')).toBe('cache/a');
    existing.delete('cache/a');
    expect(await cachedReceiptUri('a1')).toBeNull(); // index entry pruned
  });

  it('evicts least-recently-used entries past the 100 MB cap', async () => {
    existing.add('cache/old');
    await receiptToCache('old', 'cache/old', RECEIPT_CACHE_CAP_BYTES - 1);
    await new Promise((r) => setTimeout(r, 5)); // distinct lastUsed
    existing.add('cache/new');
    await receiptToCache('new', 'cache/new', 2); // pushes total over the cap
    expect(await cachedReceiptUri('old')).toBeNull();
    expect(removed).toContain('cache/old');
    expect(await cachedReceiptUri('new')).toBe('cache/new');
  });

  it('evictReceipt removes one entry; clearReceiptCache wipes all', async () => {
    existing.add('cache/a');
    existing.add('cache/b');
    await receiptToCache('a', 'cache/a', 1);
    await receiptToCache('b', 'cache/b', 1);
    await evictReceipt('a');
    expect(await cachedReceiptUri('a')).toBeNull();
    expect(await cachedReceiptUri('b')).toBe('cache/b');
    await clearReceiptCache();
    expect(await cachedReceiptUri('b')).toBeNull();
    expect(existing.size).toBe(0);
  });
});
