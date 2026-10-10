// Receipt share sync (SHR-14, SD-08, OQ-56). On every app open and return to
// the foreground, for each shared vehicle the caller belongs to, the phone:
//  - finds entries with the caller in uploaderUids,
//  - grants reader access (no notification email) on its uploaded receipts to
//    every current member with an email,
//  - revokes reader grants whose email is no longer a member (the permission
//    list is the revocation source, per OQ-56),
//  - records the result in attachments[].sharedWithUids — only when the
//    caller is the entry creator or the vehicle owner; otherwise Drive
//    access still changes and one non-fatal is logged (L15).
//
// Limits: at most once per 15 minutes per vehicle (persisted, so a restart
// does not reset it) and at most 200 receipts per run — the rest next run.
// Web never runs the sync (SD-11); Drive failures retry on the next run.

import { AppState } from 'react-native';
import type { Unsubscribe } from '../data/adapter';
import { RepoError } from '../data/adapter';
import { drive } from '../data/drive/client';
import { localFlags } from '../data/localFlags';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import { isDriveGranted } from './driveAccess';
import { useAppStore } from './appStore';
import { adapter, getRepos } from './runtime';
import { reportNonFatal } from './reporting';

export const SHARE_SYNC_INTERVAL_MS = 15 * 60 * 1000;
export const SHARE_SYNC_MAX_RECEIPTS = 200;

const LAST_RUN_KEY = 'shareSyncAt';
const lastRunAt = new Map<string, number>();
let lastRunLoaded = false;
let running = false;

/** Install once per session (native only — SD-11). Returns the unsubscribe. */
export function installReceiptShareSync(uid: string): Unsubscribe {
  if (adapter().platform !== 'native') return () => undefined;
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') void runShareSync(uid);
  });
  void runShareSync(uid);
  return () => sub.remove();
}

/** Test hook: forget the in-memory throttle mirror. */
export function resetShareSyncForTests(): void {
  lastRunAt.clear();
  lastRunLoaded = false;
  running = false;
}

async function loadLastRun(uid: string): Promise<void> {
  if (lastRunLoaded) return;
  lastRunLoaded = true;
  const stored = await localFlags.getJson<Record<string, number>>(uid, LAST_RUN_KEY, {});
  for (const [vid, ts] of Object.entries(stored)) lastRunAt.set(vid, ts);
}

async function markRun(uid: string, vehicleId: string): Promise<void> {
  lastRunAt.set(vehicleId, Date.now());
  const stored: Record<string, number> = {};
  for (const [vid, ts] of lastRunAt) stored[vid] = ts;
  await localFlags.setJson(uid, LAST_RUN_KEY, stored).catch(() => undefined);
}

/**
 * One trigger (app open / foreground). Skips quietly when the caller is
 * anonymous, offline, has no Drive grant on this device, or a run is in
 * flight — the share sync never blocks anything (SD-08 edge cases).
 */
export async function runShareSync(uid: string): Promise<void> {
  if (adapter().platform !== 'native' || running) return;
  const st = useAppStore.getState();
  if (st.user?.uid !== uid || st.user.isAnonymous || !st.online) return;
  if (!(await isDriveGranted(uid))) return;
  running = true;
  useAppStore.setState({ shareSyncRunning: true });
  try {
    await loadLastRun(uid);
    const now = Date.now();
    for (const v of useAppStore.getState().vehicles) {
      if (v.memberIds.length < 2) continue; // not shared — nothing to do
      if (now - (lastRunAt.get(v.id) ?? 0) < SHARE_SYNC_INTERVAL_MS) continue;
      await markRun(uid, v.id); // consume the slot even on failure (bounded retry)
      try {
        await syncVehicleReceipts(uid, v);
      } catch (e) {
        // A Drive or Firestore failure retries on the next run (SD-08).
        reportNonFatal(e, { stage: 'receipt-share', id: v.id });
      }
    }
  } finally {
    running = false;
    useAppStore.setState({ shareSyncRunning: false });
  }
}

async function syncVehicleReceipts(uid: string, vehicle: VehicleRecord): Promise<void> {
  const repos = getRepos();
  const entries = await repos.entries.listUploadedBy(vehicle.id, uid);
  if (entries.length === 0) return;

  // Desired sharers: every current member except the uploader, emails only
  // (SD-08: members with no email are skipped).
  const shareable = new Map<string, string>(); // memberUid → email
  for (const muid of vehicle.memberIds) {
    if (muid === uid) continue;
    const email = vehicle.members[muid]?.email;
    if (email) shareable.set(muid, email);
  }
  const wantEmails = new Set([...shareable.values()].map((e) => e.toLowerCase()));

  let receipts = 0;
  let loggedShareWriteGap = false;

  for (const entry of entries) {
    const mine = entry.attachments.filter(
      (a) => a.ownerUid === uid && a.status === 'uploaded' && a.driveFileId,
    );
    if (mine.length === 0) continue;
    // Only the entry creator or the vehicle owner may write sharedWithUids.
    const mayWrite = entry.createdBy === uid || vehicle.ownerId === uid;
    const next = entry.attachments.map((a) => ({ ...a }));
    let changed = false;

    for (const att of mine) {
      if (receipts >= SHARE_SYNC_MAX_RECEIPTS) return; // the rest next run
      receipts++;
      const fileId = att.driveFileId!;
      const perms = await drive().listPermissions(fileId);
      const readerByEmail = new Map<string, string>();
      for (const p of perms) {
        if (p.type === 'user' && p.role === 'reader' && p.emailAddress) {
          readerByEmail.set(p.emailAddress.toLowerCase(), p.id);
        }
      }
      let touched = false;
      for (const email of shareable.values()) {
        if (!readerByEmail.has(email.toLowerCase())) {
          await drive().addReaderPermission(fileId, email);
          touched = true;
        }
      }
      for (const [email, pid] of readerByEmail) {
        if (!wantEmails.has(email)) {
          await drive().removePermission(fileId, pid);
          touched = true;
        }
      }
      if (mayWrite) {
        const idx = next.findIndex((a) => a.id === att.id);
        const shared = [...shareable.keys()];
        const cur = [...next[idx].sharedWithUids].sort();
        if (JSON.stringify(cur) !== JSON.stringify([...shared].sort())) {
          next[idx].sharedWithUids = shared;
          changed = true;
        }
      } else if (touched && !loggedShareWriteGap) {
        // L15: Drive access was applied but sharedWithUids cannot be
        // updated — members keep their last recorded view. One report.
        loggedShareWriteGap = true;
        reportNonFatal(new RepoError('permission-denied', 'share-write-gap'), {
          stage: 'receipt-share', id: entry.id,
        });
      }
    }

    if (changed) {
      await repos.entries.update(vehicle.id, entry.id, { attachments: next });
    }
  }
}
