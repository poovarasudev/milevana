// Neutral Google Drive client contract (DRV-03). Mirrors firebase.ts: Metro
// resolves client.native.ts or client.web.ts at bundle time; Jest resolves
// this file and tests install a fake via setDriveFactory. No file outside
// client.native.ts / client.web.ts imports a platform Drive library (NFR-14).
//
// The only scope ever requested is drive.file — the app sees only files it
// created. Tokens are obtained on demand and never logged.

/** The single OAuth scope the app ever asks for (incremental, DRV-03). */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveErrorCode =
  | 'access-declined' // user dismissed or declined the scope request
  | 'access-revoked' // grant removed in the Google account (ED-01)
  | 'account-mismatch' // web picked a different Google account than the linked one
  | 'storage-full' // Drive quota exhausted — item stays queued (DRV-12)
  | 'not-found' // file missing or trashed → "File no longer in Drive"
  | 'unavailable' // rate-limited / server 5xx
  | 'network' // no connectivity / fetch failed
  | 'cancelled' // user aborted mid-flow
  | 'not-configured' // OAuth client id missing (owner-only setup)
  | 'unknown';

export class DriveError extends Error {
  constructor(
    public code: DriveErrorCode,
    message = '',
    public detail?: unknown,
  ) {
    super(message || code);
    this.name = 'DriveError';
  }
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  /** Present for non-folder files. */
  sizeBytes?: number;
  createdTime?: string;
  modifiedTime?: string;
  trashed?: boolean;
  parents?: string[];
  /** App-set properties, e.g. kind=automatic on automatic backups (ED-03). */
  properties?: Record<string, string>;
  /** Server-generated thumbnail URL; needs the access token to fetch. */
  thumbnailLink?: string;
}

/** A receipt upload body: a staged file on native, a Blob on web (ED-14). */
export type DriveMediaSource = { uri: string } | { blob: Blob };

export interface DriveUploadMeta {
  name: string;
  parentId: string;
  mimeType: string;
  /** Drive file properties — used to mark kind=automatic backups (ED-03). */
  properties?: Record<string, string>;
}

export interface DriveClient {
  /**
   * Interactive incremental consent for drive.file (DRV-03/04). Resolves on
   * grant; throws DriveError('access-declined'|'account-mismatch'|...).
   * `hint` is the linked Google account's email so the OS/browser can
   * preselect it (ED-01).
   */
  requestAccess(hint?: string): Promise<void>;
  /**
   * Non-interactive check: resolves a token when the grant exists, throws
   * DriveError('access-declined') when it was never given and
   * 'access-revoked' when it was removed.
   */
  token(): Promise<string>;
  /** Drop cached tokens/session state (sign-out, FR-OUT-05). */
  resetSession(): Promise<void>;

  /** Create-or-reuse a child folder by name under parentId (root if absent). */
  ensureFolder(name: string, parentId?: string): Promise<string>;
  /** First untrashed child folder with this name, or null. */
  findFolder(name: string, parentId?: string): Promise<DriveFileMeta | null>;
  /** Always creates — same-name siblings are legal in Drive (SC-DRV05-02). */
  createFolder(name: string, parentId?: string): Promise<DriveFileMeta>;
  /** null when the file is gone or trashed (ED-10). */
  getFile(fileId: string): Promise<DriveFileMeta | null>;
  listFiles(parentId: string): Promise<DriveFileMeta[]>;
  uploadJson(name: string, parentId: string, data: unknown, properties?: Record<string, string>): Promise<DriveFileMeta>;
  uploadMedia(meta: DriveUploadMeta, source: DriveMediaSource): Promise<DriveFileMeta>;
  downloadText(fileId: string): Promise<string>;
  /** Download to an app-local file path (native). Returns bytes written. */
  downloadToPath(fileId: string, destUri: string): Promise<number>;
  /** Download as a Blob (web). */
  downloadBlob(fileId: string): Promise<Blob>;
  /**
   * A renderable thumbnail for an uploaded image: a URI plus any auth
   * headers needed to fetch it (native) or an object URL (web).
   */
  thumbnailFor(fileId: string): Promise<{ uri: string; headers?: Record<string, string> } | null>;
  /** Permanent delete; already-gone resolves cleanly (ED-10). */
  deleteFile(fileId: string): Promise<void>;
}

let factory: (() => DriveClient) | null = null;
let instance: DriveClient | null = null;

export function setDriveFactory(f: () => DriveClient): void {
  factory = f;
  instance = null;
}

export function drive(): DriveClient {
  if (!instance) {
    if (!factory) throw new Error('No Drive client factory installed');
    instance = factory();
  }
  return instance;
}

export function resetDriveForTests(): void {
  instance = null;
}
