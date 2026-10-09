// Receipt cache index (DRV-13 D1): downloaded receipts live in the app
// cache dir with an LRU index in AsyncStorage, capped at 100 MB. The index
// maps attachment id → {uri, sizeBytes, lastUsed}; entries older than the cap
// are evicted least-recently-used. The whole cache is dropped on sign-out
// (FR-OUT-05) by clearReceiptCache; the files are app-private throughout.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { localFiles } from '../data/localFiles';

export const RECEIPT_CACHE_CAP_BYTES = 100 * 1024 * 1024; // 100 MB (ED-10)
const INDEX_KEY = 'mv.receiptCache';

export interface CacheEntry {
  uri: string;
  sizeBytes: number;
  lastUsed: number;
}

type CacheIndex = Record<string, CacheEntry>;

async function readIndex(): Promise<CacheIndex> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (raw == null) return {};
  try {
    const j = JSON.parse(raw) as CacheIndex;
    return j && typeof j === 'object' ? j : {};
  } catch {
    return {};
  }
}

const writeIndex = (idx: CacheIndex) => AsyncStorage.setItem(INDEX_KEY, JSON.stringify(idx));

/** Cached file uri for an attachment, or null (miss or file gone). */
export async function cachedReceiptUri(attId: string): Promise<string | null> {
  const idx = await readIndex();
  const e = idx[attId];
  if (!e) return null;
  if (!(await localFiles().exists(e.uri))) {
    delete idx[attId];
    await writeIndex(idx);
    return null;
  }
  e.lastUsed = Date.now();
  await writeIndex(idx);
  return e.uri;
}

/** Register a downloaded file, then evict LRU entries over the cap. */
export async function receiptToCache(attId: string, uri: string, sizeBytes: number): Promise<void> {
  const idx = await readIndex();
  idx[attId] = { uri, sizeBytes, lastUsed: Date.now() };
  let total = Object.values(idx).reduce((s, e) => s + e.sizeBytes, 0);
  if (total > RECEIPT_CACHE_CAP_BYTES) {
    const oldest = Object.entries(idx).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [id, e] of oldest) {
      if (total <= RECEIPT_CACHE_CAP_BYTES) break;
      await localFiles().remove(e.uri);
      delete idx[id];
      total -= e.sizeBytes;
    }
  }
  await writeIndex(idx);
}

/** Forget one attachment's cached copy. */
export async function evictReceipt(attId: string): Promise<void> {
  const idx = await readIndex();
  const e = idx[attId];
  if (e) {
    delete idx[attId];
    await writeIndex(idx);
    await localFiles().remove(e.uri);
  }
}

/** Sign-out: drop the files and the index (FR-OUT-05). */
export async function clearReceiptCache(): Promise<void> {
  await AsyncStorage.removeItem(INDEX_KEY);
  await localFiles().clearCache();
}
