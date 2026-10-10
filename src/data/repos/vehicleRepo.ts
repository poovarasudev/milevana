// vehicles/{id} — FND-DAT-06. Creation sets the owner invariants and
// lastOdometer/lastOdometerAt from the start reading; unit/currency lock once
// entries exist; delete removes children in ≤500-op batches and the vehicle
// last so an interrupted run is safely retryable (DR-16).

import type { QuerySnap } from '../adapter';
import { RepoError } from '../adapter';
import { SCHEMA_VERSION } from '../schema/common';
import {
  Member, VehicleDoc, vehicleDocSchema, VehicleInput, vehicleInputSchema,
} from '../schema/vehicle';
import { RepoBase, WatchOptions } from './base';

const BATCH_LIMIT = 500;

export type VehiclePatch = Partial<
  Pick<VehicleDoc, 'name' | 'color' | 'make' | 'model' | 'year' | 'plate' | 'fuelTypes' | 'archived'>
>;

export interface VehicleRecord extends VehicleDoc {
  id: string;
  /** Local write not yet confirmed by the server (drives the sync icon). */
  pending: boolean;
}

export class VehicleRepo extends RepoBase {

  async get(vehicleId: string): Promise<VehicleDoc | null> {
    const path = `vehicles/${vehicleId}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) return null;
    return this.parse('vehicles', vehicleDocSchema, snap, path);
  }

  /** Vehicles the caller belongs to, via memberIds array-contains. */
  async listMine(): Promise<VehicleRecord[]> {
    const uid = this.callerUid();
    const snap = await this.adapter.getDocs({
      collection: 'vehicles',
      clauses: [{ kind: 'where', field: 'memberIds', op: 'array-contains', value: uid }],
    });
    return this.withIds(snap);
  }

  watchMine(next: (vehicles: VehicleRecord[]) => void, opts: WatchOptions = {}): () => void {
    const uid = this.callerUid();
    return this.adapter.onQuery(
      {
        collection: 'vehicles',
        clauses: [{ kind: 'where', field: 'memberIds', op: 'array-contains', value: uid }],
      },
      (snap: QuerySnap) => next(this.withIds(snap)),
      opts.onError,
    );
  }

  private withIds(snap: QuerySnap): VehicleRecord[] {
    const out: VehicleRecord[] = [];
    for (const d of snap.docs) {
      const v = this.parse('vehicles', vehicleDocSchema, d, `vehicles/${d.id}`);
      if (v !== null) out.push({ ...v, id: d.id, pending: d.hasPendingWrites });
    }
    return out;
  }

  /** Vehicles where the caller is the owner (conflict counting, link rewrite). */
  async listOwned(): Promise<VehicleRecord[]> {
    const uid = this.callerUid();
    return (await this.listMine()).filter((v) => v.ownerId === uid);
  }

  /**
   * DR-02: after an anonymous account links Google, the owner's member record
   * gains displayName/email. Only the caller's own record may change, and only
   * name/email — the matching rules clause mirrors that shape. Idempotent.
   */
  async updateMemberProfile(vehicleId: string, name: string | null, email: string | null): Promise<void> {
    const uid = this.callerUid();
    const cur = await this.mustGet(vehicleId);
    const member = cur.members[uid];
    if (!member) throw new RepoError('permission-denied', 'not a member');
    if (member.name === (name ?? undefined) && member.email === (email ?? undefined)) return;
    const updated: Member = { ...member };
    if (name) updated.name = name;
    if (email) updated.email = email;
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, {
        members: { ...cur.members, [uid]: updated },
      }),
    );
  }

  /**
   * Create a vehicle. The signer is the owner and sole member
   * (vehicles/{id}.create rule mirrors this); startOdometer seeds
   * lastOdometer and lastOdometerAt (DR-01).
   */
  async create(input: VehicleInput): Promise<string> {
    const user = this.adapter.currentUser();
    if (!user) throw new RepoError('permission-denied', 'not signed in');
    const check = vehicleInputSchema.safeParse(input);
    if (!check.success) {
      throw new RepoError('invalid-argument', check.error.issues.map((i) => i.path.join('.')).join(', '));
    }
    const now = this.adapter.now();
    const member: Member = { role: 'owner', joinedAt: now };
    if (!user.isAnonymous) {
      // Linked owners carry their name/email; anonymous owners omit them (DR-02).
      if (user.displayName) member.name = user.displayName;
      if (user.email) member.email = user.email;
    }
    const doc: VehicleDoc = {
      ...check.data,
      lastOdometer: check.data.startOdometer,
      lastOdometerAt: now,
      ownerId: user.uid,
      memberIds: [user.uid],
      members: { [user.uid]: member },
      archived: false,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
    const id = this.adapter.newDocId('vehicles');
    await this.finishWrite(this.adapter.setDoc(`vehicles/${id}`, doc as unknown as Record<string, unknown>));
    return id;
  }

  /**
   * Update editable fields. Unit and currency are locked once the vehicle has
   * entries (DR-01); an archived vehicle rejects every change except
   * unarchiving (DR-16).
   */
  async update(vehicleId: string, patch: VehiclePatch): Promise<void> {
    const cur = await this.mustGet(vehicleId);
    if (cur.archived && !(patch.archived === false && Object.keys(patch).length === 1)) {
      throw new RepoError('invalid-argument', 'archived vehicles can only be unarchived or deleted');
    }
    const data: Record<string, unknown> = { updatedAt: this.adapter.now() };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) data[k] = v;
    }
    await this.finishWrite(this.adapter.updateDoc(`vehicles/${vehicleId}`, data));
  }

  /**
   * Unit/currency/start-odometer change — allowed only while the vehicle has
   * no entries (DR-01). When startOdometer moves and the vehicle has no
   * entries, lastOdometer moves with it (it still equals the start reading).
   */
  async changeUnits(
    vehicleId: string,
    patch: Partial<Pick<VehicleDoc, 'odometerUnit' | 'currency' | 'startOdometer'>>,
  ): Promise<void> {
    const cur = await this.mustGet(vehicleId);
    if (cur.archived) throw new RepoError('invalid-argument', 'archived vehicle');
    if (await this.hasEntries(vehicleId)) {
      throw new RepoError('invalid-argument', 'units are locked once entries exist');
    }
    const data: Record<string, unknown> = { ...patch, updatedAt: this.adapter.now() };
    if (patch.startOdometer !== undefined && patch.startOdometer !== cur.startOdometer) {
      data.lastOdometer = patch.startOdometer;
      data.lastOdometerAt = this.adapter.now();
    }
    await this.finishWrite(this.adapter.updateDoc(`vehicles/${vehicleId}`, data));
  }

  async archive(vehicleId: string): Promise<void> {
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, { archived: true, updatedAt: this.adapter.now() }),
    );
  }

  async unarchive(vehicleId: string): Promise<void> {
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, { archived: false, updatedAt: this.adapter.now() }),
    );
  }

  async hasEntries(vehicleId: string): Promise<boolean> {
    const snap = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [{ kind: 'limit', n: 1 }],
    });
    return snap.docs.length > 0;
  }

  /**
   * Delete a vehicle and everything under it. Children go first in chunks of
   * 500 ops, the vehicle document last — if the run is interrupted the vehicle
   * doc remains and the call is safe to retry (DR-16).
   */
  async delete(vehicleId: string): Promise<void> {
    await this.mustGet(vehicleId); // permission + existence up-front
    for (const sub of ['entries', 'reminders', 'checklistTemplates']) {
      // Re-query until drained: a page may grow between reads.
      for (;;) {
        const snap = await this.adapter.getDocs({
          collection: `vehicles/${vehicleId}/${sub}`,
          clauses: [{ kind: 'limit', n: BATCH_LIMIT }],
        });
        if (snap.docs.length === 0) break;
        const b = this.adapter.batch();
        for (const d of snap.docs) b.delete(`vehicles/${vehicleId}/${sub}/${d.id}`);
        await this.finishWrite(this.adapter.commit(b));
      }
    }
    await this.finishWrite(this.adapter.deleteDoc(`vehicles/${vehicleId}`));
  }

  /**
   * SHR-05/SD-06: a member removes exactly their own uid from memberIds and
   * members. The owner cannot leave — they must transfer or delete (the
   * rules deny owner self-removal).
   */
  async leave(vehicleId: string): Promise<void> {
    const uid = this.callerUid();
    const cur = await this.mustGet(vehicleId);
    if (cur.ownerId === uid) {
      throw new RepoError('invalid-argument', 'the owner must transfer ownership or delete the vehicle');
    }
    if (!cur.memberIds.includes(uid)) {
      throw new RepoError('permission-denied', 'not a member');
    }
    const members = { ...cur.members };
    delete members[uid];
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, {
        memberIds: cur.memberIds.filter((m) => m !== uid),
        members,
        updatedAt: this.adapter.now(),
      }),
    );
  }

  /** SHR-05/SD-06: the owner removes exactly one other member. */
  async removeMember(vehicleId: string, memberUid: string): Promise<void> {
    const uid = this.callerUid();
    const cur = await this.mustGet(vehicleId);
    if (cur.ownerId !== uid) {
      throw new RepoError('permission-denied', 'only the owner removes members');
    }
    if (memberUid === uid) {
      throw new RepoError('invalid-argument', 'the owner cannot remove themselves');
    }
    if (!cur.memberIds.includes(memberUid)) {
      throw new RepoError('not-found', memberUid);
    }
    const members = { ...cur.members };
    delete members[memberUid];
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, {
        memberIds: cur.memberIds.filter((m) => m !== memberUid),
        members,
        updatedAt: this.adapter.now(),
      }),
    );
  }

  /**
   * SHR-05/SD-06/07: ownership moves to an existing member in one write —
   * ownerId flips and the two member records swap roles; no acceptance step.
   */
  async transferOwnership(vehicleId: string, newOwnerUid: string): Promise<void> {
    const uid = this.callerUid();
    const cur = await this.mustGet(vehicleId);
    if (cur.ownerId !== uid) {
      throw new RepoError('permission-denied', 'only the owner transfers ownership');
    }
    if (newOwnerUid === uid) {
      throw new RepoError('invalid-argument', 'already the owner');
    }
    const mine = cur.members[uid];
    const target = cur.members[newOwnerUid];
    if (!mine || !target || !cur.memberIds.includes(newOwnerUid)) {
      throw new RepoError('not-found', newOwnerUid);
    }
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, {
        ownerId: newOwnerUid,
        members: {
          ...cur.members,
          [uid]: { ...mine, role: 'member' },
          [newOwnerUid]: { ...target, role: 'owner' },
        },
        updatedAt: this.adapter.now(),
      }),
    );
  }

  /**
   * Member-scoped odometer write. Rules allow any member to touch exactly
   * {lastOdometer, lastOdometerAt, updatedAt}; entryRepo drives this.
   */
  async writeOdometer(vehicleId: string, lastOdometer: number, lastOdometerAt: VehicleDoc['lastOdometerAt']): Promise<void> {
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, {
        lastOdometer, lastOdometerAt, updatedAt: this.adapter.now(),
      }),
    );
  }

  protected async mustGet(vehicleId: string): Promise<VehicleDoc> {
    const v = await this.get(vehicleId);
    if (!v) throw new RepoError('not-found', vehicleId);
    return v;
  }
}
