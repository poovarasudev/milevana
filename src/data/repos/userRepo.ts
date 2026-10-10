// users/{uid} — FND-DAT-06. ensureUser is idempotent and seeds every settings
// key (INR / km / litres / device language / weekly backups / empty muted
// list) so the rest of the app never sees a partial document (DR-03f).

import { RepoError } from '../adapter';
import { SCHEMA_VERSION } from '../schema/common';
import {
  DeletionDoc, DriveDoc, SettingsDoc, UserDoc, userDocSchema,
} from '../schema/user';
import { RepoBase, WatchOptions } from './base';

export const USER_DEFAULTS: Omit<SettingsDoc, 'locale'> = {
  currency: 'INR',
  distanceUnit: 'km',
  volumeUnit: 'litres',
  efficiencyFormat: 'km_per_l',
  dateFormat: 'DD/MM/YYYY',
  theme: 'system',
  backupFrequency: 'weekly',
  mutedReminderVehicleIds: [],
};

export interface EnsureUserOptions {
  /** Device language tag (e.g. 'en-IN'); falls back to 'en'. */
  language?: string;
  displayName?: string;
  email?: string;
  isLinked?: boolean;
}

export class UserRepo extends RepoBase {

  /** Create the user document if absent; return the validated doc either way. */
  async ensureUser(uid: string, opts: EnsureUserOptions = {}): Promise<UserDoc | null> {
    const path = `users/${uid}`;
    const snap = await this.safeGet(path);
    if (snap.exists) {
      return this.parse('users', userDocSchema, snap, path);
    }
    const doc: UserDoc = {
      isLinked: opts.isLinked ?? false,
      settings: { ...USER_DEFAULTS, locale: opts.language ?? 'en' },
      createdAt: this.adapter.now(),
      schemaVersion: SCHEMA_VERSION,
    };
    if (opts.displayName) doc.displayName = opts.displayName;
    if (opts.email) doc.email = opts.email;
    await this.finishWrite(this.adapter.setDoc(path, doc as unknown as Record<string, unknown>));
    return doc;
  }

  async getUser(uid: string): Promise<UserDoc | null> {
    const path = `users/${uid}`;
    const snap = await this.safeGet(path);
    if (!snap.exists) return null;
    return this.parse('users', userDocSchema, snap, path);
  }

  watchUser(uid: string, next: (u: UserDoc | null) => void, opts: WatchOptions = {}): () => void {
    const path = `users/${uid}`;
    return this.adapter.onDoc(
      path,
      (snap) => next(snap.exists ? this.parse('users', userDocSchema, snap, path) : null),
      opts.onError,
    );
  }

  /** Shallow-merge settings patch; the stored doc keeps keys not in the patch. */
  async updateSettings(uid: string, patch: Partial<SettingsDoc>): Promise<void> {
    const cur = await this.getUser(uid);
    if (!cur) throw new RepoError('not-found', 'user doc missing');
    const merged = { ...cur.settings, ...patch };
    const check = userDocSchema.safeParse({ ...cur, settings: merged });
    if (!check.success) {
      throw new RepoError('invalid-argument', check.error.issues.map((i) => i.path.join('.')).join(', '));
    }
    await this.finishWrite(this.adapter.updateDoc(`users/${uid}`, { settings: merged }));
  }

  /** Record that the anonymous account was linked to Google (FR-LINK-04). */
  async markLinked(uid: string, displayName?: string, email?: string): Promise<void> {
    const data: Record<string, unknown> = { isLinked: true };
    if (displayName) data.displayName = displayName;
    if (email) data.email = email;
    await this.finishWrite(this.adapter.updateDoc(`users/${uid}`, data));
  }

  async setDrive(uid: string, drive: DriveDoc): Promise<void> {
    await this.finishWrite(this.adapter.updateDoc(`users/${uid}`, { drive }));
  }

  /**
   * Write the account-deletion progress record (VD-04/07). Server-confirmed
   * on every platform — the record drives resume, so it must not sit only in
   * the offline queue.
   */
  async setDeletion(uid: string, deletion: DeletionDoc): Promise<void> {
    await this.confirmedWrite(this.adapter.updateDoc(`users/${uid}`, { deletion }));
  }

  /**
   * Delete the user document — the second-to-last deletion step (VD-04).
   * Server-confirmed so the local marker is only trusted after the doc is
   * really gone.
   */
  async deleteUserDoc(uid: string): Promise<void> {
    await this.confirmedWrite(this.adapter.deleteDoc(`users/${uid}`));
  }
}
