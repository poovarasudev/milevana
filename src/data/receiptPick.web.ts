// Web receipt picking (ED-14): a file input that accepts images and PDFs —
// on phones 'camera' maps to the input's capture attribute so the browser
// offers the camera. No persistent staging; the Blob uploads directly and the
// entry is saved only after the upload finishes.

import { PDF_MAX_BYTES, PickedReceipt, ReceiptPickError, ReceiptPicker } from './receiptPick';

function pick(accept: string, capture?: boolean): Promise<File | null> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new ReceiptPickError('unavailable', 'no browser context'));
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // No reliable 'cancel' event — resolve null when focus returns with no file.
    input.oncancel = () => resolve(null);
    input.click();
  });
}

function toReceipt(file: File): PickedReceipt {
  if (file.type === 'application/pdf') {
    if (file.size > PDF_MAX_BYTES) throw new ReceiptPickError('pdf-too-large', `${file.size}`);
    return { kind: 'pdf', mimeType: 'application/pdf', blob: file, sizeBytes: file.size };
  }
  if (file.type.startsWith('image/')) {
    return {
      kind: 'image',
      mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      blob: file,
      sizeBytes: file.size,
    };
  }
  throw new ReceiptPickError('unavailable', `type ${file.type}`);
}

export function createWebReceiptPicker(): ReceiptPicker {
  return {
    pickImage: async (source) => {
      const f = await pick('image/*', source === 'camera');
      return f ? toReceipt(f) : null;
    },
    pickPdf: async () => {
      const f = await pick('application/pdf');
      return f ? toReceipt(f) : null;
    },
    pickFile: async (accept) => {
      const f = await pick(accept === 'pdf' ? 'application/pdf' : 'image/*,application/pdf');
      return f ? toReceipt(f) : null;
    },
  };
}

let singleton: ReceiptPicker | null = null;
export function receiptPicker(): ReceiptPicker {
  if (!singleton) singleton = createWebReceiptPicker();
  return singleton;
}
