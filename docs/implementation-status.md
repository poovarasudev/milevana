# Implementation status

One row per backlog story, grouped by phase. Status values: Done, Partial,
Blocked-owner (waiting on something only the owner can supply).

## Phase 1A — Foundation

| Story | Status | Implementing files | Covering tests | Deviations / assumptions |
|-------|--------|--------------------|----------------|--------------------------|
| FND-PLT-01 | Done | `scripts/check-boundaries.mjs`, `scripts/check-deps.mjs`, `scripts/check-manifest.mjs`, `app.json` (blockedPermissions), `eslint.config.js`, `package.json` (`guardrails` script) | `npm run guardrails` (all three checks pass locally) | Dep check ignores `@firebase/analytics*` packages that the `firebase` umbrella package pulls transitively but the app never imports; `gtag` matched by name token, not substring (avoids `*tostringtag` false positives). Test files exempt from the no-Firebase-import rule (emulator suites wire the web SDK to the emulator). |
| FND-PLT-02 | Done | `src/data/firebaseConfig.ts`, `.env.example`, `docs/firebase-setup-runbook.md`, `app.json` (RNFirebase + google-signin plugins, package `dev.poovarasu.milevana`) | Indirectly via emulator suites (config resolves env vars) | Firebase config is entirely `EXPO_PUBLIC_*` env-driven. Real values (API key, OAuth client IDs, web client id, Drive scope) are owner-only — see below. |
| FND-PLT-03 | Done | `.github/workflows/ci.yml` | Workflow reviewed; mirrors local commands | Runs typecheck, lint, guardrails, unit tests, rules + repository emulator suites (`emulators:exec`, project `demo-milevana`), web export with `EXPO_PUBLIC_*` placeholders/overridable repo vars. Not yet exercised on GitHub (no remote run yet). |
| FND-DAT-01 | Done | `src/domain/money.ts`, `src/domain/units.ts` | `src/domain/__tests__/money.test.ts`, `src/domain/__tests__/units.test.ts` | Integer minor units + ISO-4217 exponent table; KWD formats `KWD 0.100` for 100 fils (3-digit exponent, corrected the earlier draft expectation). |
| FND-DAT-02 | Done | `src/data/schema/{common,user,vehicle,entry,reminder,checklistTemplate,invite,upgrade,index}.ts` | `src/data/schema/__tests__/schemas.test.ts` | All Appendix E shapes + limits (60/15/500 chars, 5 attachments, 10 members, 50 template items, 9,999,999.9 odometer, palette c01–c12). `vehicleInputSchema` is standalone (Zod 4 forbids `.pick()` on refined schemas). Lazy upgrade registry present, empty at v1 (FR-DATA-06). |
| FND-DAT-03 | Done | `src/data/adapter.ts` | Exercised via `src/data/repos/__tests__/repos.emulator.test.ts` | Single platform-neutral interface: reads, listeners, batches, commit handles, pending-write tracking, auth state, sign-in/out, normalized errors. |
| FND-DAT-04 | Done | `src/data/firebase.native.ts`, `src/data/firebase.web.ts`, `src/data/firebase.ts` | `repos.emulator.test.ts` ("web adapter awaits server ack", "clearPersistence is a safe no-op on web") | Android: modular RNFirebase v26, durable offline persistence (default), `awaitWriteAck:false`, Crashlytics non-fatals, Google Sign-In → credential link. Web: JS SDK, online-only (`awaitWriteAck:true`), popup→redirect auth fallback, emulator support. Native adapter not unit-tested locally (no Android build in this env) — compiles via tsc. |
| FND-DAT-05 | Done | `src/data/repos/base.ts` | `repos.emulator.test.ts` (malformed/future-schema rows) | Validated reads via `parseDoc`; malformed docs reported through `MalformedReporter`, newer `schemaVersion` skipped (DR-03g). `safeGet` maps permission-denied → absent so reads don't leak doc existence. |
| FND-DAT-06 | Done | `src/data/repos/{userRepo,vehicleRepo,index}.ts` | `repos.emulator.test.ts` (user/vehicle CRUD, watch, delete cascade) | Vehicle delete cascades entries/reminders/templates via batched deletes. Caller identity enforced (`requestingUid`). |
| FND-DAT-07 | Done | `src/data/repos/{entryRepo,reminderRepo,templateRepo,inviteRepo}.ts` | `repos.emulator.test.ts` (entry CRUD/watch, reminder/template CRUD, invite denied) | Invites: repo present, all ops denied by rules in Foundation (SEC-03) — reads/writes return normalized permission errors. |
| FND-DAT-08 | Done | `src/data/serializer.ts` | `src/data/__tests__/serializer.test.ts`, emulator export/import round-trip in `repos.emulator.test.ts` | Export bundles vehicles+children; import plans deterministic `imp_` ids; batches ≤500 writes; vehicles commit in a separate first stage (rules evaluate pre-write parent state); retries idempotent. |
| FND-SEC-01 | Done | `firebase/firestore.rules` | `firebase/tests/rules.matrix.test.js` (34 tests), `rules.spike.test.js`, `limits.probe.test.js` | Covers users/vehicles/entries/reminders/templates/invites + default deny. Identity fields, timestamps not in future, currency matches vehicle, all shared limits enforced. |
| FND-SEC-02 | Done | `firebase/firestore.rules` (vehicle/member/entry predicates) | `rules.matrix.test.js` (owner/member/outsider rows) | Sole-owner creation only; ownership/membership immutable in Foundation; member writes limited to odometer-only updates; entry create/update/delete restricted to creator + vehicle owner. |
| FND-SEC-03 | Done | `firebase/firestore.rules` (invites, default `match /{document=**}` deny) | `rules.matrix.test.js` (invite read/write denied, unknown-path deny) | Invite collection fully denied until the sharing phase; everything unmatched denied by default. |

## Owner-only items

- Real Firebase config values (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) — placeholders in `.env.example`; runbook: `docs/firebase-setup-runbook.md`.
- `google-services.json` (Android) — not committed; local file expected, documented in runbook.
- Firestore location choice, OAuth consent/client IDs, Play Console steps, DNS for `milevana.poovarasu.dev`, production rules deploy — all owner steps, documented in runbook.
- Native adapter compile verification on a real Android build (this env has no Android toolchain; `tsc` passes against RNFirebase v26 modular types).

## Verification (last run, this environment)

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean (0 errors, 0 warnings).
- `npm test` — 4 suites, 47 tests passed.
- Firestore rules emulator (`npm --prefix firebase test` via `emulators:exec`) — 3 suites, 34 tests passed.
- Repository emulator (`npm run test:emulator` via `emulators:exec`) — 1 suite, 24 tests passed.
- `npm run guardrails` — boundaries, deps (1020 pkgs scanned), manifest all pass.
- `npx expo export --platform web` — succeeds (`dist`, 2.3 MB bundle).

Emulator runs: **yes**, the Firestore emulator ran in this environment (Java 21).

## Notes

- Existing screens still use the local Zustand store (`src/data/store.ts`) — migration to repositories is Phase 1B by design.
- Pre-existing lint errors in `app/(tabs)/index.tsx`, `app/(tabs)/more.tsx`, `app/entry/[type].tsx` were fixed minimally (`Date.now` wrapped in a module-level `nowMs()` helper; apostrophe escaped) so `npm run lint` is clean for CI.
- `tsconfig.json` gained `"types": ["jest", "node"]` — TypeScript 6 does not auto-include `@types` packages the way earlier versions did, so Jest globals were missing.
