# Milevana v1 — Brief & Foundation Design Spec

Oct 5, 2026 · @Poovarasu Sekar

## v1 product brief

Milevana is a free, ad-free, privacy-first vehicle expense and maintenance tracker, inspired by Drivvo. v1 is a complete public release on Android, with a companion web app.

**Audiences.** Primary: individuals managing their own vehicles, families sharing vehicles, and gig/rideshare drivers who need real profit figures. Fleets and businesses come after v1, but the data model must not block them.

**Product principles**

- **No ads, ever, in the free app.** No ad SDK and no location permission.
- **Your data is never paywalled.** Backup, sync, restore and export stay free forever. A future paid tier may only add features with real running or build cost, such as fleets or advanced reports.
- **Log anywhere.** On Android, every write works offline and syncs later.
- **No friction to start.** On Android the app opens straight into adding a vehicle, with no sign-in screen.
- **Minimal telemetry.** Crashlytics for anonymous crash reports, with no amounts, plates, names or notes. Analytics is skipped or opt-in.

**Platform and backend decisions**

| Area | Decision |
| --- | --- |
| App framework | Expo (React Native) with Expo Router; Android primary, web secondary |
| Backend | Firebase on the free Spark plan; no custom API server and no Cloud Functions |
| Database | Cloud Firestore; offline cache on Android, online-only on web |
| Accounts | Android: anonymous first, link Google later. Web: Google sign-in only |
| File storage | The user's own Google Drive (`drive.file` scope); Firebase Storage needs the paid Blaze plan |
| Backup | Google Drive backup and restore, manual plus automatic when stale |
| Notifications | Local notifications scheduled on the device |
| Localization | India defaults (INR, km, litres); currency and units configurable per user and per vehicle; all text through i18n, English only in v1 |

## v1 scope and sub-projects

v1 ships in eight sub-projects, each with its own spec and implementation plan, built in dependency order. A usable personal app exists after sub-project 2, and the Play closed test (12+ testers for 14 days) starts then, so Google's gate runs in parallel with sub-projects 3–7.

**v1 features:** vehicles, fuel and EV charging, expenses, services, income, manual trips, inspection checklists, receipt photos in the user's Drive, reminders, reports, shared vehicles, CSV export, Google Drive backup and restore, and release essentials.

**Not in v1:** GPS route tracking, importing from other apps, fleet and business management, a local-only mode, email/password sign-in, and vehicle photos.

1. **Foundation:** Expo setup, Firebase auth and linking, the dual-SDK data layer, the full data model and security rules (including members and roles), settings, i18n scaffolding, vehicle management, the navigation shell, and Crashlytics. *This document.*
2. **Logging modules:** fuel and charging with mileage calculation, expenses, services, income and trips, sharing one entry pattern.
3. **Reminders:** date- and odometer-based reminders, daily-km prediction, and local notifications.
4. **Reports and dashboard:** cost per km, monthly spend, mileage trends, and income vs cost.
5. **Google Drive integration:** backup and restore, receipt photos on entries, and CSV export.
6. **Sharing:** invite codes, owner and member roles, and sharing photo files with members on Drive.
7. **Inspection checklists:** templates and inspection runs.
8. **Release readiness:** onboarding polish, in-app account deletion, privacy policy, Play Store listing and data-safety form, and web deployment on Firebase Hosting.

## Foundation: goals and scope

Foundation delivers an installable Android app and a web app where a user can start anonymously, link Google, and manage vehicles and settings. Every later sub-project builds on it without data migrations.

**Done when**

- [ ] A fresh Android install reaches "Add your first vehicle" with no sign-in screen.
- [ ] Vehicles can be added, edited, archived and deleted, including offline on Android.
- [ ] Anonymous users can link Google, including the conflict case where that account already has data.
- [ ] Web users sign in with Google and see the same vehicles.
- [ ] Settings for currency, units, efficiency format, date format, theme and language persist and drive all display.
- [ ] Security rules for the full data model, including members, entries and reminders, pass the emulator test suite.
- [ ] Crashlytics reports crashes and non-fatal errors without personal data.

**In scope:** project setup, both Firebase adapters, repositories with validation, the complete Firestore schema and rules, the auth and linking flows, the navigation shell with placeholder entry screens, vehicle management, settings, i18n scaffolding, error boundaries, Crashlytics, CI, and the shared export/import serializer used by account merge.

**Out of scope:** entry forms (sub-project 2), reminders, reports, the Drive scope request, invite flows, checklists, and account deletion.

## Architecture

One Expo codebase serves Android and web, layered as screens → feature hooks → repositories → a platform-specific Firebase adapter. Only repositories touch Firestore, and only the adapter knows which SDK is running.

```
app/                    Expo Router screens (same routes on Android and web)
src/
  domain/               pure TypeScript: types, mileage, unit and money conversion,
                        odometer prediction. No React, no Firebase.
  data/
    firebase.native.ts  @react-native-firebase (durable offline cache, Android)
    firebase.web.ts     Firebase JS SDK (online-only, web)
    repos/              vehicleRepo, entryRepo, userRepo
    serializer/         export/import format shared by account merge and Drive backup
  features/             hooks and components per module
  ui/                   shared components and theme
```

**Adapter.** Expo resolves `firebase.native.ts` or `firebase.web.ts` by platform. Both expose the same narrow interface, so nothing above them branches on platform.

**Repositories.** They convert Firestore documents into domain types and validate every read with zod. A malformed or outdated document fails in one place, never inside a screen. The same zod schemas back the forms.

**State.** The Firestore cache is the source of truth. Screens subscribe through small hooks such as `useVehicles()` and `useEntries(vehicleId)`; there is no Redux and no query-caching library. A small Zustand store holds UI-only state such as the selected vehicle.

**Offline writes.** On Android a Firestore write's promise resolves only after server confirmation, so awaiting it offline would hang. Repositories apply writes locally and return immediately. Items with pending writes show a sync icon, driven by Firestore's `hasPendingWrites` metadata.

**Libraries**

| Need | Choice | Why |
| --- | --- | --- |
| Navigation | Expo Router | File-based routes with web URLs |
| UI kit | React Native Paper | Material 3, mature on web, built-in theming and dark mode |
| Forms | react-hook-form + zod | Schemas shared with repositories |
| UI state | Zustand | Tiny; UI-only state |
| i18n | i18next + expo-localization | Translation-ready from day one |
| Native auth | @react-native-google-signin/google-signin | Google credential for linking; Drive scope added later |
| Builds | EAS Build | Android release builds with native modules |
| Web hosting | Firebase Hosting | Free tier |

Charts use react-native-gifted-charts (sub-project 4). Native modules require Expo development builds rather than Expo Go.

**Rejected alternatives:** NativeWind (every component built by hand, slower to a polished v1) and one shared JS SDK on all platforms (no durable offline storage on Android).

## Data model

Vehicles are top-level documents carrying their member list, and everything a vehicle owns lives beneath it. One membership check protects a vehicle's whole subtree, so sharing needs no migration.

```
users/{uid}
  displayName, isLinked, createdAt, schemaVersion
  drive: rootFolderId, backupsFolderId, receiptsFolderId,
         lastBackupAt, lastBackupFileId                 sub-project 5
  settings: currency, distanceUnit, volumeUnit, efficiencyFormat,
            dateFormat, theme, locale, backupFrequency,
            mutedReminderVehicleIds                     sub-project 3

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
    createdBy, createdByName, updatedBy, createdAt, updatedAt, schemaVersion
    details: { ...type-specific }                       sub-projects 2 and 7

  reminders/{reminderId}                                sub-project 3
  checklistTemplates/{templateId}                       sub-project 7

invites/{code}                                          sub-project 6
```

**Rationale**

- **One `entries` collection with a `type` field.** History, reports, CSV export and backup each need one query per vehicle, not six merged ones.
- **`memberIds` array plus `members` map.** The array supports the `array-contains` query for "my vehicles"; the map holds role and display name.
- **Money as integer minor units with a currency code.** `{ minor: 245000, currency: "INR" }` is ₹2,450.00 and avoids floating-point drift.
- **Odometer stored in the vehicle's own unit.** Conversion happens only at display time, so no rounding is ever stored.
- **Category name copied onto each entry.** Shared members see the name without a category collection, and renames don't rewrite history.
- **`createdBy` and `updatedBy` on entries.** They show who logged an entry and power the edit rules.
- **`lastOdometer` denormalized on the vehicle.** Written in the same batch as the entry, taking the maximum, for the dashboard and reminders.
- **`schemaVersion` on top-level documents and entries.** Repositories upgrade older shapes on read.

**Fuel details** (the only detail shape Foundation fixes, because mileage depends on it): `fuelType`, `quantity`, `quantityUnit` (L, gal, kg, kWh), `pricePerUnitMinor`, `fullTank`, `missedPrevious`. Sub-project 2 adds optional fuel fields and defines the other entry shapes.

**Left out (YAGNI):** soft delete and edit history, a custom-category collection (fixed list plus free-text "Other"), server-computed totals, and vehicle photos.

## Security rules

Security rules are the entire backend, so every path is denied by default and opened only as below. Every row is tested both ways, allowed and denied, in the emulator suite.

| Path | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `users/{uid}` | Self | Self | Self | Self |
| `vehicles/{id}` | Members | Signed-in user, with self as owner and only member | Owner; members cannot change `ownerId`, `memberIds` or `members` | Owner |
| `vehicles/{id}/entries/{e}` | Members | Members, with `createdBy` = self | Creator or owner; `createdBy` immutable | Creator or owner |
| `vehicles/{id}/reminders/{r}` | Members | Members | Members | Members |
| `invites/{code}` | Defined in sub-project 6 | Sub-project 6 | Sub-project 6 | Sub-project 6 |

**`vehicles/{id}/checklistTemplates/{t}`** (sub-project 7): members read, create and update, with at most 50 items; the creator or owner deletes.

**Write validation in rules:** required fields and types on create, `type` restricted to the six entry types, `amount.minor` an integer, and timestamps compared to `request.time`. The client validates too, but rules are the last line of defence.

**Exception for `lastOdometer`:** members may update only `lastOdometer`, `lastOdometerAt` and `updatedAt` on a vehicle, so logging an entry can refresh the dashboard.

**Cost note:** rules on subcollections use `get()` on the parent vehicle to check membership. That read is billed, but it's one per request and well within the free quota at expected usage.

## Sign-in and account flows

Android users start anonymously and link Google later without moving data; web users always sign in with Google. The one hard case, linking a Google account that already has data, is resolved on the device with the shared serializer.

**First launch, Android**

1. Read the persisted session from the native SDK.
2. With no session, call `signInAnonymously()`, then create `users/{uid}` with default settings (INR, km, litres, device language).
3. Open onboarding at "Add your first vehicle".

Anonymous sign-in needs the network once. If the first launch is offline, a "Connect to get started" screen retries automatically. After that the app works fully offline.

**First launch, web:** a Google-only sign-in screen using the JS SDK popup flow. A new Google account gets its `users/{uid}` document on first sign-in.

**Linking Google (Android)**

- **Triggers:** a dismissible prompt after the 5th entry, a persistent "Your data isn't backed up" banner on More, and a required step before Drive backup, receipt photos or sharing.
- **Mechanics:** Google Sign-In returns an ID token, which becomes a `GoogleAuthProvider` credential passed to `linkWithCredential`. The uid is unchanged, so no data moves. Set `isLinked: true`.
- **OAuth setup:** the Google Cloud OAuth client is configured once in Foundation, so sub-project 5 can request `drive.file` incrementally.

**Conflict: the Google account already has data.** `linkWithCredential` fails with `auth/credential-already-in-use`. The app shows: *"This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?"* with **Move and switch**, **Switch without moving** and **Cancel**.

1. **Read:** while still anonymous, serialize every vehicle the anonymous user owns, plus all entries and reminders, into memory.
2. **Sign in:** sign in with the Google credential, which replaces the anonymous session.
3. **Write:** write copies under new ids owned by the Google uid, in batches of 500.
4. **Failure handling:** if the write fails partway, keep the serialized data in memory and on disk and offer a retry, because the anonymous account cannot be re-entered. Copies use deterministic ids derived from the source ids, so retries don't duplicate.

The abandoned anonymous account's documents remain in Firestore with no owner able to delete them. This is a known limitation of a server-free design, at a few KB per case.

**Sign-out**

- **Linked users:** normal sign-out. On Android, call `clearPersistence()` after sign-out so the next person on the device sees nothing.
- **Anonymous users:** no sign-out option, because it would destroy their data. "Link Google" takes its place.

**Not in Foundation:** account deletion (sub-project 8, designed with sharing) and email/password sign-in (later, if users ask).

## Navigation, vehicles and settings

The shell is a vehicle-scoped app with four tabs and a single add button. On wide web screens the same routes render with a side rail and dialog forms.

**Navigation**

- **Top bar:** a vehicle switcher showing name, type icon and colour. All tabs are scoped to the selected vehicle, which persists across launches.
- **Tabs:** Dashboard, History, Reports, More.
- **Add button:** on Dashboard and History, opening a sheet with Fuel, Expense, Service, Income, Trip and Inspection. These are placeholder screens in Foundation.
- **More:** Vehicles, Reminders, Checklists, Backup & export, Settings, Account, About & privacy. Unbuilt items show "Coming soon".
- **Web at 768 px and wider:** tabs become a left navigation rail and forms open as dialogs.

**Vehicles**

- **Add:** required fields are name, type (car, bike, scooter, truck, bus, other), fuel types (any combination), odometer unit and current odometer. Optional fields are make, model, year and plate. A colour is picked from a fixed palette.
- **Edit:** all fields, except that odometer unit and currency lock once the vehicle has entries.
- **Archive:** hides the vehicle from the switcher and keeps its entries for history and lifetime reports. It can be unarchived from More → Vehicles.
- **Delete:** confirmed by typing the vehicle name. It deletes entries and reminders in batches of 500, then the vehicle.
- **Empty state:** first-time users see "Add your first vehicle" instead of an empty dashboard.

**Settings**

| Setting | Default | Options |
| --- | --- | --- |
| Currency | INR | ISO 4217 list |
| Distance unit | km | km, mi |
| Volume unit | litres | litres, US gallons, UK gallons |
| Efficiency format | km/l | km/l, L/100 km, mpg |
| Date format | DD/MM/YYYY | DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD |
| Theme | System | System, light, dark |
| Language | Device language if supported, else English | English only in v1 |

Defaults apply to new vehicles and to display. Changing a default converts what is shown, never what is stored. Per-vehicle overrides cover odometer unit and currency.

**Accessibility:** Paper theming for dark mode and system font scaling, tap targets of at least 48 dp, and screen-reader labels on every icon-only button.

## Error handling

Each failure type has one defined behavior, and no failure takes down more than one screen. Being offline on Android is a normal state, not an error.

| Failure | Android | Web |
| --- | --- | --- |
| Offline | Writes save locally and show a pending-sync icon | Banner; saving disabled, since unsynced web writes live only in memory |
| Daily quota exceeded (`resource-exhausted`) | "Sync paused, your entries are safe on this device"; resumes after the daily reset | "Service busy, try again later" |
| Permission denied | Owner: report as a bug. Member: "You no longer have access to this vehicle", then switch vehicle | Same |
| Malformed document (zod rejects it) | Skip that item, show "1 entry couldn't be shown", log a non-fatal with the document path | Same |
| Google sign-in cancelled | Silent | Silent |
| Sign-in network or unknown error | Message with Retry | Same |
| Account conflict on linking | Merge flow (see Sign-in and account flows) | Not applicable |
| Unhandled exception in a screen | Per-screen error boundary: "Something went wrong" with Retry | Same |

**Crashlytics privacy rule:** reports carry document ids, error codes and app state only. Never amounts, plates, names or notes.

**Production signal:** any `resource-exhausted` non-fatal in production is the trigger to review moving to the Blaze plan.

## Testing

Security rules and domain logic get the deepest coverage, because rules are the whole backend and domain functions hold the bug-prone calculations. Domain code is written test-first.

| Layer | Tool | What it covers | Runs |
| --- | --- | --- | --- |
| Security rules | Firebase Emulator + `@firebase/rules-unit-testing` | Every row of the rules matrix, allowed and denied | Every push |
| Domain | Jest | Mileage (including bi-fuel and missed fills), money and unit conversion, serializer round-trips | Every push |
| Repositories | Jest + Firestore emulator, JS SDK | Reads, writes, validation and schema upgrades | Every push |
| Components | React Native Testing Library | Vehicle form validation, locked units, vehicle switcher | Every push |
| Android end-to-end | Maestro | First launch → add vehicle → change settings; link Google; airplane-mode logging | Before each release |
| Manual | Release checklist | Account-conflict merge, web smoke test, dark mode, font scaling | Before each release |

**CI:** GitHub Actions runs lint, typecheck, unit, repository and rules tests on every push. EAS Build produces an Android build on tagged releases.

## Limitations, open questions and deferred decisions

One setup choice remains before implementation starts. The rest are accepted limitations or belong to later sub-projects.

**Open before implementation**

- [x] App name: **Milevana**.
- [x] Android package id: `dev.poovarasu.milevana`. It cannot change after the first Play Store release.
- [x] Web address: `milevana.poovarasu.dev`, pointed at Firebase Hosting. Invite links (sub-project 6) and the Google consent screen (sub-project 8) use it.
- [ ] Firebase project id (for example `milevana` or `milevana-app`). Permanent once created; it also forms the fallback `<project-id>.web.app` address.

**Accepted limitations**

- First launch on Android needs the network once, to create the anonymous account.
- An anonymous user who uninstalls before linking Google or saving a backup loses their data. The app says so plainly.
- Abandoned anonymous accounts from the merge flow leave orphaned documents that cannot be deleted without server code.
- The web app is online-only and has no reminders, since notifications are local to the phone.
- The Spark plan allows 50,000 Firestore reads and 20,000 writes per day; beyond that, requests fail until the daily reset.

**Deferred to later sub-projects**

- Entry detail shapes other than fuel: sub-project 2.
- Reminder schema and the daily-km prediction model: sub-project 3.
- Charting library: decided in sub-project 4 (react-native-gifted-charts).
- Backup file format, automatic backup frequency and Drive folder layout: decided in sub-project 5.
- Invite code format, expiry and photo-permission sharing with members: decided in sub-project 6, which also adds self-join, leave and ownership-transfer paths to the vehicle rules.
- What happens to shared vehicles when an owner deletes their account: decided in sub-project 8 (transfer to a chosen member).

**Sources:** [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloud Storage for Firebase plan change FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drivvo on Google Play](https://play.google.com/store/apps/details?id=br.com.ctncardoso.ctncar).
