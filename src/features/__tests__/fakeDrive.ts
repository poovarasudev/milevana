// In-memory DriveClient for feature-layer tests (DRV tests mock the Drive
// API — real OAuth/Drive is owner-only). Supports folder/file CRUD plus
// error injection per call kind.

import type {
  DriveClient, DriveFileMeta, DriveMediaSource, DrivePermission, DriveUploadMeta,
} from '../../data/drive/client';
import { DRIVE_FOLDER_MIME, DriveError } from '../../data/drive/client';

interface StoredFile {
  id: string;
  name: string;
  parentId?: string;
  mimeType: string;
  text?: string;
  properties?: Record<string, string>;
  createdTime: string;
  trashed?: boolean;
}

export class FakeDriveClient implements DriveClient {
  private seq = 0;
  files = new Map<string, StoredFile>();
  /** Error thrown by the next eligible call (per kind), then cleared. */
  failNext: Partial<Record<'access' | 'token' | 'folder' | 'get' | 'list' | 'upload' | 'download' | 'delete' | 'perm', DriveError>> = {};
  /** Persistent failure for a file id (delete retries etc). */
  failFileIds = new Map<string, DriveError>();
  /** fileId → permissions. Reader grants made through addReaderPermission. */
  permissions = new Map<string, DrivePermission[]>();
  /** Ordered record of permission calls for assertions. */
  permCalls: { op: 'add' | 'remove'; fileId: string; key: string }[] = [];
  accessHints: (string | undefined)[] = [];
  uploads: { name: string; parentId: string; mimeType: string }[] = [];
  deletes: string[] = [];
  private clock = 0;

  private err(kind: keyof FakeDriveClient['failNext']): void {
    const e = this.failNext[kind];
    if (e) {
      delete this.failNext[kind];
      throw e;
    }
  }

  private meta(f: StoredFile): DriveFileMeta {
    return {
      id: f.id, name: f.name, mimeType: f.mimeType, createdTime: f.createdTime,
      parents: f.parentId ? [f.parentId] : undefined, properties: f.properties,
      trashed: f.trashed,
    };
  }

  private add(name: string, parentId: string | undefined, mimeType: string, extra: Partial<StoredFile> = {}): StoredFile {
    const f: StoredFile = {
      id: `f${++this.seq}`, name, parentId, mimeType,
      createdTime: new Date(Date.now() + this.clock++ * 1000).toISOString(),
      ...extra,
    };
    this.files.set(f.id, f);
    return f;
  }

  /** Test helper: plant a file or folder directly (e.g. an older automatic backup). */
  plant(name: string, parentId: string | undefined, extra: Partial<StoredFile> = {}): StoredFile {
    return this.add(name, parentId, extra.mimeType ?? 'application/json', extra);
  }

  /** Test helper: mark a file trashed (getFile/listFiles then hide it). */
  trash(fileId: string): void {
    const f = this.files.get(fileId);
    if (f) f.trashed = true;
  }

  async requestAccess(hint?: string): Promise<void> {
    this.err('access');
    this.accessHints.push(hint);
  }

  async token(): Promise<string> {
    this.err('token');
    return 'fake-token';
  }

  async resetSession(): Promise<void> {}

  async ensureFolder(name: string, parentId?: string): Promise<string> {
    const found = await this.findFolder(name, parentId);
    if (found) return found.id;
    return (await this.createFolder(name, parentId)).id;
  }

  async findFolder(name: string, parentId?: string): Promise<DriveFileMeta | null> {
    this.err('folder');
    const f = [...this.files.values()].find(
      (x) => x.mimeType === DRIVE_FOLDER_MIME && x.name === name && x.parentId === parentId && !x.trashed,
    );
    return f ? this.meta(f) : null;
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFileMeta> {
    this.err('folder');
    return this.meta(this.add(name, parentId, DRIVE_FOLDER_MIME));
  }

  async getFile(fileId: string): Promise<DriveFileMeta | null> {
    this.err('get');
    const f = this.files.get(fileId);
    return f && !f.trashed ? this.meta(f) : null;
  }

  async listFiles(parentId: string): Promise<DriveFileMeta[]> {
    this.err('list');
    return [...this.files.values()]
      .filter((f) => f.parentId === parentId && !f.trashed)
      .map((f) => this.meta(f));
  }

  async uploadJson(name: string, parentId: string, data: unknown, properties?: Record<string, string>): Promise<DriveFileMeta> {
    this.err('upload');
    const f = this.add(name, parentId, 'application/json', { text: JSON.stringify(data), properties });
    this.uploads.push({ name, parentId, mimeType: 'application/json' });
    return this.meta(f);
  }

  async uploadMedia(meta: DriveUploadMeta, _source: DriveMediaSource): Promise<DriveFileMeta> {
    this.err('upload');
    const f = this.add(meta.name, meta.parentId, meta.mimeType, { properties: meta.properties });
    this.uploads.push({ name: meta.name, parentId: meta.parentId, mimeType: meta.mimeType });
    return this.meta(f);
  }

  async downloadText(fileId: string): Promise<string> {
    this.err('download');
    const f = this.files.get(fileId);
    if (!f || f.trashed || f.text === undefined) throw new DriveError('not-found', fileId);
    return f.text;
  }

  async downloadToPath(fileId: string, _destUri: string): Promise<number> {
    this.err('download');
    const f = this.files.get(fileId);
    if (!f || f.trashed) throw new DriveError('not-found', fileId);
    return (f.text ?? '').length;
  }

  async downloadBlob(fileId: string): Promise<Blob> {
    this.err('download');
    const f = this.files.get(fileId);
    if (!f || f.trashed) throw new DriveError('not-found', fileId);
    return new Blob([f.text ?? '']);
  }

  async thumbnailFor(fileId: string): Promise<{ uri: string } | null> {
    const f = this.files.get(fileId);
    return f && !f.trashed ? { uri: `drive://thumb/${fileId}` } : null;
  }

  async deleteFile(fileId: string): Promise<void> {
    const persistent = this.failFileIds.get(fileId);
    if (persistent) throw persistent;
    this.err('delete');
    this.deletes.push(fileId);
    this.files.delete(fileId);
  }

  async addReaderPermission(fileId: string, email: string): Promise<void> {
    this.err('perm');
    const list = this.permissions.get(fileId) ?? [];
    if (!list.some((p) => p.emailAddress === email)) {
      list.push({ id: `p-${fileId}-${list.length + 1}`, type: 'user', role: 'reader', emailAddress: email });
      this.permissions.set(fileId, list);
    }
    this.permCalls.push({ op: 'add', fileId, key: email });
  }

  async listPermissions(fileId: string): Promise<DrivePermission[]> {
    this.err('perm');
    return [...(this.permissions.get(fileId) ?? [])];
  }

  async removePermission(fileId: string, permissionId: string): Promise<void> {
    this.err('perm');
    const list = this.permissions.get(fileId) ?? [];
    this.permissions.set(fileId, list.filter((p) => p.id !== permissionId));
    this.permCalls.push({ op: 'remove', fileId, key: permissionId });
  }
}
