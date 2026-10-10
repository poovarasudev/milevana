// Web Drive client (DRV-03): incremental drive.file consent through Google
// Identity Services (`initTokenClient`), a short-lived token per action
// (ED-01), and the linked-account check — a different Google account is
// rejected with 'Use <linked email>'. Loaded lazily so the GIS script is only
// fetched when a Drive feature is first used.

import { getFirebase } from '../firebase';
import { GOOGLE_WEB_CLIENT_ID } from '../firebaseConfig';
import { DriveApi } from './api';
import { DRIVE_SCOPE, DriveClient, DriveError, DriveMediaSource, DriveUploadMeta } from './client';

// Minimal typings for the GIS token client — the library ships no types.
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string; hint?: string }): void;
}
interface GisOauth2 {
  initTokenClient(cfg: {
    client_id: string;
    scope: string;
    hint?: string;
    callback: (res: TokenResponse) => void;
    error_callback?: (err: { type?: string }) => void;
  }): TokenClient;
}
declare const google: { accounts?: { oauth2?: GisOauth2 } } | undefined;

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new DriveError('unavailable', 'no browser context'));
  }
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new DriveError('network', 'gsi script failed to load'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

/** The linked Firebase Google account this Drive session must match (ED-01). */
function linkedEmail(): string | undefined {
  try {
    return getFirebase().currentUser()?.email ?? undefined;
  } catch {
    return undefined;
  }
}

async function accountEmail(token: string, fetchImpl: typeof fetch): Promise<string | undefined> {
  try {
    const res = await fetchImpl('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    return ((await res.json()) as { email?: string }).email;
  } catch {
    return undefined;
  }
}

export function createWebDriveClient(fetchImpl: typeof fetch = fetch): DriveClient {
  if (!GOOGLE_WEB_CLIENT_ID) {
    // Owner-only config missing: every Drive call fails with a clear error.
    const missing = (): Promise<never> =>
      Promise.reject(new DriveError('not-configured', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'));
    return {
      requestAccess: missing,
      token: missing,
      resetSession: async () => undefined,
      ensureFolder: () => missing(),
      findFolder: () => missing(),
      createFolder: () => missing(),
      getFile: () => missing(),
      listFiles: () => missing(),
      uploadJson: () => missing(),
      uploadMedia: () => missing(),
      downloadText: () => missing(),
      downloadToPath: () => missing(),
      downloadBlob: () => missing(),
      thumbnailFor: () => missing(),
      deleteFile: () => missing(),
      addReaderPermission: () => missing(),
      listPermissions: () => missing(),
      removePermission: () => missing(),
    };
  }

  let cached: { token: string; expiresAt: number; email?: string } | null = null;
  const objectUrls = new Set<string>();

  const requestToken = (prompt: '' | 'consent', hint?: string): Promise<string> =>
    loadGis()
      .then(
        () =>
          new Promise<string>((resolve, reject) => {
            const tc = google!.accounts!.oauth2!.initTokenClient({
              client_id: GOOGLE_WEB_CLIENT_ID,
              scope: DRIVE_SCOPE,
              ...(hint ? { hint } : {}),
              callback: (res) => {
                if (res.error) {
                  reject(
                    res.error === 'access_denied'
                      ? new DriveError('access-declined', res.error)
                      : new DriveError(
                          prompt === '' ? 'access-revoked' : 'access-declined',
                          res.error,
                        ),
                  );
                  return;
                }
                if (!res.access_token) {
                  reject(new DriveError('unknown', 'no access token'));
                  return;
                }
                cached = {
                  token: res.access_token,
                  expiresAt: Date.now() + Math.max(0, (res.expires_in ?? 3500) - 60) * 1000,
                };
                resolve(res.access_token);
              },
              error_callback: (err) => {
                reject(
                  new DriveError(
                    err?.type === 'popup_closed' ? 'access-declined' : 'unknown',
                    err?.type ?? 'gis',
                  ),
                );
              },
            });
            tc.requestAccessToken({ prompt, ...(hint ? { hint } : {}) });
          }),
      )
      .then(async (token) => {
        // ED-01: Drive must use the Google account linked to Firebase.
        const expected = linkedEmail();
        if (expected && cached && !cached.email) cached.email = await accountEmail(token, fetchImpl);
        if (expected && cached?.email && cached.email.toLowerCase() !== expected.toLowerCase()) {
          cached = null;
          throw new DriveError('account-mismatch', `Use ${expected}`);
        }
        return token;
      });

  const tokens = {
    async token(refresh = false): Promise<string> {
      if (!refresh && cached && cached.expiresAt > Date.now()) return cached.token;
      cached = null;
      return requestToken('', linkedEmail());
    },
  };
  const api = new DriveApi(tokens, fetchImpl);

  const revoke = (uri: string) => {
    objectUrls.delete(uri);
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // already gone
    }
  };

  return {
    requestAccess: (hint) => requestToken('consent', hint ?? linkedEmail()).then(() => undefined),
    token: (expectedEmail?: string) =>
      tokens.token().then(async (tok) => {
        const expected = expectedEmail ?? linkedEmail();
        if (expected && cached && !cached.email) cached.email = await accountEmail(tok, fetchImpl);
        if (expected && cached?.email && cached.email.toLowerCase() !== expected.toLowerCase()) {
          cached = null;
          throw new DriveError('account-mismatch', `Use ${expected}`);
        }
        return tok;
      }),
    async resetSession() {
      cached = null;
      for (const u of objectUrls) revoke(u);
    },

    ensureFolder: (name, parentId) => api.ensureFolder(name, parentId),
    findFolder: (name, parentId) => api.findFolder(name, parentId),
    createFolder: (name, parentId) => api.createFolder(name, parentId),
    getFile: (id) => api.getFile(id),
    listFiles: (parentId) => api.listChildren(parentId),
    uploadJson: (name, parentId, data, properties) => api.uploadJson(name, parentId, data, properties),

    async uploadMedia(meta: DriveUploadMeta, source: DriveMediaSource) {
      if (!('blob' in source)) throw new DriveError('unknown', 'web uploads need a Blob');
      const form = new FormData();
      form.append(
        'metadata',
        new Blob(
          [
            JSON.stringify({
              name: meta.name,
              parents: [meta.parentId],
              mimeType: meta.mimeType,
              ...(meta.properties ? { properties: meta.properties } : {}),
            }),
          ],
          { type: 'application/json' },
        ),
      );
      form.append('file', source.blob, meta.name);
      return api.uploadMultipart(form);
    },

    downloadText: (id) => api.downloadText(id),

    downloadToPath: () =>
      Promise.reject(new DriveError('unknown', 'no local file system on web')),

    downloadBlob: (id) => api.downloadBlob(id),

    async thumbnailFor(fileId) {
      const blob = await api.downloadBlob(fileId);
      const uri = URL.createObjectURL(blob);
      objectUrls.add(uri);
      return { uri };
    },

    deleteFile: (id) => api.deleteFile(id),

    addReaderPermission: (fileId, email) => api.addReaderPermission(fileId, email),
    listPermissions: (fileId) => api.listPermissions(fileId),
    removePermission: (fileId, permissionId) => api.removePermission(fileId, permissionId),
  };
}

let singleton: DriveClient | null = null;
export function drive(): DriveClient {
  if (!singleton) singleton = createWebDriveClient();
  return singleton;
}
