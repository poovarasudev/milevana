# Firebase & OAuth setup runbook (owner-only steps)

Everything below requires the project owner's accounts and cannot be completed
by contributors or CI. Build and test the app without these; nothing here is
faked — record progress in `docs/implementation-status.md` under
**Owner-only items**.

## 1. Firebase project `milevana`

- Console → project `milevana` → confirm the Firestore **location** is the
  decided region (see `docs/decisions-register.md`, DR-22 — location is the
  one open owner fact).
- Enable **Firestore** (Spark plan — no Blaze features anywhere).
- Enable **Authentication → Anonymous** and **Authentication → Google**.
- Register the **Android app** `dev.poovarasu.milevana` (SHA-1 from Play
  Console / EAS credentials) and download `google-services.json` into the repo
  root (gitignored — never commit it).
- Register the **web app** and copy its config into `.env`
  (see `.env.example`). Add `milevana.poovarasu.dev` and `localhost` to
  Authentication → **Authorized domains**; `milevana.web.app` works by default.
- Deploy rules: `cd firebase && npx firebase deploy --only firestore:rules`.
  Confirm the deploy in the console after CI is green (production
  confirmation is an owner step).

## 2. Google OAuth clients

- Google Cloud Console → project `milevana` → APIs & Services → Credentials.
- The **web application OAuth client** id goes to
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (used by Google Sign-In on Android and by
  the Drive scope upgrade in a later phase).
- An **Android OAuth client** is created automatically by Google Sign-In from
  the app's SHA-1 once google-services.json is registered.
- OAuth consent screen: external, app name "Milevana", scopes: openid/email/
  profile only (`drive.file` is added with the Backup/Restore feature).

## 3. Play Console / EAS

- Android package `dev.poovarasu.milevana` is fixed (`app.json`).
- A development build (not Expo Go) is required — `@react-native-firebase`
  is a native module.
- `eas build --platform android --profile development` after `npx expo
  prebuild` once, with `google-services.json` present.

## 4. Local emulator development

- `cd firebase && npm ci && npm test` runs the rules suite.
- Repository tests: `cd firebase && npx firebase emulators:exec --only
  firestore --project demo-milevana "cd .. && npm run test:emulator"`.
- Optional: set `EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST=localhost:8080` in `.env`
  while developing against the emulator.
