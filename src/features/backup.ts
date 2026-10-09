// Backup orchestration (DRV-07/08): build the readable JSON file, upload it
// to Drive's Milevana/Backups folder and record lastBackupAt/lastBackupFileId
// on the user doc. Automatic backups run on app open when the last one is
// older than the configured frequency (daily 24 h / weekly 7 d / monthly
// 30 d / off), only for linked accounts with the Drive grant, never on web
// (ED-14) — failures stay silent except for the "Last backup failed" state on
// the Backup & export screen. Automatic files carry property kind=automatic
// and are retained newest-10 (ED-03); failed deletions go to the pending
// queue (DRV-14).

import Constants from 'expo-constants';
import { adapter, getRepos } from './runtime';
import { drive, DriveFileMeta } from '../data/drive/client';
import { ensureDriveLayout } from '../data/drive/folders';
import {
  BACKUP_FILE_PREFIX,
  BackupDocument,
  BackupKind,
  backupFileName,
  buildBackupDocument,
} from '../data/drive/backupFile';
import type { EntryDoc } from '../data/schema/entry';
import type { ReminderDoc } from '../data/schema/reminder';
import type { ChecklistTemplateDoc } from '../data/schema/checklistTemplate';
import { nowTimestamp, tsToMillis } from '../data/schema/common';
import { localFlags } from '../data/localFlags';
import { isDriveGranted, withDrive } from './driveAccess';
import { queueDriveDelete } from './driveDeletes';

export const RETAIN_AUTOMATIC_BACKUPS = 10;
const FAILED_FLAG = 'backupFailed';

const STALE_MS: Record<'daily' | 'weekly' | 'monthly', number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function backupFailedFlag(uid: string): Promise<boolean> {
  return localFlags.getBool(uid, FAILED_FLAG);
}

async function setBackupFailed(uid: string, failed: boolean): Promise<void> {
  await localFlags.setBool(uid, FAILED_FLAG, failed);
}

// --- collect -----------------------------------------------------------------

/** Read every owned vehicle plus children and build the BackupDocument. */
export async function collectBackup(uid: string, kind: BackupKind): Promise<BackupDocument> {
  const repos = getRepos();
  const user = await repos.users.getUser(uid);
  if (!user) throw new Error('no user doc');
  const vehicles = await repos.vehicles.listOwned();
  const entriesByVehicle: Record<string, ({ id: string } & EntryDoc)[]> = {};
  const remindersByVehicle: Record<string, ({ id: string } & ReminderDoc)[]> = {};
  const templatesByVehicle: Record<string, ({ id: string } & ChecklistTemplateDoc)[]> = {};
  for (const v of vehicles) {
    entriesByVehicle[v.id] = (await repos.entries.list(v.id)).map(({ pending: _p, ...doc }) => doc);
    remindersByVehicle[v.id] = (await repos.reminders.list(v.id)).map(({ pending: _p, ...doc }) => doc);
    templatesByVehicle[v.id] = await repos.templates.list(v.id);
  }
  return buildBackupDocument({
    user,
    vehicles,
    entriesByVehicle,
    remindersByVehicle,
    templatesByVehicle,
    kind,
    appVersion: Constants.expoConfig?.version ?? '0',
  });
}

// --- write -------------------------------------------------------------------

/** Upload one backup file; records lastBackupAt/lastBackupFileId (DRV-07). */
export async function runBackup(uid: string, kind: BackupKind): Promise<DriveFileMeta> {
  try {
    const layout = await withDrive(uid, () => ensureDriveLayout(uid, getRepos()));
    const doc = await collectBackup(uid, kind);
    // Automatic files are marked kind=automatic so retention can tell them
    // apart; manual files get kind=manual for the same reason (ED-03).
    const meta = await withDrive(uid, () =>
      drive().uploadJson(backupFileName(new Date()), layout.backupsFolderId, doc, { kind }),
    );
    const repos = getRepos();
    const d = (await repos.users.getUser(uid))?.drive ?? { vehicleFolderIds: {} };
    await repos.users.setDrive(uid, { ...d, lastBackupAt: nowTimestamp(), lastBackupFileId: meta.id });
    await setBackupFailed(uid, false);
    if (kind === 'automatic') await enforceAutomaticRetention(uid, layout.backupsFolderId);
    return meta;
  } catch (e) {
    await setBackupFailed(uid, true);
    throw e;
  }
}

/** "Your backups" lists manual backups only (ED-13). */
export interface BackupListItem {
  fileId: string;
  name: string;
  createdTime?: string;
  kind: BackupKind;
}

function toItem(f: DriveFileMeta): BackupListItem {
  return {
    fileId: f.id,
    name: f.name,
    createdTime: f.createdTime,
    kind: f.properties?.kind === 'automatic' ? 'automatic' : 'manual',
  };
}

/** All backup files newest-first (restore list, latest preselected — DRV-09). */
export async function listBackups(uid: string): Promise<BackupListItem[]> {
  const layout = await withDrive(uid, () => ensureDriveLayout(uid, getRepos()));
  const files = await withDrive(uid, () => drive().listFiles(layout.backupsFolderId));
  return files
    .filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX))
    .map(toItem)
    .sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
}

export async function listManualBackups(uid: string): Promise<BackupListItem[]> {
  return (await listBackups(uid)).filter((b) => b.kind === 'manual');
}

/** Delete a manual backup file from Drive (ED-13 Delete action). */
export async function deleteBackup(uid: string, fileId: string): Promise<void> {
  await withDrive(uid, () => drive().deleteFile(fileId));
  const repos = getRepos();
  const d = (await repos.users.getUser(uid))?.drive;
  if (d?.lastBackupFileId === fileId) {
    await repos.users.setDrive(uid, { ...d, lastBackupFileId: undefined });
  }
}

// --- automatic (DRV-08) -------------------------------------------------------

export type AutoBackupResult =
  | 'ran'
  | 'failed'
  | 'skipped-web'
  | 'skipped-anonymous'
  | 'skipped-no-grant'
  | 'skipped-off'
  | 'skipped-fresh';

/**
 * Run an automatic backup on app open when stale (ED-03). Silent on failure —
 * only the Backup & export screen shows "Last backup failed. Retry".
 */
export async function maybeRunAutomaticBackup(uid: string): Promise<AutoBackupResult> {
  if (adapter().platform !== 'native') return 'skipped-web';
  const repos = getRepos();
  const user = adapter().currentUser();
  const userDoc = await repos.users.getUser(uid);
  if (!user || user.isAnonymous || !userDoc?.isLinked) return 'skipped-anonymous';
  const freq = userDoc.settings.backupFrequency;
  if (freq === 'off') return 'skipped-off';
  if (!(await isDriveGranted(uid))) return 'skipped-no-grant';
  const last = userDoc.drive?.lastBackupAt;
  if (last && Date.now() - tsToMillis(last) < STALE_MS[freq]) return 'skipped-fresh';
  try {
    await runBackup(uid, 'automatic');
    return 'ran';
  } catch {
    return 'failed'; // silent; the failed flag is already set (ED-03)
  }
}

/** Keep only the newest 10 automatic backups; queue failed deletes (DRV-14). */
async function enforceAutomaticRetention(uid: string, backupsFolderId: string): Promise<void> {
  const files = await withDrive(uid, () => drive().listFiles(backupsFolderId));
  const autos = files
    .filter((f) => f.name.startsWith(BACKUP_FILE_PREFIX) && f.properties?.kind === 'automatic')
    .sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''));
  for (const f of autos.slice(RETAIN_AUTOMATIC_BACKUPS)) {
    try {
      await withDrive(uid, () => drive().deleteFile(f.id));
    } catch {
      await queueDriveDelete(uid, f.id);
    }
  }
}
