// Web receipt viewing (DRV-13): downloads the Drive file into an object URL
// for in-app rendering or a new tab for the system viewer. Web is online-only
// so there is no persistent cache; object urls are revoked on sign-out.

import { drive, DriveError } from '../data/drive/client';
import type { ReceiptSource, ReceiptViewer } from './receiptView';

export function createWebReceiptViewer(): ReceiptViewer {
  const urls = new Set<string>();
  const urlFor = (blob: Blob): string => {
    const u = URL.createObjectURL(blob);
    urls.add(u);
    return u;
  };

  return {
    async source(att) {
      if (!att.driveFileId) throw new DriveError('not-found', att.id);
      const blob = await drive().downloadBlob(att.driveFileId);
      return { uri: urlFor(blob) } satisfies ReceiptSource;
    },
    async open(att) {
      const src = await this.source(att);
      window.open(src.uri, '_blank', 'noopener');
    },
    async clear() {
      for (const u of urls) {
        try {
          URL.revokeObjectURL(u);
        } catch {
          // already revoked
        }
      }
      urls.clear();
    },
  };
}

let singleton: ReceiptViewer | null = null;
export function receiptViewer(): ReceiptViewer {
  if (!singleton) singleton = createWebReceiptViewer();
  return singleton;
}
