// Device-local, per-uid flags in AsyncStorage (DR-09, DR-15): welcome seen,
// dismissed link prompt, the vehicle selection MRU list, failed-delete
// markers and the pending-merge retry bundle. Nothing here is user content —
// and it is all wiped for a uid on sign-out (FR-OUT-05).

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExportBundle } from './serializer';

const k = (uid: string, key: string) => `mv.${uid}.${key}`;
const MERGE_KEY = 'mv.mergeRetry';

export const localFlags = {
  async getBool(uid: string, key: string): Promise<boolean> {
    return (await AsyncStorage.getItem(k(uid, key))) === '1';
  },
  async setBool(uid: string, key: string, v: boolean): Promise<void> {
    if (v) await AsyncStorage.setItem(k(uid, key), '1');
    else await AsyncStorage.removeItem(k(uid, key));
  },
  async getJson<T>(uid: string, key: string, fallback: T): Promise<T> {
    const raw = await AsyncStorage.getItem(k(uid, key));
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  async setJson(uid: string, key: string, v: unknown): Promise<void> {
    await AsyncStorage.setItem(k(uid, key), JSON.stringify(v));
  },

  // welcome + link prompt
  welcomeSeen: (uid: string) => localFlags.getBool(uid, 'welcomeSeen'),
  setWelcomeSeen: (uid: string) => localFlags.setBool(uid, 'welcomeSeen', true),
  linkDismissed: (uid: string) => localFlags.getBool(uid, 'linkDismissed'),
  setLinkDismissed: (uid: string) => localFlags.setBool(uid, 'linkDismissed', true),

  // selection — an ordered MRU list of vehicle ids (DR-15)
  mru: (uid: string) => localFlags.getJson<string[]>(uid, 'mru', []),
  async pushMru(uid: string, vehicleId: string): Promise<string[]> {
    const list = [vehicleId, ...(await localFlags.mru(uid)).filter((id) => id !== vehicleId)];
    await localFlags.setJson(uid, 'mru', list);
    return list;
  },

  // "Delete didn't finish" badges (DR-14: manual retry, survives restart)
  deleteFailed: (uid: string) => localFlags.getJson<string[]>(uid, 'deleteFailed', []),
  async markDeleteFailed(uid: string, vehicleId: string, failed: boolean): Promise<string[]> {
    const cur = await localFlags.deleteFailed(uid);
    const next = failed ? [...new Set([...cur, vehicleId])] : cur.filter((id) => id !== vehicleId);
    await localFlags.setJson(uid, 'deleteFailed', next);
    return next;
  },

  // Account-deletion resume marker (VD-04/07): mirrors users/{uid}.deletion
  // locally so a restart after the user document is already gone still resumes
  // instead of recreating the document. Cleared on successful account delete
  // (and by clearFor).
  deletion: (uid: string) =>
    localFlags.getJson<{
      status: string;
      startedAt?: unknown;
      handoffs: Record<string, string>;
      completedSteps: string[];
    } | null>(uid, 'deletion', null),
  saveDeletion: (uid: string, record: unknown) => localFlags.setJson(uid, 'deletion', record),
  clearDeletion: (uid: string) => AsyncStorage.removeItem(k(uid, 'deletion')),

  // Merge retry bundle — one pending merge at a time, uid-agnostic (the source
  // uid is inside the bundle's documents). AsyncStorage is app-private on both
  // platforms (SC-AUTH06-07).
  async loadMergeRetry(): Promise<ExportBundle | null> {
    const raw = await AsyncStorage.getItem(MERGE_KEY);
    if (raw == null) return null;
    try {
      const b = JSON.parse(raw) as ExportBundle;
      return Array.isArray(b?.vehicles) ? b : null;
    } catch {
      return null;
    }
  },
  async saveMergeRetry(bundle: ExportBundle): Promise<void> {
    await AsyncStorage.setItem(MERGE_KEY, JSON.stringify(bundle));
  },
  clearMergeRetry: () => AsyncStorage.removeItem(MERGE_KEY),

  /** Wipe everything stored for a uid (sign-out, FR-OUT-05). */
  async clearFor(uid: string): Promise<void> {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(`mv.${uid}.`));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  },
};
