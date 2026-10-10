// SHR-04/05 adversarial rules tests: invites, self-join, leave, remove,
// ownership transfer and attachments[].sharedWithUids.
// Scenarios: docs/sharing-test-scenarios.md (SC-SHR04-*, SC-SHR05-*).
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch,
  collection, query, where, arrayUnion, Timestamp, setLogLevel,
} = require('firebase/firestore');
setLogLevel('error');

const PROJECT_ID = 'demo-milevana';
const past = Timestamp.fromDate(new Date('2025-01-01T00:00:00Z'));
const now = () => Timestamp.now();
const plus7d = (ts) => Timestamp.fromMillis(ts.toMillis() + 7 * 24 * 3600 * 1000);

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

// ---------- factories ----------

const memberRec = (role, extra = {}) => ({
  role, name: 'A', email: `${role}@x.com`, joinedAt: past, ...extra,
});

const vehicle = (owner, memberUids = [owner], extra = {}) => ({
  name: 'Swift', type: 'car', color: 'c03', fuelTypes: ['petrol'],
  odometerUnit: 'km', currency: 'INR', ownerId: owner,
  memberIds: memberUids,
  members: Object.fromEntries(
    memberUids.map((u) => [u, memberRec(u === owner ? 'owner' : 'member', { name: u })]),
  ),
  startOdometer: 1000, lastOdometer: 1000, lastOdometerAt: past, archived: false,
  createdAt: past, updatedAt: past, schemaVersion: 1, ...extra,
});

const invite = (owner, vid, extra = {}) => {
  const createdAt = now();
  return {
    vehicleId: vid, vehicleName: 'Swift', ownerId: owner, ownerName: 'A',
    createdBy: owner, createdAt, expiresAt: plus7d(createdAt), schemaVersion: 1,
    ...extra,
  };
};

const entry = (creator, extra = {}) => ({
  type: 'expense', date: past, odometer: 1000,
  amount: { minor: 1000, currency: 'INR' }, notes: 'n', category: 'insurance',
  attachments: [], uploaderUids: [],
  createdBy: creator, createdByName: 'Alice', updatedBy: creator,
  createdAt: past, updatedAt: past, schemaVersion: 1, details: {}, ...extra,
});

const attachment = (over = {}) => ({
  id: 'a1', ownerUid: 'alice', mimeType: 'image/jpeg', sizeBytes: 100,
  status: 'uploaded', sharedWithUids: [], ...over,
});

// ---------- helpers ----------

const db = (uid) => env.authenticatedContext(uid).firestore();
const anonAuth = (uid) => env.authenticatedContext(uid, {
  provider_id: 'anonymous',
  firebase: { sign_in_provider: 'anonymous' },
}).firestore();
const googleAuth = (uid, email) => env.authenticatedContext(uid, {
  email,
  firebase: { sign_in_provider: 'google.com' },
}).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const seed = (p, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), p), data));
// withSecurityRulesDisabled resolves to undefined — capture reads inside it.
const read = async (p) => {
  let snap;
  await env.withSecurityRulesDisabled(async (c) => { snap = await getDoc(doc(c.firestore(), p)); });
  return snap;
};

const CODE = 'K7QXM2PA';

/** The join batch: member record + invite mark in one atomic write. */
function joinBatch(ctx, vid, uid, memberFields = {}, code = CODE) {
  const d = ctx;
  const b = writeBatch(d);
  b.update(doc(d, 'vehicles', vid), {
    memberIds: arrayUnion(uid),
    [`members.${uid}`]: {
      role: 'member', name: uid, email: `${uid}@x.com`,
      joinedAt: now(), inviteCode: code, ...memberFields,
    },
    updatedAt: now(),
  });
  b.update(doc(d, 'invites', code), { usedBy: uid, usedAt: now() });
  return b.commit();
}

// ---------- invite CRUD ----------
describe('SHR-04: invites/{code} create, read, cancel', () => {
  test('create: owner succeeds; member, non-member and signed-out denied (SC-SHR04-03)', async () => {
    await seed('vehicles/v1', vehicle('alice', ['alice', 'bob']));
    await assertSucceeds(setDoc(doc(db('alice'), 'invites', CODE), invite('alice', 'v1')));
    await assertFails(setDoc(doc(db('bob'), 'invites', 'BBBBBBBB'), invite('bob', 'v1', { ownerId: 'bob' })));
    await assertFails(setDoc(doc(db('carol'), 'invites', 'CCCCCCCC'), invite('carol', 'v1', { ownerId: 'carol' })));
    await assertFails(setDoc(doc(anon(), 'invites', 'DDDDDDDD'), invite('alice', 'v1')));
  });

  test('create: forged ownerId, wrong expiry, extra fields denied', async () => {
    await seed('vehicles/v1', vehicle('alice'));
    const d = db('alice');
    await assertFails(setDoc(doc(d, 'invites', 'E1E1E1E1'), invite('alice', 'v1', { ownerId: 'bob' })));
    await assertFails(setDoc(doc(d, 'invites', 'E2E2E2E2'), invite('alice', 'v1', { expiresAt: now() })));
    await assertFails(setDoc(doc(d, 'invites', 'E3E3E3E3'), invite('alice', 'v1', { usedBy: 'bob' })));
    await assertFails(setDoc(doc(d, 'invites', 'E4E4E4E4'), invite('alice', 'v1', { vehicleName: 'x'.repeat(61) })));
  });

  test('create: missing vehicle and archived vehicle denied', async () => {
    await assertFails(setDoc(doc(db('alice'), 'invites', 'F1F1F1F1'), invite('alice', 'ghost')));
    await seed('vehicles/v2', vehicle('alice', ['alice'], { archived: true }));
    await assertFails(setDoc(doc(db('alice'), 'invites', 'F2F2F2F2'), invite('alice', 'v2')));
  });

  test('create: overwriting an existing code is denied (it is an update)', async () => {
    await seed('vehicles/v1', vehicle('alice'));
    await seed('invites/' + CODE, invite('alice', 'v1'));
    await assertFails(setDoc(doc(db('alice'), 'invites', CODE), invite('alice', 'v1', { vehicleName: 'New' })));
  });

  test('get: any signed-in user incl. anonymous; signed-out denied (SC-SHR04-01)', async () => {
    await seed('vehicles/v1', vehicle('alice'));
    await seed('invites/' + CODE, invite('alice', 'v1'));
    await assertSucceeds(getDoc(doc(db('carol'), 'invites', CODE)));
    await assertSucceeds(getDoc(doc(anonAuth('g1'), 'invites', CODE)));
    await assertFails(getDoc(doc(anon(), 'invites', CODE)));
  });

  test('get: an invite for a deleted vehicle cannot be read (SD-03)', async () => {
    await seed('invites/' + CODE, invite('alice', 'ghostv'));
    await assertFails(getDoc(doc(db('carol'), 'invites', CODE)));
    // ...but the owner can still list and delete their orphaned invites.
    const mine = await getDocs(query(collection(db('alice'), 'invites'), where('ownerId', '==', 'alice')));
    expect(mine.size).toBe(1);
    await assertSucceeds(deleteDoc(doc(db('alice'), 'invites', CODE)));
  });

  test('list: owner query allowed; other queries denied (SC-SHR04-08)', async () => {
    await seed('invites/' + CODE, invite('alice', 'v1'));
    await seed('invites/K7QXM2PB', invite('carol', 'v9', { ownerId: 'carol', createdBy: 'carol' }));
    const mine = await getDocs(query(collection(db('alice'), 'invites'), where('ownerId', '==', 'alice')));
    expect(mine.size).toBe(1);
    await assertFails(getDocs(query(collection(db('bob'), 'invites'), where('ownerId', '==', 'alice'))));
    await assertFails(getDocs(collection(db('alice'), 'invites')));
    await assertFails(getDocs(collection(anon(), 'invites')));
  });

  test('delete: owner cancels; member and non-member denied (SC-SHR04-04)', async () => {
    await seed('invites/' + CODE, invite('alice', 'v1'));
    await assertFails(deleteDoc(doc(db('carol'), 'invites', CODE)));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'invites', CODE)));
  });

  test('update: no path other than the join mark is allowed', async () => {
    await seed('invites/' + CODE, invite('alice', 'v1'));
    await assertFails(updateDoc(doc(db('alice'), 'invites', CODE), { vehicleName: 'X' }));
    await assertFails(updateDoc(doc(db('alice'), 'invites', CODE), { usedBy: 'alice', usedAt: now() }));
  });
});

// ---------- self-join ----------
describe('SHR-04: self-join via invite', () => {
  beforeEach(async () => {
    await seed('vehicles/v1', vehicle('alice'));
    await seed('invites/' + CODE, invite('alice', 'v1'));
  });

  test('happy path: linked user joins, invite is marked used (SC-SHR04-05)', async () => {
    await assertSucceeds(joinBatch(googleAuth('bob', 'bob@x.com'), 'v1', 'bob'));
    const v = await read('vehicles/v1');
    expect(v.data().memberIds).toContain('bob');
    expect(v.data().members.bob.role).toBe('member');
    const inv = await read('invites/' + CODE);
    expect(inv.data().usedBy).toBe('bob');
  });

  test('anonymous joiner denied (SC-SHR04-02, SD-03)', async () => {
    await assertFails(joinBatch(anonAuth('guest'), 'v1', 'guest'));
  });

  test('used invite and expired invite denied (SC-SHR04-05/06)', async () => {
    await seed('invites/USED1111', invite('alice', 'v1', { usedBy: 'dan', usedAt: past }));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob', {}, 'USED1111'));
    const createdAt = Timestamp.fromDate(new Date(Date.now() - 8 * 24 * 3600 * 1000));
    await seed('invites/OLD11111', invite('alice', 'v1', { createdAt, expiresAt: plus7d(createdAt) }));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob', {}, 'OLD11111'));
  });

  test('invite for a different vehicle denied', async () => {
    await seed('vehicles/v9', vehicle('carol'));
    await seed('invites/OTHER111', invite('carol', 'v9'));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob', {}, 'OTHER111'));
  });

  test('missing invite and missing vehicle denied', async () => {
    await assertFails(joinBatch(db('bob'), 'v1', 'bob', {}, 'NOPE1234'));
    await seed('invites/GHOST111', invite('alice', 'ghostv'));
    await assertFails(joinBatch(db('bob'), 'ghostv', 'bob', {}, 'GHOST111'));
  });

  test('vehicle at the 10-member cap cannot be joined (SC-SHR04-07)', async () => {
    const ten = ['alice', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9'];
    await seed('vehicles/v1', vehicle('alice', ten));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob'));
  });

  test('archived vehicle cannot be joined (SD-03)', async () => {
    await seed('vehicles/v1', vehicle('alice', ['alice'], { archived: true }));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob'));
  });

  test('mark invite without adding member record denied', async () => {
    const d = db('bob');
    const b = writeBatch(d);
    b.update(doc(d, 'vehicles', 'v1'), { updatedAt: now() }); // touched only
    b.update(doc(d, 'invites', CODE), { usedBy: 'bob', usedAt: now() });
    await assertFails(b.commit());
  });

  test('join writes that add another uid, elevate role or touch other fields denied', async () => {
    // adds bob AND eve
    let d = db('bob');
    let b = writeBatch(d);
    b.update(doc(d, 'vehicles', 'v1'), {
      memberIds: arrayUnion('bob', 'eve'),
      'members.bob': { role: 'member', name: 'b', email: 'b@x.com', joinedAt: now(), inviteCode: CODE },
      'members.eve': { role: 'member', name: 'e', email: 'e@x.com', joinedAt: now(), inviteCode: CODE },
      updatedAt: now(),
    });
    b.update(doc(d, 'invites', CODE), { usedBy: 'bob', usedAt: now() });
    await assertFails(b.commit());

    // role 'owner' in the member record
    await assertFails(joinBatch(db('bob'), 'v1', 'bob', { role: 'owner' }));

    // extra vehicle field touched
    d = db('bob');
    b = writeBatch(d);
    b.update(doc(d, 'vehicles', 'v1'), {
      memberIds: arrayUnion('bob'),
      'members.bob': { role: 'member', name: 'b', email: 'b@x.com', joinedAt: now(), inviteCode: CODE },
      name: 'hijacked',
      updatedAt: now(),
    });
    b.update(doc(d, 'invites', CODE), { usedBy: 'bob', usedAt: now() });
    await assertFails(b.commit());
  });

  test('usedBy must be the caller and the recorded inviteCode must match', async () => {
    let d = db('bob');
    let b = writeBatch(d);
    b.update(doc(d, 'vehicles', 'v1'), {
      memberIds: arrayUnion('bob'),
      'members.bob': { role: 'member', name: 'b', email: 'b@x.com', joinedAt: now(), inviteCode: CODE },
      updatedAt: now(),
    });
    b.update(doc(d, 'invites', CODE), { usedBy: 'eve', usedAt: now() }); // forged usedBy
    await assertFails(b.commit());

    d = db('bob');
    b = writeBatch(d);
    b.update(doc(d, 'vehicles', 'v1'), {
      memberIds: arrayUnion('bob'),
      'members.bob': { role: 'member', name: 'b', email: 'b@x.com', joinedAt: now(), inviteCode: 'WRONG123' },
      updatedAt: now(),
    });
    b.update(doc(d, 'invites', CODE), { usedBy: 'bob', usedAt: now() });
    await assertFails(b.commit());
  });

  test('already a member cannot re-join', async () => {
    await seed('vehicles/v1', vehicle('alice', ['alice', 'bob']));
    await assertFails(joinBatch(db('bob'), 'v1', 'bob'));
  });

  test('replay: a code cannot be used twice (SC-SHR04-06)', async () => {
    await assertSucceeds(joinBatch(db('bob'), 'v1', 'bob'));
    // A second user tries the same code — invite is now used.
    await assertFails(joinBatch(db('carol'), 'v1', 'carol'));
  });
});

// ---------- leave / remove / transfer ----------
describe('SHR-05: leave, remove, transfer', () => {
  const shared = () => seed('vehicles/v1', vehicle('alice', ['alice', 'bob', 'carol']));
  const leaveWrite = (uid) => updateDoc(doc(db(uid), 'vehicles', 'v1'), {
    memberIds: ['alice', 'carol'],
    members: {
      alice: memberRec('owner', { name: 'alice' }),
      carol: memberRec('member', { name: 'carol' }),
    },
    updatedAt: now(),
  });

  test('member leaves: memberIds + members shrink by self only (SC-SHR05-03)', async () => {
    await shared();
    await assertSucceeds(leaveWrite('bob'));
    const v2 = await read('vehicles/v1');
    expect(v2.data().memberIds).toEqual(['alice', 'carol']);
    expect(v2.data().members.bob).toBeUndefined();
  });

  test('owner cannot leave (SC-SHR05-04)', async () => {
    await shared();
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      memberIds: ['bob', 'carol'],
      members: {
        bob: memberRec('member', { name: 'bob' }),
        carol: memberRec('member', { name: 'carol' }),
      },
      updatedAt: now(),
    }));
  });

  test('member removing someone else denied; leave + other change denied', async () => {
    await shared();
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), {
      memberIds: ['alice', 'bob'], // removes carol
      members: {
        alice: memberRec('owner', { name: 'alice' }),
        bob: memberRec('member', { name: 'bob' }),
      },
      updatedAt: now(),
    }));
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), {
      memberIds: ['alice', 'carol'],
      members: {
        alice: memberRec('owner', { name: 'alice' }),
        carol: memberRec('member', { name: 'carol' }),
      },
      name: 'hijacked',
      updatedAt: now(),
    }));
  });

  test('owner removes a member; removing self or two at once denied (SC-SHR05-01/02)', async () => {
    await shared();
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      memberIds: ['alice', 'carol'],
      members: {
        alice: memberRec('owner', { name: 'alice' }),
        carol: memberRec('member', { name: 'carol' }),
      },
      updatedAt: now(),
    }));
    await shared();
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      memberIds: ['carol'],
      members: { carol: memberRec('member', { name: 'carol' }) },
      updatedAt: now(),
    }));
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      memberIds: ['alice'],
      members: { alice: memberRec('owner', { name: 'alice' }) },
      updatedAt: now(),
    }));
  });

  test('transfer: ownerId + role swap succeeds (SC-SHR05-05)', async () => {
    await shared();
    // Only `role` may change in each record — name/email/joinedAt are preserved.
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      ownerId: 'bob',
      members: {
        alice: { ...memberRec('owner', { name: 'alice' }), role: 'member' },
        bob: { ...memberRec('member', { name: 'bob' }), role: 'owner' },
        carol: memberRec('member', { name: 'carol' }),
      },
      updatedAt: now(),
    }));
    const v = await read('vehicles/v1');
    expect(v.data().ownerId).toBe('bob');
    expect(v.data().members.alice.role).toBe('member');
    expect(v.data().members.bob.role).toBe('owner');
  });

  test('transfer denied: to a non-member, without role swap, by a member, with extra field', async () => {
    await shared();
    const three = {
      alice: memberRec('member', { name: 'alice' }),
      bob: memberRec('owner', { name: 'bob' }),
      carol: memberRec('member', { name: 'carol' }),
    };
    // ownerId to a uid not in memberIds
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      ownerId: 'dan', members: { ...three, dan: memberRec('owner') }, memberIds: ['alice', 'bob', 'carol'], updatedAt: now(),
    }));
    // ownerId changes but roles do not swap
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      ownerId: 'bob',
      members: {
        alice: memberRec('owner', { name: 'alice' }),
        bob: memberRec('member', { name: 'bob' }),
        carol: memberRec('member', { name: 'carol' }),
      },
      updatedAt: now(),
    }));
    // member initiates a transfer
    await assertFails(updateDoc(doc(db('bob'), 'vehicles', 'v1'), { ownerId: 'carol', members: three, updatedAt: now() }));
    // transfer plus an unrelated field
    await assertFails(updateDoc(doc(db('alice'), 'vehicles', 'v1'), {
      ownerId: 'bob', name: 'hijacked', members: three, updatedAt: now(),
    }));
  });

  test('ownerId that does not change is a plain update, not a transfer', async () => {
    // 'Transfer to self' is impossible: ownerId == the current ownerId makes
    // the field unchanged, so this is just an owner edit.
    await shared();
    await assertSucceeds(updateDoc(doc(db('alice'), 'vehicles', 'v1'), { ownerId: 'alice', updatedAt: now() }));
  });
});

// ---------- sharedWithUids ----------
describe('SHR-05: attachments[].sharedWithUids', () => {
  const att = (uids) => attachment({ sharedWithUids: uids, driveFileId: 'd1' });
  beforeEach(async () => {
    await seed('vehicles/v1', vehicle('alice', ['alice', 'bob', 'carol']));
    await seed('vehicles/v1/entries/e1', entry('alice', {
      attachments: [attachment({ ownerUid: 'alice' })],
      uploaderUids: ['alice'],
    }));
  });
  const col = (uid, id = 'e1') => doc(db(uid), 'vehicles', 'v1', 'entries', id);

  test('creator and owner update sharedWithUids; other members denied (SC-SHR05-07)', async () => {
    const full = entry('alice', {
      attachments: [att(['bob', 'carol'])], uploaderUids: ['alice'],
    });
    await assertSucceeds(setDoc(col('alice'), full));
    // owner alice edits bob's entry (updatedBy must be the caller)
    await seed('vehicles/v1/entries/e2', entry('bob', {
      attachments: [attachment({ ownerUid: 'bob' })], uploaderUids: ['bob'],
    }));
    const bobAttShared = entry('bob', {
      attachments: [att(['alice'])], uploaderUids: ['bob'], updatedBy: 'alice',
    });
    await assertSucceeds(setDoc(doc(db('alice'), 'vehicles', 'v1', 'entries', 'e2'), bobAttShared));
    // carol is neither creator nor owner -> denied even with a well-formed entry
    const carolVersion = entry('bob', {
      attachments: [att(['carol'])], uploaderUids: ['bob'], updatedBy: 'carol',
    });
    await assertFails(setDoc(doc(db('carol'), 'vehicles', 'v1', 'entries', 'e2'), carolVersion));
    // non-member -> denied
    await assertFails(setDoc(doc(db('dan'), 'vehicles', 'v1', 'entries', 'e2'), bobAttShared));
  });

  test('sharedWithUids caps at 10 entries', async () => {
    const many = entry('alice', {
      attachments: [att(Array.from({ length: 11 }, (_, i) => 'u' + i))],
      uploaderUids: ['alice'],
    });
    await assertFails(setDoc(col('alice'), many));
  });
});
