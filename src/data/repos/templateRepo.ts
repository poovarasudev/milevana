// vehicles/{id}/checklistTemplates/{id} — member CRUD (FND-DAT-07); delete is
// creator-or-owner per the rules.

import type { QuerySnap } from '../adapter';
import { RepoError } from '../adapter';
import { SCHEMA_VERSION } from '../schema/common';
import { ChecklistTemplateDoc, checklistTemplateDocSchema } from '../schema/checklistTemplate';
import { RepoBase, WatchOptions } from './base';

export type TemplateInput = Omit<ChecklistTemplateDoc, 'createdBy' | 'createdAt' | 'updatedAt' | 'schemaVersion'>;
export type TemplatePatch = Partial<TemplateInput>;

export interface TemplateRecord extends ChecklistTemplateDoc {
  id: string;
  /** Firestore hasPendingWrites — the sync indicator (CHK-02). */
  pending: boolean;
}

export class TemplateRepo extends RepoBase {

  async get(vehicleId: string, id: string): Promise<ChecklistTemplateDoc | null> {
    const path = `vehicles/${vehicleId}/checklistTemplates/${id}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) return null;
    return this.parse('checklistTemplates', checklistTemplateDocSchema, snap, path);
  }

  async list(vehicleId: string): Promise<TemplateRecord[]> {
    const snap = await this.adapter.getDocs({ collection: `vehicles/${vehicleId}/checklistTemplates`, clauses: [] });
    return this.withIds(vehicleId, snap);
  }

  watch(vehicleId: string, next: (ts: TemplateRecord[]) => void, opts: WatchOptions = {}): () => void {
    return this.adapter.onQuery(
      { collection: `vehicles/${vehicleId}/checklistTemplates`, clauses: [] },
      (snap: QuerySnap) => next(this.withIds(vehicleId, snap)),
      opts.onError,
    );
  }

  async create(vehicleId: string, input: TemplateInput): Promise<string> {
    const uid = this.callerUid();
    const now = this.adapter.now();
    const doc = { ...input, createdBy: uid, createdAt: now, updatedAt: now, schemaVersion: SCHEMA_VERSION };
    this.assertValid(doc);
    const id = this.adapter.newDocId(`vehicles/${vehicleId}/checklistTemplates`);
    await this.finishWrite(
      this.adapter.setDoc(`vehicles/${vehicleId}/checklistTemplates/${id}`, doc as Record<string, unknown>),
    );
    return id;
  }

  async update(vehicleId: string, id: string, patch: TemplatePatch): Promise<void> {
    const cur = await this.get(vehicleId, id);
    if (!cur) throw new RepoError('not-found', id);
    const merged = { ...cur, ...patch, updatedAt: this.adapter.now() };
    this.assertValid(merged);
    await this.finishWrite(
      this.adapter.setDoc(`vehicles/${vehicleId}/checklistTemplates/${id}`, merged as Record<string, unknown>),
    );
  }

  /** Creator or owner only — enforced by the rules. */
  async delete(vehicleId: string, id: string): Promise<void> {
    await this.finishWrite(this.adapter.deleteDoc(`vehicles/${vehicleId}/checklistTemplates/${id}`));
  }

  private withIds(vehicleId: string, snap: QuerySnap): TemplateRecord[] {
    const out: TemplateRecord[] = [];
    for (const d of snap.docs) {
      const v = this.parse('checklistTemplates', checklistTemplateDocSchema, d, `vehicles/${vehicleId}/checklistTemplates/${d.id}`);
      if (v !== null) out.push({ ...v, id: d.id, pending: d.hasPendingWrites });
    }
    return out;
  }

  private assertValid(doc: unknown): void {
    const r = checklistTemplateDocSchema.safeParse(doc);
    if (!r.success) {
      throw new RepoError('invalid-argument', r.error.issues.map((i) => i.path.join('.')).join(', '));
    }
  }
}
