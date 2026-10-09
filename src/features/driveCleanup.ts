// Drive cleanup on delete (DRV-14): removing an attachment or an entry also
// removes its Drive file, and deleting a vehicle removes its receipt folder.
// Drive work never blocks Firestore deletion — failures land in the pending
// queue and retry on later opens (≤5 attempts, then dropped). Deletes are
// permanent (files.delete, not trash). Only the caller's own Drive files are
// touched — other members' receipts live in their own Drive (SC-DRV14-03).

import { drive } from '../data/drive/client';
import { getRepos } from './runtime';
import type { AttachmentDoc, EntryDoc } from '../data/schema/entry';
import { localFiles } from '../data/localFiles';
import { isDriveGranted, withDrive } from './driveAccess';
import { cancelEntryUploads, cancelVehicleUploads, listUploads } from './uploadQueue';
import { deleteDriveFileOrQueue } from './driveDeletes';
import { clearReceiptCache, evictReceipt } from './receiptCache';

/**
 * The undo window has closed and the entry document is being deleted — delete
 * every uploaded Drive file and cancel any queued uploads (SC-DRV14-01). Any
 * Drive failure queues a retry; the Firestore delete proceeds regardless.
 */
export async function cleanupEntryAttachments(
  uid: string,
  entry: EntryDoc & { id: string },
): Promise<void> {
  await cancelEntryUploads(uid, entry.id);
  for (const att of entry.attachments ?? []) {
    await cleanupOneAttachment(uid, att);
  }
}

/** Attachment removed from an entry (or its entry deleted): Drive + cache. */
export async function cleanupOneAttachment(uid: string, att: AttachmentDoc): Promise<void> {
  await evictReceipt(att.id).catch(() => undefined);
  await deleteDriveFileOrQueue(uid, att.driveFileId);
}

/**
 * Vehicle delete (DRV-14 #3): remove every receipt file in the vehicle's
 * Drive folder, then the folder, before the Firestore subtree goes. Staged
 * uploads are dropped from the queue; their local files are deleted. Never
 * throws — Drive cleanup failure must not block the Firestore delete.
 */
export async function cleanupVehicleReceipts(uid: string, vehicleId: string): Promise<void> {
  try {
    await cancelVehicleUploadsAndFiles(uid, vehicleId);

    const repos = getRepos();
    const userDoc = await repos.users.getUser(uid);
    const folderId = userDoc?.drive?.vehicleFolderIds[vehicleId];
    if (folderId && (await isDriveGranted(uid))) {
      try {
        await withDrive(uid, async () => {
          const files = await drive().listFiles(folderId);
          for (const f of files) await drive().deleteFile(f.id);
          await drive().deleteFile(folderId);
        });
      } catch {
        // Folder-level listing failed — queue the folder for a later sweep.
        await deleteDriveFileOrQueue(uid, folderId).catch(() => undefined);
      }
    } else if (folderId) {
      await deleteDriveFileOrQueue(uid, folderId);
    }

    // Forget the folder mapping regardless — the vehicle is going away.
    const d = userDoc?.drive;
    if (d?.vehicleFolderIds[vehicleId]) {
      const vehicleFolderIds = { ...d.vehicleFolderIds };
      delete vehicleFolderIds[vehicleId];
      await repos.users.setDrive(uid, { ...d, vehicleFolderIds }).catch(() => undefined);
    }
  } catch {
    // DRV-14: Drive cleanup must never block the Firestore delete.
  }
}

async function cancelVehicleUploadsAndFiles(uid: string, vehicleId: string): Promise<void> {
  const items = (await listUploads(uid)).filter((i) => i.vehicleId === vehicleId);
  for (const i of items) await localFiles().remove(i.uri).catch(() => undefined);
  if (items.length) await cancelVehicleUploads(uid, vehicleId);
}

/**
 * Sign-out teardown (FR-OUT-05 / SC-DRV13-03): revoke the Drive session,
 * empty the receipt cache and drop temp files. Device-local flags (queue,
 * granted flag, pending deletes) are wiped by localFlags.clearFor — Drive
 * work here is best-effort and never throws.
 */
export async function clearDriveSession(): Promise<void> {
  try {
    await drive().resetSession();
  } catch {
    // no Drive client (tests) or not configured — nothing to reset
  }
  try {
    await clearReceiptCache();
  } catch {
    // cache clear is best-effort
  }
  try {
    await localFiles().clearTemp();
  } catch {
    // no local files impl (tests)
  }
}
