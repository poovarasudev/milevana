// Privacy-safe non-fatal reporting (FND-OBS-05, PRV-03/PRV-13). Every report
// funnels through here: the error is reduced to its code and the context is
// restricted to a fixed key whitelist — free-text keys are dropped, invite
// codes in paths are redacted, and no uid is ever attached as a Crashlytics
// user id. On web the adapter's hook is a no-op.

import { AuthError, RepoError } from '../data/adapter';
import { adapter } from './runtime';

/** Keys that may accompany a report — everything else is dropped. */
const SAFE_KEYS = new Set([
  'path', 'id', 'kind', 'code', 'stage', 'count', 'screen', 'action', 'platform',
]);

/** Redact invite codes and trim everything to a short, safe length. */
function sanitizeValue(key: string, value: unknown): string {
  let s = String(value).slice(0, 120);
  if (key === 'path') s = s.replace(/invites\/[^/]+/g, 'invites/<redacted>');
  return s;
}

/** Strip an error down to its normalized code — messages can embed values. */
function sanitizedError(error: unknown): Error {
  if (error instanceof RepoError) return new Error(`RepoError:${error.code}`);
  if (error instanceof AuthError) return new Error(`AuthError:${error.code}`);
  return new Error(`Error:${(error as { name?: string })?.name ?? 'unknown'}`);
}

export function reportNonFatal(error: unknown, context?: Record<string, unknown>): void {
  try {
    const ctx: Record<string, string> = {};
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (SAFE_KEYS.has(key) && value !== undefined && value !== null) {
          ctx[key] = sanitizeValue(key, value);
        }
      }
    }
    adapter().reportNonFatal(sanitizedError(error), ctx);
  } catch {
    // reporting must never throw into app code
  }
}

/** Dev-build smoke trigger — adapter testCrash is a no-op on web. */
export function triggerTestCrash(): void {
  try {
    adapter().testCrash();
  } catch {
    // ignore
  }
}
