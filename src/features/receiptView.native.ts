// Android receipt viewing (DRV-13): cache-first — a downloaded receipt stays
// in the 100 MB LRU cache for offline viewing; a miss downloads from Drive
// into the cache dir. PDFs open in a system viewer through a content uri
// (temporary local file, ED-07). Drive 'not-found' propagates so the caller
// can mark the attachment 'missing'.

import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { drive, DriveError } from '../data/drive/client';
import { localFiles } from '../data/localFiles';
import type { AttachmentDoc } from '../data/schema/entry';
import { cachedReceiptUri, clearReceiptCache, receiptToCache } from './receiptCache';
import type { ReceiptSource, ReceiptViewer } from './receiptView';

async function fileFor(att: AttachmentDoc): Promise<string> {
  const cached = await cachedReceiptUri(att.id);
  if (cached) return cached;
  if (!att.driveFileId) throw new DriveError('not-found', att.id);
  const ext = att.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
  const dest = localFiles().cachePath(`${att.id}.${ext}`);
  const bytes = await drive().downloadToPath(att.driveFileId, dest);
  await receiptToCache(att.id, dest, bytes);
  return dest;
}

export function createNativeReceiptViewer(): ReceiptViewer {
  return {
    async source(att) {
      return { uri: await fileFor(att) } satisfies ReceiptSource;
    },
    async open(att) {
      const uri = await fileFor(att);
      const contentUri = await getContentUriAsync(uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: att.mimeType,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });
    },
    clear: () => clearReceiptCache(),
  };
}

let singleton: ReceiptViewer | null = null;
export function receiptViewer(): ReceiptViewer {
  if (!singleton) singleton = createNativeReceiptViewer();
  return singleton;
}
