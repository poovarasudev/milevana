// In-memory FirebaseAdapter for feature-layer unit tests. Implements the whole
// contract with a plain Map store; watchers fire synchronously on writes.
// `nextCommit` controls ack behaviour for the Sync issues tests.

import {
  AuthUser, CommitHandle, DocSnap, FirebaseAdapter, QueryClause, QuerySnap,
  QuerySpec, RepoError, Unsubscribe, WriteBatch, WriteOpRecord,
} from '../../data/adapter';
import { Timestamp } from '../../data/schema/common';

const seg = (path: string) => path.split('/');

function matchesClause(doc: Record<string, unknown>, c: Extract<QueryClause, { kind: 'where' }>): boolean {
  const v = doc[c.field];
  switch (c.op) {
    case '==': return v === c.value;
    case '!=': return v !== c.value;
    case 'array-contains': return Array.isArray(v) && v.includes(c.value);
    case 'array-contains-any': return Array.isArray(v) && (c.value as unknown[]).some((x) => v.includes(x));
    case 'in': return (c.value as unknown[]).includes(v);
    case '<': return (v as number) < (c.value as number);
    case '<=': return (v as number) <= (c.value as number);
    case '>': return (v as number) > (c.value as number);
    case '>=': return (v as number) >= (c.value as number);
    default: return true;
  }
}

export class FakeAdapter implements FirebaseAdapter {
  platform: 'native' | 'web';
  awaitWriteAck: boolean;
  docs = new Map<string, Record<string, unknown>>();
  user: AuthUser | null = null;
  authCbs: ((u: AuthUser | null) => void)[] = [];
  connCbs: ((online: boolean) => void)[] = [];
  docListeners = new Map<string, Set<(s: DocSnap) => void>>();
  queryListeners = new Map<QuerySpec, Set<(s: QuerySnap) => void>>();
  pending = 0;
  reports: { error: unknown; context?: Record<string, string> }[] = [];
  crashes = 0;
  anonFail: Error | null = null;
  commitAck: 'ok' | { reject: RepoError } = 'ok';
  lastBatch: WriteOpRecord[] = [];
  signInAs: AuthUser | null = null; // what signInWithGoogle/retained returns
  linkError: Error | null = null;
  retainedCredential = false;

  constructor(platform: 'native' | 'web' = 'native') {
    this.platform = platform;
    this.awaitWriteAck = platform === 'web';
  }

  now(): Timestamp {
    return { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 };
  }

  private snap(path: string): DocSnap {
    return { id: seg(path).pop()!, exists: this.docs.has(path), data: this.docs.get(path), hasPendingWrites: false, fromCache: true };
  }

  private querySnap(q: QuerySpec) {
    const depth = seg(q.collection).length;
    let docs = [...this.docs.entries()]
      .filter(([p]) => p.startsWith(q.collection + '/') && seg(p).length === depth + 1)
      .map(([p, data]) => ({ id: seg(p).pop()!, exists: true, data, hasPendingWrites: false, fromCache: true }));
    for (const c of q.clauses) {
      if (c.kind === 'where') docs = docs.filter((d) => matchesClause(d.data as Record<string, unknown>, c));
    }
    const order = q.clauses.find((c): c is Extract<QueryClause, { kind: 'orderBy' }> => c.kind === 'orderBy');
    if (order) {
      const f = order.field;
      const dir = order.direction === 'desc' ? -1 : 1;
      docs.sort((a, b) => {
        const av = (a.data as Record<string, unknown>)[f];
        const bv = (b.data as Record<string, unknown>)[f];
        const an = typeof av === 'object' && av !== null ? (av as Timestamp).seconds : (av as number) ?? 0;
        const bn = typeof bv === 'object' && bv !== null ? (bv as Timestamp).seconds : (bv as number) ?? 0;
        return (an - bn) * dir;
      });
    }
    const lim = q.clauses.find((c): c is Extract<QueryClause, { kind: 'limit' }> => c.kind === 'limit');
    if (lim) docs = docs.slice(0, lim.n);
    return { docs, hasPendingWrites: false, fromCache: true };
  }

  private emit(): void {
    for (const [path, cbs] of this.docListeners) cbs.forEach((cb) => cb(this.snap(path)));
    for (const [q, cbs] of this.queryListeners) cbs.forEach((cb) => cb(this.querySnap(q)));
  }

  async getDoc(path: string): Promise<DocSnap> { return this.snap(path); }
  async getDocs(q: QuerySpec): Promise<QuerySnap> { return this.querySnap(q); }

  onDoc(path: string, next: (s: DocSnap) => void): Unsubscribe {
    if (!this.docListeners.has(path)) this.docListeners.set(path, new Set());
    this.docListeners.get(path)!.add(next);
    next(this.snap(path));
    return () => this.docListeners.get(path)?.delete(next);
  }

  onQuery(q: QuerySpec, next: (s: QuerySnap) => void): Unsubscribe {
    if (!this.queryListeners.has(q)) this.queryListeners.set(q, new Set());
    this.queryListeners.get(q)!.add(next);
    next(this.querySnap(q));
    return () => this.queryListeners.get(q)?.delete(next);
  }

  newDocId(collectionPath: string): string {
    return `${collectionPath.split('/').pop()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  batch(): WriteBatch {
    const ops: WriteOpRecord[] = [];
    return {
      set: (path, data) => ops.push({ op: 'set', path, data }),
      update: (path, data) => ops.push({ op: 'update', path, data }),
      delete: (path) => ops.push({ op: 'delete', path }),
      // @ts-expect-error internal marker
      __ops: ops,
    };
  }

  private applyOps(ops: WriteOpRecord[]): CommitHandle {
    if (this.commitAck !== 'ok') {
      const err = this.commitAck.reject;
      return { ops: ops.length, ack: Promise.reject(err), journal: ops };
    }
    for (const o of ops) {
      if (o.op === 'delete') this.docs.delete(o.path);
      else if (o.op === 'set') this.docs.set(o.path, { ...o.data });
      else this.docs.set(o.path, { ...this.docs.get(o.path), ...o.data });
    }
    this.emit();
    return { ops: ops.length, ack: Promise.resolve(), journal: ops };
  }

  commit(b: WriteBatch): CommitHandle {
    // @ts-expect-error test-only marker
    const ops: WriteOpRecord[] = b.__ops ?? [];
    this.lastBatch = ops;
    this.pending++;
    const h = this.applyOps(ops);
    h.ack.then(() => { this.pending--; }, () => { this.pending--; });
    return h;
  }

  setDoc(path: string, data: Record<string, unknown>): CommitHandle {
    return this.applyOps([{ op: 'set', path, data }]);
  }
  updateDoc(path: string, data: Record<string, unknown>): CommitHandle {
    return this.applyOps([{ op: 'update', path, data }]);
  }
  deleteDoc(path: string): CommitHandle {
    return this.applyOps([{ op: 'delete', path }]);
  }

  pendingWriteCount(): number { return this.pending; }
  async waitForPendingWrites(): Promise<void> {}
  async clearPersistence(): Promise<void> { this.docs.clear(); }
  onConnectivityChanged(cb: (online: boolean) => void): Unsubscribe {
    this.connCbs.push(cb);
    return () => { this.connCbs = this.connCbs.filter((x) => x !== cb); };
  }
  isOnline(): boolean { return true; }
  setOnline(online: boolean): void { this.connCbs.forEach((cb) => cb(online)); }

  currentUser(): AuthUser | null { return this.user; }
  onAuthStateChanged(cb: (u: AuthUser | null) => void): Unsubscribe {
    this.authCbs.push(cb);
    return () => { this.authCbs = this.authCbs.filter((x) => x !== cb); };
  }
  setUser(u: AuthUser | null): void {
    this.user = u;
    this.authCbs.forEach((cb) => cb(u));
  }

  async signInAnonymously(): Promise<AuthUser> {
    if (this.anonFail) throw this.anonFail;
    const u: AuthUser = { uid: `anon-${Math.random().toString(36).slice(2, 8)}`, isAnonymous: true, displayName: null, email: null };
    this.setUser(u);
    return u;
  }
  async signInWithGoogle(): Promise<AuthUser> {
    if (!this.signInAs) throw new RepoError('cancelled', 'no test account');
    this.setUser(this.signInAs);
    return this.signInAs;
  }
  async linkWithGoogle(): Promise<AuthUser> {
    if (this.linkError) throw this.linkError;
    const u = this.user!;
    const linked = { ...u, isAnonymous: false, displayName: 'Test User', email: 'test@example.com' };
    this.setUser(linked);
    return linked;
  }
  async signInWithRetainedCredential(): Promise<AuthUser> {
    if (!this.retainedCredential || !this.signInAs) throw new RepoError('cancelled', 'no retained credential');
    this.retainedCredential = false;
    this.setUser(this.signInAs);
    return this.signInAs;
  }
  discardRetainedCredential(): void { this.retainedCredential = false; }
  async signOut(): Promise<void> { this.setUser(null); }

  reportNonFatal(error: unknown, context?: Record<string, string>): void {
    this.reports.push({ error, context });
  }
  testCrash(): void { this.crashes++; }
}

