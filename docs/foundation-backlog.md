# Milevana v1 — Sub-project 1: Foundation — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 39 in 9 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only; it is not cited as a source and no design links appear.

**IDs.**
- **Requirement IDs are the PRD's own** (`PR-`, `FR-`, `NFR-`, `PRV-`, `TS-`, `AC-F`, `AC-D`, `OQ-`, `RK-`, gates `G1`–`G7`). None were invented. `AC-F1`–`AC-F7` are the source's "Done when" criteria (PRD §25.1). `AC-D1`–`AC-D25` are the PRD's derived restatements (PRD §25.2); the PRD says they carry no priority of their own.
- **The SRS has no requirement IDs.** SRS references give the section and the line range in `docs/requirements.md` (for example `L96–102`), plus the `OQ-` number where the SRS records a decision.
- **`FND-<EPIC>-nn` story IDs** and **`DR-nn` decision labels** are labels for tracking this backlog. They are not requirement IDs.
- Acceptance criteria in a story cite the governing PRD ID in brackets, for example `[FR-VEH-04]`. A story criterion never overrides a PRD criterion.

**Priority.** The PRD says the source assigns no priorities (PRD "How to read", Priority). Stories therefore carry a dependency **wave** (section B), not P0/P1/P2. Every Foundation item is committed scope.

**`[DECISION REQUIRED]`** marks something an implementer needs and the SRS/PRD does not specify. These are not resolved here. Each story's **Readiness** line says whether it can start now or which part waits on which decision. The decisions are collected in section E.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

**Story size:** S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL > 2 weeks, for one developer. These are relative sizes for sequencing, not estimates from the source.

## Scope interpretation notes (not product decisions)

1. **Foundation has no entry forms** (tab 2). Behaviors that need entries (the 5th-entry link prompt, locked odometer unit and currency, `lastOdometer` batches, malformed-entry handling) are built and verified in Foundation with repository and emulator fixtures. Their live end-to-end check happens when tab 2 lands.
2. **Web deployment is not Foundation.** Hosting at `milevana.poovarasu.dev` is tab 6 and tab 8 work (OQ-57), and the user excluded production release work. AC-F4 is verified against a locally served Expo web build signed in through Firebase Auth.
3. **Existing repo assets.** `firebase/` already holds a rules draft and G3 spike tests (commit `339e3af`). They are implementation input for the SEC stories, not a source of requirements.
4. **Gate status** (PRD §24.6): G1 done. G2 open → `FND-VER-01`. G3 emulator-verified, production confirmation pending → `FND-SEC-03`. G4 done. G5 → `FND-AUTH-08`, `FND-OBS-04`, `FND-VER-02`. G6 (closed-tester sign-in) is **outside Foundation** because it needs a Play-signed build after tab 2. G7 fixtures → `FND-DAT-02`.
5. **"Complete schema" includes every Appendix E shape.** SRS L175 says fuel details are "the only detail shape Foundation fixes". The user's Foundation scope says "complete Firestore schema", and Appendix E (approved 2026-10-06) fixes the service, trip, inspection, reminder, invite and template shapes, so `FND-DAT-02` and the rules stories cover all of them. Tab 2 still owns category lists and entry forms.
6. **AC-D items that reference later tabs** (for example "All vehicles" changes only Reports) are satisfied in Foundation to the extent the shell can: the switcher entry and the scope state exist; Reports content is tab 4.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| PLT | E1 Platform and tooling | PLT-01 to PLT-03 |
| DAT | E2 Domain and data layer | DAT-01 to DAT-08 |
| SEC | E3 Security rules | SEC-01 to SEC-03 |
| AUTH | E4 Identity and account | AUTH-01 to AUTH-08 |
| SHL | E5 App shell and UX foundation | SHL-01 to SHL-04 |
| VEH | E6 Vehicle management | VEH-01 to VEH-04 |
| SET | E7 Settings and localization | SET-01 to SET-02 |
| OBS | E8 Resilience and observability | OBS-01 to OBS-05 |
| VER | E9 Verification gates | VER-01 to VER-02 |

---

# E1 — Platform and tooling

### FND-PLT-01 — Project scaffold, identity and build guardrails
- **Epic:** E1 Platform and tooling · **Type:** Architecture · **Size:** L · **Readiness:** Ready
- **User story:** As the maintainer, I want one Expo codebase that builds for Android and web with the agreed layout, identity and privacy guardrails, so that every later story builds on a single baseline that never needs Play's photo-permission declaration.
- **Business value:** One codebase for two platforms (PR/G1). Keeps the "no ads, no location, no broad media permission" promise true from the first commit (P1, G2).
- **Scope:** *In:* Expo app with Expo Router and TypeScript; identical routes on Android and web; development-build configuration (not Expo Go); the layer layout `app/`, `src/domain`, `src/data` (`firebase.native.ts`, `firebase.web.ts`, `repos/`, `serializer/`), `src/features`, `src/ui`; libraries named in the SRS installed and wired: React Native Paper, react-hook-form + zod, Zustand, i18next + expo-localization, `@react-native-firebase`, Firebase JS SDK, `@react-native-google-signin/google-signin`; app name Milevana; Android package `dev.poovarasu.milevana`; Android build config that strips `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE`; lint and Jest + React Native Testing Library baselines. *Out:* any screen, Firebase wiring (PLT-02), CI (PLT-03).
- **Preconditions:** Firebase project id decided (G1 done: `milevana`). Package id decided.
- **Functional behavior:**
  1. `Platform` resolution picks `firebase.native.ts` or `firebase.web.ts`; nothing above them branches on platform.
  2. An Android development build installs under the package id and launches to a route stub; the web build serves the same route.
  3. If any library adds `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or a location permission, the build config removes or blocks it.
  4. No ad SDK and no analytics SDK is a dependency.
- **Business rules:** Nothing above the adapter branches on platform and only repositories touch Firestore (NFR-14, NFR-15). Native modules need development builds (FR-SCAF-02). The package id cannot change after the first Play release.
- **Edge cases:** A transitive library re-adds a stripped permission after a dependency bump → the manifest check must catch it. A native-only import reaching the web bundle → the web build fails.
- **Android/web differences:** Same routes. Native modules are loaded only through the adapter files.
- **Offline behavior:** N/A.
- **Security implications:** Permission minimisation is the control (PRV-01, PRV-02). No location, no broad media, no ad SDK.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Android development build and web build both start from one codebase with the same routes [FR-SCAF-01].
  2. The merged release manifest has no `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or location permission [AC-D19, AC-D20].
  3. The dependency tree has no ad SDK and no analytics SDK [AC-D20, PRV-04].
  4. A lint or test check fails when a file outside the adapters imports a native Firebase module or branches on platform [FR-DATA-01, NFR-14].
  5. The app runs from a development build; Expo Go is not required or supported [FR-SCAF-02].
- **Test requirements:** Manifest-inspection script (also run in CI, see PLT-03). Lint-rule unit test. Smoke render test per platform entry.
- **Dependencies:** None.
- **PRD requirement IDs:** FR-SCAF-01, FR-SCAF-02, FR-SCAF-03, FR-SCAF-07 (setup only), NFR-03, NFR-14, NFR-15, NFR-17, PRV-01, PRV-02, PR-01, RK-07, RK-08; AC-D19, AC-D20.
- **SRS reference:** Platform decisions L19–33; Architecture L70–123 (esp. L96, L121); Libraries L104–119.

### FND-PLT-02 — Firebase project and Google OAuth configuration
- **Epic:** E1 Platform and tooling · **Type:** Architecture (setup) · **Size:** M · **Readiness:** Ready except the Firestore location, which only the owner can supply (DR-22).
- **User story:** As the maintainer, I want the Firebase project and the Google OAuth client configured once, so that anonymous and Google sign-in work on Android and web and tab 5 can later request `drive.file` incrementally.
- **Business value:** Unblocks every auth and data story. Doing the OAuth setup now avoids a re-consent or rebuild in tab 5 (FR-SCAF-04).
- **Scope:** *In:* Firebase project `milevana` on the Spark plan; Authentication providers Anonymous and Google enabled; Firestore database created; Android app registered (package id, debug SHA-1) and web app registered; Google Cloud OAuth clients for Android and web as needed; authorized domains including local development hosts; config files kept in GitHub and EAS secrets; local emulator configuration (`firebase.json`) and a baseline `firestore.indexes.json`. *Out:* requesting the Drive scope (FR-LINK-07); consent-screen publishing and Play-signing SHA-1 (closed-test and tab 8 work, gate G6); Hosting deploy; custom-domain setup.
- **Preconditions:** Google Cloud and Firebase console access. DR-22 answered if the database has not been created.
- **Functional behavior:**
  1. A development build can call `signInAnonymously()` against project `milevana`.
  2. A Google ID token can be obtained on Android and via the web popup and exchanged for a Firebase credential.
  3. The emulator suite starts with the project id and loads the rules and indexes files.
  4. Only basic sign-in scopes are configured; no Drive scope is requested.
- **Business rules:** One production Firebase project, the emulator for tests, no staging project (OQ-38). Project id and package id are permanent.
- **Edge cases:** Separate Android and web OAuth clients, release and Play-signing SHA-1, and authorized domains are `[External — verify]` in the PRD (§14.8). A missing SHA-1 shows up as a Google sign-in failure on device.
- **Android/web differences:** Android needs the app registration and SHA-1; web needs the web client and authorized domains.
- **Offline behavior:** N/A.
- **Security implications:** `google-services.json` and signing material are never committed; they live in GitHub and EAS secrets (OQ-38).
- **Data/schema impact:** Creates the database; no documents.
- **Acceptance criteria:**
  1. Anonymous sign-in succeeds from an Android development build [FR-AUTH-02].
  2. Google sign-in succeeds on Android (credential obtained) and web (popup) with a test Google account [FR-LINK-04, FR-WEB-01].
  3. No Drive scope appears in any requested scope list [FR-LINK-07].
  4. No secret or `google-services.json` is in the repository [OQ-38].
  5. The OAuth client is configured so tab 5 needs no new client to add `drive.file` [FR-SCAF-04, FR-LINK-06].
- **Decisions applied:** DR-21 ✔, DR-22 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-21 ✔] A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release.
  2. **D2** [DR-22 ✔] The Firestore database location is recorded in the setup runbook once the owner supplies it.
- **Test requirements:** Manual verification checklist with a test Google account. Emulator start-up check in CI (PLT-03).
- **Dependencies:** None (parallel with PLT-01).
- **PRD requirement IDs:** FR-SCAF-04, FR-LINK-06, FR-LINK-07, FR-AUTH-02, §14.8, §24.4; OQ-03, OQ-28 (config part), OQ-38; G1.
- **SRS reference:** Accounts L27; OAuth setup L224; OQ-03 L630; OQ-28 L707; OQ-38 L659.

### FND-PLT-03 — Continuous integration pipeline
- **Epic:** E1 Platform and tooling · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want every push checked automatically, so that rules and domain regressions cannot reach a release unnoticed.
- **Business value:** Rules are the entire backend (RK-03); CI is the only guard that every rule row stays tested both ways.
- **Scope:** *In:* GitHub Actions workflow on every push running lint, typecheck, unit tests (domain and component), repository tests (Jest + Firestore emulator, JS SDK) and rules tests (emulator + `@firebase/rules-unit-testing`); manifest and dependency checks from PLT-01; EAS Build of an Android build on tagged releases; secrets read from GitHub and EAS secrets. *Out:* rules and index deployment, EAS Submit to Play, Hosting deploy (release work).
- **Preconditions:** PLT-01 merged.
- **Functional behavior:**
  1. A push starts the jobs; any failing job fails the run.
  2. Jobs that need Firestore start the emulator and tear it down.
  3. A tag starts an EAS Android build.
- **Business rules:** Runs on every push (FR-SCAF-06, TS-01, TS-04). Secrets only from secret stores.
- **Edge cases:** Emulator start-up time-outs → job retries are not a substitute for fixing flakiness. Fork PRs have no secrets: jobs that need none still run.
- **Android/web differences:** None in CI beyond the web bundle build check.
- **Offline behavior:** N/A.
- **Security implications:** No secret printed in logs; build artifacts contain no secrets.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A push runs lint, typecheck, unit, repository and rules jobs [FR-SCAF-06].
  2. Deliberately breaking one rules test fails the run [TS-01].
  3. A tag produces an Android build through EAS [PRD §22.2].
  4. The manifest-permission and no-ad-SDK checks run and fail on violation [AC-D19, AC-D20].
- **Decisions applied:** DR-21 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-21 ✔] A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release.
- **Test requirements:** Verified by a throw-away branch with a failing test per job type. Workflow lint.
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** FR-SCAF-06, TS-01, TS-04, NFR-16, §22.1, §22.2, OQ-38; AC-D18 (runs on every push), AC-D19, AC-D20.
- **SRS reference:** CI L322; Testing L309–322; OQ-38 L659.

---

# E2 — Domain and data layer

### FND-DAT-01 — Domain: money and units
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure money and unit modules, so that every screen converts and formats consistently and no rounded value is ever stored.
- **Business value:** Prevents floating-point drift in money and keeps "settings convert what is shown, never what is stored" true everywhere (NFR-08).
- **Scope:** *In:* `src/domain/money.ts` (integer minor units, currency exponent table for the ISO 4217 list, formatting driven by the Currency setting, no conversion between currencies); `src/domain/units.ts` (distance km↔mi for display, volume litres / US gallons / UK gallons, efficiency formats km/l, L/100 km, mpg, the `hours` odometer unit passes through unconverted and flags distance metrics as hidden). Written test-first. *Out:* `fuel.ts`, `reminders.ts`, `reports.ts` and mileage logic (tabs 2–4).
- **Preconditions:** PLT-01.
- **Functional behavior:**
  1. `minor ↔ decimal` conversion uses the currency's exponent: `{ minor: 245000, currency: "INR" }` is ₹2,450.00.
  2. Display conversion functions take a stored value in its own unit and return a display value in the user's setting; stored values are never mutated.
  3. For an `hours` vehicle the helpers report "no distance conversion" and "hide distance-based metrics".
- **Business rules:** Money is integer minor units with a currency code. Odometer stays in the vehicle's unit; conversion only at display (NFR-08). Amounts are never converted between currencies (FR-SET-03, OQ-29). Minor-unit exponents come from a currency table in `money.ts` (OQ-31).
- **Edge cases:** Currencies with 0 or 3 decimals. Values that do not convert exactly. `hours` with a distance-unit setting. Decision applied: DR-07: formatting patterns, list scope, `mpg` definition.
- **Android/web differences:** None (pure TypeScript).
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None (defines how `amount` and odometer are interpreted).
- **Acceptance criteria:**
  1. ₹2,450.00 ↔ `245000` round-trips; zero- and three-decimal currencies round-trip [FR-DATA-13].
  2. Distance, volume and efficiency conversions are tested in both directions within defined precision [TS-03].
  3. No exported function changes a stored value or converts between currencies [AC-D10, FR-SET-03].
  4. `hours` input is not converted and is flagged for metric hiding [FR-VEH-16].
- **Decisions applied:** DR-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-07 ◐] 245000 minor units of INR show as ₹2,450.00 and 123456700 as ₹12,34,567.00; a USD amount shows with international grouping; funds, metal and test codes such as XAU, XTS and XXX are not selectable; `mpg` uses US gallons unless the Volume setting is UK gallons; any combination of Distance, Volume and Efficiency settings is accepted; converted distance and volume show one decimal.
- **Test requirements:** Jest unit tests, test-first (TS-03), including exponent table coverage.
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** FR-DATA-12, FR-DATA-13, FR-SET-03, FR-I18N-01, FR-I18N-02, NFR-08, TS-03, PR-19; AC-D10.
- **SRS reference:** Data model rationale L168–170; Settings L284; Architecture code layout L82–88; OQ-29 L651; OQ-31 L652; OQ-11 L638.

### FND-DAT-02 — Complete Firestore schema and validation (zod)
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want every Firestore document shape defined once as a zod schema with inferred types, so that repositories, forms and the serializer share one validated definition and later tabs need no migrations.
- **Business value:** Delivers "the full data model … so no migrations are needed later" (PR-18, §24.3). One definition prevents drift between forms, repositories and rules.
- **Scope:** *In:* schemas and inferred types for `users/{uid}` (settings, `drive`, `deletion?`), `vehicles/{id}` (including `members` map, `lastOdometer`, `lastOdometerAt`), `entries` (common fields, `attachments[]`, `uploaderUids`, and `details` for fuel, service, trip, inspection per Appendix E), `reminders`, `invites`, `checklistTemplates`; `schemaVersion` handling and an upgrade-on-read registry (mechanism, no historical versions yet); cross-field refinements; test fixtures including the G7 fuel fixtures. *Out:* the category and service-type value lists' UI (tab 2), rules (SEC), repositories (DAT-05 to DAT-07).
- **Preconditions:** PLT-01.
- **Functional behavior:**
  1. Each schema parses a valid document into a domain type and rejects an invalid one with a code and a path, never echoing field values.
  2. `schemaVersion` selects an upgrader that turns an older shape into the current one.
  3. Form schemas are derived from the same definitions for react-hook-form.
- **Business rules:** `amount.minor` is an integer. Entry `type` is one of six values. `amount` is required for fuel, expense, service and income, absent for trip and inspection, always positive; its currency equals the vehicle's (OQ-31). Fuel and trip have no `category`. A service entry's `amount.minor` is the sum of line costs plus labour minus discount, never below zero. A reminder needs at least one trigger. A template has at most 50 items, an entry at most 5 attachments, a vehicle at most 10 members; the owner is in `memberIds` and `members` keys match `memberIds` (OQ-34). `date` is a timestamp; odometer is in the vehicle's unit.
- **Edge cases:** *Decisions applied:* starting-odometer storage and the initial `lastOdometerAt` (DR-01); `members` identity values for anonymous users (DR-02); stored encodings, `schemaVersion` start value and type, `quantity` numeric type, behavior for a `schemaVersion` newer than the app knows (DR-03); vehicle field limits (DR-05); text-length caps that must mirror the rules (DR-06).
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** Error output carries codes and paths only, so validation failures cannot leak amounts, plates, names or notes into reports (PRV-03).
- **Data/schema impact:** Defines the whole schema. No migration is needed because older shapes upgrade lazily on read (OQ-40).
- **Acceptance criteria:**
  1. Valid fixtures for every shape in SRS "Data model" and "Schemas" parse [PR-18, Appendix E].
  2. Each of these is rejected: non-integer `amount.minor`; unknown entry `type`; a trip with an `amount`; an expense without one; a service total that does not match its lines; more than 5 attachments; more than 10 members; a template with more than 50 items; a reminder with no trigger [FR-DATA-03, FR-SEC-11/12/13 mirror].
  3. An older-shape fixture upgrades to the current shape through `schemaVersion` [FR-DATA-06].
  4. G7 fixtures round-trip exactly: a price quoted to three decimals and a quantity of 12.5 UK gallons [G7].
  5. The vehicle form can be built from the vehicle schema [FR-DATA-04].
- **Decisions applied:** DR-01 ✔, DR-02 ✔, DR-03 ✔, DR-05 ✔, DR-06 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  3. **D3** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  4. **D4** [DR-05 ✔] A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected.
  5. **D5** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
- **Test requirements:** Jest unit tests with fixtures per shape; G7 round-trip tests; schema-upgrade tests (TS-03, TS-04 foundations).
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** FR-DATA-03, FR-DATA-04, FR-DATA-06, FR-DATA-13, FR-VEH-12, FR-SEC-11, FR-SEC-12, FR-SEC-13, NFR-08, NFR-09, PR-18, §13.1–§13.7, Appendix E; G7.
- **SRS reference:** Data model L125–179; Schemas L713–810; OQ-30 L665; OQ-31 L652; OQ-32 L653; OQ-34 L655; OQ-40 L661; OQ-41 L666; OQ-60 L701.

### FND-DAT-03 — Platform adapter contract and native adapter (Android)
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** L · **Readiness:** Ready
- **User story:** As a developer, I want a narrow adapter interface implemented on Android with `@react-native-firebase` and a durable offline cache, so that repositories work offline without knowing which SDK runs.
- **Business value:** Makes "Log anywhere" real on Android (P3, PR-03) and keeps the rest of the app SDK-agnostic.
- **Scope:** *In:* the adapter interface (Firestore reads and subscriptions with snapshot metadata including `hasPendingWrites`; set, update and delete; write batches of up to 500; server timestamps; pending-write observation, count and wait; `clearPersistence`; Auth: session read, state listener, `signInAnonymously`, Google-credential sign-in, `linkWithCredential`, sign-out, normalized error codes including `auth/credential-already-in-use`; a non-fatal-report hook point) and `firebase.native.ts` implementing it with durable persistence. The PRD (§12.5) leaves the interface's scope to "when the adapters are written"; this story sets it. *Out:* the web adapter (DAT-04), repositories, Crashlytics wiring (OBS-05).
- **Preconditions:** PLT-01, PLT-02.
- **Functional behavior:**
  1. A write is applied to the local cache at once and visible to subscribers with `hasPendingWrites = true`; a separate acknowledgement completes when the server confirms.
  2. Writes made offline persist across app restarts and sync on reconnect.
  3. `clearPersistence()` empties the local cache.
  4. Auth methods and errors are exposed through the same interface the web adapter implements.
- **Business rules:** Only the adapter knows which SDK runs; only repositories touch Firestore (FR-DATA-01). On Android a write's promise resolves only after server confirmation, so the interface must expose local application separately (FR-DATA-07).
- **Edge cases:** App killed with pending writes. `clearPersistence` preconditions of the SDK (the Firestore instance must not be in use). A batch of exactly 500 operations.
- **Android/web differences:** This is the Android side. The web side is DAT-04.
- **Offline behavior:** Durable cache. First launch needs the network once for anonymous sign-in; after that the app works fully offline (FR-AUTH-06).
- **Security implications:** Persisted data lives on the device until sign-out clears it (AUTH-08, PRV-07).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. In airplane mode a write appears in a live subscription at once with the pending flag, and syncs on reconnect [FR-OFF-01, FR-OFF-03].
  2. Pending writes survive an app restart [NFR-05].
  3. After `clearPersistence()` previously cached documents are gone [AC-D3].
  4. A 500-operation batch commits [FR-VEH-07, FR-MERGE-04].
  5. No file outside the adapters imports the native SDK [FR-DATA-01].
- **Test requirements:** Shared contract tests run against the JS SDK and emulator for semantics common to both adapters. Native-only behavior (durable cache, offline queue, `clearPersistence`) is covered by the Maestro airplane-mode flow and manual checks, because repository tests use the JS SDK (OQ-37 gap 1).
- **Dependencies:** FND-PLT-01, FND-PLT-02.
- **PRD requirement IDs:** FR-DATA-01, FR-DATA-07, FR-DATA-08, FR-OFF-01, FR-OFF-02, FR-OFF-03, FR-OFF-04, FR-OFF-08, NFR-05, NFR-14, §12.3–§12.5, PR-03; AC-F2 (offline part), AC-D3.
- **SRS reference:** Adapter L96; Offline writes L102; Libraries L121–123; Sign-out L245; OQ-37 L658.

### FND-DAT-04 — Web adapter (Firebase JS SDK, online-only)
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want the same adapter interface implemented on the web with the Firebase JS SDK, so that the web app reuses every repository unchanged.
- **Business value:** Gives web users the same vehicles with no second data layer (PR-07, NFR-14).
- **Scope:** *In:* `firebase.web.ts` implementing the DAT-03 interface: Firestore without a durable cache (in-memory only), Auth through the JS SDK with Google popup and redirect fallback, browser online/offline signals exposed to the app, the report hook as a no-op (no web crash reporting). *Out:* the sign-in screen (AUTH-02), the offline banner (OBS-02).
- **Preconditions:** DAT-03 interface exists; PLT-02.
- **Functional behavior:**
  1. The same interface calls work; `hasPendingWrites` reflects in-memory pending writes only.
  2. `clearPersistence` is not applicable on web and is a safe no-op.
  3. Browser `online` and `offline` events are available to callers.
- **Business rules:** Web is online-only; unsynced web writes live only in memory, so saving is disabled offline (FR-OFF-06, §16.1).
- **Edge cases:** Popup blocked → redirect fallback (OQ-27). A write that never confirms (see DR-18 for the timeout).
- **Android/web differences:** This is the web side: no durable cache, no `clearPersistence`, no Crashlytics, Google through popup or redirect.
- **Offline behavior:** Online-only. Offline is detected and surfaced; saving is disabled by OBS-02.
- **Security implications:** No persistent cache means nothing remains in the browser's database after sign-out.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The shared contract tests pass on the web adapter [FR-DATA-01].
  2. The web bundle builds with no native-module imports [NFR-14].
  3. Offline and online browser events reach the app through the adapter [FR-OFF-14].
  4. A blocked popup falls back to the redirect flow [OQ-27].
- **Decisions applied:** DR-18 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-18 ◐] A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not.
- **Test requirements:** Contract tests against the Firestore emulator via the JS SDK. Manual web smoke test (TS-07).
- **Dependencies:** FND-DAT-03 (interface), FND-PLT-02.
- **PRD requirement IDs:** FR-DATA-01, FR-WEB-01, FR-WEB-04, FR-OFF-06, FR-OFF-14, NFR-14, §16.1, PR-07; AC-F4 (foundation).
- **SRS reference:** Adapter L96; Accounts L27; Error handling L292–294; OQ-27 L650.

### FND-DAT-05 — Repository core: validated reads, local-first writes, subscriptions
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below); acceptance waits on gate G2** (`FND-VER-01`), which PRD §24.6 says gates the Foundation data layer.
- **User story:** As a developer, I want shared repository machinery, so that malformed or outdated documents fail in one place and Android writes never hang offline.
- **Business value:** "A malformed or outdated document fails in one place, never inside a screen" (FR-DATA-05); offline writes feel instant.
- **Scope:** *In:* typed read and subscribe helpers through the adapter; zod validation on every read; skip-and-report for malformed documents with the document path and a skipped count for the UI; upgrade-on-read; the write helper that returns immediately on Android with a handle for acknowledgement or later rejection (feeds OBS-04), and awaits the server on web; small subscription hooks pattern (`useVehicles()`-style) exposing data, pending flags, skipped count, loading and error; cache-first reads with an explicit refresh that pulls from the server; the Zustand store for UI-only state; typed, normalized errors (permission-denied, resource-exhausted, offline). *Out:* the specific repositories (DAT-06, DAT-07).
- **Preconditions:** DAT-01, DAT-02, DAT-03, DAT-04.
- **Functional behavior:**
  1. A read returns validated domain objects; an invalid document is dropped and reported, and the rest of the list still renders.
  2. A write returns at once on Android; the pending flag shows until acknowledged.
  3. Refresh forces a server read and updates subscribers.
- **Business rules:** Only repositories touch Firestore. No Redux and no query-caching library; Zustand holds UI-only state (FR-DATA-10). Reads are cache-first wherever possible (NFR-20).
- **Edge cases:** All documents in a collection malformed. A write rejected after the screen has moved on (reported through OBS-04's mechanism). Refresh while offline.
- **Android/web differences:** Android returns before server confirmation; web awaits it because saving is disabled offline.
- **Offline behavior:** Reads come from the cache; writes apply locally and sync later (Android).
- **Security implications:** Error reports from this layer carry the document path only, never document contents.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A list containing one invalid document returns the valid ones, a skipped count of 1 and one non-fatal event with the path only [FR-DATA-05, FR-ERR-03, AC-D12].
  2. An older-shape fixture is upgraded on read [FR-DATA-06].
  3. An offline write returns immediately and its item reports `hasPendingWrites` [FR-DATA-07, FR-DATA-08].
  4. The refresh control triggers a server read [FR-OFF-12].
  5. Only UI-only state is held in Zustand [FR-DATA-10].
- **Decisions applied:** DR-20 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
- **Test requirements:** Jest + Firestore emulator via the JS SDK: reads, writes, validation, schema upgrades (TS-04). Offline return-immediately semantics covered natively by the Maestro airplane-mode flow and manual checks.
- **Dependencies:** FND-DAT-01, FND-DAT-02, FND-DAT-03, FND-DAT-04; gate FND-VER-01.
- **PRD requirement IDs:** FR-DATA-01, FR-DATA-03, FR-DATA-05, FR-DATA-06, FR-DATA-07, FR-DATA-08, FR-DATA-09, FR-DATA-10, FR-OFF-02, FR-OFF-03, FR-OFF-04, FR-OFF-12, FR-ERR-03, NFR-20, TS-04; AC-D12.
- **SRS reference:** Repositories L98; State L100; Offline writes L102; Crashlytics rule L305; OQ-18 L642.

### FND-DAT-06 — userRepo and vehicleRepo
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below); acceptance waits on gate G2.
- **User story:** As a developer, I want the user and vehicle repositories, so that account bootstrap, settings and vehicle management have one safe place to read and write.
- **Business value:** Everything user-facing in Foundation depends on these two repositories.
- **Scope:** *In:* **userRepo**: idempotent "ensure user" (creates `users/{uid}` with defaults if missing), read and subscribe, update settings, set `isLinked`. **vehicleRepo**: create (owner as `ownerId` and the only entry in `memberIds` and `members`), update (rejecting `odometerUnit` and `currency` changes when the vehicle has entries), archive and unarchive, delete (entries, reminders and checklist templates in batches of 500, then the vehicle last; safe to re-run), subscribe to "my vehicles" with the `array-contains` membership query, and the member-allowed `lastOdometer`-only update. *Out:* UI (VEH stories), entry repository (DAT-07).
- **Preconditions:** DAT-05, SEC-01.
- **Functional behavior:**
  1. `ensureUser(uid)` creates the user document with INR, km, litres and the device language, or leaves an existing one untouched.
  2. `create` writes a vehicle that satisfies the rules' owner invariants.
  3. `update` refuses `odometerUnit` or `currency` changes once an entry exists.
  4. `delete` removes children in batches of 500 and removes the vehicle last, so an interrupted delete leaves the vehicle in place.
- **Business rules:** Units and currency lock once entries exist (client-enforced; rules cannot check entry existence). Only the owner updates or deletes. Archived vehicles are read-only until unarchived (OQ-39; scope in DR-13). The selected vehicle is stored per uid (that storage is SHL-04).
- **Edge cases:** A vehicle with more than 500 children. Delete interrupted between batches. Session exists but `users/{uid}` missing (OQ-39). *Decisions applied:* how starting odometer maps to `lastOdometer` and `lastOdometerAt` on create (DR-01); `members` name and email for an anonymous owner (DR-02); which actions an archived vehicle allows (DR-13); whether an interrupted delete resumes automatically (DR-14).
- **Android/web differences:** Android applies locally and returns; web awaits the server.
- **Offline behavior:** Create, update, archive and delete all work offline on Android (FR-VEH-09); batches queue locally.
- **Security implications:** The repository does not rely on rules to enforce the lock. Rules still reject unauthorized writes.
- **Data/schema impact:** Writes `users` and `vehicles` documents per DAT-02.
- **Acceptance criteria:**
  1. `ensureUser` is idempotent and applies the stated defaults [FR-AUTH-03, FR-SET-06, OQ-39].
  2. A created vehicle has the signer as owner and only member [FR-VEH-11].
  3. With one entry present, changing `odometerUnit` or `currency` is rejected; without entries it succeeds [AC-D7].
  4. Deleting a vehicle with 1,203 children leaves no children and no vehicle; the vehicle is removed only after all child batches [AC-D8, FR-VEH-07].
  5. If the process stops mid-delete the vehicle still exists [FR-VEH-14].
  6. "My vehicles" returns only vehicles whose `memberIds` contains the caller [FR-VEH-12].
- **Decisions applied:** DR-01 ✔, DR-02 ✔, DR-13 ◐, DR-14 ◐, DR-20 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  3. **D3** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  4. **D4** [DR-14 ◐] An interrupted vehicle delete leaves the vehicle listed with a 'Delete didn't finish' badge and Retry, and does not resume by itself at launch; the typed name matches ignoring case and surrounding spaces.
  5. **D5** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
- **Test requirements:** Jest + Firestore emulator via the JS SDK: reads, writes, validation, upgrades, batch delete with failure injection (TS-04).
- **Dependencies:** FND-DAT-05, FND-SEC-01; gate FND-VER-01.
- **PRD requirement IDs:** FR-DATA-02, FR-DATA-03, FR-DATA-07, FR-VEH-04, FR-VEH-05, FR-VEH-06, FR-VEH-07, FR-VEH-09, FR-VEH-10, FR-VEH-11, FR-VEH-12, FR-VEH-14, FR-VEH-15, FR-AUTH-03, FR-SET-01, FR-SET-06, FR-SEC-04, TS-04; AC-F2, AC-D7, AC-D8, AC-D9.
- **SRS reference:** Vehicles L262–268; Data model L127–173; OQ-09 L636; OQ-17 L641; OQ-39 L660.

### FND-DAT-07 — entryRepo, reminderRepo, templateRepo, inviteRepo
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below); acceptance waits on gate G2.
- **User story:** As a developer, I want the remaining repositories to exist with validated reads and the `lastOdometer` batch behavior, so that tabs 2, 3, 6 and 7 add features without touching the data layer's shape.
- **Business value:** Delivers the "complete schema" and "repositories" promise so later tabs only add UI and domain logic (§24.3).
- **Scope:** *In:* `entryRepo` with validated reads (skip and report malformed), create, update and delete that write `lastOdometer` in the same batch taking the maximum, recompute of `lastOdometer` on edit or delete (OQ-17), `createdBy` and `updatedBy` set to the caller, an `hasEntries(vehicleId)` check, and an entry count across the user's vehicles (needed by the 5th-entry prompt); `reminderRepo`, `templateRepo` and `inviteRepo` modules with their zod schemas and validated reads. *Out:* entry forms, History, reminders logic, template copy, all invite behavior (tabs 2, 3, 6, 7), Drive attachment handling.
- **Preconditions:** DAT-05, SEC-02.
- **Functional behavior:**
  1. Creating an entry writes the entry and updates the vehicle's `lastOdometer` and `lastOdometerAt` in one batch, keeping the maximum.
  2. Editing or deleting an entry recomputes `lastOdometer` from the vehicle's remaining entries (and starting odometer, DR-01).
  3. `inviteRepo` exists but every call is denied by the Foundation rules.
- **Business rules:** `lastOdometer` is the maximum odometer across the vehicle's entries and its starting odometer; the client recomputes it; concurrent offline writes can briefly lower it and it self-corrects (OQ-17). Members may write only the three allowed vehicle fields.
- **Edge cases:** Deleting the entry that holds the maximum. An entry without an odometer. A vehicle with no entries. Decision applied: DR-23 for which operations `reminderRepo`, `templateRepo` and `inviteRepo` expose in Foundation.
- **Android/web differences:** Same as DAT-06.
- **Offline behavior:** Entry writes and the `lastOdometer` update queue together in one batch on Android.
- **Security implications:** `createdBy` and `updatedBy` are set from the session, never from caller input.
- **Data/schema impact:** Writes `entries` and updates three vehicle fields.
- **Acceptance criteria:**
  1. An entry create and its `lastOdometer` update are one batch and take the maximum [FR-DATA-11].
  2. Editing or deleting the maximum entry recomputes `lastOdometer` [OQ-17].
  3. A malformed entry document is skipped and reported, and the others load [AC-D12].
  4. An older-shape entry fixture upgrades on read [FR-DATA-06].
  5. `inviteRepo` operations are denied under the Foundation rules [FR-SEC-09].
- **Decisions applied:** DR-01 ✔, DR-20 ✔, DR-23 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
  3. **D3** [DR-23 ◐] `reminderRepo`, `templateRepo` and `inviteRepo` read and validate in Foundation, and `inviteRepo` has no write operations until the Sharing sub-project.
- **Test requirements:** Jest + Firestore emulator via the JS SDK (TS-04).
- **Dependencies:** FND-DAT-05, FND-SEC-02; gate FND-VER-01.
- **PRD requirement IDs:** FR-DATA-02, FR-DATA-03, FR-DATA-05, FR-DATA-06, FR-DATA-11, FR-SEC-05, FR-SEC-09, TS-04; AC-D12.
- **SRS reference:** Data model rationale L171–173; Security rules L202; OQ-17 L641; Repositories L98.

### FND-DAT-08 — Shared export/import serializer
- **Epic:** E2 Domain and data layer · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want one export/import format, so that account merge now and Drive backup and restore in tab 5 share one tested implementation.
- **Business value:** Makes the merge safe to retry and avoids two serializers drifting apart (FR-SER).
- **Scope:** *In:* `src/data/serializer/`: serialize every vehicle the user owns plus all entries, reminders and checklist templates into a versioned JSON-safe structure; an import planner that produces copies under deterministic ids derived from the source ids, owned by a target uid, in write order (vehicles before dependants) split into batches of at most 500; counts of vehicles and entries for the merge prompt; lossless encoding of timestamps. *Out:* the Drive backup file format and restore choices (tab 5), user settings (discarded in a merge), merge UI and execution (AUTH-05, AUTH-06).
- **Preconditions:** DAT-02. Reading from Firestore uses DAT-06 and DAT-07.
- **Functional behavior:**
  1. `serialize(ownerUid)` returns the structure and the counts.
  2. `planImport(structure, targetUid)` returns ordered batches. Re-planning the same input returns identical ids and batches.
  3. Copies keep `date`, `createdAt` and `updatedAt`; `createdBy` and `updatedBy` become the target uid; `createdByName` is kept; `ownerId`, `memberIds` and `members` point at the target uid.
- **Business rules:** Deterministic ids so retries do not duplicate (FR-SER-03, FR-MERGE-06). Vehicles are written before their entries because rules read the parent vehicle (OQ-22). Batch size is 500 (OQ-35). Settings are not part of a merge (OQ-07).
- **Edge cases:** 501 entries on one vehicle (the G3 fixture). Archived vehicles are included. Ids must be valid Firestore ids. Serialized data must survive being written to disk and read back unchanged. *Decisions applied:* `members` name and email in the copy for an owner who was anonymous (DR-02).
- **Android/web differences:** None (pure data code); merge is Android only.
- **Offline behavior:** N/A.
- **Security implications:** The serialized structure holds personal data; callers keep it in memory and in app-private storage only (AUTH-06).
- **Data/schema impact:** Defines the export structure and the id-derivation scheme; later reused by tab 5.
- **Acceptance criteria:**
  1. Serialize → plan → read back reproduces every field of every document in a fixture [FR-SER-04].
  2. Two plans from the same input have identical ids and batch boundaries [FR-SER-03].
  3. No batch exceeds 500 operations and no entry batch precedes its vehicle's batch [OQ-22, OQ-35].
  4. Attribution rewrite and preserved timestamps match FR-MERGE-08 exactly.
  5. A JSON round trip through a file is lossless for timestamps and money [FR-SER-04].
- **Decisions applied:** DR-01 ✔, DR-02 ✔, DR-03 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  3. **D3** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
- **Test requirements:** Jest round-trip tests (TS-03); a 501-entry fixture.
- **Dependencies:** FND-DAT-02 (pure part); FND-DAT-06 and FND-DAT-07 (read part).
- **PRD requirement IDs:** FR-SER-01, FR-SER-02, FR-SER-03, FR-SER-04, FR-MERGE-02, FR-MERGE-04, FR-MERGE-06, FR-MERGE-08, TS-03; AC-D6 (supports), AC-F3 (supports).
- **SRS reference:** Architecture code layout L88–89; Conflict L226–233; Merge details L240; OQ-22 L645; OQ-35 L656.

---

# E3 — Security rules

### FND-SEC-01 — Rules: default deny, users and vehicles
- **Epic:** E3 Security rules · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want rules for the user and vehicle paths with default deny, so that the backend, which is only rules, is safe from the first write.
- **Business value:** Rules are "the entire backend" and "the last line of defence" (RK-03, RK-18).
- **Scope:** *In:* global default deny; `users/{uid}` (self reads, creates, updates, deletes, with shape validation on create); `vehicles/{id}` create (signed-in user, including anonymous, as owner and only member), read (members), update (owner, with the membership invariants; members limited to `lastOdometer`, `lastOdometerAt`, `updatedAt` with `lastOdometer` a non-negative number), delete (owner); timestamps checked as not in the future; text and array caps. *Out:* entries, reminders, templates (SEC-02), later-tab path denial tests (SEC-03).
- **Preconditions:** PLT-02 (emulator config), DAT-02 (agreed shape).
- **Functional behavior:** As the matrix in SRS L185–191 for these two paths, plus the invariants: the owner is in `memberIds`; `members` keys match `memberIds`; `memberIds` has at most 10 entries; `ownerId` changes only to an existing member; `createdBy` and `updatedBy` equal the caller where present.
- **Business rules:** Every path is denied unless opened (FR-SEC-01). The `lastOdometer` exception lets members refresh the dashboard value only (FR-SEC-04). Rules read only the parent vehicle document when a subcollection rule needs membership (OQ-35); the vehicle path itself needs no extra read. Anonymous users hold the same rights over their own data (PRD §15.5).
- **Edge cases:** A member updating `lastOdometer` and `name` in one write → denied. Creating a vehicle with another uid in `memberIds` → denied. Query `where memberIds array-contains uid` must be allowed by the read rule. *Decisions applied:* whether the owner may directly change `ownerId`, `memberIds` or `members` in Foundation, given FR-SEC-09 requires ownership transfer to be tested as denied while OQ-34 states `ownerId` changes only to an existing member (DR-12); whether rules enforce anything specific for archived vehicles (DR-13).
- **Android/web differences:** None.
- **Offline behavior:** Queued writes are evaluated by the server on reconnect; rejection is surfaced by OBS-04.
- **Security implications:** This story is the security boundary. Client validation is not relied on (FR-SEC-07).
- **Data/schema impact:** Mirrors the DAT-02 schemas in `firestore.rules`; the rules file is versioned in the repo.
- **Acceptance criteria:**
  1. Each `users` and `vehicles` matrix row has an allowed and a denied emulator test [FR-SEC-08, AC-D18].
  2. A member's write touching any field other than the three allowed ones is denied; the three allowed fields succeed [FR-SEC-04].
  3. A create where `ownerId` is not the caller, or `memberIds` is not exactly `[caller]`, is denied [FR-VEH-11].
  4. Invariant violations (owner missing from `memberIds`, keys mismatch, more than 10 members) are denied [FR-SEC-12].
  5. A non-member read of a vehicle is denied; a member read succeeds [FR-SEC-02].
- **Decisions applied:** DR-01 ✔, DR-02 ✔, DR-03 ✔, DR-05 ✔, DR-06 ✔, DR-12 ✔, DR-13 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  3. **D3** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  4. **D4** [DR-05 ✔] A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected.
  5. **D5** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
  6. **D6** [DR-12 ✔] In the Foundation rules any update, by the owner or anyone else, that changes `ownerId`, `memberIds` or `members` is denied; creating a vehicle with the owner as the only member is allowed.
  7. **D7** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
- **Test requirements:** Emulator + `@firebase/rules-unit-testing`, allowed and denied per row, on every push (TS-01).
- **Dependencies:** FND-PLT-02, FND-DAT-02.
- **PRD requirement IDs:** FR-SEC-01, FR-SEC-02, FR-SEC-03, FR-SEC-04, FR-SEC-07, FR-SEC-08, FR-SEC-10, FR-SEC-12, FR-SEC-13, FR-VEH-11, NFR-02, NFR-10, TS-01; AC-F6, AC-D18.
- **SRS reference:** Security rules L181–204 (matrix L185–191, validation L200, exception L202); OQ-34 L655; Rules additions L803–810.

### FND-SEC-02 — Rules: entries, reminders and checklist templates
- **Epic:** E3 Security rules · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want the subcollection rules written and tested now, so that every later tab writes to a protected, validated data model.
- **Business value:** "The complete Firestore schema and rules" ships once, so tabs 2, 3 and 7 add no rule changes for their own data (PR-18).
- **Scope:** *In:* `vehicles/{id}/entries/{e}` (members read; members create with `createdBy` = caller; creator or owner update and delete; `createdBy` immutable; `updatedBy` = caller; `type` restricted to six values; `amount` required for fuel, expense, service and income with an integer `minor` and a currency equal to the vehicle's; timestamps not in the future; attachment, text and array caps); `reminders/{r}` (members read, create, update, delete, with shape validation); `checklistTemplates/{t}` (members read, create, update with at most 50 items; creator or owner delete). *Out:* invite, join, leave, transfer (default-denied in SEC-03).
- **Preconditions:** SEC-01.
- **Functional behavior:** As the matrix in SRS L185–191 and the later-tab list at L195, for these three paths. Membership is checked with one `get()` on the parent vehicle and nothing else.
- **Business rules:** Rules read only the parent vehicle document: repeated reads of the same document count once, while a write reading 11 distinct documents is denied (OQ-35). `get()` sees pre-write state, so an entry cannot share a batch with the creation of its vehicle (OQ-22).
- **Edge cases:** An entry in a batch with its new vehicle → denied; this is why the serializer writes vehicles first. A currency mismatch. A member editing another member's entry → denied; the owner may. A template with 51 items → denied.
- **Android/web differences:** None.
- **Offline behavior:** As SEC-01.
- **Security implications:** Cross-vehicle access is impossible because every check hangs off the vehicle's membership. Document counts cannot be limited by rules and there is no App Check in v1 (accepted limitation, OQ-33).
- **Data/schema impact:** Rules for three subcollections.
- **Acceptance criteria:**
  1. Each entries, reminders and checklistTemplates matrix row has an allowed and a denied emulator test [FR-SEC-08].
  2. Updating `createdBy` is denied; `updatedBy` not equal to the caller is denied [FR-SEC-05, FR-SEC-10].
  3. An entry whose `type` is outside the six, or whose `amount.minor` is not an integer, is denied [FR-SEC-03].
  4. A fuel, expense, service or income entry without `amount`, or with a currency different from the vehicle's, is denied [FR-SEC-11].
  5. A batch of 500 entries under one existing vehicle passes [OQ-35].
- **Decisions applied:** DR-03 ✔, DR-06 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  2. **D2** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
- **Test requirements:** Emulator rules tests, allowed and denied (TS-01).
- **Dependencies:** FND-SEC-01.
- **PRD requirement IDs:** FR-SEC-02, FR-SEC-03, FR-SEC-05, FR-SEC-06, FR-SEC-09, FR-SEC-10, FR-SEC-11, FR-SEC-12, FR-SEC-13, NFR-18, TS-01; AC-F6, AC-D18, AC-D21.
- **SRS reference:** Security rules L185–191, L195, L200, L204; OQ-04 L631; OQ-22 L645; OQ-31 L652; OQ-33 L654; OQ-35 L656.

### FND-SEC-03 — Rules: later-tab paths denied, matrix coverage and merge-path proof
- **Epic:** E3 Security rules · **Type:** Verification · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want invites, self-join, leave and ownership transfer proven denied and the whole matrix proven covered, so that Foundation ships a closed, verified backend and the merge path is proven to pass it.
- **Business value:** Satisfies the amended AC-F6 and de-risks AC-F3 before any merge UI exists.
- **Scope:** *In:* tests that `invites/{code}` read, create, update and delete are denied; that a non-member adding themselves to `memberIds`, a member removing themselves, an owner transfer, and member removal by a non-owner are denied; an inventory showing every matrix row has both an allowed and a denied test, including the `lastOdometer` exception and `createdBy` immutability; the batch-of-500 merge-path test (one vehicle and 501 entries under a different uid) kept as a permanent test; recording the production confirmation of the batch behavior (gate G3). *Out:* the real invite rules (tab 6).
- **Preconditions:** SEC-01, SEC-02, PLT-03.
- **Functional behavior:** Tests only, plus a coverage inventory that fails when a row lacks an allowed or a denied case.
- **Business rules:** Foundation "ships default-deny for `invites`, self-join, leave and ownership transfer, tested as denied" (FR-SEC-09, OQ-04). 500 is the batch size; rules read only the parent vehicle (OQ-35).
- **Edge cases:** Depends on the DR-12 decision for how "transfer" is exercised in a Foundation test. Production limits differ from the emulator: confirmation is recorded separately.
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** Prevents a silent regression that would open the later-tab paths.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Denied tests exist and pass for invite read/create/update/delete, self-join, leave, remove and transfer [FR-SEC-09, AC-F6].
  2. The inventory lists every matrix row with an allowed and a denied test; a missing one fails CI [TS-01, AC-D18].
  3. The 501-entry fixture written under a different uid in batches of 500 passes with the Foundation rules [AC-D21, G3].
  4. The same fixture's result against production Firestore is recorded; the PRD marks this "production confirmation pending" [G3].
- **Decisions applied:** DR-12 ✔, DR-21 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-12 ✔] In the Foundation rules any update, by the owner or anyone else, that changes `ownerId`, `memberIds` or `members` is denied; creating a vehicle with the owner as the only member is allowed.
  2. **D2** [DR-21 ✔] A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release.
- **Test requirements:** Emulator suite on every push; one recorded production run.
- **Dependencies:** FND-SEC-01, FND-SEC-02, FND-PLT-03; the production run needs DR-21.
- **PRD requirement IDs:** FR-SEC-08, FR-SEC-09, TS-01, TS-02 (denied part), §15.9 items 1–2, RK-26, RK-29; AC-F6, AC-D18, AC-D21; G3, G4.
- **SRS reference:** Security rules L193–198; OQ-04 L631; OQ-22 L645; OQ-35 L656; OQ-37 L658; Rules additions L810.

---

# E4 — Identity and account

### FND-AUTH-01 — Android first launch: anonymous bootstrap and offline gate
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a new Android user, I want the app to start without any sign-in, so that I can begin tracking my vehicle immediately.
- **Business value:** "No friction to start" (P4, PR-04). The anonymous account is what lets Android work offline from the first minute.
- **Scope:** *In:* read the persisted session; with none, `signInAnonymously()`; ensure `users/{uid}` with defaults; the "Connect to get started" screen when the first launch is offline, with automatic retry; handing control to the welcome screen (SHL-01). *Out:* the welcome screen itself, linking, web.
- **Preconditions:** DAT-03, DAT-06, SEC-01, PLT-02.
- **Functional behavior:**
  1. Read the persisted session from the native SDK.
  2. No session → `signInAnonymously()`.
  3. Create `users/{uid}` with INR, km, litres and the device language. If a session exists but the document is missing (app killed between steps), create it with defaults.
  4. If the network is unavailable at first launch, show "Connect to get started" and retry automatically; proceed when online.
  5. With the account established, the app opens and works with no network.
  6. A non-network or unknown sign-in failure shows a message with Retry.
- **Business rules:** No sign-in screen on Android. Anonymous users get no sign-out option. Anonymous sign-in needs the network once (L1 limitation).
- **Edge cases:** Killed between sign-in and document creation. Network drops during the first call. Retry cadence is an implementation choice and must not drain quota. The anonymous-user uninstall data-loss warning's placement is DR-16.
- **Android/web differences:** Android only. Web uses AUTH-02.
- **Offline behavior:** First launch needs the network once; afterwards fully offline.
- **Security implications:** Anonymous users are signed-in Firebase users with the same rights over their own data. The uid is never set as the Crashlytics user id (OQ-36).
- **Data/schema impact:** Creates `users/{uid}` (fields subject to DR-02, DR-03).
- **Acceptance criteria:**
  1. A fresh install with network reaches the next step with an anonymous session and a `users/{uid}` document and no sign-in screen shown [AC-F1, FR-AUTH-01/02/03].
  2. With the device offline on first launch, "Connect to get started" shows, retries by itself, and onboarding proceeds once online [AC-D1, FR-AUTH-05].
  3. Relaunching offline after a successful first launch opens the app [FR-AUTH-06].
  4. A session with no user document ends with a document created with defaults [OQ-39].
  5. A sign-in error other than offline shows a message with Retry [PRD §19.2].
- **Decisions applied:** DR-02 ✔, DR-03 ✔, DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  2. **D2** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  3. **D3** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** Unit tests of the bootstrap state machine with a fake adapter; emulator test for `ensureUser`; Maestro first-launch flow (with SHL-01); manual offline first launch.
- **Dependencies:** FND-DAT-03, FND-DAT-06, FND-SEC-01, FND-PLT-02.
- **PRD requirement IDs:** FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-05, FR-AUTH-06, FR-SET-06, PR-04, PR-06, OQ-39; AC-F1, AC-D1.
- **SRS reference:** First launch L210–216; Accepted limitations L825; OQ-39 L660.

### FND-AUTH-02 — Web Google sign-in
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a web user, I want to sign in with Google and see my vehicles, so that I can use the same data on a big screen.
- **Business value:** Gives web parity with Android for the same account (PR-07, AC-F4).
- **Scope:** *In:* a Google-only sign-in screen using the popup flow with the redirect fallback; creating `users/{uid}` on first sign-in; same-uid behavior with a linked Android account; cancellation and error handling. *Out:* the landing page (tab 8), deployment, email/password sign-in (not in v1).
- **Preconditions:** DAT-04, DAT-06, SEC-01, PLT-02, SHL-02 (route guard).
- **Functional behavior:**
  1. An unsigned-in web visitor sees the sign-in screen.
  2. Choosing Google opens the popup; success signs in. A blocked popup falls back to the redirect flow.
  3. A new Google account gets its `users/{uid}` document with defaults; an existing account reuses its document.
  4. The user lands in the shell and sees the same vehicles as on Android when the Android account was linked.
  5. Cancelling the Google dialog does nothing visible; a network or unknown error shows a message with Retry.
- **Business rules:** Google only. Web is online-only. "Same vehicles" holds because linking keeps the uid; a user who signs in on web first and later links on Android goes through the merge path (OQ-25).
- **Edge cases:** Popup blocked on mobile browsers. Session survives a reload. Anonymous accounts do not exist on web. *Decisions applied:* `isLinked` and `displayName` values for web-created documents (DR-02, DR-03).
- **Android/web differences:** Web only.
- **Offline behavior:** Sign-in needs the network; offline shows the offline banner (OBS-02).
- **Security implications:** Credentials stay in the SDK; nothing is logged. Web has no crash reporting in v1.
- **Data/schema impact:** Creates `users/{uid}` on first sign-in.
- **Acceptance criteria:**
  1. A Google sign-in on web reaches the shell [FR-WEB-01, AC-F4].
  2. A first-time Google account gets a `users/{uid}` document; a returning one does not get a second [FR-WEB-02].
  3. An Android-linked account signs in on web and shows the same vehicles [FR-WEB-03, AC-F4].
  4. Cancel is silent; error shows a message with Retry [FR-ERR-06].
  5. A blocked popup completes through the redirect flow [OQ-27].
- **Decisions applied:** DR-02 ✔, DR-03 ✔, DR-18 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  2. **D2** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  3. **D3** [DR-18 ◐] A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not.
- **Test requirements:** Component tests for the sign-in screen states; emulator test of the first-sign-in document creation; manual web smoke test (AC-F4 verification is manual, PRD §25.1).
- **Dependencies:** FND-DAT-04, FND-DAT-06, FND-SEC-01, FND-PLT-02, FND-SHL-02.
- **PRD requirement IDs:** FR-WEB-01, FR-WEB-02, FR-WEB-03, FR-WEB-04, FR-ERR-06, PR-07, §10.2; AC-F4.
- **SRS reference:** First launch, web L218; OQ-25 L648; OQ-27 L650.

### FND-AUTH-03 — Link Google (Android): mechanics and Account screen
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an anonymous Android user, I want to link my Google account, so that my data is tied to an account without moving or losing anything.
- **Business value:** Turns a device-bound anonymous account into a recoverable one, enabling backup, receipts, sharing and web access later (PR-06).
- **Scope:** *In:* More → Account screen; "Link Google" for anonymous users in the place sign-out would be; the link flow (Google Sign-In → ID token → `GoogleAuthProvider` credential → `linkWithCredential`); success handling (uid unchanged, `isLinked: true`); cancellation and error handling; handing `auth/credential-already-in-use` to AUTH-05. *Out:* the triggers (AUTH-04), the conflict prompt (AUTH-05), the Drive scope (FR-LINK-07), sign-out (AUTH-08).
- **Preconditions:** AUTH-01, DAT-03, DAT-06, PLT-02, SHL-02.
- **Functional behavior:**
  1. Account shows "Link Google" for an anonymous user and no sign-out.
  2. Tapping it starts Google Sign-In; the returned ID token becomes a credential passed to `linkWithCredential`.
  3. On success the uid is unchanged and `users/{uid}.isLinked` becomes `true`; no data moves.
  4. Cancelling is silent. A network or unknown error shows a message with Retry.
  5. A conflict error is passed on to the conflict flow.
- **Business rules:** The uid never changes on a successful link. Only basic sign-in scopes are requested.
- **Edge cases:** Account picker dismissed. No network during the attempt. The `isLinked` write is local-first and syncs later. Already-linked user opens Account → no Link button. What else the Account screen shows beyond Link Google and sign-out is Decision applied: DR-17.
- **Android/web differences:** Android only (web users are always Google-signed-in).
- **Offline behavior:** Linking needs the network; the follow-up flag write queues.
- **Security implications:** The ID token is never logged or reported. The uid is not set as Crashlytics user id.
- **Data/schema impact:** Sets `isLinked`; other writes depend on DR-02.
- **Acceptance criteria:**
  1. After a successful link the uid is the same and `isLinked` is `true` [AC-D4, FR-LINK-05].
  2. An anonymous user sees "Link Google" and no sign-out option [AC-D2, FR-OUT-03].
  3. Cancelling the Google dialog shows nothing and changes nothing [FR-ERR-06].
  4. A network or unknown error shows a message with Retry [PRD §19.2].
  5. No Drive scope is requested [FR-LINK-07].
- **Decisions applied:** DR-02 ✔, DR-17 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  2. **D2** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
- **Test requirements:** Unit tests with a fake adapter; link Google is a manual test with a test Google account (OQ-37 gap 3).
- **Dependencies:** FND-AUTH-01, FND-DAT-03, FND-DAT-06, FND-PLT-02, FND-SHL-02.
- **PRD requirement IDs:** FR-LINK-04, FR-LINK-05, FR-LINK-06, FR-LINK-07, FR-OUT-03, FR-ERR-06, PR-06, §10.5; AC-F3, AC-D2, AC-D4.
- **SRS reference:** Linking Google L220–224; Error handling L298–300; OQ-37 L658.

### FND-AUTH-04 — Link triggers: banner, 5th-entry prompt, required-step gate
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an anonymous Android user, I want clear nudges to link Google before I lose data, so that I understand my data is not backed up.
- **Business value:** Reduces anonymous data loss on uninstall (RK-12).
- **Scope:** *In:* the persistent "Your data isn't backed up" banner on More for anonymous users; the dismissible prompt after the 5th entry, counted across all vehicles, never shown again once dismissed; a reusable "require a linked account" gate that tabs 5 and 6 call before Drive backup, receipt photos or sharing. *Out:* the entry forms that create entries (tab 2); the Drive, receipt and sharing features that call the gate (tabs 5, 6).
- **Preconditions:** AUTH-03, DAT-07 (entry count), SHL-02.
- **Functional behavior:**
  1. More shows the banner while the user is anonymous; it does not go away by dismissal; it disappears once linked.
  2. When the user's entry count across all vehicles reaches 5, a dismissible link prompt appears; dismissing it means it does not reappear.
  3. The gate opens the link flow and reports linked, cancelled or failed to its caller.
- **Business rules:** The count is across all vehicles (OQ-05). A dismissed prompt does not reappear. The banner stays (OQ-05). Required-step wording is "required step before Drive backup, receipt photos, or sharing" (FR-LINK-03).
- **Edge cases:** The count includes entries on archived vehicles. Decision applied: DR-09: whether the prompt fires only at the moment the count becomes 5 or whenever the count is 5 or more and not dismissed; what a delete or undo that drops the count does; where "dismissed" and the count basis are stored.
- **Android/web differences:** Android only; linked and web users never see these.
- **Offline behavior:** The count is read from the local cache.
- **Security implications:** None beyond AUTH-03.
- **Data/schema impact:** None in Firestore; a local flag whose storage is DR-09.
- **Acceptance criteria:**
  1. The banner shows on More for an anonymous user and not for a linked one [FR-LINK-02].
  2. With 3 entries on one vehicle and 2 on another, the 5th entry triggers the prompt [FR-LINK-01, OQ-05].
  3. After dismissal, restarting the app does not show the prompt again [FR-LINK-08].
  4. The gate returns a result to its caller and starts the link flow [FR-LINK-03].
- **Decisions applied:** DR-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-09 ◐] The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted.
- **Test requirements:** Unit tests of the trigger logic against emulator fixtures (no entry UI exists until tab 2); RNTL for the banner and prompt; live check in tab 2.
- **Dependencies:** FND-AUTH-03, FND-DAT-07, FND-SHL-02.
- **PRD requirement IDs:** FR-LINK-01, FR-LINK-02, FR-LINK-03, FR-LINK-08, PR-06, OQ-05; AC-F3 (supports), AC-D2.
- **SRS reference:** Linking Google L222; Merge details L241; OQ-05 L632.

### FND-AUTH-05 — Account conflict: detection and the three-way choice
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an anonymous user linking a Google account that already has data, I want to choose whether to bring my phone's data along, so that I never lose data by accident.
- **Business value:** Resolves the one hard linking case without server code (§14.4).
- **Scope:** *In:* detecting `auth/credential-already-in-use` and keeping the Google credential from it; counting the owned vehicles and entries on the phone; the prompt *"This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?"* with **Move and switch** (→ AUTH-06), **Switch without moving**, **Cancel**; the two non-moving branches. *Out:* the merge itself (AUTH-06).
- **Preconditions:** AUTH-03, DAT-06, DAT-08 (counts), SHL-03.
- **Functional behavior:**
  1. A link attempt fails with the conflict error; the app shows the prompt with real counts.
  2. **Cancel** keeps the user anonymous with nothing changed.
  3. **Switch without moving** first warns that the phone's data cannot be recovered; on confirmation it signs in with the Google credential and leaves the phone's data behind.
  4. **Move and switch** starts the merge.
- **Business rules:** The Google account's existing settings win; the anonymous user's settings are discarded (OQ-07). The abandoned anonymous account's documents remain with no owner able to delete them (accepted limitation L3).
- **Edge cases:** The anonymous account has nothing to move (Decision applied: DR-10: wording and options). The Google credential expires before the user chooses. Singular and plural counts (DR-10). Which vehicle is selected after switching (DR-15).
- **Android/web differences:** Android only; not applicable on web.
- **Offline behavior:** The prompt appears only after a successful network call; the branches need the network.
- **Security implications:** The credential is kept in memory only; the warning guards against accidental data loss.
- **Data/schema impact:** None for Cancel; Switch signs in and ensures the user document.
- **Acceptance criteria:**
  1. On the conflict error the prompt shows the correct vehicle and entry counts and the three actions [AC-D5, FR-MERGE-07].
  2. Cancel leaves the session anonymous and all data untouched [OQ-06].
  3. Switch without moving shows the unrecoverable-data warning before signing in, and after confirming the phone's data is not copied [OQ-06].
  4. Move and switch hands off to the merge [FR-MERGE-01].
- **Decisions applied:** DR-10 ◐, DR-15 ◐, DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-10 ◐] With 0 vehicles and 0 entries the conflict dialog offers only Switch and Cancel; counts use plural forms ('1 vehicle', '2 vehicles'); Discard on 'Finish moving your data' asks for confirmation before deleting the stored data.
  2. **D2** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
  3. **D3** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** Component tests for the prompt; unit tests of the flow with a fake adapter; manual account-conflict merge on the release checklist (TS-07).
- **Dependencies:** FND-AUTH-03, FND-DAT-06, FND-DAT-08, FND-SHL-03.
- **PRD requirement IDs:** FR-MERGE-01, FR-MERGE-07, FR-MERGE-09, FR-ERR (row: account conflict), OQ-06, OQ-07; AC-F3, AC-D5.
- **SRS reference:** Conflict L226–233; Merge details L237–238; OQ-06 L633; OQ-07 L634.

### FND-AUTH-06 — Account merge: Move and switch
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** XL · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an anonymous user with data, I want to move my vehicles and entries into my existing Google account, so that I keep everything when I switch.
- **Business value:** Prevents data loss in the one case where the uid changes (RK-13).
- **Scope:** *In:* serialize while still anonymous; persist the serialized data to app-private storage; sign in with the Google credential; ensure the Google user document exists without overwriting it; write the copies in batches of 500 with vehicles first; completion and failure handling with retry. *Out:* resume after a kill (AUTH-07), the prompt (AUTH-05).
- **Preconditions:** AUTH-05, DAT-08, DAT-06, DAT-07, SEC-02, SEC-03.
- **Functional behavior:**
  1. **Read:** serialize every owned vehicle and its entries, reminders and checklist templates into memory.
  2. **Persist** the serialized data to app-private storage before signing in. This is needed so that a kill after sign-in is recoverable (PRD §14.4 edge case "app closed or killed after sign-in").
  3. **Sign in** with the Google credential; the anonymous session is replaced.
  4. Ensure the Google user document exists; never overwrite its settings.
  5. **Write** copies under deterministic ids owned by the Google uid, vehicles before dependants, in batches of 500, confirming each batch with the server.
  6. On success delete the stored data and finish.
  7. On a failure partway, keep the data in memory and on disk and offer Retry; a retry creates no duplicates.
- **Business rules:** Copies keep `date`, `createdAt`, `updatedAt`; `createdBy` and `updatedBy` become the new owner's uid; `createdByName` is kept (OQ-22). The anonymous account cannot be re-entered after sign-in. Retry data is kept until the merge succeeds or the user discards it (OQ-08).
- **Edge cases:** Connectivity lost mid-write: the native SDK queues writes and the confirmation never arrives, so the point at which the app shows failure and offers retry is Decision applied: DR-11. A rules rejection or `resource-exhausted` partway. Partial copies are visible in the Google account meanwhile.
- **Android/web differences:** Android only.
- **Offline behavior:** The merge needs the network; failure and retry behavior is DR-11.
- **Security implications:** The stored data is personal; it stays in app-private storage, is never sent to Crashlytics, and is deleted on success, discard or sign-out (FR-OUT-05). Rules admit the copies because ownership and attribution are rewritten and timestamps are not in the future (OQ-22).
- **Data/schema impact:** Creates documents under new ids; the anonymous account's originals remain orphaned (L3).
- **Acceptance criteria:**
  1. After "Move and switch" the Google account shows all the phone's vehicles, entries, reminders and templates with original dates and rewritten `createdBy` and `updatedBy` [AC-F3, FR-MERGE-08].
  2. A write failing partway leaves the data in memory and on disk and offers Retry; the retry completes with no duplicate documents [AC-D6, FR-MERGE-05, FR-MERGE-06].
  3. The anonymous user's settings are discarded and the Google account's are unchanged [FR-MERGE-09].
  4. A fixture with one vehicle and 501 entries merges in batches of 500 against the Foundation rules [AC-D21].
- **Decisions applied:** DR-02 ✔, DR-11 ◐, DR-15 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  2. **D2** [DR-11 ◐] A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline.
  3. **D3** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
- **Test requirements:** Emulator integration test of the merge write path including failure injection and retry (OQ-37 gap 2); unit tests of the flow state machine; manual account-conflict merge on the release checklist.
- **Dependencies:** FND-AUTH-05, FND-DAT-08, FND-DAT-06, FND-DAT-07, FND-SEC-02, FND-SEC-03.
- **PRD requirement IDs:** FR-MERGE-02, FR-MERGE-03, FR-MERGE-04, FR-MERGE-05, FR-MERGE-06, FR-MERGE-08, FR-MERGE-09, FR-SER-02, FR-SER-03, FR-OFF-09, RK-13, RK-26; AC-F3, AC-D6, AC-D21.
- **SRS reference:** Conflict L226–233; Merge details L235–241; OQ-22 L645; OQ-35 L656; OQ-37 L658.

### FND-AUTH-07 — Merge resume and discard ("Finish moving your data")
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user whose merge was interrupted, I want the app to offer to finish it, so that my data is not stranded.
- **Business value:** The anonymous account cannot be re-entered, so this is the only way to recover an interrupted merge (L8).
- **Scope:** *In:* on every launch, detect stored retry data and show "Finish moving your data" with Retry and Discard; Retry resumes with the same deterministic ids; success or discard deletes the stored data. *Out:* the first-attempt merge (AUTH-06).
- **Preconditions:** AUTH-06.
- **Functional behavior:**
  1. After the session is read, if retry data exists, show "Finish moving your data" before normal navigation.
  2. Retry continues the write; Discard removes the data.
  3. Retry data is kept until the merge succeeds or the user discards it, then deleted.
- **Business rules:** OQ-08, OQ-23. Sign-out also deletes retry data (FR-OUT-05).
- **Edge cases:** Kill during the last batch. Retry after a partial success creates no duplicates. Discard is irreversible: any confirmation is Decision applied: DR-10.
- **Android/web differences:** Android only.
- **Offline behavior:** Retry needs the network; same wait semantics as DR-11.
- **Security implications:** As AUTH-06; the stored data is deleted on discard.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Killing the app after sign-in and before the write completes, then relaunching, shows "Finish moving your data" [FR-MERGE-10, OQ-23].
  2. Retry completes the merge with no duplicates [AC-D6].
  3. Discard deletes the stored data and the prompt does not return [FR-MERGE-10].
- **Decisions applied:** DR-10 ◐, DR-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-10 ◐] With 0 vehicles and 0 entries the conflict dialog offers only Switch and Cancel; counts use plural forms ('1 vehicle', '2 vehicles'); Discard on 'Finish moving your data' asks for confirmation before deleting the stored data.
  2. **D2** [DR-11 ◐] A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline.
- **Test requirements:** Integration test with a fake adapter and the emulator; add tests for merge resume (OQ-37 gap 4).
- **Dependencies:** FND-AUTH-06.
- **PRD requirement IDs:** FR-MERGE-10, FR-MERGE-05, OQ-08, OQ-23; AC-D6.
- **SRS reference:** Merge details L239; OQ-08 L635; OQ-23 L646.

### FND-AUTH-08 — Sign-out
- **Epic:** E4 Identity and account · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a linked user, I want to sign out safely, so that the next person on the device sees none of my data and I do not lose unsynced changes by accident.
- **Business value:** Delivers the privacy goal that "the next person on the device sees nothing" (PRV-07) and prevents silent loss of queued writes (RK-27).
- **Scope:** *In:* sign-out for linked users in More → Account on Android and web; the pending-writes dialog on Android; the clearing steps; anonymous users get no sign-out. *Out:* account deletion (tab 8).
- **Preconditions:** AUTH-03, DAT-03, DAT-04, DAT-05, SHL-04.
- **Functional behavior:**
  1. A linked Android user taps sign out. If writes are pending, a dialog shows how many changes have not synced and offers **Wait and sync** or **Sign out and discard**.
  2. Wait and sync waits for the pending writes to reach the server, then signs out. Sign out and discard signs out at once.
  3. After sign-out on Android, call `clearPersistence()`; also clear scheduled notifications, the saved selected vehicle, any merge retry data and the Google Sign-In session.
  4. On web, sign out normally and return to the sign-in screen; there is no persistent cache to clear.
  5. Anonymous users see no sign-out; "Link Google" is shown instead.
- **Business rules:** FR-OUT-01 to FR-OUT-05.
- **Edge cases:** Zero pending writes → no dialog. Offline with pending writes: whether Wait and sync can be cancelled and any time-out is Decision applied: DR-11. App killed between sign-out and cache clearing. What the user sees on the next launch (a fresh anonymous bootstrap, DR-09). Dialog wording is DR-16.
- **Android/web differences:** Pending-writes dialog and `clearPersistence()` are Android only.
- **Offline behavior:** Pending changes are counted from the local queue.
- **Security implications:** Residual cache, selection, notifications, retry data or Google session after sign-out would expose the previous user's data; each is cleared (PRV-07).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. After a linked user signs out, the persisted cache is empty [AC-D3, FR-OUT-02].
  2. With pending writes the dialog shows the count and both options [AC-D23, FR-OUT-04].
  3. The selected vehicle, merge retry data and Google Sign-In session are cleared [FR-OUT-05].
  4. An anonymous user has no sign-out and sees "Link Google" [AC-D2, FR-OUT-03].
  5. Airplane mode → add a vehicle → sign out shows the count; Sign out and discard loses it; Wait and sync syncs it after reconnect [G5].
- **Decisions applied:** DR-09 ◐, DR-11 ◐, DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-09 ◐] The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted.
  2. **D2** [DR-11 ◐] A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline.
  3. **D3** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** Unit tests of the sequence with a fake adapter; add tests for sign-out with pending writes (OQ-37 gap 4); Maestro or manual run of gate G5.
- **Dependencies:** FND-AUTH-03, FND-DAT-03, FND-DAT-04, FND-DAT-05, FND-SHL-04.
- **PRD requirement IDs:** FR-OUT-01, FR-OUT-02, FR-OUT-03, FR-OUT-04, FR-OUT-05, FR-OFF-08, FR-ERR-09, PRV-07, OQ-24; AC-D2, AC-D3, AC-D23; G5.
- **SRS reference:** Sign-out L243–246; Error handling L303; OQ-24 L647.

---

# E5 — App shell and UX foundation

### FND-SHL-01 — Android welcome screen and first-run routing
- **Epic:** E5 App shell and UX foundation · **Type:** User-facing · **Size:** S · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a new Android user, I want one short welcome screen and then to be taken straight to adding my first vehicle, so that I start without any sign-in.
- **Business value:** The visible half of "no friction to start" (P4, G5, PR-04).
- **Scope:** *In:* one welcome screen with the text "Free. No ads. Your data stays yours." and a **Get started** action that opens "Add your first vehicle". *Out:* the vehicle form (VEH-01), the web landing page (tab 8).
- **Preconditions:** AUTH-01, SHL-02, SET-01; VEH-01 for the destination.
- **Functional behavior:** After bootstrap succeeds on a first launch, show the welcome screen; **Get started** opens the add-vehicle flow. No sign-in screen appears at any point.
- **Business rules:** Exactly one welcome screen before adding the first vehicle (OQ-61). English text through i18n.
- **Edge cases:** Relaunch before adding a vehicle. Back from the add-vehicle form. Font scaling and screen reader. The persistence rule is Decision applied: DR-09.
- **Android/web differences:** Android only. Web shows the sign-in screen (AUTH-02).
- **Offline behavior:** Works offline once the account exists.
- **Security implications:** None.
- **Data/schema impact:** None in Firestore (flag storage is DR-09).
- **Acceptance criteria:**
  1. A fresh install shows one welcome screen with the exact text, then "Add your first vehicle", with no sign-in screen [AC-F1, AC-D22].
  2. **Get started** is a tap target of at least 48 dp with a screen-reader label [AC-D17].
- **Decisions applied:** DR-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-09 ◐] The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted.
- **Test requirements:** RNTL for the screen; Maestro first launch → add vehicle → change settings (TS-06).
- **Dependencies:** FND-AUTH-01, FND-SHL-02, FND-SET-01, FND-VEH-01.
- **PRD requirement IDs:** FR-AUTH-04, PR-04, FR-NAV-08; AC-F1, AC-D22.
- **SRS reference:** First launch L214; Principles L16; OQ-61 L709.

### FND-SHL-02 — Navigation shell
- **Epic:** E5 App shell and UX foundation · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want a consistent app frame, so that I can reach vehicles, settings and my account from any screen and see where future features will appear.
- **Business value:** Fixes the structure every later tab fills in (§24.3).
- **Scope:** *In:* Expo Router routes shared by Android and web; top bar with the vehicle switcher slot (filled by SHL-04); four tabs Dashboard, History, Reports, More; an Add button on Dashboard and History opening a sheet with Fuel, Expense, Service, Income, Trip, Inspection, each opening a placeholder screen; the More list (Vehicles, Reminders, Checklists, Backup & export, Join a vehicle, Settings, Account, About & privacy) with "Coming soon" on unbuilt items; web at 768 px and wider: left navigation rail and dialog forms; web below 768 px: mobile layout; the "Add your first vehicle" empty state instead of an empty dashboard. *Out:* tab contents (tabs 2–7), entry forms.
- **Preconditions:** SHL-03, SET-01, PLT-01.
- **Functional behavior:**
  1. Four tabs appear with the same routes on Android and web.
  2. The Add sheet lists six entry types; each opens a placeholder.
  3. More lists eight items; Vehicles, Settings and Account lead to their Foundation screens; Reminders, Checklists, Backup & export and Join a vehicle show "Coming soon"; About & privacy is a shell (content is tab 8).
  4. At 768 px and wider on web the tabs become a left rail and forms open as dialogs.
- **Business rules:** All tabs are scoped to the selected vehicle (FR-NAV-02). Unbuilt features show "Coming soon" (PRD §17.4).
- **Edge cases:** Resizing across 768 px. Deep links to web URLs. *Decisions applied:* what Dashboard, History and Reports show when a vehicle exists, whether the Add button shows with no vehicle, and About & privacy content (DR-17).
- **Android/web differences:** Android four tabs and sheet; web ≥768 rail and dialogs; web <768 mobile layout (OQ-21).
- **Offline behavior:** The shell renders from cache on Android; web shows the offline banner (OBS-02).
- **Security implications:** All routes sit behind the signed-in state.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The same routes work on Android and web; at ≥768 px web shows a left rail and dialog forms [AC-D14, FR-NAV-06, FR-NAV-07].
  2. The Add sheet lists Fuel, Expense, Service, Income, Trip and Inspection, each opening a placeholder [AC-D15, FR-NAV-04].
  3. Unbuilt More items show "Coming soon" [AC-D16, FR-NAV-05].
  4. A first-time user with no vehicle sees "Add your first vehicle" instead of an empty dashboard [FR-NAV-08].
  5. Web below 768 px uses the mobile layout [FR-NAV-10].
- **Decisions applied:** DR-17 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
- **Test requirements:** RNTL for the Add sheet and More list; layout tests at 767 and 768 px; manual web smoke.
- **Dependencies:** FND-SHL-03, FND-SET-01, FND-PLT-01.
- **PRD requirement IDs:** FR-NAV-01, FR-NAV-02, FR-NAV-03, FR-NAV-04, FR-NAV-05, FR-NAV-06, FR-NAV-07, FR-NAV-08, FR-NAV-10, FR-SCAF-01, NFR-12, §17.1, §17.2, §17.4; AC-D14, AC-D15, AC-D16.
- **SRS reference:** Navigation L254–260; OQ-21 L644.

### FND-SHL-03 — UI foundation: theme, dark mode and accessibility baseline
- **Epic:** E5 App shell and UX foundation · **Type:** Architecture · **Size:** M · **Readiness:** Ready
- **User story:** As a developer, I want a themed, accessible component base, so that every screen gets dark mode, font scaling, 48 dp targets and screen-reader labels by default.
- **Business value:** Builds accessibility in once instead of fixing it screen by screen (NFR-11).
- **Scope:** *In:* React Native Paper (Material 3) theme provider; light, dark and system modes driven by the Theme setting; system font scaling; shared components (buttons, list rows, sheets and dialogs, form fields, banners, empty state) with tap targets of at least 48 dp; icon-only buttons that require a screen-reader label; a breakpoint helper for 768 px. Visual styling follows the design reference without adding requirements. *Out:* the Theme setting UI (SET-02).
- **Preconditions:** PLT-01.
- **Functional behavior:** Components render correctly in light and dark; text scales with the system font setting; an icon-only button without a label fails type-checking or lint.
- **Business rules:** Paper theming for dark mode and system font scaling; targets ≥ 48 dp; labels on every icon-only button (NFR-11).
- **Edge cases:** Largest system font scale; dark mode on web; high-contrast is not specified.
- **Android/web differences:** Same components; web adds the breakpoint helper.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Shared components meet the 48 dp minimum and require labels on icon-only buttons [AC-D17].
  2. Switching theme changes all components with no hard-coded colours outside the theme [FR-SET-01 display].
  3. Text honours the system font scale without clipping on the shared components [NFR-11].
- **Test requirements:** RNTL tests on the shared components; manual dark-mode and font-scaling checks on the release checklist (TS-07).
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** NFR-11, PR-20, §17.6, §17.7; AC-D17.
- **SRS reference:** UI kit L109; Accessibility L286; Testing manual row L320.

### FND-SHL-04 — Vehicle switcher and selected-vehicle state
- **Epic:** E5 App shell and UX foundation · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user with several vehicles, I want to switch the active vehicle from the top bar, so that every tab shows the vehicle I mean.
- **Business value:** All tabs are vehicle-scoped; the switcher is how the user controls scope (FR-NAV-02).
- **Scope:** *In:* top-bar switcher showing name, type icon and colour; non-archived vehicles only; an "All vehicles" entry that changes only the Reports tab scope; selection persisted across launches per uid; fallback after the selected vehicle is archived or deleted. *Out:* Reports content (tab 4).
- **Preconditions:** DAT-06, SHL-02, SHL-03.
- **Functional behavior:**
  1. The switcher lists the user's non-archived vehicles with name, type icon and colour; choosing one rescopes all tabs.
  2. Choosing "All vehicles" changes the scope for the Reports tab only; the other tabs keep the last single vehicle.
  3. The selection is remembered per uid across launches; sign-out clears it (AUTH-08).
  4. If the selected vehicle is archived or deleted, the most recently used remaining vehicle is selected.
- **Business rules:** Archived vehicles are hidden from the switcher (FR-VEH-05). Selection is stored per uid (OQ-39). "All vehicles" lives in the switcher (OQ-49).
- **Edge cases:** One vehicle only. No vehicles (switcher hidden, empty state). Selected vehicle removed on another device. Decision applied: DR-15: how "most recently used" is tracked and stored (the schema has no field for it), the default when no selection is stored, and storage on web.
- **Android/web differences:** Same behavior; storage mechanism differs (DR-15).
- **Offline behavior:** The list comes from the cache.
- **Security implications:** The saved selection is cleared on sign-out.
- **Data/schema impact:** None in Firestore.
- **Acceptance criteria:**
  1. Archived vehicles are absent from the switcher [AC-D9, FR-NAV-01].
  2. Choosing "All vehicles" changes only the Reports tab scope [AC-D25, FR-NAV-09].
  3. The selection persists across a restart [FR-NAV-02].
  4. After archiving the selected vehicle another vehicle is selected [FR-VEH-13].
- **Decisions applied:** DR-04 ◐, DR-15 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-04 ◐] The palette has 12 ids `c01` to `c12`, each with contrast-checked colours in light and dark mode, and each of the six vehicle types shows its own icon.
  2. **D2** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
- **Test requirements:** React Native Testing Library switcher tests (TS-05).
- **Dependencies:** FND-DAT-06, FND-SHL-02, FND-SHL-03.
- **PRD requirement IDs:** FR-NAV-01, FR-NAV-02, FR-NAV-09, FR-VEH-13, FR-VEH-15, §17.3, TS-05, OQ-39, OQ-49; AC-D9, AC-D25.
- **SRS reference:** Navigation L256–257; OQ-09 L636; OQ-39 L660; OQ-49 L681.

---

# E6 — Vehicle management

### FND-VEH-01 — Add a vehicle (including the first-vehicle empty state)
- **Epic:** E6 Vehicle management · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to add a vehicle with its basic details, so that the app is scoped to it.
- **Business value:** Reaching a first vehicle quickly is the Foundation's main outcome (AC-F1, AC-F2).
- **Scope:** *In:* the empty state "Add your first vehicle"; More → Vehicles → Add; the form: required name, type (car, bike, scooter, truck, bus, other), fuel types (any combination of petrol, diesel, CNG, LPG, electric), odometer unit (km, mi, hours), current odometer; optional make, model, year, plate; a colour from the 12-colour palette; currency defaulting from the user's Currency setting and overridable; validation by the shared zod schema; saving through `vehicleRepo`. *Out:* edit, archive, delete (VEH-02 to VEH-04).
- **Preconditions:** DAT-06, SET-02 (defaults), SHL-02, SHL-03.
- **Functional behavior:**
  1. From the empty state or from More → Vehicles → Add, the user fills the form.
  2. Currency and odometer unit start from the user's settings (FR-VEH-10).
  3. Saving creates the vehicle with the signer as owner and only member; it appears in the switcher and becomes the scope of all tabs.
  4. On web at ≥768 px the form is a dialog.
- **Business rules:** Required and optional fields as listed (FR-VEH-01, FR-VEH-02). `hours` is selectable for any type (FR-VEH-16). Odometer is stored in the vehicle's own unit.
- **Edge cases:** Validation errors shown inline. Double tap on Save. A rules rejection returns an error. *Decisions applied:* how "current odometer" is stored (DR-01); `members` name and email for an anonymous owner (DR-02); palette contents (DR-04); name uniqueness and length, year range, odometer limits and decimals (DR-05); the rules' text-length caps the form must mirror (DR-06); the displayed unit for the odometer (DR-08); the selection made after saving (DR-15).
- **Android/web differences:** Android works offline with the pending-sync icon; web disables Save offline (OBS-02).
- **Offline behavior:** The vehicle saves locally and syncs later on Android (FR-VEH-09).
- **Security implications:** Plate and name are personal data; they are never sent to Crashlytics (PRV-03). Rules enforce owner invariants.
- **Data/schema impact:** Creates a `vehicles` document.
- **Acceptance criteria:**
  1. A user with no vehicles sees "Add your first vehicle" and can complete the form [FR-VEH-08, AC-F1].
  2. Missing required fields block saving with inline errors [FR-VEH-01, TS-05].
  3. The saved vehicle has the signer as `ownerId` and only member and the chosen colour [FR-VEH-03, FR-VEH-11].
  4. The same flow works in airplane mode on Android [AC-F2, FR-VEH-09].
  5. New vehicles take currency and units from settings and allow per-vehicle overrides [FR-VEH-10].
- **Decisions applied:** DR-01 ✔, DR-02 ✔, DR-04 ◐, DR-05 ✔, DR-06 ✔, DR-08 ◐, DR-15 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-02 ✔] An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing.
  3. **D3** [DR-04 ◐] The palette has 12 ids `c01` to `c12`, each with contrast-checked colours in light and dark mode, and each of the six vehicle types shows its own icon.
  4. **D4** [DR-05 ✔] A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected.
  5. **D5** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
  6. **D6** [DR-08 ◐] A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes.
  7. **D7** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
- **Test requirements:** RNTL vehicle-form validation (TS-05); emulator repo test; Maestro first launch → add vehicle.
- **Dependencies:** FND-DAT-06, FND-SET-02, FND-SHL-02, FND-SHL-03.
- **PRD requirement IDs:** FR-VEH-01, FR-VEH-02, FR-VEH-03, FR-VEH-08, FR-VEH-09, FR-VEH-10, FR-VEH-11, FR-VEH-12, FR-VEH-16, FR-VEH-17, FR-NAV-08, PR-08, §10.3, TS-05; AC-F1, AC-F2.
- **SRS reference:** Vehicles L262–268; OQ-11 L638; OQ-12 L639.

### FND-VEH-02 — Edit a vehicle (locked units)
- **Epic:** E6 Vehicle management · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to edit my vehicle's details, so that the record stays correct without breaking my entries.
- **Business value:** Prevents corrupting entry data by changing units or currency after entries exist (AC-D7).
- **Scope:** *In:* editing every field; locking odometer unit and currency once the vehicle has entries; owner-only editing. *Out:* archive and delete.
- **Preconditions:** VEH-01, DAT-06, DAT-07.
- **Functional behavior:** The edit form shows all fields. If the vehicle has entries, odometer unit and currency are read-only with a short reason. Saving updates the vehicle.
- **Business rules:** Only the owner updates a vehicle. Odometer unit and currency are immutable once any entry exists (FR-VEH-04). Archived vehicles are read-only until unarchived (OQ-39, DR-13).
- **Edge cases:** Entries exist only from a device not yet synced (the lock is client-side: rules cannot check entry existence). Edit while offline. *Decisions applied:* editing the current odometer when entries exist (DR-01).
- **Android/web differences:** As VEH-01.
- **Offline behavior:** Works offline on Android.
- **Security implications:** Rules restrict update to the owner; the lock is not a security boundary.
- **Data/schema impact:** Updates `vehicles` fields and `updatedAt`.
- **Acceptance criteria:**
  1. With at least one entry, the odometer unit and currency fields are locked in the form [AC-D7, FR-VEH-04].
  2. With no entries both fields are editable [FR-VEH-04].
  3. A direct attempt to change a locked field through the repository is rejected [AC-D7].
  4. Editing works offline on Android [AC-F2].
- **Decisions applied:** DR-01 ✔, DR-05 ✔, DR-13 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [DR-05 ✔] A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected.
  3. **D3** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
- **Test requirements:** RNTL locked-unit tests (TS-05); emulator repo test with a seeded entry.
- **Dependencies:** FND-VEH-01, FND-DAT-06, FND-DAT-07.
- **PRD requirement IDs:** FR-VEH-04, FR-VEH-09, FR-VEH-15, FR-VEH-16, PR-08, TS-05, OQ-11; AC-F2, AC-D7.
- **SRS reference:** Vehicles L265; OQ-11 L638; OQ-39 L660.

### FND-VEH-03 — Archive, unarchive and the Vehicles list
- **Epic:** E6 Vehicle management · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to archive a vehicle I no longer use and bring it back later, so that my switcher stays tidy without losing history.
- **Business value:** Keeps history and lifetime reports while decluttering (FR-VEH-05).
- **Scope:** *In:* More → Vehicles list with active and archived vehicles and the pending-sync icon; archive; unarchive; selection fallback; the all-archived empty state offering Unarchive and Add. *Out:* delete (VEH-04).
- **Preconditions:** VEH-01, SHL-04, OBS-04 (sync icon component).
- **Functional behavior:**
  1. Archive hides the vehicle from the switcher and keeps its entries.
  2. An archived vehicle is listed in More → Vehicles and can be unarchived there.
  3. After archiving the selected vehicle the most recently used remaining vehicle is selected.
  4. If every vehicle is archived, an empty state offers Unarchive and Add.
- **Business rules:** Archived vehicles are read-only until unarchived (OQ-39). Only the owner archives and unarchives.
- **Edge cases:** Archiving the only vehicle. Archive while offline. *Decisions applied:* which actions remain on an archived vehicle (DR-13) and the "most recently used" definition (DR-15).
- **Android/web differences:** As VEH-01.
- **Offline behavior:** Works offline on Android; the row shows the sync icon until confirmed.
- **Security implications:** Owner-only by rules.
- **Data/schema impact:** Updates `archived` and `updatedAt`.
- **Acceptance criteria:**
  1. An archived vehicle is absent from the switcher and can be unarchived from More → Vehicles [AC-D9, FR-VEH-06].
  2. Archive keeps the vehicle's entries [FR-VEH-05].
  3. With all vehicles archived the empty state offers Unarchive and Add [FR-VEH-13].
  4. Archive and unarchive work offline on Android [AC-F2].
- **Decisions applied:** DR-08 ◐, DR-13 ◐, DR-15 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-08 ◐] A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes.
  2. **D2** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  3. **D3** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
- **Test requirements:** RNTL tests for the list and empty state; emulator repo test.
- **Dependencies:** FND-VEH-01, FND-SHL-04, FND-OBS-04.
- **PRD requirement IDs:** FR-VEH-05, FR-VEH-06, FR-VEH-09, FR-VEH-13, FR-VEH-15, PR-08, §10.4; AC-F2, AC-D9.
- **SRS reference:** Vehicles L266; OQ-09 L636; OQ-39 L660.

### FND-VEH-04 — Delete a vehicle
- **Epic:** E6 Vehicle management · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to permanently delete a vehicle and all its data after a deliberate confirmation, so that I stay in control of my data.
- **Business value:** Deletion is the counterpart of "never held hostage"; the typed-name guard prevents accidents.
- **Scope:** *In:* delete from More → Vehicles; a warning with the member count when the vehicle has more than one member; confirmation by typing the vehicle name; deleting entries, reminders and checklist templates in batches of 500 and then the vehicle; progress, failure, and retry or resume; selection fallback. *Out:* Drive receipt cleanup (tab 5, OQ-51), account deletion (tab 8).
- **Preconditions:** VEH-03, DAT-06, DAT-07, SEC-02.
- **Functional behavior:**
  1. The owner chooses Delete; a shared vehicle first warns with the member count.
  2. The user types the vehicle name; Delete is enabled only when it matches.
  3. Children are deleted in batches of 500, then the vehicle last.
  4. A failure leaves the vehicle in place and can be retried or resumed.
  5. After deletion the most recently used remaining vehicle is selected.
- **Business rules:** FR-VEH-07, FR-VEH-14. The vehicle is removed last so a failed delete is resumable (OQ-09).
- **Edge cases:** More than 500 children. Interruption between batches. Offline delete on Android queues locally. *Decisions applied:* whether an interrupted delete resumes automatically on launch or only on user retry, whether the typed name is matched exactly or ignoring case and spaces, and how a partly deleted vehicle appears (DR-14).
- **Android/web differences:** Web requires the network.
- **Offline behavior:** Works offline on Android (FR-VEH-09).
- **Security implications:** Only the owner can delete; members cannot (rules).
- **Data/schema impact:** Deletes the subtree.
- **Acceptance criteria:**
  1. Delete is blocked until the exact vehicle name is typed [AC-D8, FR-VEH-07].
  2. A vehicle with more than 500 children is deleted in batches and removed last [AC-D8].
  3. After an induced mid-delete failure the vehicle remains and a retry finishes the job [FR-VEH-14].
  4. A shared vehicle shows the member count in the warning [FR-VEH-14].
  5. Delete works offline on Android [AC-F2].
- **Decisions applied:** DR-13 ◐, DR-14 ◐, DR-15 ◐, DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [DR-14 ◐] An interrupted vehicle delete leaves the vehicle listed with a 'Delete didn't finish' badge and Retry, and does not resume by itself at launch; the typed name matches ignoring case and surrounding spaces.
  3. **D3** [DR-15 ◐] After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected.
  4. **D4** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** Emulator repo test with more than 500 children and failure injection; RNTL for the typed-name gate.
- **Dependencies:** FND-VEH-03, FND-DAT-06, FND-DAT-07, FND-SEC-02.
- **PRD requirement IDs:** FR-VEH-07, FR-VEH-09, FR-VEH-13, FR-VEH-14, PR-08, §10.4; AC-F2, AC-D8.
- **SRS reference:** Vehicles L267; OQ-09 L636.

---

# E7 — Settings and localization

### FND-SET-01 — i18n scaffolding
- **Epic:** E7 Settings and localization · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want all user-visible text to go through i18n from day one, so that adding a language later needs no code change.
- **Business value:** "Translation-ready from day one" (FR-I18N-03).
- **Scope:** *In:* i18next and expo-localization initialization; the English resource bundle; locale detection (device language if supported, else English); plural support; a check that fails when a screen contains a hard-coded user-visible string; a place for the strings that this backlog marks as provisional (DR-16). *Out:* other languages (not in v1), settings UI.
- **Preconditions:** PLT-01.
- **Functional behavior:** `t()` returns English strings; an unsupported device language resolves to English; counts such as "2 vehicles and 14 entries" can be pluralized.
- **Business rules:** English only in v1 (FR-I18N-04). Default language is the device language if supported, else English (FR-I18N-05).
- **Edge cases:** A device language such as `fr` or `en-IN`. Missing key behavior in development.
- **Android/web differences:** Locale detection source differs (device vs browser).
- **Offline behavior:** Bundled resources; no network.
- **Security implications:** None.
- **Data/schema impact:** The `locale` value stored in settings uses the encoding fixed by DR-03.
- **Acceptance criteria:**
  1. No hard-coded user-visible string passes the automated check [FR-I18N-03, FR-SCAF-07].
  2. A device language outside the supported set resolves to English [FR-I18N-05].
  3. A second resource bundle can be added in a test without changing application code [NFR-13].
- **Decisions applied:** DR-03 ✔, DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  2. **D2** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** Unit tests; the string-literal check runs in CI.
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** FR-I18N-03, FR-I18N-04, FR-I18N-05, FR-SCAF-07, NFR-13, PR-19; AC-F5 (language part).
- **SRS reference:** Localization L32; i18n library L112; Settings Language row L279.

### FND-SET-02 — Settings
- **Epic:** E7 Settings and localization · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to choose currency, units, efficiency format, date format, theme and language, so that the app shows values the way I read them.
- **Business value:** Delivers India defaults with the flexibility to change them (PR-09, PR-19).
- **Scope:** *In:* More → Settings with Currency (ISO 4217 list, default INR), Distance unit (km, mi; km), Volume unit (litres, US gallons, UK gallons; litres), Efficiency format (km/l, L/100 km, mpg; km/l), Date format (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD; DD/MM/YYYY), Theme (System, light, dark; System), Language (English only; device language if supported else English); persistence in `users/{uid}.settings`; a settings hook and formatters that drive display; defaults feeding new vehicles. *Out:* backup frequency (tab 5) and reminder mute (tab 3), which are stored but not shown in Foundation.
- **Preconditions:** DAT-01, DAT-06, SET-01, SHL-03, SHL-02.
- **Functional behavior:**
  1. Each setting shows its options and current value; changing one saves it and updates all display at once.
  2. Settings persist across restarts and across devices of the same account.
  3. Changing a unit or format converts what is shown; stored data is never rewritten; amounts are never converted between currencies.
  4. The Currency setting sets the default currency for new vehicles and how amounts are formatted.
- **Business rules:** FR-SET-01 to FR-SET-06. The vehicle's own currency and odometer unit lock once entries exist.
- **Edge cases:** User document missing (bootstrap creates it). Distance unit versus a vehicle's `hours` unit. Theme "System" follows the OS. *Decisions applied:* stored values and seeded keys (DR-03), amount and number formatting and the `mpg` definition (DR-07), which Foundation screens display currency, volume and efficiency and which unit a vehicle's odometer is shown in (DR-08).
- **Android/web differences:** Android writes locally and works offline; web needs the network.
- **Offline behavior:** Works offline on Android.
- **Security implications:** `users/{uid}` is self-only by rules.
- **Data/schema impact:** Writes `users/{uid}.settings`.
- **Acceptance criteria:**
  1. All seven settings persist after a restart and drive display [AC-F5, FR-SET-01].
  2. A settings change alters displayed values and leaves stored values unchanged; the Currency setting never converts an existing amount [AC-D10, FR-SET-03].
  3. New vehicles default to the user's currency and units [FR-VEH-10, FR-SET-02].
  4. A new user starts with INR, km, litres and the device language [FR-SET-06].
  5. Theme changes apply immediately, including dark mode [AC-D17].
- **Decisions applied:** DR-03 ✔, DR-07 ◐, DR-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  2. **D2** [DR-07 ◐] 245000 minor units of INR show as ₹2,450.00 and 123456700 as ₹12,34,567.00; a USD amount shows with international grouping; funds, metal and test codes such as XAU, XTS and XXX are not selectable; `mpg` uses US gallons unless the Volume setting is UK gallons; any combination of Distance, Volume and Efficiency settings is accepted; converted distance and volume show one decimal.
  3. **D3** [DR-08 ◐] A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes.
- **Test requirements:** RNTL tests that each setting changes the displayed values on the Foundation screens that exist (DR-08); unit tests of formatters; manual dark-mode check.
- **Dependencies:** FND-DAT-01, FND-DAT-06, FND-SET-01, FND-SHL-03, FND-SHL-02.
- **PRD requirement IDs:** FR-SET-01, FR-SET-02, FR-SET-03, FR-SET-04, FR-SET-05, FR-SET-06, FR-I18N-01, FR-I18N-02, PR-09, PR-19, OQ-29; AC-F5, AC-D10.
- **SRS reference:** Settings L270–284; OQ-29 L651.

---

# E8 — Resilience and observability

### FND-OBS-01 — Per-screen error boundaries
- **Epic:** E8 Resilience and observability · **Type:** User-facing · **Size:** S · **Readiness:** Ready
- **User story:** As a user, I want a crash in one screen to stay in that screen, so that I can retry without losing the app.
- **Business value:** "No failure takes down more than one screen" (NFR-07).
- **Scope:** *In:* an error boundary around every route screen showing "Something went wrong" with Retry; reporting the error as a non-fatal on Android through OBS-05. *Out:* web crash reporting (not in v1).
- **Preconditions:** SHL-02, SET-01.
- **Functional behavior:** An unhandled exception in a screen renders "Something went wrong" with Retry; Retry re-mounts the screen; the tab bar or rail and other screens keep working.
- **Business rules:** FR-ERR-02. Web shows the boundary but has no crash reporting (OQ-10).
- **Edge cases:** Error inside the boundary's own fallback; repeated failures after Retry.
- **Android/web differences:** Android reports a non-fatal; web does not.
- **Offline behavior:** N/A.
- **Security implications:** The report carries no personal data (OBS-05).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A thrown error in one screen shows "Something went wrong" with Retry while other tabs stay usable [AC-F7, FR-ERR-02].
  2. Retry re-renders the screen [AC-F7].
- **Test requirements:** RNTL test with a throwing component.
- **Dependencies:** FND-SHL-02, FND-SET-01; reports through FND-OBS-05.
- **PRD requirement IDs:** FR-ERR-01, FR-ERR-02, FR-SCAF-05, NFR-07, OQ-10; AC-F7.
- **SRS reference:** Error handling L290, L301; OQ-10 L637.

### FND-OBS-02 — Connectivity and quota behaviors
- **Epic:** E8 Resilience and observability · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want the app to tell me clearly when I am offline on web or when sync is paused, so that I know whether my changes are safe.
- **Business value:** Offline is normal on Android and a hard stop on web; quota exhaustion must not look like a bug (RK-15).
- **Scope:** *In:* Android offline shows no error and saves locally; web offline shows a banner and disables saving; quota exhaustion (`resource-exhausted`) shows "Sync paused, your entries are safe on this device" on Android and resumes after the daily reset, and "Service busy, try again later" on web; a non-fatal on any `resource-exhausted`. *Out:* the Sync issues notice (OBS-04).
- **Preconditions:** DAT-03, DAT-04, DAT-05, SHL-03, OBS-05.
- **Functional behavior:**
  1. Android offline: no banner, writes save, the pending icon shows.
  2. Web offline: the banner shows and Save is disabled. Offline is detected through the browser's online and offline events plus a write time-out.
  3. Quota exceeded: the stated message per platform; Android resumes by itself when writes succeed again.
- **Business rules:** FR-OFF-05 to FR-OFF-07, FR-OFF-14, FR-ERR-07. Any `resource-exhausted` in production triggers a Firestore usage review (a process step).
- **Edge cases:** Web loses connectivity mid-save. Quota hit during a merge (AUTH-06 behavior). *Decisions applied:* the time-out value and what happens on time-out (DR-18); text for the banner (DR-16).
- **Android/web differences:** As described; web has no pending state beyond memory.
- **Offline behavior:** This story defines it.
- **Security implications:** Reports carry error codes only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Offline on Android shows no error and the write appears with the pending icon [FR-OFF-05, FR-OFF-03].
  2. Offline on web shows a banner and disables saving [FR-ERR-07, FR-OFF-06].
  3. A `resource-exhausted` error shows the stated message on each platform [FR-OFF-07].
  4. Android sync resumes without user action after the quota resets [FR-OFF-07].
- **Decisions applied:** DR-16 ◐, DR-18 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
  2. **D2** [DR-18 ◐] A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not.
- **Test requirements:** Unit tests with a fake adapter emitting errors; RNTL for the banner; manual web offline toggle in the web smoke test.
- **Dependencies:** FND-DAT-03, FND-DAT-04, FND-DAT-05, FND-SHL-03, FND-OBS-05.
- **PRD requirement IDs:** FR-OFF-05, FR-OFF-06, FR-OFF-07, FR-OFF-14, FR-ERR-01, FR-ERR-07, PR-03, NFR-06, RK-15, §19.4.
- **SRS reference:** Error handling L292–295, L307; OQ-27 L650.

### FND-OBS-03 — Access-denied and malformed-document behaviors
- **Epic:** E8 Resilience and observability · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want a clear message when I lose access or when one record is damaged, so that the rest of the app keeps working.
- **Business value:** One failing document must never block a list (FR-DATA-05).
- **Scope:** *In:* permission denied as a member shows "You no longer have access to this vehicle" and switches vehicle; as an owner it is reported as a bug; a malformed document is skipped, "1 entry couldn't be shown" is shown, and a non-fatal with the document path is logged. *Out:* sharing and removal (tab 6).
- **Preconditions:** DAT-05, SHL-04, OBS-05.
- **Functional behavior:** The repository reports permission-denied and skipped documents; screens render the stated messages; permission-denied for a member switches to another vehicle.
- **Business rules:** FR-ERR-03, FR-ERR-04. "Owner: report as a bug" (meaning in DR-16).
- **Edge cases:** All documents in a list malformed. Several skipped documents (plural wording). Invite paths redacted from the report (OBS-05).
- **Android/web differences:** Same on both.
- **Offline behavior:** A permission error surfaced from a queued write uses OBS-04.
- **Security implications:** The report holds the path only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A member losing access sees "You no longer have access to this vehicle" and the app switches vehicle [AC-D11, FR-ERR-04].
  2. A malformed document is skipped, "1 entry couldn't be shown" shows, and a non-fatal with the document path is logged [AC-D12, FR-ERR-03].
  3. An owner permission-denied is reported as a bug [FR-ERR-04].
- **Decisions applied:** DR-16 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
- **Test requirements:** RNTL with injected repository results; emulator test with a seeded malformed document.
- **Dependencies:** FND-DAT-05, FND-SHL-04, FND-OBS-05.
- **PRD requirement IDs:** FR-ERR-01, FR-ERR-03, FR-ERR-04, FR-DATA-05; AC-D11, AC-D12.
- **SRS reference:** Error handling L296–297.

### FND-OBS-04 — Pending-sync indicator and Sync issues
- **Epic:** E8 Resilience and observability · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an Android user, I want to see which changes have not synced and to be told if one was rejected, so that I never lose a change silently.
- **Business value:** Removes silent data loss from queued writes (RK-27).
- **Scope:** *In:* a sync icon on items with pending writes (vehicle rows in Foundation); a warning state on an item whose queued write the server rejected; a Sync issues notice listing the changes that could not be saved with Retry or Discard; on web an error message with Retry. *Out:* the attachment upload queue (tab 5).
- **Preconditions:** DAT-05, DAT-03, SHL-03.
- **Functional behavior:**
  1. Items with `hasPendingWrites` show the icon.
  2. When the server rejects a queued write, the item shows a warning and the Sync issues notice lists it.
  3. Retry resubmits; Discard drops the change.
  4. A permission-denied rejection after removal uses the existing "You no longer have access to this vehicle" message (OBS-03).
- **Business rules:** FR-DATA-08, FR-OFF-13, FR-ERR-08.
- **Edge cases:** App closed before the rejection arrives. Many failed writes. Decision applied: DR-19: exact Retry and Discard semantics and persistence. Notice and warning wording is DR-16.
- **Android/web differences:** Android has the icon and notice; web shows an error with Retry.
- **Offline behavior:** The icon is driven by local metadata.
- **Security implications:** Entries in the list hold document ids and error codes only in any report.
- **Data/schema impact:** None in Firestore.
- **Acceptance criteria:**
  1. An item with a pending write shows the sync icon until confirmed [FR-OFF-03].
  2. A server-rejected queued write shows a warning and appears in the Sync issues notice with Retry or Discard [AC-D24, FR-OFF-13].
  3. On web a rejected write shows an error message with Retry [PRD §19.2].
- **Decisions applied:** DR-16 ◐, DR-19 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
  2. **D2** [DR-19 ◐] Retry in Sync issues resubmits the original change; Discard returns the item to its server state; the list is not kept after a restart and never shows amounts, plates or notes.
- **Test requirements:** Unit tests with a fake adapter that rejects after acknowledgement; add tests for rejected queued writes (OQ-37 gap 4); G5 second step verified with an emulator-seeded vehicle where membership was lost.
- **Dependencies:** FND-DAT-03, FND-DAT-05, FND-SHL-03.
- **PRD requirement IDs:** FR-DATA-08, FR-OFF-03, FR-OFF-13, FR-ERR-08, OQ-26; AC-D24; G5.
- **SRS reference:** Architecture L102; Error handling L302; OQ-26 L649.

### FND-OBS-05 — Crashlytics and privacy-safe error reporting
- **Epic:** E8 Resilience and observability · **Type:** Architecture · **Size:** M · **Readiness:** Ready
- **User story:** As the maintainer, I want crashes and non-fatal errors reported without personal data, so that I can fix problems while keeping the privacy promise.
- **Business value:** Minimal telemetry is a product principle (P5, PR-05).
- **Scope:** *In:* Crashlytics on Android for crashes and non-fatals; a reporting wrapper that accepts only document ids and paths, error codes and app state; redaction of `invites/{code}` paths; no uid as the Crashlytics user id; validation errors reduced to codes and paths; a no-op on web; no analytics SDK; a way to trigger a test crash and a non-fatal in non-production builds for verification. *Out:* the privacy policy disclosure of the installation id (tab 8).
- **Preconditions:** DAT-03, PLT-02.
- **Functional behavior:** `reportNonFatal(code, context)` sanitizes and sends; uncaught crashes are reported by the SDK; web calls do nothing.
- **Business rules:** Reports carry document ids, error codes and app state only, never amounts, plates, names or notes (NFR-04). Invite paths are redacted and the uid is not the user id (OQ-36). No analytics (OQ-14).
- **Edge cases:** Firebase or zod messages that embed field values: the wrapper drops message text and keeps codes. Free-text custom keys are not allowed.
- **Android/web differences:** Android reports; web has no crash reporting in v1 (OQ-10).
- **Offline behavior:** The SDK queues reports until online.
- **Security implications:** The sanitizer is the control; its tests use inputs seeded with amounts, plates, names and notes.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A test crash and a test non-fatal appear in Crashlytics with no amounts, plates, names or notes [AC-F7, AC-D13].
  2. Sanitizer tests with PII-laden inputs produce events containing only ids, paths, codes and app state [PRV-03].
  3. An `invites/...` path is redacted and no uid is set as the user id [PRV-13].
  4. The dependency tree has no analytics SDK [PRV-04].
- **Test requirements:** Unit tests of the sanitizer; manual Crashlytics console check of a test crash and a test non-fatal (PRD §25.1 mapping).
- **Dependencies:** FND-DAT-03, FND-PLT-02.
- **PRD requirement IDs:** FR-ERR-05, NFR-04, PRV-03, PRV-04, PRV-13, PR-05, OQ-10, OQ-14, OQ-36; AC-F7, AC-D13.
- **SRS reference:** Crashlytics rule L305; Principles L17; OQ-10 L637; OQ-14 L640; OQ-36 L657.

---

# E9 — Verification gates

### FND-VER-01 — Spike: Firestore quota budget (gate G2)
- **Epic:** E9 Verification gates · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the read and write cost of each Foundation operation counted, so that I know the free plan holds at the expected user count before the data layer is accepted.
- **Business value:** There is no Blaze fallback; a quota hit pauses sync for everyone until the daily reset (RK-25).
- **Scope:** *In:* count Firestore reads and writes per operation (cold start and vehicle list, add vehicle, edit, archive, delete with N children, account merge of one vehicle with N entries, the 5th-entry count, settings change, refresh) at 100 to 500 daily active users with cache-first reads; project against 50,000 reads and 20,000 writes per day; recommend query changes if over. *Out:* tab 2 and tab 4 operations (their own budgets).
- **Preconditions:** PLT-02; emulator request logging.
- **Functional behavior:** A written budget with per-operation counts and the projection.
- **Business rules:** Budget for roughly 100 to 500 daily active users, no Blaze fallback (OQ-18). Reads are cache-first with a refresh control (NFR-20).
- **Edge cases:** Rules `get()` reads counted per request (RK-04). The "agreed share" of quota is not defined (DR-20).
- **Android/web differences:** Cache-first applies on Android; web has an in-memory cache only.
- **Offline behavior:** Counts assume cache-first behavior.
- **Security implications:** None.
- **Data/schema impact:** May recommend query changes before the repositories are accepted.
- **Acceptance criteria:**
  1. A document lists reads and writes per Foundation operation and the daily projection at 100 and 500 users [G2].
  2. The projection is compared with the agreed share and recorded as pass or fail [G2, DR-20].
  3. DAT-05, DAT-06 and DAT-07 are not accepted before this passes [PRD §24.6].
- **Decisions applied:** DR-20 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
- **Test requirements:** Measured counts from the emulator.
- **Dependencies:** FND-PLT-02; it gates acceptance of FND-DAT-05, FND-DAT-06, FND-DAT-07.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-02, RK-25, OQ-18, FR-OFF-12; G2.
- **SRS reference:** OQ-18 L642; Error handling L307; Limitations L831.

### FND-VER-02 — Foundation end-to-end and manual verification pack
- **Epic:** E9 Verification gates · **Type:** Verification · **Size:** M · **Readiness:** Ready once the stories it exercises are built: decisions applied (see below).
- **User story:** As the maintainer, I want the Foundation's Maestro flows and manual checks defined and run, so that every AC-F criterion has recorded evidence.
- **Business value:** The "Done when" list is only done when it is proven.
- **Scope:** *In:* Maestro flows for first launch → add vehicle → change settings; an airplane-mode flow for vehicle add, edit, archive and delete (the entry-logging variant is added in tab 2); a committed manual checklist with a run record covering link Google with a test Google account, account-conflict merge, merge resume, web smoke test, dark mode, font scaling, a test crash and a test non-fatal, and sign-out with pending writes (G5). *Out:* closed-tester sign-in (G6), tab 2+ flows.
- **Preconditions:** All functional stories built.
- **Functional behavior:** Flows and checklist are runnable by someone other than the author.
- **Business rules:** Link Google stays manual (OQ-37 gap 3). The PRD's verification mapping (§25.1) is marked "Proposed".
- **Edge cases:** Maestro cannot drive the Google dialog. A test Google account with and without existing data is needed for the merge.
- **Android/web differences:** Maestro is Android only; web is a manual smoke test.
- **Offline behavior:** The airplane-mode flow is the native offline proof (OQ-37 gap 1).
- **Security implications:** The test account holds no real data.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Maestro passes first launch → add vehicle → change settings [AC-F1, AC-F5, TS-06].
  2. Maestro passes airplane-mode add, edit, archive and delete of a vehicle [AC-F2, TS-06].
  3. The manual checklist is executed and recorded for AC-F3, AC-F4, AC-F7, dark mode, font scaling and G5 [TS-07].
- **Decisions applied:** DR-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-08 ◐] A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes.
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** All stories.
- **PRD requirement IDs:** TS-06, TS-07, §21.5, §25.1 (verification mapping); AC-F1 to AC-F7 (evidence); G5.
- **SRS reference:** Testing L309–322; OQ-37 L658.

---

# A. Foundation epics

| Epic | Purpose | Stories | Source "Done when" criteria it serves |
| --- | --- | --- | --- |
| **E1 Platform and tooling** | One Expo codebase for Android and web, Firebase and OAuth configured once, CI on every push | PLT-01, PLT-02, PLT-03 | Enables all; AC-D19, AC-D20 |
| **E2 Domain and data layer** | Pure money and unit logic, the complete zod schema, both Firebase adapters, repositories, shared serializer | DAT-01 to DAT-08 | AC-F2, AC-F3 (serializer), AC-F4 (web adapter) |
| **E3 Security rules** | Default-deny rules for the whole data model, later-tab paths proven denied, merge path proven to pass | SEC-01 to SEC-03 | AC-F6 |
| **E4 Identity and account** | Anonymous start, web Google sign-in, link, conflict choice, merge, resume, sign-out | AUTH-01 to AUTH-08 | AC-F1, AC-F3, AC-F4 |
| **E5 App shell and UX foundation** | Welcome screen, navigation shell, theme and accessibility base, vehicle switcher | SHL-01 to SHL-04 | AC-F1, AC-D14 to AC-D17, AC-D22, AC-D25 |
| **E6 Vehicle management** | Add, edit with locked units, archive and unarchive, delete | VEH-01 to VEH-04 | AC-F2 |
| **E7 Settings and localization** | i18n scaffolding and the seven settings | SET-01, SET-02 | AC-F5 |
| **E8 Resilience and observability** | Error boundaries, connectivity and quota behavior, access-denied and malformed-document behavior, sync indicators, Crashlytics | OBS-01 to OBS-05 | AC-F7 |
| **E9 Verification gates** | The quota-budget spike and the end-to-end and manual verification pack | VER-01, VER-02 | All (evidence) |

**Architectural versus user-facing split.** Architecture or setup: PLT-01–03, DAT-01–08, SEC-01–02, SHL-03, SET-01, OBS-05. Verification: SEC-03, VER-01, VER-02. User-facing: AUTH-01–08, SHL-01, SHL-02, SHL-04, VEH-01–04, SET-02, OBS-01–04.

---

# B. Stories in dependency order

Waves group stories whose dependencies are all in earlier waves. Stories inside a wave can run in parallel. A story marked ◆ has a decision (DR) that must be answered before the marked part can be finished; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | FND-PLT-01 | Project scaffold, identity and build guardrails | L | — |
| W1 | FND-PLT-02 ◆ | Firebase project and Google OAuth configuration | M | — |
| W2 | FND-PLT-03 | Continuous integration pipeline | M | PLT-01 |
| W2 | FND-DAT-01 ◆ | Domain: money and units | M | PLT-01 |
| W2 | FND-DAT-02 ◆ | Complete Firestore schema and validation | L | PLT-01 |
| W2 | FND-DAT-03 | Adapter contract and native adapter | L | PLT-01, PLT-02 |
| W2 | FND-SHL-03 | UI foundation: theme, dark mode, accessibility | M | PLT-01 |
| W2 | FND-SET-01 | i18n scaffolding | M | PLT-01 |
| W2 | FND-VER-01 ◆ | Spike: quota budget (G2) | S | PLT-02 |
| W3 | FND-DAT-04 ◆ | Web adapter | M | DAT-03, PLT-02 |
| W3 | FND-SEC-01 ◆ | Rules: default deny, users, vehicles | L | PLT-02, DAT-02 |
| W3 | FND-OBS-05 | Crashlytics and privacy-safe reporting | M | DAT-03, PLT-02 |
| W3 | FND-SHL-02 ◆ | Navigation shell | L | SHL-03, SET-01 |
| W4 | FND-DAT-05 | Repository core | L | DAT-01–04; **gate VER-01** |
| W4 | FND-SEC-02 ◆ | Rules: entries, reminders, templates | L | SEC-01 |
| W4 | FND-OBS-01 | Per-screen error boundaries | S | SHL-02, SET-01 |
| W5 | FND-DAT-06 ◆ | userRepo and vehicleRepo | L | DAT-05, SEC-01 |
| W5 | FND-DAT-07 ◆ | entryRepo, reminderRepo, templateRepo, inviteRepo | M | DAT-05, SEC-02 |
| W5 | FND-SEC-03 ◆ | Rules: later-tab denial, coverage, merge-path proof | M | SEC-01, SEC-02, PLT-03 |
| W5 | FND-OBS-02 ◆ | Connectivity and quota behaviors | M | DAT-03–05, SHL-03, OBS-05 |
| W5 | FND-OBS-04 ◆ | Pending-sync indicator and Sync issues | L | DAT-03, DAT-05, SHL-03 |
| W6 | FND-DAT-08 ◆ | Shared export/import serializer | L | DAT-02, DAT-06, DAT-07 |
| W6 | FND-AUTH-01 ◆ | Android first launch: anonymous bootstrap | M | DAT-03, DAT-06, SEC-01, PLT-02 |
| W6 | FND-AUTH-02 ◆ | Web Google sign-in | M | DAT-04, DAT-06, SEC-01, SHL-02 |
| W6 | FND-SET-02 ◆ | Settings | L | DAT-01, DAT-06, SET-01, SHL-02, SHL-03 |
| W6 | FND-SHL-04 ◆ | Vehicle switcher and selected-vehicle state | M | DAT-06, SHL-02, SHL-03 |
| W7 | FND-VEH-01 ◆ | Add a vehicle | L | DAT-06, SET-02, SHL-02, SHL-03 |
| W7 | FND-AUTH-03 ◆ | Link Google and Account screen | L | AUTH-01, DAT-03, DAT-06, SHL-02 |
| W7 | FND-OBS-03 ◆ | Access-denied and malformed-document behaviors | M | DAT-05, SHL-04, OBS-05 |
| W8 | FND-SHL-01 ◆ | Android welcome screen | S | AUTH-01, SHL-02, SET-01, VEH-01 |
| W8 | FND-VEH-02 ◆ | Edit a vehicle (locked units) | M | VEH-01, DAT-06, DAT-07 |
| W8 | FND-VEH-03 ◆ | Archive, unarchive, Vehicles list | M | VEH-01, SHL-04, OBS-04 |
| W8 | FND-AUTH-04 ◆ | Link triggers | M | AUTH-03, DAT-07, SHL-02 |
| W8 | FND-AUTH-05 ◆ | Account conflict: choice prompt | M | AUTH-03, DAT-06, DAT-08, SHL-03 |
| W8 | FND-AUTH-08 ◆ | Sign-out | L | AUTH-03, DAT-03–05, SHL-04 |
| W9 | FND-VEH-04 ◆ | Delete a vehicle | L | VEH-03, DAT-06, DAT-07, SEC-02 |
| W9 | FND-AUTH-06 ◆ | Account merge: Move and switch | XL | AUTH-05, DAT-08, SEC-02, SEC-03 |
| W10 | FND-AUTH-07 ◆ | Merge resume and discard | M | AUTH-06 |
| W11 | FND-VER-02 | End-to-end and manual verification pack | M | All |

---

# C. Stories that can run in parallel

**Within each wave** every story is independent of the others in that wave (section B). The largest parallel groups:

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | PLT-01 ∥ PLT-02 | Code scaffold versus console configuration |
| Foundations after the scaffold | PLT-03 ∥ DAT-01 ∥ DAT-02 ∥ DAT-03 ∥ SHL-03 ∥ SET-01 ∥ VER-01 | Different folders; only the scaffold is shared |
| Backend track versus UI track | (DAT-04, SEC-01, OBS-05) ∥ (SHL-02) | Rules and adapters have no UI dependency |
| Rules versus repositories | SEC-01 → SEC-02 → SEC-03 ∥ DAT-05 → DAT-06 / DAT-07 | Rules tests use the emulator directly and agree with zod only through DAT-02 |
| Failure-mode UI | OBS-01 ∥ OBS-02 ∥ OBS-04 | Each owns different rows of the failure table |
| Android versus web identity | AUTH-01 ∥ AUTH-02 | Different adapters and platforms |
| Vehicle screens | VEH-02 ∥ VEH-03 (after VEH-01) | Edit versus archive |
| Link side | AUTH-04 ∥ AUTH-05 ∥ AUTH-08 (after AUTH-03) | Triggers, conflict prompt and sign-out are separate flows |

**Early starts inside a story.** The pure part of DAT-08 (serialize and plan import) needs only DAT-02 and can begin in W3; its read-from-Firestore part waits for DAT-06 and DAT-07. FND-VER-02's checklist and Maestro flow skeletons can be drafted from W4 on.

**Cannot be parallelized (a chain):** AUTH-03 → AUTH-05 → AUTH-06 → AUTH-07, and DAT-05 → DAT-06 → VEH-01 → VEH-03 → VEH-04.

---

# D. Blocking dependencies

**D1. Critical path.**
`PLT-01/02 → DAT-02/03 → [VER-01 gate] → DAT-05 → DAT-06 → SET-02 + SHL-04 → VEH-01 → AUTH-03 (needs AUTH-01) → AUTH-05 → AUTH-06 → AUTH-07 → VER-02`.

**D2. Gate G2 (FND-VER-01).** PRD §24.6 says G2 "gates" the Foundation data layer. DAT-05, DAT-06 and DAT-07 can be built while it runs but are not accepted until it passes. If it fails, query design changes before those stories are accepted. G2 cannot pass until DR-20 defines the threshold.

**D3. Decisions that block the schema freeze.** The model is meant to need no migrations, so DR-01, DR-02, DR-03, DR-05, DR-06 and DR-12 should be answered before FND-DAT-02 and FND-SEC-01 are accepted. Section E lists what each blocks.

**D4. Cross-story technical constraints.**
- Rules `get()` sees pre-write state (OQ-22), so an entry cannot share a batch with its vehicle's creation. FND-DAT-08 must emit vehicles first and FND-SEC-02 and FND-SEC-03 must test the same ordering.
- A batch of 500 is acceptable only while rules read just the parent vehicle (OQ-35). Any rule added later that reads another document breaks merge and delete.
- Anything that reaches Firestore on Android must go through DAT-03's interface; DAT-05's local-first write helper is the only place that returns before server confirmation.

**D5. External prerequisites** (not stories, but they block work):
- Firebase and Google Cloud console access for project `milevana` (PLT-02).
- Two test Google accounts, one with existing data and one empty, and an Android device or emulator with Google Play services (AUTH-03, AUTH-05, AUTH-06, VER-02).
- A GitHub repository with secrets configured, and an EAS account (PLT-03).
- Rules and indexes available on the production project before development builds can read or write (DR-21).

**D6. Later-tab dependencies.** The 5th-entry prompt, locked units with real entries, `lastOdometer` in the live app and the "1 entry couldn't be shown" message on real entries can only be seen end-to-end after tab 2. Foundation proves them with repository and emulator fixtures. The closed-tester sign-in test (G6) is outside Foundation.

---

# E. [DECISION REQUIRED] items

These are not resolved in this backlog. "Level" says how early the answer is needed:
**Schema** = before FND-DAT-02 and FND-SEC-01 are accepted · **Story** = before the named story is accepted · **Copy** = does not block engineering (provisional text keys), needed before release.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **DR-01** | **Starting odometer.** Is the "current odometer" entered when adding a vehicle stored only as `lastOdometer`, or in an additional field? What is `lastOdometerAt` at creation? What does editing it mean once entries exist? | FR-VEH-01 requires "current odometer". The vehicle schema (SRS L139–146) holds only `lastOdometer` and `lastOdometerAt`. OQ-17 and OQ-48 refer to a vehicle's "starting odometer" as an input to `lastOdometer` and to all-time distance, but no field stores it. | DAT-02 (shape), SEC-01 (create validation), DAT-06 and DAT-07 (create and recompute), DAT-08, VEH-01, VEH-02 | Schema |
| **DR-02** | **Identity values on a vehicle and user.** What are `members[uid].name` and `.email`, the owner's role value, and `users.displayName` for an anonymous user? Does linking Google (or a first web sign-in) set `displayName` and update `members` on vehicles already owned? What `name` do merge copies carry? | FR-VEH-11 and the schema require `role, name, email, joinedAt`. FR-AUTH-03 creates `users/{uid}` with settings only. Anonymous users have no name or email. FR-MERGE-08 keeps `createdByName` but is silent on `members`. | DAT-02, SEC-01, DAT-06, DAT-08, AUTH-01, AUTH-02, AUTH-03, AUTH-06, VEH-01 | Schema |
| **DR-03** | **Stored encodings and initial values.** (a) String values for fuel types (the SRS example uses lowercase `"petrol", "cng"`; the fuel-details text writes `CNG`, `LPG`), roles, colour (id or hex), and each setting (distance, volume, efficiency, date format, theme, locale). (b) Stored `category` and `serviceType` values. (c) First `schemaVersion` value and its type. (d) Numeric type of fuel `quantity`. (e) `isLinked` on documents created at web sign-in. (f) Which settings keys Foundation writes at creation. (g) Behavior when a document's `schemaVersion` is newer than the app knows. | The SRS gives names and option labels, not stored values. FR-AUTH-03 lists only currency, units and language as defaults; `backupFrequency` (default Weekly, tab 5) and `mutedReminderVehicleIds` (tab 3) are in the schema. FR-DATA-06 says repositories upgrade older shapes and says nothing about newer ones. | DAT-02, SEC-01, SEC-02, SET-01, SET-02, AUTH-01, AUTH-02, DAT-08 | Schema |
| **DR-04** | **The 12-colour palette** (values) and the vehicle-type icons. | OQ-12 fixes the count (12) and not the colours. FR-NAV-01 requires a type icon without naming them. | VEH-01, SHL-04 (final visuals only) | Story |
| **DR-05** | **Vehicle field constraints.** Name length and whether names must be unique; make, model and plate length or format; year range; odometer minimum, maximum and decimals (and for `hours`); whether zero fuel types is allowed. | FR-VEH-01 and FR-VEH-02 list fields only. FR-SEC-03 says rules validate "required fields and types". | DAT-02, SEC-01, VEH-01, VEH-02 | Schema |
| **DR-06** | **Rules text-length and size limits** (names, notes, plate, titles, labels, free-text category and `otherLabel`). | FR-SEC-13 and the "Rules additions" say "the exact length limits are set during rules design". Only 5 attachments, 50 template items and 10 members are fixed. | SEC-01, SEC-02, DAT-02 (zod must mirror), VEH-01 | Schema |
| **DR-07** | **Currency and number formatting.** Which ISO 4217 codes are selectable (the list includes codes with no minor unit); symbol or code, symbol position, digit grouping (Indian or international) and decimal separator; what `mpg` means (US or UK gallons) and whether efficiency, distance and volume settings must agree; decimals shown for converted values. | FR-SET-03 says the Currency setting sets "how amounts are formatted" without defining the format. FR-I18N-01 sets India defaults without a grouping rule. | DAT-01, SET-02 | Story |
| **DR-08** | **What Foundation displays for AC-F5.** Which Foundation screens show currency, volume or efficiency values (no entries exist). When a vehicle's odometer unit differs from the Distance unit setting, which unit is shown for its odometer? | PRD §25.1 verifies AC-F5 on "the screens that exist in Foundation" and does not list them. FR-SET-04 gives a per-vehicle override; OQ-11 says display converts km and mi. | SET-02 (acceptance), VEH-01, VEH-03, VER-02 | Story |
| **DR-09** | **Device-local UI flags.** *Welcome screen:* shown once per install, per uid, or until a vehicle exists; on relaunch before a vehicle exists; after sign-out and a new anonymous session. *Link prompt:* where "dismissed" is stored; whether it fires only when the count becomes 5 or whenever it is 5 or more and not dismissed; effect of deletes. | FR-AUTH-04 says "show one welcome screen" without its persistence. FR-LINK-08 says a dismissed prompt does not reappear and not where that is kept. FR-OUT-05 lists what sign-out clears and does not include these flags. | SHL-01, AUTH-04, AUTH-08 | Story |
| **DR-10** | **Conflict-prompt gaps.** What is shown when the phone has nothing to move (0 vehicles, 0 entries); singular and plural wording; whether Discard on "Finish moving your data" asks for confirmation and what it says. | The prompt text is given with example counts only (SRS L226). FR-MERGE-10 lets the user discard without describing it. | AUTH-05, AUTH-07 | Story |
| **DR-11** | **Waiting for server confirmation.** On Android a queued write does not fail offline, it waits. When is a merge write treated as failed (time-out, connectivity loss), what does the user see, and when is Retry offered? Can **Wait and sync** be cancelled or time out while offline? | FR-MERGE-05 says "if the write fails partway" and FR-OUT-04 says "Wait and sync"; FR-DATA-07 notes native write promises resolve only on server confirmation. No failure-detection rule is given. This touches the merge story directly. | AUTH-06, AUTH-07, AUTH-08 | Story |
| **DR-12** | **Owner writes to `ownerId`, `memberIds`, `members` in Foundation rules.** May an owner change `ownerId` to another existing member, or add or remove uids directly? What concrete write does the "ownership transfer is denied" test attempt? | The matrix allows owner updates (SRS L188). OQ-34 says "`ownerId` changes only to an existing member". FR-SEC-09 says ownership transfer is default-deny and tested as denied. These do not state one rule for the owner in Foundation. | SEC-01, SEC-03 | Schema |
| **DR-13** | **Archived vehicles.** "Read-only until unarchived": may an archived vehicle be edited or deleted, or only unarchived? Do rules enforce anything or is it app-level? | FR-VEH-15 states the rule without scope. | VEH-02, VEH-03, VEH-04, SEC-01 | Story |
| **DR-14** | **Delete details.** Does an interrupted delete resume automatically on launch or only when the user retries? How does a partly deleted vehicle look? How is the typed name matched (exact, case, spaces)? | FR-VEH-14 says "retried or resumed" and FR-VEH-07 says "typing the vehicle name". | VEH-04, DAT-06 | Story |
| **DR-15** | **Selected vehicle.** How is "most recently used" defined and stored (the schema has no field)? What is selected when nothing is stored (first vehicle, after a merge or switch, new device, web)? Where is the selection kept on web? | FR-VEH-13 says "most recently used"; OQ-39 says the selection is stored per uid. | SHL-04, VEH-01, VEH-03, VEH-04, AUTH-05, AUTH-06 | Story |
| **DR-16** | **Copy and behavior text not stated.** Switch-without-moving warning; pending-writes dialog; Sync issues notice; delete confirmation; sign-in error message; web offline banner; wording for non-entry lists of the "couldn't be shown" message; what "Owner: report as a bug" means to the user; where the anonymous "your data is lost on uninstall" warning appears (the SRS says the app "says so plainly"). | The failure table gives some messages verbatim and leaves others as "message", "banner" or "report as a bug". | AUTH-01, AUTH-05, AUTH-08, OBS-02, OBS-03, OBS-04, VEH-04 | Copy |
| **DR-17** | **Shell content.** What Dashboard, History and Reports show when a vehicle exists; whether the Add button appears with no vehicle; what About & privacy and Account show beyond Link Google and sign-out. | FR-NAV-04, FR-NAV-05 and PRD §17.4 specify the Add sheet, More and "Coming soon" for unbuilt items, not these tab bodies. | SHL-02, AUTH-03 | Story |
| **DR-18** | **Web offline details.** The write time-out value and what happens when it fires; how a blocked sign-in popup is detected for the redirect fallback. | OQ-27 says "browser's online and offline events plus a write timeout" and a redirect fallback, without values. | DAT-04, OBS-02, AUTH-02 | Story |
| **DR-19** | **Sync issues semantics.** Does Retry resubmit the original change? Does Discard revert to the server state? Does the list survive an app restart? | FR-OFF-13 names Retry and Discard without defining them. | OBS-04 | Story |
| **DR-20** | **G2 pass threshold.** What share of 50,000 reads and 20,000 writes per day is acceptable? | PRD §24.6 says "within an agreed share"; no share is recorded. | VER-01 (and so the acceptance of DAT-05 to DAT-07) | Story |
| **DR-21** | **Getting rules to the project.** OQ-38 says rules and indexes deploy on tagged releases, with one production project and no staging. How do rules and indexes reach the project before the first tag, so development builds and the G3 production confirmation can run? | OQ-38 describes release deployment only. | PLT-02, SEC-03, all device testing against Firebase | Story |
| **DR-22** | **Firestore database location and mode.** | Permanent once created; the SRS records the project id only. Needed only if the database does not exist yet. | PLT-02 | Story |
| **DR-23** | **Operations exposed by `reminderRepo`, `templateRepo`, `inviteRepo` in Foundation.** | FR-DATA-02 names the repositories and the operations are specified only for `entryRepo` (FR-DATA-11). | DAT-07 (those three repositories) | Story |

**Can start before any decision is answered:** PLT-01, PLT-03, DAT-03, SHL-03, SET-01, OBS-01, OBS-05, and the non-flagged parts of every other story.

---

# F. Foundation Definition of Done

Foundation is done when all of the following are true.

**Source criteria (PRD §25.1, verbatim; AC-F6 as amended by OQ-04)**
- [ ] **AC-F1** A fresh Android install reaches "Add your first vehicle" after one welcome screen, with no sign-in screen.
- [ ] **AC-F2** Vehicles can be added, edited, archived and deleted, including offline on Android.
- [ ] **AC-F3** Anonymous users can link Google, including the conflict case where that account already has data.
- [ ] **AC-F4** Web users sign in with Google and see the same vehicles.
- [ ] **AC-F5** Settings for currency, units, efficiency format, date format, theme and language persist and drive all display.
- [ ] **AC-F6** Security rules for the data model (members, entries, reminders and checklist templates) pass the emulator test suite, and invites, self-join, leave and ownership transfer are denied by default and tested as denied.
- [ ] **AC-F7** Crashlytics reports crashes and non-fatal errors without personal data.

**Derived criteria**
- [ ] AC-D1 to AC-D25 each satisfied, except that AC-D25 is satisfied to the extent the switcher entry and scope state exist (Reports content is tab 4). Section G shows which story covers each.

**Engineering evidence**
- [ ] All 39 stories accepted against their own criteria.
- [ ] CI is green: lint, typecheck, unit, repository and rules tests on every push; every rules-matrix row has an allowed and a denied test (TS-01, AC-D18).
- [ ] Gate G2 passed (DR-20 answered). Gate G3: emulator proof kept as a permanent test and the production confirmation recorded (or the owner explicitly accepts it as pending). Gate G5 run. Gate G7 fixtures are tests. G1 and G4 are done.
- [ ] Maestro flows pass: first launch → add vehicle → change settings; airplane-mode vehicle add, edit, archive, delete (TS-06).
- [ ] The manual checklist is executed and recorded: link Google with a test account, account-conflict merge, merge resume, web smoke test, dark mode, font scaling, test crash and test non-fatal in Crashlytics (TS-07, PRD §25.1 mapping).

**Privacy and build**
- [ ] The release manifest has no `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or location permission; no ad or analytics SDK is present (AC-D19, AC-D20).
- [ ] Crashlytics events contain no amounts, plates, names or notes; no uid is the Crashlytics user id (AC-D13, PRV-13).

**Scope and quality**
- [ ] No out-of-scope feature exists: no entry forms, reminders, reports, Drive, receipts, sharing, checklists, account deletion or release work.
- [ ] All user-visible text goes through i18n and English is the only bundle (FR-I18N-03, FR-I18N-04).
- [ ] Icon-only buttons have labels, tap targets are at least 48 dp, dark mode and font scaling work (AC-D17).
- [ ] Every `[DECISION REQUIRED]` item in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Acceptance criterion.**
The SRS has no requirement IDs, so the SRS column gives the section and line range in `docs/requirements.md`, with the `OQ-` decision where one applies. "AC" lists PRD §25.1 and §25.2 criteria; "gate" marks PRD §24.6 gates; "—" means the story is an enabler with no AC of its own.

| Story | PRD requirement | SRS requirement | AC |
| --- | --- | --- | --- |
| FND-PLT-01 | FR-SCAF-01/02/03/07, NFR-03/14/15/17, PRV-01/02, PR-01, RK-07/08 | Platform decisions L19–33; Architecture L70–123; Libraries L104–121 | AC-D19, AC-D20 |
| FND-PLT-02 | FR-SCAF-04, FR-LINK-06/07, FR-AUTH-02, OQ-03/38 | Accounts L27; OAuth setup L224; OQ-03 L630; OQ-38 L659 | enabler (G1 done) |
| FND-PLT-03 | FR-SCAF-06, TS-01/04, NFR-16, §22.1–22.2 | CI L322; Testing L309–322; OQ-38 L659 | AC-D18, AC-D19, AC-D20 |
| FND-DAT-01 | FR-DATA-12/13, FR-SET-03, FR-I18N-01/02, NFR-08, TS-03 | Data model L168–170; Settings L284; OQ-29 L651; OQ-31 L652 | AC-D10 |
| FND-DAT-02 | FR-DATA-03/04/06/13, FR-VEH-12, FR-SEC-11/12/13, NFR-08/09, PR-18, §13, App. E | Data model L125–179; Schemas L713–810; OQ-30/31/32/34/40 L652–661, L665 | AC-F6 (shape), G7 |
| FND-DAT-03 | FR-DATA-01/07/08, FR-OFF-01/02/03/04/08, NFR-05/14, PR-03 | Adapter L96; Offline writes L102; L121–123; Sign-out L245; OQ-37 L658 | AC-F2, AC-D3 |
| FND-DAT-04 | FR-DATA-01, FR-WEB-01/04, FR-OFF-06/14, NFR-14, PR-07 | Adapter L96; Accounts L27; Error handling L292–294; OQ-27 L650 | AC-F4 |
| FND-DAT-05 | FR-DATA-01/03/05/06/07/08/09/10, FR-OFF-02/03/04/12, FR-ERR-03, NFR-20, TS-04 | Repositories L98; State L100; Offline writes L102; L305; OQ-18 L642 | AC-D12; gate G2 |
| FND-DAT-06 | FR-DATA-02/03/07, FR-VEH-04/05/06/07/09/10/11/12/14/15, FR-AUTH-03, FR-SET-01/06, TS-04 | Vehicles L262–268; Data model L127–173; OQ-09 L636; OQ-17 L641; OQ-39 L660 | AC-F2, AC-D7, AC-D8, AC-D9 |
| FND-DAT-07 | FR-DATA-02/03/05/06/11, FR-SEC-05/09, TS-04 | Data model L171–173; Rules L202; OQ-17 L641 | AC-D12 |
| FND-DAT-08 | FR-SER-01/02/03/04, FR-MERGE-02/04/06/08, TS-03 | Code layout L88–89; Conflict L226–233; L240; OQ-22 L645; OQ-35 L656 | AC-F3 (supports), AC-D6 (supports) |
| FND-SEC-01 | FR-SEC-01/02/03/04/07/08/10/12/13, FR-VEH-11, NFR-02/10, TS-01 | Security rules L181–204; OQ-34 L655; Rules additions L803–810 | AC-F6, AC-D18 |
| FND-SEC-02 | FR-SEC-02/03/05/06/09/10/11/12/13, NFR-18, TS-01 | Security rules L185–191, L195, L200, L204; OQ-04/22/31/33/35 L631, L645, L652, L654, L656 | AC-F6, AC-D18, AC-D21 |
| FND-SEC-03 | FR-SEC-08/09, TS-01/02, §15.9 items 1–2, RK-26/29 | Security rules L193–198; OQ-04 L631; OQ-22 L645; OQ-35 L656; OQ-37 L658; L810 | AC-F6, AC-D18, AC-D21; gate G3, G4 |
| FND-AUTH-01 | FR-AUTH-01/02/03/05/06, FR-SET-06, PR-04/06, OQ-39 | First launch L210–216; Limitations L825; OQ-39 L660 | AC-F1, AC-D1 |
| FND-AUTH-02 | FR-WEB-01/02/03/04, FR-ERR-06, PR-07, OQ-25/27 | First launch, web L218; OQ-25 L648; OQ-27 L650 | AC-F4 |
| FND-AUTH-03 | FR-LINK-04/05/06/07, FR-OUT-03, FR-ERR-06, PR-06 | Linking L220–224; Error handling L298–300; OQ-37 L658 | AC-F3, AC-D2, AC-D4 |
| FND-AUTH-04 | FR-LINK-01/02/03/08, OQ-05 | Linking L222; Merge details L241; OQ-05 L632 | AC-F3 (supports), AC-D2 |
| FND-AUTH-05 | FR-MERGE-01/07/09, OQ-06/07 | Conflict L226–233; L237–238; OQ-06 L633; OQ-07 L634 | AC-F3, AC-D5 |
| FND-AUTH-06 | FR-MERGE-02/03/04/05/06/08/09, FR-SER-02/03, FR-OFF-09, RK-13/26 | Conflict L226–233; Merge details L235–241; OQ-22 L645; OQ-35 L656; OQ-37 L658 | AC-F3, AC-D6, AC-D21 |
| FND-AUTH-07 | FR-MERGE-10/05, OQ-08/23 | Merge details L239; OQ-08 L635; OQ-23 L646 | AC-D6 |
| FND-AUTH-08 | FR-OUT-01/02/03/04/05, FR-OFF-08, FR-ERR-09, PRV-07, OQ-24 | Sign-out L243–246; Error handling L303; OQ-24 L647 | AC-D2, AC-D3, AC-D23; gate G5 |
| FND-SHL-01 | FR-AUTH-04, PR-04, FR-NAV-08 | First launch L214; Principles L16; OQ-61 L709 | AC-F1, AC-D22 |
| FND-SHL-02 | FR-NAV-01…08, FR-NAV-10, FR-SCAF-01, NFR-12, §17.2, §17.4 | Navigation L254–260; OQ-21 L644 | AC-D14, AC-D15, AC-D16 |
| FND-SHL-03 | NFR-11, PR-20, §17.6, §17.7 | UI kit L109; Accessibility L286; Testing L320 | AC-D17 |
| FND-SHL-04 | FR-NAV-01/02/09, FR-VEH-13/15, TS-05, OQ-39/49 | Navigation L256–257; OQ-09 L636; OQ-39 L660; OQ-49 L681 | AC-D9, AC-D25 |
| FND-VEH-01 | FR-VEH-01/02/03/08/09/10/11/12/16/17, FR-NAV-08, PR-08, TS-05 | Vehicles L262–268; OQ-11 L638; OQ-12 L639 | AC-F1, AC-F2 |
| FND-VEH-02 | FR-VEH-04/09/15/16, PR-08, TS-05 | Vehicles L265; OQ-11 L638; OQ-39 L660 | AC-F2, AC-D7 |
| FND-VEH-03 | FR-VEH-05/06/09/13/15, PR-08 | Vehicles L266; OQ-09 L636; OQ-39 L660 | AC-F2, AC-D9 |
| FND-VEH-04 | FR-VEH-07/09/13/14, PR-08 | Vehicles L267; OQ-09 L636 | AC-F2, AC-D8 |
| FND-SET-01 | FR-I18N-03/04/05, FR-SCAF-07, NFR-13, PR-19 | Localization L32; i18n L112; Settings L279 | AC-F5 (language part) |
| FND-SET-02 | FR-SET-01…06, FR-I18N-01/02, PR-09, PR-19, OQ-29 | Settings L270–284; OQ-29 L651 | AC-F5, AC-D10 |
| FND-OBS-01 | FR-ERR-01/02, FR-SCAF-05, NFR-07, OQ-10 | Error handling L290, L301; OQ-10 L637 | AC-F7 |
| FND-OBS-02 | FR-OFF-05/06/07/14, FR-ERR-01/07, NFR-06, RK-15, §19.4 | Error handling L292–295, L307; OQ-27 L650 | (FR-ERR table rows) |
| FND-OBS-03 | FR-ERR-01/03/04, FR-DATA-05 | Error handling L296–297 | AC-D11, AC-D12 |
| FND-OBS-04 | FR-DATA-08, FR-OFF-03/13, FR-ERR-08, OQ-26 | Architecture L102; Error handling L302; OQ-26 L649 | AC-D24; gate G5 |
| FND-OBS-05 | FR-ERR-05, NFR-04, PRV-03/04/13, PR-05, OQ-10/14/36 | Crashlytics rule L305; Principles L17; OQ-10 L637; OQ-14 L640; OQ-36 L657 | AC-F7, AC-D13 |
| FND-VER-01 | NFR-06/19/20, RK-02/25, OQ-18, FR-OFF-12 | OQ-18 L642; Error handling L307; Limitations L831 | gate G2 |
| FND-VER-02 | TS-06, TS-07, §21.5, §25.1 mapping | Testing L309–322; OQ-37 L658 | AC-F1 to AC-F7 (evidence); gate G5 |

**G2. Acceptance criterion → covering stories** (proves no criterion is orphaned).

| Criterion | Stories |
| --- | --- |
| AC-F1 | AUTH-01, SHL-01, VEH-01, VER-02 |
| AC-F2 | DAT-03, DAT-06, VEH-01, VEH-02, VEH-03, VEH-04, VER-02 |
| AC-F3 | AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, DAT-08, VER-02 |
| AC-F4 | DAT-04, AUTH-02, VER-02 |
| AC-F5 | SET-01, SET-02, VER-02 |
| AC-F6 | DAT-02, SEC-01, SEC-02, SEC-03 |
| AC-F7 | OBS-01, OBS-05, VER-02 |
| AC-D1 | AUTH-01 |
| AC-D2 | AUTH-03, AUTH-04, AUTH-08 |
| AC-D3 | DAT-03, AUTH-08 |
| AC-D4 | AUTH-03 |
| AC-D5 | AUTH-05 |
| AC-D6 | AUTH-06, AUTH-07, DAT-08 |
| AC-D7 | DAT-06, VEH-02 |
| AC-D8 | DAT-06, VEH-04 |
| AC-D9 | DAT-06, SHL-04, VEH-03 |
| AC-D10 | DAT-01, SET-02 |
| AC-D11 | OBS-03 |
| AC-D12 | DAT-05, DAT-07, OBS-03 |
| AC-D13 | OBS-05 |
| AC-D14 | SHL-02 |
| AC-D15 | SHL-02 |
| AC-D16 | SHL-02 |
| AC-D17 | SHL-03, SHL-01, SET-02 |
| AC-D18 | SEC-01, SEC-02, SEC-03, PLT-03 |
| AC-D19 | PLT-01, PLT-03 |
| AC-D20 | PLT-01, PLT-03 |
| AC-D21 | SEC-02, SEC-03, AUTH-06 |
| AC-D22 | SHL-01 |
| AC-D23 | AUTH-08 |
| AC-D24 | OBS-04 |
| AC-D25 | SHL-04 |
