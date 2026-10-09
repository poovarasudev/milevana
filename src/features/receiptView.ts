// Receipt viewing (DRV-13): a renderable local source for an uploaded
// attachment — cache-first file uri on Android, an object URL on web.
// Metro resolves receiptView.native.ts / receiptView.web.ts; Jest resolves
// this file and tests install a fake via setReceiptViewerFactory.
//
// DriveError('not-found') propagates from `source`/`open` — callers mark the
// attachment 'missing' and show "File no longer in Drive" (ED-10).

import type { AttachmentDoc } from '../data/schema/entry';

export interface ReceiptSource {
  uri: string;
  headers?: Record<string, string>;
}

export interface ReceiptViewer {
  /**
   * A local source for an uploaded attachment — downloads through the LRU
   * cache on Android, straight to an object URL on web.
   */
  source(att: AttachmentDoc): Promise<ReceiptSource>;
  /** Open in a system viewer (PDFs); images are rendered in-app via source. */
  open(att: AttachmentDoc): Promise<void>;
  /** Drop session state (object urls on web; cache files on native). */
  clear(): Promise<void>;
}

let factory: (() => ReceiptViewer) | null = null;
let instance: ReceiptViewer | null = null;

export function setReceiptViewerFactory(f: () => ReceiptViewer): void {
  factory = f;
  instance = null;
}

export function receiptViewer(): ReceiptViewer {
  if (!instance) {
    if (!factory) throw new Error('No ReceiptViewer factory installed');
    instance = factory();
  }
  return instance;
}

export function resetReceiptViewerForTests(): void {
  instance = null;
}
