// FND-SEC-01/02/03 — full Foundation security matrix against the emulator.
// Every row asserts both an allowed and a denied path. Complements
// rules.spike.test.js (merge path + batch limits).
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment, assertSucceeds, assertFails,
} = require('@firebase/rules-unit-testing');
const {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch,
  Timestamp, setLogLevel,
} = require('firebase/firestore');
setLogLevel('error');

const past = Timestamp.fromDate(new Date('2025-01-01T00:00:00Z'));
const future = Timestamp.fromDate(new Date(Date.now() + 24 * 3600 * 1000));

let env;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-milevana',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const memberRec = (role, name) => ({ role, name: name ?? 'A', joinedAt: past });
const members = (owner, others = []) =>
  Object.fromEntries([owner, ...others].map((u) => [u, memberRec(u === owner ? 'owner' : 'member')]));

const vehicle = (owner, extra = {}) => ({
  name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', ownerId: owner, memberIds: [owner],
  members: members(owner),
  startOdometer: 1000, lastOdometer: 1000, lastOdometerAt: past, archived: false,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const sharedVehicle = (owner, memberIds) => ({
  ...vehicle(owner), memberIds, members: members(owner, memberIds.filter((m) => m !== owner)),
});

// Firestore rejects undefined fields — remove keys explicitly.
const omit = (o, ...keys) => { const c = { ...o }; for (const k of keys) delete c[k]; return c; };

const entry = (creator, extra = {}) => omit({
  type: 'expense', date: past, odometer: 1200,
  amount: { minor: 1000, currency: 'INR' }, notes: 'n', category: 'insurance',
  attachments: [], uploaderUids: [],
  createdBy: creator, createdByName: 'A', updatedBy: creator,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
}, ...Object.keys(extra).filter((k) => extra[k] === undefined));

const fuelEntry = (creator, extra = {}) => omit(entry(creator, {
  type: 'fuel',
  details: {
    fuelType: 'petrol', quantity: 32.5, quantityUnit: 'L',
    pricePerUnitMilli: 102500, fullTank: true, missedPrevious: false,
  },
  ...extra,
}), ...('category' in extra ? [] : ['category']));

const attachment = (over = {}) => ({
  id: 'a1', ownerUid: 'alice', mimeType: 'image/jpeg', sizeBytes: 100,
  status: 'uploaded', sharedWithUids: [], ...over,
});

const reminder = (creator, extra = {}) => omit({
  title: 'PUC renewal', subject: { kind: 'custom' },
  odometerTrigger: { dueOdometer: 15000 }, leadDays: 7, leadDistance: 500,
  status: 'active', createdBy: creator,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
}, ...Object.keys(extra).filter((k) => extra[k] === undefined));

const template = (creator, extra = {}) => ({
  name: 'Annual', items: [{ id: 'i1', label: 'Brakes' }],
  createdBy: creator, createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const db = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (p, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), p), data));

// ---------- users ----------
describe('users/{uid}', () => {
  test('owner reads/writes own doc; others denied; signed-out denied', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { displayName: 'A' }));
    await assertSucceeds(getDoc(doc(db('alice'), 'users', 'alice')));
    await assertFails(setDoc(doc(db('bob'), 'users', 'alice'), { displayName: 'B' }));
    await assertFails(getDoc(doc(db('bob'), 'users', 'alice')));
    await assertFails(setDoc(doc(anon(), 'users', 'alice'), { displayName: 'X' }));
  });
});

// ---------- vehicles ----------
describe('vehicles/{id}', () => {
  test('create: signer must be the owner and sole member', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'vehicles', 'v1'), vehicle('alice')));
    await assertFails(setDoc(doc(db('alice'), 'vehicles', 'v2'), vehicle('bob')));
    await assertFails(setDoc(doc(db('alice'), 'vehicles', 'v3'),
      sharedVehicle('alice', ['alice', 'bob'])));
    await assertFails(setDoc(doc(anon(), 'vehicles', 'v4'), vehicle('alice')));
  });

  test('create: shape validation (name>60, bad color, bad type, odometer, members>10)', async () => {
    const d = db('alice');
    await assertFails(setDoc(doc(d, 'vehicles', 'x1'), vehicle('alice', { name: 'x'.repeat(61) })));
    await assertFails(setDoc(doc(d, 'vehicles', 'x2'), vehicle('alice', { color: '#fff' })));
    await assertFails(setDoc(doc(d, 'vehicles', 'x3'), vehicle('alice', { type: 'plane' })));
    await assertFails(setDoc(doc(d, 'vehicles', 'x4'), vehicle('alice', { startOdometer: -1 })));
    await assertFails(setDoc(doc(d, 'vehicles', 'x5'), vehicle('alice', { odometerUnit: 'hrs' })));
    const many = Array.from({ length: 11 }, (_, i) => `u${i}`);
    await assertFails(setDoc(doc(d, 'vehicles', 'x6'),
      vehicle('u0', { memberIds: many, members: members('u0', many.slice(1)) })));
  });

  test('read: members only (list and get)', async () => {
    await seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob']));
    await assertSucceeds(getDoc(doc(db('bob'), 'vehicles', 'v1')));
    await assertFails(getDoc(doc(db('carol'), 'vehicles', 'v1')));
    await assertFails(getDocs(collection(db('carol'), 'vehicles')));
  });

  test('update: owner edits fields; membership/ownership changes denied even for the owner', async () => {
    await seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob']));
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { name: 'Dzire' }));
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { ownerId: 'bob' }));
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { memberIds: ['alice'] })); // removal denied
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'),
      { members: members('alice', ['bob', 'carol']) }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { memberIds: ['bob'] })); // self-leave denied
    await assertFails(updateDoc(doc(db('carol'), 'vehicles', 'v1'), { memberIds: ['alice', 'bob', 'carol'] })); // self-join denied
  });

  test('update: member touches only the odometer exception fields', async () => {
    await seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob']));
    await assertSucceeds(updateDoc(doc(db('bob'), 'vehicles', 'v1'),
      { lastOdometer: 1500, lastOdometerAt: past, updatedAt: past }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { name: 'Hijack' }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'),
      { lastOdometer: 1500, lastOdometerAt: past, updatedAt: past, archived: true }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { lastOdometer: -1 }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'),
      { lastOdometerAt: past, updatedAt: future }));
  });

  test('delete: owner only', async () => {
    await seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob']));
    await assertFails(deleteDoc(doc(db('bob'), 'vehicles', 'v1')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'vehicles', 'v1')));
  });
});

// ---------- entries ----------
describe('entries', () => {
  beforeEach(() => seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob'])));
  const col = (uid, id) => doc(db(uid), 'vehicles', 'v1', 'entries', id);

  test('read: members read, non-members denied', async () => {
    await seed('vehicles/v1/entries/e1', entry('alice'));
    await assertSucceeds(getDoc(col('bob', 'e1')));
    await assertFails(getDoc(col('carol', 'e1')));
    await assertFails(getDocs(collection(db('carol'), 'vehicles', 'v1', 'entries')));
  });

  test('create: members only, createdBy == caller, all six types', async () => {
    await assertSucceeds(setDoc(col('bob', 'e1'), entry('bob')));
    await assertFails(setDoc(col('carol', 'e2'), entry('carol')));
    await assertFails(setDoc(col('bob', 'e3'), entry('alice'))); // forged createdBy
    for (const t of ['fuel', 'service', 'income', 'trip', 'inspection']) {
      const e = entry('alice', { type: t });
      if (t === 'trip' || t === 'inspection') { delete e.amount; delete e.category; }
      if (t === 'fuel') delete e.category;
      if (t === 'fuel' || t === 'service' || t === 'trip' || t === 'inspection') e.details = {};
      await assertSucceeds(setDoc(col('alice', 't-' + t), e));
    }
  });

  test('create: amount rules per type', async () => {
    await assertFails(setDoc(col('alice', 'a1'), entry('alice', { amount: { minor: -5, currency: 'INR' } })));
    await assertFails(setDoc(col('alice', 'a2'), entry('alice', { amount: { minor: 0, currency: 'INR' } })));
    await assertFails(setDoc(col('alice', 'a3'), entry('alice', { amount: { minor: 10.5, currency: 'INR' } })));
    await assertFails(setDoc(col('alice', 'a4'), entry('alice', { amount: { minor: 10, currency: 'USD' } })));
    await assertFails(setDoc(col('alice', 'a5'), entry('alice', { amount: undefined })));
    const tripWithAmount = entry('alice', { type: 'trip', details: {} }); delete tripWithAmount.category;
    await assertFails(setDoc(col('alice', 'a6'), tripWithAmount));
    const serviceZero = entry('alice', { type: 'service', amount: { minor: 0, currency: 'INR' }, details: {} });
    await assertSucceeds(setDoc(col('alice', 'a7'), serviceZero)); // service may floor at 0 (LD-03)
  });

  test('create: fuel needs details; category rules enforced', async () => {
    await assertSucceeds(setDoc(col('alice', 'f1'), fuelEntry('alice')));
    const noDetails = fuelEntry('alice'); delete noDetails.details;
    await assertFails(setDoc(col('alice', 'f2'), noDetails));
    await assertFails(setDoc(col('alice', 'f3'), fuelEntry('alice', { category: 'fuel' })));
    const noCategory = entry('alice'); delete noCategory.category;
    await assertFails(setDoc(col('alice', 'f4'), noCategory));
  });

  test('create: timestamp and size limits', async () => {
    await assertFails(setDoc(col('alice', 'd1'), entry('alice', { createdAt: future })));
    await assertFails(setDoc(col('alice', 'd2'), entry('alice', { date: future })));
    await assertFails(setDoc(col('alice', 'd3'), entry('alice', { notes: 'x'.repeat(501) })));
    await assertFails(setDoc(col('alice', 'd4'), entry('alice', { attachments: Array(6).fill(attachment()) })));
    await assertSucceeds(setDoc(col('alice', 'd5'), entry('alice', { attachments: Array(5).fill(attachment()) })));
    await assertFails(setDoc(col('alice', 'd6'), entry('alice', { attachments: [attachment({ sizeBytes: -1 })] })));
  });

  test('update: creator or owner; createdBy/immutable audit; updatedBy == caller', async () => {
    await seed('vehicles/v1/entries/e1', entry('bob'));
    await assertSucceeds(updateDoc(col('bob', 'e1'), { notes: 'self', updatedBy: 'bob' }));
    await assertSucceeds(updateDoc(col('alice', 'e1'), { notes: 'owner', updatedBy: 'alice' }));
    await assertFails(updateDoc(col('bob', 'e1'), { createdBy: 'alice', updatedBy: 'bob' }));
    await assertFails(updateDoc(col('bob', 'e1'), { notes: 'x', updatedBy: 'alice' }));
    await seed('vehicles/v1/entries/e9', entry('alice'));
    await assertFails(updateDoc(col('bob', 'e9'), { notes: 'no', updatedBy: 'bob' }));
  });

  test('delete: creator or owner only', async () => {
    await seed('vehicles/v1/entries/e1', entry('alice'));
    await assertFails(deleteDoc(col('bob', 'e1')));
    await assertSucceeds(deleteDoc(col('alice', 'e1')));
    await seed('vehicles/v1/entries/e2', entry('bob'));
    await assertSucceeds(deleteDoc(col('bob', 'e2')));
  });
});

// ---------- reminders & templates ----------
describe('reminders', () => {
  beforeEach(() => seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob'])));
  const col = (uid, id) => doc(db(uid), 'vehicles', 'v1', 'reminders', id);

  test('member CRUD; shape validation incl. at least one trigger', async () => {
    await assertSucceeds(setDoc(col('bob', 'r1'), reminder('bob')));
    await assertFails(setDoc(col('carol', 'r2'), reminder('carol')));
    await assertFails(setDoc(col('bob', 'r3'), reminder('bob', { createdBy: 'alice' })));
    await assertFails(setDoc(col('bob', 'r4'), reminder('bob', { odometerTrigger: undefined })));
    await assertFails(setDoc(col('bob', 'r5'), reminder('bob', { status: 'snoozed' })));
    await assertFails(setDoc(col('bob', 'r6'), reminder('bob', { title: 'x'.repeat(61) })));
    await assertSucceeds(updateDoc(col('bob', 'r1'), { status: 'done', updatedAt: past }));
    await assertSucceeds(deleteDoc(col('bob', 'r1')));
  });
});

describe('checklist templates', () => {
  beforeEach(() => seed('vehicles/v1', sharedVehicle('alice', ['alice', 'bob', 'dan'])));
  const col = (uid, id) => doc(db(uid), 'vehicles', 'v1', 'checklistTemplates', id);

  test('member read/create/update; creator-or-owner delete; ≤50 items', async () => {
    await assertSucceeds(setDoc(col('bob', 't1'), template('bob')));
    await assertFails(setDoc(col('carol', 't2'), template('carol')));
    await assertSucceeds(updateDoc(col('dan', 't1'), { name: 'Renamed' }));
    await assertFails(deleteDoc(col('dan', 't1')));
    await assertSucceeds(deleteDoc(col('alice', 't1')));
  });
});

// ---------- invites (all denied) ----------
describe('invites', () => {
  test('read/create/update/delete all denied, signed in or not', async () => {
    await seed('invites/K7QXM2PA', { vehicleId: 'v1', ownerId: 'alice' });
    await assertFails(getDoc(doc(db('alice'), 'invites', 'K7QXM2PA')));
    await assertFails(setDoc(doc(db('alice'), 'invites', 'K7QXM2PA'), { vehicleId: 'v1' }));
    await assertFails(updateDoc(doc(db('alice'), 'invites', 'K7QXM2PA'), { usedBy: 'alice' }));
    await assertFails(deleteDoc(doc(db('alice'), 'invites', 'K7QXM2PA')));
    await assertFails(getDoc(doc(anon(), 'invites', 'K7QXM2PA')));
  });
});

// ---------- merge / batch behaviour ----------
describe('merge-path and batch limits', () => {
  test('vehicle + entries in ONE batch is denied (pre-write parent state)', async () => {
    const d = db('alice');
    const b = writeBatch(d);
    b.set(doc(d, 'vehicles', 'v1'), vehicle('alice'));
    b.set(doc(d, 'vehicles', 'v1', 'entries', 'e1'), entry('alice'));
    await assertFails(b.commit());
  });

  test('500-entry batch against a seeded vehicle succeeds', async () => {
    await seed('vehicles/v1', vehicle('alice'));
    const d = db('alice');
    const b = writeBatch(d);
    for (let i = 0; i < 500; i++) b.set(doc(d, 'vehicles', 'v1', 'entries', 'e' + i), entry('alice', { odometer: 1000 + i }));
    await assertSucceeds(b.commit());
  });

  test('merge copy keeping the source uid as createdBy is denied', async () => {
    await seed('vehicles/v1', vehicle('alice'));
    await assertFails(setDoc(doc(db('alice'), 'vehicles', 'v1', 'entries', 'e0'), entry('anon-src')));
  });
});
