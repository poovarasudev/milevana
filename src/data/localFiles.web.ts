// Web local files: there is no persistent file system — staged files and the
// receipt cache live in memory for the page session (web is online-only,
// ED-14). Downloads are handed to the browser as object URLs by the caller.

import type { LocalFiles } from './localFiles';

const blobs = new Map<string, Blob>();
const key = (fileName: string, area: string) => `mvweb://${area}/${fileName}`;

async function toBlob(uri: string, fetchImpl: typeof fetch): Promise<Blob> {
  if (uri.startsWith('mvweb://')) {
    const b = blobs.get(uri);
    if (!b) throw new Error(`web staging file gone: ${uri}`);
    return b;
  }
  if (uri.startsWith('blob:')) return (await fetchImpl(uri)).blob();
  return (await fetchImpl(uri)).blob();
}

export function createWebLocalFiles(fetchImpl: typeof fetch = fetch): LocalFiles {
  return {
    async stage(srcUri, fileName) {
      const b = await toBlob(srcUri, fetchImpl);
      const uri = key(fileName, 'staging');
      blobs.set(uri, b);
      return { uri, sizeBytes: b.size };
    },

    async writeStaging(fileName, bytes) {
      const b = new Blob([bytes as BlobPart]);
      const uri = key(fileName, 'staging');
      blobs.set(uri, b);
      return { uri, sizeBytes: b.size };
    },

    async readBytes(uri) {
      return new Uint8Array(await (await toBlob(uri, fetchImpl)).arrayBuffer());
    },

    async size(uri) {
      return blobs.get(uri)?.size ?? null;
    },

    exists: (uri) => Promise.resolve(blobs.has(uri)),

    async remove(uri) {
      blobs.delete(uri);
    },

    cachePath: (fileName) => key(fileName, 'cache'),
    tempPath: (fileName) => key(fileName, 'tmp'),

    async listCache() {
      return [...blobs.entries()]
        .filter(([u]) => u.startsWith('mvweb://cache/'))
        .map(([uri, b]) => ({ uri, sizeBytes: b.size }));
    },

    async listStaging() {
      return [...blobs.entries()]
        .filter(([u]) => u.startsWith('mvweb://staging/'))
        .map(([uri, b]) => ({ uri, sizeBytes: b.size }));
    },

    async clearTemp() {
      for (const u of [...blobs.keys()]) {
        if (u.startsWith('mvweb://tmp/')) blobs.delete(u);
      }
    },
    async clearCache() {
      for (const u of [...blobs.keys()]) {
        if (u.startsWith('mvweb://cache/')) blobs.delete(u);
      }
    },
  };
}

let singleton: LocalFiles | null = null;
export function localFiles(): LocalFiles {
  if (!singleton) singleton = createWebLocalFiles();
  return singleton;
}

export function resetWebLocalFilesForTests(): void {
  blobs.clear();
  singleton = null;
}
