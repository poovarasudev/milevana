// Receipt picking (DRV-11): camera, gallery or a PDF from files on Android;
// a file input on web (camera via the capture attribute on phones, ED-14).
// Metro resolves receiptPick.native.ts / receiptPick.web.ts; Jest resolves
// this file and tests install a fake via setReceiptPickerFactory.

export const PHOTO_LONG_EDGE = 1600;
export const PHOTO_QUALITY = 0.8;
export const PDF_MAX_BYTES = 5 * 1024 * 1024; // ED-07

/** A staged file on native ({uri}); a picked Blob on web ({blob}). */
export type PickedReceipt =
  | { kind: 'image'; mimeType: 'image/jpeg'; uri: string; sizeBytes: number }
  | { kind: 'pdf'; mimeType: 'application/pdf'; uri: string; sizeBytes: number }
  | { kind: 'image'; mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; blob: Blob; sizeBytes: number }
  | { kind: 'pdf'; mimeType: 'application/pdf'; blob: Blob; sizeBytes: number };

export class ReceiptPickError extends Error {
  code: 'pdf-too-large' | 'unavailable' | 'denied';
  constructor(code: ReceiptPickError['code'], detail?: string) {
    super(`receipt ${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'ReceiptPickError';
    this.code = code;
  }
}

export interface ReceiptPicker {
  /** Returns the picked receipt, or null when the user cancels. */
  pickImage(source: 'camera' | 'gallery'): Promise<PickedReceipt | null>;
  pickPdf(): Promise<PickedReceipt | null>;
  /** Web file input with images+pdf combined (ED-14). */
  pickFile?(accept: 'media' | 'pdf'): Promise<PickedReceipt | null>;
}

let factory: (() => ReceiptPicker) | null = null;
let instance: ReceiptPicker | null = null;

export function setReceiptPickerFactory(f: () => ReceiptPicker): void {
  factory = f;
  instance = null;
}

export function receiptPicker(): ReceiptPicker {
  if (!instance) {
    if (!factory) throw new Error('No ReceiptPicker factory installed');
    instance = factory();
  }
  return instance;
}

export function resetReceiptPickerForTests(): void {
  instance = null;
}
