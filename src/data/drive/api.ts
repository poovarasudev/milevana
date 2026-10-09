// Shared Drive REST core (DRV-03). Platform files supply a token source and
// (for binary uploads) a FormData body; everything else — folders, file
// metadata, downloads, deletes and error normalisation — is identical on
// Android and web, and fully testable in Jest with a fake fetch.

import { DRIVE_FOLDER_MIME, DriveError, DriveFileMeta } from './client';

const FILES = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_FIELDS =
  'id,name,mimeType,size,createdTime,modifiedTime,trashed,parents,properties,thumbnailLink';

/** Access tokens on demand; refresh=true forces a new one (401 retry). */
export interface TokenSource {
  token(refresh?: boolean): Promise<string>;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

function toMeta(f: Record<string, unknown>): DriveFileMeta {
  return {
    id: f.id as string,
    name: f.name as string,
    mimeType: (f.mimeType as string) ?? '',
    sizeBytes: f.size !== undefined ? Number(f.size) : undefined,
    createdTime: f.createdTime as string | undefined,
    modifiedTime: f.modifiedTime as string | undefined,
    trashed: f.trashed as boolean | undefined,
    parents: f.parents as string[] | undefined,
    properties: f.properties as Record<string, string> | undefined,
    thumbnailLink: f.thumbnailLink as string | undefined,
  };
}

/** Map a non-2xx Drive response onto the normalized DriveError codes. */
async function apiError(res: Response): Promise<DriveError> {
  let reason = '';
  let message = `Drive HTTP ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: { errors?: { reason?: string; message?: string }[]; message?: string };
    };
    reason = body?.error?.errors?.[0]?.reason ?? '';
    if (body?.error?.message) message = body.error.message;
  } catch {
    // no JSON body — status is enough
  }
  switch (res.status) {
    case 400:
      return new DriveError('unknown', message);
    case 401:
      return new DriveError('access-revoked', message);
    case 403:
      if (reason === 'storageQuotaExceeded') return new DriveError('storage-full', message);
      if (
        reason === 'rateLimitExceeded' ||
        reason === 'userRateLimitExceeded' ||
        reason === 'dailyLimitExceeded'
      ) {
        return new DriveError('unavailable', message);
      }
      return new DriveError('access-revoked', message);
    case 404:
      return new DriveError('not-found', message);
    default:
      return new DriveError(res.status >= 500 ? 'unavailable' : 'unknown', message);
  }
}

export class DriveApi {
  constructor(
    private tokens: TokenSource,
    private fetchImpl: FetchLike,
  ) {}

  /** Authenticated request with one silent token refresh on 401 (ED-01). */
  private async req(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    let res: Response;
    try {
      const token = await this.tokens.token(retried);
      res = await this.fetchImpl(url, {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      if (e instanceof DriveError) throw e;
      throw new DriveError('network', String(e));
    }
    if (res.status === 401 && !retried) return this.req(url, init, true);
    if (!res.ok) throw await apiError(res);
    return res;
  }

  // --- folders ---------------------------------------------------------------

  async findFolder(name: string, parentId?: string): Promise<DriveFileMeta | null> {
    const query =
      `mimeType='${DRIVE_FOLDER_MIME}' and name='${q(name)}' and trashed=false` +
      (parentId ? ` and '${parentId}' in parents` : " and 'root' in parents");
    const url = `${FILES}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(`files(${FILE_FIELDS})`)}`;
    const res = await this.req(url);
    const body = (await res.json()) as { files?: Record<string, unknown>[] };
    const f = body.files?.[0];
    return f ? toMeta(f) : null;
  }

  async createFolder(name: string, parentId?: string): Promise<DriveFileMeta> {
    const res = await this.req(`${FILES}?fields=${encodeURIComponent(FILE_FIELDS)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: DRIVE_FOLDER_MIME,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
    return toMeta((await res.json()) as Record<string, unknown>);
  }

  /** Create-or-reuse: find the named child folder first, create when absent. */
  async ensureFolder(name: string, parentId?: string): Promise<string> {
    const found = await this.findFolder(name, parentId);
    if (found) return found.id;
    try {
      return (await this.createFolder(name, parentId)).id;
    } catch (e) {
      // A second device may have created it concurrently — look once more.
      const again = await this.findFolder(name, parentId);
      if (again) return again.id;
      throw e;
    }
  }

  // --- files ------------------------------------------------------------------

  /** null when the file is gone or trashed (ED-10 "File no longer in Drive"). */
  async getFile(fileId: string): Promise<DriveFileMeta | null> {
    let res: Response;
    try {
      res = await this.req(`${FILES}/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(FILE_FIELDS)}`);
    } catch (e) {
      if (e instanceof DriveError && e.code === 'not-found') return null;
      throw e;
    }
    const meta = toMeta((await res.json()) as Record<string, unknown>);
    return meta.trashed ? null : meta;
  }

  async listChildren(parentId: string): Promise<DriveFileMeta[]> {
    const out: DriveFileMeta[] = [];
    let pageToken: string | undefined;
    do {
      const query = `'${parentId}' in parents and trashed=false`;
      const url =
        `${FILES}?q=${encodeURIComponent(query)}` +
        `&pageSize=1000&fields=${encodeURIComponent(`files(${FILE_FIELDS}),nextPageToken`)}` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const res = await this.req(url);
      const body = (await res.json()) as {
        files?: Record<string, unknown>[];
        nextPageToken?: string;
      };
      for (const f of body.files ?? []) out.push(toMeta(f));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return out;
  }

  /** JSON upload as a text multipart body — identical on both platforms. */
  async uploadJson(
    name: string,
    parentId: string,
    data: unknown,
    properties?: Record<string, string>,
  ): Promise<DriveFileMeta> {
    const meta = { name, parents: [parentId], mimeType: 'application/json', ...(properties ? { properties } : {}) };
    const boundary = 'milevana_boundary_9f2c';
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    const res = await this.req(`${UPLOAD}?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return toMeta((await res.json()) as Record<string, unknown>);
  }

  /** Binary upload; the platform file builds the FormData body. */
  async uploadMultipart(form: FormData): Promise<DriveFileMeta> {
    const res = await this.req(`${UPLOAD}?uploadType=multipart&fields=${encodeURIComponent(FILE_FIELDS)}`, {
      method: 'POST',
      body: form,
    });
    return toMeta((await res.json()) as Record<string, unknown>);
  }

  async downloadText(fileId: string): Promise<string> {
    const res = await this.req(`${FILES}/${encodeURIComponent(fileId)}?alt=media`);
    return res.text();
  }

  async downloadBlob(fileId: string): Promise<Blob> {
    const res = await this.req(`${FILES}/${encodeURIComponent(fileId)}?alt=media`);
    return res.blob();
  }

  /** Permanent delete; an already-gone file resolves cleanly (ED-10). */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.req(`${FILES}/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
    } catch (e) {
      if (e instanceof DriveError && e.code === 'not-found') return;
      throw e;
    }
  }
}
