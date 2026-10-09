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

## Phase 1B — Foundation (identity, shell, vehicles, settings, resilience, verification)

The local Zustand data store (`src/data/store.ts`) is removed; repositories are the source of truth and Zustand (`src/features/appStore.ts`) now holds only session/UI state and repository read-model snapshots (DR-15).

| Story | Status | Implementing files | Covering tests | Deviations / assumptions |
|-------|--------|--------------------|----------------|--------------------------|
| FND-AUTH-01 | Done | `src/features/session.ts` (phase machine, anonymous bootstrap, Connect/error gates, user-doc ensure, watcher lifecycle), `src/features/appStore.ts`, `src/ui/gates.tsx`, `app/_layout.tsx` | `src/features/__tests__/session.test.ts` (bootstrap, connect retry, error gate, web gate, merge-resume gate) | Connect retry uses a 4 s → 30 s exponential backoff plus a "Try now" button. |
| FND-AUTH-02 | Done | `src/features/auth.ts` (`signInWeb`), adapter `signInWithGoogle` (popup → redirect fallback), `src/ui/gates.tsx` (sign-in gate) | `session.test.ts` (web → signin gate), `auth.test.ts` (redirect/cancel/error paths) | Redirect fallback per OQ-27/DR-18. |
| FND-AUTH-03 | Done | `auth.ts` (`linkGoogle`), `userRepo.markLinked`, `vehicleRepo.updateMemberProfile`, `entryRepo.{listPlaceholderAuthored,setAuthorName}`, `session.repairLinkedIdentity`, rules `ownerFillsMemberProfile` + `'Me'` rewrite clause | `auth.test.ts`, emulator `link-time identity rewrite` block (6 tests incl. rule negatives) | Rules relaxed narrowly for DR-02: sole-owner `members` name/email only; entry `createdByName` only when caller-authored and still `'Me'`. |
| FND-AUTH-04 | Done | `src/features/linkPrompt.ts` (5th-entry capped watches, dismissal, required gate), `src/ui/overlays.tsx` | Unit-level via `syncEntryWatch` + store assertions; prompt text via i18n keys | Prompt fires at exactly 5 entries (DR-09); dismissal is device-local per uid. |
| FND-AUTH-05 | Done | `auth.ts` (`openConflict`, `conflictCancel/ShowWarning/SwitchWithoutMoving`), adapter retained-credential API, `overlays.tsx` conflict dialog | `auth.test.ts` (counts, cancel, warn step, switch) | Retained credential kept in memory only (OQ-06). |
| FND-AUTH-06 | Done | `auth.ts` (`conflictMoveAndSwitch`, `runMerge`, `importBundle`, 30 s batch confirm), `serializer.planImport` merge options | `auth.test.ts` (move-and-switch end-to-end on the fake adapter, failure keeps bundle); emulator serializer round-trip | Vehicles imported before children; ≤500-op batches; per-batch ack awaited. |
| FND-AUTH-07 | Done | `auth.ts` (`resumeMerge`, `askDiscardMerge`, `confirmDiscardMerge`), `localFlags.loadMergeRetry/saveMergeRetry`, merge-resume gate | `auth.test.ts` (resume to ready, two-step discard, bundle cleared) | Resume when still anonymous relinks via the picker (retained credential is process-local). |
| FND-AUTH-08 | Done | `auth.ts` (`requestSignOut`, wait/discard pending dialog, `doSignOut`), `session.pauseSession/refreshSession`, adapter `clearPersistence`, `localFlags.clearFor` | `auth.test.ts` (pending dialog, cancel, discard, immediate path, flag wipe) | Watchers are stopped before `clearPersistence` so the client is quiet (FR-OUT-02). |
| FND-SHL-01 | Done | `app/welcome.tsx`, `app/index.tsx` (welcome-seen routing), `localFlags.welcomeSeen` | `session.test.ts` (welcomeSeen flag per uid) | Welcome is per-uid device-local (DR-09). |
| FND-SHL-02 | Done | `app/(tabs)/_layout.tsx`, `src/ui/Shell.tsx`, `src/ui/WebRail.tsx`, `src/ui/ComingSoonTab.tsx`, `app/(tabs)/*`, `app/add.tsx`, `app/entry/[type].tsx`, `app/about.tsx` | Component-verified via render trees in `src/ui/__tests__` | Four tabs + top-bar switcher; ≥768 px web gets the left rail (DR-17); Add hidden with no selection. |
| FND-SHL-03 | Done | `src/ui/ErrorBoundary.tsx`, `src/ui/kit.tsx` (48 dp targets, icon-button labels), `src/ui/theme.ts` | `src/ui/__tests__/errorBoundary.test.tsx` | Per-screen boundary wraps every route; sanitized non-fatal on native only. |
| FND-SHL-04 | Done | `session.ts` (`resolveSelection`, `selectVehicle`, `selectAllVehicles`, `handleVehicleList`), `app/switcher.tsx`, `src/ui/VehicleHeader.tsx` | `session.test.ts` (MRU, oldest-active fallback, access-lost flag) | "All vehicles" affects Reports scope only; MRU persisted per uid (DR-15). |
| FND-VEH-01 | Done | `src/ui/VehicleForm.tsx`, `app/vehicle/new.tsx`, `vehicleActions.createVehicle` | `vehicleForm.test.tsx`, `vehicleActions.test.ts`, emulator create/ownership tests | Name uniqueness checked against the watch snapshot client-side before the write. |
| FND-VEH-02 | Done | `app/vehicle/[id].tsx`, `vehicleRepo.update/changeUnits` (startOdometer pre-entry), `vehicleActions` | `vehicleForm.test.tsx` (locked mode), emulator `startOdometer adjusts lastOdometer` | Units/currency/start-odometer editable until the first entry, then locked (DR-01). |
| FND-VEH-03 | Done | `vehicleRepo.archive/unarchive`, `app/vehicle/[id].tsx` | Emulator archive tests; delete/write rejection paths | Archived vehicles reject every change except unarchive (DR-16). |
| FND-VEH-04 | Done | `app/vehicle/[id].tsx` (typed-name dialog, shared warning), `vehicleActions.deleteVehicle` + `deleteNameMatches`, `localFlags.markDeleteFailed` | `vehicleActions.test.ts`, emulator `large deletes` (>500 children) | Failed delete marks the vehicle on-device; manual Retry only, no auto-resume (DR-14). |
| FND-SET-01 | Done | `src/i18n/{index,en}.ts`, `scripts/lib/i18n-scan.js`, `scripts/check-i18n.mjs`, `check:i18n` wired into `guardrails` | `src/i18n/i18n.test.ts`, `scripts/i18n-scan.test.js`, `npm run check:i18n` | Scanner is heuristic: JSX text, text-prop attributes and object props; `// i18n-allow` opt-out for non-visible values. |
| FND-SET-02 | Done | `app/settings.tsx`, `src/ui/Picker.tsx`, `userRepo.updateSettings`, theme wiring in `src/ui/theme.ts` + `app/_layout.tsx` | `i18n.test.ts` (locale resolution/fallback) + emulator settings-merge test | All seven settings keys per the register; read-only preview block; theme applied live. |
| FND-OBS-01 | Done | `src/ui/ErrorBoundary.tsx`, `src/features/reporting.ts` | `errorBoundary.test.tsx` | Fallback per screen with Retry re-mount. |
| FND-OBS-02 | Done | `src/features/sync.ts` (`onWriteEvent`), adapters `onConnectivityChanged`, `src/ui/Notices.tsx` banners | `sync.test.ts` (quota pause/clear, transient reporting) | `resource-exhausted` pauses the banner; the next ack clears it (FR-OFF-07). |
| FND-OBS-03 | Done | `base.ts` malformed-doc pipeline, `session.reportMalformedDoc`, access-lost detection in `handleVehicleList`, `Notices.tsx` | `session.test.ts` (access-lost), emulator malformed/newer-schema tests | Skipped docs reported with kind/id/path/issue-paths only (PRV-03). |
| FND-OBS-04 | Done | `base.ts` write journals, `sync.ts` (`retryIssue`, `discardIssue`, `recomputePending`), `overlays.tsx` sync-issues sheet | `sync.test.ts` (issue create, retry resubmits journal, discard) | Journal lives in memory only — never persisted or logged (DR-19). |
| FND-OBS-05 | Done | `src/features/reporting.ts`, adapter `reportNonFatal`/`testCrash` | `reporting.test.ts` (whitelist, redaction, never-throws), `errorBoundary.test.tsx` | No uid/vehicle/plate/invite data in reports; web hook is a no-op; test crash wired on the Account screen (dev builds). |
| FND-VER-01 | Done | `docs/quota-budget.md` | Projection vs DR-20 threshold | PASS at 500 DAU (≈7.8k reads / ≈7.2k writes vs 25k/10k). Counts are code-path-derived and batching emulator-verified; emulator request-log metering is owner-side if tighter numbers are wanted. G2 satisfied → DAT-05/06/07 acceptable. |
| FND-VER-02 | Partial | `.maestro/foundation-first-launch.yaml`, `.maestro/foundation-offline-lifecycle.yaml`, `docs/foundation-verification.md` | Component + unit + emulator suites | Flows and checklist are authored; they need a dev build + real device run (no Android toolchain in this env). Manual checklist run record left blank for the owner. |

## Phase 2 — Logging (entries)

| Story | Status | Implementing files | Covering tests | Deviations / assumptions |
|-------|--------|--------------------|----------------|--------------------------|
| Carryover: web config gate | Done | `src/data/firebaseConfig.ts` (`FirebaseConfigError`, missing-var list), `src/data/firebase.web.ts` (init guarded), `src/features/session.ts` (config phase), `src/features/appStore.ts`, `src/ui/gates.tsx` (full-screen error → runbook) | `src/data/__tests__/firebaseConfig.test.ts`, `src/features/__tests__/session.test.ts` | Missing/invalid `EXPO_PUBLIC_FIREBASE_*` renders a named-variable error pointing at `docs/firebase-setup-runbook.md` instead of a blank page. |
| LOG-01 | Done | `docs/quota-budget.md` (Logging section appended) | Projection vs DR-20 | PASS at 500 DAU: ≈22,600 reads / ≈5,520 writes vs 25k/10k. Recommendation applied: History attaches one watch over all entries, filter/search are in-memory only, refresh is pull-only — no auto re-fetch. |
| LOG-02 | Done | `src/domain/fuel.ts` (two-of-three solver, milli-unit price, input-state tracking, mileage between same-fuel full fills, `missedPrevious` suppression, EV km/kWh, CNG km/kg, hours → none) | `src/domain/__tests__/fuel.test.ts` | Integer milli-minor units throughout (₹1.50 → 150000). Separate mileage per fuel for bi-fuel vehicles. |
| LOG-03 | Done | `src/domain/entries.ts` (service total = lines + labour − discount floored ≥0, trip distance/reimbursement, odometer sanity check, category/service-type lists, `EntryPatch` null-clears semantics) | `src/domain/__tests__/entries.test.ts` | Odometer warnings are non-blocking both directions (lower/higher than neighbours). |
| LOG-04 | Done | `src/ui/entry/EntryShell.tsx`, `src/ui/entry/fields.tsx`, `src/ui/DateTimeField.tsx`, `src/ui/entry/EntryForm.tsx` (dispatcher), `app/entry/[type].tsx`, `app/add.tsx` wiring | `src/ui/__tests__/entryForms.test.tsx` (shell rows), emulator batch test (`lastOdometer` in same write) | Inspection stays a placeholder tile. Save errors render inside the form scroll area. Web disables Save offline. |
| LOG-05 | Done | `src/ui/entry/FuelForm.tsx`, `src/domain/fuel.ts` | `entryForms.test.tsx` (fuel create/edit), `repos.emulator.test.ts` fuel-details block | Fuel-specific unit defaults; live mileage preview; full-tank default on; optional station; required odometer. |
| LOG-06 | Done | `src/ui/entry/FuelForm.tsx` (`electric` branch: kWh, home/public location, "Full charge") | `entryForms.test.tsx`, emulator EV block | Same form as LOG-05 gated on fuel type; location home/public per DR-03 canonical labels. |
| LOG-07 | Done | `src/ui/entry/MoneyForm.tsx` (`expense` branch), category chips + Other→typed text | `entryForms.test.tsx`, emulator expense block | Positive amount required; odometer optional. |
| LOG-08 | Done | `src/ui/entry/ServiceForm.tsx` (1–20 lines, type picker, Other label, labour, discount, computed total) | `entryForms.test.tsx`, emulator service block | Total = lines + labour − discount floored at 0; validation blocks missing type, missing Other label, invalid costs. |
| LOG-09 | Done | `src/ui/entry/MoneyForm.tsx` (`income` branch: category, amount, platform) | `entryForms.test.tsx`, emulator income block | Odometer optional; platform free text. |
| LOG-10 | Done | `src/ui/entry/TripForm.tsx` (start/end date+odometer, from/to, business/personal, rate, distance, reimbursement) | `entryForms.test.tsx`, emulator trip block | Entry date = trip start; end odometer is the entry-level odometer driving `lastOdometer`; no entry-level amount. |
| LOG-11 | Done | `app/(tabs)/history.tsx`, `src/ui/HistoryList.tsx`, `src/ui/SwipeRow.tsx`, `src/features/entries.ts` (watch), `src/data/repos/entryRepo.ts` (pending flag, server refresh) | `entryForms.test.tsx` (history rows), emulator malformed-entry block | Month grouping; pending-sync icon; rejected-write warning state; "N entries couldn't be shown"; empty state; pull-to-refresh does a `server` read. |
| LOG-12 | Done | `HistoryList.tsx` (`filterEntries`, `entryMatchesQuery`, type chips, date-from/to pickers) | `entries.test.ts` (domain), `entryForms.test.tsx` | In-memory only — zero additional reads. Search covers notes, category, service line labels/types, station, platform, trip from/to; amounts never match. |
| LOG-13 | Done | `EntryForm.tsx` edit mode, `entryRepo.update` (patch + `lastOdometer` recompute), `canEditEntry` | `entryForms.test.tsx` (edit seeding), emulator edit/authority block | Type immutable on edit; date editable; creator or vehicle owner can edit; archived → read-only. |
| LOG-14 | Done | `features/entries.ts` (5 s Undo window, background flush), `SwipeRow.tsx`, History snackbar, `entryRepo.delete` | `features/__tests__/entries.test.ts`, emulator delete + `lastOdometer` recompute block | Row hides immediately, server delete on timer expiry; app teardown commits pending deletes; owner can delete member entries. |
| LOG-15 | Partial | `.maestro/logging-airplane-mode.yaml`, `docs/logging-verification.md`, stable `testID`s on all form fields | Flow authored; component + emulator suites | Android Maestro run needs a dev build + device (no Android toolchain here) — same caveat as FND-VER-02. Manual checklist rows left blank for the owner. |

## Owner-only items

- Real Firebase config values (`EXPO_PUBLIC_FIREBASE_*`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) — placeholders in `.env.example`; runbook: `docs/firebase-setup-runbook.md`.
- `google-services.json` (Android) — not committed; local file expected, documented in runbook.
- Firestore location choice, OAuth consent/client IDs, Play Console steps, DNS for `milevana.poovarasu.dev`, production rules deploy — all owner steps, documented in runbook.
- Native adapter compile verification on a real Android build (this env has no Android toolchain; `tsc` passes against RNFirebase v26 modular types).
- Android device runs for all Maestro flows (Foundation + `.maestro/logging-airplane-mode.yaml`) and the manual checklists in `docs/foundation-verification.md` / `docs/logging-verification.md` — needs a dev build and device.
- Firestore rules deploy: `e.date` is now allowed in the future per LD-04 — deploy the updated `firebase/firestore.rules` before clients rely on future-dated entries.

## Verification (last run, this environment)

- `npx tsc --noEmit` — clean.
- `npx eslint .` — clean (0 errors, 0 warnings).
- `npm test` — 18 suites, 199 tests passed (unit + component + i18n-scanner).
- Firestore rules emulator (`cd firebase && npx firebase emulators:exec --only firestore --project demo-milevana "npx jest --runInBand"`) — 3 suites, 34 tests passed.
- Repository emulator (same wrapper around `npm run test:emulator`) — 1 suite, 40 tests passed.
- `npm run guardrails` — boundaries, deps, manifest, i18n scanner all pass.
- `npx expo export --platform web` — succeeds.

Emulator runs: **yes**, the Firestore emulator ran in this environment (Java 21).

## Notes

- Phase 1B removed `src/data/store.ts` entirely; all screens read repository
  snapshots via `useAppStore` and write through feature modules. Jest maps
  `data/firebase` to the neutral `firebase.ts` stub so tests inject a fake
  adapter (`src/features/__tests__/fakeAdapter.ts`); platform bundles resolve
  the real adapter via Metro's platform extensions.
- Two fixed bugs found by the new tests: `guardedWrite`/`confirmBatch` now
  clear their timeout when the write wins the race (previously a successful
  write still flipped the offline banner 15 s later), and the Connect retry
  timer is cancelled on session teardown.
- `tsconfig.json` gained `"types": ["jest", "node"]` — TypeScript 6 does not auto-include `@types` packages the way earlier versions did, so Jest globals were missing.
