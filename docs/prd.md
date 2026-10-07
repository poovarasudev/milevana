# Product Requirements Document: Milevana v1

| | |
| --- | --- |
| **Product** | Milevana: a free, ad-free, privacy-first vehicle expense and maintenance tracker |
| **Release covered** | Milevana v1: a complete public release on Android, with a companion web app |
| **Author** | Poovarasu Sekar |
| **PRD date** | 2026-10-06 |
| **Status** | Draft. Revised after red-team review (Appendix D). All open questions decided and the schemas approved on 2026-10-06 (Appendix E). |
| **Stakeholders** | Not named in the source |
| **Authoritative source** | `docs/requirements.md` ("Milevana v1 — Brief & Foundation Design Spec", Oct 5, 2026, @Poovarasu Sekar; updated 2026-10-06 with the service-entry decision) |

---

## How to read this PRD

**Source fidelity.** This PRD restructures `docs/requirements.md` without adding features, technologies, or business rules. Every requirement traces to the source (Appendix A maps source sections to PRD sections). Terminology is kept as in the source, including "tab N" and "sub-project N", which mean the same thing.

**Depth varies by sub-project, and this follows the source.** The source specifies sub-project 1 (**Foundation**) in full: goals, architecture, data model, security rules, auth flows, navigation, settings, error handling, and testing. For sub-projects 2–8 it gives a scope line each, plus cross-cutting facts scattered through the Foundation text (data model fields, rules, libraries, accepted limitations). Their detailed designs are not in the source, even though the source says v1 is "designed in eight tabs in this document". This PRD records everything the source states about tabs 2–8 (§23) and marks the rest **"Defined in tab N"**. It does not guess. See OQ-01.

**Markers used**

| Marker | Meaning |
| --- | --- |
| **[Source]** | Stated directly in `docs/requirements.md` |
| **[Derived]** | A testable restatement of source text, with no new behavior |
| **Not specified in source** | A gap. It is tracked as an Open Question (§27) and is never silently resolved |
| **[Review]** | Added by the red-team review. It is a concern, gap or gate to confirm, not a source requirement |
| **[External — verify]** | Rests on Firebase, Google or Play behavior that neither document states. Confirm against current documentation or the emulator before relying on it |
| **Defined in tab N** | The source explicitly defers this to sub-project N's design |

**Requirement IDs.** `PR-` product requirement (§7), `FR-` functional requirement (§8 and §14–§19), `NFR-` non-functional (§9), `PRV-` privacy requirement (§20), `TS-` testing requirement (§21), `AC-` acceptance criterion (§25), `OQ-` open question (§27), `DD-` deferred decision (§28), `RK-` risk or constraint (§29), `RT-` red-team review finding (Appendix D).

**Priority.** The source assigns no priorities. Every item in the v1 scope list is committed v1 scope, and every "Not in v1" item is excluded. The P0/P1/P2 split from the standard PRD template is not applied, because it would be invented. Success metrics are likewise not defined in the source (OQ-02).

**Review status.** This revision incorporates a red-team review of the PRD against the source. The review changed no source requirement and resolved no ambiguity. It (a) corrected places where inference was presented as source, (b) added open questions OQ-22 to OQ-40, (c) added feasibility concerns to verify (§15.9), testing and release gaps (§21.5, §22.5), and a pre-implementation gate list (§24.6). Appendix D maps every finding to its PRD change. On 2026-10-06 every open question was then decided (§27), the decisions were folded into the requirements, and field-level schemas were proposed and then approved (Appendix E).

---

## Table of contents

1. Executive Summary
2. Product Vision and Goals
3. Target Users
4. Product Principles
5. v1 Scope
6. Out of Scope
7. Product Requirements
8. Functional Requirements
9. Non-Functional Requirements
10. User Flows
11. Platform and Technology Decisions
12. Architecture
13. Data Model
14. Authentication and Account Lifecycle
15. Authorization and Security
16. Offline and Sync Behavior
17. Navigation and UX Requirements
18. Settings and Localization
19. Error Handling
20. Privacy Requirements
21. Testing Strategy
22. CI/CD and Deployment
23. v1 Sub-Projects
24. Dependencies and Implementation Order
25. Acceptance Criteria
26. Limitations
27. Open Questions
28. Deferred Decisions
29. Risks and Constraints

Appendices: A. Source traceability · B. Glossary · C. Sources cited by the requirements document · D. Red-team review log · E. Schemas

---

## 1. Executive Summary

Milevana is a **free, ad-free, privacy-first vehicle expense and maintenance tracker**, inspired by Drivvo. v1 is a **complete public release on Android, with a companion web app**.

It serves individuals managing their own vehicles, families sharing vehicles, and gig/rideshare drivers who need real profit figures. Fleets and businesses come after v1, but the v1 data model must not block them.

v1 delivers:

- vehicles
- fuel and EV charging
- expenses
- services
- income
- manual trips
- inspection checklists
- receipt photos in the user's own Google Drive
- reminders
- reports
- shared vehicles
- CSV export
- Google Drive backup and restore
- release essentials

The product runs on **Firebase's free Spark plan with no custom API server and no Cloud Functions**. It uses a single **Expo (React Native)** codebase for Android and web. The only fixed cost is Google Play's one-time US$25 registration; everything else uses free tiers or the existing portfolio domain.

v1 is built as **eight sub-projects in dependency order**: Foundation, Logging, Reminders, Reports and dashboard, Drive and export, Sharing, Checklists, Release. A usable personal app exists after sub-project 2. The Play closed test (12+ testers for 14 days) starts then, so Google's gate runs in parallel with sub-projects 3–7.

The first sub-project, **Foundation**, delivers an installable Android app and a web app where a user can start anonymously, link Google, and manage vehicles and settings. Every later tab builds on it without data migrations.

---

## 2. Product Vision and Goals

### 2.1 Vision

A vehicle expense and maintenance tracker that is free, has no ads, respects privacy, and never holds a user's data hostage. Users can log from anywhere, including offline, and start with no friction.

### 2.2 Product goals [Source]

| # | Goal |
| --- | --- |
| G1 | Ship a complete public v1 release on Android, with a companion web app. |
| G2 | Keep the free app free of ads and of any ad SDK or location permission, permanently. |
| G3 | Keep user data portable and never paywalled. Backup, sync, restore and export stay free forever. |
| G4 | Make every write work offline on Android and sync later. |
| G5 | Let an Android user start with no sign-in screen: after one welcome screen the app goes straight to adding a vehicle. |
| G6 | Keep telemetry minimal: anonymous crash reports only, and analytics skipped or opt-in. |
| G7 | Operate at near-zero cost: the Spark plan, the user's own Google Drive for files, and an existing domain. |
| G8 | Give gig and rideshare drivers real profit figures (reports, sub-project 4). |
| G9 | Design the data model so fleets and businesses can be added after v1 without migrations. |
| G10 | Meet Google Play's closed-testing gate in parallel with development (12+ testers, 14 days). |

### 2.3 Foundation goal [Source]

Foundation delivers an installable Android app and a web app where a user can start anonymously, link Google, and manage vehicles and settings, so that every later tab builds on it without data migrations.

### 2.4 Non-goals

See §6. The principal non-goals are GPS route tracking, importing from other apps, fleet/business management, and iOS.

### 2.5 Success metrics

The source defines **no quantitative success metrics** (no adoption, retention, or engagement targets). The only measurable completion criteria are the Foundation "Done when" checklist (§25.1) and the release gates in §25.3. The source's only production monitoring signal is that any `resource-exhausted` non-fatal in production triggers a review of moving to the Blaze plan (§19.4). See OQ-02.

---

## 3. Target Users

### 3.1 Primary audiences [Source]

| Segment | Description | Need called out in source |
| --- | --- | --- |
| Individuals | People managing their own vehicles | Track fuel/charging, expenses, services, reminders |
| Families | Families sharing vehicles | Vehicles shared by invite with owner and member roles (sub-project 6) |
| Gig / rideshare drivers | Drivers earning income from vehicles | Real profit figures, so income entries and profit metrics (sub-projects 2 and 4) |

### 3.2 Later audiences (after v1) [Source]

Fleets and businesses. The data model must not block them. v1 includes no fleet or business management.

### 3.3 User states the product must support [Source]

| State | Platform | Description |
| --- | --- | --- |
| Anonymous user | Android only | Starts with no sign-in. The Firebase anonymous uid owns the data. Has no sign-out option. |
| Linked user | Android | An anonymous user who linked a Google account. The uid is unchanged. `isLinked: true`. |
| Google-signed-in user | Web | Signs in with Google only. A new Google account gets a `users/{uid}` document on first sign-in. |
| Vehicle owner | Both | `ownerId` of a vehicle. Full control of that vehicle. |
| Vehicle member | Both | A member in `members` with role `member` (sharing, sub-project 6). Limited write rights (§15). |

### 3.4 Current workaround, user pain, and segment sizing

Not specified in source. The source names Drivvo as inspiration and as a cited reference ([Drivvo on Google Play](https://play.google.com/store/apps/details?id=br.com.ctncardoso.ctncar)) but includes no research findings or segment sizes.

---

## 4. Product Principles

These are explicit principles from the source. Each is binding on every sub-project.

| # | Principle | What it means [Source] | Where enforced |
| --- | --- | --- | --- |
| P1 | **No ads, ever, in the free app.** | No ad SDK and no location permission. | §20, NFR-03, RK-08 |
| P2 | **Your data is never paywalled.** | Backup, sync, restore and export stay free forever. A future paid tier may only add features with real running or build cost, such as fleets or advanced reports. | §28 (DD-02) |
| P3 | **Log anywhere.** | On Android, every write works offline and syncs later. | §16 |
| P4 | **No friction to start.** | On Android there is no sign-in screen: after one welcome screen the app goes straight to adding a vehicle. | §14.2 |
| P5 | **Minimal telemetry.** | Crashlytics for anonymous crash reports, with no amounts, plates, names or notes. Analytics is skipped or opt-in. | §19.3, §20 |

Product-level design stances stated in the source (rationale, not extra principles):

- **The backend is Firestore security rules only.** There is no server code, so rules are "the entire backend" and "the last line of defence".
- **Changing a default converts what is shown, never what is stored.**
- **The Firestore cache is the source of truth** for UI state.
- **Being offline on Android is a normal state, not an error.**
- **No failure takes down more than one screen.**
- **YAGNI.** The source lists what is deliberately left out (§6.5).

---

## 5. v1 Scope

### 5.1 v1 product scope [Source]

**Platform:** Android (primary) with a companion web app (secondary), from one Expo codebase.

**v1 features:**

- Vehicles
- Fuel and EV charging
- Expenses
- Services
- Income
- Manual trips
- Inspection checklists
- Receipt photos in the user's Drive
- Reminders
- Reports
- Shared vehicles
- CSV export
- Google Drive backup and restore
- Release essentials

### 5.2 The eight sub-projects [Source]

Built in dependency order (§24). Full detail is in §23.

| # | Sub-project | Scope (as stated in source) |
| --- | --- | --- |
| 1 | **Foundation** | Expo setup, Firebase auth and linking, the dual-SDK data layer, the full data model and security rules, settings, i18n scaffolding, vehicle management, the navigation shell, Crashlytics, and the shared serializer. |
| 2 | **Logging** | Fuel and EV charging with mileage, expenses, services with line items, income, manual trips, and the History list. |
| 3 | **Reminders** | Date and odometer reminders, auto-complete from matching entries, km-per-day prediction, local notifications, and per-vehicle mute. |
| 4 | **Reports and dashboard** | Per-vehicle and All vehicles reports, financial-year ranges, cost and profit metrics, and charts. |
| 5 | **Drive and export** | Drive backup and restore, receipt photos and PDFs with an offline upload queue, and CSV export. |
| 6 | **Sharing** | Invite codes and links, owner and member roles, leave, remove and ownership transfer, and receipt sharing on Drive. |
| 7 | **Checklists** | Per-vehicle templates with starters, inspection runs, and copy between vehicles. |
| 8 | **Release** | Play closed testing and production access, account deletion, privacy policy and terms, Play listing, the Google consent screen, and web deployment at `milevana.poovarasu.dev`. |

### 5.3 Foundation scope detail [Source]

**In scope (sub-project 1):**

- Project setup
- Both Firebase adapters (native and web)
- Repositories with validation
- The complete Firestore schema and rules
- The auth and linking flows
- The Android welcome screen
- The navigation shell with placeholder entry screens
- Vehicle management
- Settings
- i18n scaffolding
- Error boundaries
- Crashlytics
- CI
- The shared export/import serializer used by account merge

**Out of scope for Foundation:** entry forms (tab 2), reminders (tab 3), reports (tab 4), the Drive scope request (tab 5), invite flows (tab 6), checklists (tab 7), and account deletion (tab 8).

### 5.4 Platform capability matrix [Source]

| Capability | Android | Web |
| --- | --- | --- |
| Sign-in | Anonymous first, link Google later | Google sign-in only (JS SDK popup flow) |
| Firestore SDK | `@react-native-firebase` with durable offline cache | Firebase JS SDK, online-only |
| Offline writes | Yes, sync later | No. Saving is disabled offline |
| Local notifications | Yes (sub-project 3) | None |
| Reminders | Local notifications scheduled on each device (sub-project 3) | Shown and edited; no notifications sent |
| Navigation layout | Four tabs | Same routes. At ≥768 px a left rail with dialog forms |
| Drive tokens | `@react-native-google-signin/google-signin` | Google Identity Services |

---

## 6. Out of Scope

### 6.1 Not in v1 [Source]

- GPS route tracking
- GPS location for fuel stations
- Importing from other apps
- Fleet and business management
- A local-only mode
- Email/password sign-in
- Vehicle photos
- Payment-method tracking
- Recurring auto-entries
- PDF or image export of reports
- Scheduled inspections
- Checklist-specific reports
- Number or text checklist item types
- iOS
- Over-the-air code updates

### 6.2 Out of scope for Foundation specifically [Source]

Entry forms (tab 2), reminders (tab 3), reports (tab 4), the Drive scope request (tab 5), invite flows (tab 6), checklists (tab 7), and account deletion (tab 8).

### 6.3 Not in Foundation's sign-in work [Source]

- Account deletion (tab 8, designed with sharing)
- Email/password sign-in ("later, if users ask")

### 6.4 Rejected alternatives [Source]

The source's "Rejected alternatives" list contains exactly these two:

| Alternative | Reason rejected [Source] |
| --- | --- |
| NativeWind | Every component built by hand, slower to a polished v1 |
| One shared JS SDK on all platforms | No durable offline storage on Android |

### 6.4.1 Related decisions that exclude options [Source; not in the source's "Rejected alternatives" list]

| Excluded option | What the source says |
| --- | --- |
| Firebase Storage for files | "Firebase Storage needs the paid Blaze plan"; the user's own Google Drive is used instead |
| Custom API server and Cloud Functions | "No custom API server and no Cloud Functions." The source gives no separate reason |
| Redux and a query-caching library | "There is no Redux and no query-caching library." The source gives no separate reason |

### 6.5 Left out under YAGNI [Source]

- Soft delete and edit history
- A custom-category collection (a fixed list plus free-text "Other" is used instead)
- Server-computed totals
- Vehicle photos

### 6.6 Constraints on out-of-scope items

- Fleets and businesses are "after v1", but the data model must not block them (G9).
- Any future paid tier may only add features with real running or build cost, such as fleets or advanced reports (P2 / DD-02).

---

## 7. Product Requirements

Product-level requirements, each traced to the source. Detailed functional behavior is in §8 and §14–§19.

| ID | Requirement | Sub-project | Source basis |
| --- | --- | --- | --- |
| PR-01 | The app is free and ad-free, with no ad SDK and no location permission. | All | Principle P1 |
| PR-02 | Backup, sync, restore and export are free forever. | 1, 5 | Principle P2 |
| PR-03 | Every write on Android works offline and syncs later. | All | Principle P3 |
| PR-04 | On Android, a fresh install shows one welcome screen and then opens "Add your first vehicle", with no sign-in screen. | 1 | Principle P4; Foundation done-when |
| PR-05 | Telemetry is limited to Crashlytics (anonymous). Analytics is skipped or opt-in. | 1 | Principle P5 |
| PR-06 | The app can be used anonymously on Android. A user can later link a Google account without data moving. | 1 | Sign-in flows |
| PR-07 | Web users sign in with Google only and see the same vehicles as on Android. | 1 | Foundation done-when |
| PR-08 | Users can add, edit, archive and delete vehicles, including offline on Android. | 1 | Foundation done-when |
| PR-09 | Users can configure currency, units, efficiency format, date format, theme and language. Settings persist and drive all display. | 1 | Foundation done-when |
| PR-10 | Users can log fuel and EV charging (with mileage), expenses, services (with line items), income, and manual trips, and review them in a History list. | 2 | v1 scope |
| PR-11 | Users can create date and odometer reminders that auto-complete from matching entries, with km-per-day prediction, local notifications, and per-vehicle mute. | 3 | v1 scope |
| PR-12 | Users can see per-vehicle and All vehicles reports with financial-year ranges, cost and profit metrics, and charts. | 4 | v1 scope |
| PR-13 | Users can back up to and restore from their own Google Drive (manual, plus automatic when stale) and export CSV. | 5 | v1 scope |
| PR-14 | Users can attach receipt photos and PDFs to entries, stored in the user's own Drive, with an offline upload queue. | 5 | v1 scope |
| PR-15 | Users can share a vehicle by invite code or link with owner and member roles, and can leave, remove members, and transfer ownership. Receipts are shared via Drive permissions. | 6 | v1 scope |
| PR-16 | Users can keep per-vehicle inspection checklist templates (with starters), perform inspection runs, and copy templates between vehicles. | 7 | v1 scope |
| PR-17 | The app is released publicly: Play closed testing and production access, account deletion, privacy policy and terms, Play listing, Google consent screen, and web deployment at `milevana.poovarasu.dev`. | 8 | v1 scope |
| PR-18 | The data model supports every v1 feature without later migrations. | 1 | Foundation goal |
| PR-19 | India defaults (INR, km, litres) apply. Currency and units are configurable per user and per vehicle. All text goes through i18n, English only in v1. | 1 | Platform decisions |
| PR-20 | The app meets the accessibility baseline in §17.6. | 1 | Accessibility |

---

## 8. Functional Requirements

### 8.1 Index

Foundation functional requirements live in the section matching their subject. Features that need the full capability template (purpose, behavior, rules, edge cases, dependencies, acceptance, constraints) have it there.

| Area | IDs | Location |
| --- | --- | --- |
| Authentication, linking, merge, sign-out | FR-AUTH, FR-LINK, FR-MERGE, FR-WEB, FR-OUT | §14 |
| Vehicle management | FR-VEH | §8.2 |
| Repositories, validation, state | FR-DATA | §8.3 |
| Shared serializer | FR-SER | §8.4 |
| Project scaffolding and CI | FR-SCAF | §8.5 |
| Security rules | FR-SEC | §15 |
| Offline and sync | FR-OFF | §16 |
| Navigation shell | FR-NAV | §17 |
| Settings, i18n | FR-SET, FR-I18N | §18 |
| Error handling, Crashlytics | FR-ERR | §19 |
| Sub-projects 2–8 | (scope-level only) | §23 |

### 8.2 Vehicle management (FR-VEH) — Foundation

**Purpose.** Let a user manage the vehicles that scope the whole app. Every tab is scoped to the selected vehicle.

**User behavior.** From the empty state, "Add your first vehicle" starts the first-time flow. From **More → Vehicles** the user can add, edit, archive/unarchive and delete vehicles. A vehicle is selected via the top-bar switcher, and the selection persists across launches.

**Functional requirements**

| ID | Requirement |
| --- | --- |
| FR-VEH-01 | **Add.** Required fields: name, type (`car`, `bike`, `scooter`, `truck`, `bus`, `other`), fuel types (any combination), odometer unit, and current odometer. |
| FR-VEH-02 | **Add, optional fields:** make, model, year, plate. |
| FR-VEH-03 | A **colour** is picked from a fixed palette. |
| FR-VEH-04 | **Edit.** All fields are editable, except that **odometer unit and currency lock once the vehicle has entries**. |
| FR-VEH-05 | **Archive** hides the vehicle from the switcher and keeps its entries for history and lifetime reports. |
| FR-VEH-06 | An archived vehicle can be **unarchived** from More → Vehicles. |
| FR-VEH-07 | **Delete** is confirmed by **typing the vehicle name**. It deletes entries, reminders and checklist templates **in batches of 500**, then the vehicle. |
| FR-VEH-08 | **Empty state.** First-time users see "Add your first vehicle" instead of an empty dashboard. |
| FR-VEH-09 | Add, edit, archive and delete all work **offline on Android**. |
| FR-VEH-10 | New vehicles take their defaults from user settings (currency, units). Per-vehicle overrides cover **odometer unit and currency**. |
| FR-VEH-11 | On creation, the vehicle document has the signed-in user as `ownerId` and as the only entry in `memberIds`/`members`. This is enforced by the security rules (§15). |
| FR-VEH-12 | Vehicle documents carry the fields in §13.2, including `lastOdometer`, `lastOdometerAt`, `archived`, `createdAt`, `updatedAt` and `schemaVersion`. |
| FR-VEH-13 | After the selected vehicle is archived or deleted, the app selects the most recently used vehicle. If every vehicle is archived, an empty state offers Unarchive and Add (OQ-09). |
| FR-VEH-14 | A failed delete is retried or resumed, because the vehicle is removed last. Deleting a shared vehicle warns with the member count (OQ-09). |
| FR-VEH-15 | Archived vehicles are read-only until unarchived (OQ-39). The selected vehicle is stored per uid. |
| FR-VEH-16 | `hours` is selectable as the odometer unit for any vehicle type. Distance-based metrics are hidden for `hours` vehicles. Units stay locked once the vehicle has entries (OQ-11). |
| FR-VEH-17 | Vehicle types are car, bike, scooter, truck, bus, other. Fuel types are petrol, diesel, CNG, LPG, electric. The colour is one of 12 fixed colours (OQ-12). |

**Business rules**

- The odometer is stored in the vehicle's own unit (`odometerUnit`: `km`, `mi` or `hours`). Conversion happens only at display time.
- Vehicle `currency` and `odometerUnit` are immutable once any entry exists.
- Only the owner can update a vehicle (except the `lastOdometer` exception and the sub-project 6 self-join/leave paths) or delete it.
- Archive keeps the data. Delete removes it.

**Edge cases**

| Case | Behavior |
| --- | --- |
| Vehicle has entries | Odometer unit and currency fields are locked in the edit form (component-tested: "locked units"). |
| Vehicle delete is large | Deletion proceeds in batches of 500, children first, then the vehicle. |
| Delete confirmation | The name must be typed to proceed. |
| Offline on Android | Writes apply locally and return immediately. Items with pending writes show the sync icon. |
| Offline on web | Saving is disabled and a banner is shown. |
| A member loses access (e.g. removed) | "You no longer have access to this vehicle", then switch vehicle (§19). |
| Vehicle partially deleted, archived-only state, deleting the selected vehicle, or deleting a shared vehicle | Decided: see FR-VEH-13 to FR-VEH-15 (OQ-09, OQ-39) |

**Dependencies.** The data model and rules (§13, §15), repositories (§8.3), settings (§18), navigation shell (§17).

**Acceptance criteria**

- AC-F2: Vehicles can be added, edited, archived and deleted, including offline on Android.
- Component tests cover vehicle-form validation, locked units, and the vehicle switcher (§21).

**Technical constraints**

- Writes go through `vehicleRepo`, validated by zod schemas that also back the form.
- Delete uses batches of 500.
- Vehicle subtree is protected by one membership check (§15).

### 8.3 Repositories, validation and state (FR-DATA) — Foundation

**Purpose.** Isolate all Firestore access so malformed or outdated data fails in exactly one place.

| ID | Requirement |
| --- | --- |
| FR-DATA-01 | Only repositories touch Firestore. Only the platform adapter knows which SDK runs. |
| FR-DATA-02 | Repositories exist for `vehicleRepo`, `entryRepo`, `reminderRepo`, `templateRepo`, `inviteRepo`, `userRepo`. |
| FR-DATA-03 | Repositories convert Firestore documents into domain types and **validate every read with zod**. |
| FR-DATA-04 | The same zod schemas back the forms (react-hook-form + zod). |
| FR-DATA-05 | A malformed or outdated document fails in the repository, never inside a screen. A failed item is skipped and surfaced as in §19. |
| FR-DATA-06 | Repositories **upgrade older shapes on read**, using `schemaVersion` on top-level documents and entries. |
| FR-DATA-07 | On Android, repositories **apply writes locally and return immediately**, because a Firestore write promise resolves only after server confirmation and would hang offline. |
| FR-DATA-08 | Items with pending writes show a **sync icon**, driven by Firestore's `hasPendingWrites` metadata. |
| FR-DATA-09 | **The Firestore cache is the source of truth.** Screens subscribe through small hooks such as `useVehicles()` and `useEntries(vehicleId)`. |
| FR-DATA-10 | There is **no Redux and no query-caching library**. A small **Zustand** store holds only UI-only state, such as the selected vehicle. |
| FR-DATA-11 | `lastOdometer` is denormalized on the vehicle. It is written in the **same batch as the entry**, taking the **maximum**. |
| FR-DATA-12 | Domain logic (`units.ts`, `money.ts`, and later `fuel.ts`, `reminders.ts`, `reports.ts`) is pure TypeScript with no React and no Firebase. |
| FR-DATA-13 | Money is stored as integer minor units with a currency code. `{ minor: 245000, currency: "INR" }` is ₹2,450.00. |

**Business rules.** Rules also validate on write (§15.3); client validation is not the only defence.

**Edge cases.** An outdated shape is upgraded on read. A malformed document is skipped, with "1 entry couldn't be shown" and a non-fatal log with the document path. `lastOdometer` recomputation when an entry is edited or deleted is not specified (OQ-17). Decided (OQ-17): `lastOdometer` is the maximum odometer across the vehicle's entries and its starting odometer, recomputed by the client on edit or delete. A batch cannot read, so concurrent offline writes can briefly lower it; it corrects itself on the next entry or refresh.

**Dependencies.** Platform adapter (§12), data model (§13).

**Acceptance criteria.** Repository tests (Jest + Firestore emulator, JS SDK) cover reads, writes, validation and schema upgrades.

**Technical constraints.** The native adapter is `@react-native-firebase`. The web adapter is the Firebase JS SDK. Both expose the same narrow interface.

### 8.4 Shared serializer (FR-SER) — Foundation

**Purpose.** One export/import format used by **account merge** (Foundation), **Drive backup and restore** (tab 5).

| ID | Requirement |
| --- | --- |
| FR-SER-01 | A shared export/import serializer lives in `src/data/serializer/`. |
| FR-SER-02 | For account merge it serializes every vehicle the anonymous user owns, plus all entries, reminders and checklist templates. |
| FR-SER-03 | Import writes copies under new ids owned by the Google uid, using **deterministic ids derived from source ids** so retries do not duplicate. |
| FR-SER-04 | Round-trips are tested (§21). |

The backup format and restore behavior are defined in tab 5.

### 8.5 Project scaffolding and CI (FR-SCAF) — Foundation

| ID | Requirement |
| --- | --- |
| FR-SCAF-01 | One Expo codebase with Expo Router serves Android and web with the same routes. |
| FR-SCAF-02 | Native modules require **Expo development builds**, not Expo Go. |
| FR-SCAF-03 | The Android build config **strips `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE`** if any library adds them, so Play's photo-permission declaration is never needed. |
| FR-SCAF-04 | The Google Cloud **OAuth client is configured once in Foundation**, so tab 5 can request `drive.file` incrementally. |
| FR-SCAF-05 | Per-screen error boundaries and Crashlytics are in place (§19). |
| FR-SCAF-06 | CI (GitHub Actions) runs lint, typecheck, unit, repository and rules tests on every push (§22). |
| FR-SCAF-07 | i18n scaffolding (i18next + expo-localization): all text goes through i18n (§18.4). |

---

## 9. Non-Functional Requirements

| ID | Category | Requirement | Source |
| --- | --- | --- | --- |
| NFR-01 | Cost | Everything runs on Firebase's free Spark plan. The only paid item is Google Play's one-time US$25 registration. Everything else uses free tiers or the existing portfolio domain. | Platform decisions |
| NFR-02 | Backend | No custom API server and no Cloud Functions. Security rules are the entire backend. | Platform decisions; Security rules |
| NFR-03 | Privacy | No ad SDK, no location permission, no broad media permission. | Principles; Libraries |
| NFR-04 | Telemetry | Crashlytics reports carry document ids, error codes and app state only, never amounts, plates, names or notes. | Error handling |
| NFR-05 | Offline | Android is fully offline-capable after the first launch. Writes persist locally and sync later. | Principles; Sign-in |
| NFR-06 | Quota | Must operate within the Spark plan's 50,000 Firestore reads and 20,000 writes per day. Beyond that, requests fail until the daily reset, and the app degrades gracefully (§19). The project stays on the free plan with no Blaze fallback, and is budgeted for roughly 100 to 500 daily active users (OQ-18). | Limitations; decision 2026-10-06 |
| NFR-07 | Reliability | No failure takes down more than one screen. Each failure type has one defined behavior. | Error handling |
| NFR-08 | Data integrity | Money uses integer minor units. The odometer is stored in the vehicle's unit. No stored rounding. | Data model |
| NFR-09 | Evolvability | `schemaVersion` on top-level docs and entries. Older shapes upgrade on read. The data model must support all eight sub-projects without migrations, and must not block fleets/businesses. The source states both "without data migrations" and "repositories upgrade older shapes on read"; decided: "without data migrations" means no bulk or server migrations; older shapes upgrade lazily on read (OQ-40). | Data model; Brief |
| NFR-10 | Security | Every path is denied by default. Rules validate required fields, types, entry `type`, integer `amount.minor`, and timestamps vs `request.time`. | Security rules |
| NFR-11 | Accessibility | Paper theming for dark mode, system font scaling, tap targets ≥ 48 dp, screen-reader labels on every icon-only button. | Accessibility |
| NFR-12 | Responsiveness | At ≥768 px web width, tabs become a left navigation rail and forms open as dialogs. | Navigation |
| NFR-13 | Localization | All text goes through i18n. Translation-ready from day one. English only in v1. | Platform decisions |
| NFR-14 | Portability | One Expo codebase for Android and web. Nothing above the adapter branches on platform. | Architecture |
| NFR-15 | Maintainability | Layering is screens → feature hooks → repositories → platform adapter. Domain code is pure TypeScript. | Architecture |
| NFR-16 | Testability | Domain code is written test-first. Rules and domain logic get the deepest coverage. Every rules row is tested allowed and denied. | Testing |
| NFR-17 | Build | Android release builds via EAS Build. Native modules require development builds. | Libraries |
| NFR-18 | Cost of rules | Subcollection rules use `get()` on the parent vehicle. One billed read per request, accepted as within free quota at expected usage. This is the source's claim. Whether it holds for batched writes is verified by the rules spike (§15.9, OQ-35, gate G3). | Security rules |
| NFR-19 | Performance, latency, scale targets | Scale: roughly 100 to 500 daily active users on the free plan (OQ-18). No latency or coverage targets are set. | Decision 2026-10-06 |
| NFR-20 | Cache-first reads | Reads are cache-first wherever possible, and a refresh control pulls the latest data from the cloud. | Decision 2026-10-06 |

---

## 10. User Flows

Flows below are taken directly from the source. Flows for sub-projects 2–8 are stated only to the level the source gives.

### 10.1 First launch, Android [Source]

1. Read the persisted session from the native SDK.
2. With no session, call `signInAnonymously()`, then create `users/{uid}` with default settings (INR, km, litres, device language).
3. Show one welcome screen ("Free. No ads. Your data stays yours." then Get started), then open onboarding at "Add your first vehicle".

**Offline first launch.** Anonymous sign-in needs the network once. If the first launch is offline, a **"Connect to get started"** screen retries automatically. After that the app works fully offline.

### 10.2 First launch, web [Source]

A Google-only sign-in screen using the JS SDK popup flow. A new Google account gets its `users/{uid}` document on first sign-in. Signed-in web users see the same vehicles as on Android.

### 10.3 Add a vehicle [Source]

1. User opens "Add your first vehicle" (empty state) or More → Vehicles → Add.
2. Fills the required fields (name, type, fuel types, odometer unit, current odometer), optional fields (make, model, year, plate), and picks a colour.
3. Saves (offline-capable on Android). The vehicle appears in the switcher and becomes the scope of all tabs.

### 10.4 Edit, archive, unarchive, delete a vehicle [Source]

- **Edit:** all fields. Odometer unit and currency are locked once entries exist.
- **Archive:** hidden from the switcher. Entries are kept for history and lifetime reports.
- **Unarchive:** More → Vehicles.
- **Delete:** type the vehicle name to confirm. Entries, reminders and checklist templates are deleted in batches of 500, then the vehicle.

### 10.5 Link Google (Android) [Source]

1. A trigger fires: a dismissible prompt after the 5th entry; the persistent "Your data isn't backed up" banner on More; or a required step before Drive backup, receipt photos or sharing.
2. Google Sign-In returns an ID token → `GoogleAuthProvider` credential → `linkWithCredential`.
3. The uid is unchanged, so no data moves. `isLinked: true` is set.

### 10.6 Link Google, conflict case (account merge) [Source]

1. `linkWithCredential` fails with `auth/credential-already-in-use`.
2. The app shows: *"This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?"* with **Move and switch**, **Switch without moving**, **Cancel**.
3. On **Move and switch**:
   1. **Read:** while still anonymous, serialize every owned vehicle plus all entries, reminders and checklist templates into memory.
   2. **Sign in** with the Google credential (replaces the anonymous session).
   3. **Write** copies under new ids owned by the Google uid, in batches of 500.
   4. **Failure handling:** if the write fails partway, keep the serialized data in memory **and on disk** and offer a retry. Deterministic ids derived from source ids prevent duplicates on retry.
4. The abandoned anonymous account's documents remain in Firestore with no owner able to delete them (accepted limitation).

### 10.7 Sign-out [Source]

- **Linked users:** normal sign-out. On Android, `clearPersistence()` is called after sign-out so the next person on the device sees nothing.
- **Anonymous users:** no sign-out option, because it would destroy their data. "Link Google" takes its place.

### 10.8 Change a setting [Source]

User changes currency, distance unit, volume unit, efficiency format, date format, theme or language. The setting persists and **converts what is displayed, never what is stored**. Defaults apply to new vehicles and to display.

### 10.9 Switch vehicle [Source]

The user picks a vehicle in the top-bar switcher (name, type icon, colour). All tabs rescope. The selection persists across launches.

### 10.10 Add an entry (placeholder in Foundation) [Source]

On Dashboard or History, the Add button opens a sheet: Fuel, Expense, Service, Income, Trip, Inspection. In Foundation these open placeholder screens. Real entry forms arrive in tab 2 (fuel, expense, service, income, trip) and tab 7 (inspection).

### 10.11 Error flows [Source]

See §19 for the full behavior table: offline, quota exceeded, permission denied (owner vs member), malformed document, cancelled sign-in, sign-in error with Retry, linking conflict, unhandled screen exception.

### 10.12 Flows defined in later tabs

| Sub-project | Flows (scope-level only) |
| --- | --- |
| 2 Logging | Log fuel/charging, expense, service, income, trip. Browse History. |
| 3 Reminders | Create date/odometer reminders. Auto-complete from matching entries. Receive local notifications. Mute per vehicle. |
| 4 Reports | View per-vehicle or All vehicles reports by financial-year range. |
| 5 Drive and export | Back up and restore. Attach receipts with offline upload queue. Export CSV. |
| 6 Sharing | Create and redeem invite codes and links. Leave, remove, transfer ownership. Share receipts. |
| 7 Checklists | Manage templates. Run inspections. Copy templates between vehicles. |
| 8 Release | Account deletion. Play closed testing → production. |

---

## 11. Platform and Technology Decisions

### 11.1 Platform and backend decisions [Source]

| Area | Decision |
| --- | --- |
| App framework | Expo (React Native) with Expo Router; Android primary, web secondary |
| Identity | App name **Milevana**; Android package **`dev.poovarasu.milevana`**; web at **`milevana.poovarasu.dev`** |
| Backend | Firebase on the free Spark plan; no custom API server and no Cloud Functions |
| Database | Cloud Firestore; offline cache on Android, online-only on web |
| Accounts | Android: anonymous first, link Google later. Web: Google sign-in only |
| File storage | The user's own Google Drive (`drive.file` scope); Firebase Storage needs the paid Blaze plan |
| Backup | Google Drive backup and restore, manual plus automatic when stale |
| Sharing | Vehicles shared by invite with owner and member roles; receipts shared through Drive permissions |
| Notifications | Local notifications scheduled on each Android device; none on web |
| Localization | India defaults (INR, km, litres); currency and units configurable per user and per vehicle; all text through i18n, English only in v1 |
| Cost | Google Play's one-time US$25 registration; everything else on free tiers or the existing portfolio domain |

### 11.2 Libraries [Source]

| Need | Choice | Why | Sub-project |
| --- | --- | --- | --- |
| Navigation | Expo Router | File-based routes with web URLs | 1 |
| UI kit | React Native Paper | Material 3, mature on web, built-in theming and dark mode | 1 |
| Forms | react-hook-form + zod | Schemas shared with repositories | 1 |
| UI state | Zustand | Tiny; UI-only state | 1 |
| i18n | i18next + expo-localization | Translation-ready from day one | 1 |
| Native auth and Drive tokens | `@react-native-google-signin/google-signin` | Google credential for linking; `drive.file` added incrementally | 1, 5 |
| Web Drive tokens | Google Identity Services | On-demand tokens in the browser | 5 |
| Charts | react-native-gifted-charts | SVG-based; same charts on Android and web | 4 |
| Notifications | expo-notifications | Local, inexact; no exact-alarm permission | 3 |
| Photos and PDFs | expo-image-picker (system photo picker), expo-document-picker | No broad media permission | 5 |
| Builds | EAS Build | Android release builds with native modules | 1, 8 |
| Web hosting | Firebase Hosting at `milevana.poovarasu.dev` | Free tier; custom subdomain of the portfolio domain | 8 |

Additional stack elements named in the source: Firebase Authentication (anonymous and Google), Cloud Firestore, Firebase Crashlytics, `@react-native-firebase`, the Firebase JS SDK, GitHub Actions, Jest, React Native Testing Library, Maestro, Firebase Emulator and `@firebase/rules-unit-testing`.

### 11.3 Build constraints [Source]

- Native modules require Expo **development builds**, not Expo Go.
- The Android build config strips `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` if any library adds them.

### 11.4 Identity facts and permanence [Source]

| Item | Status |
| --- | --- |
| App name: Milevana | Decided |
| Android package `dev.poovarasu.milevana` | Decided. **Cannot change after the first Play Store release** |
| Web address `milevana.poovarasu.dev` | Decided. Pointed at Firebase Hosting. Invite links (tab 6) and the Google consent screen (tab 8) use it |
| Firebase project id (e.g. `milevana` or `milevana-app`) | **Open.** Permanent once created. Also forms the fallback `<project-id>.web.app` address. See OQ-03 |

---

## 12. Architecture

### 12.1 Overview [Source]

One Expo codebase serves Android and web, layered as **screens → feature hooks → repositories → a platform-specific Firebase adapter**. Only repositories touch Firestore, and only the adapter knows which SDK is running.

### 12.2 Code layout [Source]

```
app/                    Expo Router screens (same routes on Android and web)
src/
  domain/               pure TypeScript, no React, no Firebase:
    fuel.ts             two-of-three input, mileage per fuel type (tab 2)
    reminders.ts        status, auto-complete, km-per-day prediction (tab 3)
    reports.ts          metric definitions and report sections (tab 4)
    units.ts, money.ts  unit and currency conversion
  data/
    firebase.native.ts  @react-native-firebase (durable offline cache, Android)
    firebase.web.ts     Firebase JS SDK (online-only, web)
    repos/              vehicleRepo, entryRepo, reminderRepo, templateRepo,
                        inviteRepo, userRepo
    serializer/         export/import format shared by account merge, Drive backup
                        and restore
    drive/              driveClient.native.ts, driveClient.web.ts, upload queue,
                        share sync (tabs 5 and 6)
    notifications/      local scheduling (tab 3)
  features/             hooks and components per module
  ui/                   shared components and theme
```

### 12.3 Layer responsibilities [Source]

| Layer | Responsibility |
| --- | --- |
| `app/` | Expo Router screens. The same routes on Android and web. |
| `features/` | Hooks and components per module (e.g. `useVehicles()`, `useEntries(vehicleId)`). |
| `data/repos/` | Convert Firestore documents to domain types, validate every read with zod, apply writes locally and return immediately (Android). |
| `data/firebase.*.ts` | Platform adapter. Expo resolves `firebase.native.ts` or `firebase.web.ts` by platform. Both expose the same narrow interface, so nothing above them branches on platform. |
| `domain/` | Pure TypeScript calculations and rules: no React, no Firebase. |
| `ui/` | Shared components and theme. |

### 12.4 Key architecture decisions [Source]

| Decision | Detail |
| --- | --- |
| Dual-SDK data layer | `@react-native-firebase` on Android for a **durable offline cache**; Firebase JS SDK on web, online-only. One shared JS SDK on all platforms was rejected because Android would have no durable offline storage. |
| State | Firestore cache is the source of truth. Small hooks subscribe. Zustand holds UI-only state (e.g. the selected vehicle). No Redux, no query-caching library. |
| Offline writes | Repositories apply writes locally and return immediately, because on Android a write's promise resolves only after server confirmation. Pending items show a sync icon via `hasPendingWrites`. |
| Validation | zod on every read and in forms. Security rules validate on write. |
| Auth | Firebase anonymous auth → `linkWithCredential` with a Google credential. The uid is unchanged, so no data moves. |
| File storage | The user's own Google Drive (`drive.file`), accessed via `driveClient.native.ts` and `driveClient.web.ts`. |
| Notifications | Local only (`expo-notifications`), scheduled on each Android device. |
| Security | Firestore rules are the whole backend (§15). |

### 12.5 Architecture constraints [Source]

- Nothing above the adapter may branch on platform.
- Only repositories touch Firestore.
- Domain code has no React and no Firebase imports.
- The design is server-free: there is no server code (see the accepted limitation on orphaned documents).
- The source says both adapters "expose the same narrow interface" but doesn't enumerate it. Native-only operations such as `clearPersistence`, snapshot metadata (`hasPendingWrites`), batches and server timestamps must be covered, and any module outside the adapters that imports a native SDK would break the web bundle. The interface's scope is set when the adapters are written.

---

## 13. Data Model

### 13.1 Structure [Source]

Vehicles are top-level documents carrying their member list, and everything a vehicle owns lives beneath it. **One membership check protects a vehicle's whole subtree, so sharing needs no migration.**

```
users/{uid}
  displayName, isLinked, createdAt, schemaVersion, deletion?   deletion: tab 8
  drive: rootFolderId, backupsFolderId, receiptsFolderId,
         lastBackupAt, lastBackupFileId,
         vehicleFolderIds                               tab 5
  settings: currency, distanceUnit, volumeUnit, efficiencyFormat,
            dateFormat, theme, locale, backupFrequency,
            mutedReminderVehicleIds                     tab 3

vehicles/{vehicleId}
  name, type, color, make?, model?, year?, plate?
  fuelTypes: ["petrol", "cng"]
  odometerUnit: km | mi | hours,  currency: "INR"
  ownerId, memberIds: [uid...],
  members: { uid: { role, name, email, joinedAt, inviteCode? } }
  lastOdometer, lastOdometerAt
  archived, createdAt, updatedAt, schemaVersion

  entries/{entryId}
    type: fuel | expense | service | income | trip | inspection
    date, odometer?, amount: { minor, currency }, notes?
    category?
    attachments: [{ id, ownerUid, mimeType, sizeBytes, status,
                    driveFileId?, sharedWithUids, itemId? }]
    uploaderUids: [uid...]                              tab 6
    createdBy, createdByName, updatedBy, createdAt, updatedAt, schemaVersion
    details: { ...type-specific }                       tabs 2 and 7

  reminders/{reminderId}                                tab 3
  checklistTemplates/{templateId}                       tab 7

invites/{code}                                          tab 6
```

### 13.2 Collections and key fields [Source]

| Collection | Key fields | Notes |
| --- | --- | --- |
| `users/{uid}` | `displayName`, `isLinked`, `createdAt`, `schemaVersion`; `drive` (tab 5); `settings`; `deletion` (tab 8, only during account deletion) | `settings` holds `currency`, `distanceUnit`, `volumeUnit`, `efficiencyFormat`, `dateFormat`, `theme`, `locale`, `backupFrequency`, `mutedReminderVehicleIds` (tab 3). `drive` holds `rootFolderId`, `backupsFolderId`, `receiptsFolderId`, `lastBackupAt`, `lastBackupFileId`, `vehicleFolderIds` (tab 5). |
| `vehicles/{vehicleId}` | `name`, `type`, `color`, optional `make`/`model`/`year`/`plate`; `fuelTypes` (array); `odometerUnit` (`km`, `mi`, `hours`); `currency`; `ownerId`; `memberIds`; `members` map (`role`, `name`, `email`, `joinedAt`, optional `inviteCode`); `lastOdometer`, `lastOdometerAt`; `archived`; `createdAt`, `updatedAt`, `schemaVersion` | Example: `fuelTypes: ["petrol", "cng"]`, `currency: "INR"`. |
| `vehicles/{id}/entries/{entryId}` | `type` (`fuel`, `expense`, `service`, `income`, `trip`, `inspection`); `date`; optional `odometer`; `amount: { minor, currency }` (fuel, expense, service and income only); optional `notes`; optional `category`; `attachments[]`; `uploaderUids`; `createdBy`, `createdByName`, `updatedBy`, `createdAt`, `updatedAt`, `schemaVersion`; `details` (type-specific, defined in tabs 2 and 7) | `attachments[]` items: `id`, `ownerUid`, `mimeType`, `sizeBytes`, `status`, optional `driveFileId`, `sharedWithUids`, optional `itemId` (for an inspection photo, the checklist item it is tagged with; not used by other entry types; OQ-41, OQ-60). |
| `vehicles/{id}/reminders/{reminderId}` | Defined in tab 3 | |
| `vehicles/{id}/checklistTemplates/{templateId}` | Defined in tab 7 | Max 50 items per template (rules). |
| `invites/{code}` | Denied in Foundation; defined in tab 6 | |

### 13.3 Fuel details (the only detail shape Foundation fixes) [Source]

Because mileage depends on it: `fuelType`, `quantity`, `quantityUnit` (**L, gal_us, gal_uk, kg, kWh**), `pricePerUnitMilli` (price per unit as an integer in thousandths of a minor unit), `fullTank`, `missedPrevious`. **Tab 2** adds optional fuel fields and defines the other entry shapes.

### 13.3.1 Service entries [Source, added 2026-10-06]

*Other Logging decisions added to the source on 2026-10-06 (fuel input, categories, trips, sanity checks, History) are recorded in §23.2.*

Decided for tab 2; the field shape is defined in tab 2: one `service` entry per garage visit, with line items. Each line has a service type and its cost; the entry total is the sum of the lines, plus optional labour and discount. This matches how the bill is actually paid, keeps one receipt photo per bill, and the History list shows one row per garage visit. Reminders (tab 3) can still trigger per service type, for example "oil change every 10,000 km", by looking inside the line items.

What the source does **not** define about service entries is listed in OQ-41 (shape of a line, form of labour and discount, whether `amount` is the stored total, the service-type list, enforcement of one receipt, and what `attachments[].itemId` references).

### 13.4 Design rationale (each is a requirement on implementers) [Source]

| Decision | Rationale |
| --- | --- |
| **One `entries` collection with a `type` field** | History, reports, CSV export and backup each need one query per vehicle, not six merged ones. |
| **`memberIds` array plus `members` map** | The array supports the `array-contains` query for "my vehicles"; the map holds role, display name, email and join date. |
| **Money as integer minor units with a currency code** | `{ minor: 245000, currency: "INR" }` is ₹2,450.00 and avoids floating-point drift. |
| **Odometer stored in the vehicle's own unit** | Conversion happens only at display time, so no rounding is ever stored. |
| **Category name copied onto each entry** | Shared members see the name without a category collection, and renames don't rewrite history. |
| **`createdBy` and `updatedBy` on entries** | They show who logged an entry and power the edit rules; `createdByName` keeps the name visible after a member leaves (tab 6). |
| **`lastOdometer` denormalized on the vehicle** | Written in the same batch as the entry, taking the maximum, for the dashboard and reminders. |
| **`schemaVersion` on top-level documents and entries** | Repositories upgrade older shapes on read. |

### 13.5 Left out (YAGNI) [Source]

Soft delete and edit history, a custom-category collection (a fixed list plus free-text "Other"), server-computed totals, and vehicle photos.

### 13.6 Data model business rules

1. A vehicle's `ownerId` is set at creation to the signed-in user, who is the only member.
2. `createdBy` on an entry is set to the creating user and is immutable.
3. `amount.minor` must be an integer.
4. Entry `type` is restricted to the six listed types.
5. Odometer values are stored in the vehicle's `odometerUnit`; `amount.currency` is a currency code. The vehicle `currency` locks once entries exist.
6. Categories are a fixed list plus free-text "Other", defined in tab 2. The category name is copied onto each entry.
7. Timestamps (`createdAt`, `updatedAt`) are validated against `request.time` in rules.

### 13.7 Data model decisions (2026-10-06)

| Topic | Decision |
| --- | --- |
| Fuel details (OQ-30) | `quantityUnit` is L, gal_us, gal_uk, kg or kWh. Price per unit is `pricePerUnitMilli`, an integer in thousandths of a minor unit. The total stays in integer minor units, so "any two of three" round-trips. |
| `amount` (OQ-31) | Required only for fuel, expense, service and income entries. Always stored positive; the type decides income versus cost. Its currency equals the vehicle's currency. Minor-unit exponents come from a currency table in `money.ts`. Trips and inspections have no `amount`. |
| `date` (OQ-32) | A timestamp of the chosen local date and time. The financial year (April to March) uses the device time zone. |
| Fuel types, palette (OQ-12) | Petrol, diesel, CNG, LPG, electric. 12 fixed colours. Fuel and trip entries have no category. |
| Odometer units (OQ-11) | `hours` is selectable for any vehicle type. Entries use the vehicle's unit. Units stay locked once the vehicle has entries. |
| `lastOdometer` (OQ-17) | The maximum odometer across the vehicle's entries and its starting odometer, recomputed by the client on edit or delete. Rules require only a non-negative number. Concurrent offline writes can briefly lower it, and it corrects itself on the next entry or refresh. |
| Membership invariants (OQ-34) | The owner is in `memberIds`. `members` keys match `memberIds`. `ownerId` changes only to an existing member. `createdBy` and `updatedBy` equal the caller. |
| "Without data migrations" (OQ-40) | No bulk or server migrations. Older shapes upgrade lazily on read. |
| Added fields | `entries.uploaderUids`, `users.drive.vehicleFolderIds`, `users.deletion`. Field-level shapes are in Appendix E (approved). |

---

## 14. Authentication and Account Lifecycle

Android users start anonymously and link Google later without moving data. Web users always sign in with Google. The one hard case, linking a Google account that already has data, is resolved on the device with the shared serializer.

### 14.1 Account states and lifecycle [Source]

| Stage | Android | Web |
| --- | --- | --- |
| First launch | Anonymous sign-in, `users/{uid}` created with defaults | Google sign-in screen (JS SDK popup). `users/{uid}` created on first sign-in |
| Normal use | Anonymous, or linked (`isLinked: true`) | Google-signed-in |
| Linking | Available (§14.3). Required before Drive backup, receipt photos, or sharing | Not applicable |
| Conflict | Merge flow (§14.4) | Not applicable |
| Sign-out | Linked only; `clearPersistence()` afterwards. Anonymous has none | Normal |
| Account deletion | Defined in tab 8 | Defined in tab 8 |

### 14.2 FR-AUTH: first launch, Android

**Purpose.** Let a user start with no friction, per principle P4.

**User behavior.** Open the app; land on "Add your first vehicle". No sign-in screen is shown.

**Functional requirements**

| ID | Requirement |
| --- | --- |
| FR-AUTH-01 | Read the persisted session from the native SDK. |
| FR-AUTH-02 | With no session, call `signInAnonymously()`. |
| FR-AUTH-03 | Create `users/{uid}` with default settings: INR, km, litres, device language. |
| FR-AUTH-04 | Show one welcome screen ("Free. No ads. Your data stays yours." then Get started), then open onboarding at "Add your first vehicle". |
| FR-AUTH-05 | Anonymous sign-in needs the network once. If the first launch is offline, show a **"Connect to get started"** screen that **retries automatically**. |
| FR-AUTH-06 | After the account exists, the app works fully offline. |

**Business rules.** No sign-in screen on Android. Anonymous users get no sign-out option.

**Edge cases.** Offline first launch (FR-AUTH-05). An anonymous user who uninstalls before linking or exporting a CSV loses their data, and the app says so plainly (§26). If a session exists but `users/{uid}` is missing (for example, the app was killed between sign-in and document creation), it is created with defaults (decided, OQ-39).

**Dependencies.** Firebase project (OQ-03), native Firebase adapter.

**Acceptance criteria.** AC-F1: a fresh Android install reaches "Add your first vehicle" with no sign-in screen. Maestro covers first launch → add vehicle → change settings.

**Technical constraints.** Native SDK session persistence. `signInAnonymously()` requires connectivity once.

### 14.3 FR-LINK: link Google (Android)

**Purpose.** Let an anonymous user attach a Google account, which enables backup, Drive receipts, sharing, and web access, with no data movement.

**User behavior.** The user is nudged to link, or is required to link when starting a feature that needs it.

**Functional requirements**

| ID | Requirement |
| --- | --- |
| FR-LINK-01 | **Trigger 1:** a dismissible prompt after the **5th entry**. |
| FR-LINK-02 | **Trigger 2:** a persistent **"Your data isn't backed up"** banner on More. |
| FR-LINK-03 | **Trigger 3:** a **required step** before Drive backup, receipt photos, or sharing. |
| FR-LINK-04 | Google Sign-In returns an ID token, which becomes a `GoogleAuthProvider` credential passed to `linkWithCredential`. |
| FR-LINK-05 | The uid is unchanged, so no data moves. Set `isLinked: true`. |
| FR-LINK-06 | The Google Cloud OAuth client is configured once in Foundation, so tab 5 can request `drive.file` incrementally. |
| FR-LINK-07 | The Drive scope request itself is **not** in Foundation (tab 5). |
| FR-LINK-08 | The "5th entry" counts entries across all vehicles. A dismissed prompt does not reappear. The "Your data isn't backed up" banner on More stays (OQ-05). |

**Business rules.** Google sign-in cancelled is silent. A network or unknown error shows a message with Retry.

**Edge cases.** The Google account already has data (§14.4).

**Dependencies.** FR-AUTH; OAuth client setup; `@react-native-google-signin/google-signin`.

**Acceptance criteria.** AC-F3 (Anonymous users can link Google). Maestro covers link Google.

**Technical constraints.** `linkWithCredential` with `GoogleAuthProvider`.

### 14.4 FR-MERGE: account conflict (Google account already has data)

**Purpose.** Let an anonymous user whose Google account already has data bring their on-device data across, without server code.

**User behavior.** After `linkWithCredential` fails, the user sees the prompt and chooses.

**Prompt (verbatim in source):** *"This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?"* with three actions:

| Action | Behavior |
| --- | --- |
| **Move and switch** | Run the merge procedure below. |
| **Switch without moving** | Signs in to the Google account and leaves the phone's data behind, after a warning that it cannot be recovered (decided, OQ-06). |
| **Cancel** | Keeps the user anonymous with nothing changed (decided, OQ-06). |

**Functional requirements: merge procedure**

| ID | Requirement |
| --- | --- |
| FR-MERGE-01 | Detect the conflict via the `auth/credential-already-in-use` error from `linkWithCredential`. |
| FR-MERGE-02 | **Read:** while still anonymous, serialize every vehicle the anonymous user owns, plus all entries, reminders and checklist templates, **into memory**. |
| FR-MERGE-03 | **Sign in** with the Google credential, which **replaces the anonymous session**. |
| FR-MERGE-04 | **Write** copies under **new ids owned by the Google uid**, **in batches of 500**. |
| FR-MERGE-05 | **Failure handling:** if the write fails partway, keep the serialized data **in memory and on disk** and offer a **retry**, because the anonymous account cannot be re-entered. |
| FR-MERGE-06 | Copies use **deterministic ids derived from the source ids**, so retries don't duplicate. |
| FR-MERGE-07 | The prompt shows counts of vehicles and entries to be moved. |
| FR-MERGE-08 | Copies keep their original `date`, `createdAt` and `updatedAt`. `createdBy` and `updatedBy` are rewritten to the new owner's uid, and `createdByName` is kept. Vehicles are written before their entries (OQ-22). |
| FR-MERGE-09 | The Google account's existing settings win. The anonymous user's settings are discarded (OQ-07). |
| FR-MERGE-10 | Retry data is kept in app-private storage until the merge succeeds or the user discards it, then deleted. On launch, if retry data exists, the app shows "Finish moving your data" (OQ-08, OQ-23). |

**Business rules.** The anonymous account cannot be re-entered after sign-in. The merge runs on the device, using the shared serializer, with no server code.

**Edge cases**

| Case | Behavior |
| --- | --- |
| Write fails partway | Serialized data retained in memory and on disk. Retry offered. Deterministic ids prevent duplicates. |
| Abandoned anonymous account | Its documents remain in Firestore with no owner able to delete them. Known limitation of a server-free design, at a few KB per case. |
| Settings (`users/{uid}`) during merge | The Google account's settings win (FR-MERGE-09). |
| On-disk retry data | Kept until success or discard, then deleted (FR-MERGE-10). |
| Merge write against the Foundation rules | Copies keep dates, `createdBy` and `updatedBy` are rewritten to the new owner, and vehicles are written before entries, so the `createdBy` = self rule and the `get()` membership check can pass (FR-MERGE-08). Emulator-verified; production confirmation pending (gate G3). |
| App closed or killed after sign-in but before the write completes | The retry data on disk is found on next launch and the app shows "Finish moving your data" (FR-MERGE-10). Partial copies may be visible in the Google account meanwhile. |
| Batch size | 500 is the batch size. The emulator spike found it passes when the rules read only the parent vehicle (OQ-35); production confirmation is pending. |

**Dependencies.** Shared serializer (FR-SER); security rules allowing creation of vehicles under the Google uid; batch writes.

**Acceptance criteria.** AC-F3 includes the conflict case. Serializer round-trips are tested. The account-conflict merge is on the manual release checklist. An emulator integration test covers the merge write path (§21.5).

**Technical constraints.** Batches of 500. Deterministic ids. Disk persistence of retry data.

### 14.5 FR-WEB: web sign-in

| ID | Requirement |
| --- | --- |
| FR-WEB-01 | Web users sign in with **Google only**, using the JS SDK **popup flow**. |
| FR-WEB-02 | A new Google account gets its `users/{uid}` document on first sign-in. |
| FR-WEB-03 | Web users see the same vehicles as on Android (AC-F4). |
| FR-WEB-04 | The web app is online-only (§16). |


**Assumption behind AC-F4 (decided, OQ-25).** "See the same vehicles" holds because linking Google to the anonymous uid keeps the uid, so web Google sign-in resolves to the same Firebase user. A user who signs in on web first and later links on Android goes through the account-conflict path (§14.4). If the web sign-in popup is blocked, web falls back to the redirect flow (OQ-27).

### 14.6 FR-OUT: sign-out

| ID | Requirement |
| --- | --- |
| FR-OUT-01 | **Linked users:** normal sign-out. |
| FR-OUT-02 | On Android, call **`clearPersistence()`** after sign-out so the next person on the device sees nothing. |
| FR-OUT-03 | **Anonymous users:** no sign-out option, because it would destroy their data. **"Link Google" takes its place.** |


| ID | Requirement (decided, OQ-24) |
| --- | --- |
| FR-OUT-04 | If writes are pending, sign-out first shows how many changes have not synced and offers **Wait and sync** or **Sign out and discard**. |
| FR-OUT-05 | Sign-out also clears scheduled notifications, the saved selected vehicle, any merge retry data, and the Google Sign-In session, in addition to `clearPersistence()`. |


### 14.7 Account deletion and email/password

- **Account deletion:** not in Foundation. Defined in tab 8, "designed with sharing". It uses only the existing security-rule paths; no extra rule is needed. The flow is decided (§23.8): shared vehicles you own go to a member (a choice per vehicle), vehicles only you use are deleted, and your receipts stay in your Drive. Details are in OQ-62.
- **Email/password sign-in:** not in v1; "later, if users ask" (DD-03).

### 14.8 Authentication dependencies

- Google Cloud OAuth client configured in Foundation.
- Firebase Authentication with anonymous and Google providers.
- `@react-native-google-signin/google-signin` on Android.
- Web address `milevana.poovarasu.dev` for the Google consent screen (tab 8).
- **[External — verify]** Decided (OQ-28): the consent screen is published with basic sign-in scopes before the closed test, and `drive.file` is added in tab 5. Verify with an account that is not a listed test user (gate G6). Also confirm: separate OAuth clients for Android and web (FR-SCAF-04 says "an OAuth client"), the SHA-1 of the Play app-signing key as well as the upload key, and the custom domain among Firebase Auth's authorized domains.

---

## 15. Authorization and Security

### 15.1 Principles [Source]

Security rules are the **entire backend**, so **every path is denied by default and opened only as below**. Every row is tested both ways, allowed and denied, in the emulator suite.

### 15.2 Rules matrix [Source]

| Path | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `users/{uid}` | Self | Self | Self | Self |
| `vehicles/{id}` | Members | Signed-in user, with self as owner and only member | Owner; members cannot change `ownerId`, `memberIds` or `members`, except self-join and leave (tab 6) and the `lastOdometer` exception below | Owner |
| `vehicles/{id}/entries/{e}` | Members | Members, with `createdBy` = self | Creator or owner; `createdBy` immutable | Creator or owner |
| `vehicles/{id}/reminders/{r}` | Members | Members | Members | Members |
| `invites/{code}` | Denied in Foundation; defined in tab 6 | Tab 6 | Tab 6 | Tab 6 |

### 15.3 Functional requirements (FR-SEC)

| ID | Requirement |
| --- | --- |
| FR-SEC-01 | **Default deny** for every path. |
| FR-SEC-02 | The rules matrix in §15.2 is implemented exactly. |
| FR-SEC-03 | **Write validation in rules:** required fields and types on create; `type` restricted to the six entry types; `amount.minor` an integer; timestamps compared to `request.time`. |
| FR-SEC-04 | **`lastOdometer` exception:** members may update **only** `lastOdometer`, `lastOdometerAt` and `updatedAt` on a vehicle, so logging an entry can refresh the dashboard. |
| FR-SEC-05 | Entry `createdBy` is immutable. |
| FR-SEC-06 | Subcollection rules use `get()` on the parent vehicle to check membership. |
| FR-SEC-07 | The client validates too (zod), but rules are the last line of defence. |
| FR-SEC-08 | **Every row of the matrix is tested allowed and denied** in the Firebase Emulator suite using `@firebase/rules-unit-testing`, on every push. |
| FR-SEC-09 | **Decided (2026-10-06).** Foundation writes the `checklistTemplates` rules and ships default-deny for `invites`, self-join, leave and ownership transfer, tested as denied (OQ-04). |
| FR-SEC-10 | Timestamps are checked to be not in the future, instead of equal to `request.time`, so merged and restored copies keep their original dates (OQ-22). `createdBy` and `updatedBy` equal the caller (OQ-34). |
| FR-SEC-11 | `amount` is required for fuel, expense, service and income entries, and its currency equals the vehicle's currency (OQ-31). |
| FR-SEC-12 | Invariants: the owner is in `memberIds`; `members` keys match `memberIds`; `ownerId` changes only to an existing member; `memberIds` has at most 10 entries (OQ-34, OQ-55). |
| FR-SEC-13 | Rules cap text lengths and array sizes (5 attachments, 50 template items, 10 members). Document counts cannot be limited by rules. There is no App Check in v1 (OQ-33). The exact length limits are set during rules design. |

### 15.4 Paths and rules added by later tabs [Source]

| Path / rule | Tab | Detail |
| --- | --- | --- |
| `vehicles/{id}/checklistTemplates/{t}` | 7 | Members read, create and update, with **at most 50 items**; the **creator or owner deletes**. |
| `invites/{code}` and vehicle **self-join, leave, remove and ownership-transfer** paths | 6 | Each with **its own adversarial tests**. A user may add themselves only if a **valid, unused invite** for that vehicle exists, and **the same write marks the invite used**. A vehicle has **at most 10 members**. The rules also record which members each receipt is shared with (`sharedWithUids`). These are described in the Sharing decisions as updates to the Foundation rules, written in tab 6. Foundation ships them default-deny and tested as denied (OQ-04). |
| Entry updates for `attachments[].sharedWithUids` | 6 | Use the **existing creator-or-owner rule**. |
| Account deletion | 8 | Uses only the paths above. **No extra rule needed.** |

### 15.5 Roles and permissions summary [Source]

| Capability | Owner | Member | Not a member |
| --- | --- | --- | --- |
| Read vehicle and subtree | Yes | Yes | No (denied by default) |
| Create vehicle | Any signed-in user, as owner and only member | — | — |
| Update vehicle fields | Yes | No, except `lastOdometer`, `lastOdometerAt`, `updatedAt`, and self-join/leave (tab 6) | No |
| Change `ownerId`, `memberIds`, `members` | Yes | No, except self-join and leave (tab 6) | No |
| Delete vehicle | Yes | No | No |
| Create entry | Yes (`createdBy` = self) | Yes (`createdBy` = self) | No |
| Update or delete entry | Any entry | Own entries (creator) | No |
| Reminders: read, create, update, delete | Yes | Yes | No |
| Checklist templates (tab 7) | Read, create, update; delete | Read, create, update; delete own | No |
| `users/{uid}` | Self only | Self only | Own document only |

Anonymous users are signed-in Firebase users, so they hold the same rights over their own data as any other signed-in user.

### 15.6 Adversarial testing requirement

Tab 6 paths each need their own adversarial tests. Foundation's emulator suite covers the full matrix in §15.2.

### 15.7 Cost note [Source]

Rules on subcollections use `get()` on the parent vehicle to check membership. That read is billed, but it's one per request and well within the free quota at expected usage. (Expected usage is budgeted at roughly 100 to 500 daily active users; OQ-18. **[Review]** "One per request" is the source's claim and is verified for batched writes by the rules spike, gate G3; see §15.9.)

### 15.8 Security decisions (2026-10-06)

Foundation's rules scope is settled (FR-SEC-09, OQ-04), and `lastOdometer` handling is decided (§13.7, OQ-17). Remaining checks are in §15.9.

### 15.9 Rules feasibility checks [Review]

Each concern is decided, and the items marked "verification pending" must still be confirmed against production.

| # | Concern | Decision | Status |
| --- | --- | --- | --- |
| 1 | Merge and restore versus the matrix (`createdBy` = self, timestamps, `get()` ordering) | Dates kept, `createdBy` and `updatedBy` rewritten, timestamps checked as not in the future, vehicles written before entries (OQ-22) | Emulator-verified 2026-10-06; production confirmation pending (gate G3) |
| 2 | Batches of 500 versus rules access-call limits **[External — verify]** | 500 is the batch size; rules read only the parent vehicle (OQ-35) | Emulator-verified 2026-10-06; production confirmation pending (gate G3) |
| 3 | Owner updates unconstrained | Membership invariants in FR-SEC-12 (OQ-34) | Decided |
| 4 | No limits on counts or sizes | Field limits in rules; no App Check; document counts not limited (OQ-33) | Decided; accepted limitation |
| 5 | Member-written `lastOdometer` unvalidated | Non-negative number only; recomputed by the client (OQ-17) | Decided |
| 6 | `createdByName` and `updatedBy` not constrained | `updatedBy` equals the caller (OQ-34). `createdByName` is not validated | Decided |

---

## 16. Offline and Sync Behavior

### 16.1 Platform split [Source]

| Aspect | Android | Web |
| --- | --- | --- |
| SDK | `@react-native-firebase` | Firebase JS SDK |
| Cache | Durable offline cache | Online-only |
| Writes while offline | Saved locally. Pending-sync icon shown. Sync later. | Banner. **Saving disabled**, since unsynced web writes live only in memory |
| First launch | Needs network once | Needs network **[Derived]** (online-only) |
| Notifications | Local, per device | None |

### 16.2 Functional requirements (FR-OFF)

| ID | Requirement |
| --- | --- |
| FR-OFF-01 | On Android, **every write works offline and syncs later**. |
| FR-OFF-02 | **Repositories apply writes locally and return immediately**, because on Android a Firestore write's promise resolves only after server confirmation, so awaiting it offline would hang. |
| FR-OFF-03 | Items with pending writes show a **sync icon**, driven by Firestore's `hasPendingWrites` metadata. |
| FR-OFF-04 | The Firestore cache is the source of truth. Screens subscribe via hooks. |
| FR-OFF-05 | **Offline is a normal state on Android, not an error.** |
| FR-OFF-06 | On web, offline shows a banner and disables saving. |
| FR-OFF-07 | **Quota exceeded** (`resource-exhausted`): Android shows "Sync paused, your entries are safe on this device" and resumes after the daily reset. Web shows "Service busy, try again later". |
| FR-OFF-08 | On sign-out of a linked Android user, call `clearPersistence()` (§14.6). |
| FR-OFF-09 | If a merge write fails partway, retained data in memory and on disk allows retry (§14.4). |
| FR-OFF-10 | Receipt uploads use an **offline upload queue** (tab 5). |
| FR-OFF-11 | Local notifications are scheduled on each Android device (tab 3). |
| FR-OFF-12 | Reads are cache-first wherever possible, and a refresh control pulls the latest data from the cloud (OQ-18). |
| FR-OFF-13 | If a queued write is later rejected, the item shows a warning and a Sync issues notice lists it with Retry or Discard. Permission-denied after removal uses the existing "You no longer have access to this vehicle" message (OQ-26). |
| FR-OFF-14 | Web detects being offline through the browser's online and offline events plus a write timeout (OQ-27). |

### 16.3 Sync propagation limits [Source]

- **Reminder edits by another member, and receipt sharing for new members, reach a phone only when the relevant app next opens** (tabs 3 and 6).
- Whether members can view other members' receipts inside the app depends on the `drive.file` spike in tab 6. The fallback is an **Open in Drive** button.
- `lastOdometer` is written in the same batch as the entry. It is the maximum.

### 16.4 Conflict resolution, merge strategy, and queue semantics

Firestore's own conflict behavior is not described in the source. The upload queue's semantics, retry policy and ordering are defined in tab 5. Offline conflict resolution between members, and the semantics of `lastOdometer` when multiple members write concurrently, are not specified (OQ-17).

**Decisions on offline and sync behavior (2026-10-06)**

- **Rejected queued writes (OQ-26):** see FR-OFF-13.
- **Web offline detection (OQ-27):** see FR-OFF-14.
- **Sign-out with pending writes (OQ-24):** see FR-OUT-04 and FR-OUT-05.
- **Cache-first reads (OQ-18):** see FR-OFF-12.

### 16.5 Acceptance criteria

- Vehicles can be added, edited, archived, and deleted offline on Android (AC-F2).
- Maestro covers airplane-mode logging (before each release).
- Repository tests cover reads, writes, validation and schema upgrades.

---

## 17. Navigation and UX Requirements

### 17.1 Navigation shell (FR-NAV) [Source]

The shell is a **vehicle-scoped** app with **four tabs and a single add button**. On wide web screens the same routes render with a side rail and dialog forms.

| ID | Requirement |
| --- | --- |
| FR-NAV-01 | **Top bar:** a vehicle switcher showing name, type icon and colour. |
| FR-NAV-02 | All tabs are scoped to the selected vehicle. The selection **persists across launches**. |
| FR-NAV-03 | **Tabs:** Dashboard, History, Reports, More. |
| FR-NAV-04 | **Add button** on Dashboard and History, opening a sheet with **Fuel, Expense, Service, Income, Trip, Inspection**. These are **placeholder screens in Foundation**. |
| FR-NAV-05 | **More** lists: Vehicles, Reminders, Checklists, Backup & export, Join a vehicle, Settings, Account, About & privacy. **Unbuilt items show "Coming soon".** |
| FR-NAV-06 | **Web at 768 px and wider:** tabs become a left navigation rail and forms open as dialogs. |
| FR-NAV-07 | Same routes on Android and web (Expo Router, file-based, with web URLs). |
| FR-NAV-08 | A first-time user sees "Add your first vehicle" instead of an empty dashboard. |
| FR-NAV-09 | **"All vehicles"** is an entry in the vehicle switcher. Choosing it changes only the Reports tab; the other tabs keep the last single vehicle. Archived vehicles are reachable through the include-archived toggle and More → Vehicles (OQ-49). |
| FR-NAV-10 | Web below 768 px uses the mobile layout (OQ-21). |

### 17.2 Navigation destinations and owning sub-project

| Destination | Owning sub-project |
| --- | --- |
| Dashboard | Shell in 1; content in 4 ("Reports and dashboard"), now defined in the Reports decisions (§23.4), including the "Upcoming & overdue" card, which needs tab 3 data (OQ-47) |
| History | Shell in 1; list in 2 |
| Reports | 4 |
| More → Vehicles | 1 |
| More → Reminders | 3 |
| More → Checklists | 7 |
| More → Backup & export | 5 |
| More → Join a vehicle | 6 |
| More → Settings | 1 |
| More → Account | 1 (account deletion: 8) |
| More → About & privacy | Shell in 1; policy content in 8 |
| Add sheet: Fuel, Expense, Service, Income, Trip | 2 |
| Add sheet: Inspection | 7 |

### 17.3 Vehicle switcher [Source]

Shows name, type icon and colour. Archived vehicles are hidden from it (§8.2). Switcher behavior is component-tested.

### 17.4 Empty and loading states

- **Empty state:** "Add your first vehicle" (Foundation).
- **Offline first launch:** "Connect to get started" with automatic retry.
- **Sync pending:** sync icon on items with pending writes.
- **Unbuilt feature:** "Coming soon".
- Other loading and empty state designs are not specified.

### 17.5 Platform UX [Source]

| Platform | UX |
| --- | --- |
| Android | Four tabs; add sheet; offline-capable; sync icon |
| Web ≥ 768 px | Left rail; dialog forms; online-only banner when offline |

Web below 768 px uses the mobile layout (decided, OQ-21). The rail and dialogs apply at 768 px and wider.

### 17.6 Accessibility [Source]

- Paper theming for **dark mode** and **system font scaling**
- **Tap targets of at least 48 dp**
- **Screen-reader labels on every icon-only button**

Manual release checklist: dark mode, font scaling.

### 17.7 UI toolkit

React Native Paper (Material 3, built-in theming and dark mode). NativeWind was rejected.

---

## 18. Settings and Localization

### 18.1 Settings (FR-SET) [Source]

| Setting | Default | Options |
| --- | --- | --- |
| Currency | INR | ISO 4217 list |
| Distance unit | km | km, mi |
| Volume unit | litres | litres, US gallons, UK gallons |
| Efficiency format | km/l | km/l, L/100 km, mpg |
| Date format | DD/MM/YYYY | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD |
| Theme | System | System, light, dark |
| Language | Device language if supported, else English | English only in v1 |
| Automatic Drive backup | Weekly | Daily, weekly, monthly, off (tab 5) |
| Mute reminders | Off | Per vehicle, on the vehicle's settings (tab 3); stored in each user's own settings, so muting a vehicle on one phone doesn't affect other members |

### 18.2 Functional requirements

| ID | Requirement |
| --- | --- |
| FR-SET-01 | Settings persist (in `users/{uid}.settings`) and drive all display. |
| FR-SET-02 | **Defaults apply to new vehicles and to display.** |
| FR-SET-03 | **Changing a default converts what is shown, never what is stored.** Unit settings convert distance and volume for display. The Currency setting only sets the default for new vehicles and how amounts are formatted; amounts are never converted between currencies (OQ-29). |
| FR-SET-04 | **Per-vehicle overrides** cover **odometer unit and currency**. |
| FR-SET-05 | Settings stored: `currency`, `distanceUnit`, `volumeUnit`, `efficiencyFormat`, `dateFormat`, `theme`, `locale`, `backupFrequency`, `mutedReminderVehicleIds` (tab 3). |
| FR-SET-06 | A new user's defaults are INR, km, litres, and the device language. |
| FR-SET-07 | Mute reminders is configured per vehicle, on the vehicle's settings, and stored as `mutedReminderVehicleIds` (tab 3). |

**Business rules.** Stored data is never rewritten by a settings change. Money stays in minor units with its own currency code. Odometer stays in the vehicle's unit. The vehicle's own currency and odometer unit lock once entries exist.

**Edge cases.** Distance unit options are `km` and `mi`, while a vehicle's `odometerUnit` also allows `hours`: entries use the vehicle's unit and display converts km and mi; distance-based metrics are hidden for `hours` vehicles (OQ-11). Totals across vehicles with different currencies are shown per currency, never converted (OQ-19). In an account merge the Google account's settings win (OQ-07). The Currency setting only sets the default for new vehicles and how amounts are formatted; it never converts amounts (OQ-29).

**Acceptance criteria.** AC-F5: settings for currency, units, efficiency format, date format, theme and language persist and drive all display.

### 18.3 Dependencies

`units.ts` and `money.ts` domain modules; React Native Paper theming; i18next + expo-localization.

### 18.4 Localization and i18n (FR-I18N) [Source]

| ID | Requirement |
| --- | --- |
| FR-I18N-01 | **India defaults:** INR, km, litres. |
| FR-I18N-02 | Currency and units are **configurable per user and per vehicle**. |
| FR-I18N-03 | **All text goes through i18n** (i18next + expo-localization). Translation-ready from day one. |
| FR-I18N-04 | **English only in v1.** |
| FR-I18N-05 | Language default: device language if supported, else English. |

i18n scaffolding is in Foundation scope.

---

## 19. Error Handling

### 19.1 Principle [Source]

Each failure type has one defined behavior, and no failure takes down more than one screen. Being offline on Android is a normal state, not an error.

### 19.2 Behavior table (FR-ERR) [Source]

| Failure | Android | Web |
| --- | --- | --- |
| Offline | Writes save locally and show a pending-sync icon | Banner; saving disabled, since unsynced web writes live only in memory |
| Daily quota exceeded (`resource-exhausted`) | "Sync paused, your entries are safe on this device"; resumes after the daily reset | "Service busy, try again later" |
| Permission denied | Owner: report as a bug. Member: "You no longer have access to this vehicle", then switch vehicle | Same |
| Malformed document (zod rejects it) | Skip that item, show "1 entry couldn't be shown", log a non-fatal with the document path | Same |
| Google sign-in cancelled | Silent | Silent |
| Sign-in network or unknown error | Message with Retry | Same |
| Account conflict on linking | Merge flow (§14.4) | Not applicable |
| Unhandled exception in a screen | Per-screen error boundary: "Something went wrong" with Retry | Same |
| A queued write is later rejected by the server | The item shows a warning, and a Sync issues notice lists it with Retry or Discard | Error message with Retry |
| Sign-out with unsynced writes | Offer Wait and sync, or Sign out and discard | Not applicable |

### 19.3 Crashlytics privacy rule [Source]

Reports carry **document ids, error codes and app state only**. **Never amounts, plates, names or notes.** Crashlytics reports crashes and non-fatal errors without personal data (AC-F7).

On web there is no crash reporting in v1 (accepted limitation, OQ-10); web shows the error boundary only.

### 19.4 Production signal

Any `resource-exhausted` non-fatal in production is the trigger to review Firestore usage. The project stays on the free Spark plan (decided, OQ-18), so a quota hit pauses sync until the daily reset. Firestore usage is also checked weekly in the Firebase console, because the free plan has no budget alerts.

### 19.5 Requirements

| ID | Requirement |
| --- | --- |
| FR-ERR-01 | Implement every row of the behavior table, with exactly the stated messages. |
| FR-ERR-02 | A **per-screen error boundary** wraps each screen, so no failure takes down more than one screen. |
| FR-ERR-03 | Malformed documents are skipped, not fatal. A **non-fatal with the document path** is logged. |
| FR-ERR-04 | A permission-denied error for an owner is reported as a bug. For a member, show the access message and switch vehicle. |
| FR-ERR-05 | Crashlytics privacy rule enforced (§19.3). |
| FR-ERR-06 | Sign-in cancellation is silent. |
| FR-ERR-07 | Offline on web disables saving, with a banner. |
| FR-ERR-08 | A queued write rejected by the server shows a warning on the item and a Sync issues notice with Retry or Discard (OQ-26). |
| FR-ERR-09 | Sign-out with unsynced writes offers Wait and sync, or Sign out and discard (OQ-24). |

### 19.6 Error states and acceptance

AC-F7: Crashlytics reports crashes and non-fatal errors without personal data. The per-screen error boundary shows "Something went wrong" with Retry.

---

## 20. Privacy Requirements

### 20.1 Requirements [Source unless noted]

| ID | Requirement |
| --- | --- |
| PRV-01 | **No ads, no ad SDK, no location permission.** |
| PRV-02 | **No broad media permission.** The system photo picker is used (`expo-image-picker`, `expo-document-picker`). The Android build strips `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE`. |
| PRV-03 | **Crashlytics only for anonymous crash reports**, with document ids, error codes and app state only. Never amounts, plates, names or notes. |
| PRV-04 | **No analytics in v1.** There is no analytics SDK (OQ-14). |
| PRV-05 | Files (receipts, backups) live in **the user's own Google Drive** under the `drive.file` scope. Firebase Storage is not used. |
| PRV-06 | Data is stored in Cloud Firestore. Security rules restrict reads to the user (own `users/{uid}`) and to vehicle members (§15). |
| PRV-07 | On sign-out of a linked Android user, `clearPersistence()` ensures the next person on the device sees nothing. |
| PRV-08 | Backup, sync, restore and export are free forever. Data is never paywalled. |
| PRV-09 | Receipts are shared through Drive permissions (tab 6), recorded per attachment in `sharedWithUids`. |
| PRV-10 | A **privacy policy and terms** are produced in tab 8 and linked from "About & privacy". |
| PRV-11 | **Account deletion** is provided in tab 8. |
| PRV-12 | The Google consent screen is configured in tab 8 using `milevana.poovarasu.dev`. |
| PRV-13 | Invite-code paths are redacted from crash reports, and the uid is not set as the Crashlytics user id. The privacy policy discloses the Crashlytics installation id (OQ-36). |
| PRV-14 | The privacy policy discloses that members see each other's names and emails, that a leaver's name stays on entries, and that entries logged on others' vehicles keep the user's name after account deletion (OQ-15, OQ-58, OQ-62). |
| PRV-15 | The removal confirmation and the privacy policy say that a removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground (OQ-56). |

### 20.2 Data and the user

| Topic | Source statement |
| --- | --- |
| Anonymous user who uninstalls | Loses data before linking Google or exporting CSV. The app says so plainly. |
| Persistent warning | "Your data isn't backed up" banner on More for anonymous users. |
| Orphaned documents | Abandoned anonymous accounts from merge leave documents that cannot be deleted without server code (a few KB per case). |
| Member data | Members' `name` and `email` are stored in the vehicle's `members` map. `createdByName` stays visible after a member leaves. |
| Merge retry data | Held in memory and on disk until the retry succeeds. |

### 20.3 Privacy decisions (2026-10-06)

- **Analytics:** none in v1 (OQ-14).
- **Crash reports:** invite paths redacted, uid not set as the user id, installation id disclosed (OQ-36).
- **Member data:** names and emails visible among members; a leaver's email is removed from `members` and their name stays on entries (OQ-58, OQ-15).
- **Orphaned anonymous documents** (L3) hold personal data with no deletion path. The source accepts this limitation, and the policy does not promise full deletion for them (OQ-62).
- **Merge retry data:** kept in app-private storage until success or discard (OQ-08).
- **Sign-out** clears the local state listed in FR-OUT-05 (OQ-24).
- **Backups** contain only the vehicles the user owns, with members by name only (OQ-53).
- **Play data-safety form and policy content:** see OQ-63 (verification pending).

---

## 21. Testing Strategy

### 21.1 Principle [Source]

Security rules and domain logic get the deepest coverage, because rules are the whole backend and domain functions hold the bug-prone calculations. **Domain code is written test-first.**

### 21.2 Test layers [Source]

| Layer | Tool | What it covers | Runs |
| --- | --- | --- | --- |
| Security rules | Firebase Emulator + `@firebase/rules-unit-testing` | Every row of the rules matrix, allowed and denied | Every push |
| Domain | Jest | Mileage (including bi-fuel and missed fills), money and unit conversion, serializer round-trips | Every push |
| Repositories | Jest + Firestore emulator, JS SDK | Reads, writes, validation and schema upgrades | Every push |
| Components | React Native Testing Library | Vehicle form validation, locked units, vehicle switcher | Every push |
| Android end-to-end | Maestro | First launch → add vehicle → change settings; link Google; airplane-mode logging | Before each release |
| Manual | Release checklist | Account-conflict merge, web smoke test, dark mode, font scaling | Before each release |

### 21.3 Requirements

| ID | Requirement |
| --- | --- |
| TS-01 | Every row of the rules matrix (§15.2) has an allowed and a denied test. |
| TS-02 | Tab 6 paths (invites, self-join, leave, remove, ownership transfer) each get their own adversarial tests. |
| TS-03 | Domain functions are test-first, covering mileage (including bi-fuel and missed fills), money and unit conversion, and serializer round-trips. |
| TS-04 | Repository tests cover reads, writes, validation and schema upgrades against the Firestore emulator via the JS SDK. |
| TS-05 | Component tests cover vehicle form validation, locked units, and the vehicle switcher. |
| TS-06 | Maestro flows: first launch → add vehicle → change settings; link Google; airplane-mode logging. |
| TS-07 | Manual release checklist: account-conflict merge, web smoke test, dark mode, font scaling. |

### 21.4 Coverage targets

No numeric coverage thresholds are specified in source (OQ-18).

### 21.5 Testing decisions (2026-10-06)

The review found gaps in the source's test plan. Decided (OQ-37):

| # | Gap | Decision |
| --- | --- | --- |
| 1 | The offline behaviour behind "Log anywhere" lives in the native adapter, but repository tests use the JS SDK | The native offline path is covered by the Maestro airplane-mode flow plus manual checks |
| 2 | The account-conflict merge is on the manual checklist only | Add an emulator integration test for the merge write path, in addition to the manual check |
| 3 | Maestro "link Google" needs a real Google sign-in | Link Google stays a manual test with a test Google account |
| 4 | No test for rejected queued writes, quota exhaustion, merge resume, or sign-out with pending writes | Add tests for each (FR-OFF-13, FR-OUT-04, FR-MERGE-10) |
| 5 | Rules tests are "every row" with no field-level inventory | The inventory is built from the rules in §15.3 (FR-SEC-09 to FR-SEC-13), including the `lastOdometer` exception and `createdBy` immutability |
| 6 | Batch-of-500 behaviour against the rules is untested | Covered by the G3 spike, then kept as a test |
| 7 | Web has a manual smoke test only | Unchanged: manual smoke test before each release |

---

## 22. CI/CD and Deployment

### 22.1 CI [Source]

**GitHub Actions** runs **lint, typecheck, unit, repository and rules tests on every push**.

### 22.2 Build and release [Source]

| Item | Detail |
| --- | --- |
| Android builds | **EAS Build** produces an Android build **on tagged releases**. Native modules require development builds. |
| Pre-release checks | Maestro end-to-end and the manual release checklist run before each release. |
| Play distribution | Play closed testing (12+ testers for 14 days), then production access (tab 8). Starts after tab 2. |
| Web deployment | **Firebase Hosting** at `milevana.poovarasu.dev` (free tier; custom subdomain of the portfolio domain). Deployment is part of tab 8. |
| Fallback address | `<project-id>.web.app` (needs the Firebase project id; OQ-03). |
| Cost | Play one-time US$25 registration; everything else free tiers or the existing domain. |
| Updates | **No over-the-air code updates** in v1. |

### 22.3 Release essentials (sub-project 8) [Source]

Play closed testing and production access, account deletion, privacy policy and terms, Play listing, the Google consent screen, and web deployment at `milevana.poovarasu.dev`.

### 22.4 Constraints

- The Android package id `dev.poovarasu.milevana` cannot change after the first Play Store release.
- Play testing requirements for new personal accounts apply (source cites Play's policy page).
- Deploy pipeline details beyond those above (branching, signing, environments) are not specified in the source; decided in §22.5.

### 22.5 CI/CD and release decisions (2026-10-06)

Decided (OQ-38):

- One production Firebase project, with the emulator for tests. There is no separate staging project.
- Security rules and Firestore indexes deploy on tagged releases.
- Secrets (`google-services.json`, signing keys) live in GitHub and EAS secrets.
- EAS Submit publishes builds to Play.
- Hosting deploys from CI.
- Release flow: EAS Build, internal testing, closed testing (the 12-tester gate), production.
- Which Play Console declarations are needed before the closed test: a minimal privacy policy URL, data-safety form and store listing are prepared just before the first closed-test upload (OQ-16). What Play requires is verification pending **[External — verify]**.

---

## 23. v1 Sub-Projects

Each sub-project below records everything the source states. For sub-projects 2–8, "Defined in tab N" marks content the source does not provide.

### 23.1 Sub-project 1 — Foundation (fully specified)

**Purpose.** Deliver an installable Android app and a web app where a user can start anonymously, link Google, and manage vehicles and settings. Every later tab builds on it without data migrations.

**In scope**

- Project setup
- Both Firebase adapters
- Repositories with validation
- The complete Firestore schema and rules
- The auth and linking flows
- The Android welcome screen
- The navigation shell with placeholder entry screens
- Vehicle management
- Settings
- i18n scaffolding
- Error boundaries
- Crashlytics
- CI
- The shared export/import serializer used by account merge

**Out of scope.** Entry forms (2), reminders (3), reports (4), Drive scope request (5), invite flows (6), checklists (7), account deletion (8).

**User behavior.** Install → add the first vehicle (Android, no sign-in) or sign in with Google (web) → manage vehicles and settings → optionally link Google.

**Functional requirements.** §8.2–§8.5, §14–§19.

**Business rules.** §4, §8.2, §13.4, §15.

**Edge cases.** §8.2, §14.4, §19.

**Dependencies.** None; it is the root. It requires the Firebase project id (OQ-03).

**Acceptance criteria.** §25.1 (AC-F1 to AC-F7).

**Technical constraints.** §11–§13, §15.

### 23.2 Sub-project 2 — Logging

**Purpose.** Deliver a usable personal app: log fuel and EV charging, expenses, services, income and trips, and browse them in History. A usable personal app exists after tab 2, and the Play closed test starts then.

**Scope (source).** Fuel and EV charging with mileage, expenses, services with line items, income, manual trips, and the History list.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Entry collection | One `entries` collection under each vehicle with `type` (`fuel`, `expense`, `service`, `income`, `trip`; `inspection` belongs to tab 7). |
| Common entry fields | `date`, optional `odometer`, `amount: { minor, currency }`, optional `notes`, optional `category`, `attachments[]`, audit fields, `details`. |
| Fuel details | `fuelType`, `quantity`, `quantityUnit` (L, gal_us, gal_uk, kg, kWh), `pricePerUnitMilli`, `fullTank`, `missedPrevious`, plus optional `stationName` and `chargingLocation` (see Appendix E). |
| Service entries | One `service` entry per garage visit, with line items. Each line has a service type and its cost; the entry total is the sum of the lines, plus optional labour and discount. This matches how the bill is actually paid, keeps one receipt photo per bill, and the History list shows one row per garage visit. Reminders (tab 3) can still trigger per service type, for example "oil change every 10,000 km", by looking inside the line items. The field shapes are approved in Appendix E (OQ-41). |
| Fuel entry input | Enter any two of price per unit, quantity and total; the app calculates the third. **Odometer is required** for fuel entries. "Full tank" is on by default. "Missed previous fill-up" is a toggle. Station name is optional free text, with no GPS. |
| EV charging | Records kWh and cost, with home or public charging as a field. |
| Mileage | Bi-fuel and EV mileage is calculated **per fuel type, only between two consecutive full fills of that same fuel**. For bi-fuel vehicles (petrol + CNG) the **headline figure is cost per km**, because running on both fuels distorts per-fuel mileage. |
| Expense categories | Insurance, road tax, FASTag/toll, parking, fine/challan, PUC certificate, registration/permit, loan EMI, cleaning, accessories, plus "Other" with free text. |
| Service categories | General service, engine oil, oil filter, air filter, brake pads, tyres, battery, coolant, wheel alignment/balancing, clutch, AC service, plus "Other" with free text. It is the service type of each line item, and each service entry also picks one as its entry category (OQ-43). |
| Income categories | Ride-hailing, delivery, rental, reimbursement, plus "Other" with free text; with an optional platform name (Uber, Ola, Rapido, Swiggy, Zomato and so on suggested, but free text). |
| Trips | Start and end date/time, and start and end odometer, with distance calculated. From/to as text. Purpose: business or personal. An optional reimbursement rate per km gives a calculated reimbursement amount. **Trips don't create income entries automatically; reports show reimbursements separately.** A trip has no `amount`, the rate is per the vehicle's odometer unit, and the reimbursement is computed in `details` (OQ-42). |
| Odometer sanity checks | **Warn, don't block**, when a reading is lower than an earlier entry's or higher than a later one's. Typos happen, but so do genuine back-dated entries. |
| History | One list across all types, **newest first**. Filters by type and date range. Search across notes and categories. Tap to edit. Delete with an **Undo** option. Mechanics are decided in OQ-45. |
| Left out of Logging | Payment method, GPS location for fuel stations, and recurring expenses like monthly EMI auto-entries. Recurring expenses fit better with Reminders (sub-project 3). |
| Fuel logic | `domain/fuel.ts`: "two-of-three input" and mileage per fuel type. Mileage tests include bi-fuel and missed fills. |
| Categories | Fixed India-friendly lists (listed above) plus free-text "Other". The category name is copied onto each entry. |
| `lastOdometer` | Updated in the same batch as the entry, taking the maximum. |
| Entry rules | Members create (`createdBy` = self). Creator or owner updates and deletes. |
| Navigation | Add button sheet entries Fuel, Expense, Service, Income, Trip. The History tab. |
| Offline | Works offline on Android with the sync icon. |

**Further decisions (2026-10-06)**

- **OQ-30, Fuel details shape:** `quantityUnit` is L, gal_us, gal_uk, kg or kWh. Price per unit is stored as an integer in thousandths of a minor unit (`pricePerUnitMilli`). The total stays in integer minor units, so the "any two of three" input round-trips.
- **OQ-41, Service entries:** Up to 5 attachments per entry is decided. Each service entry also has one entry category from the Services list (see OQ-43). `attachments[].itemId` is used for inspection item tags only. The line, labour, discount and stored-total shapes are in "Schemas" (approved on 2026-10-06).
- **OQ-42, Units in Logging:** CNG shows km/kg and EV shows km/kWh (mi/kg and mi/kWh for mile-based vehicles), fixed per fuel unit and not user-selectable. Petrol and diesel follow the Efficiency format setting. The trip reimbursement rate is per the vehicle's odometer unit (per km, per mi). A trip has no `amount`, and its reimbursement is computed in `details`.
- **OQ-43, Service types and category:** The Services list is the service type of each line item (plus "Other" with free text). Each service entry also picks one entry category from the same list.
- **OQ-44, Reimbursement:** Trip-calculated reimbursement is shown only in the Trips section and is excluded from cost and from net profit. An income entry categorised "reimbursement" is ordinary income and counts toward profit.
- **OQ-45, History mechanics:** Delete uses a delayed delete: the entry disappears from History at once, and the real delete and the Drive file deletion happen after a 5-second Undo window. No soft delete is stored. Search and filters run on the device over loaded entries (notes, categories, line-item types). Other members' entries are read-only.

**Business rules.** Money in integer minor units. Odometer in the vehicle's unit. Entries by shared members show `createdByName`. Odometer is required for fuel entries; the schema keeps `odometer?` optional for entries in general, and other types do not require it. A service visit is one entry (one History row), with its total made up of line items plus optional labour and discount.

**Dependencies.** Foundation.

**Acceptance criteria.** Defined in tab 2. Maestro covers airplane-mode logging.

**Field shapes.** Approved in Appendix E on 2026-10-06 (tab 2).

### 23.3 Sub-project 3 — Reminders

**Scope (source).** Date and odometer reminders, auto-complete from matching entries, km-per-day prediction, local notifications, and per-vehicle mute.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Storage | `vehicles/{id}/reminders/{reminderId}`. Rules: members read, create, update and delete. |
| Domain | `domain/reminders.ts`: status, auto-complete, km-per-day prediction. |
| Notifications | `expo-notifications`: local, inexact; no exact-alarm permission. Scheduled on each Android device (`data/notifications/`). None on web. |
| Who is notified | **All members** of a vehicle are notified. |
| Mute | Each member can mute a vehicle. Default Off. The mute is stored in **each user's own settings** (`users/{uid}.settings.mutedReminderVehicleIds`), so muting the family car on your phone doesn't affect anyone else. Set per vehicle, on the vehicle's settings. |
| Odometer input | `lastOdometer` on the vehicle serves reminders. |
| Propagation | Reminder edits by another member reach a phone only when the app next opens (L5). |
| Web | Reminders can be viewed and edited, but notifications only come on phones. |

**Decisions recorded for tab 3** (`requirements.md`, "Reminders: decisions for tab 3"). The exact reminder schema is still defined in tab 3.

| Topic | Decision |
| --- | --- |
| Triggers | By date, by odometer, or both (whichever comes first). Each is either one-off or repeating, for example every 12 months and/or every 10,000 km. |
| What a reminder is about | A service type (for example engine oil), an expense category (insurance, road tax, PUC, loan EMI), or a custom title. |
| Auto-complete | Logging a matching entry (a service line item of that type, or an expense in that category) marks the reminder done. A repeating reminder then rolls forward from that entry's date and odometer. This also settles what "matching" means for service types (see OQ-41). |
| Manual actions | "Mark done" and "Snooze" are available. |
| Odometer prediction | Average km per day from the last 90 days of readings; needs at least 2 readings spanning 7 days. With enough data, the app predicts a due date. Without it, it shows "due in 1,200 km" and notifies only once a logged reading crosses the threshold. |
| Notification timing | 7 days before and on the due date, at 9 AM. For odometer reminders, when predicted to be within 500 km. Both lead times are adjustable per reminder. |
| Scheduling on the phone | Notifications are rescheduled whenever the app opens, a reminder changes, or an entry is logged. |
| Permission | The Android 13+ notification permission is asked when the user creates their first reminder, not at install. |
| Quick-add suggestions | Chips such as "Insurance renewal", "PUC expiry" and "Service every 10,000 km / 12 months" appear on the Reminders screen. Nothing is auto-created. |
| Recurring payments such as EMI | A repeating date reminder with an amount. Tapping the notification opens a pre-filled expense form. The app never logs anything without the user. Recurring auto-entries remain out of v1. |
| Dashboard | An "Upcoming & overdue" card sorted by urgency. Overdue reminders stay until done or snoozed. The card ships with sub-project 3 (OQ-47). |

**Further decisions (2026-10-06)**

- **OQ-46, Reminder behaviour:** Snooze offers tomorrow, in 3 days, or next week, and is per user, stored on the device. Mute silences phone notifications only. An odometer reminder with no prediction notifies when a reading is within the lead distance (500 km). The 90-day window uses entry date. 9 AM is device local time, and if notification permission is denied, reminders still appear in the app. When a repeating reminder has both triggers, both roll forward from the completing entry. Members on web get no notifications, as intended.
- **OQ-47, Dashboard card:** The Upcoming & overdue card ships with sub-project 3. Overdue reminders come first, then soonest due. Odometer reminders without a prediction rank after dated ones.

**Dependencies.** Foundation; Logging (entries to match for auto-complete, and the odometer).

**Acceptance criteria.** Defined in tab 3.

**Field shapes.** Approved in Appendix E on 2026-10-06 (tab 3).

### 23.4 Sub-project 4 — Reports and dashboard

**Scope (source).** Per-vehicle and All vehicles reports, financial-year ranges, cost and profit metrics, and charts.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Domain | `domain/reports.ts`: metric definitions and report sections. |
| Charts | `react-native-gifted-charts`: SVG-based, the same charts on Android and web. Tapping a chart point shows its value. |
| Archived vehicles | Archived vehicles' entries are kept for lifetime reports. |
| Profit | Gig and rideshare drivers need real profit figures. |
| Cost per km | The headline figure for bi-fuel vehicles (decided in Logging, §23.2). |
| Reimbursements | Trips don't create income entries; reports show reimbursements separately (decided in Logging). Decided in OQ-44. |
| Out of scope | PDF or image export of reports is not in v1. CSV export in sub-project 5 covers taking the data elsewhere. |

**Decisions recorded for tab 4** (`requirements.md`, "Reports and dashboard: decisions for tab 4").

| Topic | Decision |
| --- | --- |
| Scope of reports | **Per-vehicle reports plus an "All vehicles" view.** In "All vehicles", **totals are shown per currency and never converted, and mileage stays per vehicle.** This settles the currency part of OQ-19. |
| Archived vehicles in "All vehicles" | Left out by default, with a toggle to include them. |
| Time ranges | This month; last 3 months; last 12 months; this financial year (April–March, useful for Indian tax and reimbursement claims); all time; custom. |
| Report layout | One scrolling Reports tab. |
| Overview | Total cost, cost per km, cost per day, distance driven, and a split by type (fuel, service, expense). |
| Monthly spend | Stacked bars per month by type. |
| Fuel | A mileage trend per fuel type, a fuel price trend, and fuel cost per km. For EVs, home vs public charging cost. |
| Services & expenses | Totals by category, and service history by type. |
| Income & profit | Shown only when the vehicle has income entries. Income vs cost per month, net profit, profit per km, and income by platform. |
| Trips | Business vs personal distance, and total reimbursement. |
| Distance for a period | The last odometer reading in the period minus the last reading before it. |
| Cost per km | Total costs ÷ that distance. Costs exclude income and trip reimbursements. |
| Computation | Done on the device from the vehicle's entries, loaded once and kept until they change. The "All vehicles" view loads each vehicle in turn. |
| Dashboard (per vehicle) | Last mileage; this month's spend; 90-day cost per km; the Upcoming & overdue reminders card; the 5 most recent entries; for gig drivers, this month's income vs cost. |

**Further decisions (2026-10-06)**

- **OQ-19, All vehicles distance:** Totals are per currency and never converted. Distance and cost per km are shown per odometer unit.
- **OQ-48, Report calculations:** The vehicle's starting odometer and a trip's start and end odometers count as readings. All-time distance is the last reading minus the starting odometer. Cost per day uses the period length (all time starts at vehicle creation). A bi-fuel Dashboard shows cost per km instead of last mileage. A gig-driver view means the vehicle has income entries. Net profit excludes trip reimbursements.
- **OQ-49, Where "All vehicles" lives:** "All vehicles" is an entry in the vehicle switcher that changes only the Reports tab. The other tabs keep the last single vehicle. Archived vehicles are reachable through the include-archived toggle and More → Vehicles.

**Dependencies.** Foundation; Logging (data to report on).

**Acceptance criteria.** Defined in tab 4.

**Field shapes.** None beyond the entry shapes. Metric definitions are in the decisions above.

### 23.5 Sub-project 5 — Drive and export

**Scope (source).** Drive backup and restore, receipt photos and PDFs with an offline upload queue, and CSV export.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Storage | The user's own Google Drive (`drive.file` scope). Firebase Storage needs the paid Blaze plan, so it is not used. |
| Auth | Linking Google is a required step before Drive backup or receipt photos. The `drive.file` scope is requested incrementally in tab 5; the OAuth client is configured in Foundation. Native uses `@react-native-google-signin/google-signin`; web uses Google Identity Services. |
| User doc | `drive`: `rootFolderId`, `backupsFolderId`, `receiptsFolderId`, `lastBackupAt`, `lastBackupFileId`. |
| Backup | Manual plus automatic when stale. Setting default weekly; options daily, weekly, monthly, off. |
| Serializer | `src/data/serializer/` is shared by account merge, Drive backup and restore. |
| Attachments | `attachments[]`: `id`, `ownerUid`, `mimeType`, `sizeBytes`, `status`, optional `driveFileId`, `sharedWithUids`, optional `itemId`. |
| Pickers | `expo-image-picker` (system photo picker) and `expo-document-picker`. No broad media permission. |
| Code | `data/drive/`: `driveClient.native.ts`, `driveClient.web.ts`, the upload queue. |
| Free forever | Backup, restore and export are never paywalled. |
| Menu | More → "Backup & export". |

**Decisions recorded for tab 5** (`requirements.md`, "Drive and export: decisions for tab 5"). The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-` (OQ-50).

| Topic | Decision |
| --- | --- |
| Backup format | One readable JSON file named like `milevana-backup-2026-10-05-0930.json`. It includes a format version, the user's settings, the vehicles they own, and all their entries, reminders and checklist templates. Vehicles shared with them but owned by someone else are not included, and members of their vehicles appear by name only. Roughly 1 MB for years of data. |
| Drive layout | The app creates a folder in the user's Drive containing `Backups/` and `Receipts/<vehicle name>/`. The app can only see files it created there. |
| Automatic backup | When the app opens, if the last backup is older than the chosen frequency (daily, weekly by default, monthly, or off). Linked accounts only. Runs on any network. This settles how "when stale" is triggered (OQ-13). |
| Retention | The last 10 automatic backups are kept and older ones deleted. Manual backups are kept until the user deletes them. |
| Backup & export screen | Last backup time, "Back up now", "Restore", and the frequency setting. Backup and restore work on web too. |
| **Restore** | **Restores what's missing, asks about the rest, and only ever touches vehicles the user owns.** |
| Adding attachments | Camera, gallery, or a PDF from files. **Up to 5 per entry.** Photos are compressed to about 1600 px on the long edge (roughly 200–400 KB each). PDFs up to 5 MB. |
| Attachments offline | The entry saves immediately. Attachments wait in a local queue until online, then upload. |
| Attachment cleanup | Deleting an entry or an attachment also deletes the Drive file, if the user uploaded it. If the file was deleted in Drive, the app shows "File no longer in Drive". |
| Attachment errors | A full Drive storage shows a clear message, and the entry keeps the photo queued. |
| Attachment visibility | Until sub-project 6, only the uploader sees their photos on shared vehicles. |
| CSV scope | One combined CSV per vehicle (or all vehicles), for a date range, with common columns plus type-specific ones. |
| CSV content | Service line items are flattened into one cell (for example "Engine oil: 1200; Air filter: 400"). Amounts are plain decimals with the currency in its own column, and decimal digits follow each currency. Labour and discount have their own columns. UTF-8 with a byte-order mark, so Excel shows ₹ correctly. |
| CSV delivery | Through the Android share sheet or a browser download. No Google account is needed, so anonymous users can also take their data out. |
| Drive permission | Requested the first time a Drive feature is used, with a one-line explanation first. If declined, everything else keeps working. |

**Further decisions (2026-10-06)**

- **OQ-13, Automatic backup trigger:** Automatic backup runs when the app opens, if the last backup is older than the chosen frequency. Linked accounts only. It runs on any network.
- **OQ-50, Drive names:** The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-`.
- **OQ-51, Delete, Undo and Drive cleanup:** Entry deletion deletes the Drive files after the Undo window (see OQ-45). Deleting a vehicle deletes the receipt files the user uploaded and that vehicle's receipt folder, after the typed-name confirmation. Files uploaded by other members stay in their own Drives. For account deletion, receipts stay in the user's Drive.
- **OQ-52, CSV details:** Amounts are plain decimals with a Currency column, and decimal digits follow each currency. Labour and discount have their own columns. The file is UTF-8 with a byte-order mark.
- **OQ-53, Backup and restore:** Items in the backup that no longer exist are restored. Where a vehicle exists but differs, the app asks once per vehicle: keep current or replace with the backup's copy. The summary warns that entries deleted on purpose after the backup will return. Settings are not restored unless ticked. Restore lists backups with the latest preselected. Backups contain settings and owned vehicles only, with their entries, reminders and checklist templates. Members of an owned vehicle appear by name only, with no emails. Automatic backup stays off until Drive access has been granted once.
- **OQ-54, Drive details:** Per-vehicle receipt folder ids are stored in the user's own settings, so renames do not move folders. Android and web use one Google project so `drive.file` visibility can be verified. The camera permission is accepted and declared.

**Dependencies.** Foundation (serializer, OAuth client); Logging (entries); linking.

**Acceptance criteria.** Defined in tab 5.

**Field shapes.** The backup file and CSV columns are approved in Appendix E (tab 5).

### 23.6 Sub-project 6 — Sharing

**Scope (source).** Invite codes and links, owner and member roles, leave, remove and ownership transfer, and receipt sharing on Drive.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Roles | Owner and member roles in the vehicle's `members` map (`role`, `name`, `email`, `joinedAt`, optional `inviteCode`). `memberIds` supports "my vehicles". |
| Invites | `invites/{code}` collection. Invite links use `milevana.poovarasu.dev`. More → "Join a vehicle". |
| Rules | Rules for `invites/{code}` and the vehicle self-join, leave, remove and ownership-transfer paths are defined here, each with adversarial tests. Entry updates for `attachments[].sharedWithUids` reuse the creator-or-owner rule. |
| Receipt sharing | Through Drive permissions, recorded in `sharedWithUids`. Share sync in `data/drive/`. |
| Leave | `createdByName` keeps the member's name visible on entries after they leave. |
| Requirement | Linking Google is a required step before sharing. |
| Limitations | Receipt sharing for new members reaches a phone only when the relevant app next opens. Whether members can view other members' receipts inside the app depends on the `drive.file` spike; the fallback is an Open in Drive button. |

**Decisions recorded for tab 6** (`requirements.md`, "Sharing: decisions for tab 6").

| Topic | Decision |
| --- | --- |
| **Receipt photos on shared vehicles** | **Auto-shared with members. Access catches up whenever each uploader's app next opens.** |
| Invite creation | The owner taps "Invite" and gets a short code (for example K7QX-M2PA) plus a link, sent via WhatsApp or the share sheet. |
| Invite link | With the app installed, the link opens the join screen. That needs **Android App Links verified on the Firebase Hosting domain**. Otherwise the link opens a **web join page**. The code can also be typed under More → Join a vehicle. |
| Invite rules | Single-use. Expires in 7 days. The owner can see and cancel pending invites. |
| Joining | Requires a Google-linked account, so anonymous users are walked through linking first. No server: the rules let a user add themselves only if a valid, unused invite for that vehicle exists, and the same write marks the invite used. |
| Member role | Sees everything, logs entries, edits their own entries, manages reminders, and can leave the vehicle. |
| Owner role | Also edits the vehicle, invites, removes members, archives or deletes the vehicle, and transfers ownership to a member. Transfer is also what account deletion (tab 8) relies on. |
| Member limit | Up to 10 members per vehicle, which keeps photo sharing and rule checks light. |
| Leaving or removal | Past entries stay, labelled "Logged by Priya". Receipts that person uploaded stay visible to remaining members until they delete them. |
| Photo sharing mechanics | Each attachment records which members it is shared with. On every app open, the phone checks the receipts the user uploaded to shared vehicles. It adds Drive read access for new members and removes it for removed ones. Other members see "Shared once Priya opens the app" until then. |
| Visibility | Shared vehicles show a people icon and member count. History rows show who logged each entry. Members can see each other's names and Google emails. |
| Propagation | No server push. Joining, removals and new entries show up when each person next opens the app or their listeners are running. |
| Rules | Foundation security rules are updated for invite validation, self-join, self-leave, ownership transfer, and recording which members each receipt is shared with. |

Whether members can **view** each other's receipts inside the app still depends on the `drive.file` spike (L6, DD-06). Auto-sharing grants Drive access, but in-app viewing is not guaranteed by it.

**Further decisions (2026-10-06)**

- **OQ-55, Invites, joining and roles:** The 10-member limit includes the owner and is enforced in rules. An owner must transfer ownership or delete the vehicle rather than leave. The invite document carries the vehicle name and owner name for the join screen. Codes are 8 characters from an unambiguous alphabet. Archiving hides the vehicle for all members, and only the owner can unarchive it.
- **OQ-56, Receipt access catch-up:** Revocation is delayed until the uploader's app opens or returns to the foreground, and the removal confirmation and the privacy policy say so. Revocation reads the file's Drive permission list. Members who join later cannot see receipts from a member who left, and an uploader who is neither the entry's creator nor the owner cannot update sharing; both are accepted limitations. Entries gain an `uploaderUids` array so a phone can find the receipts it uploaded.
- **OQ-58, Member data:** The privacy policy discloses that members see each other's names and emails. A leaver's email is removed from `members`, and their name stays on entries.

**Dependencies.** Foundation (data model, vehicle rules, membership); Drive and export (Drive client, `drive.file`); linking.

**Acceptance criteria.** Defined in tab 6.

**Field shapes.** The invite shape and rules are approved in Appendix E (tab 6).

### 23.7 Sub-project 7 — Checklists

**Scope (source).** Per-vehicle templates with starters, inspection runs, and copy between vehicles.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Storage | `vehicles/{id}/checklistTemplates/{templateId}`, stored per vehicle (not on the user record). |
| Rules | Members read, create and update, with at most 50 items per template. The creator or owner deletes. |
| Inspection entries | Entry `type: inspection` (`details` defined in tabs 2 and 7). |
| Navigation | Add sheet "Inspection" and More → "Checklists". |
| Related | Account merge copies checklist templates. Vehicle delete removes them. |
| Out of scope | Scheduled inspections are not in v1. |

**Decisions recorded for tab 7** (`requirements.md`, "Checklists: decisions for tab 7").

| Topic | Decision |
| --- | --- |
| **Where templates live** | **Per vehicle, with copy to another vehicle.** The data model already stores them under each vehicle, so no data-model change is needed. |
| Template size | A name and a list of items, up to 50 items per template and **20 templates per vehicle**. The limit is enforced by the app only, because rules cannot count documents (OQ-59). |
| Items | A short label such as "Tyre pressure", with optional grouping such as "Tyres", "Lights" or "Documents". |
| Starter templates | Offered when the vehicle has none yet. **Car pre-trip:** tyre pressure and tread, lights and indicators, brakes, horn, wipers, engine oil, coolant, brake fluid, mirrors, documents (RC, insurance, PUC, licence). **Two-wheeler:** tyres, chain lubrication and tension, brakes, lights, horn, mirrors, fuel, documents. **Long trip:** spare tyre and jack, toolkit, first-aid kit, fluids, battery, AC, FASTag balance. |
| Running an inspection | Pick a template, then tap Pass / Fail / N/A per item, with an optional note on any item. Odometer is optional. |
| Photos | Attach to the inspection like any entry, up to 5, through Drive. **Each photo can be tagged with the item it shows.** This is what `attachments[].itemId` is for (see OQ-41, OQ-60). |
| Saving | The result is an inspection entry in History, storing a **snapshot** of the item labels and results. Editing or deleting the template later never changes past inspections. History shows a badge such as "2 issues". |
| Failed items | The summary screen lists them, each with "Create reminder" (title pre-filled) and "Log service" shortcuts. Nothing is created automatically. |
| Permissions | Any member can run inspections and create or edit templates, like reminders. Deleting a template is limited to its creator or the owner. |
| Copy | "Copy to another vehicle" lists every vehicle the user is a member of. |
| Not in v1 | Checklist-specific reports. Scheduled inspections (a custom repeating reminder covers "inspect weekly"). Number or text item types; only pass/fail/N/A with notes. |

**Further decisions (2026-10-06)**

- **OQ-59, 20 templates per vehicle:** Enforced by the app only, because rules cannot count documents. A copy to a vehicle that is full is blocked.
- **OQ-60, Checklist details:** Snapshot items get stable ids. Starters are offered by vehicle type (car, truck, bus and other: Car pre-trip and Long trip; bike and scooter: Two-wheeler and Long trip), and the user can pick any. The copy list excludes archived vehicles. Inspections have no `amount`. Search does not cover item notes. Rules cap text lengths.

**Dependencies.** Foundation; Logging (entries).

**Acceptance criteria.** Defined in tab 7.

**Field shapes.** The template and inspection shapes are approved in Appendix E (tab 7).

### 23.8 Sub-project 8 — Release

**Scope (source).** Play closed testing and production access, account deletion, privacy policy and terms, Play listing, the Google consent screen, and web deployment at `milevana.poovarasu.dev`.

**What the source already fixes**

| Item | Detail |
| --- | --- |
| Play gate | Closed test: 12+ testers for 14 days. It starts after tab 2. |
| Cost | One-time US$25 Play registration. Everything else on free tiers or the existing portfolio domain. |
| Account deletion | Designed with sharing. Uses only the existing paths; no extra rule is needed. |
| Web | Firebase Hosting at `milevana.poovarasu.dev`. The Google consent screen uses this address. |
| Identity | Package id `dev.poovarasu.milevana`, permanent after first release. |
| Release testing | Maestro and the manual checklist before each release. |

**Decisions recorded for tab 8** (`requirements.md`, "Release: decisions for tab 8"). The domain, welcome screen and timeline questions are decided (OQ-61).

| Topic | Decision |
| --- | --- |
| Play gate details | Personal developer accounts created after November 13, 2023 must run a closed test per app before production. At least 12 testers stay opted in for 14 continuous days. After the 14 days, the developer must also answer Google's questions about the test before production access is granted. |
| Timeline | The closed test starts as early as sub-project 2, and the remaining sub-projects ship to testers as updates, so it runs in parallel and the wait after the app is finished is Google's production-access review. Recruit 15–20 friends or family so one dropout doesn't reset the clock. |
| **Shared vehicles on account deletion** | **Shared vehicles you own go to a member, with a choice per vehicle. Vehicles only you use are deleted, and your receipts stay in your Drive.** |
| In-app deletion flow | Settings → Account → Delete account. A summary screen first, with "Back up / export first" offered: what gets deleted, which shared vehicles go to whom (changeable), which memberships you will leave, and a link to your Drive folder. Then Google re-sign-in (which Firebase requires before deleting an account) and typing DELETE to confirm. |
| Resumable | Progress is recorded, so an interrupted deletion resumes on next launch. |
| Web deletion | A `/delete-account` page on the web app runs the same flow, because Play also requires a deletion route outside the app. |
| Anonymous users | "Delete all my data" works without re-sign-in. |
| Policies | Privacy policy and short terms at `/privacy` and `/terms` on Firebase Hosting. They state what is collected (Google name and email, vehicle data, crash diagnostics), how Drive access is used, no ads and no selling, and how deletion works. They also include the Google API "Limited Use" statement that Drive access requires. |
| Play listing | Category Auto & Vehicles. Audience 18+, which keeps the app clear of children's-app policies. Phone screenshots and a feature graphic. |
| Data-safety form | Account info, app content and crash logs; encrypted in transit; deletable; not shared; no ads. |
| Google consent screen | To show the app name and logo when users grant Drive access, Google will likely want a verified domain, which a free Firebase `.web.app` address can't provide. The exact requirement is confirmed at the start of this sub-project. |
| First launch (Android) | One welcome screen ("Free. No ads. Your data stays yours." then Get started), then straight to adding a vehicle. |
| Web landing page | A landing page with comprehensive content and screenshots at the web root, before sign-in. The content and screenshots are to be supplied. |
| Launch polish | App icon, adaptive icon and splash screen. |
| Web deploy | The Expo web build on Firebase Hosting, plus `/join/:code`, `/delete-account`, `/privacy`, `/terms`, and the Android App Links verification file. `/join/:code` and the App Links file are deployed at the start of sub-project 6 (OQ-57). |
| Release flow | EAS Build → internal testing → closed testing (the 12-tester gate) → production. |
| Updates | Through Play only. No over-the-air code updates in v1. |
| Usage monitoring | Firestore usage is checked weekly in the Firebase console, since the free plan has no budget alerts. |

**Further decisions (2026-10-06)**

- **OQ-15, Member data on account deletion:** Entries logged on other members' vehicles keep the user's name after account deletion (see OQ-62). The user's email is removed from `members` when they leave. The privacy policy discloses this.
- **OQ-16, Play items before the closed test:** A minimal privacy policy URL, data-safety form and store listing are prepared just before the first closed-test upload. The full sub-project 8 work follows.
- **OQ-28, Consent screen and testers:** The consent screen is published with basic sign-in scopes before the closed test, and `drive.file` is added in sub-project 5. Verify with an account that is not a listed test user (gate G6).
- **OQ-57, Hosting timing:** Sub-project 6 deploys Hosting at `milevana.poovarasu.dev` with `/join/:code` and the Android App Links file at its start. Sub-project 8 then adds `/privacy`, `/terms`, `/delete-account` and the landing page.
- **OQ-61, Domain, welcome screen, timeline:** Keep `milevana.poovarasu.dev`; no new domain is bought. Android shows one welcome screen ("Free. No ads. Your data stays yours." then Get started) before adding the first vehicle, and web has a landing page with comprehensive content and screenshots. The closed test starts after sub-project 2 and runs in parallel with sub-projects 3 to 7, so the wait after the app is finished is Google's production-access review.
- **OQ-62, Account deletion:** For each shared vehicle the user owns, the summary pre-selects the longest-standing member as the new owner. The user can pick another member or delete that vehicle instead, and the new owner needs no acceptance. Entries logged on vehicles the user leaves keep the user's name. Progress is stored on `users/{uid}`. Data is deleted first and the Firebase account last, and resuming needs a fresh re-sign-in. Anonymous users can delete in-app only. The policy states that entries logged on others' vehicles keep the user's name. `clearPersistence()` runs after deletion.
- **OQ-63, Play and policy declarations:** Declare crash logs and the Crashlytics installation id, state that receipts live in the user's Drive, and mention members' emails and the camera permission. Verification pending: what Play requires.

**Dependencies.** Foundation; sharing (account deletion is designed with sharing); all features for the production release.

**Acceptance criteria.** Defined in tab 8.

**Still to confirm at the start of tab 8.** The exact Google consent-screen requirement.

---

## 24. Dependencies and Implementation Order

### 24.1 Order [Source]

Built in dependency order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.** A usable personal app exists after tab 2. The Play closed test starts then and runs in parallel with sub-projects 3–7.

```
1 Foundation → 2 Logging → 3 Reminders → 4 Reports and dashboard → 5 Drive and export
             → 6 Sharing → 7 Checklists → 8 Release

Usable personal app after 2  →  Play closed test starts (12+ testers, 14 days)
                                runs in parallel with sub-projects 3–7
```

The source numbers the tabs in dependency order but does not state a dependency graph. The diagram shows only that numbering and the parallel closed-test window, and it does not assert dependencies among tabs 3–7 beyond those in §24.2.

### 24.2 Dependencies stated or implied by the source

Entries marked **[Derived]** are inferred from the scope wording rather than stated as dependencies.

| Sub-project | Depends on | Basis |
| --- | --- | --- |
| 1 Foundation | Firebase project id (OQ-03); Google Cloud OAuth client; Play account (US$25) later | Setup |
| 2 Logging | 1 | Entries need the data model, vehicles, rules, adapters |
| 3 Reminders | 1; entries and odometer from 2 | **[Derived]** Auto-complete "from matching entries"; `lastOdometer` |
| 4 Reports | 1; entries from 2 | **[Derived]** Reports need entries; dashboard uses `lastOdometer` |
| 5 Drive and export | 1 (serializer, OAuth client, linking); entries from 2 | Backup uses the shared serializer; `drive.file` added incrementally (OAuth client in Foundation). Entries from 2 are **[Derived]** |
| 6 Sharing | 1 (membership, rules); 5 (Drive client, scope) for receipt sharing; linking | Receipts shared via Drive permissions; Drive client from 5 is **[Derived]** |
| 7 Checklists | 1; entries from 2 | **[Derived]** `inspection` entries |
| 8 Release | 1–7 for production; sharing for account deletion design | Account deletion "designed with sharing"; the rest is **[Derived]** |

### 24.3 Foundation seams that prepare later tabs [Source]

- The full data model and rules are delivered in Foundation so no migrations are needed later.
- The OAuth client is configured in Foundation so tab 5 can request `drive.file` incrementally.
- Placeholder entry screens in the Add sheet and "Coming soon" items in More are replaced as tabs land.
- The shared serializer built for account merge is reused by tab 5.
- Rules paths for later tabs are listed in §15.4.

### 24.4 External dependencies

| Dependency | Needed by | Notes |
| --- | --- | --- |
| Firebase project (Spark plan) | 1 | Id permanent (OQ-03) |
| Google Cloud OAuth client | 1 (config), 5 (`drive.file`) | Consent screen in 8 |
| Google Play developer account (US$25) | 2 onward (closed test), 8 | One-time |
| Domain `poovarasu.dev` and subdomain `milevana.poovarasu.dev` | 6 (invite links), 8 | Existing portfolio domain |
| Expo / EAS Build | 1 onward | Development builds |
| GitHub Actions | 1 | CI |
| **[Review]** Separate Android and web OAuth clients, release-signing SHA-1s, Firebase Auth authorized domains | 1 (config), 5 | **[External — verify]**; OQ-28 |
| **[Review]** DNS control of `poovarasu.dev` for `milevana.poovarasu.dev`, and Firebase's domain verification | 6, 8 | Not stated in the source |

### 24.5 Timeline

The source gives **no calendar dates or durations** except the Play gate (12+ testers for 14 days). The launch timeline is defined in tab 8 (DD-01). The closed test starts after sub-project 2 and runs in parallel with sub-projects 3 to 7, so the wait after the app is finished is Google's production-access review (OQ-61).

### 24.6 Pre-implementation gates and spikes [Review]

| # | Gate or spike | Gates | Pass condition | Status |
| --- | --- | --- | --- | --- |
| G1 | Choose the Firebase project id | All implementation | Id chosen | **Done: `milevana`** (OQ-03) |
| G2 | Quota budget: count reads and writes per operation (History cold open, add entry, All-vehicles report, vehicle delete, merge) at 100 to 500 daily active users, cache-first | Foundation data layer; tabs 2 and 4 | Projected usage within an agreed share of 50,000 reads and 20,000 writes | Decided scale; the count is still to be done (OQ-18) |
| G3 | Rules and merge spike (emulator): write a serialized fixture (for example one vehicle and 501 entries) under a different uid in batches of 500 using the matrix rules | Foundation rules; AC-F3; tab 5 restore | No denial and no access-call error; batch constant set | Emulator-verified 2026-10-06 (OQ-22, OQ-35); production limits still to be confirmed |
| G4 | Foundation rules scope decision | AC-F6 | Decision recorded | **Done** (OQ-04) |
| G5 | Sign-out and queued-write test: airplane mode, add an entry, sign out, reconnect; then queue a write as a member the owner removes while offline | FR-OUT, FR-OFF | Every loss or rejection has the defined behaviour | Verification pending (OQ-24, OQ-26) |
| G6 | Closed-tester sign-in test: link Google on a Play-signed build with an account that is not a listed test user | Closed test after tab 2 | Linking works | Verification pending (OQ-28) |
| G7 | Fuel shape fixtures: round-trip, for example, €1.459 per litre and 12.5 UK gallons | Freezing the fuel details shape | Round-trips exactly | Shape decided (OQ-30); fixtures become tests |

---

## 25. Acceptance Criteria

### 25.1 Foundation "Done when" [Source, verbatim]

| ID | Criterion |
| --- | --- |
| AC-F1 | A fresh Android install reaches "Add your first vehicle" after one welcome screen, with no sign-in screen. |
| AC-F2 | Vehicles can be added, edited, archived and deleted, including offline on Android. |
| AC-F3 | Anonymous users can link Google, including the conflict case where that account already has data. |
| AC-F4 | Web users sign in with Google and see the same vehicles. |
| AC-F5 | Settings for currency, units, efficiency format, date format, theme and language persist and drive all display. |
| AC-F6 | Security rules for the data model — members, entries, reminders and checklist templates — pass the emulator test suite, and invites, self-join, leave and ownership transfer are denied by default and tested as denied (amended, OQ-04). |
| AC-F7 | Crashlytics reports crashes and non-fatal errors without personal data. |

**AC-F6 is amended (decided, OQ-04).** Foundation writes the `checklistTemplates` rules and ships default-deny for `invites`, self-join, leave and ownership transfer, tested as denied. The amended criterion is: security rules for members, entries, reminders and checklist templates pass the emulator suite, and the invite, join, leave and transfer paths are denied by default and tested as denied.

**Verification mapping [Proposed].** The source names test layers (§21.2) but does not map them to these criteria. The mapping below is a proposal.

| ID | Proposed verification | Status |
| --- | --- | --- |
| AC-F1 | Maestro: first launch | Proposed |
| AC-F2 | Component and repository tests; Maestro airplane-mode logging | Proposed |
| AC-F3 | Manual link-Google test with a test Google account; manual account-conflict merge on the release checklist; emulator integration test for the merge write path | Proposed |
| AC-F4 | Manual web smoke test | Proposed |
| AC-F5 | Component tests that each setting changes the displayed values on the screens that exist in Foundation, plus the manual dark-mode and font-scaling checks | Proposed |
| AC-F6 | Rules suite on every push | Amended; see above |
| AC-F7 | Manual check of a test crash and a test non-fatal in Crashlytics, confirming no amounts, plates, names or notes | Proposed |

### 25.2 Derived acceptance criteria [Derived from stated behavior]

These restate source behavior as testable statements. They are **not** source requirements and carry no priority of their own.

| ID | Criterion | Source behavior |
| --- | --- | --- |
| AC-D1 | With the device offline on first launch, "Connect to get started" is shown and retries automatically; once online, onboarding proceeds. | §14.2 |
| AC-D2 | An anonymous user sees no sign-out option and sees "Link Google" instead. | §14.6 |
| AC-D3 | A linked user's sign-out on Android clears the persisted cache. | §14.6 |
| AC-D4 | A successful link leaves the uid unchanged and sets `isLinked: true`. | §14.3 |
| AC-D5 | On `auth/credential-already-in-use`, the three-option prompt shows the counts of vehicles and entries. | §14.4 |
| AC-D6 | A merge write failing partway leaves retry data in memory and on disk, and a retry creates no duplicates. | §14.4 |
| AC-D7 | Vehicle odometer unit and currency are locked once the vehicle has entries. | §8.2 |
| AC-D8 | Vehicle delete requires typing the vehicle name, and deletes entries, reminders and templates in batches of 500, then the vehicle. | §8.2 |
| AC-D9 | An archived vehicle is absent from the switcher and can be unarchived from More → Vehicles. | §8.2 |
| AC-D10 | A settings change alters displayed values and leaves stored values unchanged. The Currency setting never converts an existing amount. | §18.2 |
| AC-D11 | A member who loses access sees "You no longer have access to this vehicle" and the app switches vehicle. | §19.2 |
| AC-D12 | A malformed document is skipped, "1 entry couldn't be shown" is shown, and a non-fatal with the document path is logged. | §19.2 |
| AC-D13 | Crashlytics events contain no amounts, plates, names or notes. | §19.3 |
| AC-D14 | At ≥768 px web width the left rail and dialog forms appear; the same routes work on Android and web. | §17.1 |
| AC-D15 | The Add sheet lists Fuel, Expense, Service, Income, Trip and Inspection, and each opens a placeholder in Foundation. | §17.1 |
| AC-D16 | Unbuilt More items show "Coming soon". | §17.1 |
| AC-D17 | Icon-only buttons have screen-reader labels, tap targets are ≥48 dp, dark mode and font scaling work. | §17.6 |
| AC-D18 | Every rules-matrix row has an allowed and a denied emulator test. | §15.3 |
| AC-D19 | No `READ_MEDIA_IMAGES` or `READ_EXTERNAL_STORAGE` permission is present in the Android release build. | §8.5 |
| AC-D20 | The app contains no ad SDK and requests no location permission. | §4 |
| AC-D21 | The Foundation rules admit the account-merge write path (copies owned by the Google uid, in batches). Emulator-verified 2026-10-06; production confirmation pending (gate G3; OQ-22, OQ-35). | AC-F3 with §15.2 |
| AC-D22 | Android first launch shows one welcome screen before "Add your first vehicle". | §14.2 |
| AC-D23 | Sign-out with pending writes offers Wait and sync, or Sign out and discard. | §14.6 |
| AC-D24 | A queued write rejected by the server shows a warning and a Sync issues notice with Retry or Discard. | §16.4 |
| AC-D25 | "All vehicles" is a switcher entry that changes only the Reports tab. | §17.1 |

### 25.3 Release-level acceptance

| ID | Criterion | Source |
| --- | --- | --- |
| AC-R1 | The Play closed test has run with 12+ testers for 14 days. | Brief |
| AC-R2 | Maestro end-to-end flows and the manual release checklist pass before each release. | Testing |
| AC-R3 | All v1 features (§5.1) are delivered. | Scope |
| AC-R4 | Web is deployed at `milevana.poovarasu.dev`. | Sub-project 8 |
| AC-R5 | Account deletion, privacy policy and terms, Play listing, and Google consent screen are complete. | Sub-project 8 |

### 25.4 Sub-projects 2–8

The source defines no acceptance criteria for sub-projects 2–8. They are defined in each tab's design (§23).

---

## 26. Limitations

L1 to L7 are accepted limitations stated in the source. L8 to L10 are **[Derived]** restatements of source facts. L11 to L17 are limitations accepted by decisions on 2026-10-06.

| # | Limitation |
| --- | --- |
| L1 | **First launch on Android needs the network once**, to create the anonymous account. |
| L2 | An anonymous user who **uninstalls before linking Google or exporting a CSV loses their data**. The app says so plainly. |
| L3 | **Abandoned anonymous accounts** from the merge flow leave orphaned documents that cannot be deleted without server code (a few KB per case). |
| L4 | The **web app is online-only**. It shows and edits reminders but sends no notifications. |
| L5 | **Reminder edits by another member, and receipt sharing for new members, reach a phone only when the relevant app next opens** (tabs 3 and 6). |
| L6 | **Whether members can view other members' receipts inside the app** depends on the `drive.file` spike in tab 6; the fallback is an Open in Drive button. |
| L7 | The **Spark plan allows 50,000 Firestore reads and 20,000 writes per day**; beyond that, requests fail until the daily reset. |
| L8 **[Derived]** | After sign-in during an account merge, the anonymous account cannot be re-entered, so a failed merge relies on locally kept data. |
| L9 **[Derived]** | v1 has no local-only mode, no email/password sign-in, no iOS, no OTA updates, and the other exclusions in §6.1. |
| L10 **[Derived]** | English is the only language in v1. |
| L11 **[Decided]** | The project stays on the free Spark plan, with no Blaze fallback; a quota hit pauses sync until the daily reset (OQ-18). |
| L12 **[Decided]** | Web has no crash reporting in v1 (OQ-10). |
| L13 **[Decided]** | Rules cap field lengths and array sizes but cannot limit document counts, and there is no App Check in v1 (OQ-33). |
| L14 **[Decided]** | A removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground (OQ-56). |
| L15 **[Decided]** | Members who join later cannot see receipts from a member who has left, and an uploader who is neither the entry's creator nor the owner cannot update receipt sharing (OQ-56). |
| L16 **[Decided]** | After account deletion, entries the user logged on other members' vehicles keep the user's name (OQ-62). |
| L17 **[Decided]** | The limit of 20 checklist templates per vehicle is enforced by the app only (OQ-59). |

---

## 27. Open Questions

Every question raised while writing and reviewing this PRD is now decided. Decisions come from the product owner's answers and from the proposed defaults they approved on 2026-10-06. The last column records each decision, and the same decisions are in `requirements.md` ("Decisions on open questions"). Items marked **Verification pending** are decided but must be checked against Firebase, Google or Play before they are relied on. The field-level shapes for the tab designs (OQ-01, OQ-41) are in Appendix E and were approved on 2026-10-06.

| ID | Question | Why it matters | Needed by | Decision (2026-10-06) |
| --- | --- | --- | --- | --- |
| **OQ-01** | The source says v1 is "designed in eight tabs in this document", but only tab 1 (Foundation) is present. Where are the designs for tabs 2–8? | This PRD can state only scope-level requirements for sub-projects 2–8 (§23). Acceptance criteria, schemas and behaviors there are undefined. | Before each tab's implementation | **Decided.** The tab designs are the decisions recorded in this document's tab sections. Field-level shapes are in "Schemas" (approved on 2026-10-06). |
| **OQ-02** | What are the success metrics for v1, such as adoption, retention and crash-free rate? | The source defines none. The only signals are the done-when list and the Blaze-review trigger. | Product decision, before launch | **Decided.** No numeric v1 targets. The tracked signals are completion of the closed-test gate, the weekly Firestore usage check, and crash reports. |
| **OQ-03** | **Firebase project id** (e.g. `milevana` or `milevana-app`)? | Source: "one setup choice remains before implementation starts". Permanent once created. Forms the `<project-id>.web.app` fallback. | **Blocking: before any implementation** (RT-03) | **Decided.** The Firebase project id is `milevana` (fallback address `milevana.web.app`). It is permanent. The project was created with this id and confirmed on 2026-10-06. |
| **OQ-04** | Foundation done-when requires rules for "members, entries, reminders, checklist templates and invites" to pass the emulator suite, but §15 defers `invites` rules to tab 6 and `checklistTemplates` rules to tab 7. Which rules must exist and be tested in Foundation? (RT-05) | The Foundation exit criterion AC-F6 cannot be verified as written. The Sharing decisions describe invite validation, self-join, self-leave, ownership transfer and receipt-sharing rules as updates to the Foundation rules, written in tab 6. That supports reading AC-F6's `invites` clause as deferred, but AC-F6 in the source still lists invites. Confirm whether to amend it. | **Blocking: before Foundation rules work** | **Decided.** Foundation writes the `checklistTemplates` rules and ships default-deny for `invites`, self-join, leave and ownership transfer, tested as denied. AC-F6 is amended to say so. Tab 6 adds the real invite rules. |
| **OQ-05** | The dismissible link prompt fires "after the 5th entry": is that counted per vehicle or across all vehicles? How often does it reappear after dismissal? | Affects the linking funnel and the user's data-loss exposure. | Foundation | **Decided.** The "5th entry" counts entries across all vehicles. A dismissed prompt does not reappear. The "Your data isn't backed up" banner on More stays. |
| **OQ-06** | What exactly happens on **Switch without moving** (is the anonymous data left in place and abandoned, and is the user told?) and on **Cancel** (does the user stay anonymous and unlinked)? (RT-11) | The source names these options but specifies only "Move and switch" in detail. An earlier draft of this PRD stated an outcome for "Switch without moving"; that was removed. | Foundation | **Decided.** Cancel keeps the user anonymous with nothing changed. Switch without moving signs in to the Google account and leaves the phone's data behind, after a warning that it cannot be recovered. |
| **OQ-07** | During a merge, what happens to the anonymous user's `users/{uid}` document and settings versus the Google account's existing settings? | The serialization scope lists vehicles, entries, reminders and checklist templates only. | Foundation | **Decided.** The Google account's existing settings win. The anonymous user's settings are discarded. |
| **OQ-08** | How long is the on-disk copy of merge retry data kept, when is it cleared, and is it protected? | It contains vehicle and entry data, and it is relevant to the privacy policy. | Foundation / tab 8 | **Decided.** Kept in app-private storage until the merge succeeds or the user discards it, then deleted. |
| **OQ-09** | Vehicle management edge cases: behavior if a batched delete fails partway; what is selected after archiving or deleting the selected vehicle; what a user sees when all vehicles are archived; the effect of the owner deleting a vehicle that has members. | Not specified. Sharing semantics are tab 6. | Foundation / tab 6 | **Decided.** A failed delete is retried or resumed, because the vehicle is removed last. After archiving or deleting the selected vehicle, the app selects the most recently used one. If every vehicle is archived, an empty state offers Unarchive and Add. Deleting a shared vehicle warns with the member count. |
| **OQ-10** | How are crashes and non-fatal errors captured on **web**? The source names Crashlytics and says web behaves the same for the malformed-document and error-boundary cases. | The mechanism is not stated for web. | Foundation | **Decided.** Web shows the error boundary but has no crash reporting in v1. This is an accepted limitation. Whether Crashlytics supports web is unverified. |
| **OQ-11** | Odometer unit options: the data model allows `km`, `mi`, `hours`, but the vehicle form lists only "odometer unit", and the distance-unit setting offers `km`, `mi`. Which vehicle types may use `hours`? How do the user-level distance unit and the vehicle's `odometerUnit` interact, and is there any correction path once units lock? (RT-18) | The behavior and the display of hours are unspecified, and efficiency, mileage and reminders are distance-based. | Foundation | **Decided.** `hours` is selectable for any vehicle type. Distance-based metrics (mileage, cost per km, km-per-day reminders) are hidden for `hours` vehicles. Entries use the vehicle's unit, and display converts km and mi. Units stay locked once the vehicle has entries. |
| **OQ-12** | Colour palette contents and the full list of fuel types. (The expense, service and income category lists are now defined; see §23.2. Whether fuel and trip entries have categories is not stated.) | The source gives only examples (`petrol`, `cng`; `kWh` for EV). | Foundation / tab 2 | **Decided.** Fuel types: petrol, diesel, CNG, LPG, electric. Palette: 12 fixed colours. Fuel and trip entries have no category. |
| **OQ-13** | **Decided:** automatic backup runs when the app opens, if the last backup is older than the chosen frequency; linked accounts only; on any network. Still open: see OQ-53(c). | Settled by the Drive decisions (§23.5). | Tab 5 | **Decided.** Automatic backup runs when the app opens, if the last backup is older than the chosen frequency. Linked accounts only. It runs on any network. |
| **OQ-14** | Analytics: "skipped or opt-in". Which? | The privacy policy and consent flow depend on it. | Before release | **Decided.** None in v1. There is no analytics SDK. |
| **OQ-15** | How do member `name` and `email` in `vehicles.members`, and `createdByName` on entries, interact with account deletion? | Account deletion is designed in tab 8 and uses only existing paths. The Sharing decisions add that account deletion relies on ownership transfer, and that a removed or leaving member's name stays on their entries. The account-deletion summary says which memberships you will leave but not what happens to the entries you logged on vehicles you leave (OQ-62b). | Tab 8 | **Decided.** Entries logged on other members' vehicles keep the user's name after account deletion (see OQ-62). The user's email is removed from `members` when they leave. The privacy policy discloses this. |
| **OQ-16** | Tab 8 owns "Play closed testing", but the closed test starts after tab 2. Which listing, policy and consent-screen items must exist before it can start? Which Play Console declarations (privacy policy, data safety, account deletion) are required for a closed-test release? (RT-25) **[External — verify]** The Release decisions place the privacy policy, terms, Play listing, data-safety form and consent screen in tab 8, while the closed test can start as early as tab 2. | The release timeline is defined in tab 8. | After tab 2 | **Decided.** A minimal privacy policy URL, data-safety form and store listing are prepared just before the first closed-test upload. The full sub-project 8 work follows. |
| **OQ-17** | `lastOdometer` semantics: is it recomputed when an entry is edited or deleted? Is a member-written value validated? What happens with concurrent writes from offline members? (RT-16) | The source specifies the maximum written in the same batch, and that members may write only that field. A batch cannot read, so the maximum is computed from the local cache and can go backwards. | Foundation / tab 2 | **Decided.** `lastOdometer` is the maximum odometer across the vehicle's entries and its starting odometer. The client recomputes it when an entry is edited or deleted. Rules require only a non-negative number. Concurrent offline writes can briefly lower it and it corrects itself on the next entry or refresh. |
| **OQ-18** | What is the expected usage that the Spark quota and rule `get()` costs are "well within"? Are there numeric performance, coverage or scale targets? What target daily active users and sessions per day should be budgeted, and is a billing account (Blaze) acceptable if the free quota is exceeded, given NFR-01 and "free forever"? Who owns that decision? (RT-01) | NFR-06, NFR-18 and NFR-19 depend on expected volume, which is not quantified. Each entry write is two writes (entry plus `lastOdometer`) plus a rules read, and cold listeners and reports read every entry. Daily limits apply to the whole project. The Reports decisions load all of a vehicle's entries on the device, and "All vehicles" loads every vehicle in turn, so one report open reads every entry. The Sharing decisions add that on every app open the phone checks the receipts the user uploaded to shared vehicles, which also reads entries. | **Blocking: before the data layer and query design** | **Decided.** Budget for roughly 100 to 500 daily active users on the free plan, with no Blaze fallback. Reads are cache-first wherever possible, and a refresh control pulls the latest data from the cloud. If the daily quota is reached, sync pauses until the reset. |
| **OQ-19** | **All vehicles** report across vehicles with different currencies or units. **Partly decided:** totals are shown per currency and never converted, and mileage stays per vehicle. Still open: how distance driven and cost per km are shown in the "All vehicles" view when the vehicles' odometer units differ (`km`, `mi`, `hours`). | The currency question is settled. Summing distances in different units is not. | Tab 4 | **Decided.** Totals are per currency and never converted. Distance and cost per km are shown per odometer unit. |
| **OQ-20** | Which features are available on web, and with what parity (Drive via Google Identity Services is named, and backup and restore are now decided to work on web; whether attachments and automatic backup work on web is not stated)? | Web is secondary and online-only, but scope per feature is unstated. | Per tab | **Decided.** Backup and restore, reminders, reports, checklists, sharing and attachments (online only) work on web. Automatic backup is Android only. |
| **OQ-21** | Layout for web widths below 768 px. | The source defines only ≥768 px behavior. | Foundation | **Decided.** Web below 768 px uses the mobile layout. |
| **OQ-22** | **[Review]** How do merged and restored copies satisfy the rules? Are `createdBy`, `createdByName`, `updatedBy`, `createdAt` and `updatedAt` preserved or rewritten? What exactly does "timestamps compared to `request.time`" require (equality, or not in the future)? In what order are vehicles and entries written, given that `get()` sees pre-write state? (RT-02) | The matrix requires `createdBy` = self, and merged entries carry the anonymous uid. AC-F3 and tab 5 restore depend on the answer. The backup also includes other members' entries on owned shared vehicles, and restore of those has the same problem. | **Blocking: before Foundation rules and merge** | **Decided.** Copies keep their original `date`, `createdAt` and `updatedAt`. `createdBy` and `updatedBy` are rewritten to the new owner's uid, and `createdByName` is kept. Rules check that timestamps are not in the future instead of equal to `request.time`. Restored entries by other members on a shared vehicle the user owns are attributed to the user. Vehicles are written before their entries. Emulator-verified on 2026-10-06 (gate G3); production confirmation pending. |
| **OQ-23** | **[Review]** After the app is closed or killed between sign-in and merge completion, how are the on-disk retry data found and resumed on the next launch? How is partial state in the Google account handled? (RT-11) | FR-MERGE-05 keeps the data but defines no resume path. | Foundation | **Decided.** On launch, if merge retry data exists, the app shows "Finish moving your data". |
| **OQ-24** | **[Review]** What happens to unsynced writes when a linked user signs out? What local state must sign-out clear beyond `clearPersistence()` (scheduled notifications, selected vehicle, merge-retry data, Google Sign-In session and Drive tokens)? What are the SDK preconditions for `clearPersistence()`? (RT-06) | Silent data loss, and the stated privacy goal is not met by the stated mechanism. | Foundation | **Decided.** If writes are pending, sign-out shows how many changes have not synced and offers Wait and sync, or Sign out and discard. Sign-out also clears scheduled notifications, the saved selected vehicle, any merge retry data, and the Google Sign-In session. |
| **OQ-25** | **[Review]** Confirm the assumption that web Google sign-in resolves to the same uid as a linked Android user, and define the web-first-then-Android path. (RT-26) | AC-F4 depends on it. | Foundation | **Decided.** Documented as an assumption: linking Google to the anonymous uid keeps the uid, so web sees the same vehicles. A user who signs in on web first and later links on Android goes through the merge path. |
| **OQ-26** | **[Review]** What does the user see when a queued write is later rejected (removed member, rules validation, quota)? How is rejection surfaced when repositories return before confirmation? (RT-07) | The error table has no deferred-write row. | Foundation | **Decided.** An affected item shows a warning state, and a Sync issues notice lists changes that could not be saved, each with Retry or Discard. Permission-denied after removal uses the existing "You no longer have access to this vehicle" message. |
| **OQ-27** | **[Review]** How does the web app detect being offline so that saving is disabled? How does popup sign-in behave on mobile browsers? (RT-23) | Both are required by the source but not defined. | Foundation | **Decided.** Web uses the browser's online and offline events plus a write timeout. If the sign-in popup is blocked, it falls back to the redirect flow. |
| **OQ-28** | **[Review]** Can closed-test users link Google if the consent screen is configured in tab 8? Are separate Android and web OAuth clients, the Play app-signing SHA-1, and authorized domains in place? (RT-12) **[External — verify]** | Linking is required for several features and the closed test starts after tab 2. The Release decisions say the exact consent-screen requirement is confirmed at the start of tab 8 and that Google will likely want a verified domain. | Foundation / before closed test | **Decided.** The consent screen is published with basic sign-in scopes before the closed test, and `drive.file` is added in sub-project 5. Verify with an account that is not a listed test user (gate G6). |
| **OQ-29** | **[Review]** Does changing the currency setting only set the default for new vehicles and display formatting, or convert amounts? If conversion is intended, what is the rate source? (RT-08) | The source says "converts what is shown" and lists "currency conversion" but defines no rate source. | Foundation | **Decided.** The Currency setting sets the default for new vehicles and how amounts are formatted. Existing amounts keep their own currency and are never converted. Unit conversion still applies to distance and volume. |
| **OQ-30** | **[Review]** How does the fuel details shape represent US versus UK gallons (the stored unit is `gal`) and prices quoted to three decimals (the stored field is an integer `pricePerUnitMinor`)? (RT-09) | The shape is frozen in Foundation, and mileage depends on it. Changing it later conflicts with "without data migrations". The "enter any two of price per unit, quantity and total" input, now a Logging decision, makes price precision matter more. | **Blocking: before the shape is frozen** | **Decided.** `quantityUnit` is L, gal_us, gal_uk, kg or kWh. Price per unit is stored as an integer in thousandths of a minor unit (`pricePerUnitMilli`). The total stays in integer minor units, so the "any two of three" input round-trips. |
| **OQ-31** | **[Review]** Is `amount` optional for entry types without one? What are the sign semantics for income and expense? Must `amount.currency` match the vehicle currency? How are minor-unit exponents handled for the ISO 4217 list? (RT-17) | Rules require an integer `amount.minor` on create. Profit metrics depend on the sign convention. Trips now have a calculated reimbursement amount that may or may not be the entry `amount` (OQ-42). | Foundation / tab 2 | **Decided.** `amount` is required only for fuel, expense, service and income entries. It is always stored positive, and the type decides income versus cost. Its currency must equal the vehicle's currency. Minor-unit exponents come from a currency table in `money.ts`. Trips and inspections have no `amount`. |
| **OQ-32** | **[Review]** What is the type of `date` (timestamp or date-only), how is the time zone handled, and how is a financial-year range defined? (RT-19) | Affects rules, CSV, serializer round-trips and reports. The financial year is now decided as April–March, with no setting to change it. | Foundation / tab 4 | **Decided.** `date` is a timestamp of the chosen local date and time. The financial year (April to March) uses the device time zone. |
| **OQ-33** | **[Review]** Should rules carry limits on documents per user, entries per vehicle, array sizes, string lengths and document size? Is resistance to one client exhausting the project-wide daily quota in v1 scope? (RT-10) | Any signed-in user, including an anonymous one, can create vehicles. | Foundation | **Decided.** Rules cap what they can: text lengths, array sizes (5 attachments, 10 members, 50 template items) and document shape. Total document counts cannot be limited by rules. App Check is not in v1, and abuse resistance beyond field limits is an accepted limitation. |
| **OQ-34** | **[Review]** Which invariants must the rules enforce on owner updates: the owner is a member; `members` keys match `memberIds`; `ownerId` changes only through the tab 6 transfer path? Are `createdByName` and `updatedBy` constrained? (RT-15) | Without them the tab 6 rules and adversarial tests have nothing to constrain. | Foundation / tab 6 | **Decided.** The owner must be in `memberIds`. The `members` keys match `memberIds`. `ownerId` changes only to an existing member. `createdBy` and `updatedBy` must equal the caller. |
| **OQ-35** | **[Review]** Do batches of 500 work with rules that call `get()` per write, given Firestore's rules access-call limits? Does the "one billed read per request" claim hold for batches? (RT-04) **[External — verify]** | Batches of 500 are specified for vehicle delete and merge. | **Blocking: before fixing batch size** | **Decided.** 500 is the batch size. The emulator spike (gate G3, 2026-10-06) found a batch of 500 entries passes when the rules read only the parent vehicle document, because repeated reads of the same document count once, while a single write reading 11 distinct documents, and a batch of 30 writes each reading a different document, are denied. Rules must therefore read only the parent vehicle. Production confirmation is pending. |
| **OQ-36** | **[Review]** May invite-code document ids and uids appear in crash reports? How is Crashlytics described in the privacy policy and Play data-safety form, given it assigns an installation id? (RT-21) **[External — verify]** | `invites/{code}` uses the code as document id, so it is a capability token. | Foundation / tab 8 | **Decided.** Invite paths are redacted from crash reports and the uid is not set as the Crashlytics user id. The privacy policy discloses the Crashlytics installation id. |
| **OQ-37** | **[Review]** Which of the testing gaps in §21.5 will be closed, and how is the link-Google flow tested? (RT-13, RT-14) | The native adapter and the merge flow are the highest-risk paths. | Foundation | **Decided.** Add an emulator integration test for the merge write path. Link Google stays manual with a test Google account. Native offline behaviour is covered by the Maestro airplane-mode flow plus manual checks. |
| **OQ-38** | **[Review]** How do rules, indexes, secrets, Play submission and Hosting deployment work (§22.5)? (RT-24) | Rules are the entire backend. | Foundation | **Decided.** One production Firebase project, with the emulator for tests. Rules and indexes deploy on tagged releases. Secrets live in GitHub and EAS secrets. EAS Submit publishes to Play, and Hosting deploys from CI. |
| **OQ-39** | **[Review]** How is the first-launch bootstrap made safe when a session exists but `users/{uid}` is missing or outdated? How does the selected vehicle persist, and is it per user? Can entries be added to an archived vehicle? (RT-29, RT-30) | Not defined in the source. | Foundation | **Decided.** If a session exists but `users/{uid}` is missing, it is created with defaults. The selected vehicle is stored per uid. Archived vehicles are read-only until unarchived. |
| **OQ-40** | **[Review]** What does "without data migrations" mean given that repositories "upgrade older shapes on read" and tabs 2 and 7 define the `details` shapes? (RT-20) | The two source statements are in tension. | Foundation | **Decided.** It means no bulk or server migrations. Older shapes upgrade lazily on read. |
| **OQ-41** | **Service entries (tab 2 / tab 3).** The source now decides that a service is one entry with line items, each with a service type and cost, totalled with optional labour and discount, with one receipt photo per bill. It does not define: the shape of a line; whether labour and discount are amounts or percentages and where they are stored; whether `amount` is the stored total or derived from the lines; how the list of service types is defined (fixed list, or tied to categories); whether one receipt per bill is enforced (the Drive decisions allow up to 5 attachments per entry, so "one receipt per bill" is the intent, not a limit); what `attachments[].itemId` references for service entries (for inspections it is now decided to be the checklist item a photo is tagged with); and how a reminder stores its reference to a service type. (What "matching" means is now decided: a service line item of that type, or an expense in that category; see §23.3.) | Entry `amount` is a single `{ minor, currency }` and rules require an integer `amount.minor` (see OQ-31). Reminders, History, CSV and backup all read these entries. | Tab 2 / tab 3 | **Decided.** Up to 5 attachments per entry is decided. Each service entry also has one entry category from the Services list (see OQ-43). `attachments[].itemId` is used for inspection item tags only. The line, labour, discount and stored-total shapes are in "Schemas" (approved on 2026-10-06). |
| **OQ-42** | **Units in the Logging decisions.** (a) Mileage is calculated per fuel type, including CNG (stored in kg) and EV (kWh), but the Efficiency format setting offers only km/l, L/100 km and mpg. What efficiency unit applies to CNG and EV, and is the setting list to be extended? (b) The trip reimbursement rate is "per km", but a vehicle's `odometerUnit` can be `km`, `mi` or `hours`. What is the rate's unit for a vehicle in miles, or for hours? The same question applies to the reminder decisions and to the report metrics "cost per km" and "distance driven", which are in km ("average km per day", "within 500 km", "due in 1,200 km"). (c) How do trip fields (start and end date/time, start and end odometer, calculated reimbursement) map onto the common entry fields `date`, `odometer?` and `amount`? What is `amount` for a trip with no rate? | The Settings table in the source (Foundation) is fixed, so (a) conflicts with the new mileage decision. Rules require `amount.minor` on create. | Foundation settings / tab 2 | **Decided.** CNG shows km/kg and EV shows km/kWh (mi/kg and mi/kWh for mile-based vehicles), fixed per fuel unit and not user-selectable. Petrol and diesel follow the Efficiency format setting. The trip reimbursement rate is per the vehicle's odometer unit (per km, per mi). A trip has no `amount`, and its reimbursement is computed in `details`. |
| **OQ-43** | **Service categories versus line items.** The service list (general service, engine oil, and so on) could be the list of service types for line items, the entry `category`, or both. A service entry has several lines, but `category?` is one value copied onto the entry. Which applies, and what is copied to the entry? Is "Other" allowed as a line's service type? | Reminders per service type read the line items. History search covers categories. | Tab 2 / tab 3 | **Decided.** The Services list is the service type of each line item (plus "Other" with free text). Each service entry also picks one entry category from the same list. |
| **OQ-44** | **Reimbursement.** "Reimbursement" is an income category, and trips produce a calculated reimbursement amount that is not an income entry. "Reports show reimbursements separately" could mean the trip-calculated amounts, the income entries categorised "reimbursement", or both. Which one, and how do they combine in profit figures? The Reports decisions add that the Trips section shows total reimbursement and that cost per km excludes trip reimbursements, but not whether net profit includes them. | Gig-driver profit figures are a stated goal. | Tab 2 / tab 4 | **Decided.** Trip-calculated reimbursement is shown only in the Trips section and is excluded from cost and from net profit. An income entry categorised "reimbursement" is ordinary income and counts toward profit. |
| **OQ-45** | **History mechanics.** (a) "Delete with an Undo option" while soft delete and edit history are left out of the data model: is Undo a delayed delete, or a re-create? How does it behave offline, or if sync happens before Undo? (b) "Search across notes and categories" and the type and date-range filters have no stated mechanism; Firestore has no full-text search, so search would run over loaded entries, which bears on read quota (OQ-18), and filtering may need indexes (§22.5). (c) "Tap to edit": rules let only the creator or the owner update an entry, so what does a member see on someone else's entry? | The mechanisms affect the data layer and quota. | Tab 2 | **Decided.** Delete uses a delayed delete: the entry disappears from History at once, and the real delete and the Drive file deletion happen after a 5-second Undo window. No soft delete is stored. Search and filters run on the device over loaded entries (notes, categories, line-item types). Other members' entries are read-only. |
| **OQ-46** | **Reminder behavior gaps.** (a) "Snooze": for how long, and is the snoozed or done state shared by all members (the reminder document is shared) or per user (the schema holds only `mutedReminderVehicleIds` per user)? (b) What does mute suppress: phone notifications only, or also the Dashboard card and overdue status? (c) For an odometer reminder with no prediction, "notifies only once a logged reading crosses the threshold": is the threshold the 500 km lead or the due odometer? (d) "Last 90 days of readings": by entry date or by when logged? Odometer sanity checks only warn, so typos and back-dated readings can distort the average. (e) "9 AM" is in the device's local time, but delivery is inexact. What if the notification permission is denied? (f) When both a date and an odometer trigger are set and the reminder repeats, what rolls forward, and from what? (g) Each device schedules notifications locally, and "all members are notified": members on web get none. Is that the intended outcome? | These decide the reminder schema and the notification logic. Reminders are shared by every member, while only mute is per user. | Tab 3 | **Decided.** Snooze offers tomorrow, in 3 days, or next week, and is per user, stored on the device. Mute silences phone notifications only. An odometer reminder with no prediction notifies when a reading is within the lead distance (500 km). The 90-day window uses entry date. 9 AM is device local time, and if notification permission is denied, reminders still appear in the app. When a repeating reminder has both triggers, both roll forward from the completing entry. Members on web get no notifications, as intended. |
| **OQ-47** | **"Upcoming & overdue" Dashboard card.** The Reports decisions now define the Dashboard (tab 4) and include this card, but the card needs the reminders from tab 3, which is built first. Does tab 3 ship an interim card, or does the card arrive with tab 4? How is urgency ranked across date-based and odometer-based reminders? Do overdue reminders from a muted vehicle appear? | Ordering and ownership are unspecified. | Tab 3 / tab 4 | **Decided.** The Upcoming & overdue card ships with sub-project 3. Overdue reminders come first, then soonest due. Odometer reminders without a prediction rank after dated ones. |
| **OQ-48** | **Report calculation gaps.** (a) Distance for a period is "the last odometer reading in the period minus the last reading before it". What if there is no earlier reading (the first period, or "all time")? Does the odometer entered when the vehicle was added count as a reading? Do a trip's start and end odometers count? (b) Odometer checks only warn, so a typo or back-dated reading can distort distance and cost per km. (c) "Cost per day" needs the period length. How is it defined for "all time" and for a vehicle with a short history? (d) The Dashboard shows "last mileage", but for bi-fuel vehicles the headline figure is cost per km (a Logging decision). Which is shown for a bi-fuel vehicle? (e) "For gig drivers" and "shown only when the vehicle has income entries": is a gig driver a vehicle with income entries, or a setting? (f) Does net profit include trip reimbursements (see OQ-44)? (g) In "All vehicles", per-currency totals: how is cost per km or distance shown per currency when units differ (OQ-19)? | These decide `domain/reports.ts` and the tests for it. | Tab 4 | **Decided.** The vehicle's starting odometer and a trip's start and end odometers count as readings. All-time distance is the last reading minus the starting odometer. Cost per day uses the period length (all time starts at vehicle creation). A bi-fuel Dashboard shows cost per km instead of last mileage. A gig-driver view means the vehicle has income entries. Net profit excludes trip reimbursements. |
| **OQ-49** | **Where "All vehicles" lives.** The navigation text says all tabs are scoped to the selected vehicle (FR-NAV-02), and the vehicle switcher lists vehicles. "All vehicles" is a Reports view across vehicles. Is it an entry in the switcher, or a control on the Reports tab only, and does it change the scope of the other tabs? Also, archived vehicles are hidden from the switcher, so how does a user open a per-vehicle report of an archived vehicle (its entries are kept for lifetime reports)? | Foundation's navigation shell must support it. | Foundation / tab 4 | **Decided.** "All vehicles" is an entry in the vehicle switcher that changes only the Reports tab. The other tabs keep the last single vehicle. Archived vehicles are reachable through the include-archived toggle and More → Vehicles. |
| **OQ-50** | **Names.** The Drive decisions used the folder name "Vehicle Manager" and a file prefix `vehicle-manager-backup-…`. The app name is **Milevana**. What are the Drive folder name and the backup file prefix? (They are shown as "to be confirmed" in both documents.) | Names are user-visible in the user's Drive, and cannot easily change once backups and receipts exist. | Tab 5 | **Decided.** The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-`. |
| **OQ-51** | **Delete, Undo and Drive cleanup.** (a) Deleting an entry deletes its Drive files, but History offers "Delete with an Undo option" (a Logging decision). Is the Drive file deleted immediately, or after the Undo window? If immediately, Undo would restore an entry whose receipt is gone. (b) Deleting a vehicle deletes entries in batches (§8.2), but nothing says whether its Drive receipts and `Receipts/<vehicle name>/` folder are deleted. For account deletion it is now decided that receipts stay in the user's Drive; for ordinary vehicle deletion it is still open. (c) An owner or member deleting an entry whose attachment another member uploaded cannot delete that file ("if you uploaded it"). Is the file left orphaned? | Drive files are the user's data and count against their storage. | Tab 5 | **Decided.** Entry deletion deletes the Drive files after the Undo window (see OQ-45). Deleting a vehicle deletes the receipt files the user uploaded and that vehicle's receipt folder, after the typed-name confirmation. Files uploaded by other members stay in their own Drives. For account deletion, receipts stay in the user's Drive. |
| **OQ-52** | **CSV.** (a) "Amounts are written as normal decimals in rupees", but vehicles and entries have their own currency (ISO 4217 list), and the Reports decisions say totals are per currency and never converted. Which currency is written for a non-INR entry, and is there a currency column in a combined "all vehicles" CSV? (b) Decimal digits depend on each currency's minor-unit exponent (OQ-31). (c) The flattened service cell lists line items; where do the optional labour and discount appear? (d) "Common columns plus type-specific ones": which columns? (e) Trip and reimbursement columns. | The CSV is the user's way to take their data elsewhere. | Tab 5 | **Decided.** Amounts are plain decimals with a Currency column, and decimal digits follow each currency. Labour and discount have their own columns. The file is UTF-8 with a byte-order mark. |
| **OQ-53** | **Backup and restore semantics.** (a) "Restore what's missing, ask about the rest": what counts as "missing" and what is "the rest" (items that exist but differ)? Restoring "missing" entries brings back ones the user deleted on purpose after the backup. Is that acceptable? (b) Which backup does restore use (latest, or the user's choice from the list), and are settings restored? (c) The backup file marks shared vehicles and includes their members' entries, names and emails, but restore only touches vehicles the user owns. Why include non-owned shared vehicles, and how is other members' personal data in the user's Drive handled? (d) The account-merge serializer covers checklist templates, but the backup contents list only settings, vehicles, entries and reminders. Are checklist templates in the backup? (Templates are now decided to live on each vehicle, so they are vehicle data.) (e) The default setting is automatic weekly backup, while Drive access is requested the first time a Drive feature is used. Does automatic backup stay off until the user grants Drive access? Does automatic backup run on web? (f) Restore writes many documents (batch limits, quota; OQ-35, OQ-18) and has the `createdBy` problem (OQ-22). | Restore can overwrite or resurrect user data. | Tab 5 | **Decided.** Items in the backup that no longer exist are restored. Where a vehicle exists but differs, the app asks once per vehicle: keep current or replace with the backup's copy. The summary warns that entries deleted on purpose after the backup will return. Settings are not restored unless ticked. Restore lists backups with the latest preselected. Backups contain settings and owned vehicles only, with their entries, reminders and checklist templates. Members of an owned vehicle appear by name only, with no emails. Automatic backup stays off until Drive access has been granted once. |
| **OQ-54** | **Drive details to verify.** (a) `Receipts/<vehicle name>/` is keyed by name, but the schema stores only root, backups and receipts folder ids. Renaming a vehicle or two vehicles with the same name: what happens? (b) With the `drive.file` scope, can files created by the Android sign-in client be seen by the web client (and the reverse)? "Backup and restore work on web too" depends on it. **[External — verify]** (c) The camera option may need the Android CAMERA permission. The Foundation text only rules out broad media and location permissions. Is it acceptable, and does it appear in Play's data-safety form? **[External — verify]** (d) Do attachments work on web, where the offline queue does not apply? | These affect whether the decisions can be built as written. | Tab 5 | **Decided.** Per-vehicle receipt folder ids are stored in the user's own settings, so renames do not move folders. Android and web use one Google project so `drive.file` visibility can be verified. The camera permission is accepted and declared. |
| **OQ-55** | **Invites, joining and roles.** (a) Does the 10-member limit include the owner, and how do the rules enforce it? (b) Can an owner leave a vehicle, or must they transfer ownership first? (c) A joiner is not yet a member and cannot read the vehicle (reads are members-only), so what does the join screen show, and where does that information come from? (d) The join write changes two documents (vehicle and invite) and must check validity, expiry and the member limit; this needs the rules to read across documents (see OQ-35). (e) Invite codes like K7QX-M2PA are short, and any signed-in user can try codes. What guards against guessing, given that anonymous accounts are free to create? (f) When the owner archives a vehicle, does it disappear from every member's switcher, and who can unarchive it? (g) What if the joiner is an anonymous user whose Google account already has data (the merge path)? | These decide the tab 6 rules and their adversarial tests. | Tab 6 | **Decided.** The 10-member limit includes the owner and is enforced in rules. An owner must transfer ownership or delete the vehicle rather than leave. The invite document carries the vehicle name and owner name for the join screen. Codes are 8 characters from an unambiguous alphabet. Archiving hides the vehicle for all members, and only the owner can unarchive it. |
| **OQ-56** | **Receipt access catch-up.** (a) Revocation is delayed. A removed member keeps Drive read access to a receipt until that receipt's uploader next opens the app, and indefinitely if the uploader never does. Is that acceptable? (b) After removal the member's record is gone from `members`, so how does the uploader's phone find the removed person's email to revoke access? (c) A receipt uploaded by a member who has left stays visible only to members who already had access. Can members who join later see it? The leaver cannot update the entry's `sharedWithUids`, because only the creator or the owner can update an entry. (d) The same applies when an attachment's uploader is neither the entry's creator nor the current owner (for example, a former owner after a transfer). (e) "Check the receipts you uploaded to shared vehicles on every app open" needs a way to find them. Firestore cannot query on a field inside an array of maps, and each new member means one Drive permission call per receipt (reads and API calls on every open; OQ-18). (f) Receipts a leaver uploaded stay visible "until they delete them": who is "they" after the leaver can no longer edit the vehicle's entries? | Revocation and visibility of users' receipts is a security and privacy matter. | Tab 6 | **Decided.** Revocation is delayed until the uploader's app opens or returns to the foreground, and the removal confirmation and the privacy policy say so. Revocation reads the file's Drive permission list. Members who join later cannot see receipts from a member who left, and an uploader who is neither the entry's creator nor the owner cannot update sharing; both are accepted limitations. Entries gain an `uploaderUids` array so a phone can find the receipts it uploaded. |
| **OQ-57** | **Hosting and App Links sequencing.** Invite links need Android App Links verified on the Hosting domain, which means the domain is live with its verification file and the release signing certificate fingerprint is known **[External — verify]**. Web deployment is a tab 8 item, but invite links are tab 6. The Release decisions assign the web deploy, `/join/:code` and the App Links verification file to tab 8, but invite links are needed in tab 6. Which tab sets up Hosting and the domain, and does the web join page need a deployed web app earlier? | Tab 6 cannot ship working invite links without it. | Tab 6 / tab 8 | **Decided.** Sub-project 6 deploys Hosting at `milevana.poovarasu.dev` with `/join/:code` and the Android App Links file at its start. Sub-project 8 then adds `/privacy`, `/terms`, `/delete-account` and the landing page. |
| **OQ-58** | **Member data and visibility.** Members can see each other's names and Google emails, and the backup of a shared vehicle includes them (OQ-53). How is this disclosed in the privacy policy? How long do a removed member's name and email remain (on entries as `createdByName`, and in backups)? | Other people's personal data is shared among members. | Tab 6 / tab 8 | **Decided.** The privacy policy discloses that members see each other's names and emails. A leaver's email is removed from `members`, and their name stays on entries. |
| **OQ-59** | **20 templates per vehicle.** Security rules cannot count the documents in a subcollection, so the limit needs another mechanism. A counter on the vehicle document would have to be written by any member who creates a template, but members may update only `lastOdometer`, `lastOdometerAt` and `updatedAt` on a vehicle (the Foundation exception). Is the limit enforced by rules (how), or only by the app? Does a copy count against the destination's limit, and what happens when the destination is full? **[External — verify]** | The source enforces "at most 50 items" in rules, and the 20-template limit is stated alongside it. | Tab 7 | **Decided.** Enforced by the app only, because rules cannot count documents. A copy to a vehicle that is full is blocked. |
| **OQ-60** | **Checklist details.** (a) The inspection entry stores a snapshot of item labels and results. Photos are tagged with an item through `attachments[].itemId`. Do snapshot items have their own stable ids for this to point to? (b) Are the starter templates offered by vehicle type (for example, Two-wheeler for bikes and scooters), or does the user choose from all three? Starters are English text; do they go through i18n? (c) "Copy to another vehicle" lists every vehicle the user is a member of: are archived vehicles included? Can a member copy a template to a vehicle where they are not allowed to create one? (d) Does an inspection entry have an `amount`? Rules require an integer `amount.minor` on create (OQ-31). (e) History search covers notes and categories: does it cover item notes inside an inspection? (f) Item and note text lengths are not limited, and an inspection snapshot can hold up to 50 items with notes (document size; OQ-33). | These decide the template and inspection shapes and their rules. | Tab 7 | **Decided.** Snapshot items get stable ids. Starters are offered by vehicle type (car, truck, bus and other: Car pre-trip and Long trip; bike and scooter: Two-wheeler and Long trip), and the user can pick any. The copy list excludes archived vehicles. Inspections have no `amount`. Search does not cover item notes. Rules cap text lengths. |
| **OQ-61** | **Release decisions that conflict with existing text.** (a) **Custom domain.** The suggestion is to buy a custom domain (about ₹800–1,200 a year) for the consent screen and call it the app's only fixed cost. The decided web address is `milevana.poovarasu.dev`, a subdomain of the existing portfolio domain, and the Cost row says everything except the one-time US$25 uses free tiers or the existing domain. Is a new domain needed, or can the existing one be verified for the consent screen? (b) **Welcome screen.** The decision adds a single welcome screen ("Free. No ads. Your data stays yours." → Get started) before adding a vehicle. Principle P4 and FR-AUTH-04 say the app opens straight into adding a vehicle, and AC-F1 requires reaching "Add your first vehicle" with no sign-in screen. Is a welcome screen allowed? If so, P4, FR-AUTH-04, AC-F1 and the Maestro first-launch flow change. (c) **Timeline.** "About 3 weeks between app finished and public on Play" suggests the 14-day gate starts after the app is finished, but the same decision starts the closed test as early as tab 2 so it runs in parallel. Which is the plan, and what is the remaining wait after the app is finished? | (a) and (b) contradict the stated identity, cost and first-launch principle. (c) sets the launch date. | Tab 8 | **Decided.** Keep `milevana.poovarasu.dev`; no new domain is bought. Android shows one welcome screen ("Free. No ads. Your data stays yours." then Get started) before adding the first vehicle, and web has a landing page with comprehensive content and screenshots. The closed test starts after sub-project 2 and runs in parallel with sub-projects 3 to 7, so the wait after the app is finished is Google's production-access review. |
| **OQ-62** | **Account deletion semantics.** (a) "Hand to a member, with a choice per vehicle": is the choice which member receives the vehicle, or hand over versus delete? What is the default recipient? Does the recipient have to accept, given that the owner's write sets `ownerId`? What is a vehicle "only you use" (no other members)? (b) Entries the user logged on vehicles they leave keep their name ("Logged by Priya"; Sharing decisions), and `members` holds their email until they leave. Are they deleted, anonymised, or kept? This bears on whether the deletion is complete. (c) "Resumable: progress is recorded": where, given that `users/{uid}` is deleted at the end and the app must still be signed in to delete data? In what order are data and the Firebase account deleted, and is a second re-sign-in required when resuming? What if the app is reinstalled mid-deletion? Recording progress needs a field, which is a schema addition. (d) Receipts and backups stay in the user's Drive; the summary links to the folder. The Drive decisions say deleting an entry deletes the Drive file, so account deletion is a special case (OQ-51). (e) Anonymous users can delete without re-sign-in, but the web deletion page needs Google sign-in, so an anonymous user has no route outside the app. (f) Anonymous accounts abandoned by a merge cannot be deleted (L3); the policy must not promise full deletion for them. (g) After deletion on Android, is `clearPersistence()` called (OQ-24)? | These decide whether deletion meets the privacy policy and Play's account-deletion requirement. | Tab 8 | **Decided.** For each shared vehicle the user owns, the summary pre-selects the longest-standing member as the new owner. The user can pick another member or delete that vehicle instead, and the new owner needs no acceptance. Entries logged on vehicles the user leaves keep the user's name. Progress is stored on `users/{uid}`. Data is deleted first and the Firebase account last, and resuming needs a fresh re-sign-in. Anonymous users can delete in-app only. The policy states that entries logged on others' vehicles keep the user's name. `clearPersistence()` runs after deletion. |
| **OQ-63** | **Play and policy declarations to verify.** (a) The data-safety form lists account info, app content and crash logs, "not shared". Crashlytics also assigns an installation id, receipts are photos and PDFs in the user's Drive, and members' names and emails are visible to each other; do any need declaring? **[External — verify]** (b) The policies must state what is collected; does that list include members' emails seen by other members, and the camera permission (OQ-54)? (c) The Limited Use statement wording for Drive access. (d) Whether the policy and deletion route must exist before the closed test starts (OQ-16). | A mismatch between the form, the policy and the app can fail Play review. | Tab 8 | **Decided.** Declare crash logs and the Crashlytics installation id, state that receipts live in the user's Drive, and mention members' emails and the camera permission. Verification pending: what Play requires. |

---

## 28. Deferred Decisions

Decisions the source explicitly places elsewhere or in the future.

| ID | Decision | Deferred to |
| --- | --- | --- |
| DD-01 | Entry detail shapes, fuel calculations and categories (tab 2). Reminder schema, auto-complete and km-per-day prediction (tab 3). Report metrics and charting library (react-native-gifted-charts) (tab 4). Backup format, restore behavior, receipt upload queue and CSV format (tab 5; the main decisions are now recorded, see §23.5). Invites, roles, ownership transfer and receipt sharing (tab 6). Checklist templates stored per vehicle (tab 7). Account deletion, policies, consent screen and launch timeline (tab 8). | The respective tab |
| DD-02 | A **future paid tier**, which may only add features with real running or build cost (fleets or advanced reports). | After v1 |
| DD-03 | **Email/password sign-in.** "Later, if users ask." | After v1 |
| DD-04 | **Fleets and business management** (the data model must not block them). | After v1 |
| DD-05 | **Moving to the Blaze plan.** Decided against (OQ-18): the project stays on the free plan, and a quota hit pauses sync until the daily reset. | Not planned |
| DD-06 | Whether members can view other members' receipts in-app (the `drive.file` spike); fallback is an Open in Drive button. Receipts are now decided to be auto-shared with members via Drive permissions, so this question is only about in-app viewing. | Tab 6 |
| DD-07 | Account deletion design (with sharing). The main flow is now decided (§23.8); the open points are OQ-62. | Tab 8 |
| DD-08 | Items excluded from v1: GPS route tracking, GPS location for fuel stations, importing from other apps, a local-only mode, vehicle photos, payment-method tracking, recurring auto-entries, PDF or image export of reports, scheduled inspections, checklist-specific reports, number or text checklist item types, iOS, over-the-air code updates. | Not scheduled |
| DD-09 | Additional languages beyond English. All text is i18n-ready, but the source does not say when other languages follow. | Not scheduled |
| DD-10 | **App Check.** Not in v1 (OQ-33). | Not scheduled |

---

## 29. Risks and Constraints

### 29.1 Constraints [Source]

| ID | Constraint |
| --- | --- |
| RK-01 | **Free tier only:** Spark plan; no Cloud Functions or API server. Server-side logic is unavailable. |
| RK-02 | **Daily quota:** 50,000 Firestore reads and 20,000 writes per day. Beyond that, requests fail until the daily reset. |
| RK-03 | **Rules are the whole backend** and the last line of defence; every path denied by default. |
| RK-04 | **Rules cost:** each subcollection request makes one billed `get()` on the parent vehicle. |
| RK-05 | **Permanent identifiers:** the Android package `dev.poovarasu.milevana` (after first Play release) and the Firebase project id (once created). |
| RK-06 | **Google Play gate:** closed test with 12+ testers for 14 days, plus a one-time US$25 registration. |
| RK-07 | **Native modules** need Expo development builds, not Expo Go. |
| RK-08 | **Play photo-permission declaration** must never be needed: strip `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE`. |
| RK-09 | **File storage** must be the user's Drive (`drive.file`), because Firebase Storage needs Blaze. |
| RK-10 | **No OTA code updates** in v1. |
| RK-11 | Android requires the network once at first launch. |

### 29.2 Risks

| ID | Risk | Source or PRD observation | Mitigation in source |
| --- | --- | --- | --- |
| RK-12 | **Anonymous data loss** on uninstall before linking or exporting a CSV. | Source | The app says so plainly; link prompt after the 5th entry; persistent banner on More; required link before Drive features. |
| RK-13 | **Merge failure partway**, with the anonymous account unrecoverable. | Source | Data kept in memory and on disk; deterministic ids; batches of 500; retry offered. |
| RK-14 | **Orphaned documents** from abandoned anonymous accounts, undeletable without server code. | Source | Accepted. A few KB per case. |
| RK-15 | **Quota exhaustion** halts sync for all users until the daily reset. | Source | Graceful messaging on Android and web. Any production `resource-exhausted` non-fatal triggers a usage review; the project stays on the free plan. |
| RK-16 | **Stale propagation** of reminder edits and receipt sharing to members' phones. | Source | Accepted limitation. |
| RK-17 | **Receipt visibility for members** depends on the `drive.file` spike. | Source | Open in Drive fallback. |
| RK-18 | **Rules errors are the single point of security failure**, because there is no server layer. | PRD observation of the source's "rules are the entire backend" | Full rules matrix tested allowed and denied on every push; adversarial tests for tab 6. |
| RK-19 | **Foundation exit criteria ambiguity** over which rules must pass (OQ-04, blocking). | PRD observation | Resolve before Foundation rules work. |
| RK-20 | **Detailed designs for tabs 2–8 are absent** from the source (OQ-01). | PRD observation | Obtain or produce each tab's design before implementation. |
| RK-21 | **`lastOdometer` correctness**, since members may write it and a batch cannot read (OQ-17). | PRD observation | Decided: recomputed by the client; rules require a non-negative number; corrects itself on the next entry or refresh. |
| RK-22 | **Web is online-only**, so unsynced web writes would live only in memory. | Source | Saving is disabled when offline. |
| RK-23 | **No quantified success metrics or capacity assumptions** (OQ-02, OQ-18). | PRD observation | Define before launch. |
| RK-24 | **One client can exhaust the project-wide daily quota** because anonymous sign-in is open, any signed-in user may create vehicles, and no count or size limits are stated (RT-10, OQ-33). | PRD review (RT-10) | Field limits in rules; no App Check; accepted limitation (OQ-33). |
| RK-25 | **Capacity on the free plan**: with no Blaze fallback (decided), a busy day pauses sync for everyone until the daily reset (RT-01, OQ-18). | PRD review (RT-01) | Budgeted for roughly 100 to 500 daily active users, cache-first reads with a refresh control, and the weekly usage check. The per-operation count is gate G2. |
| RK-26 | **The rules may reject the Foundation merge** (`createdBy`, timestamp rule, `get()` ordering), blocking AC-F3 (RT-02, OQ-22). | PRD review (RT-02) | Decided (OQ-22, OQ-35). Spike G3 verifies. |
| RK-27 | **Silent data loss** on sign-out with pending writes, or on a queued write that is later rejected (RT-06, RT-07, OQ-24, OQ-26). | PRD review (RT-06, RT-07) | Decided (OQ-24, OQ-26). Test G5 verifies. |
| RK-28 | **Closed testers may be unable to link Google** if the consent configuration is not ready (RT-12, OQ-28). | PRD review (RT-12) | Decided (OQ-28). Test G6 verifies. |
| RK-29 | **Batches of 500 may exceed rules access-call limits** (RT-04, OQ-35). | PRD review (RT-04), [External — verify] | Decided (OQ-22, OQ-35). Spike G3 verifies. |
| RK-30 | **The frozen fuel details shape may lose information** (US versus UK gallons, price precision) (RT-09, OQ-30). | PRD review (RT-09) | Decided (OQ-30). Fixtures G7 verify. |
| RK-31 | **The native offline path and the merge flow have no automated end-to-end coverage** (RT-13, OQ-37). | PRD review (RT-13) | Maestro airplane-mode flow, manual checks, and an emulator merge test (OQ-37). |

---

## Appendix A. Source Traceability

| Source section (`docs/requirements.md`) | PRD sections |
| --- | --- |
| v1 product brief: audiences | §1, §3 |
| v1 product brief: product principles | §4, §7 (PR-01 to PR-05), §20 |
| v1 product brief: platform and backend decisions | §11.1, §12, §22 |
| v1 scope and sub-projects: features, not-in-v1 | §5, §6 |
| v1 scope and sub-projects: eight tabs | §5.2, §23, §24 |
| Foundation: goals and scope (done when, in/out scope) | §2.3, §5.3, §23.1, §25.1 |
| Architecture: layers, adapter, repositories, state, offline writes | §8.3, §12, §16 |
| Architecture: libraries, build config, rejected alternatives | §6.4, §8.5, §11.2–§11.3 |
| Data model: structure, rationale, fuel details, YAGNI | §13, §6.5 |
| Security rules: matrix, later-tab rules, validation, exception, cost | §15 |
| Sign-in and account flows: first launch, linking, conflict, sign-out | §10, §14 |
| Navigation, vehicles and settings | §8.2, §17, §18 |
| Accessibility | §9 (NFR-11), §17.6 |
| Error handling: table, Crashlytics rule, production signal | §19 |
| Testing and CI | §21, §22 |
| Limitations, open questions and deferred decisions | §11.4, §26, §27, §28 |
| Sources | Appendix C |
| Logging, Reminders, Reports, Drive, Sharing, Checklists and Release decisions (added 2026-10-06) | §23.2 to §23.8 |
| Decisions on open questions (2026-10-06) | §27 and the sections each decision changes |
| Schemas | Appendix E |

## Appendix B. Glossary (terms as used in the source)

| Term | Meaning |
| --- | --- |
| **Tab / sub-project** | One of the eight design units of v1, built in dependency order. "Tab N" and "sub-project N" are interchangeable. |
| **Foundation** | Sub-project 1: the base app, data model, rules, auth and vehicle management. |
| **Anonymous user** | An Android user signed in with `signInAnonymously()`, with no Google account linked. |
| **Linking** | Attaching a Google credential to the anonymous account with `linkWithCredential`, keeping the uid. |
| **Account merge** | The on-device move of an anonymous user's data into an existing Google account, via the shared serializer. |
| **Adapter** | `firebase.native.ts` or `firebase.web.ts`: the only layer that knows which SDK is running. |
| **Repository** | The only layer that touches Firestore. It validates reads with zod. |
| **Serializer** | The export/import format shared by account merge, Drive backup and restore. |
| **Minor units** | Integer money amounts, e.g. 245000 for ₹2,450.00. |
| **`lastOdometer`** | Denormalized maximum odometer on the vehicle, written in the same batch as an entry. |
| **Spark / Blaze** | Firebase's free plan / paid plan. |
| **`drive.file`** | The Google Drive scope limited to files the app creates or opens. |
| **Pending-sync icon** | The icon shown on items with pending writes (`hasPendingWrites`). |
| **Owner / member** | Vehicle roles. |
| **Starters** | Starter checklist templates (tab 7). |
| **Spike** | A short investigation, here the `drive.file` spike in tab 6. |

## Appendix C. Sources cited by the requirements document

- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloud Storage for Firebase plan change FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Play testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Drivvo on Google Play](https://play.google.com/store/apps/details?id=br.com.ctncardoso.ctncar)

## Appendix D. Red-team review log

Findings from the red-team review of this PRD against `docs/requirements.md`. "Mechanical check" means 84 code tokens, numbers and quoted strings from the source were all found in the PRD; no source requirement had been dropped.

| Finding | Severity | Summary | PRD change made |
| --- | --- | --- | --- |
| RT-01 | Critical | Quota and capacity budget; Blaze versus "free forever" | OQ-18 expanded and made blocking; NFR-06 note; RK-25; gate G2 |
| RT-02 | Critical | Rules versus merge and restore (`createdBy`, timestamps, `get()` ordering) | OQ-22 (blocking); §14.4 edge case; §15.9; AC-D21; RK-26; gate G3 |
| RT-03 | Critical | Firebase project id | OQ-03 marked blocking; gate G1 |
| RT-04 | High | Batches of 500 versus rules access-call limits | OQ-35 (blocking); §14.4; §15.7; §15.9; NFR-18 note; RK-29 |
| RT-05 | High | AC-F6 contradicts the rules deferral | AC-F6 annotated as not verifiable; OQ-04 blocking; RK-19; gate G4 |
| RT-06 | High | Sign-out loses pending writes; privacy scope | §14.6 open points; OQ-24; RK-27; gate G5 |
| RT-07 | High | Rejected queued writes are invisible | §16.4 open points; OQ-26; RK-27 |
| RT-08 | High | Currency "converts" is ambiguous | §18.2 edge case; OQ-29 |
| RT-09 | High | Fuel shape: `gal` and price precision | §13.7; OQ-30 (blocking); RK-30; gate G7 |
| RT-10 | High | Abuse and missing limits | §15.9; OQ-33; RK-24 |
| RT-11 | High | Merge resume and undefined outcomes | §14.4; OQ-06 reworded; OQ-23 |
| RT-12 | High | Consent screen and OAuth sequencing | §14.8; §24.4; OQ-28; RK-28; gate G6 |
| RT-13 | High | Testing gaps | §21.5; OQ-37; RK-31 |
| RT-14 | Medium | Maestro "link Google" feasibility | §21.5 gap 3; OQ-37 |
| RT-15 | Medium | Owner updates unconstrained; membership duplicated | §13.7; §15.9; OQ-34 |
| RT-16 | Medium | `lastOdometer` "maximum" cannot be enforced | §8.3 edge case; OQ-17 expanded |
| RT-17 | Medium | `amount` optionality, sign, currency, exponents | §13.7; OQ-31 |
| RT-18 | Medium | `hours` and unit interplay | §18.2; OQ-11 expanded |
| RT-19 | Medium | `date` type and financial year | §13.7; OQ-32 |
| RT-20 | Medium | "Without migrations" versus upgrade on read | NFR-09 note; OQ-40 |
| RT-21 | Medium | Crash reports may carry invite codes and uids | §20.3; OQ-36 |
| RT-22 | Medium | Orphaned documents hold personal data | §20.3 cross-reference to OQ-15 |
| RT-23 | Medium | Web offline detection; popup sign-in | §16.4; §14.5; OQ-27 |
| RT-24 | Medium | CI/CD gaps | §22.5; OQ-38 |
| RT-25 | Medium | Play declarations before the closed test | §22.5; OQ-16 expanded |
| RT-26 | Medium | Same-uid assumption behind AC-F4 | §14.5; OQ-25 |
| RT-27 | Medium | PRD labeled inference as source | §6.4 split; §26 header and L8 to L10 tagged [Derived]; §5.4 and §16.1 corrected; §14.4 asserted outcome removed; OQ-06 reworded |
| RT-28 | Medium | Acceptance criteria not measurable or mapped | §25.1 verification mapping; AC-F5 and AC-F7 marked unmapped |
| RT-29 | Low | First-launch bootstrap not idempotent | §14.2 edge case; OQ-39 |
| RT-30 | Low | Selected-vehicle persistence; archived vehicles | §8.2 edge row; OQ-39 |
| RT-31 | Low | Derived criteria could be read as source | §25.2 note |
| RT-32 | Low | Adapter interface scope | §12.5 note |
| RT-33 | Low | DNS and domain verification dependencies | §24.4 row |

Also corrected: a cross-reference in §18.2 that cited OQ-12 where OQ-19 was meant.

After the review, `requirements.md` was updated with the service-entry decision (one `service` entry with line items). The PRD change is in §13.3.1, §23.2, §23.3 and OQ-41. The review's §23.7 wording about `attachments[].itemId` was also corrected, because it had stated an inference as if the source said it.

On the same date, `requirements.md` gained a "Logging: decisions for tab 2" section (fuel input, categories, trips, sanity checks, History, left-out items) and "GPS location for fuel stations" in the Not-in-v1 list. The PRD change is in §6.1, §23.2 to §23.4, DD-08 and OQ-42 to OQ-45. OQ-42 to OQ-45 are recorded as awaiting a product decision; nothing in them has been resolved.

The Reminders decisions were then added to `requirements.md` ("Reminders: decisions for tab 3", and the Mute reminders row in the Settings table). The PRD change is in §17.2, §18.1, §23.3 and OQ-41, OQ-42, OQ-46 and OQ-47. OQ-46 and OQ-47 are recorded as awaiting a product decision.

The Reports decisions were then added to `requirements.md` ("Reports and dashboard: decisions for tab 4"). The PRD change is in §17.2, §23.3, §23.4 and OQ-18, OQ-19, OQ-32, OQ-42, OQ-44, OQ-47, OQ-48 and OQ-49. OQ-19 is partly decided (per-currency totals, never converted). OQ-48 and OQ-49 are recorded as awaiting a product decision; OQ-49 may conflict with the navigation text in §17.1.

The Drive and export decisions were then added to `requirements.md` ("Drive and export: decisions for tab 5"). The PRD change is in §23.5, DD-01 and OQ-13, OQ-20, OQ-22, OQ-41, and OQ-50 to OQ-54. The folder name and file prefix "Vehicle Manager" from the decision text were not adopted, because the app is named Milevana; they are shown as to be confirmed (OQ-50). OQ-50 to OQ-52 are possible conflicts with existing text and are recorded as awaiting a product decision.

The Sharing decisions were then added to `requirements.md` ("Sharing: decisions for tab 6", and the rules bullet under "Paths and rules added by later tabs"). The PRD change is in §15.4, §23.6, DD-06 and OQ-04, OQ-15, OQ-18 and OQ-55 to OQ-58. The decision that photos are auto-shared is recorded. OQ-55 to OQ-58 are recorded as awaiting a product decision; OQ-56 is a possible conflict with the security intent.

The Checklist decisions were then added to `requirements.md` ("Checklists: decisions for tab 7", and two items in the Not-in-v1 list). The PRD change is in §6.1, §13.2, §23.7, DD-08 and OQ-41, OQ-53, OQ-59 and OQ-60. The data model already stored templates under each vehicle, so no data-model change was made. OQ-59 is a possible conflict with the vehicle-update rule and is recorded as awaiting a product decision.

The Release decisions were then added to `requirements.md` ("Release: decisions for tab 8"), except for two held items: buying a custom domain, and a welcome screen before adding the first vehicle. These conflict with existing text and are recorded in OQ-61 as awaiting a product decision. The PRD change is in §14.7, §23.8, §24.5, DD-07 and OQ-15, OQ-16, OQ-28, OQ-51, OQ-57 and OQ-61 to OQ-63.

On 2026-10-06 every open question was decided: the blocking and conflicting items by the product owner's answers, and the rest by proposed defaults the product owner approved. `requirements.md` gained "Decisions on open questions" and "Schemas". In this PRD the decisions are in §27 and in the sections they change. The changes that replaced earlier statements are:

- **Welcome screen:** principle P4, FR-AUTH-04, PR-04, G5 and AC-F1 now allow one welcome screen on Android. Web gets a landing page.
- **Billing:** the project stays on the free plan with no Blaze fallback. The production signal now triggers a usage review (§19.4, DD-05).
- **AC-F6:** amended so Foundation writes the template rules and ships default-deny for invites and related paths (OQ-04).
- **Rules:** timestamps are checked as not in the future instead of equal to `request.time` (FR-SEC-10).
- **Fuel shape:** `quantityUnit` splits gallons into US and UK, and `pricePerUnitMinor` becomes `pricePerUnitMilli` (§13.3).
- **Currency setting:** it no longer "converts" amounts (FR-SET-03).
- **Backup scope:** backups contain only the vehicles the user owns.

## Appendix E. Schemas (approved 2026-10-06)

**Status: approved on 2026-10-06.** These field-level shapes were drafted on 2026-10-06 to complete the tab designs, and the product owner approved them the same day. They follow the product decisions recorded in this document. Changes after approval should be recorded as new decisions.

### Entry additions

- `uploaderUids`: an array of uids, one for each member who has uploaded an attachment on the entry. It lets a phone find the receipts it uploaded without scanning every entry (OQ-56).
- `attachments[].itemId`: for an inspection photo, the id of the checklist item (in the entry's snapshot) that the photo is tagged with. Not used by other entry types.
- `category`: set on expense, service and income entries from the fixed lists. Fuel and trip entries have no category.
- `amount`: present only on fuel, expense, service and income entries (OQ-31).

### Fuel details (`details` on a `fuel` entry)

| Field | Meaning |
| --- | --- |
| `fuelType` | petrol, diesel, CNG, LPG or electric |
| `quantity` | A decimal quantity |
| `quantityUnit` | L, gal_us, gal_uk, kg or kWh |
| `pricePerUnitMilli` | Price per unit as an integer in thousandths of a minor unit |
| `fullTank` | Boolean, on by default |
| `missedPrevious` | Boolean toggle |
| `stationName` | Optional free text |
| `chargingLocation` | Optional, `home` or `public`, for electric only |

The user enters any two of price per unit, quantity and total, and the app calculates the third. The total is the entry `amount`, in integer minor units.

### Service details (`details` on a `service` entry)

| Field | Meaning |
| --- | --- |
| `lines` | An array of `{ id, serviceType, otherLabel?, costMinor }`. `serviceType` is a value from the Services list or `other` (with `otherLabel` free text). `costMinor` is an integer in minor units. |
| `labourMinor` | Optional integer in minor units |
| `discountMinor` | Optional integer in minor units. A fixed amount, not a percentage. |

The entry `amount.minor` is the stored total: the sum of the line costs, plus labour, minus discount, never below zero. The entry also has one `category` from the Services list, and up to 5 attachments. The discount is a fixed amount, not a percentage (approved).

### Trip details (`details` on a `trip` entry)

Fields: `startAt` and `endAt` (timestamps), `startOdometer` and `endOdometer` (in the vehicle's unit), `distance` (calculated), `from` and `to` (text), `purpose` (`business` or `personal`), `ratePerUnitMilli` (optional, thousandths of a minor unit per odometer unit), and `reimbursementMinor` (calculated when a rate is set). A trip has no entry `amount` and no `category`. The entry `date` is the trip's start date. A trip never creates an income entry.

### Inspection details (`details` on an `inspection` entry)

Fields: `templateName` (snapshot), `items` (an array of `{ id, label, group?, result, note? }`, where `result` is `pass`, `fail` or `na`), and `issueCount` (the number of `fail` items, for the History badge). An inspection has no `amount` and no `category`.

### Reminder (`vehicles/{id}/reminders/{reminderId}`)

| Field | Meaning |
| --- | --- |
| `title` | Pre-filled from the subject, or a custom title |
| `subject` | `{ kind, serviceType?, category? }`, where `kind` is `service`, `expense` or `custom` |
| `dateTrigger` | Optional `{ dueDate, repeatEveryMonths? }` |
| `odometerTrigger` | Optional `{ dueOdometer, repeatEveryDistance? }`, in the vehicle's unit |
| `leadDays` | Days before the due date to notify. Default 7. Adjustable per reminder. |
| `leadDistance` | Distance before the due odometer to notify. Default 500. Adjustable per reminder. |
| `amountMinor` | Optional integer, for recurring payments such as EMI |
| `status` | `active` or `done` |
| `completedAt`, `completedByEntryId` | Set by auto-complete or "Mark done" |
| `createdBy`, `createdAt`, `updatedAt`, `schemaVersion` | Audit fields |

Snooze is not stored here. It is per user and kept on the device. At least one of `dateTrigger` and `odometerTrigger` is required.

### Invite (`invites/{code}`)

Fields: the document id is the 8-character code. `vehicleId`, `vehicleName`, `ownerId`, `ownerName`, `createdBy`, `createdAt`, `expiresAt` (7 days after creation), `usedBy` and `usedAt` (set by the join write). Cancelling an invite deletes the document. An invite is valid when it is unused, not expired, and the vehicle has fewer than 10 members.

### Checklist template (`vehicles/{id}/checklistTemplates/{templateId}`)

Fields: `name`, `items` (an array of up to 50 `{ id, label, group? }`), `createdBy`, `createdAt`, `updatedAt`, `schemaVersion`. The 20-templates-per-vehicle limit is enforced by the app only.

### User record additions (`users/{uid}`)

- `drive.vehicleFolderIds`: a map from vehicle id to the Drive receipt folder id.
- `deletion`: present only during account deletion. `{ status, startedAt, handoffs, completedSteps }`, where `handoffs` maps each owned shared vehicle to the new owner's uid or to `delete`.

### Backup file

One JSON file named `milevana-backup-YYYY-MM-DD-HHMM.json`. Top level: `formatVersion`, `createdAt`, `kind` (`manual` or `automatic`), `app` (name and version), `settings`, and `vehicles`. Each vehicle holds the vehicle fields, `members` as `[{ uid, name, role }]` with no emails, `entries`, `reminders` and `checklistTemplates`. Only vehicles the user owns are included.

### CSV columns

Common columns: date, vehicle, type, category, amount, currency, odometer, notes, logged by. Type-specific columns follow.

- **Fuel:** fuel type, quantity, unit, price per unit, full tank, missed previous fill-up, station, charging location.
- **Service:** line items in one cell (for example "Engine oil: 1200; Air filter: 400"), labour, discount.
- **Income:** platform.
- **Trip:** start, end, start odometer, end odometer, distance, from, to, purpose, rate, reimbursement.
- **Inspection:** template, issue count, result summary.

Amounts are plain decimals with the currency in its own column. The file is UTF-8 with a byte-order mark.

### Rules additions (approved)

- Timestamps must not be in the future.
- `createdBy` and `updatedBy` equal the caller.
- Required `amount` for fuel, expense, service and income, with `amount.currency` equal to the vehicle currency.
- `memberIds` has at most 10 entries. The owner is in `memberIds`. `members` keys match `memberIds`. `ownerId` changes only to an existing member.
- Text lengths and array sizes are capped (5 attachments, 50 template items, 10 members). The exact length limits are set during rules design.
- Foundation ships default-deny for `invites`, self-join, leave and transfer, tested as denied, and the `checklistTemplates` rules from the matrix.
