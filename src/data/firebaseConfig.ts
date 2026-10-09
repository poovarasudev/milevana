// Firebase web-app config and OAuth client ids come from build-time env vars
// (EXPO_PUBLIC_*), so no secret is ever hard-coded and the same file serves
// development builds, CI and the web bundle (OQ-38). Values are supplied from
// .env locally and GitHub/EAS secrets in CI — see docs/firebase-setup-runbook.md.
// Project id is fixed: milevana (OQ-03).

export const FIREBASE_PROJECT_ID = 'milevana';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'milevana.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'milevana.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Google Sign-In (Android): the web OAuth client id is what
// @react-native-google-signin exchanges for an ID token. The same OAuth client
// can later request drive.file incrementally (FR-SCAF-04, FR-LINK-06).
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

// Optional: point the JS SDK at the local Firestore emulator (set in .env for
// local runs only, never in production builds).
export const FIRESTORE_EMULATOR_HOST = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST ?? '';
