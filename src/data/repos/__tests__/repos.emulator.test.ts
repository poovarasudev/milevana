// FND-DAT-05/06/07/08 — repository behaviour against the Firestore emulator.
// Runs via `npm run test:emulator` inside `firebase emulators:exec` (see
// jest.emulator.config.js). Each test user gets a web adapter bound to an
// authenticated rules context, so the real rules enforce everything.
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { createWebAdapter } from '../../firebase.web';
import type { FirebaseAdapter } from '../../adapter';
import { createRepos, Repos } from '../index';
import { MalformedDocInfo } from '../base';
import { exportBundle, planImport, repoExportSource, runImport } from '../../serializer';
import { nowTimestamp } from '../../schema/common';
import * as f from '../../schema/__tests__/fixtures';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-milevana',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

function adapterFor(uid: string, linked = false): FirebaseAdapter {
  const firestore = env.authenticatedContext(uid).firestore();
  return createWebAdapter({
    firestore: firestore as never,
    user: { uid, isAnonymous: !linked, displayName: linked ? `${uid} name` : null, email: null },
  });
}

function reposFor(uid: string, opts: { linked?: boolean; malformed?: MalformedDocInfo[] } = {}): Repos {
  return createRepos(
    adapterFor(uid, opts.linked),
    opts.malformed ? (i) => opts.malformed!.push(i) : undefined,
  );
}

const VEHICLE_INPUT = {
  name: 'Swift', type: 'car' as const, color: 'c03', fuelTypes: ['petrol' as const],
  odometerUnit: 'km' as const, currency: 'INR', startOdometer: 1000,
};

const EXPENSE = (over: Record<string, unknown> = {}) => ({
  type: 'expense' as const, date: nowTimestamp(), odometer: 1100,
  amount: { minor: 500, currency: 'INR' }, category: 'cleaning', ...over,
});

describe('userRepo', () => {
  it('ensureUser seeds all defaults and is idempotent', async () => {
    const r = reposFor('alice');
    const u = await r.users.ensureUser('alice', { language: 'en-IN' });
    expect(u!.settings).toMatchObject({
      currency: 'INR', distanceUnit: 'km', volumeUnit: 'litres',
      backupFrequency: 'weekly', mutedReminderVehicleIds: [], locale: 'en-IN',
    });
    const again = await r.users.ensureUser('alice');
    expect(again!.settings.locale).toBe('en-IN');
    expect(again!.createdAt).toEqual(u!.createdAt);
  });

  it('updateSettings merges without dropping other keys', async () => {
    const r = reposFor('alice');
    await r.users.ensureUser('alice');
    await r.users.updateSettings('alice', { theme: 'dark' });
    const u = await r.users.getUser('alice');
    expect(u!.settings.theme).toBe('dark');
    expect(u!.settings.currency).toBe('INR');
  });
});

describe('vehicleRepo', () => {
  it('create sets owner invariants and odometer from start', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const v = await r.vehicles.get(id);
    expect(v!.ownerId).toBe('alice');
    expect(v!.memberIds).toEqual(['alice']);
    expect(v!.members.alice.role).toBe('owner');
    expect(v!.lastOdometer).toBe(1000);
    expect(v!.lastOdometerAt).toEqual(v!.createdAt);
  });

  it('anonymous owner omits name/email (DR-02)', async () => {
    const r = reposFor('alice'); // isAnonymous
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const v = await r.vehicles.get(id);
    expect(v!.members.alice.name).toBeUndefined();
    expect(v!.members.alice.email).toBeUndefined();
  });

  it('listMine returns only member vehicles', async () => {
    const rA = reposFor('alice');
    const rB = reposFor('bob');
    await rA.vehicles.create(VEHICLE_INPUT);
    expect(await rB.vehicles.listMine()).toHaveLength(0);
    expect(await rA.vehicles.listMine()).toHaveLength(1);
  });

  it('update edits fields; archived vehicles only unarchive', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await r.vehicles.update(id, { name: 'Dzire' });
    expect((await r.vehicles.get(id))!.name).toBe('Dzire');
    await r.vehicles.archive(id);
    await expect(r.vehicles.update(id, { name: 'x' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await r.vehicles.unarchive(id);
    expect((await r.vehicles.get(id))!.archived).toBe(false);
  });

  it('units are locked once entries exist', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await r.vehicles.changeUnits(id, { odometerUnit: 'mi', currency: 'USD' });
    await r.entries.create(id, EXPENSE({ amount: { minor: 5, currency: 'USD' } }));
    await expect(r.vehicles.changeUnits(id, { odometerUnit: 'km', currency: 'INR' }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('delete removes all children then the vehicle (retry-safe order)', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await r.entries.create(id, EXPENSE());
    await r.reminders.create(id, {
      title: 'Oil', subject: { kind: 'custom' }, odometerTrigger: { dueOdometer: 5000 },
      leadDays: 0, leadDistance: 0, status: 'active',
    });
    await r.templates.create(id, { name: 'T', items: [{ id: 'i1', label: 'L' }] });
    await r.vehicles.delete(id);
    expect(await r.vehicles.get(id)).toBeNull();
    // Children are gone (verify with rules disabled — member reads need the parent).
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const sub of ['entries', 'reminders', 'checklistTemplates']) {
        expect((await getDocs(collection(ctx.firestore(), 'vehicles', id, sub))).size).toBe(0);
      }
    });
  });
});

describe('entryRepo', () => {
  it('create bumps lastOdometer in the same commit', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await r.entries.create(id, EXPENSE({ odometer: 1500 }));
    const v = await r.vehicles.get(id);
    expect(v!.lastOdometer).toBe(1500);
  });

  it('lower-odometer entries do not move lastOdometer backwards', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await r.entries.create(id, EXPENSE({ odometer: 1500 }));
    await r.entries.create(id, EXPENSE({ odometer: 1200 }));
    expect((await r.vehicles.get(id))!.lastOdometer).toBe(1500);
  });

  it('delete recomputes lastOdometer from the remaining max; falls back to start', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const e1 = await r.entries.create(id, EXPENSE({ odometer: 1500 }));
    await r.entries.create(id, EXPENSE({ odometer: 1300 }));
    await r.entries.delete(id, e1);
    expect((await r.vehicles.get(id))!.lastOdometer).toBe(1300);
    // delete the last one -> falls back to startOdometer
    const rest = await r.entries.list(id);
    await r.entries.delete(id, rest[0].id);
    expect((await r.vehicles.get(id))!.lastOdometer).toBe(1000);
  });

  it('edit recomputes lastOdometer when the max entry is lowered', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const e1 = await r.entries.create(id, EXPENSE({ odometer: 1500 }));
    await r.entries.create(id, EXPENSE({ odometer: 1300 }));
    await r.entries.update(id, e1, { odometer: 1100 });
    expect((await r.vehicles.get(id))!.lastOdometer).toBe(1300);
  });

  it('rejects amounts in the wrong currency client-side', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await expect(r.entries.create(id, EXPENSE({ amount: { minor: 5, currency: 'USD' } })))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('createdBy/updatedBy come from the caller; anonymous gets createdByName "Me"', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const eid = await r.entries.create(id, EXPENSE());
    const e = await r.entries.get(id, eid);
    expect(e!.createdBy).toBe('alice');
    expect(e!.updatedBy).toBe('alice');
    expect(e!.createdByName).toBe('Me');
  });

  it('countAcrossVehicles totals entries', async () => {
    const r = reposFor('alice');
    const v1 = await r.vehicles.create(VEHICLE_INPUT);
    const v2 = await r.vehicles.create(VEHICLE_INPUT);
    await r.entries.create(v1, EXPENSE());
    await r.entries.create(v1, EXPENSE());
    await r.entries.create(v2, EXPENSE());
    expect(await r.entries.countAcrossVehicles([v1, v2])).toBe(3);
  });
});

describe('reminderRepo / templateRepo / inviteRepo', () => {
  it('reminders round-trip through validation', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const rid = await r.reminders.create(id, {
      title: 'Oil change', subject: { kind: 'service', serviceType: 'oil_change' },
      dateTrigger: { dueDate: { seconds: nowTimestamp().seconds + 86400, nanoseconds: 0 } },
      leadDays: 7, leadDistance: 0, status: 'active',
    });
    const rem = await r.reminders.get(id, rid);
    expect(rem!.title).toBe('Oil change');
    await r.reminders.update(id, rid, { status: 'done' });
    expect((await r.reminders.get(id, rid))!.status).toBe('done');
    await r.reminders.delete(id, rid);
    expect(await r.reminders.get(id, rid)).toBeNull();
  });

  it('reminder create without a trigger is rejected before the write', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    await expect(r.reminders.create(id, {
      title: 'x', subject: { kind: 'custom' }, leadDays: 0, leadDistance: 0, status: 'active',
    })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('templates CRUD validates shape', async () => {
    const r = reposFor('alice');
    const id = await r.vehicles.create(VEHICLE_INPUT);
    const tid = await r.templates.create(id, { name: 'Annual', items: [{ id: 'i', label: 'Brakes' }] });
    expect((await r.templates.get(id, tid))!.name).toBe('Annual');
    await r.templates.delete(id, tid);
    expect(await r.templates.get(id, tid)).toBeNull();
  });

  it('invite reads are denied by the rules (FND-SEC-03)', async () => {
    const r = reposFor('alice');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'invites', 'CODE1234'), f.inviteDoc);
    });
    await expect(r.invites.get('CODE1234')).rejects.toMatchObject({ code: 'permission-denied' });
  });
});

describe('validated reads (FND-DAT-05)', () => {
  it('malformed documents are skipped and reported with safe metadata', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await setDoc(doc(d, 'vehicles', 'bad'), { ...f.vehicleDoc, memberIds: ['alice'], ownerId: 'alice', members: { alice: { role: 'owner', joinedAt: { seconds: 1, nanoseconds: 0 } } }, name: 42 });
      await setDoc(doc(d, 'vehicles', 'good'), { ...f.vehicleDoc, memberIds: ['alice'], ownerId: 'alice', members: { alice: { role: 'owner', joinedAt: { seconds: 1, nanoseconds: 0 } } } });
    });
    const malformed: MalformedDocInfo[] = [];
    const r = reposFor('alice', { malformed });
    const list = await r.vehicles.listMine();
    expect(list.map((v) => v.id)).toEqual(['good']);
    expect(malformed).toHaveLength(1);
    expect(malformed[0]).toMatchObject({ kind: 'vehicles', id: 'bad', code: 'invalid' });
    expect(malformed[0].paths).toContain('name');
    expect(JSON.stringify(malformed[0])).not.toContain('42');
  });

  it('newer schema versions are skipped and reported as such (DR-03g)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'vehicles', 'future'), {
        ...f.vehicleDoc, memberIds: ['alice'], ownerId: 'alice',
        members: { alice: { role: 'owner', joinedAt: { seconds: 1, nanoseconds: 0 } } },
        schemaVersion: 99,
      });
    });
    const malformed: MalformedDocInfo[] = [];
    const r = reposFor('alice', { malformed });
    expect(await r.vehicles.listMine()).toHaveLength(0);
    expect(malformed[0].code).toBe('newer-schema');
  });
});

describe('serializer round-trip on the emulator (FND-DAT-08)', () => {
  it('exports alice, imports to bob, data readable under imp_ ids', async () => {
    const rA = reposFor('alice');
    const vid = await rA.vehicles.create(VEHICLE_INPUT);
    await rA.entries.create(vid, EXPENSE({ odometer: 1500 }));
    await rA.reminders.create(vid, {
      title: 'PUC', subject: { kind: 'custom' }, odometerTrigger: { dueOdometer: 9000 },
      leadDays: 0, leadDistance: 0, status: 'active',
    });

    const src = repoExportSource(rA);
    const bundle = await exportBundle(src, nowTimestamp());
    expect(bundle.vehicles).toHaveLength(1);
    expect(bundle.vehicles[0].entries).toHaveLength(1);

    const adapterB = adapterFor('bob');
    const rB = createRepos(adapterB);
    const plan = planImport(bundle, 'bob', nowTimestamp());
    await runImport(adapterB, plan, (h) => h.ack);

    const mine = await rB.vehicles.listMine();
    expect(mine).toHaveLength(1);
    expect(mine[0].id).toBe(`imp_${vid}`);
    expect(mine[0].ownerId).toBe('bob');
    const entries = await rB.entries.list(mine[0].id);
    expect(entries).toHaveLength(1);
    expect(entries[0].createdBy).toBe('bob');
    expect(entries[0].date).toEqual(bundle.vehicles[0].entries[0].data.date);

    // Retry: running the same import again is a plain rewrite.
    await runImport(adapterB, plan, (h) => h.ack);
    expect(await rB.entries.list(mine[0].id)).toHaveLength(1);
  });
});

describe('platform write semantics', () => {
  it('web adapter awaits server ack (awaitWriteAck)', async () => {
    const adapter = adapterFor('alice');
    expect(adapter.awaitWriteAck).toBe(true);
    const h = adapter.setDoc('users/alice', { isLinked: false, settings: { currency: 'INR', distanceUnit: 'km', volumeUnit: 'litres', efficiencyFormat: 'km_per_l', dateFormat: 'DD/MM/YYYY', theme: 'system', locale: 'en', backupFrequency: 'weekly', mutedReminderVehicleIds: [] }, createdAt: { seconds: 1, nanoseconds: 0 }, schemaVersion: 1 });
    await h.ack; // resolves only after the server confirms
    const snap = await adapter.getDoc('users/alice');
    expect(snap.exists).toBe(true);
  });

  it('clearPersistence is a safe no-op on web', async () => {
    await expect(adapterFor('alice').clearPersistence()).resolves.toBeUndefined();
  });
});

