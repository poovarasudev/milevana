// Link-Google prompts (FND-AUTH-04): the persistent More banner (UI reads
// `user.isAnonymous` directly), the one-shot prompt at the fifth entry across
// all vehicles including archived (OQ-05), and the required-step gate used by
// Drive backup / receipts / sharing (FR-LINK-03).

import { localFlags } from '../data/localFlags';
import { ANON_AUTHOR_NAME } from '../data/schema/common';
import { useAppStore } from './appStore';
import { getRepos } from './runtime';
import type { VehicleRecord } from '../data/repos/vehicleRepo';
import type { Unsubscribe } from '../data/adapter';

/** The prompt fires when the count REACHES 5 — not at 5+ (DR-09). */
export const LINK_PROMPT_AT = 5;

let entryStops = new Map<string, Unsubscribe>();
let counts = new Map<string, number>();

/**
 * Keep the capped entry watches in step with the vehicle list. Called from the
 * vehicle watcher; runs only while the user is anonymous and has not dismissed
 * the prompt. Watches are limited to LINK_PROMPT_AT docs per vehicle — we only
 * need to know the count has crossed, not the exact total.
 */
export function syncEntryWatch(vehicles: VehicleRecord[]): void {
  const st = useAppStore.getState();
  const want = !!st.user?.isAnonymous && !st.linkPromptDismissed;
  if (!want) {
    stopEntryWatch();
    return;
  }
  const ids = new Set(vehicles.map((v) => v.id));
  for (const [vid, stop] of [...entryStops]) {
    if (!ids.has(vid)) {
      stop();
      entryStops.delete(vid);
      counts.delete(vid);
    }
  }
  for (const vid of ids) {
    if (entryStops.has(vid)) continue;
    entryStops.set(
      vid,
      getRepos().entries.watch(
        vid,
        (entries) => {
          counts.set(vid, entries.length);
          const total = [...counts.values()].reduce((a, b) => a + b, 0);
          const s = useAppStore.getState();
          if (total >= LINK_PROMPT_AT && s.user?.isAnonymous && !s.linkPromptDismissed) {
            // fetch the true count once for the message text
            void getRepos()
              .entries.countAcrossVehicles([...ids])
              .then((n) => useAppStore.setState({ entryCountTotal: n }));
            if (!s.linkPromptVisible) useAppStore.setState({ linkPromptVisible: true });
          } else {
            useAppStore.setState({ entryCountTotal: total });
          }
        },
        LINK_PROMPT_AT,
      ),
    );
  }
}

export function stopEntryWatch(): void {
  for (const stop of entryStops.values()) stop();
  entryStops = new Map();
  counts = new Map();
}

/** "Not now" — the prompt never returns, the More banner stays (FR-LINK-08). */
export async function dismissLinkPrompt(): Promise<void> {
  const uid = useAppStore.getState().user?.uid;
  if (uid) await localFlags.setLinkDismissed(uid);
  useAppStore.setState({ linkPromptDismissed: true, linkPromptVisible: false });
  stopEntryWatch();
}

export function hideLinkPrompt(): void {
  useAppStore.setState({ linkPromptVisible: false });
}

// --- required-step gate (FR-LINK-03) ---------------------------------------

type GateOutcome = 'linked' | 'cancelled' | 'failed';
let pendingGate: ((outcome: GateOutcome) => void) | null = null;
let gateLauncher: (() => Promise<void>) | null = null;

/** auth.ts registers the link flow here (keeps the dependency one-way). */
export function registerGateLauncher(fn: () => Promise<void>): void {
  gateLauncher = fn;
}

/**
 * Drive backup, receipt photos and sharing call this before proceeding. Linked
 * users resolve 'linked' immediately; anonymous users start the link flow and
 * the outcome is resolved by the auth module.
 */
export function requireLinkedAccount(): Promise<GateOutcome> {
  const st = useAppStore.getState();
  if (st.user && !st.user.isAnonymous) return Promise.resolve('linked');
  if (pendingGate) return Promise.resolve('failed'); // one gate at a time
  return new Promise<GateOutcome>((resolve) => {
    if (!gateLauncher) {
      resolve('failed');
      return;
    }
    pendingGate = resolve;
    void gateLauncher();
  });
}

export function resolveGate(outcome: GateOutcome): void {
  pendingGate?.(outcome);
  pendingGate = null;
}

export function gatePending(): boolean {
  return pendingGate !== null;
}

export { ANON_AUTHOR_NAME };
