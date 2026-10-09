// Neutral entry point so repositories never import a platform file directly.
// Metro resolves firebase.native.ts on Android and firebase.web.ts on web; in
// Node (Jest/emulator) this module loads and callers must inject a factory via
// setFirebaseFactory (the emulator suite does this in tests/setup.ts).
//
// This file contains no platform branching — the bundler does the branch.

import type { FirebaseAdapter } from './adapter';

let factory: (() => FirebaseAdapter) | null = null;
let instance: FirebaseAdapter | null = null;

/** Install the adapter factory (used by tests and by early app bootstrap). */
export function setFirebaseFactory(f: () => FirebaseAdapter): void {
  factory = f;
  instance = null;
}

export function getFirebase(): FirebaseAdapter {
  if (!instance) {
    if (!factory) {
      // Defensive: platform bundles always resolve a real adapter file, so this
      // is only reachable in tests that forgot to install a factory.
      throw new Error('No Firebase adapter factory installed');
    }
    instance = factory();
  }
  return instance;
}

/** Test helper: drop the cached adapter. */
export function resetFirebaseForTests(): void {
  instance = null;
}
