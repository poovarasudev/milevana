// Android adapter: @react-native-firebase (modular API) with durable offline
// persistence — on by default on native (FR-OFF-01). Implements
// FirebaseAdapter (src/data/adapter.ts). Sign-in is Google Sign-In → Firebase
// credential link; non-fatal errors go to Crashlytics (FR-ERR-05).

import {
  getAuth, GoogleAuthProvider, linkWithCredential, onAuthStateChanged,
  signInAnonymously, signInWithCredential, signOut,
} from '@react-native-firebase/auth';
import type { User } from '@react-native-firebase/auth';
import { getCrashlytics, recordError, setAttribute } from '@react-native-firebase/crashlytics';
import {
  collection, clearPersistence, deleteDoc, doc, getDoc, getDocFromCache,
  getDocFromServer, getDocs, getDocsFromCache, getDocsFromServer,
  getFirestore, limit as qLimit, onSnapshot, orderBy as qOrderBy, query,
  serverTimestamp, setDoc, Timestamp as FsTimestamp, updateDoc,
  waitForPendingWrites, where as qWhere, writeBatch,
} from '@react-native-firebase/firestore';
import type {
  DocumentSnapshot, Firestore, Query as FsQuery, QuerySnapshot,
  QueryConstraint, UpdateData, WhereFilterOp, WriteBatch as FsWriteBatch,
} from '@react-native-firebase/firestore';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import {
  AuthError, AuthUser, CommitHandle, DocSnap, FirebaseAdapter, normalizeAuthError,
  normalizeError, QuerySnap, QuerySpec, RepoError, SERVER_TIMESTAMP, WriteBatch,
} from './adapter';
import { GOOGLE_WEB_CLIENT_ID } from './firebaseConfig';
import type { Timestamp as DomainTimestamp } from './schema/common';

// --- value encoding --------------------------------------------------------

function isTimestampLike(v: unknown): v is DomainTimestamp {
  return (
    typeof v === 'object' && v !== null &&
    Number.isInteger((v as DomainTimestamp).seconds) &&
    Number.isInteger((v as DomainTimestamp).nanoseconds) &&
    Object.keys(v as object).length === 2
  );
}

function encodeWriteData(data: unknown): unknown {
  if (data === SERVER_TIMESTAMP) return serverTimestamp();
  if (isTimestampLike(data)) return new FsTimestamp(data.seconds, data.nanoseconds);
  if (Array.isArray(data)) return data.map(encodeWriteData);
  if (typeof data === 'object' && data !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) out[k] = encodeWriteData(v);
    return out;
  }
  return data;
}

function decodeValue(v: unknown): unknown {
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
  const exists = s.exists();
  return {
    id: s.id,
    exists,
    data: exists ? (decodeValue(s.data()) as Record<string, unknown>) : undefined,
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

function buildQuery(db: Firestore, spec: QuerySpec): FsQuery {
  const clauses: QueryConstraint[] = spec.clauses.map((c) => {
    if (c.kind === 'where') return qWhere(c.field, c.op as WhereFilterOp, encodeWriteData(c.value));
    if (c.kind === 'orderBy') return qOrderBy(c.field, c.direction);
    return qLimit(c.n);
  });
  return query(collection(db, spec.collection), ...clauses);
}

let googleConfigured = false;
function configureGoogle(): void {
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      // offlineAccess is required for a Firebase credential; the same OAuth
      // client can gain drive.file incrementally in tab 5 (FR-LINK-06).
      offlineAccess: true,
    });
    googleConfigured = true;
  }
}

async function googleIdToken(): Promise<string> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) throw new AuthError('cancelled', 'sign-in cancelled');
  if (!res.data.idToken) throw new AuthError('unknown', 'no id token');
  return res.data.idToken;
}

export function createNativeAdapter(): FirebaseAdapter {
  const db = getFirestore();
  const a = getAuth();
  let pending = 0;

  const mkHandle = (p: Promise<unknown>, ops: number): CommitHandle => {
    pending += 1;
    const ack = Promise.resolve(p)
      .catch((e) => { throw normalizeError(e); })
      .then(() => { pending -= 1; }, (e) => { pending -= 1; throw e; });
    ack.catch(() => undefined);
    return { ops, ack };
  };

  const batchMap = new WeakMap<WriteBatch, { batch: FsWriteBatch; ops: number }>();

  return {
    platform: 'native',
    awaitWriteAck: false, // durable local queue: writes apply immediately (FR-OFF-01)

    now: () => {
      const t = FsTimestamp.now();
      return { seconds: t.seconds, nanoseconds: t.nanoseconds };
    },

    async getDoc(path, source = 'default') {
      try {
        const ref = doc(db, path);
        const s = await (source === 'server' ? getDocFromServer(ref) : source === 'cache' ? getDocFromCache(ref) : getDoc(ref));
        return toDocSnap(s);
      } catch (e) {
        throw normalizeError(e);
      }
    },

    async getDocs(spec, source = 'default') {
      try {
        const q = buildQuery(db, spec);
        const s = await (source === 'server' ? getDocsFromServer(q) : source === 'cache' ? getDocsFromCache(q) : getDocs(q));
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
      let ops = 0;
      const w: WriteBatch = {
        set: (path, data) => { ops += 1; sdk.set(doc(db, path), encodeWriteData(data) as UpdateData<object>); },
        update: (path, data) => { ops += 1; sdk.update(doc(db, path), encodeWriteData(data) as UpdateData<object>); },
        delete: (path) => { ops += 1; sdk.delete(doc(db, path)); },
      };
      batchMap.set(w, { batch: sdk, ops });
      return w;
    },

    commit(b) {
      const sdk = batchMap.get(b);
      if (!sdk) throw new RepoError('invalid-argument', 'batch not created by this adapter');
      batchMap.delete(b);
      return mkHandle(sdk.batch.commit(), sdk.ops);
    },

    setDoc(path, data) {
      return mkHandle(setDoc(doc(db, path), encodeWriteData(data) as UpdateData<object>), 1);
    },
    updateDoc(path, data) {
      return mkHandle(updateDoc(doc(db, path), encodeWriteData(data) as UpdateData<object>), 1);
    },
    deleteDoc(path) {
      return mkHandle(deleteDoc(doc(db, path)), 1);
    },

    pendingWriteCount: () => pending,
    waitForPendingWrites: () => waitForPendingWrites(db),
    async clearPersistence() {
      // Empties the durable cache (settings sign-out, SC-DAT04-04).
      await clearPersistence(db);
    },

    // RNFirebase exposes no connectivity event; offline is the normal local-
    // first state, so there is nothing to surface here.
    onConnectivityChanged() {
      return () => undefined;
    },
    isOnline: () => true,

    currentUser: () => toAuthUser(a.currentUser),
    onAuthStateChanged: (cb) => onAuthStateChanged(a, (u) => cb(toAuthUser(u))),

    async signInAnonymously() {
      try {
        const cred = await signInAnonymously(a);
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    async signInWithGoogle() {
      configureGoogle();
      try {
        const idToken = await googleIdToken();
        const cred = await signInWithCredential(a, GoogleAuthProvider.credential(idToken));
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    async linkWithGoogle() {
      const u = a.currentUser;
      if (!u) throw new AuthError('unavailable', 'no signed-in user');
      configureGoogle();
      try {
        const idToken = await googleIdToken();
        // A Google account already used elsewhere cannot be linked (FR-LINK-04).
        const cred = await linkWithCredential(u, GoogleAuthProvider.credential(idToken));
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    signOut: () => signOut(a),

    reportNonFatal(error, context) {
      // Codes and paths only — amounts, plates, names and notes never reach
      // Crashlytics (PRV-03).
      try {
        const c = getCrashlytics();
        const err = error instanceof Error ? error : new Error(String((error as RepoError)?.code ?? 'unknown'));
        if (context) {
          for (const [k, v] of Object.entries(context)) void setAttribute(c, k, String(v).slice(0, 100));
        }
        recordError(c, err);
      } catch {
        // Crashlytics itself must never break the app.
      }
    },
  };
}

let singleton: FirebaseAdapter | null = null;
export function getFirebase(): FirebaseAdapter {
  if (!singleton) singleton = createNativeAdapter();
  return singleton;
}
