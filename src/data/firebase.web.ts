// Web adapter: Firebase JS SDK, online-only, in-memory persistence.
// Implements FirebaseAdapter (src/data/adapter.ts). No durable cache, no
// Crashlytics; sign-in is Google popup with a redirect fallback (OQ-27, DR-18).
// This file must stay importable in Node for the emulator test suite, so it
// never imports react-native and guards all window access.

import { FirebaseApp, FirebaseError, getApps, initializeApp } from 'firebase/app';
import {
  Auth, browserLocalPersistence, getAuth, GoogleAuthProvider,
  linkWithPopup, linkWithRedirect, OAuthCredential, onAuthStateChanged, setPersistence,
  signInAnonymously, signInWithCredential, signInWithPopup, signInWithRedirect, signOut, User,
} from 'firebase/auth';
import {
  collection, connectFirestoreEmulator, doc, DocumentSnapshot, Firestore,
  getDoc, getDocFromServer, getDocs, getDocsFromServer, getFirestore, limit as qLimit,
  onSnapshot, orderBy as qOrderBy, query, QueryConstraint, QuerySnapshot,
  arrayUnion as fsArrayUnion, serverTimestamp, setDoc, updateDoc, deleteDoc,
  Timestamp as FsTimestamp,
  waitForPendingWrites, where as qWhere, writeBatch, WriteBatch as SdkWriteBatch,
} from 'firebase/firestore';
import {
  AuthError, AuthUser, CommitHandle, DocSnap, FirebaseAdapter, isArrayUnion,
  normalizeAuthError, normalizeError, QuerySnap, QuerySpec, RepoError,
  SERVER_TIMESTAMP, WriteBatch, WriteOpRecord,
} from './adapter';
import {
  FIRESTORE_EMULATOR_HOST, FirebaseConfigError, firebaseConfig, GOOGLE_WEB_CLIENT_ID,
  missingFirebaseEnvVars,
} from './firebaseConfig';
import type { Timestamp as DomainTimestamp } from './schema/common';

export interface WebAdapterDeps {
  app?: FirebaseApp;
  firestore?: Firestore;
  auth?: Auth;
  /** Test hook: a fixed user instead of a real Auth instance. */
  user?: AuthUser | null;
}

// --- value encoding --------------------------------------------------------

// Domain timestamps are plain { seconds, nanoseconds } objects; on write they
// become Firestore Timestamp instances, and SERVER_TIMESTAMP becomes the
// server sentinel.
function isTimestampLike(v: unknown): v is DomainTimestamp {
  return (
    typeof v === 'object' && v !== null &&
    Number.isInteger((v as DomainTimestamp).seconds) &&
    Number.isInteger((v as DomainTimestamp).nanoseconds) &&
    Object.keys(v as object).length === 2
  );
}

export function encodeWriteData(data: unknown): unknown {
  if (data === SERVER_TIMESTAMP) return serverTimestamp();
  if (isArrayUnion(data)) return fsArrayUnion(...data.__milevanaArrayUnion.map(encodeWriteData));
  if (isTimestampLike(data)) return new FsTimestamp(data.seconds, data.nanoseconds);
  if (Array.isArray(data)) return data.map(encodeWriteData);
  if (typeof data === 'object' && data !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = encodeWriteData(v);
    return out;
  }
  return data;
}

// Firestore Timestamps are detected by shape (not instanceof) so values from a
// differently-bundled SDK version still decode.
export function decodeValue(v: unknown): unknown {
  if (
    typeof v === 'object' && v !== null &&
    typeof (v as { toMillis?: unknown }).toMillis === 'function' &&
    typeof (v as { seconds?: unknown }).seconds === 'number' &&
    typeof (v as { nanoseconds?: unknown }).nanoseconds === 'number'
  ) {
    const t = v as { seconds: number; nanoseconds: number };
    return { seconds: t.seconds, nanoseconds: t.nanoseconds };
  }
  if (Array.isArray(v)) return v.map(decodeValue);
  if (typeof v === 'object' && v !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = decodeValue(val);
    return out;
  }
  return v;
}

// --- snapshots -------------------------------------------------------------

function toDocSnap(s: DocumentSnapshot): DocSnap {
  return {
    id: s.id,
    exists: s.exists(),
    data: s.exists() ? (decodeValue(s.data()) as Record<string, unknown>) : undefined,
    hasPendingWrites: s.metadata.hasPendingWrites,
    fromCache: s.metadata.fromCache,
  };
}

function toQuerySnap(s: QuerySnapshot): QuerySnap {
  return {
    docs: s.docs.map(toDocSnap),
    hasPendingWrites: s.metadata.hasPendingWrites,
    fromCache: s.metadata.fromCache,
  };
}

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { uid: u.uid, isAnonymous: u.isAnonymous, displayName: u.displayName, email: u.email };
}

function buildQuery(db: Firestore, spec: QuerySpec) {
  const clauses: QueryConstraint[] = spec.clauses.map((c) => {
    if (c.kind === 'where') return qWhere(c.field, c.op as never, encodeWriteData(c.value));
    if (c.kind === 'orderBy') return qOrderBy(c.field, c.direction);
    return qLimit(c.n);
  });
  return query(collection(db, spec.collection), ...clauses);
}

// --- adapter factory -------------------------------------------------------

export function createWebAdapter(deps: WebAdapterDeps = {}): FirebaseAdapter {
  const app = deps.app ?? (getApps()[0] ?? initializeApp(firebaseConfig));
  const db = deps.firestore ?? getFirestore(app);
  const auth = deps.auth ?? (deps.user === undefined ? getAuth(app) : undefined);
  const fixedUser = deps.user;
  let pending = 0;
  // Conflict flow: the Google credential from a failed link, memory only (OQ-06).
  let retainedCredential: OAuthCredential | null = null;

  const mkHandle = (p: Promise<unknown>, ops: number, journal?: WriteOpRecord[]): CommitHandle => {
    pending += 1;
    const ack = Promise.resolve(p)
      .catch((e) => { throw normalizeError(e); })
      .then(() => { pending -= 1; }, (e) => { pending -= 1; throw e; });
    ack.catch(() => undefined); // callers observe the failure via handle.ack
    return { ops, ack, journal };
  };

  const batchMap = new WeakMap<WriteBatch, { batch: SdkWriteBatch; journal: WriteOpRecord[] }>();

  const isBrowser = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  let online = isBrowser ? window.navigator.onLine : true;

  const adapter: FirebaseAdapter = {
    platform: 'web',
    awaitWriteAck: true, // web has no durable queue; saves await the server (FR-OFF-06)

    now: () => {
      const t = FsTimestamp.now();
      return { seconds: t.seconds, nanoseconds: t.nanoseconds };
    },

    async getDoc(path, source = 'default') {
      try {
        const s = await (source === 'server' ? getDocFromServer(doc(db, path)) : getDoc(doc(db, path)));
        return toDocSnap(s);
      } catch (e) {
        throw normalizeError(e);
      }
    },

    async getDocs(spec, source = 'default') {
      try {
        const s = await (source === 'server' ? getDocsFromServer(buildQuery(db, spec)) : getDocs(buildQuery(db, spec)));
        return toQuerySnap(s);
      } catch (e) {
        throw normalizeError(e);
      }
    },

    onDoc(path, next, onError) {
      return onSnapshot(
        doc(db, path),
        (s) => next(toDocSnap(s)),
        (e) => onError?.(normalizeError(e)),
      );
    },

    onQuery(spec, next, onError) {
      return onSnapshot(
        buildQuery(db, spec),
        (s) => next(toQuerySnap(s)),
        (e) => onError?.(normalizeError(e)),
      );
    },

    newDocId(collectionPath) {
      return doc(collection(db, collectionPath)).id;
    },

    batch() {
      const sdk = writeBatch(db);
      const journal: WriteOpRecord[] = [];
      const w: WriteBatch = {
        set: (path, data) => { journal.push({ op: 'set', path, data }); sdk.set(doc(db, path), encodeWriteData(data) as Record<string, unknown>); },
        update: (path, data) => { journal.push({ op: 'update', path, data }); sdk.update(doc(db, path), encodeWriteData(data) as Record<string, unknown>); },
        delete: (path) => { journal.push({ op: 'delete', path }); sdk.delete(doc(db, path)); },
      };
      batchMap.set(w, { batch: sdk, journal });
      return w;
    },

    commit(b) {
      const sdk = batchMap.get(b);
      if (!sdk) throw new RepoError('invalid-argument', 'batch not created by this adapter');
      batchMap.delete(b);
      return mkHandle(sdk.batch.commit(), sdk.journal.length, sdk.journal);
    },

    setDoc(path, data) {
      return mkHandle(setDoc(doc(db, path), encodeWriteData(data) as Record<string, unknown>), 1,
        [{ op: 'set', path, data: data as Record<string, unknown> }]);
    },
    updateDoc(path, data) {
      return mkHandle(updateDoc(doc(db, path), encodeWriteData(data) as Record<string, unknown>), 1,
        [{ op: 'update', path, data: data as Record<string, unknown> }]);
    },
    deleteDoc(path) {
      return mkHandle(deleteDoc(doc(db, path)), 1, [{ op: 'delete', path }]);
    },

    pendingWriteCount: () => pending,
    waitForPendingWrites: () => waitForPendingWrites(db).then(() => undefined),
    clearPersistence: () => Promise.resolve(), // in-memory only; safe no-op (SC-DAT04-05)

    onConnectivityChanged(cb) {
      if (!isBrowser) return () => undefined;
      const up = () => { online = true; cb(true); };
      const down = () => { online = false; cb(false); };
      window.addEventListener('online', up);
      window.addEventListener('offline', down);
      return () => {
        window.removeEventListener('online', up);
        window.removeEventListener('offline', down);
      };
    },
    isOnline: () => online,

    currentUser() {
      if (fixedUser !== undefined) return fixedUser;
      return toAuthUser(auth?.currentUser ?? null);
    },

    onAuthStateChanged(cb) {
      if (fixedUser !== undefined) {
        cb(fixedUser);
        return () => undefined;
      }
      if (!auth) return () => undefined;
      return onAuthStateChanged(auth, (u) => cb(toAuthUser(u)));
    },

    async signInAnonymously() {
      if (!auth) throw new AuthError('unavailable', 'no auth instance');
      try {
        const cred = await signInAnonymously(auth);
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    async signInWithGoogle() {
      if (!auth) throw new AuthError('unavailable', 'no auth instance');
      // Basic sign-in scopes only; drive.file is added in tab 5 (FR-LINK-07).
      const provider = new GoogleAuthProvider();
      try {
        await setPersistence(auth, browserLocalPersistence);
        const cred = await signInWithPopup(auth, provider);
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        const err = normalizeAuthError(e);
        // DR-18: a blocked popup starts the redirect flow; a user-cancelled one does not.
        if (err.code === 'popup-blocked') {
          await signInWithRedirect(auth, provider);
          throw new AuthError('redirect-started');
        }
        throw err;
      }
    },

    async linkWithGoogle() {
      const u = auth?.currentUser;
      if (!auth || !u) throw new AuthError('unavailable', 'no signed-in user');
      const provider = new GoogleAuthProvider();
      try {
        const cred = await linkWithPopup(u, provider);
        retainedCredential = null;
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        const err = normalizeAuthError(e);
        if (err.code === 'popup-blocked') {
          await linkWithRedirect(u, provider);
          throw new AuthError('redirect-started');
        }
        // Keep the Google credential (memory only) for the conflict dialog's
        // Switch paths — it is the only way to sign in without re-prompting.
        if (err.code === 'credential-already-in-use') {
          retainedCredential = GoogleAuthProvider.credentialFromError(e as FirebaseError);
        }
        throw err;
      }
    },

    async signInWithRetainedCredential() {
      if (!auth) throw new AuthError('unavailable', 'no auth instance');
      if (!retainedCredential) throw new AuthError('cancelled', 'no retained credential');
      try {
        const cred = await signInWithCredential(auth, retainedCredential);
        retainedCredential = null;
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    discardRetainedCredential() {
      retainedCredential = null;
    },

    async signOut() {
      if (!auth) return;
      try {
        await signOut(auth);
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    reportNonFatal(error, context) {
      // No web crash reporting in v1 (OQ-10): console only.
      if (typeof console !== 'undefined') {
        console.warn('[non-fatal]', (error as Error)?.name ?? 'error', (error as Error)?.message ?? '', context ?? {});
      }
    },

    testCrash() {
      // No web crash reporting in v1 (OQ-10): deliberately a no-op.
    },
  };

  return adapter;
}

let singleton: FirebaseAdapter | null = null;

/**
 * Lazily created default adapter (env config); emulator hookup is dev-only.
 * A missing/invalid EXPO_PUBLIC_FIREBASE_* surfaces as FirebaseConfigError so
 * startup can show the config gate instead of a blank page.
 */
export function getFirebase(): FirebaseAdapter {
  if (!singleton) {
    const missing = missingFirebaseEnvVars();
    if (missing.length > 0) throw new FirebaseConfigError(missing);
    try {
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const db = getFirestore(app);
      if (FIRESTORE_EMULATOR_HOST) {
        const [host, port] = FIRESTORE_EMULATOR_HOST.split(':');
        connectFirestoreEmulator(db, host, Number(port));
      }
      singleton = createWebAdapter({ app, firestore: db });
    } catch (e) {
      // e.g. auth/invalid-api-key from getAuth — report as a config problem
      throw e instanceof FirebaseConfigError ? e : new FirebaseConfigError([], e);
    }
  }
  return singleton;
}

// Used by tab-5 Drive token flows; re-exported so platform code never reaches
// into firebaseConfig directly.
export { GOOGLE_WEB_CLIENT_ID };
