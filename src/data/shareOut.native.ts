// Android CSV delivery (DRV-16): write the export to the app temp dir, open
// the system share sheet, and delete the temp copy when the sheet closes
// (leftovers are also swept at next app start, ED-12).

import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import { localFiles } from './localFiles';
import type { ShareOut } from './shareOut';

export function createNativeShareOut(): ShareOut {
  return {
    async shareText(fileName, text, mimeType) {
      if (!(await Sharing.isAvailableAsync())) return false;
      const uri = localFiles().tempPath(fileName);
      const f = new File(uri);
      if (f.exists) f.delete();
      f.create({ intermediates: true });
      f.write(text);
      try {
        await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName });
      } finally {
        // ED-12: the temp copy goes once the share sheet closes.
        try {
          f.delete();
        } catch {
          // swept at next app start
        }
      }
      return true;
    },
  };
}

let singleton: ShareOut | null = null;
export function shareOut(): ShareOut {
  if (!singleton) singleton = createNativeShareOut();
  return singleton;
}
