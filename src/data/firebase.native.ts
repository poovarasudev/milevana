// Android adapter: @react-native-firebase (modular API) with durable offline
// persistence — on by default on native (FR-OFF-01). Implements
// FirebaseAdapter (src/data/adapter.ts). Sign-in is Google Sign-In → Firebase
// credential link; non-fatal errors go to Crashlytics (FR-ERR-05).

import {
  connectAuthEmulator, deleteUser, getAuth, GoogleAuthProvider, linkWithCredential,
  onAuthStateChanged, reauthenticateWithCredential, signInAnonymously,
  signInWithCredential, signOut,
} from '@react-native-firebase/auth';
import type { Auth, User } from '@react-native-firebase/auth';
import { crash as crashlyticsCrash, getCrashlytics, recordError, setAttribute } from '@react-native-firebase/crashlytics';
import {
  arrayUnion as fsArrayUnion,
  collection, clearPersistence, connectFirestoreEmulator, deleteDoc, doc,
  getDoc, getDocFromCache, getDocFromServer, getDocs, getDocsFromCache,
  getDocsFromServer, getFirestore, limit as qLimit, onSnapshot,
  orderBy as qOrderBy, query, serverTimestamp, setDoc, terminate,
  Timestamp as FsTimestamp, updateDoc, waitForPendingWrites,
  where as qWhere, writeBatch,
} from '@react-native-firebase/firestore';
import type {
  DocumentSnapshot, Firestore, Query as FsQuery, QuerySnapshot,
  QueryConstraint, UpdateData, WhereFilterOp, WriteBatch as FsWriteBatch,
} from '@react-native-firebase/firestore';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import {
  AuthError, AuthUser, CommitHandle, DocSnap, FirebaseAdapter,
  normalizeAuthError, normalizeError, QuerySnap, QuerySpec, RepoError,
  WriteBatch, WriteOpRecord,
} from './adapter';
import { makeWriteEncoder } from './encodeWrite';
import { AUTH_EMULATOR_HOST, FIRESTORE_EMULATOR_HOST, GOOGLE_WEB_CLIENT_ID } from './firebaseConfig';

// --- value encoding --------------------------------------------------------

const encodeWriteData = makeWriteEncoder({
  serverTimestamp: () => serverTimestamp(),
  arrayUnion: (...els) => fsArrayUnion(...els),
  timestamp: (s, n) => new FsTimestamp(s, n),
});

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

// Dev-build emulator hookup: EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST /
// EXPO_PUBLIC_AUTH_EMULATOR_HOST point the native SDKs at the local emulator
// suite (10.0.2.2 from the AVD). Never active in production builds — __DEV__
// is false there — and never when the vars are unset.
const useEmulators = __DEV__ && (!!FIRESTORE_EMULATOR_HOST || !!AUTH_EMULATOR_HOST);

function makeFirestore(): Firestore {
  const d = getFirestore();
  if (useEmulators && FIRESTORE_EMULATOR_HOST) {
    const [host, port] = FIRESTORE_EMULATOR_HOST.split(':');
    connectFirestoreEmulator(d, host, Number(port));
  }
  return d;
}

function connectAuthEmu(a: Auth): void {
  if (useEmulators && AUTH_EMULATOR_HOST) {
    const [host, port] = AUTH_EMULATOR_HOST.split(':');
    connectAuthEmulator(a, `http://${host}:${port}`);
  }
}

export function createNativeAdapter(): FirebaseAdapter {
  // `let` because sign-out terminates the instance before clearing persistence
  // and then rebuilds it for the next (anonymous) session.
  let db = makeFirestore();
  const a = getAuth();
  connectAuthEmu(a);
  let pending = 0;
  // Conflict flow: the Google id token from a failed link, memory only (OQ-06).
  let retainedIdToken: string | null = null;

  const mkHandle = (p: Promise<unknown>, ops: number, journal?: WriteOpRecord[]): CommitHandle => {
    pending += 1;
    const ack = Promise.resolve(p)
      .catch((e) => { throw normalizeError(e); })
      .then(() => { pending -= 1; }, (e) => { pending -= 1; throw e; });
    ack.catch(() => undefined);
    return { ops, ack, journal };
  };

  const batchMap = new WeakMap<WriteBatch, { batch: FsWriteBatch; journal: WriteOpRecord[] }>();

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
      const journal: WriteOpRecord[] = [];
      const w: WriteBatch = {
        set: (path, data) => { journal.push({ op: 'set', path, data }); sdk.set(doc(db, path), encodeWriteData(data) as UpdateData<object>); },
        update: (path, data) => { journal.push({ op: 'update', path, data }); sdk.update(doc(db, path), encodeWriteData(data) as UpdateData<object>); },
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
      return mkHandle(setDoc(doc(db, path), encodeWriteData(data) as UpdateData<object>), 1,
        [{ op: 'set', path, data: data as Record<string, unknown> }]);
    },
    updateDoc(path, data) {
      return mkHandle(updateDoc(doc(db, path), encodeWriteData(data) as UpdateData<object>), 1,
        [{ op: 'update', path, data: data as Record<string, unknown> }]);
    },
    deleteDoc(path) {
      return mkHandle(deleteDoc(doc(db, path)), 1, [{ op: 'delete', path }]);
    },

    pendingWriteCount: () => pending,
    waitForPendingWrites: () => waitForPendingWrites(db),
    async clearPersistence() {
      // Empties the durable cache on sign-out (SC-DAT04-04, FR-OUT-02). The
      // client must be terminated first; a fresh instance is created for the
      // post-sign-out session.
      try {
        await terminate(db);
      } catch {
        // already terminated — clearPersistence may still succeed
      }
      try {
        await clearPersistence(db);
      } finally {
        db = makeFirestore();
      }
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
      let idToken: string | null = null;
      try {
        idToken = await googleIdToken();
        // A Google account already used elsewhere cannot be linked (FR-LINK-04).
        const cred = await linkWithCredential(u, GoogleAuthProvider.credential(idToken));
        retainedIdToken = null;
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        const err = normalizeAuthError(e);
        // Keep the id token (memory only) so the conflict dialog can sign in
        // with the same credential without re-prompting (OQ-06).
        retainedIdToken = err.code === 'credential-already-in-use' ? idToken : null;
        throw err;
      }
    },

    async signInWithRetainedCredential() {
      if (!retainedIdToken) throw new AuthError('cancelled', 'no retained credential');
      try {
        const cred = await signInWithCredential(a, GoogleAuthProvider.credential(retainedIdToken));
        retainedIdToken = null;
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    discardRetainedCredential() {
      retainedIdToken = null;
    },

    // Recent-login re-authentication for account deletion (REL-05/06): a
    // different Google account surfaces as 'user-mismatch' (VD-06).
    async reauthenticateWithGoogle() {
      const u = a.currentUser;
      if (!u) throw new AuthError('unavailable', 'no signed-in user');
      configureGoogle();
      try {
        const idToken = await googleIdToken();
        const cred = await reauthenticateWithCredential(u, GoogleAuthProvider.credential(idToken));
        return toAuthUser(cred.user) as AuthUser;
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    // Last deletion step (VD-04): drop the Google session first so a later
    // sign-in can pick a different account.
    async deleteAccount() {
      const u = a.currentUser;
      if (!u) throw new AuthError('unavailable', 'no signed-in user');
      try {
        if (googleConfigured) await GoogleSignin.signOut();
      } catch {
        // Google sign-out failure must not block the account delete.
      }
      try {
        await deleteUser(u);
      } catch (e) {
        throw normalizeAuthError(e);
      }
    },

    async signOut() {
      // Also release the Google Sign-In session so the next sign-in can pick a
      // different account (SC-AUTH08-03).
      try {
        if (googleConfigured) await GoogleSignin.signOut();
      } catch {
        // Google sign-out failure must not block the Firebase sign-out.
      }
      await signOut(a);
    },

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

    testCrash() {
      // Dev-build smoke check for Crashlytics wiring (SC-OBS05-01).
      try {
        crashlyticsCrash(getCrashlytics());
      } catch {
        // Never break the app for a diagnostics trigger.
      }
    },
  };
}

let singleton: FirebaseAdapter | null = null;
export function getFirebase(): FirebaseAdapter {
  if (!singleton) singleton = createNativeAdapter();
  return singleton;
}
