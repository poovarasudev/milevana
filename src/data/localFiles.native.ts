// Android local files via expo-file-system: staging and cache directories
// under the app-private cache dir, so no storage permission is needed and
// Android may reclaim them under pressure (cache, not documents).

import { Directory, File, Paths } from 'expo-file-system';
import { LocalFileRef, LocalFiles } from './localFiles';

const stagingDir = new Directory(Paths.cache, 'mv-staging');
const cacheDir = new Directory(Paths.cache, 'mv-receipts');
const tempDir = new Directory(Paths.cache, 'mv-tmp');

function ensure(dir: Directory): void {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

function ref(file: File): LocalFileRef {
  return { uri: file.uri, sizeBytes: file.size ?? 0 };
}

export function createNativeLocalFiles(): LocalFiles {
  return {
    async stage(srcUri, fileName) {
      ensure(stagingDir);
      const dest = new File(stagingDir, fileName);
      if (dest.exists) dest.delete();
      new File(srcUri).copy(dest);
      return ref(dest);
    },

    async writeStaging(fileName, bytes) {
      ensure(stagingDir);
      const dest = new File(stagingDir, fileName);
      if (dest.exists) dest.delete();
      dest.write(bytes);
      return ref(dest);
    },

    async readBytes(uri) {
      return new File(uri).bytes();
    },

    async size(uri) {
      const f = new File(uri);
      return f.exists ? (f.size ?? 0) : null;
    },

    exists: (uri) => Promise.resolve(new File(uri).exists),

    async remove(uri) {
      const f = new File(uri);
      if (f.exists) f.delete();
    },

    cachePath: (fileName) => new File(cacheDir, fileName).uri,
    tempPath: (fileName) => new File(tempDir, fileName).uri,

    async listCache() {
      if (!cacheDir.exists) return [];
      return cacheDir
        .list()
        .filter((e): e is File => e instanceof File)
        .map((f) => ({ uri: f.uri, sizeBytes: f.size ?? 0 }));
    },

    async listStaging() {
      if (!stagingDir.exists) return [];
      return stagingDir
        .list()
        .filter((e): e is File => e instanceof File)
        .map((f) => ({ uri: f.uri, sizeBytes: f.size ?? 0 }));
    },

    async clearTemp() {
      if (tempDir.exists) tempDir.delete();
    },
    async clearCache() {
      if (cacheDir.exists) cacheDir.delete();
    },
  };
}

let singleton: LocalFiles | null = null;
export function localFiles(): LocalFiles {
  if (!singleton) singleton = createNativeLocalFiles();
  return singleton;
}
