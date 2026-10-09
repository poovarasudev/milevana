// The platform adapter contract (FND-DAT-03/DAT-04). Only repositories talk to
// Firestore and only adapter files know which SDK is running (FR-DATA-01,
// NFR-14). Everything above this file is SDK-agnostic.

import type { Timestamp } from './schema/common';

export type { Timestamp };

/** Normalized, SDK-agnostic error codes surfaced to repositories and UI. */
export type RepoErrorCode =
  | 'permission-denied'
  | 'resource-exhausted'
  | 'unavailable'
  | 'offline'
  | 'not-found'
  | 'aborted'
  | 'cancelled'
  | 'invalid-argument'
  | 'unknown';

export class RepoError extends Error {
  constructor(
    public code: RepoErrorCode,
    message = '',
  ) {
    super(message || code);
    this.name = 'RepoError';
  }
}

/** Normalized auth error codes (FR-ERR table, DR-18, OQ-27). */
export type AuthErrorCode =
  | 'cancelled'
  | 'popup-blocked'
  | 'redirect-started' // web: the redirect flow has begun; the page is navigating away
  | 'network'
  | 'credential-already-in-use'
  | 'requires-recent-login'
  | 'unavailable'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message = '',
    public cause?: unknown,
  ) {
    super(message || code);
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
}

export interface DocSnap<T = Record<string, unknown>> {
  id: string;
  exists: boolean;
  data: T | undefined;
  hasPendingWrites: boolean;
  fromCache: boolean;
}

export interface QuerySnap<T = Record<string, unknown>> {
  docs: DocSnap<T>[];
  hasPendingWrites: boolean;
  fromCache: boolean;
}

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains' | 'array-contains-any';

export type QueryClause =
  | { kind: 'where'; field: string; op: WhereOp; value: unknown }
  | { kind: 'orderBy'; field: string; direction?: 'asc' | 'desc' }
  | { kind: 'limit'; n: number };

export interface QuerySpec {
  collection: string; // slash-separated path, e.g. 'vehicles/v1/entries'
  clauses: QueryClause[];
}

export type ReadSource = 'default' | 'server' | 'cache';

/**
 * A committed write. `ack` resolves when the server confirms (or rejects with a
 * RepoError). On Android `commit()` returns immediately while `ack` is still
 * pending; on web repositories await `ack` before resolving to the caller.
 */
export interface CommitHandle {
  ops: number;
  ack: Promise<void>;
}

export interface WriteBatch {
  set(path: string, data: Record<string, unknown>): void;
  update(path: string, data: Record<string, unknown>): void;
  delete(path: string): void;
}

export type Unsubscribe = () => void;

/** Marker written into document data to request a server timestamp. */
export const SERVER_TIMESTAMP = Object.freeze({ __milevanaServerTimestamp: true as const });
export type ServerTimestampMarker = typeof SERVER_TIMESTAMP;

export interface FirebaseAdapter {
  readonly platform: 'native' | 'web';
  /**
   * When true the SDK's write promise resolves only after server confirmation
   * and there is no durable local queue (web): repositories must await `ack`.
   * When false (Android) writes apply locally at once and `ack` settles later.
   */
  readonly awaitWriteAck: boolean;

  /** Current device time as a Timestamp value (for repository-written fields). */
  now(): Timestamp;

  // --- reads ---
  getDoc(path: string, source?: ReadSource): Promise<DocSnap>;
  getDocs(query: QuerySpec, source?: ReadSource): Promise<QuerySnap>;
  onDoc(
    path: string,
    next: (snap: DocSnap) => void,
    onError?: (err: RepoError) => void,
  ): Unsubscribe;
  onQuery(
    query: QuerySpec,
    next: (snap: QuerySnap) => void,
    onError?: (err: RepoError) => void,
  ): Unsubscribe;

  // --- writes ---
  newDocId(collectionPath: string): string;
  batch(): WriteBatch;
  /** Commit a batch; returns at once on both platforms. See `ack`. */
  commit(b: WriteBatch): CommitHandle;
  setDoc(path: string, data: Record<string, unknown>): CommitHandle;
  updateDoc(path: string, data: Record<string, unknown>): CommitHandle;
  deleteDoc(path: string): CommitHandle;

  // --- pending writes & persistence ---
  /** Number of commits issued through this adapter whose ack has not settled. */
  pendingWriteCount(): number;
  waitForPendingWrites(): Promise<void>;
  /** Empties the durable cache. Android only; a safe no-op on web. */
  clearPersistence(): Promise<void>;
  /** Browser online/offline events on web; a no-op subscription on native. */
  onConnectivityChanged(cb: (online: boolean) => void): Unsubscribe;
  isOnline(): boolean;

  // --- auth ---
  currentUser(): AuthUser | null;
  onAuthStateChanged(cb: (user: AuthUser | null) => void): Unsubscribe;
  signInAnonymously(): Promise<AuthUser>;
  /** Google sign-in: popup with redirect fallback on web (OQ-27, DR-18). */
  signInWithGoogle(): Promise<AuthUser>;
  /** Link the current (anonymous) account with Google. */
  linkWithGoogle(): Promise<AuthUser>;
  signOut(): Promise<void>;

  // --- diagnostics ---
  /** Non-fatal report hook (Crashlytics on native, no-op on web). Carries only
   * codes and paths — never amounts, plates, names or notes (PRV-03). */
  reportNonFatal(error: unknown, context?: Record<string, string>): void;
}

/** Map an SDK error to a normalized RepoError. */
export function normalizeError(err: unknown): RepoError {
  if (err instanceof RepoError) return err;
  const code = String((err as { code?: string })?.code ?? '');
  if (code.endsWith('permission-denied')) return new RepoError('permission-denied');
  if (code.endsWith('resource-exhausted')) return new RepoError('resource-exhausted');
  if (code.endsWith('not-found')) return new RepoError('not-found');
  if (code.endsWith('unavailable') || code.endsWith('network-request-failed'))
    return new RepoError('unavailable', code);
  if (code.endsWith('unauthenticated')) return new RepoError('permission-denied', code);
  if (code.endsWith('aborted') || code.endsWith('deadline-exceeded')) return new RepoError('aborted', code);
  if (code.endsWith('invalid-argument') || code.endsWith('failed-precondition'))
    return new RepoError('invalid-argument', code);
  if (code.endsWith('cancelled')) return new RepoError('cancelled', code);
  return new RepoError('unknown', code || String(err));
}

/** Map an auth error from either SDK / google-signin to a normalized code. */
export function normalizeAuthError(err: unknown): AuthError {
  if (err instanceof AuthError) return err;
  const code = String((err as { code?: string })?.code ?? '');
  switch (code) {
    case 'auth/credential-already-in-use':
      return new AuthError('credential-already-in-use', code, err);
    case 'auth/requires-recent-login':
      return new AuthError('requires-recent-login', code, err);
    case 'auth/popup-blocked':
    case 'auth/popup-closed-by-browser':
      return new AuthError('popup-blocked', code, err);
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'SIGN_IN_CANCELLED': // @react-native-google-signin
    case '-1': // google-signin generic cancel on some versions
      return new AuthError('cancelled', code, err);
    case 'auth/network-request-failed':
      return new AuthError('network', code, err);
    case 'auth/unavailable':
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return new AuthError('unavailable', code, err);
    default:
      return new AuthError('unknown', code || String(err), err);
  }
}
