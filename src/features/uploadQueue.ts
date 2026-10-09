// Receipt upload queue (DRV-12): a per-uid FIFO persisted in AsyncStorage so
// queued uploads survive a restart. One upload at a time; retry after 1, 5,
// 15 minutes then hourly; after 5 attempts the attachment is marked 'failed'
// and can be re-queued by the manual Retry control. The queue runs on app
// open, when connectivity returns, in the foreground only, on any network,
// and is discarded at sign-out (SC-DRV12-05) or when the entry is deleted.
// Uploads need the drive.file grant — the queue simply waits when absent.

import { AppState } from 'react-native';
import type { Unsubscribe } from '../data/adapter';
import { drive, DriveError } from '../data/drive/client';
import { ensureVehicleReceiptFolder } from '../data/drive/folders';
import { localFlags } from '../data/localFlags';
import type { AttachmentDoc } from '../data/schema/entry';
import { localFiles } from '../data/localFiles';
import { adapter, getRepos } from './runtime';
import { isDriveGranted, withDrive } from './driveAccess';
import { useAppStore } from './appStore';

const KEY = 'receiptQueue';
const MAX_ATTEMPTS = 5;
// 1 min, 5 min, 15 min, then hourly (ED-09).
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export interface QueuedUpload {
  vehicleId: string;
  entryId: string;
  attachmentId: string;
  /** Staged local file to upload (native file:// uri). */
  uri: string;
  /** Drive file name (ED-07). */
  name: string;
  mimeType: string;
  attempts: number;
  nextAt: number;
  state: 'queued' | 'failed';
  lastError?: 'storage-full' | 'network' | 'access' | 'unknown';
}

// --- persistence ---------------------------------------------------------------

export function listUploads(uid: string): Promise<QueuedUpload[]> {
  return localFlags.getJson<QueuedUpload[]>(uid, KEY, []);
}

async function saveUploads(uid: string, items: QueuedUpload[]): Promise<void> {
  await localFlags.setJson(uid, KEY, items);
  publishQueueState(items);
}

function publishQueueState(items: QueuedUpload[]): void {
  useAppStore.setState({
    receiptQueuePending: items.filter((i) => i.state === 'queued').length,
    receiptStorageFull: items.some((i) => i.lastError === 'storage-full'),
  });
}

/** Restore the read model from persisted state (session start). */
export async function refreshUploadQueueState(uid: string): Promise<void> {
  publishQueueState(await listUploads(uid));
}

// --- queue ops -----------------------------------------------------------------

export async function enqueueUpload(
  uid: string,
  item: Omit<QueuedUpload, 'attempts' | 'nextAt' | 'state'>,
): Promise<void> {
  const list = await listUploads(uid);
  if (list.some((i) => i.attachmentId === item.attachmentId)) return;
  await saveUploads(uid, [...list, { ...item, attempts: 0, nextAt: Date.now(), state: 'queued' }]);
  void kickUploadQueue(uid);
}

/** Manual Retry on a failed attachment (ED-09): back to the head schedule. */
export async function retryUpload(uid: string, attachmentId: string): Promise<void> {
  const list = await listUploads(uid);
  const next = list.map((i) =>
    i.attachmentId === attachmentId ? { ...i, attempts: 0, nextAt: Date.now(), state: 'queued' as const, lastError: undefined } : i,
  );
  await saveUploads(uid, next);
  void kickUploadQueue(uid);
}

/** Drop one attachment's queue item (attachment removed from its entry). */
export async function cancelUpload(uid: string, attachmentId: string): Promise<void> {
  const list = await listUploads(uid);
  const next = list.filter((i) => i.attachmentId !== attachmentId);
  if (next.length !== list.length) await saveUploads(uid, next);
}

/** Drop queued uploads for an entry that is being deleted (SC-DRV12-05). */
export async function cancelEntryUploads(uid: string, entryId: string): Promise<void> {
  const list = await listUploads(uid);
  const next = list.filter((i) => i.entryId !== entryId);
  if (next.length !== list.length) await saveUploads(uid, next);
}

/** Drop queued uploads for a vehicle being deleted. */
export async function cancelVehicleUploads(uid: string, vehicleId: string): Promise<void> {
  const list = await listUploads(uid);
  const next = list.filter((i) => i.vehicleId !== vehicleId);
  if (next.length !== list.length) await saveUploads(uid, next);
}

/** Queued-count for the sign-out warning (SC-DRV12-05). */
export async function countQueuedUploads(uid: string): Promise<number> {
  return (await listUploads(uid)).filter((i) => i.state === 'queued').length;
}

/**
 * App-start sweep: staged files left by abandoned picks are deleted; files a
 * queued upload still needs are kept (restart durability, DRV-12).
 */
export async function sweepOrphanedStaging(uid: string): Promise<void> {
  try {
    const keep = new Set((await listUploads(uid)).map((i) => i.uri));
    for (const f of await localFiles().listStaging()) {
      if (!keep.has(f.uri)) await localFiles().remove(f.uri);
    }
  } catch {
    // best-effort housekeeping
  }
}

// --- processing -----------------------------------------------------------------

let chain: Promise<void> = Promise.resolve();
let wakeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleWake(uid: string, at: number): void {
  if (wakeTimer) clearTimeout(wakeTimer);
  const delay = Math.max(0, at - Date.now());
  wakeTimer = setTimeout(() => void kickUploadQueue(uid), Math.min(delay, 2_147_000_000));
}

/** Patch one attachment's fields inside the entry doc; false when the entry
 *  or the attachment is gone (queue item should be dropped). On a successful
 *  upload `markUploader` adds the caller to entry.uploaderUids (SC-DRV12-01). */
async function setAttachmentState(
  item: QueuedUpload,
  patch: Partial<AttachmentDoc>,
  markUploader?: string,
): Promise<boolean> {
  const repos = getRepos();
  const entry = await repos.entries.get(item.vehicleId, item.entryId);
  if (!entry) return false;
  const atts = entry.attachments ?? [];
  const idx = atts.findIndex((a) => a.id === item.attachmentId);
  if (idx < 0) return false;
  const next = atts.map((a, i) => (i === idx ? { ...a, ...patch } : a));
  const uploaderUids = markUploader
    ? [...new Set([...(entry.uploaderUids ?? []), markUploader])]
    : undefined;
  await repos.entries.update(item.vehicleId, item.entryId, {
    attachments: next,
    ...(uploaderUids ? { uploaderUids } : {}),
  });
  return true;
}

function errorTag(e: unknown): QueuedUpload['lastError'] {
  if (e instanceof DriveError) {
    if (e.code === 'storage-full') return 'storage-full';
    if (e.code === 'network' || e.code === 'unavailable') return 'network';
    if (e.code === 'access-declined' || e.code === 'access-revoked' || e.code === 'account-mismatch') return 'access';
  }
  return 'unknown';
}

async function process(uid: string): Promise<void> {
  for (;;) {
    const list = await listUploads(uid);
    const head = list.find((i) => i.state === 'queued'); // FIFO: first queued
    if (!head) return;
    const now = Date.now();
    if (head.nextAt > now) {
      scheduleWake(uid, head.nextAt);
      return;
    }
    if (!adapter().isOnline() || !(await isDriveGranted(uid))) return; // wait

    // Entry/attachment gone → drop without a Drive call.
    const entry = await getRepos().entries.get(head.vehicleId, head.entryId);
    const att = entry?.attachments?.find((a) => a.id === head.attachmentId);
    if (!entry || !att) {
      await saveUploads(uid, list.filter((i) => i !== head));
      continue;
    }
    if (!(await localFiles().exists(head.uri))) {
      // Staged file lost (cache wipe): nothing left to upload.
      await setAttachmentState(head, { status: 'failed' });
      await saveUploads(uid, list.filter((i) => i !== head));
      continue;
    }

    await setAttachmentState(head, { status: 'uploading' });
    try {
      const vehicle = await getRepos().vehicles.get(head.vehicleId);
      const folderId = await withDrive(uid, () =>
        ensureVehicleReceiptFolder(uid, head.vehicleId, vehicle?.name ?? head.vehicleId, getRepos()),
      );
      const meta = await withDrive(uid, () =>
        drive().uploadMedia(
          { name: head.name, parentId: folderId, mimeType: head.mimeType },
          { uri: head.uri },
        ),
      );
      await setAttachmentState(head, { status: 'uploaded', driveFileId: meta.id }, uid);
      await localFiles().remove(head.uri); // staged copy no longer needed
      await saveUploads(uid, (await listUploads(uid)).filter((i) => i.attachmentId !== head.attachmentId));
    } catch (e) {
      const attempts = head.attempts + 1;
      const tag = errorTag(e);
      if (attempts >= MAX_ATTEMPTS) {
        await setAttachmentState(head, { status: 'failed' });
        await saveUploads(
          uid,
          (await listUploads(uid)).map((i) =>
            i.attachmentId === head.attachmentId ? { ...i, attempts, state: 'failed' as const, lastError: tag } : i,
          ),
        );
      } else {
        await setAttachmentState(head, { status: 'queued' });
        const nextAt = Date.now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
        await saveUploads(
          uid,
          (await listUploads(uid)).map((i) =>
            i.attachmentId === head.attachmentId ? { ...i, attempts, nextAt, lastError: tag } : i,
          ),
        );
        scheduleWake(uid, nextAt);
      }
      return; // stop on failure — later items retry at their own nextAt
    }
  }
}

/**
 * Start processing when items are due (app open, enqueue, connectivity).
 * Kicks are serialized: each waits for the previous pass then runs its own —
 * an awaited kick therefore always reflects at least one complete pass, and
 * concurrent enqueues/retries can never wedge the queue (one at a time).
 */
export function kickUploadQueue(uid: string): Promise<void> {
  chain = chain.then(() =>
    process(uid).catch(() => {
      // A non-Drive failure mid-loop must not wedge the queue; leave items
      // for the next kick.
    }),
  );
  return chain;
}

/** Test hook: clears the wake timer and the serialized kick chain. */
export function resetUploadQueueForTests(): void {
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
  chain = Promise.resolve();
}

/** AppState/connectivity driver — install once per session (session.ts). */
export function installUploadDriver(uid: string): Unsubscribe {
  const appSub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void kickUploadQueue(uid);
  });
  const netSub = adapter().onConnectivityChanged((online) => {
    if (online) void kickUploadQueue(uid);
  });
  void kickUploadQueue(uid);
  return () => {
    appSub.remove();
    netSub();
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
  };
}
