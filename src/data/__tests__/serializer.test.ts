// FND-DAT-08 (SC-DAT08-*): export bundle shape, deterministic import planning,
// vehicle-first write order, 500-op batching, retry safety and round-trip.
import { destId, exportBundle, ExportSource, planImport, runImport } from '../serializer';
import { SCHEMA_VERSION } from '../schema/common';
import * as f from '../schema/__tests__/fixtures';
import type { EntryDoc } from '../schema/entry';
import type { VehicleDoc } from '../schema/vehicle';
import type { ReminderDoc } from '../schema/reminder';
import type { ChecklistTemplateDoc } from '../schema/checklistTemplate';

const now = { seconds: 1700100000, nanoseconds: 0 };

function fakeSource(): ExportSource {
  return {
    listVehicles: async () => [{ id: 'v1', data: f.vehicleDoc as VehicleDoc }],
    listEntries: async () => [
      { id: 'e1', data: f.entryDoc as EntryDoc },
      { id: 'e2', data: f.fuelEntryDoc as EntryDoc },
    ],
    listReminders: async () => [{ id: 'r1', data: f.reminderDoc as ReminderDoc }],
    listTemplates: async () => [{ id: 't1', data: f.templateDoc as ChecklistTemplateDoc }],
  };
}

describe('exportBundle', () => {
  it('packages every vehicle with its children', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.exportedAt).toEqual(now);
    expect(bundle.vehicles).toHaveLength(1);
    expect(bundle.vehicles[0].entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(bundle.vehicles[0].reminders).toHaveLength(1);
    expect(bundle.vehicles[0].checklistTemplates).toHaveLength(1);
  });
});

describe('planImport', () => {
  it('derives deterministic destination ids and writes vehicle first', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    const plan = planImport(bundle, 'bob', now);
    expect(plan.ops[0].path).toBe('vehicles/imp_v1');
    expect(plan.ops.map((o) => o.path)).toEqual([
      'vehicles/imp_v1',
      'vehicles/imp_v1/entries/imp_e1',
      'vehicles/imp_v1/entries/imp_e2',
      'vehicles/imp_v1/reminders/imp_r1',
      'vehicles/imp_v1/checklistTemplates/imp_t1',
    ]);
    expect(plan.vehicleCount).toBe(1);
    expect(plan.entryCount).toBe(2);
  });

  it('rewrites owner/member and createdBy/updatedBy, preserves dates', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    const plan = planImport(bundle, 'bob', now);
    const v = plan.ops[0].data as unknown as VehicleDoc;
    expect(v.ownerId).toBe('bob');
    expect(v.memberIds).toEqual(['bob']);
    expect(v.members.bob.role).toBe('owner');
    expect(v.createdAt).toEqual(f.vehicleDoc.createdAt); // original dates preserved
    const e = plan.ops[1].data as unknown as EntryDoc;
    expect(e.createdBy).toBe('bob');
    expect(e.updatedBy).toBe('bob');
    expect(e.createdByName).toBe('Alice'); // display name kept
    expect(e.date).toEqual(f.entryDoc.date);
  });

  it('is deterministic — the same bundle plans the same paths (retry-safe)', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    expect(planImport(bundle, 'bob', now)).toEqual(planImport(bundle, 'bob', now));
  });

  it('skips malformed vehicles and their subtrees', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    bundle.vehicles.push({
      id: 'bad', data: { ...f.vehicleDoc, name: '' } as VehicleDoc,
      entries: [{ id: 'e9', data: f.entryDoc as EntryDoc }], reminders: [], checklistTemplates: [],
    });
    const plan = planImport(bundle, 'bob', now);
    expect(plan.ops.some((o) => o.path.includes('imp_bad'))).toBe(false);
  });
});

describe('runImport', () => {
  interface FakeAdapter {
    committed: { ops: { path: string; data: Record<string, unknown> }[] }[];
    batch(): unknown;
    commit(): { ops: number; ack: Promise<void> };
  }
  function fakeAdapter(): FakeAdapter {
    const committed: { ops: { path: string; data: Record<string, unknown> }[] }[] = [];
    let open = { ops: [] as { path: string; data: Record<string, unknown> }[] };
    return {
      committed,
      batch() {
        open = { ops: [] };
        return {
          set: (path: string, data: Record<string, unknown>) => open.ops.push({ path, data }),
          update: () => undefined,
          delete: () => undefined,
        };
      },
      commit() {
        committed.push(open);
        return { ops: open.ops.length, ack: Promise.resolve() };
      },
    };
  }

  it('commits in batches of 500, vehicle doc first in each vehicle group', async () => {
    const entries = Array.from({ length: 1203 }, (_, i) => ({
      id: `e${i}`, data: { ...f.entryDoc, odometer: 1000 + i } as EntryDoc,
    }));
    const bundle = await exportBundle({
      ...fakeSource(),
      listEntries: async () => entries,
    }, now);
    const plan = planImport(bundle, 'bob', now);
    const adapter = fakeAdapter();
    await runImport(adapter as never, plan, (h) => h.ack);
    // Vehicles commit in their own stage (rules see pre-write parent state):
    // 1 vehicle op, then 1205 child ops in 500-chunks.
    expect(adapter.committed.map((c) => c.ops.length)).toEqual([1, 500, 500, 205]);
    expect(adapter.committed[0].ops[0].path).toBe('vehicles/imp_v1');
  });

  it('round-trip: applying the ops reproduces the source docs under new ids', async () => {
    const bundle = await exportBundle(fakeSource(), now);
    const plan = planImport(bundle, 'bob', now);
    const store = new Map<string, Record<string, unknown>>();
    const adapter = {
      batch() {
        const ops: { path: string; data: Record<string, unknown> }[] = [];
        return {
          set: (path: string, data: Record<string, unknown>) => ops.push({ path, data }),
          update: () => undefined, delete: () => undefined,
          __ops: ops,
        };
      },
      commit(b: { __ops: { path: string; data: Record<string, unknown> }[] }) {
        for (const op of b.__ops) store.set(op.path, op.data);
        return { ops: b.__ops.length, ack: Promise.resolve() };
      },
    };
    await runImport(adapter as never, plan, (h) => h.ack);
    const entry = store.get(`vehicles/${destId('v1')}/entries/${destId('e1')}`)!;
    expect(entry.date).toEqual(f.entryDoc.date);
    expect(entry.createdBy).toBe('bob');
    expect(entry.schemaVersion).toBe(SCHEMA_VERSION);
  });
});
