// "Give this file to the user" (DRV-16): Android share sheet via expo-sharing,
// browser download on web. Metro resolves shareOut.native.ts / shareOut.web.ts;
// Jest resolves this file and tests install a fake via setShareOutFactory.

export interface ShareOut {
  /**
   * Deliver a text file to the user. Native implementations write a temp file,
   * open the share sheet and delete the temp copy when it closes (or at next
   * app start, ED-12). Returns false when sharing isn't possible.
   */
  shareText(fileName: string, text: string, mimeType: string): Promise<boolean>;
}

let factory: (() => ShareOut) | null = null;
let instance: ShareOut | null = null;

export function setShareOutFactory(f: () => ShareOut): void {
  factory = f;
  instance = null;
}

export function shareOut(): ShareOut {
  if (!instance) {
    if (!factory) throw new Error('No ShareOut factory installed');
    instance = factory();
  }
  return instance;
}

export function resetShareOutForTests(): void {
  instance = null;
}
