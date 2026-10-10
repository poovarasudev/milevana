// Emulator-backed repository tests (FND-DAT-03..08). Run inside the Firestore
// emulator:  cd firebase && npx firebase emulators:exec --only firestore \
//   --project demo-milevana "cd .. && npm run test:emulator"
// Plain node environment — no jest-expo — so firebase/* and
// @firebase/rules-unit-testing behave exactly as they do in the web adapter.
module.exports = {
  testEnvironment: 'node',
  // One worker: every suite shares the same emulator database, and each
  // beforeEach calls clearFirestore() — parallel workers would wipe each
  // other's fixtures mid-test. The firebase/rules suites are --runInBand
  // for the same reason.
  maxWorkers: 1,
  testMatch: ['**/*.emulator.test.[tj]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/firebase/tests/'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@firebase|firebase)/)'],
  moduleNameMapper: {
    '^expo/virtual/env$': '<rootDir>/tests-stubs/expo-env.js',
  },
  testTimeout: 60000,
};
