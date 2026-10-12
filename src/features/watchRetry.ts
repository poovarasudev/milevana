// Transient watch re-attach. A Firestore watch that errors is dead — the SDK
// never resumes it. Right after a vehicle is created or first selected, the
// vehicle document can lag its create ack inside the rules engine (observed
// on the emulator: the first attach gets a one-shot permission-denied while
// the doc is already committed). Re-attaching a few times rides over that
// window instead of surfacing a permanent error banner and a stuck read
// model. Real access loss stops retrying: the vehicle leaves the list,
// selection moves on, and the returned unsubscribe kills the loop.

import { RepoError } from '../data/adapter';
import type { Unsubscribe } from '../data/adapter';

const MAX_REATTACH = 3;
const RETRY_BASE_MS = 1500;

/**
 * Attach `attach` once; on `permission-denied` re-attach up to MAX_REATTACH
 * times with linear backoff, then hand the error to `onFatal`. The returned
 * unsubscribe stops the live watch and cancels a pending retry.
 */
export function watchWithRetry(
  attach: (onError: (err: RepoError) => void) => Unsubscribe,
  onFatal: (err: RepoError) => void,
): Unsubscribe {
  let stop: Unsubscribe | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let attempts = 0;

  const go = () => {
    if (stopped) return;
    stop = attach((err) => {
      if (stopped) return;
      if (err instanceof RepoError && err.code === 'permission-denied' && attempts < MAX_REATTACH) {
        attempts += 1;
        timer = setTimeout(go, RETRY_BASE_MS * attempts);
        return;
      }
      onFatal(err);
    });
  };
  go();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    stop?.();
  };
}
