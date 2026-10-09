// Drive folder layout (DRV-05): a single "Milevana" root with Backups/ and
// Receipts/, plus one Receipts/<vehicle name>/ folder per vehicle. Folder ids
// live in users/{uid}.drive so a vehicle rename never moves a folder and two
// same-name vehicles stay distinct (OQ-50, OQ-54). Stale ids are recovered by
// name lookup before creating anything (no duplicates on two devices).

import { DRIVE_FOLDER_MIME, drive } from './client';
import type { Repos } from '../repos';
import type { DriveDoc } from '../schema/user';
import type { Timestamp } from '../schema/common';

export const DRIVE_ROOT_NAME = 'Milevana';
export const BACKUPS_FOLDER = 'Backups';
export const RECEIPTS_FOLDER = 'Receipts';

export interface DriveLayout {
  rootFolderId: string;
  backupsFolderId: string;
  receiptsFolderId: string;
}

async function folderOk(id: string | undefined): Promise<boolean> {
  if (!id) return false;
  const meta = await drive().getFile(id);
  return !!meta && !meta.trashed && meta.mimeType === DRIVE_FOLDER_MIME;
}

/** Stored id → still-resolving folder; else find-or-create by name. */
async function resolveFolder(
  storedId: string | undefined,
  name: string,
  parentId?: string,
): Promise<string> {
  if (await folderOk(storedId)) return storedId!;
  return drive().ensureFolder(name, parentId);
}

/**
 * Create-or-reuse the root layout and persist the ids (DRV-05 #1, #4).
 * Reads the user doc fresh so a second device's ids are merged, not clobbered.
 */
export async function ensureDriveLayout(uid: string, repos: Repos): Promise<DriveLayout> {
  const d = (await repos.users.getUser(uid))?.drive ?? { vehicleFolderIds: {} };
  const rootFolderId = await resolveFolder(d.rootFolderId, DRIVE_ROOT_NAME);
  const backupsFolderId = await resolveFolder(d.backupsFolderId, BACKUPS_FOLDER, rootFolderId);
  const receiptsFolderId = await resolveFolder(d.receiptsFolderId, RECEIPTS_FOLDER, rootFolderId);
  if (
    rootFolderId !== d.rootFolderId ||
    backupsFolderId !== d.backupsFolderId ||
    receiptsFolderId !== d.receiptsFolderId
  ) {
    const next: DriveDoc = { ...d, rootFolderId, backupsFolderId, receiptsFolderId };
    await repos.users.setDrive(uid, next);
  }
  return { rootFolderId, backupsFolderId, receiptsFolderId };
}

/**
 * The vehicle's receipt folder (DRV-05 #2/#3): created on first receipt,
 * looked up by vehicle id afterwards — a rename neither moves nor recreates
 * it, and same-name vehicles keep separate folders by id.
 */
export async function ensureVehicleReceiptFolder(
  uid: string,
  vehicleId: string,
  vehicleName: string,
  repos: Repos,
): Promise<string> {
  const layout = await ensureDriveLayout(uid, repos);
  const d = (await repos.users.getUser(uid))?.drive ?? { vehicleFolderIds: {} };
  const stored = d.vehicleFolderIds[vehicleId];
  let folderId: string;
  if (await folderOk(stored)) {
    folderId = stored!;
  } else {
    // Recover by name only when the found folder isn't already claimed by a
    // different vehicle — two same-name vehicles get separate folders
    // (SC-DRV05-02), which is legal in Drive.
    const claimed = new Set(
      Object.entries(d.vehicleFolderIds)
        .filter(([vid]) => vid !== vehicleId)
        .map(([, fid]) => fid),
    );
    const name = vehicleName || vehicleId;
    const found = await drive().findFolder(name, layout.receiptsFolderId);
    folderId =
      found && !claimed.has(found.id)
        ? found.id
        : (await drive().createFolder(name, layout.receiptsFolderId)).id;
  }
  if (folderId !== stored) {
    await repos.users.setDrive(uid, {
      ...d,
      vehicleFolderIds: { ...d.vehicleFolderIds, [vehicleId]: folderId },
    });
  }
  return folderId;
}

/** ED-07 Drive name: `<entry date YYYY-MM-DD>_<entry type>_<attachment id>.<ext>`. */
export function receiptFileName(entryDate: Timestamp, entryType: string, attachmentId: string, mimeType: string): string {
  const d = new Date(entryDate.seconds * 1000 + entryDate.nanoseconds / 1e6); // local components
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  return `${date}_${entryType}_${attachmentId}.${ext}`;
}
