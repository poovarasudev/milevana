// App-local file access (DRV-11/12/13). Metro resolves localFiles.native.ts
// (expo-file-system) or localFiles.web.ts (in-memory blobs — web has no
// persistent cache) at bundle time; Jest resolves this file and tests install
// a fake via setLocalFilesFactory.
//
// Two app-private areas are managed:
//   staging/  — picked+compressed receipts waiting to upload; cleared on
//               every app start and at sign-out (FR-OUT-05, ED-12 cleanup)
//   cache/    — downloaded receipts for offline viewing; 100 MB LRU
//               (receiptCache.ts keeps the index; DRV-13 D1)

export interface LocalFileRef {
  uri: string;
  sizeBytes: number;
}

export interface LocalFiles {
  /** Copy an external uri (content://, picker cache) into staging. */
  stage(srcUri: string, fileName: string): Promise<LocalFileRef>;
  /** Write bytes to a new staging file. */
  writeStaging(fileName: string, bytes: Uint8Array): Promise<LocalFileRef>;
  /** Bytes of a staged/cached/local uri. */
  readBytes(uri: string): Promise<Uint8Array>;
  /** Size in bytes, or null when the file is gone. */
  size(uri: string): Promise<number | null>;
  exists(uri: string): Promise<boolean>;
  remove(uri: string): Promise<void>;

  /** Absolute path for a receipt-cache file (native); blob key on web. */
  cachePath(fileName: string): string;
  /** Files currently in the cache dir: [{uri, sizeBytes}]. */
  listCache(): Promise<{ uri: string; sizeBytes: number }[]>;
  /** Files currently in staging — the upload queue sweeps orphans on start. */
  listStaging(): Promise<{ uri: string; sizeBytes: number }[]>;
  /** A temporary path for one-off outputs (CSV, PDF-to-view). */
  tempPath(fileName: string): string;

  /** Drop one-off outputs (CSV temp files) — app start / sign-out. */
  clearTemp(): Promise<void>;
  clearCache(): Promise<void>;
}

let factory: (() => LocalFiles) | null = null;
let instance: LocalFiles | null = null;

export function setLocalFilesFactory(f: () => LocalFiles): void {
  factory = f;
  instance = null;
}

export function localFiles(): LocalFiles {
  if (!instance) {
    if (!factory) throw new Error('No LocalFiles factory installed');
    instance = factory();
  }
  return instance;
}

export function resetLocalFilesForTests(): void {
  instance = null;
}
