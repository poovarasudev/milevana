// Android Drive client (DRV-03): incremental drive.file consent through
// Google Sign-In (`addScopes`), tokens on demand via `getTokens`, Drive REST
// through fetch, and streamed file downloads via expo-file-system. This file
// and client.web.ts are the only places a platform Drive library is imported.

import { File } from 'expo-file-system';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../firebaseConfig';
import { DriveApi } from './api';
import { DRIVE_SCOPE, DriveClient, DriveError, DriveMediaSource, DriveUploadMeta } from './clientCore';

let configured = false;
function configure(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: true });
  configured = true;
}

/** Map google-signin failures onto the Drive error contract. */
function mapError(e: unknown): DriveError {
  const code = String((e as { code?: string })?.code ?? '');
  if (code === 'SIGN_IN_CANCELLED' || code === '-1') return new DriveError('access-declined', code);
  if (code === 'SIGN_IN_REQUIRED' || code === 'IN_PROGRESS' || code === 'PLAY_SERVICES_NOT_AVAILABLE') {
    return new DriveError(code === 'PLAY_SERVICES_NOT_AVAILABLE' ? 'unavailable' : 'access-revoked', code);
  }
  return new DriveError('unknown', code || String(e), e);
}

const tokens = {
  /** A drive.file access token; throws DriveError when the grant is absent. */
  async token(): Promise<string> {
    configure();
    const user = GoogleSignin.getCurrentUser();
    if (!user) throw new DriveError('access-declined', 'no Google user');
    if (!user.scopes?.includes(DRIVE_SCOPE)) throw new DriveError('access-declined', 'drive.file not granted');
    try {
      const t = await GoogleSignin.getTokens();
      return t.accessToken;
    } catch (e) {
      throw mapError(e);
    }
  },
};

export function createNativeDriveClient(fetchImpl: typeof fetch = fetch): DriveClient {
  const api = new DriveApi(tokens, fetchImpl);
  return {
    async requestAccess() {
      configure();
      try {
        const res = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
        if (!res || !isSuccessResponse(res) || !res.data.scopes?.includes(DRIVE_SCOPE)) {
          throw new DriveError('access-declined', 'drive.file not granted');
        }
      } catch (e) {
        if (e instanceof DriveError) throw e;
        throw mapError(e);
      }
    },

    token: () => tokens.token(),
    resetSession: async () => undefined, // tokens come fresh from getTokens; nothing cached here

    ensureFolder: (name, parentId) => api.ensureFolder(name, parentId),
    findFolder: (name, parentId) => api.findFolder(name, parentId),
    createFolder: (name, parentId) => api.createFolder(name, parentId),
    getFile: (id) => api.getFile(id),
    listFiles: (parentId) => api.listChildren(parentId),
    uploadJson: (name, parentId, data, properties) => api.uploadJson(name, parentId, data, properties),

    async uploadMedia(meta: DriveUploadMeta, source: DriveMediaSource) {
      if (!('uri' in source)) throw new DriveError('unknown', 'native uploads need a file uri');
      const form = new FormData();
      form.append(
        'metadata',
        {
          string: JSON.stringify({
            name: meta.name,
            parents: [meta.parentId],
            mimeType: meta.mimeType,
            ...(meta.properties ? { properties: meta.properties } : {}),
          }),
          type: 'application/json',
        } as unknown as Blob,
      );
      form.append('file', { uri: source.uri, name: meta.name, type: meta.mimeType } as unknown as Blob);
      return api.uploadMultipart(form);
    },

    downloadText: (id) => api.downloadText(id),
    downloadBlob: (id) => api.downloadBlob(id),

    async downloadToPath(fileId, destUri) {
      const token = await tokens.token();
      const file = await File.downloadFileAsync(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        new File(destUri),
        { headers: { Authorization: `Bearer ${token}` }, idempotent: true },
      );
      return file.size ?? 0;
    },

    async thumbnailFor(fileId) {
      const meta = await api.getFile(fileId);
      if (!meta?.thumbnailLink) return null;
      const token = await tokens.token();
      return { uri: meta.thumbnailLink, headers: { Authorization: `Bearer ${token}` } };
    },

    deleteFile: (id) => api.deleteFile(id),

    addReaderPermission: (fileId, email) => api.addReaderPermission(fileId, email),
    listPermissions: (fileId) => api.listPermissions(fileId),
    removePermission: (fileId, permissionId) => api.removePermission(fileId, permissionId),
  };
}

let singleton: DriveClient | null = null;
export function drive(): DriveClient {
  if (!singleton) singleton = createNativeDriveClient();
  return singleton;
}

export {
  DRIVE_FOLDER_MIME, DRIVE_SCOPE, DriveError, resetDriveForTests, setDriveFactory,
} from './clientCore';
export type {
  DriveClient, DriveErrorCode, DriveFileMeta, DriveMediaSource, DrivePermission, DriveUploadMeta,
} from './clientCore';
