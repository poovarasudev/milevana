// Shared export/import serializer (FND-DAT-08, FR-EXP-01/IMP-01). Export walks
// every member vehicle plus its entries, reminders and checklist templates
// into a plain-JSON bundle. Import plans deterministic destination ids
// (imp_<srcId>) so a retried import overwrites the same documents; writes go
// vehicle-first in ≤500-op commits.

import type { FirebaseAdapter } from './adapter';
import { SCHEMA_VERSION, Timestamp } from './schema/common';
import { checklistTemplateDocSchema, ChecklistTemplateDoc } from './schema/checklistTemplate';
import { EntryDoc, entryDocSchema } from './schema/entry';
import { ReminderDoc, reminderDocSchema } from './schema/reminder';
import { Member, VehicleDoc, vehicleDocSchema } from './schema/vehicle';
import { parseDoc } from './schema/upgrade';

export const EXPORT_FORMAT_VERSION = 1;
const BATCH_LIMIT = 500;

// --- bundle shape -----------------------------------------------------------

export interface ExportedVehicle {
  id: string; // source document id
  data: VehicleDoc;
  entries: { id: string; data: EntryDoc }[];
  reminders: { id: string; data: ReminderDoc }[];
  checklistTemplates: { id: string; data: ChecklistTemplateDoc }[];
}

export interface ExportBundle {
  formatVersion: number;
  exportedAt: Timestamp;
  vehicles: ExportedVehicle[];
}

export interface WriteOp {
  path: string;
  data: Record<string, unknown>;
}

export interface ImportPlan {
  /** Ordered write ops: every vehicle doc precedes its children. */
  ops: WriteOp[];
  vehicleCount: number;
  entryCount: number;
  reminderCount: number;
  templateCount: number;
}

// --- export -----------------------------------------------------------------

/** Minimal repo surface so export stays adapter- and UI-agnostic. */
export interface ExportSource {
  listVehicles(): Promise<{ id: string; data: VehicleDoc }[]>;
  listEntries(vehicleId: string): Promise<{ id: string; data: EntryDoc }[]>;
  listReminders(vehicleId: string): Promise<{ id: string; data: ReminderDoc }[]>;
  listTemplates(vehicleId: string): Promise<{ id: string; data: ChecklistTemplateDoc }[]>;
}

/** Adapt the repository layer into an ExportSource. */
export function repoExportSource(repos: {
  vehicles: { listMine(): Promise<({ id: string } & VehicleDoc)[]> };
  entries: { list(v: string): Promise<({ id: string } & EntryDoc)[]> };
  reminders: { list(v: string): Promise<({ id: string } & ReminderDoc)[]> };
  templates: { list(v: string): Promise<({ id: string } & ChecklistTemplateDoc)[]> };
}): ExportSource {
  return {
    listVehicles: async () => (await repos.vehicles.listMine()).map(({ id, ...data }) => ({ id, data: data as VehicleDoc })),
    listEntries: async (v) => (await repos.entries.list(v)).map(({ id, ...data }) => ({ id, data: data as EntryDoc })),
    listReminders: async (v) => (await repos.reminders.list(v)).map(({ id, ...data }) => ({ id, data: data as ReminderDoc })),
    listTemplates: async (v) => (await repos.templates.list(v)).map(({ id, ...data }) => ({ id, data: data as ChecklistTemplateDoc })),
  };
}

export async function exportBundle(source: ExportSource, now: Timestamp): Promise<ExportBundle> {
  const vehicles: ExportedVehicle[] = [];
  for (const v of await source.listVehicles()) {
    vehicles.push({
      id: v.id,
      data: v.data,
      entries: await source.listEntries(v.id),
      reminders: await source.listReminders(v.id),
      checklistTemplates: await source.listTemplates(v.id),
    });
  }
  return { formatVersion: EXPORT_FORMAT_VERSION, exportedAt: now, vehicles };
}

// --- import -----------------------------------------------------------------

/** Deterministic destination id so a retried import rewrites the same docs. */
export const destId = (srcId: string): string => `imp_${srcId}`;

export function destVehicleId(srcVehicleId: string): string {
  return destId(srcVehicleId);
}

/**
 * Plan an import. Every write is a `set` on a deterministic id; the destination
 * caller becomes the vehicle owner and sole member, and every createdBy /
 * updatedBy is rewritten to them (FR-IMP-04). Dates are preserved verbatim.
 */
export function planImport(bundle: ExportBundle, destUid: string, importedAt: Timestamp): ImportPlan {
  const ops: WriteOp[] = [];
  let entryCount = 0;
  let reminderCount = 0;
  let templateCount = 0;

  for (const v of bundle.vehicles) {
    const dv = destVehicleId(v.id);
    const member: Member = { role: 'owner', joinedAt: importedAt };
    const vehicleDoc: VehicleDoc = {
      ...v.data,
      ownerId: destUid,
      memberIds: [destUid],
      members: { [destUid]: member },
      schemaVersion: SCHEMA_VERSION,
    };
    const vCheck = vehicleDocSchema.safeParse(vehicleDoc);
    if (!vCheck.success) continue; // skip malformed vehicle + subtree
    ops.push({ path: `vehicles/${dv}`, data: vehicleDoc as unknown as Record<string, unknown> });

    for (const e of v.entries) {
      const doc = { ...e.data, createdBy: destUid, updatedBy: destUid, schemaVersion: SCHEMA_VERSION };
      if (!entryDocSchema.safeParse(doc).success) continue;
      ops.push({ path: `vehicles/${dv}/entries/${destId(e.id)}`, data: doc as Record<string, unknown> });
      entryCount += 1;
    }
    for (const r of v.reminders) {
      const doc = { ...r.data, createdBy: destUid, schemaVersion: SCHEMA_VERSION };
      if (!reminderDocSchema.safeParse(doc).success) continue;
      ops.push({ path: `vehicles/${dv}/reminders/${destId(r.id)}`, data: doc as Record<string, unknown> });
      reminderCount += 1;
    }
    for (const t of v.checklistTemplates) {
      const doc = { ...t.data, createdBy: destUid, schemaVersion: SCHEMA_VERSION };
      if (!checklistTemplateDocSchema.safeParse(doc).success) continue;
      ops.push({ path: `vehicles/${dv}/checklistTemplates/${destId(t.id)}`, data: doc as Record<string, unknown> });
      templateCount += 1;
    }
  }

  return {
    ops,
    vehicleCount: ops.filter((o) => /^vehicles\/[^/]+$/.test(o.path)).length,
    entryCount,
    reminderCount,
    templateCount,
  };
}

/**
 * Run a planned import. Vehicle docs commit first, children after: the rules
 * evaluate a child's parent as it existed BEFORE the batch, so a vehicle and
 * its entries can never share a commit (see rules.matrix.test.js). Each stage
 * commits in chunks of at most 500 ops. Idempotent — the deterministic ids
 * mean a retry is a plain rewrite (FR-IMP-05).
 */
export async function runImport(
  adapter: FirebaseAdapter,
  plan: ImportPlan,
  finishWrite: (h: ReturnType<FirebaseAdapter['commit']>) => Promise<void>,
): Promise<void> {
  const vehicleOps = plan.ops.filter((o) => /^vehicles\/[^/]+$/.test(o.path));
  const childOps = plan.ops.filter((o) => !/^vehicles\/[^/]+$/.test(o.path));
  for (const stage of [vehicleOps, childOps]) {
    for (let i = 0; i < stage.length; i += BATCH_LIMIT) {
      const b = adapter.batch();
      for (const op of stage.slice(i, i + BATCH_LIMIT)) b.set(op.path, op.data);
      await finishWrite(adapter.commit(b));
    }
  }
}

export { parseDoc };
