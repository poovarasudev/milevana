// Write-settlement handling (FND-OBS-02/04). A rejected queued write becomes a
// Sync issue with Retry (resubmits the original ops, data included — memory
// only, DR-19) and Discard (the rejected mutation is already rolled back to
// server state, so discarding simply drops the notice). Issues are
// session-scoped and never persisted or logged with content.
//
// Quota ('resource-exhausted') is not an issue — it pauses the sync banner and
// the next successful write clears it, since Firestore retries queued writes
// by itself (FR-OFF-07).

import { addWriteObserver, WriteEvent } from '../data/repos/base';
import { useAppStore, SyncIssue } from './appStore';
import { adapter } from './runtime';
import { reportNonFatal } from './reporting';

let counter = 0;

/** Codes that mean "the server permanently refused this write". */
const ISSUE_CODES = new Set(['permission-denied', 'invalid-argument', 'not-found', 'failed-precondition']);

export function onWriteEvent(ev: WriteEvent): void {
  const st = useAppStore.getState();
  if (ev.ok) {
    if (st.quotaPaused) useAppStore.setState({ quotaPaused: false });
    return;
  }
  if (ev.code === 'resource-exhausted') {
    // FR-OFF-07: pause notice, auto-resume on the next ack.
    reportNonFatal(new Error(`RepoError:${ev.code}`), { code: ev.code, stage: 'write' });
    useAppStore.setState({ quotaPaused: true });
    return;
  }
  if (ISSUE_CODES.has(ev.code) && ev.journal.length > 0) {
    const issue: SyncIssue = { id: `issue-${++counter}`, code: ev.code, journal: ev.journal };
    useAppStore.setState({ syncIssues: [...useAppStore.getState().syncIssues, issue] });
    return;
  }
  // transient/unknown — surfaced at the call site on web; logged either way
  reportNonFatal(new Error(`RepoError:${ev.code}`), { code: ev.code, stage: 'write' });
}

/** Recompute the unsaved-changes counter (sign-out dialog, DR-16). */
export function recomputePending(): void {
  const st = useAppStore.getState();
  const pendingDocs = st.vehicles.filter((v) => v.pending).length;
  const n = Math.max(pendingDocs, safePendingCount());
  if (n !== st.pendingChanges) useAppStore.setState({ pendingChanges: n });
}

function safePendingCount(): number {
  try {
    return adapter().pendingWriteCount();
  } catch {
    return 0;
  }
}

/** Retry resubmits the journaled ops verbatim. */
export function retryIssue(id: string): void {
  const issue = useAppStore.getState().syncIssues.find((i) => i.id === id);
  if (!issue) return;
  const a = adapter();
  const b = a.batch();
  for (const op of issue.journal) {
    if (op.op === 'delete') b.delete(op.path);
    else if (op.op === 'update') b.update(op.path, op.data ?? {});
    else b.set(op.path, op.data ?? {});
  }
  const h = a.commit(b);
  h.ack.then(
    () => {
      useAppStore.setState({
        syncIssues: useAppStore.getState().syncIssues.filter((i) => i.id !== id),
      });
    },
    (e) => {
      const code = (e as { code?: string })?.code ?? 'unknown';
      reportNonFatal(e, { stage: 'sync-issue-retry', code });
      useAppStore.setState({
        syncIssues: useAppStore.getState().syncIssues.map((i) => (i.id === id ? { ...i, code } : i)),
      });
    },
  );
}

/** Discard: the rejected write is already rolled back — drop the notice. */
export function discardIssue(id: string): void {
  useAppStore.setState({
    syncIssues: useAppStore.getState().syncIssues.filter((i) => i.id !== id),
  });
}

export function installWriteObserver(): () => void {
  return addWriteObserver(onWriteEvent);
}
