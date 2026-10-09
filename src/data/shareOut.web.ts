// Web CSV delivery (DRV-16): a Blob download via a temporary anchor — no
// Google account needed, works for anonymous sessions too.

import type { ShareOut } from './shareOut';

export function createWebShareOut(): ShareOut {
  return {
    async shareText(fileName, text, mimeType) {
      if (typeof document === 'undefined') return false;
      const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.rel = 'noopener';
        a.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      return true;
    },
  };
}

let singleton: ShareOut | null = null;
export function shareOut(): ShareOut {
  if (!singleton) singleton = createWebShareOut();
  return singleton;
}
