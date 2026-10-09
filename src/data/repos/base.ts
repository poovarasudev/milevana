// Shared repository infrastructure (FND-DAT-05). Every read runs through zod
// validation + upgrade-on-read; malformed documents are skipped and reported
// with safe metadata only. Every write returns a CommitHandle whose `ack`
// settles on the server response; repositories await it only when the adapter
// says the platform has no durable queue (web).

import type { ZodType } from 'zod';
import type {
  CommitHandle, DocSnap, FirebaseAdapter, QuerySnap, RepoErrorCode, Unsubscribe, WriteOpRecord,
} from '../adapter';
import { RepoError } from '../adapter';
import type { DocKind } from '../schema/common';
import { parseDoc } from '../schema/upgrade';

/** Safe malformed-document report: id, path and failure code only (PRV-03). */
export interface MalformedDocInfo {
  kind: DocKind;
  id: string;
  path: string;
  code: 'invalid' | 'newer-schema' | 'no-upgrader';
  /** Zod issue paths — field names only, never values. */
  paths: string[];
}

export type MalformedReporter = (info: MalformedDocInfo) => void;

/**
 * Settlement event for every adapter write (FND-OBS-02/04). `ok:false` events
 * carry the normalized code and the commit journal (op kinds + paths, never
 * document data) so Sync issues can offer Retry and Discard (DR-19).
 */
export type WriteEvent =
  | { ok: true }
  | { ok: false; code: RepoErrorCode; journal: WriteOpRecord[] };

const writeObservers = new Set<(ev: WriteEvent) => void>();

/** Subscribe to write settlements (Sync issues, quota notices). */
export function addWriteObserver(cb: (ev: WriteEvent) => void): Unsubscribe {
  writeObservers.add(cb);
  return () => writeObservers.delete(cb);
}

function notifyWrite(ev: WriteEvent): void {
  for (const cb of writeObservers) {
    try {
      cb(ev);
    } catch {
      // observers are UI-side; they must never break a write path
    }
  }
}

export class RepoBase {
  constructor(
    protected readonly adapter: FirebaseAdapter,
    protected readonly reportMalformed: MalformedReporter = (info) =>
      adapter.reportNonFatal(
        new RepoError('invalid-argument', `malformed ${info.kind} doc`),
        { kind: info.kind, id: info.id, code: info.code, paths: info.paths.join(',') },
      ),
  ) {}

  /**
   * Read a doc, treating permission-denied as absent: a doc the caller can't
   * see (non-member, or parent deleted) is indistinguishable from a missing
   * one — deliberately, so reads never leak existence.
   */
  protected async safeGet(path: string): Promise<DocSnap> {
    try {
      return await this.adapter.getDoc(path);
    } catch (e) {
      if (e instanceof RepoError && e.code === 'permission-denied') {
        return { id: path.split('/').pop()!, exists: false, data: undefined, hasPendingWrites: false, fromCache: false };
      }
      throw e;
    }
  }

  protected callerUid(): string {
    const u = this.adapter.currentUser();
    if (!u) throw new RepoError('permission-denied', 'not signed in');
    return u.uid;
  }

  /** Validate one document; returns null (and reports) when malformed. */
  protected parse<T>(kind: DocKind, schema: ZodType<T>, snap: DocSnap, path: string): T | null {
    const r = parseDoc(kind, schema, snap.data);
    if (!r.ok) {
      this.reportMalformed({ kind, id: snap.id, path, code: r.code, paths: r.paths });
      return null;
    }
    return r.data;
  }

  /** Validate a query result: malformed docs are skipped, never thrown. */
  protected parseAll<T>(kind: DocKind, schema: ZodType<T>, snap: QuerySnap, pathPrefix: string): T[] {
    const out: T[] = [];
    for (const d of snap.docs) {
      const v = this.parse(kind, schema, d, `${pathPrefix}/${d.id}`);
      if (v !== null) out.push(v);
    }
    return out;
  }

  /**
   * Platform write semantics (FND-DAT-04): Android's durable queue means the
   * write is already durable when the SDK call returns, so resolve at once and
   * report a permanent ack failure non-fatally. Web has no local queue, so the
   * caller's promise IS the server ack.
   */
  protected async finishWrite(h: CommitHandle): Promise<void> {
    if (this.adapter.awaitWriteAck) {
      try {
        await h.ack;
        notifyWrite({ ok: true });
      } catch (e) {
        const code = e instanceof RepoError ? e.code : 'unknown';
        notifyWrite({ ok: false, code, journal: h.journal ?? [] });
        throw e;
      }
      return;
    }
    h.ack.then(
      () => notifyWrite({ ok: true }),
      (e) => {
        const code = e instanceof RepoError ? e.code : 'unknown';
        notifyWrite({ ok: false, code, journal: h.journal ?? [] });
        this.adapter.reportNonFatal(e instanceof RepoError ? e : new RepoError('unknown'), {
          stage: 'write-ack',
          code,
        });
      },
    );
  }
}

export interface WatchOptions {
  onError?: (err: RepoError) => void;
}
