// Carried-over Foundation fix: missing or invalid EXPO_PUBLIC_FIREBASE_* must
// surface as a named, actionable error — not a blank screen.

import { FirebaseConfigError, missingFirebaseEnvVars } from '../firebaseConfig';

describe('missingFirebaseEnvVars', () => {
  test('empty values map back to their EXPO_PUBLIC_* names', () => {
    const missing = missingFirebaseEnvVars({
      apiKey: '',
      authDomain: 'milevana.firebaseapp.com',
      projectId: 'milevana',
      storageBucket: 'milevana.firebasestorage.app',
      messagingSenderId: '',
      appId: '',
    });
    expect(missing).toEqual([
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'EXPO_PUBLIC_FIREBASE_APP_ID',
    ]);
  });

  test('a complete config reports nothing missing', () => {
    expect(
      missingFirebaseEnvVars({
        apiKey: 'k', authDomain: 'a', projectId: 'p',
        storageBucket: 's', messagingSenderId: 'm', appId: 'i',
      }),
    ).toEqual([]);
  });
});

describe('FirebaseConfigError', () => {
  test('missing vars are carried on the error', () => {
    const e = new FirebaseConfigError(['EXPO_PUBLIC_FIREBASE_API_KEY']);
    expect(e.missing).toEqual(['EXPO_PUBLIC_FIREBASE_API_KEY']);
    expect(e.message).toContain('EXPO_PUBLIC_FIREBASE_API_KEY');
  });

  test('an init failure with a full config reports invalid values', () => {
    const e = new FirebaseConfigError([], new Error('auth/invalid-api-key'));
    expect(e.missing).toEqual([]);
    expect(e.cause).toBeInstanceOf(Error);
  });
});
