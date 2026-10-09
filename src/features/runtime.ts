// Lazy adapter/repos singletons used by the feature layer and screens.
// `getFirebase` resolves to firebase.native.ts / firebase.web.ts at bundle
// time; Jest maps the specifier to firebase.ts and installs a fake factory.

import { getFirebase } from '../data/firebase';
import type { FirebaseAdapter } from '../data/adapter';
import { createRepos, Repos } from '../data/repos';
import type { MalformedDocInfo } from '../data/repos/base';

let repos: Repos | null = null;
let malformedSink: (info: MalformedDocInfo) => void = () => undefined;

/** Session layer installs the malformed-doc sink (skipped-doc notices). */
export function setMalformedSink(fn: (info: MalformedDocInfo) => void): void {
  malformedSink = fn;
}

export function adapter(): FirebaseAdapter {
  return getFirebase();
}

export function getRepos(): Repos {
  if (!repos) repos = createRepos(adapter(), (info) => malformedSink(info));
  return repos;
}

export function resetRuntimeForTests(): void {
  repos = null;
  malformedSink = () => undefined;
}
