// Pending Drive deletes (DRV-14 D1/D2): a per-uid local queue of Drive file
// ids that failed to delete. Each entry is retried once per run (app open,
// sign-in); after 5 failed attempts it is dropped — Drive files the app
// created are best-effort cleanup, never a blocker.

import { drive, DriveError } from '../data/drive/client';
import { localFlags } from '../data/localFlags';
import { isDriveGranted, withDrive } from './driveAccess';

const KEY = 'driveDeletes';
const MAX_ATTEMPTS = 5;

export interface PendingDriveDelete {
  fileId: string;
  attempts: number;
}

export function pendingDriveDeletes(uid: string): Promise<PendingDriveDelete[]> {
  return localFlags.getJson<PendingDriveDelete[]>(uid, KEY, []);
}

/** Queue a Drive file for later deletion (idempotent per fileId). */
export async function queueDriveDelete(uid: string, fileId: string): Promise<void> {
  const list = await pendingDriveDeletes(uid);
  if (list.some((p) => p.fileId === fileId)) return;
  await localFlags.setJson(uid, KEY, [...list, { fileId, attempts: 0 }]);
}

export async function removePendingDriveDelete(uid: string, fileId: string): Promise<void> {
  const list = await pendingDriveDeletes(uid);
  await localFlags.setJson(uid, KEY, list.filter((p) => p.fileId !== fileId));
}

/** Delete now; on failure queue for a later open. Never throws. */
export async function deleteDriveFileOrQueue(uid: string, fileId: string | undefined): Promise<void> {
  if (!fileId) return;
  if (!(await isDriveGranted(uid))) {
    await queueDriveDelete(uid, fileId);
    return;
  }
  try {
    await withDrive(uid, () => drive().deleteFile(fileId));
  } catch {
    await queueDriveDelete(uid, fileId);
  }
}

/**
 * Retry every pending delete once. Access failures abort the sweep without
 * consuming attempts (withDrive already cleared the grant flag); other
 * failures count toward the 5-attempt cap, then the entry is dropped.
 */
export async function runPendingDriveDeletes(uid: string): Promise<number> {
  if (!(await isDriveGranted(uid))) return 0;
  const list = await pendingDriveDeletes(uid);
  if (!list.length) return 0;
  const remaining: PendingDriveDelete[] = [];
  let done = 0;
  for (const p of list) {
    if (p.attempts >= MAX_ATTEMPTS) continue; // exhausted → drop
    try {
      await withDrive(uid, () => drive().deleteFile(p.fileId));
      done += 1;
    } catch (e) {
      if (e instanceof DriveError && (e.code === 'access-revoked' || e.code === 'access-declined')) {
        remaining.push(p, ...list.slice(list.indexOf(p) + 1));
        break;
      }
      const next = { fileId: p.fileId, attempts: p.attempts + 1 };
      if (next.attempts < MAX_ATTEMPTS) remaining.push(next);
    }
  }
  await localFlags.setJson(uid, KEY, remaining);
  return done;
}
