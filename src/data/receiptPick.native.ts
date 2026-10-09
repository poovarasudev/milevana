// Android receipt picking (DRV-11): camera or gallery via expo-image-picker,
// PDFs via expo-document-picker (≤5 MB, ED-07). Photos are resized to a 1600 px
// long edge and saved as JPEG quality 80 — orientation is applied and EXIF
// metadata dropped by the render step (ED-07). Output lands in app-private
// staging so no photo-library permission is needed (ED-03/OQ-50).

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { localFiles } from './localFiles';
import {
  PDF_MAX_BYTES,
  PHOTO_LONG_EDGE,
  PHOTO_QUALITY,
  PickedReceipt,
  ReceiptPickError,
  ReceiptPicker,
} from './receiptPick';

let seq = 0;
const nextName = (ext: string) => `receipt-${Date.now()}-${++seq}.${ext}`;

async function compressImage(uri: string, width: number, height: number): Promise<PickedReceipt> {
  const longest = Math.max(width, height);
  const actions = longest > PHOTO_LONG_EDGE
    ? [{ resize: width >= height ? { width: PHOTO_LONG_EDGE } : { height: PHOTO_LONG_EDGE } }]
    : [];
  const rendered = await manipulateAsync(uri, actions, {
    compress: PHOTO_QUALITY,
    format: SaveFormat.JPEG,
  });
  const staged = await localFiles().stage(rendered.uri, nextName('jpg'));
  return { kind: 'image', mimeType: 'image/jpeg', uri: staged.uri, sizeBytes: staged.sizeBytes };
}

async function pickAsset(source: 'camera' | 'gallery'): Promise<ImagePicker.ImagePickerAsset | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

export function createNativeReceiptPicker(): ReceiptPicker {
  return {
    async pickImage(source) {
      let asset: ImagePicker.ImagePickerAsset;
      try {
        const a = await pickAsset(source);
        if (!a) return null;
        asset = a;
      } catch (e) {
        const code = String((e as { code?: string })?.code ?? '');
        throw new ReceiptPickError(code.includes('permission') || code.includes('denied') ? 'denied' : 'unavailable', code);
      }
      return compressImage(asset.uri, asset.width ?? PHOTO_LONG_EDGE, asset.height ?? PHOTO_LONG_EDGE);
    },

    async pickPdf() {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return null;
      const asset = res.assets[0];
      if (!asset) return null;
      const size = asset.size ?? (await localFiles().size(asset.uri)) ?? 0;
      if (size > PDF_MAX_BYTES) throw new ReceiptPickError('pdf-too-large', `${size}`);
      const staged = await localFiles().stage(asset.uri, nextName('pdf'));
      return { kind: 'pdf', mimeType: 'application/pdf', uri: staged.uri, sizeBytes: staged.sizeBytes };
    },
  };
}

let singleton: ReceiptPicker | null = null;
export function receiptPicker(): ReceiptPicker {
  if (!singleton) singleton = createNativeReceiptPicker();
  return singleton;
}
