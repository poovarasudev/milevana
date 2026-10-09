// Restore review and execution (DRV-09/10). Review compares a backup against
// the vehicles the caller currently owns, by document id: missing vehicles are
// always restored; owned vehicles that differ — vehicle fields, member set, a
// child id set, or any child's updatedAt — get one keep/replace question per
// vehicle; identical vehicles are skipped; vehicles whose ownerId is not the
// caller are reported "not yours" and never touched (ED-06).
//
// Execution writes whole documents with deterministic ids in ≤500-op batches,
// vehicle doc first so rules can validate children against it, then recomputes
// lastOdometer (entryRepo.resyncOdometer). Re-running a cancelled or failed
// restore is safe — set-writes are idempotent.
//
// Rules-shaped writes (firestore.rules) force two adjustments, recorded in
// docs/implementation-status.md:
//  - a missing vehicle can only be re-created with the caller as sole member,
//    so a formerly shared vehicle comes back with owner-only membership;
//  - a child created by another member is written with createdBy=uid but
//    keeps its createdByName so "logged by" stays truthful. On update,
//    createdBy/createdByName/createdAt are kept from the current document.

import { adapter, getRepos } from './runtime';
import { drive } from '../data/drive/client';
import {
  BackupDocument,
  BackupDocJson,
  BackupVehicleJson,
  docFromJson,
  docToJson,
  readBackupFile,
} from '../data/drive/backupFile';
import { entryDocSchema } from '../data/schema/entry';
import { reminderDocSchema } from '../data/schema/reminder';
import { checklistTemplateDocSchema } from '../data/schema/checklistTemplate';
import { vehicleDocSchema, type Member, type VehicleDoc } from '../data/schema/vehicle';
import type { SettingsDoc } from '../data/schema/user';
import type { Timestamp } from '../data/schema/common';
import { tsToMillis } from '../data/schema/common';
import type { WriteOp } from '../data/serializer';
import type { Repos } from '../data/repos';
import { withDrive } from './driveAccess';

// Restore only ever writes whole documents (set), so the plan reuses the
// serializer's WriteOp shape {path, data}.

const BATCH_LIMIT = 500; // Firestore hard cap (OQ-35)

// --- deep compare ------------------------------------------------------------

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

const sameJson = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

// --- review (DRV-09) -----------------------------------------------------------

export type RestoreVehicleStatus = 'missing' | 'same' | 'differs' | 'not-yours';

export interface RestoreVehicleReview {
  vehicleId: string;
  name: string;
  status: RestoreVehicleStatus;
}

export interface RestoreReview {
  fileId: string;
  backup: BackupDocument;
  vehicles: RestoreVehicleReview[];
  /** Present when the backup carries a settings block. */
  settingsAvailable: boolean;
}

interface ChildSet {
  ids: Set<string>;
  /** id → updatedAt millis for change detection (ED-06). */
  updatedAt: Map<string, number>;
}

function childSet(docs: { id: string; updatedAt: Timestamp }[]): ChildSet {
  return {
    ids: new Set(docs.map((d) => d.id)),
    updatedAt: new Map(docs.map((d) => [d.id, tsToMillis(d.updatedAt)])),
  };
}

function backupChildSet(items: { id: string; doc: BackupDocJson }[]): ChildSet {
  const updatedAt = new Map<string, number>();
  for (const i of items) {
    const at = i.doc.updatedAt as { seconds?: number; nanoseconds?: number } | undefined;
    if (at && typeof at.seconds === 'number') {
      updatedAt.set(i.id, at.seconds * 1000 + Math.floor((at.nanoseconds ?? 0) / 1e6));
    }
  }
  return { ids: new Set(items.map((i) => i.id)), updatedAt };
}

function childrenDiffer(cur: ChildSet, bak: ChildSet): boolean {
  if (cur.ids.size !== bak.ids.size) return true;
  for (const id of bak.ids) {
    if (!cur.ids.has(id)) return true;
    const bakAt = bak.updatedAt.get(id);
    if (bakAt !== undefined && cur.updatedAt.get(id) !== bakAt) return true;
  }
  for (const id of cur.ids) if (!bak.ids.has(id)) return true;
  return false;
}

interface CurrentVehicle {
  doc: VehicleDoc;
  entries: ChildSet;
  reminders: ChildSet;
  templates: ChildSet;
}

/** Compare a backup vehicle with the current owned copy (ED-06). */
function vehicleDiffers(bv: BackupVehicleJson, cur: CurrentVehicle): boolean {
  const { members: _m, ...curFields } = cur.doc;
  if (!sameJson(bv.doc, docToJson(curFields as Record<string, unknown>))) return true;
  const curMembers = Object.entries(cur.doc.members)
    .map(([uid, m]) => ({ uid, ...(m.name ? { name: m.name } : {}), role: m.role }))
    .sort((a, b) => a.uid.localeCompare(b.uid));
  const bakMembers = [...bv.members].sort((a, b) => a.uid.localeCompare(b.uid));
  if (!sameJson(curMembers, bakMembers)) return true;
  return (
    childrenDiffer(cur.entries, backupChildSet(bv.entries)) ||
    childrenDiffer(cur.reminders, backupChildSet(bv.reminders)) ||
    childrenDiffer(cur.templates, backupChildSet(bv.checklistTemplates))
  );
}

/**
 * Download and review a backup: status per vehicle, settings availability.
 * Throws BackupFileError when the file isn't a usable backup (ED-05).
 */
export async function reviewBackup(uid: string, fileId: string, repos: Repos = getRepos()): Promise<RestoreReview> {
  const text = await withDrive(uid, () => drive().downloadText(fileId));
  const backup = readBackupFile(text);
  const owned = new Map((await repos.vehicles.listOwned()).map((v) => [v.id, v]));
  const vehicles: RestoreVehicleReview[] = [];
  for (const bv of backup.vehicles) {
    const name = typeof bv.doc.name === 'string' ? bv.doc.name : bv.id;
    if (bv.doc.ownerId !== uid) {
      vehicles.push({ vehicleId: bv.id, name, status: 'not-yours' });
      continue;
    }
    const cur = owned.get(bv.id);
    if (!cur) {
      vehicles.push({ vehicleId: bv.id, name, status: 'missing' });
      continue;
    }
    const { pending: _p, id: _id, ...doc } = cur;
    const current: CurrentVehicle = {
      doc,
      entries: childSet(await repos.entries.list(bv.id)),
      reminders: childSet(await repos.reminders.list(bv.id)),
      templates: childSet(await repos.templates.list(bv.id)),
    };
    vehicles.push({ vehicleId: bv.id, name, status: vehicleDiffers(bv, current) ? 'differs' : 'same' });
  }
  return { fileId, backup, vehicles, settingsAvailable: backup.settings != null };
}

// --- plan ---------------------------------------------------------------------

export interface RestoreChoices {
  /** vehicle ids the user chose to replace (only 'differs' vehicles). */
  replaceVehicleIds: string[];
  restoreSettings: boolean;
}

export interface RestorePlan {
  ops: WriteOp[];
  /** vehicles written by this plan — each gets an odometer resync. */
  touchedVehicles: string[];
  skippedNotYours: number;
  skippedKept: number;
  skippedSame: number;
  /** docs that failed schema validation and were not planned. */
  invalidDocs: number;
  settingsPatch: Partial<SettingsDoc> | null;
}

function memberRecord(m: { role: string; name?: string }, joinedAt: Timestamp): Member {
  return { role: m.role as Member['role'], ...(m.name ? { name: m.name } : {}), joinedAt };
}

/** Vehicle doc for a create: sole-owner membership (rules shape). */
function vehicleDocForCreate(bv: BackupVehicleJson, uid: string): Record<string, unknown> | null {
  const doc = docFromJson(bv.doc);
  const createdAt = (doc.createdAt as Timestamp) ?? { seconds: 0, nanoseconds: 0 };
  const owner = bv.members.find((m) => m.uid === uid) ?? bv.members.find((m) => m.role === 'owner');
  const full = {
    ...doc,
    ownerId: uid,
    memberIds: [uid],
    members: { [uid]: memberRecord({ role: 'owner', name: owner?.name }, createdAt) },
  };
  return vehicleDocSchema.safeParse(full).success ? full : null;
}

/** Vehicle doc for a replace: fields from backup, membership stays current. */
function vehicleDocForUpdate(bv: BackupVehicleJson, cur: VehicleDoc): Record<string, unknown> | null {
  const doc = docFromJson(bv.doc);
  const full = { ...doc, ownerId: cur.ownerId, memberIds: cur.memberIds, members: cur.members };
  return vehicleDocSchema.safeParse(full).success ? full : null;
}

interface ChildSpec {
  collection: string;
  items: { id: string; doc: BackupDocJson }[];
  schema: { safeParse(v: unknown): { success: boolean } };
  /** current docs by id — to keep createdBy/createdByName/createdAt. */
  current: Map<string, Record<string, unknown>>;
}

function childOps(spec: ChildSpec, uid: string): { ops: WriteOp[]; invalid: number } {
  const ops: WriteOp[] = [];
  let invalid = 0;
  for (const item of spec.items) {
    const doc = docFromJson(item.doc);
    const cur = spec.current.get(item.id);
    const shaped = cur
      ? { ...doc, createdBy: cur.createdBy, createdByName: cur.createdByName, createdAt: cur.createdAt, updatedBy: uid }
      : { ...doc, createdBy: uid, updatedBy: uid };
    if (!spec.schema.safeParse(shaped).success) {
      invalid += 1;
      continue;
    }
    ops.push({ path: `${spec.collection}/${item.id}`, data: shaped as Record<string, unknown> });
  }
  return { ops, invalid };
}

/**
 * Build the restore write plan for a reviewed backup (DRV-10). `current` maps
 * hold the live docs for keep/replace shaping.
 */
export async function planRestore(
  uid: string,
  review: RestoreReview,
  choices: RestoreChoices,
  repos: Repos = getRepos(),
): Promise<RestorePlan> {
  const replace = new Set(choices.replaceVehicleIds);
  const ops: WriteOp[] = [];
  const touchedVehicles: string[] = [];
  let skippedNotYours = 0;
  let skippedKept = 0;
  let skippedSame = 0;
  let invalidDocs = 0;

  const owned = new Map((await repos.vehicles.listOwned()).map((v) => [v.id, v]));

  for (const rv of review.vehicles) {
    const bv = review.backup.vehicles.find((v) => v.id === rv.vehicleId)!;
    if (rv.status === 'not-yours') {
      skippedNotYours += 1;
      continue;
    }
    if (rv.status === 'same') {
      skippedSame += 1;
      continue;
    }
    if (rv.status === 'differs' && !replace.has(rv.vehicleId)) {
      skippedKept += 1;
      continue;
    }
    const curRec = owned.get(rv.vehicleId);
    const vehicleDoc = curRec
      ? vehicleDocForUpdate(bv, (({ pending: _p, id: _i, ...d }) => d)(curRec))
      : vehicleDocForCreate(bv, uid);
    if (!vehicleDoc) {
      invalidDocs += 1 + bv.entries.length + bv.reminders.length + bv.checklistTemplates.length;
      continue;
    }
    ops.push({ path: `vehicles/${rv.vehicleId}`, data: vehicleDoc });
    touchedVehicles.push(rv.vehicleId);

    const toMap = <T extends { id: string }>(list: T[]): [string, Record<string, unknown>][] =>
      list.map((rec) => {
        const { pending: _p, ...d } = rec as T & { pending?: boolean };
        return [d.id, d as unknown as Record<string, unknown>];
      });
    const curEntries = new Map<string, Record<string, unknown>>(
      curRec ? toMap(await repos.entries.list(rv.vehicleId)) : [],
    );
    const curReminders = new Map<string, Record<string, unknown>>(
      curRec ? toMap(await repos.reminders.list(rv.vehicleId)) : [],
    );
    const curTemplates = new Map<string, Record<string, unknown>>(
      curRec ? toMap(await repos.templates.list(rv.vehicleId)) : [],
    );
    const base = `vehicles/${rv.vehicleId}`;
    for (const spec of [
      { collection: `${base}/entries`, items: bv.entries, schema: entryDocSchema, current: curEntries },
      { collection: `${base}/reminders`, items: bv.reminders, schema: reminderDocSchema, current: curReminders },
      { collection: `${base}/checklistTemplates`, items: bv.checklistTemplates, schema: checklistTemplateDocSchema, current: curTemplates },
    ] as ChildSpec[]) {
      const r = childOps(spec, uid);
      ops.push(...r.ops);
      invalidDocs += r.invalid;
    }
  }

  const settingsPatch =
    choices.restoreSettings && review.backup.settings
      ? ({ ...review.backup.settings } as Partial<SettingsDoc>)
      : null;
  return { ops, touchedVehicles, skippedNotYours, skippedKept, skippedSame, invalidDocs, settingsPatch };
}

// --- run ----------------------------------------------------------------------

export interface RestoreRunResult {
  cancelled: boolean;
  opsDone: number;
  opsTotal: number;
  skippedNotYours: number;
  skippedKept: number;
  skippedSame: number;
  invalidDocs: number;
  settingsRestored: boolean;
}

export interface RestoreRunOpts {
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

/**
 * Commit a restore plan in ≤500-op batches (vehicle doc precedes children),
 * awaiting each batch's ack so a failed batch can be retried; cancellation is
 * checked between batches (DRV-10). Then lastOdometer is recomputed per
 * touched vehicle and the optional settings patch merged.
 */
export async function runRestore(
  uid: string,
  plan: RestorePlan,
  opts: RestoreRunOpts = {},
  repos: Repos = getRepos(),
): Promise<RestoreRunResult> {
  let done = 0;
  const total = plan.ops.length;
  const cancelled = () => opts.isCancelled?.() ?? false;
  for (let i = 0; i < plan.ops.length; i += BATCH_LIMIT) {
    if (cancelled()) return finish(true);
    const b = adapter().batch();
    for (const op of plan.ops.slice(i, i + BATCH_LIMIT)) b.set(op.path, op.data);
    await adapter().commit(b).ack;
    done += Math.min(BATCH_LIMIT, plan.ops.length - i);
    opts.onProgress?.(done, total);
  }
  for (const vid of plan.touchedVehicles) {
    if (cancelled()) return finish(true);
    await repos.entries.resyncOdometer(vid);
  }
  let settingsRestored = false;
  if (plan.settingsPatch) {
    await repos.users.updateSettings(uid, plan.settingsPatch);
    settingsRestored = true;
  }
  return finish(false);

  function finish(cancelledFlag: boolean): RestoreRunResult {
    return {
      cancelled: cancelledFlag,
      opsDone: done,
      opsTotal: total,
      skippedNotYours: plan.skippedNotYours,
      skippedKept: plan.skippedKept,
      skippedSame: plan.skippedSame,
      invalidDocs: plan.invalidDocs,
      settingsRestored,
    };
  }
}
