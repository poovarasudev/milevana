// vehicles/{id}/entries/{entryId} — FND-DAT-07. Creation updates the parent
// vehicle's lastOdometer in the same batch; edit/delete recompute it from the
// remaining max afterwards. createdBy/updatedBy always come from the caller
// (rules mirror this).

import type { QuerySnap } from '../adapter';
import { RepoError } from '../adapter';
import { ANON_AUTHOR_NAME, SCHEMA_VERSION, Timestamp } from '../schema/common';
import { AttachmentDoc, EntryDoc, entryDocSchema, ParsedEntryDoc } from '../schema/entry';
import { VehicleDoc, vehicleDocSchema } from '../schema/vehicle';
import { RepoBase, WatchOptions } from './base';

export interface EntryInput {
  type: ParsedEntryDoc['type'];
  date: Timestamp;
  odometer?: number;
  amount?: ParsedEntryDoc['amount'];
  notes?: string;
  category?: string;
  details?: unknown;
  attachments?: AttachmentDoc[];
}

/**
 * Patch for edit: `undefined` leaves a field alone, `null` removes it from
 * the stored document (update replaces the whole doc), anything else sets it.
 * `uploaderUids` is repo-internal — the receipt upload queue adds the uploader
 * after a Drive upload lands (SC-DRV12-01).
 */
export type EntryPatch = {
  [K in keyof Omit<EntryInput, 'type'>]?: EntryInput[K] | null;
} & { uploaderUids?: string[] };

export interface EntryRecord extends ParsedEntryDoc {
  id: string;
  /** Snapshot metadata: this document has writes not yet acknowledged by the
   * server — renders the "waiting to sync" icon (FR-OFF-03). */
  pending: boolean;
}

export class EntryRepo extends RepoBase {

  async get(vehicleId: string, entryId: string): Promise<EntryDoc | null> {
    const path = `vehicles/${vehicleId}/entries/${entryId}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) return null;
    return this.parse('entries', entryDocSchema, snap, path);
  }

  /** Newest-first list. No limit by default — History loads all of a
   *  vehicle's entries once (LD-10); callers that need a cap pass it. */
  async list(vehicleId: string, limit?: number): Promise<EntryRecord[]> {
    const snap = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [
        { kind: 'orderBy', field: 'date', direction: 'desc' },
        ...(limit !== undefined ? [{ kind: 'limit', n: limit } as const] : []),
      ],
    });
    return this.parseWithIds(vehicleId, snap);
  }

  /** Pull-to-refresh: force a server read and return the fresh set (FR-OFF-12). */
  async refresh(vehicleId: string): Promise<EntryRecord[]> {
    const snap = await this.adapter.getDocs(
      {
        collection: `vehicles/${vehicleId}/entries`,
        clauses: [{ kind: 'orderBy', field: 'date', direction: 'desc' }],
      },
      'server',
    );
    return this.parseWithIds(vehicleId, snap);
  }

  watch(vehicleId: string, next: (entries: EntryRecord[]) => void, limit?: number, opts: WatchOptions = {}): () => void {
    return this.adapter.onQuery(
      {
        collection: `vehicles/${vehicleId}/entries`,
        clauses: [
          { kind: 'orderBy', field: 'date', direction: 'desc' },
          ...(limit !== undefined ? [{ kind: 'limit', n: limit } as const] : []),
        ],
      },
      (snap: QuerySnap) => next(this.parseWithIds(vehicleId, snap)),
      opts.onError,
    );
  }

  /**
   * Watch only entries dated on/after `since` — the 90-day readings window for
   * odometer prediction (RD-02). The listen resumes from the durable-cache
   * token across app opens, so after the first attach only deltas are billed
   * (REM-02).
   */
  watchSince(
    vehicleId: string,
    since: Timestamp,
    next: (entries: EntryRecord[]) => void,
    opts: WatchOptions = {},
  ): () => void {
    return this.adapter.onQuery(
      {
        collection: `vehicles/${vehicleId}/entries`,
        clauses: [
          { kind: 'where', field: 'date', op: '>=', value: since },
          { kind: 'orderBy', field: 'date', direction: 'desc' },
        ],
      },
      (snap: QuerySnap) => next(this.parseWithIds(vehicleId, snap)),
      opts.onError,
    );
  }

  /**
   * Create an entry. The vehicle's lastOdometer moves to
   * max(lastOdometer, entry.odometer) inside the same commit; the extra write
   * is skipped entirely for entries that don't advance it (FR-OFF-01).
   */
  async create(vehicleId: string, input: EntryInput): Promise<string> {
    const user = this.adapter.currentUser();
    if (!user) throw new RepoError('permission-denied', 'not signed in');
    const vehicle = await this.mustGetVehicle(vehicleId);
    if (vehicle.archived) throw new RepoError('invalid-argument', 'archived vehicle');
    const now = this.adapter.now();
    const doc: Record<string, unknown> = {
      type: input.type,
      date: input.date,
      attachments: input.attachments ?? [],
      uploaderUids: input.attachments?.length ? [user.uid] : [],
      createdBy: user.uid,
      createdByName: user.isAnonymous ? ANON_AUTHOR_NAME : (user.displayName ?? user.email ?? ANON_AUTHOR_NAME),
      updatedBy: user.uid,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
    if (input.odometer !== undefined) doc.odometer = input.odometer;
    if (input.amount !== undefined) doc.amount = input.amount;
    if (input.notes !== undefined) doc.notes = input.notes;
    if (input.category !== undefined) doc.category = input.category;
    if (input.details !== undefined) doc.details = input.details;
    this.assertValid(doc, vehicle);

    const id = this.adapter.newDocId(`vehicles/${vehicleId}/entries`);
    const b = this.adapter.batch();
    b.set(`vehicles/${vehicleId}/entries/${id}`, doc);
    const odo = input.odometer;
    if (odo !== undefined && odo > vehicle.lastOdometer) {
      b.update(`vehicles/${vehicleId}`, {
        lastOdometer: odo,
        lastOdometerAt: input.date,
        updatedAt: now,
      });
    }
    await this.finishWrite(this.adapter.commit(b));
    return id;
  }

  /** Edit an entry, then recompute the parent's lastOdometer from the max. */
  async update(vehicleId: string, entryId: string, patch: EntryPatch): Promise<void> {
    const uid = this.callerUid();
    const path = `vehicles/${vehicleId}/entries/${entryId}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) throw new RepoError('not-found', entryId);
    const cur = this.parse('entries', entryDocSchema, snap, path);
    if (!cur) throw new RepoError('invalid-argument', 'entry is malformed');
    const vehicle = await this.mustGetVehicle(vehicleId);
    const merged: Record<string, unknown> = { ...cur, updatedBy: uid, updatedAt: this.adapter.now() };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    this.assertValid(merged, vehicle);
    await this.finishWrite(this.adapter.setDoc(path, merged));
    await this.syncVehicleOdometer(vehicleId, vehicle);
  }

  /** Delete an entry, then recompute the parent's lastOdometer. */
  async delete(vehicleId: string, entryId: string): Promise<void> {
    const vehicle = await this.mustGetVehicle(vehicleId);
    await this.finishWrite(this.adapter.deleteDoc(`vehicles/${vehicleId}/entries/${entryId}`));
    await this.syncVehicleOdometer(vehicleId, vehicle);
  }

  /**
   * Recompute lastOdometer/lastOdometerAt from the stored entries — used after
   * a Drive restore, which writes entries in bulk and must leave the parent's
   * odometer correct (DRV-10).
   */
  async resyncOdometer(vehicleId: string): Promise<void> {
    await this.syncVehicleOdometer(vehicleId);
  }

  async hasEntries(vehicleId: string): Promise<boolean> {
    const snap = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [{ kind: 'limit', n: 1 }],
    });
    return snap.docs.length > 0;
  }

  /** Total entries across every vehicle the caller belongs to. */
  async countAcrossVehicles(vehicleIds: string[]): Promise<number> {
    let total = 0;
    for (const vid of vehicleIds) {
      const snap = await this.adapter.getDocs({ collection: `vehicles/${vid}/entries`, clauses: [] });
      total += snap.docs.length;
    }
    return total;
  }

  /**
   * Entries the caller uploaded at least one attachment to — the receipt
   * share sync's worklist (OQ-56). Single-field array-contains, no index.
   */
  async listUploadedBy(vehicleId: string, uid: string): Promise<EntryRecord[]> {
    const snap = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [{ kind: 'where', field: 'uploaderUids', op: 'array-contains', value: uid }],
    });
    return this.parseWithIds(vehicleId, snap);
  }

  /** Ids of entries still carrying the anonymous 'Me' placeholder (DR-02). */
  async listPlaceholderAuthored(vehicleId: string): Promise<string[]> {
    const snap = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [{ kind: 'where', field: 'createdByName', op: '==', value: ANON_AUTHOR_NAME }],
    });
    return snap.docs.map((d) => d.id);
  }

  /**
   * Rewrite placeholder author names after the anonymous account links Google
   * (DR-02). Only createdByName changes — the rules clause allows it only on
   * entries the caller created while anonymous. Batched by 500 and idempotent:
   * a rerun simply finds the remaining placeholders.
   */
  async setAuthorName(vehicleId: string, entryIds: string[], name: string): Promise<void> {
    for (let i = 0; i < entryIds.length; i += 500) {
      const b = this.adapter.batch();
      for (const id of entryIds.slice(i, i + 500)) {
        b.update(`vehicles/${vehicleId}/entries/${id}`, { createdByName: name });
      }
      await this.finishWrite(this.adapter.commit(b));
    }
  }

  // --- internals -----------------------------------------------------------

  private parseWithIds(vehicleId: string, snap: QuerySnap): EntryRecord[] {
    const out: EntryRecord[] = [];
    for (const d of snap.docs) {
      const v = this.parse('entries', entryDocSchema, d, `vehicles/${vehicleId}/entries/${d.id}`);
      if (v !== null) out.push({ ...v, id: d.id, pending: d.hasPendingWrites });
    }
    return out;
  }

  private async mustGetVehicle(vehicleId: string): Promise<VehicleDoc> {
    const path = `vehicles/${vehicleId}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) throw new RepoError('not-found', vehicleId);
    const v = this.parse('vehicles', vehicleDocSchema, snap, path);
    if (!v) throw new RepoError('invalid-argument', 'vehicle is malformed');
    return v;
  }

  /** Reject client-side with codes+paths before the rules would. */
  private assertValid(doc: Record<string, unknown>, vehicle: VehicleDoc): void {
    const amount = doc.amount as { currency?: string } | undefined;
    if (amount && amount.currency !== vehicle.currency) {
      throw new RepoError('invalid-argument', 'amount.currency != vehicle.currency');
    }
    const check = entryDocSchema.safeParse(doc);
    if (!check.success) {
      throw new RepoError('invalid-argument', check.error.issues.map((i) => i.path.join('.')).join(', '));
    }
  }

  /**
   * lastOdometer = max(entry.odometer) or startOdometer when none remain, and
   * lastOdometerAt = that entry's date (or the vehicle's createdAt). Entries
   * without an odometer don't participate — Firestore orderBy skips them.
   */
  private async syncVehicleOdometer(vehicleId: string, vehicle?: VehicleDoc): Promise<void> {
    const v = vehicle ?? (await this.mustGetVehicle(vehicleId));
    const top = await this.adapter.getDocs({
      collection: `vehicles/${vehicleId}/entries`,
      clauses: [
        { kind: 'orderBy', field: 'odometer', direction: 'desc' },
        { kind: 'limit', n: 1 },
      ],
    });
    const topDoc = top.docs[0] ? this.parse('entries', entryDocSchema, top.docs[0], `vehicles/${vehicleId}/entries/${top.docs[0].id}`) : null;
    const target = topDoc?.odometer !== undefined
      ? { lastOdometer: topDoc.odometer, lastOdometerAt: topDoc.date }
      : { lastOdometer: v.startOdometer, lastOdometerAt: v.createdAt };
    if (target.lastOdometer === v.lastOdometer && target.lastOdometerAt.seconds === v.lastOdometerAt.seconds) {
      return;
    }
    await this.finishWrite(
      this.adapter.updateDoc(`vehicles/${vehicleId}`, { ...target, updatedAt: this.adapter.now() }),
    );
  }
}
