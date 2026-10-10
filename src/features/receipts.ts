// Receipt attach/remove/view orchestration (DRV-11/13). Picking yields a
// PendingReceipt held in form state: on Android the compressed/staged file is
// attached to the saved entry with status 'queued' and the upload queue takes
// over (offline-first, ED-08); on web the upload runs during the pick and the
// entry may only be saved once every pending receipt is 'uploaded' (ED-14).
// At most 5 attachments per entry (schema cap, ED-07).

import { Linking } from 'react-native';
import { adapter, getRepos } from './runtime';
import { drive, DriveError } from '../data/drive/client';
import { ensureVehicleReceiptFolder, receiptFileName } from '../data/drive/folders';
import { localFiles } from '../data/localFiles';
import { receiptPicker, ReceiptPickError } from '../data/receiptPick';
import type { AttachmentDoc, EntryDoc } from '../data/schema/entry';
import type { Timestamp } from '../data/schema/common';
import { MAX_ATTACHMENTS } from '../data/schema/common';
import { cancelUpload, enqueueUpload } from './uploadQueue';
import { deleteDriveFileOrQueue } from './driveDeletes';
import { withDrive } from './driveAccess';
import { receiptViewer } from './receiptView';
import { evictReceipt } from './receiptCache';

export { MAX_ATTACHMENTS };

export class ReceiptError extends Error {
  code: 'too-many' | 'pdf-too-large' | 'unavailable' | 'denied' | 'drive';
  constructor(code: ReceiptError['code'], detail?: string) {
    super(`receipt ${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'ReceiptError';
    this.code = code;
  }
}

/** A picked receipt held in entry-form state until the entry is saved. */
export interface PendingReceipt {
  id: string;
  mimeType: string;
  sizeBytes: number;
  status: 'queued' | 'uploaded' | 'failed';
  driveFileId?: string;
  /** Local preview (native staged uri / web object url). */
  previewUri?: string;
  /** Native staged file awaiting the upload queue. */
  uri?: string;
  /** Picked blob awaiting upload on web (ED-14 — upload runs at save). */
  blob?: Blob;
  /** Web object url to revoke when the pending receipt is dropped. */
  objectUrl?: string;
  /** CHK-07: inspection item tag — set on inspection attachments only (OQ-41). */
  itemId?: string;
}

const newAttachmentId = () => adapter().newDocId('receipts');

export function toAttachment(uid: string, p: PendingReceipt): AttachmentDoc {
  return {
    id: p.id,
    ownerUid: uid,
    mimeType: p.mimeType,
    sizeBytes: p.sizeBytes,
    status: p.status,
    ...(p.driveFileId ? { driveFileId: p.driveFileId } : {}),
    ...(p.itemId ? { itemId: p.itemId } : {}),
    sharedWithUids: [],
  };
}

/**
 * Pick and process one receipt into a PendingReceipt held in form state —
 * native stages a file, web keeps the blob (ED-14: the web upload runs when
 * the entry is saved so the Drive file name carries the real entry date).
 * Returns null on picker cancel; throws ReceiptError for the user-visible
 * failures (too many, pdf too large).
 */
export async function pickReceipt(opts: {
  source: 'camera' | 'gallery' | 'pdf' | 'media';
  existingCount: number;
}): Promise<PendingReceipt | null> {
  const { source, existingCount } = opts;
  if (existingCount >= MAX_ATTACHMENTS) throw new ReceiptError('too-many');

  const picked = await (async () => {
    try {
      if (source === 'camera' || source === 'gallery') return await receiptPicker().pickImage(source);
      if (source === 'pdf') return await receiptPicker().pickPdf();
      return (await receiptPicker().pickFile?.('media')) ?? null;
    } catch (e) {
      if (e instanceof ReceiptPickError) {
        throw new ReceiptError(
          e.code === 'pdf-too-large' ? 'pdf-too-large' : e.code === 'denied' ? 'denied' : 'unavailable',
          e.message,
        );
      }
      throw e;
    }
  })();
  if (!picked) return null;

  const id = newAttachmentId();
  if ('uri' in picked) {
    // Native: staged file; the upload queue persists+uploads it (offline OK).
    return {
      id,
      mimeType: picked.mimeType,
      sizeBytes: picked.sizeBytes,
      status: 'queued',
      uri: picked.uri,
      previewUri: picked.uri,
    };
  }
  let objectUrl: string | undefined;
  try {
    objectUrl = URL.createObjectURL(picked.blob);
  } catch {
    objectUrl = undefined;
  }
  // Web: blob held until save — uploadPending uploads it then (ED-14).
  return {
    id,
    mimeType: picked.mimeType,
    sizeBytes: picked.sizeBytes,
    status: 'queued',
    blob: picked.blob,
    objectUrl,
    previewUri: objectUrl,
  };
}

/**
 * Web save path (ED-14): upload one pending receipt to Drive. Called for each
 * blob pending before the entry is saved; a failure throws so the save is
 * blocked — the caller marks the pending 'failed' so the user can retry or
 * remove it.
 */
export async function uploadPending(
  uid: string,
  vehicleId: string,
  vehicleName: string,
  entryDate: Timestamp,
  entryType: string,
  p: PendingReceipt,
): Promise<PendingReceipt> {
  if (!p.blob || p.driveFileId) return p;
  const folderId = await withDrive(uid, () =>
    ensureVehicleReceiptFolder(uid, vehicleId, vehicleName, getRepos()),
  );
  const name = receiptFileName(entryDate, entryType, p.id, p.mimeType);
  const blob = p.blob;
  const meta = await withDrive(uid, () =>
    drive().uploadMedia(
      { name, parentId: folderId, mimeType: p.mimeType },
      { blob },
    ),
  );
  return { ...p, status: 'uploaded', driveFileId: meta.id };
}

/**
 * After the entry is saved on native: queue each staged receipt for upload
 * (DRV-12). Web pendings are already uploaded — a no-op for them.
 */
export async function enqueuePendingReceipts(
  uid: string,
  vehicleId: string,
  entryId: string,
  entryDate: Timestamp,
  entryType: string,
  pendings: PendingReceipt[],
): Promise<void> {
  for (const p of pendings) {
    if (!p.uri || p.status === 'uploaded') continue;
    await enqueueUpload(uid, {
      vehicleId,
      entryId,
      attachmentId: p.id,
      uri: p.uri,
      name: receiptFileName(entryDate, entryType, p.id, p.mimeType),
      mimeType: p.mimeType,
    });
  }
}

/** Drop a picked-but-unsaved receipt (staged file / web object url). */
export async function discardPending(uid: string, p: PendingReceipt): Promise<void> {
  if (p.uri) await localFiles().remove(p.uri).catch(() => undefined);
  if (p.objectUrl) {
    try {
      URL.revokeObjectURL(p.objectUrl);
    } catch {
      // gone
    }
  }
  if (p.driveFileId) await deleteDriveFileOrQueue(uid, p.driveFileId);
}

/**
 * Remove an attachment from an entry and delete its Drive file (DRV-14 #1).
 * The Drive delete never blocks the entry update — failures go to the
 * pending-delete queue.
 */
export async function removeAttachment(
  uid: string,
  vehicleId: string,
  entryId: string,
  attachmentId: string,
): Promise<void> {
  const repos = getRepos();
  const entry = await repos.entries.get(vehicleId, entryId);
  if (!entry) return;
  const att = (entry.attachments ?? []).find((a) => a.id === attachmentId);
  const rest = (entry.attachments ?? []).filter((a) => a.id !== attachmentId);
  await repos.entries.update(vehicleId, entryId, { attachments: rest });
  if (att) {
    await cancelUpload(uid, attachmentId);
    await evictReceipt(att.id).catch(() => undefined);
    await deleteDriveFileOrQueue(uid, att.driveFileId);
  }
}

/**
 * A renderable source for an uploaded attachment. Drive 'not-found' marks the
 * attachment 'missing' on the entry — "File no longer in Drive" (ED-10/DRV-13).
 */
export async function receiptSource(
  uid: string,
  vehicleId: string,
  entry: EntryDoc & { id?: string },
  att: AttachmentDoc,
): Promise<{ uri: string; headers?: Record<string, string> } | null> {
  if (att.status !== 'uploaded' || !att.driveFileId) return null;
  try {
    return await withDrive(uid, () => receiptViewer().source(att));
  } catch (e) {
    if (e instanceof DriveError && e.code === 'not-found') {
      await markMissing(vehicleId, entry, att.id);
      return null;
    }
    throw e;
  }
}

/** Open a receipt in the system viewer (PDFs) — same missing handling. */
export async function openReceipt(
  uid: string,
  vehicleId: string,
  entry: EntryDoc & { id?: string },
  att: AttachmentDoc,
): Promise<'opened' | 'missing' | 'not-uploaded'> {
  if (att.status !== 'uploaded' || !att.driveFileId) return 'not-uploaded';
  try {
    await withDrive(uid, () => receiptViewer().open(att));
    return 'opened';
  } catch (e) {
    if (e instanceof DriveError && e.code === 'not-found') {
      await markMissing(vehicleId, entry, att.id);
      return 'missing';
    }
    throw e;
  }
}

async function markMissing(vehicleId: string, entry: EntryDoc & { id?: string }, attId: string): Promise<void> {
  if (!entry.id) return;
  const atts = (entry.attachments ?? []).map((a) => (a.id === attId ? { ...a, status: 'missing' as const } : a));
  await getRepos()
    .entries.update(vehicleId, entry.id, { attachments: atts })
    .catch(() => undefined);
}

// --- other members' receipts (SHR-15, SD-09) ---------------------------------

/**
 * How the caller relates to an attachment (SHR-15). Under `drive.file` the
 * app can only open files it created, so another member's uploaded receipt
 * never renders in-app: 'openable' → "Open in Drive", 'pending' → "Shared
 * once <name> opens the app", 'gone' → "No longer available" (the uploader
 * left and the caller never had access).
 */
export type MemberReceiptState = 'own' | 'openable' | 'pending' | 'gone';

export function memberReceiptState(
  att: AttachmentDoc,
  uid: string,
  vehicle: { memberIds: string[] },
): MemberReceiptState {
  if (att.ownerUid === uid) return 'own';
  if (att.sharedWithUids.includes(uid)) {
    return att.status === 'uploaded' && att.driveFileId ? 'openable' : 'gone';
  }
  if (!vehicle.memberIds.includes(att.ownerUid)) return 'gone';
  return 'pending';
}

/** The Drive web view for a shared file — Drive grants the access. */
export function driveViewUrl(att: AttachmentDoc): string | null {
  return att.driveFileId ? `https://drive.google.com/file/d/${att.driveFileId}/view` : null;
}

/**
 * "Open in Drive" for a receipt another member shared with the caller — the
 * system browser / Drive app handles auth. Web opens a new tab (SD-11).
 * Resolves false when the link cannot be opened.
 */
export async function openInDrive(att: AttachmentDoc): Promise<boolean> {
  const url = driveViewUrl(att);
  if (!url) return false;
  try {
    // Linking.openURL resolves to window.open on web (SD-11).
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
