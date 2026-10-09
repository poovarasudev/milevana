// vehicles/{id}/reminders/{id} — member CRUD over validated docs (FND-DAT-07).

import type { QuerySnap } from '../adapter';
import { RepoError } from '../adapter';
import { SCHEMA_VERSION } from '../schema/common';
import { ReminderDoc, reminderDocSchema } from '../schema/reminder';
import { RepoBase, WatchOptions } from './base';

export type ReminderInput = Omit<ReminderDoc, 'createdBy' | 'createdAt' | 'updatedAt' | 'schemaVersion'>;
export type ReminderPatch = Partial<ReminderInput>;

export interface ReminderRecord extends ReminderDoc {
  id: string;
}

export class ReminderRepo extends RepoBase {

  async get(vehicleId: string, id: string): Promise<ReminderDoc | null> {
    const path = `vehicles/${vehicleId}/reminders/${id}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) return null;
    return this.parse('reminders', reminderDocSchema, snap, path);
  }

  async list(vehicleId: string): Promise<ReminderRecord[]> {
    const snap = await this.adapter.getDocs({ collection: `vehicles/${vehicleId}/reminders`, clauses: [] });
    return this.withIds(vehicleId, snap);
  }

  watch(vehicleId: string, next: (rs: ReminderRecord[]) => void, opts: WatchOptions = {}): () => void {
    return this.adapter.onQuery(
      { collection: `vehicles/${vehicleId}/reminders`, clauses: [] },
      (snap: QuerySnap) => next(this.withIds(vehicleId, snap)),
      opts.onError,
    );
  }

  async create(vehicleId: string, input: ReminderInput): Promise<string> {
    const uid = this.callerUid();
    const now = this.adapter.now();
    const doc = { ...input, createdBy: uid, createdAt: now, updatedAt: now, schemaVersion: SCHEMA_VERSION };
    this.assertValid(doc);
    const id = this.adapter.newDocId(`vehicles/${vehicleId}/reminders`);
    await this.finishWrite(this.adapter.setDoc(`vehicles/${vehicleId}/reminders/${id}`, doc as Record<string, unknown>));
    return id;
  }

  async update(vehicleId: string, id: string, patch: ReminderPatch): Promise<void> {
    const cur = await this.get(vehicleId, id);
    if (!cur) throw new RepoError('not-found', id);
    const merged = { ...cur, ...patch, updatedAt: this.adapter.now() };
    this.assertValid(merged);
    await this.finishWrite(this.adapter.setDoc(`vehicles/${vehicleId}/reminders/${id}`, merged as Record<string, unknown>));
  }

  async delete(vehicleId: string, id: string): Promise<void> {
    await this.finishWrite(this.adapter.deleteDoc(`vehicles/${vehicleId}/reminders/${id}`));
  }

  private withIds(vehicleId: string, snap: QuerySnap): ReminderRecord[] {
    const out: ReminderRecord[] = [];
    for (const d of snap.docs) {
      const v = this.parse('reminders', reminderDocSchema, d, `vehicles/${vehicleId}/reminders/${d.id}`);
      if (v !== null) out.push({ ...v, id: d.id });
    }
    return out;
  }

  private assertValid(doc: unknown): void {
    const r = reminderDocSchema.safeParse(doc);
    if (!r.success) {
      throw new RepoError('invalid-argument', r.error.issues.map((i) => i.path.join('.')).join(', '));
    }
  }
}
