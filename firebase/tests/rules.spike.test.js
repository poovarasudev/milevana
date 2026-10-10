// G3 spike: Foundation rules vs the account-merge write path and batch limits.
// Runs against the Firestore emulator (see package.json "test").
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, setLogLevel,
} = require('firebase/firestore');
setLogLevel('error');

const PROJECT_ID = 'demo-milevana';
const past = Timestamp.fromDate(new Date('2025-01-01T00:00:00Z'));
const future = Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const memberRec = (role, name) => ({ role, name: name ?? 'A', joinedAt: past });

const vehicle = (owner, extra = {}) => ({
  name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', ownerId: owner, memberIds: [owner],
  members: { [owner]: memberRec('owner', 'A') },
  startOdometer: 1000, lastOdometer: 1000, lastOdometerAt: past, archived: false,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const members = (owner, others = []) =>
  Object.fromEntries([owner, ...others].map((u) => [u, memberRec(u === owner ? 'owner' : 'member')]));

const entry = (creator, i = 0, extra = {}) => ({
  type: 'expense', date: past, odometer: 1000 + i,
  amount: { minor: 1000 + i, currency: 'INR' }, notes: 'n', category: 'insurance',
  attachments: [], uploaderUids: [],
  createdBy: creator, createdByName: 'Alice', updatedBy: creator,
  createdAt: past, updatedAt: past, schemaVersion: 1, details: {}, ...extra,
});

const reminder = (creator, extra = {}) => ({
  title: 'PUC renewal', subject: { kind: 'custom' },
  odometerTrigger: { dueOdometer: 15000 }, leadDays: 7, leadDistance: 500,
  status: 'active', createdBy: creator,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const template = (creator, extra = {}) => ({
  name: 'Annual check', items: [{ id: 'i1', label: 'Brakes' }],
  createdBy: creator, createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const seedVehicle = (id, owner, extra) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'vehicles', id), vehicle(owner, extra)));
const seedEntry = (vid, eid, creator, extra) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'vehicles', vid, 'entries', eid), entry(creator, 0, extra)));

const db = (uid) => env.authenticatedContext(uid).firestore();

describe('rules matrix (smoke subset)', () => {
  test('users: self only', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { displayName: 'A' }));
    await assertFails(setDoc(doc(db('bob'), 'users', 'alice'), { displayName: 'B' }));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', 'alice')));
  });

  test('vehicles: create as owner and only member; read by members only', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'vehicles', 'v1'), vehicle('alice')));
    await assertFails(setDoc(doc(db('alice'), 'vehicles', 'v2'), vehicle('bob')));
    await assertFails(setDoc(doc(db('alice'), 'vehicles', 'v3'), vehicle('alice', { memberIds: ['alice', 'bob'] })));
    await assertSucceeds(getDoc(doc(db('alice'), 'vehicles', 'v1')));
    await assertFails(getDoc(doc(db('bob'), 'vehicles', 'v1')));
  });

  test('vehicles: owner cannot change ownership or membership in Foundation', async () => {
    await seedVehicle('v1', 'alice');
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { name: 'Dzire', updatedAt: past }));
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { ownerId: 'bob' }));
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { memberIds: ['alice', 'bob'] }));
  });

  test('vehicles: member may update only lastOdometer, lastOdometerAt, updatedAt', async () => {
    await seedVehicle('v1', 'alice', { memberIds: ['alice', 'bob'], members: members('alice', ['bob']) });
    await assertSucceeds(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { lastOdometer: 1500, lastOdometerAt: past, updatedAt: past }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { name: 'Hijack' }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { lastOdometer: -5 }));
  });

  test('vehicles: only owner deletes', async () => {
    await seedVehicle('v1', 'alice', { memberIds: ['alice', 'bob'], members: members('alice', ['bob']) });
    await assertFails(deleteDoc(doc(db('bob'), 'vehicles', 'v1')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'vehicles', 'v1')));
  });

  test('entries: create with createdBy = self; creator or owner edits; creator immutable', async () => {
    await seedVehicle('v1', 'alice', { memberIds: ['alice', 'bob'], members: members('alice', ['bob']) });
    await assertSucceeds(setDoc(doc(db('bob'), 'vehicles', 'v1', 'entries', 'e1'), entry('bob')));
    await assertFails(setDoc(doc(db('bob'), 'vehicles', 'v1', 'entries', 'e2'), entry('alice')));
    await assertFails(setDoc(doc(db('carol'), 'vehicles', 'v1', 'entries', 'e3'), entry('carol')));
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1', 'entries', 'e1'), { notes: 'owner edit', updatedBy: 'alice' }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1', 'entries', 'e1'), { createdBy: 'alice', updatedBy: 'bob' }));
    await seedEntry('v1', 'e9', 'alice');
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1', 'entries', 'e9'), { notes: 'x', updatedBy: 'bob' }));
    await assertFails(deleteDoc(doc(db('bob'), 'vehicles', 'v1', 'entries', 'e9')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'vehicles', 'v1', 'entries', 'e9')));
  });

  test('entries: validation (type, integer amount, currency, future timestamps, amount-less types)', async () => {
    await seedVehicle('v1', 'alice');
    const col = (id) => doc(db('alice'), 'vehicles', 'v1', 'entries', id);
    await assertFails(setDoc(col('a'), entry('alice', 0, { type: 'bogus' })));
    await assertFails(setDoc(col('b'), entry('alice', 0, { amount: { minor: 10.5, currency: 'INR' } })));
    await assertFails(setDoc(col('c'), entry('alice', 0, { amount: { minor: 10, currency: 'USD' } })));
    await assertFails(setDoc(col('d'), entry('alice', 0, { createdAt: future })));
    const trip = entry('alice', 0, { type: 'trip' }); delete trip.amount; delete trip.category;
    await assertSucceeds(setDoc(col('e'), trip));
    await assertFails(setDoc(col('f'), entry('alice', 0, { type: 'trip' })));
  });

  test('reminders and checklist templates: members only; template limit 50 items; delete by creator or owner', async () => {
    await seedVehicle('v1', 'alice', { memberIds: ['alice', 'bob', 'dan'], members: members('alice', ['bob', 'dan']) });
    await assertSucceeds(setDoc(doc(db('bob'), 'vehicles', 'v1', 'reminders', 'r1'), reminder('bob')));
    await assertFails(setDoc(doc(db('carol'), 'vehicles', 'v1', 'reminders', 'r2'), reminder('carol')));
    const items = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i), label: 'l' + i }));
    await assertSucceeds(setDoc(doc(db('bob'), 'vehicles', 'v1', 'checklistTemplates', 't1'), template('bob', { items: items(50) })));
    await assertFails(setDoc(doc(db('bob'), 'vehicles', 'v1', 'checklistTemplates', 't2'), template('bob', { items: items(51) })));
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1', 'checklistTemplates', 't1'), { name: 'Renamed' }));
    await assertFails(deleteDoc(doc(db('dan'), 'vehicles', 'v1', 'checklistTemplates', 't1')));
    await assertSucceeds(deleteDoc(doc(db('bob'), 'vehicles', 'v1', 'checklistTemplates', 't1')));
    await assertSucceeds(setDoc(doc(db('bob'), 'vehicles', 'v1', 'checklistTemplates', 't3'), template('bob', { items: items(3) })));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'vehicles', 'v1', 'checklistTemplates', 't3')));
  });

  test('invites: exact-code read is open to signed-in users (SHR-04)', async () => {
    await assertSucceeds(getDoc(doc(db('alice'), 'invites', 'K7QX-M2PA')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'invites', 'K7QX-M2PA')));
  });
});

describe('G3: account-merge write path', () => {
  // Merge: an anonymous uid's data is copied under the Google uid.
  // Per decision OQ-22: dates kept, createdBy/updatedBy rewritten to the new owner,
  // vehicles written before their entries.
  const GOOGLE = 'google-uid';

  test('vehicle first, then 501 entries in batches of 500 (original dates kept, createdBy rewritten)', async () => {
    const d = db(GOOGLE);
    await assertSucceeds(setDoc(doc(d, 'vehicles', 'v-copy'), vehicle(GOOGLE)));
    const total = 501;
    for (let start = 0; start < total; start += 500) {
      const batch = writeBatch(d);
      for (let i = start; i < Math.min(start + 500, total); i++) {
        batch.set(doc(d, 'vehicles', 'v-copy', 'entries', 'e' + i), entry(GOOGLE, i));
      }
      await assertSucceeds(batch.commit());
    }
  });

  test('copies that keep the anonymous uid as createdBy are denied', async () => {
    const d = db(GOOGLE);
    await assertSucceeds(setDoc(doc(d, 'vehicles', 'v-copy'), vehicle(GOOGLE)));
    await assertFails(setDoc(doc(d, 'vehicles', 'v-copy', 'entries', 'e0'), entry('anon-uid', 0)));
  });

  test('vehicle and its entries in ONE batch (membership read sees pre-write state)', async () => {
    const d = db(GOOGLE);
    const batch = writeBatch(d);
    batch.set(doc(d, 'vehicles', 'v-copy'), vehicle(GOOGLE));
    for (let i = 0; i < 20; i++) batch.set(doc(d, 'vehicles', 'v-copy', 'entries', 'e' + i), entry(GOOGLE, i));
    const outcome = await batch.commit().then(() => 'allowed', (e) => 'denied: ' + e.code);
    console.log('ONE-BATCH vehicle+20 entries ->', outcome);
    expect(outcome).toMatch(/denied/);
  });

  test('probe: batch sizes of entries against a seeded vehicle', async () => {
    const results = {};
    for (const size of [500, 250, 100, 50, 20, 10, 5]) {
      await env.clearFirestore();
      await seedVehicle('v-copy', GOOGLE);
      const d = db(GOOGLE);
      const batch = writeBatch(d);
      for (let i = 0; i < size; i++) batch.set(doc(d, 'vehicles', 'v-copy', 'entries', 'e' + i), entry(GOOGLE, i));
      results[size] = await batch.commit().then(() => 'ok', (e) => `${e.code}: ${String(e.message).slice(0, 160)}`);
    }
    console.log('BATCH SIZE PROBE', JSON.stringify(results, null, 2));
    expect(Object.keys(results).length).toBe(7);
  });
});
