// DRV-03 (SC-DRV03-03): normalized DriveError mapping — storage full, file
// missing, revoked access, rate limits, network — plus the one 401 token
// refresh retry, folder create-or-reuse and delete idempotency.

import { DriveApi } from '../api';
import { DRIVE_FOLDER_MIME, DriveError } from '../client';

const jsonRes = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response;

const driveErr = (status: number, reason?: string, message = 'boom') =>
  jsonRes(status, { error: { message, errors: reason ? [{ reason }] : [] } });

function apiWith(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  const tokens = { calls: 0, token: async (refresh?: boolean) => { tokens.calls++; return `tok${refresh ? '-r' : ''}`; } };
  return { api: new DriveApi(tokens, handler), tokens };
}

describe('DriveApi', () => {
  it('refreshes the token once on 401 then retries (ED-01)', async () => {
    let calls = 0;
    const { api, tokens } = apiWith(async (url, init) => {
      calls++;
      return calls === 1 ? jsonRes(401, {}) : jsonRes(200, { id: 'x', name: 'n', mimeType: DRIVE_FOLDER_MIME });
    });
    const meta = await api.getFile('x');
    expect(calls).toBe(2);
    expect(tokens.calls).toBe(2);
    expect(meta?.id).toBe('x');
  });

  it('maps error statuses onto normalized codes (SC-DRV03-03)', async () => {
    const cases: [Response, string][] = [
      [driveErr(403, 'storageQuotaExceeded'), 'storage-full'],
      [driveErr(404), 'not-found'],
      [driveErr(403, 'rateLimitExceeded'), 'unavailable'],
      [driveErr(500), 'unavailable'],
      [jsonRes(401, {}), 'access-revoked'], // second 401 after the retry
      [driveErr(403, 'insufficientPermissions'), 'access-revoked'],
      [driveErr(400), 'unknown'],
    ];
    for (const [res, code] of cases) {
      const { api } = apiWith(async () => res);
      try {
        await api.downloadText('f1');
        fail(`expected ${code}`);
      } catch (e) {
        expect(e).toBeInstanceOf(DriveError);
        expect((e as DriveError).code).toBe(code);
      }
    }
  });

  it('maps a fetch rejection to network', async () => {
    const { api } = apiWith(async () => { throw new Error('offline'); });
    await expect(api.downloadText('f')).rejects.toMatchObject({ code: 'network' });
  });

  it('ensureFolder reuses an existing folder and creates otherwise', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let listed = false;
    const { api } = apiWith(async (url, init) => {
      calls.push({ url, init });
      if (init?.method === 'POST') {
        return jsonRes(200, { id: 'new-folder', name: 'Milevana', mimeType: DRIVE_FOLDER_MIME });
      }
      if (!listed) { listed = true; return jsonRes(200, { files: [] }); }
      return jsonRes(200, { files: [{ id: 'existing', name: 'Milevana', mimeType: DRIVE_FOLDER_MIME }] });
    });
    const created = await api.ensureFolder('Milevana');
    expect(created).toBe('new-folder');
    const reused = await api.ensureFolder('Milevana');
    expect(reused).toBe('existing');
  });

  it('getFile returns null for missing or trashed files (ED-10)', async () => {
    const { api } = apiWith(async () => driveErr(404));
    expect(await api.getFile('gone')).toBeNull();
    const trashed = apiWith(async () => jsonRes(200, { id: 't', name: 't', mimeType: 'x', trashed: true }));
    expect(await trashed.api.getFile('t')).toBeNull();
  });

  it('deleteFile is idempotent on a missing file', async () => {
    const { api } = apiWith(async () => driveErr(404));
    await expect(api.deleteFile('gone')).resolves.toBeUndefined();
  });

  it('listChildren pages through nextPageToken', async () => {
    let page = 0;
    const { api } = apiWith(async (url) => {
      page++;
      return page === 1
        ? jsonRes(200, { files: [{ id: 'a', name: 'a', mimeType: 'x' }], nextPageToken: 'p2' })
        : jsonRes(200, { files: [{ id: 'b', name: 'b', mimeType: 'x' }] });
    });
    const files = await api.listChildren('root');
    expect(files.map((f) => f.id)).toEqual(['a', 'b']);
  });
});
