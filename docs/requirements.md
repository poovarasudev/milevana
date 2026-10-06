# Milevana v1 — Brief & Foundation Design Spec

Oct 5, 2026 · @Poovarasu Sekar

## v1 product brief

Milevana is a free, ad-free, privacy-first vehicle expense and maintenance tracker, inspired by Drivvo. v1 is a complete public release on Android, with a companion web app.

**Audiences.** Primary: individuals managing their own vehicles, families sharing vehicles, and gig/rideshare drivers who need real profit figures. Fleets and businesses come after v1, but the data model must not block them.

**Product principles**

- **No ads, ever, in the free app.** No ad SDK and no location permission.
- **Your data is never paywalled.** Backup, sync, restore and export stay free forever. A future paid tier may only add features with real running or build cost, such as fleets or advanced reports.
- **Log anywhere.** On Android, every write works offline and syncs later.
- **No friction to start.** On Android there is no sign-in screen: after one welcome screen the app goes straight to adding a vehicle.
- **Minimal telemetry.** Crashlytics for anonymous crash reports, with no amounts, plates, names or notes. Analytics is skipped or opt-in.

**Platform and backend decisions**

| Area | Decision |
| --- | --- |
| App framework | Expo (React Native) with Expo Router; Android primary, web secondary |
| Identity | App name Milevana; Android package `dev.poovarasu.milevana`; web at `milevana.poovarasu.dev` |
| Backend | Firebase on the free Spark plan; no custom API server and no Cloud Functions |
| Database | Cloud Firestore; offline cache on Android, online-only on web |
| Accounts | Android: anonymous first, link Google later. Web: Google sign-in only |
| File storage | The user's own Google Drive (`drive.file` scope); Firebase Storage needs the paid Blaze plan |
| Backup | Google Drive backup and restore, manual plus automatic when stale |
| Sharing | Vehicles shared by invite with owner and member roles; receipts shared through Drive permissions |
| Notifications | Local notifications scheduled on each Android device; none on web |
| Localization | India defaults (INR, km, litres); currency and units configurable per user and per vehicle; all text through i18n, English only in v1 |
| Cost | Google Play's one-time US$25 registration; everything else on free tiers or the existing portfolio domain |

## v1 scope and sub-projects

v1 is designed in eight tabs in this document, built in dependency order. A usable personal app exists after tab 2, and the Play closed test (12+ testers for 14 days) starts then, so Google's gate runs in parallel with sub-projects 3–7.

**v1 features:** vehicles, fuel and EV charging, expenses, services, income, manual trips, inspection checklists, receipt photos in the user's Drive, reminders, reports, shared vehicles, CSV export, Google Drive backup and restore, and release essentials.

**Not in v1:** GPS route tracking, GPS location for fuel stations, importing from other apps, fleet and business management, a local-only mode, email/password sign-in, vehicle photos, payment-method tracking, recurring auto-entries, PDF or image export of reports, scheduled inspections, checklist-specific reports, number or text checklist item types, iOS, and over-the-air code updates.

1. **Foundation** (this tab): Expo setup, Firebase auth and linking, the dual-SDK data layer, the full data model and security rules, settings, i18n scaffolding, vehicle management, the navigation shell, Crashlytics, and the shared serializer.
2. **Logging** (tab 2): fuel and EV charging with mileage, expenses, services with line items, income, manual trips, and the History list.
3. **Reminders** (tab 3): date and odometer reminders, auto-complete from matching entries, km-per-day prediction, local notifications, and per-vehicle mute.
4. **Reports and dashboard** (tab 4): per-vehicle and All vehicles reports, financial-year ranges, cost and profit metrics, and charts.
5. **Drive and export** (tab 5): Drive backup and restore, receipt photos and PDFs with an offline upload queue, and CSV export.
6. **Sharing** (tab 6): invite codes and links, owner and member roles, leave, remove and ownership transfer, and receipt sharing on Drive.
7. **Checklists** (tab 7): per-vehicle templates with starters, inspection runs, and copy between vehicles.
8. **Release** (tab 8): Play closed testing and production access, account deletion, privacy policy and terms, Play listing, the Google consent screen, and web deployment at `milevana.poovarasu.dev`.

## Foundation: goals and scope

Foundation delivers an installable Android app and a web app where a user can start anonymously, link Google, and manage vehicles and settings. Every later tab builds on it without data migrations.

**Done when**

- [ ] A fresh Android install reaches "Add your first vehicle" after one welcome screen, with no sign-in screen.
- [ ] Vehicles can be added, edited, archived and deleted, including offline on Android.
- [ ] Anonymous users can link Google, including the conflict case where that account already has data.
- [ ] Web users sign in with Google and see the same vehicles.
- [ ] Settings for currency, units, efficiency format, date format, theme and language persist and drive all display.
- [ ] Security rules for the data model — members, entries, reminders and checklist templates — pass the emulator test suite, and invites, self-join, leave and ownership transfer are denied by default and tested as denied (tab 6 adds the real invite rules).
- [ ] Crashlytics reports crashes and non-fatal errors without personal data.

**In scope:** project setup, both Firebase adapters, repositories with validation, the complete Firestore schema and rules, the auth and linking flows, the Android welcome screen, the navigation shell with placeholder entry screens, vehicle management, settings, i18n scaffolding, error boundaries, Crashlytics, CI, and the shared export/import serializer used by account merge.

**Out of scope:** entry forms (tab 2), reminders (tab 3), reports (tab 4), the Drive scope request (tab 5), invite flows (tab 6), checklists (tab 7), and account deletion (tab 8).

## Architecture

One Expo codebase serves Android and web, layered as screens → feature hooks → repositories → a platform-specific Firebase adapter. Only repositories touch Firestore, and only the adapter knows which SDK is running.

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

**Adapter.** Expo resolves `firebase.native.ts` or `firebase.web.ts` by platform. Both expose the same narrow interface, so nothing above them branches on platform.

**Repositories.** They convert Firestore documents into domain types and validate every read with zod. A malformed or outdated document fails in one place, never inside a screen. The same zod schemas back the forms.

**State.** The Firestore cache is the source of truth. Screens subscribe through small hooks such as `useVehicles()` and `useEntries(vehicleId)`; there is no Redux and no query-caching library. A small Zustand store holds UI-only state such as the selected vehicle. Reads are cache-first wherever possible, and a refresh control pulls the latest data from the cloud.

**Offline writes.** On Android a Firestore write's promise resolves only after server confirmation, so awaiting it offline would hang. Repositories apply writes locally and return immediately. Items with pending writes show a sync icon, driven by Firestore's `hasPendingWrites` metadata.

**Libraries**

| Need | Choice | Why |
| --- | --- | --- |
| Navigation | Expo Router | File-based routes with web URLs |
| UI kit | React Native Paper | Material 3, mature on web, built-in theming and dark mode |
| Forms | react-hook-form + zod | Schemas shared with repositories |
| UI state | Zustand | Tiny; UI-only state |
| i18n | i18next + expo-localization | Translation-ready from day one |
| Native auth and Drive tokens | @react-native-google-signin/google-signin | Google credential for linking; `drive.file` added incrementally |
| Web Drive tokens | Google Identity Services | On-demand tokens in the browser |
| Charts | react-native-gifted-charts | SVG-based; same charts on Android and web (tab 4) |
| Notifications | expo-notifications | Local, inexact; no exact-alarm permission (tab 3) |
| Photos and PDFs | expo-image-picker (system photo picker), expo-document-picker | No broad media permission (tab 5) |
| Builds | EAS Build | Android release builds with native modules |
| Web hosting | Firebase Hosting at `milevana.poovarasu.dev` | Free tier; custom subdomain of the portfolio domain |

Native modules require Expo development builds rather than Expo Go. The Android build config strips `READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` if any library adds them, so Play's photo-permission declaration is never needed.

**Rejected alternatives:** NativeWind (every component built by hand, slower to a polished v1) and one shared JS SDK on all platforms (no durable offline storage on Android).

## Data model

Vehicles are top-level documents carrying their member list, and everything a vehicle owns lives beneath it. One membership check protects a vehicle's whole subtree, so sharing needs no migration.

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

**Rationale**

- **One `entries` collection with a `type` field.** History, reports, CSV export and backup each need one query per vehicle, not six merged ones.
- **`memberIds` array plus `members` map.** The array supports the `array-contains` query for "my vehicles"; the map holds role, display name, email and join date.
- **Money as integer minor units with a currency code.** `{ minor: 245000, currency: "INR" }` is ₹2,450.00 and avoids floating-point drift.
- **Odometer stored in the vehicle's own unit.** Conversion happens only at display time, so no rounding is ever stored.
- **Category name copied onto each entry.** Shared members see the name without a category collection, and renames don't rewrite history.
- **`createdBy` and `updatedBy` on entries.** They show who logged an entry and power the edit rules; createdByName keeps the name visible after a member leaves (tab 6).
- **`lastOdometer` denormalized on the vehicle.** Written in the same batch as the entry, taking the maximum, for the dashboard and reminders.
- **`schemaVersion` on top-level documents and entries.** Repositories upgrade older shapes on read.

**Fuel details** (the only detail shape Foundation fixes, because mileage depends on it): `fuelType`, `quantity`, `quantityUnit` (L, gal_us, gal_uk, kg, kWh), `pricePerUnitMilli` (price per unit as an integer in thousandths of a minor unit), `fullTank`, `missedPrevious`. Tab 2 adds optional fuel fields and defines the other entry shapes.

**Service entries** (decided for tab 2; the field shape is in "Proposed schemas"): one `service` entry per garage visit, with line items. Each line has a service type and its cost; the entry total is the sum of the lines, plus optional labour and discount. This matches how the bill is actually paid, keeps one receipt photo per bill, and the History list shows one row per garage visit. Reminders (tab 3) can still trigger per service type, for example "oil change every 10,000 km", by looking inside the line items. Each service entry also has one entry category from the Services list, and up to 5 attachments.

**Left out (YAGNI):** soft delete and edit history, a custom-category collection (fixed list plus free-text "Other"), server-computed totals, and vehicle photos.

## Security rules

Security rules are the entire backend, so every path is denied by default and opened only as below. Every row is tested both ways, allowed and denied, in the emulator suite.

| Path | Read | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| `users/{uid}` | Self | Self | Self | Self |
| `vehicles/{id}` | Members | Signed-in user, with self as owner and only member | Owner; members cannot change `ownerId`, `memberIds` or `members`, except self-join and leave (tab 6) and the `lastOdometer` exception below | Owner |
| `vehicles/{id}/entries/{e}` | Members | Members, with `createdBy` = self | Creator or owner; `createdBy` immutable | Creator or owner |
| `vehicles/{id}/reminders/{r}` | Members | Members | Members | Members |
| `invites/{code}` | Denied in Foundation; defined in tab 6 | Tab 6 | Tab 6 | Tab 6 |

**Paths and rules added by later tabs:**

- `vehicles/{id}/checklistTemplates/{t}` (tab 7): members read, create and update, with at most 50 items; the creator or owner deletes.
- `invites/{code}` and the vehicle self-join, leave, remove and ownership-transfer paths (tab 6), each with its own adversarial tests. The rules let a user add themselves only if a valid, unused invite for that vehicle exists, and the same write marks the invite used. A vehicle has at most 10 members. The rules also record which members each receipt is shared with. See "Sharing: decisions for tab 6".
- Entry updates for `attachments[].sharedWithUids` (tab 6) use the existing creator-or-owner rule.
- Account deletion (tab 8) uses only the paths above; no extra rule is needed.

**Write validation in rules:** required fields and types on create, `type` restricted to the six entry types, `amount.minor` an integer, and timestamps checked against `request.time` (not in the future, so merged and restored copies keep their original dates). The client validates too, but rules are the last line of defence.

**Exception for `lastOdometer`:** members may update only `lastOdometer`, `lastOdometerAt` and `updatedAt` on a vehicle, so logging an entry can refresh the dashboard.

**Cost note:** rules on subcollections use `get()` on the parent vehicle to check membership. That read is billed, but it's one per request and well within the free quota at expected usage.

## Sign-in and account flows

Android users start anonymously and link Google later without moving data; web users always sign in with Google. The one hard case, linking a Google account that already has data, is resolved on the device with the shared serializer.

**First launch, Android**

1. Read the persisted session from the native SDK.
2. With no session, call `signInAnonymously()`, then create `users/{uid}` with default settings (INR, km, litres, device language).
3. Show one welcome screen ("Free. No ads. Your data stays yours." then Get started), then open onboarding at "Add your first vehicle".

Anonymous sign-in needs the network once. If the first launch is offline, a "Connect to get started" screen retries automatically. After that the app works fully offline.

**First launch, web:** a Google-only sign-in screen using the JS SDK popup flow. A new Google account gets its `users/{uid}` document on first sign-in.

**Linking Google (Android)**

- **Triggers:** a dismissible prompt after the 5th entry, a persistent "Your data isn't backed up" banner on More, and a required step before Drive backup, receipt photos or sharing.
- **Mechanics:** Google Sign-In returns an ID token, which becomes a `GoogleAuthProvider` credential passed to `linkWithCredential`. The uid is unchanged, so no data moves. Set `isLinked: true`.
- **OAuth setup:** the Google Cloud OAuth client is configured once in Foundation, so tab 5 can request `drive.file` incrementally.

**Conflict: the Google account already has data.** `linkWithCredential` fails with `auth/credential-already-in-use`. The app shows: *"This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?"* with **Move and switch**, **Switch without moving** and **Cancel**.

1. **Read:** while still anonymous, serialize every vehicle the anonymous user owns, plus all entries, reminders and checklist templates, into memory.
2. **Sign in:** sign in with the Google credential, which replaces the anonymous session.
3. **Write:** write copies under new ids owned by the Google uid, in batches of 500.
4. **Failure handling:** if the write fails partway, keep the serialized data in memory and on disk and offer a retry, because the anonymous account cannot be re-entered. Copies use deterministic ids derived from the source ids, so retries don't duplicate.

The abandoned anonymous account's documents remain in Firestore with no owner able to delete them. This is a known limitation of a server-free design, at a few KB per case.

**Merge details**

- **Cancel** keeps the user anonymous with nothing changed. **Switch without moving** signs in to the Google account and leaves the phone's data behind, after a warning that it cannot be recovered.
- The Google account's existing settings win; the anonymous user's settings are discarded.
- Merge retry data is kept in app-private storage until the merge succeeds or the user discards it, then deleted. On launch, if retry data exists, the app shows "Finish moving your data".
- Copies keep their original `date`, `createdAt` and `updatedAt`. `createdBy` and `updatedBy` are rewritten to the new owner's uid, and `createdByName` is kept. Vehicles are written before their entries.
- The "5th entry" link prompt counts entries across all vehicles. A dismissed prompt does not reappear, and the "Your data isn't backed up" banner on More stays.

**Sign-out**

- **Linked users:** normal sign-out. On Android, call `clearPersistence()` after sign-out so the next person on the device sees nothing. If writes are pending, sign-out first shows how many changes have not synced and offers **Wait and sync** or **Sign out and discard**. Sign-out also clears scheduled notifications, the saved selected vehicle, any merge retry data, and the Google Sign-In session.
- **Anonymous users:** no sign-out option, because it would destroy their data. "Link Google" takes its place.

**Not in Foundation:** account deletion (tab 8, designed with sharing) and email/password sign-in (later, if users ask).

## Navigation, vehicles and settings

The shell is a vehicle-scoped app with four tabs and a single add button. On wide web screens the same routes render with a side rail and dialog forms.

**Navigation**

- **Top bar:** a vehicle switcher showing name, type icon and colour. All tabs are scoped to the selected vehicle, which persists across launches.
- **Tabs:** Dashboard, History, Reports, More.
- **Add button:** on Dashboard and History, opening a sheet with Fuel, Expense, Service, Income, Trip and Inspection. These are placeholder screens in Foundation.
- **More:** Vehicles, Reminders, Checklists, Backup & export, Join a vehicle, Settings, Account, About & privacy. Unbuilt items show "Coming soon".
- **Web at 768 px and wider:** tabs become a left navigation rail and forms open as dialogs.

**Vehicles**

- **Add:** required fields are name, type (car, bike, scooter, truck, bus, other), fuel types (any combination), odometer unit and current odometer. Optional fields are make, model, year and plate. A colour is picked from a fixed palette.
- **Edit:** all fields, except that odometer unit and currency lock once the vehicle has entries.
- **Archive:** hides the vehicle from the switcher and keeps its entries for history and lifetime reports. It can be unarchived from More → Vehicles.
- **Delete:** confirmed by typing the vehicle name. It deletes entries, reminders and checklist templates in batches of 500, then the vehicle.
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
| Automatic Drive backup | Weekly | Daily, weekly, monthly, off (tab 5) |
| Mute reminders | Off | Per vehicle, on the vehicle's settings (tab 3); stored in each user's own settings, so muting a vehicle on one phone doesn't affect other members |

Defaults apply to new vehicles and to display. Changing a default converts what is shown, never what is stored. Unit settings convert distance and volume for display. The Currency setting only sets the default for new vehicles and how amounts are formatted; amounts are never converted between currencies. Per-vehicle overrides cover odometer unit and currency.

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
| A queued write is later rejected by the server | The item shows a warning, and a Sync issues notice lists it with Retry or Discard | Error message with Retry |
| Sign-out with unsynced writes | Offer Wait and sync, or Sign out and discard | Not applicable |

**Crashlytics privacy rule:** reports carry document ids, error codes and app state only. Never amounts, plates, names or notes.

**Production signal:** any `resource-exhausted` non-fatal in production is the trigger to review Firestore usage. The project stays on the free Spark plan (decided), so a quota hit pauses sync until the daily reset. Firestore usage is also checked weekly in the Firebase console, budgeting for roughly 100 to 500 daily active users.

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

## Logging: decisions for tab 2

These are product decisions for sub-project 2. The field shapes are in "Proposed schemas" and are approved before tab 2 starts.

**Fuel entries**

- Input: enter any two of price per unit, quantity and total, and the app calculates the third.
- Odometer is required.
- "Full tank" is on by default.
- "Missed previous fill-up" is a toggle.
- Station name is optional free text; no GPS.
- EV charging records kWh and cost, with home or public charging as a field.

**Mileage**

- Bi-fuel and EV mileage is calculated per fuel type, only between two consecutive full fills of that same fuel.
- For bi-fuel vehicles (petrol + CNG), the headline figure is cost per km. Running on both fuels distorts per-fuel mileage, so cost per km is the honest number.

**Categories:** fixed India-friendly lists, plus "Other" with free text.

- **Expenses:** insurance, road tax, FASTag/toll, parking, fine/challan, PUC certificate, registration/permit, loan EMI, cleaning, accessories.
- **Services** (the service type of each line item; each service entry also picks one as its entry category): general service, engine oil, oil filter, air filter, brake pads, tyres, battery, coolant, wheel alignment/balancing, clutch, AC service.
- **Income:** ride-hailing, delivery, rental, reimbursement, with an optional platform name (Uber, Ola, Rapido, Swiggy, Zomato and so on suggested, but free text).

**Trips**

- Start and end date/time, and start and end odometer, with distance calculated.
- From/to as text, and purpose: business or personal.
- An optional reimbursement rate per km, which gives a calculated reimbursement amount.
- Trips don't create income entries automatically; reports show reimbursements separately.

**Odometer sanity checks:** warn, don't block, when a reading is lower than an earlier entry's or higher than a later one's. Typos happen, but so do genuine back-dated entries.

**History**

- One list across all types, newest first.
- Filters by type and date range.
- Search across notes and categories.
- Tap to edit.
- Delete with an Undo option: the entry disappears at once, and the real delete and any Drive file deletion happen after a 5-second Undo window.

**Left out:** payment method, GPS location for fuel stations, and recurring expenses like monthly EMI auto-entries. Recurring expenses fit better with Reminders (sub-project 3).

## Reminders: decisions for tab 3

These are product decisions for sub-project 3. The reminder schema is in "Proposed schemas" and is approved before tab 3 starts.

**Who is notified and muting**

- All members of a vehicle are notified.
- Each member can mute a vehicle. The mute is stored in each user's own settings, so muting the family car on your phone doesn't affect anyone else.

**Triggers**

- By date, by odometer, or both (whichever comes first).
- Each is either one-off or repeating, for example every 12 months and/or every 10,000 km.

**What a reminder is about:** a service type (for example engine oil), an expense category (insurance, road tax, PUC, loan EMI), or a custom title.

**Auto-complete and manual actions**

- Logging a matching entry (a service line item of that type, or an expense in that category) marks the reminder done.
- A repeating reminder then rolls forward from that entry's date and odometer.
- Manual "Mark done" and "Snooze" are also available.

**Odometer prediction**

- Average km per day from the last 90 days of readings, which needs at least 2 readings spanning 7 days.
- With enough data, the app predicts a due date.
- Without it, it shows "due in 1,200 km" and notifies only once a logged reading crosses the threshold.

**Notification timing**

- 7 days before and on the due date, at 9 AM.
- For odometer reminders, when predicted to be within 500 km.
- Both lead times are adjustable per reminder.

**Scheduling on the phone**

- Notifications are rescheduled whenever the app opens, a reminder changes, or an entry is logged.
- The Android 13+ notification permission is asked when you create your first reminder, not at install.
- Limitation: if another member edits a reminder while your app is closed, your phone updates on your next open.

**Quick-add suggestions:** chips like "Insurance renewal", "PUC expiry" and "Service every 10,000 km / 12 months" appear on the Reminders screen. Nothing is auto-created.

**Recurring payments such as EMI:** a repeating date reminder with an amount. Tapping the notification opens a pre-filled expense form; the app never logs anything without you.

**Dashboard:** an "Upcoming & overdue" card sorted by urgency. Overdue reminders stay there until done or snoozed.

**Web:** reminders can be viewed and edited there, but notifications only come on phones.

## Reports and dashboard: decisions for tab 4

These are product decisions for sub-project 4.

**Scope of reports:** per-vehicle reports plus an "All vehicles" view. In the "All vehicles" view, totals are shown per currency and never converted, and mileage stays per vehicle. Archived vehicles are left out of "All vehicles" by default, with a toggle to include them.

**Time ranges**

- This month
- Last 3 months
- Last 12 months
- This financial year (April–March), useful for Indian tax and reimbursement claims
- All time
- Custom

**Report sections,** as one scrolling Reports tab:

- **Overview:** total cost, cost per km, cost per day, distance driven, and a split by type (fuel, service, expense).
- **Monthly spend:** stacked bars per month by type.
- **Fuel:** a mileage trend per fuel type, a fuel price trend, and fuel cost per km. For EVs, home vs public charging cost.
- **Services & expenses:** totals by category, and service history by type.
- **Income & profit:** shown only when the vehicle has income entries. Income vs cost per month, net profit, profit per km, and income by platform.
- **Trips:** business vs personal distance, and total reimbursement.

**How distance and cost per km are calculated**

- Distance for a period is the last odometer reading in the period minus the last reading before it.
- Cost per km is total costs ÷ that distance. Costs exclude income and trip reimbursements.

**Charts:** react-native-gifted-charts. It draws with SVG, so the same charts render on Android and web. Tapping a chart point shows its value.

**Computation:** done on the device from the vehicle's entries, loaded once and kept until they change. The "All vehicles" view loads each vehicle in turn.

**Dashboard (per vehicle)**

- Last mileage.
- This month's spend.
- 90-day cost per km.
- The Upcoming & overdue reminders card.
- The 5 most recent entries.
- For gig drivers, this month's income vs cost.

**Not in v1:** PDF or image export of reports. CSV export in sub-project 5 covers taking the data elsewhere.

## Drive and export: decisions for tab 5

These are product decisions for sub-project 5.

The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-`.

### Backup

- **Format:** one readable JSON file, named like `milevana-backup-2026-10-05-0930.json`. It includes a format version, your settings, the vehicles you own, and all their entries, reminders and checklist templates. Vehicles shared with you but owned by someone else are not included, and members of your vehicles appear by name only. Plain JSON keeps your data transparent and portable, and it's small, roughly 1 MB for years of data.
- **Drive layout:** the app creates a folder named "Milevana" in your Drive, containing `Backups/` and `Receipts/<vehicle name>/`. The app can only see files it created there.
- **Automatic backup:** when the app opens, if the last backup is older than your chosen frequency (daily, weekly by default, monthly, or off). Linked accounts only. It runs on any network, since the file is small.
- **Retention:** the last 10 automatic backups are kept; older ones are deleted. Manual backups are kept until you delete them.
- **Backup & export screen:** last backup time, "Back up now", "Restore", and the frequency setting. Backup and restore work on web too.
- **Restore:** restores what's missing, asks about the rest, and only ever touches vehicles you own. Where a vehicle exists but differs, it asks once per vehicle: keep current or replace with the backup's copy. The summary warns that entries you deleted on purpose after the backup will come back. Settings are restored only if ticked. Restore lists backups with the latest preselected.

### Receipt photos

- **Adding attachments:** camera, gallery, or a PDF from files, since garage bills often arrive as PDFs. Up to 5 per entry. Photos are compressed to about 1600 px on the long edge, roughly 200–400 KB each; PDFs can be up to 5 MB.
- **Offline:** the entry saves immediately, and attachments wait in a local queue until you're online, then upload.
- **Cleanup:** deleting an entry or an attachment also deletes the Drive file, if you uploaded it. If you've deleted a file in Drive yourself, the app shows "File no longer in Drive" instead of breaking.
- **Errors:** a full Drive storage shows a clear message, and the entry keeps the photo queued.
- **Visibility:** until sub-project 6, only the uploader sees their photos on shared vehicles.

### CSV export

- **What's exported:** one combined CSV per vehicle (or all vehicles), for a date range. It has common columns plus type-specific ones.
- Service line items are flattened into one cell, for example "Engine oil: 1200; Air filter: 400".
- Amounts are written as plain decimals, with the currency in its own column and decimal digits following each currency. Labour and discount have their own columns.
- The file is UTF-8 with a byte-order mark, so Excel shows ₹ correctly.
- **No Google account needed:** CSV goes out through the Android share sheet or a browser download, so anonymous users can also take their data out. That is the "never held hostage" promise in practice.

### Permission

Drive access is requested the first time you use a Drive feature, with a one-line explanation first. If you decline, everything else keeps working.

## Sharing: decisions for tab 6

These are product decisions for sub-project 6.

**Receipt photos on shared vehicles:** photos are auto-shared with members, and access catches up whenever each uploader's app next opens.

### Invites

- The owner taps "Invite" and gets a short code (for example K7QX-M2PA) plus a link, sent via WhatsApp or the share sheet.
- With the app installed, the link opens it straight to the join screen. That needs Android App Links verified on the Firebase Hosting domain. Otherwise the link opens a web join page.
- The code can also be typed in under More → Join a vehicle.
- **Invite rules:** single-use, expires in 7 days, and the owner can see and cancel pending invites.

### Joining

- Requires a Google-linked account, so anonymous users are walked through linking first.
- No server is needed: the security rules let you add yourself only if a valid, unused invite for that vehicle exists, and the same write marks the invite used.

### Roles

- **Members:** see everything, log entries, edit their own entries, manage reminders, and leave the vehicle.
- **Owners:** can also edit the vehicle, invite, remove members, archive or delete the vehicle, and transfer ownership to a member. Transfer is also what account deletion in sub-project 8 will rely on.
- **Limit:** up to 10 members per vehicle, which keeps photo sharing and rule checks light.

### Leaving or removal

Past entries stay on the vehicle, labelled "Logged by Priya". Receipts that person uploaded stay visible to the remaining members until they delete them.

### Photo sharing mechanics

- Each attachment records which members it has been shared with.
- On every app open, your phone checks the receipts you uploaded to shared vehicles. It adds Drive read access for new members and removes it for removed ones.
- Other members see "Shared once Priya opens the app" until that's done.

### Visibility

- Shared vehicles show a people icon and member count.
- History rows show who logged each entry.
- Members can see each other's names and Google emails.
- No server push: joining, removals and new entries show up when each person next opens the app or their listeners are running.

### Rules

The Foundation security rules will also be updated for: invite validation, self-join, self-leave, ownership transfer, and recording which members each receipt is shared with.

## Checklists: decisions for tab 7

These are product decisions for sub-project 7.

**Where templates live:** per vehicle, with copy to another vehicle. Templates are stored under each vehicle (`vehicles/{vehicleId}/checklistTemplates/{templateId}`), as in the data model above, not on the user record.

### Templates

- A template has a name and a list of items, up to 50 per template and 20 templates per vehicle.
- Each item is a short label such as "Tyre pressure", with optional grouping such as "Tyres", "Lights" or "Documents".
- **Starter templates,** offered when the vehicle has none yet:
  - **Car pre-trip:** tyre pressure and tread, lights and indicators, brakes, horn, wipers, engine oil, coolant, brake fluid, mirrors, and documents (RC, insurance, PUC, licence).
  - **Two-wheeler:** tyres, chain lubrication and tension, brakes, lights, horn, mirrors, fuel, documents.
  - **Long trip:** spare tyre and jack, toolkit, first-aid kit, fluids, battery, AC, FASTag balance.

### Running an inspection

- Pick a template, then tap Pass / Fail / N/A per item, with an optional note on any item.
- Odometer is optional.
- Photos attach to the inspection like any entry, up to 5, through Drive. Each photo can be tagged with the item it shows.

### Saving

- The result is an inspection entry in History, storing a snapshot of the item labels and results. Editing or deleting the template later never changes past inspections.
- In History it shows with a badge such as "2 issues".
- **Failed items:** the summary screen lists them, each with "Create reminder" (title pre-filled) and "Log service" shortcuts. Nothing is created automatically.

### Permissions

Any member can run inspections and create or edit templates, like reminders. Deleting a template is limited to its creator or the owner.

### Copy

"Copy to another vehicle" lists every vehicle you're a member of.

### Not in v1

- Checklist-specific reports.
- Scheduled inspections (a custom repeating reminder covers "inspect weekly").
- Number or text item types; only pass/fail/N/A with notes.

## Release: decisions for tab 8

These are product decisions for sub-project 8.

**Decided:** keep the web address `milevana.poovarasu.dev` (no new domain is bought, so the only fixed cost stays the one-time US$25 Play fee). Android shows one welcome screen before adding the first vehicle, and web has a landing page. The closed test runs in parallel with the other sub-projects.

### Play Store gate and timeline

- Google requires personal developer accounts created after November 13, 2023 to run a closed test for each app before production. At least 12 testers must stay opted in for 14 continuous days. After those 14 days you also have to answer Google's questions about your test before production access is granted.
- Because the closed test runs in parallel with sub-projects 3 to 7, the wait between "app finished" and "public on Play" is Google's production-access review.
- Recruit 15–20 friends or family, so one dropout doesn't reset the clock.
- Start the closed test as early as sub-project 2. The remaining sub-projects can ship to testers as updates, which also gives real feedback.

### Account deletion

- **Shared vehicles you own:** they go to a member, with a choice per vehicle. The summary pre-selects the longest-standing member as the new owner. You can pick another member or choose to delete that vehicle instead, and the new owner needs no acceptance. Vehicles only you use are deleted, and your receipts stay in your Drive.
- **Entries you logged** on vehicles you leave keep your name, and the privacy policy says so.
- **Progress** is stored on your user record. Data is deleted first and the Firebase account last, and resuming needs a fresh re-sign-in. `clearPersistence()` runs after deletion. Anonymous users can delete in-app only.
- **In-app flow:** Settings → Account → Delete account.
- A summary screen first, with "Back up / export first" offered: what gets deleted, which shared vehicles go to whom (changeable), which memberships you'll leave, and a link to your Drive folder.
- Then Google re-sign-in, which Firebase requires before deleting an account, and typing DELETE to confirm.
- **Resumable:** progress is recorded, so an interrupted deletion resumes on next launch.
- **Web deletion page:** a `/delete-account` page on the web app, since Play also requires a deletion route outside the app. It runs the same flow.
- **Anonymous users:** "Delete all my data" works without re-sign-in.

### Policies and listing

- **Privacy policy and short terms** at `/privacy` and `/terms` on Firebase Hosting. They state what's collected (Google name and email, your vehicle data, crash diagnostics), how Drive access is used, no ads and no selling, and how deletion works. They also include the Google API "Limited Use" statement that Drive access requires.
- **Play listing:** category Auto & Vehicles; audience 18+, which keeps the app clear of children's-app policies; phone screenshots and a feature graphic.
- **Data-safety form:** account info, app content and crash logs; encrypted in transit; deletable; not shared; no ads.
- **Google sign-in consent screen:** to show the app name and logo when users grant Drive access, Google will likely want a verified domain, which a free Firebase `.web.app` address can't provide. The exact requirement gets confirmed at the start of this sub-project.

### Launch polish

- **First launch (Android):** a single welcome screen ("Free. No ads. Your data stays yours." then Get started), then straight to adding a vehicle.
- **Web landing page:** a landing page with comprehensive content and screenshots at the web root, before sign-in. The content and screenshots are to be supplied.
- The app icon, adaptive icon and splash screen.
- **Web deploy:** the Expo web build on Firebase Hosting, plus `/join/:code`, `/delete-account`, `/privacy`, `/terms`, and the Android App Links verification file.
- **Release flow:** EAS Build → internal testing → closed testing (the 12-tester gate) → production.
- Updates ship through Play only; no over-the-air code updates in v1.
- Firestore usage is checked weekly in the Firebase console, since the free plan has no budget alerts.

## Decisions on open questions (2026-10-06)

These decisions close the open questions raised while completing this document. Each is also recorded in the PRD's open-question table. Items marked "verification pending" are decided but need a check against Firebase, Google or Play before they are relied on.

### Foundation

- **OQ-01, Tab designs:** The tab designs are the decisions recorded in this document's tab sections. Field-level shapes are in "Proposed schemas" and need approval before each tab starts.
- **OQ-02, Success metrics:** No numeric v1 targets. The tracked signals are completion of the closed-test gate, the weekly Firestore usage check, and crash reports.
- **OQ-03, Firebase project id:** The Firebase project id is `milevana` (fallback address `milevana.web.app`). It is permanent once created. If the id is taken when the project is created, the id actually created is recorded here.
- **OQ-04, Foundation rules scope:** Foundation writes the `checklistTemplates` rules and ships default-deny for `invites`, self-join, leave and ownership transfer, tested as denied. AC-F6 is amended to say so. Tab 6 adds the real invite rules.
- **OQ-05, Link prompt:** The "5th entry" counts entries across all vehicles. A dismissed prompt does not reappear. The "Your data isn't backed up" banner on More stays.
- **OQ-06, Cancel and Switch without moving:** Cancel keeps the user anonymous with nothing changed. Switch without moving signs in to the Google account and leaves the phone's data behind, after a warning that it cannot be recovered.
- **OQ-07, Settings in a merge:** The Google account's existing settings win. The anonymous user's settings are discarded.
- **OQ-08, Merge retry data:** Kept in app-private storage until the merge succeeds or the user discards it, then deleted.
- **OQ-09, Vehicle edge cases:** A failed delete is retried or resumed, because the vehicle is removed last. After archiving or deleting the selected vehicle, the app selects the most recently used one. If every vehicle is archived, an empty state offers Unarchive and Add. Deleting a shared vehicle warns with the member count.
- **OQ-10, Web error reporting:** Web shows the error boundary but has no crash reporting in v1. This is an accepted limitation. Whether Crashlytics supports web is unverified.
- **OQ-11, Odometer units:** `hours` is selectable for any vehicle type. Distance-based metrics (mileage, cost per km, km-per-day reminders) are hidden for `hours` vehicles. Entries use the vehicle's unit, and display converts km and mi. Units stay locked once the vehicle has entries.
- **OQ-12, Fuel types and palette:** Fuel types: petrol, diesel, CNG, LPG, electric. Palette: 12 fixed colours. Fuel and trip entries have no category.
- **OQ-14, Analytics:** None in v1. There is no analytics SDK.
- **OQ-17, `lastOdometer`:** `lastOdometer` is the maximum odometer across the vehicle's entries and its starting odometer. The client recomputes it when an entry is edited or deleted. Rules require only a non-negative number. Concurrent offline writes can briefly lower it and it corrects itself on the next entry or refresh.
- **OQ-18, Capacity and billing:** Budget for roughly 100 to 500 daily active users on the free plan, with no Blaze fallback. Reads are cache-first wherever possible, and a refresh control pulls the latest data from the cloud. If the daily quota is reached, sync pauses until the reset.
- **OQ-20, Web feature parity:** Backup and restore, reminders, reports, checklists, sharing and attachments (online only) work on web. Automatic backup is Android only.
- **OQ-21, Web narrow layout:** Web below 768 px uses the mobile layout.
- **OQ-22, Merge and restore versus rules:** Copies keep their original `date`, `createdAt` and `updatedAt`. `createdBy` and `updatedBy` are rewritten to the new owner's uid, and `createdByName` is kept. Rules check that timestamps are not in the future instead of equal to `request.time`. Restored entries by other members on a shared vehicle the user owns are attributed to the user. Vehicles are written before their entries. Verification pending: gate G3.
- **OQ-23, Merge resume:** On launch, if merge retry data exists, the app shows "Finish moving your data".
- **OQ-24, Sign-out with pending writes:** If writes are pending, sign-out shows how many changes have not synced and offers Wait and sync, or Sign out and discard. Sign-out also clears scheduled notifications, the saved selected vehicle, any merge retry data, and the Google Sign-In session.
- **OQ-25, Same uid on Android and web:** Documented as an assumption: linking Google to the anonymous uid keeps the uid, so web sees the same vehicles. A user who signs in on web first and later links on Android goes through the merge path.
- **OQ-26, Rejected queued writes:** An affected item shows a warning state, and a Sync issues notice lists changes that could not be saved, each with Retry or Discard. Permission-denied after removal uses the existing "You no longer have access to this vehicle" message.
- **OQ-27, Web offline detection:** Web uses the browser's online and offline events plus a write timeout. If the sign-in popup is blocked, it falls back to the redirect flow.
- **OQ-29, Currency setting:** The Currency setting sets the default for new vehicles and how amounts are formatted. Existing amounts keep their own currency and are never converted. Unit conversion still applies to distance and volume.
- **OQ-31, Entry `amount`:** `amount` is required only for fuel, expense, service and income entries. It is always stored positive, and the type decides income versus cost. Its currency must equal the vehicle's currency. Minor-unit exponents come from a currency table in `money.ts`. Trips and inspections have no `amount`.
- **OQ-32, Entry `date`:** `date` is a timestamp of the chosen local date and time. The financial year (April to March) uses the device time zone.
- **OQ-33, Rules limits and abuse:** Rules cap what they can: text lengths, array sizes (5 attachments, 10 members, 50 template items) and document shape. Total document counts cannot be limited by rules. App Check is not in v1, and abuse resistance beyond field limits is an accepted limitation.
- **OQ-34, Rules invariants:** The owner must be in `memberIds`. The `members` keys match `memberIds`. `ownerId` changes only to an existing member. `createdBy` and `updatedBy` must equal the caller.
- **OQ-35, Batch size:** 500 is the target batch size. The emulator spike (gate G3) sets the real constant against the rules access-call limits.
- **OQ-36, Crash report contents:** Invite paths are redacted from crash reports and the uid is not set as the Crashlytics user id. The privacy policy discloses the Crashlytics installation id.
- **OQ-37, Testing gaps:** Add an emulator integration test for the merge write path. Link Google stays manual with a test Google account. Native offline behaviour is covered by the Maestro airplane-mode flow plus manual checks.
- **OQ-38, CI/CD gaps:** One production Firebase project, with the emulator for tests. Rules and indexes deploy on tagged releases. Secrets live in GitHub and EAS secrets. EAS Submit publishes to Play, and Hosting deploys from CI.
- **OQ-39, Bootstrap and selection:** If a session exists but `users/{uid}` is missing, it is created with defaults. The selected vehicle is stored per uid. Archived vehicles are read-only until unarchived.
- **OQ-40, "Without data migrations":** It means no bulk or server migrations. Older shapes upgrade lazily on read.

### Logging

- **OQ-30, Fuel details shape:** `quantityUnit` is L, gal_us, gal_uk, kg or kWh. Price per unit is stored as an integer in thousandths of a minor unit (`pricePerUnitMilli`). The total stays in integer minor units, so the "any two of three" input round-trips.
- **OQ-41, Service entries:** Up to 5 attachments per entry is decided. Each service entry also has one entry category from the Services list (see OQ-43). `attachments[].itemId` is used for inspection item tags only. The line, labour, discount and stored-total shapes are in "Proposed schemas" and need approval.
- **OQ-42, Units in Logging:** CNG shows km/kg and EV shows km/kWh (mi/kg and mi/kWh for mile-based vehicles), fixed per fuel unit and not user-selectable. Petrol and diesel follow the Efficiency format setting. The trip reimbursement rate is per the vehicle's odometer unit (per km, per mi). A trip has no `amount`, and its reimbursement is computed in `details`.
- **OQ-43, Service types and category:** The Services list is the service type of each line item (plus "Other" with free text). Each service entry also picks one entry category from the same list.
- **OQ-44, Reimbursement:** Trip-calculated reimbursement is shown only in the Trips section and is excluded from cost and from net profit. An income entry categorised "reimbursement" is ordinary income and counts toward profit.
- **OQ-45, History mechanics:** Delete uses a delayed delete: the entry disappears from History at once, and the real delete and the Drive file deletion happen after a 5-second Undo window. No soft delete is stored. Search and filters run on the device over loaded entries (notes, categories, line-item types). Other members' entries are read-only.

### Reminders

- **OQ-46, Reminder behaviour:** Snooze offers tomorrow, in 3 days, or next week, and is per user, stored on the device. Mute silences phone notifications only. An odometer reminder with no prediction notifies when a reading is within the lead distance (500 km). The 90-day window uses entry date. 9 AM is device local time, and if notification permission is denied, reminders still appear in the app. When a repeating reminder has both triggers, both roll forward from the completing entry. Members on web get no notifications, as intended.
- **OQ-47, Dashboard card:** The Upcoming & overdue card ships with sub-project 3. Overdue reminders come first, then soonest due. Odometer reminders without a prediction rank after dated ones.

### Reports and dashboard

- **OQ-19, All vehicles distance:** Totals are per currency and never converted. Distance and cost per km are shown per odometer unit.
- **OQ-48, Report calculations:** The vehicle's starting odometer and a trip's start and end odometers count as readings. All-time distance is the last reading minus the starting odometer. Cost per day uses the period length (all time starts at vehicle creation). A bi-fuel Dashboard shows cost per km instead of last mileage. A gig-driver view means the vehicle has income entries. Net profit excludes trip reimbursements.
- **OQ-49, Where "All vehicles" lives:** "All vehicles" is an entry in the vehicle switcher that changes only the Reports tab. The other tabs keep the last single vehicle. Archived vehicles are reachable through the include-archived toggle and More → Vehicles.

### Drive and export

- **OQ-13, Automatic backup trigger:** Automatic backup runs when the app opens, if the last backup is older than the chosen frequency. Linked accounts only. It runs on any network.
- **OQ-50, Drive names:** The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-`.
- **OQ-51, Delete, Undo and Drive cleanup:** Entry deletion deletes the Drive files after the Undo window (see OQ-45). Deleting a vehicle deletes the receipt files the user uploaded and that vehicle's receipt folder, after the typed-name confirmation. Files uploaded by other members stay in their own Drives. For account deletion, receipts stay in the user's Drive.
- **OQ-52, CSV details:** Amounts are plain decimals with a Currency column, and decimal digits follow each currency. Labour and discount have their own columns. The file is UTF-8 with a byte-order mark.
- **OQ-53, Backup and restore:** Items in the backup that no longer exist are restored. Where a vehicle exists but differs, the app asks once per vehicle: keep current or replace with the backup's copy. The summary warns that entries deleted on purpose after the backup will return. Settings are not restored unless ticked. Restore lists backups with the latest preselected. Backups contain settings and owned vehicles only, with their entries, reminders and checklist templates. Members of an owned vehicle appear by name only, with no emails. Automatic backup stays off until Drive access has been granted once.
- **OQ-54, Drive details:** Per-vehicle receipt folder ids are stored in the user's own settings, so renames do not move folders. Android and web use one Google project so `drive.file` visibility can be verified. The camera permission is accepted and declared.

### Sharing

- **OQ-55, Invites, joining and roles:** The 10-member limit includes the owner and is enforced in rules. An owner must transfer ownership or delete the vehicle rather than leave. The invite document carries the vehicle name and owner name for the join screen. Codes are 8 characters from an unambiguous alphabet. Archiving hides the vehicle for all members, and only the owner can unarchive it.
- **OQ-56, Receipt access catch-up:** Revocation is delayed until the uploader's app opens or returns to the foreground, and the removal confirmation and the privacy policy say so. Revocation reads the file's Drive permission list. Members who join later cannot see receipts from a member who left, and an uploader who is neither the entry's creator nor the owner cannot update sharing; both are accepted limitations. Entries gain an `uploaderUids` array so a phone can find the receipts it uploaded.
- **OQ-58, Member data:** The privacy policy discloses that members see each other's names and emails. A leaver's email is removed from `members`, and their name stays on entries.

### Checklists

- **OQ-59, 20 templates per vehicle:** Enforced by the app only, because rules cannot count documents. A copy to a vehicle that is full is blocked.
- **OQ-60, Checklist details:** Snapshot items get stable ids. Starters are offered by vehicle type (car, truck, bus and other: Car pre-trip and Long trip; bike and scooter: Two-wheeler and Long trip), and the user can pick any. The copy list excludes archived vehicles. Inspections have no `amount`. Search does not cover item notes. Rules cap text lengths.

### Release

- **OQ-15, Member data on account deletion:** Entries logged on other members' vehicles keep the user's name after account deletion (see OQ-62). The user's email is removed from `members` when they leave. The privacy policy discloses this.
- **OQ-16, Play items before the closed test:** A minimal privacy policy URL, data-safety form and store listing are prepared just before the first closed-test upload. The full sub-project 8 work follows.
- **OQ-28, Consent screen and testers:** The consent screen is published with basic sign-in scopes before the closed test, and `drive.file` is added in sub-project 5. Verify with an account that is not a listed test user (gate G6).
- **OQ-57, Hosting timing:** Sub-project 6 deploys Hosting at `milevana.poovarasu.dev` with `/join/:code` and the Android App Links file at its start. Sub-project 8 then adds `/privacy`, `/terms`, `/delete-account` and the landing page.
- **OQ-61, Domain, welcome screen, timeline:** Keep `milevana.poovarasu.dev`; no new domain is bought. Android shows one welcome screen ("Free. No ads. Your data stays yours." then Get started) before adding the first vehicle, and web has a landing page with comprehensive content and screenshots. The closed test starts after sub-project 2 and runs in parallel with sub-projects 3 to 7, so the wait after the app is finished is Google's production-access review.
- **OQ-62, Account deletion:** For each shared vehicle the user owns, the summary pre-selects the longest-standing member as the new owner. The user can pick another member or delete that vehicle instead, and the new owner needs no acceptance. Entries logged on vehicles the user leaves keep the user's name. Progress is stored on `users/{uid}`. Data is deleted first and the Firebase account last, and resuming needs a fresh re-sign-in. Anonymous users can delete in-app only. The policy states that entries logged on others' vehicles keep the user's name. `clearPersistence()` runs after deletion.
- **OQ-63, Play and policy declarations:** Declare crash logs and the Crashlytics installation id, state that receipts live in the user's Drive, and mention members' emails and the camera permission. Verification pending: what Play requires.

## Proposed schemas (for approval)

**Status: proposed, needs approval.** These field-level shapes were drafted on 2026-10-06 to complete the tab designs. They follow the product decisions recorded in this document, but the field names and details below are proposals, not decisions. Each tab's shapes should be approved before that tab starts. Where a shape needs a decision that was not made, it says so.

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

The entry `amount.minor` is the stored total: the sum of the line costs, plus labour, minus discount, never below zero. The entry also has one `category` from the Services list, and up to 5 attachments. Decision needed: whether a discount may also be a percentage.

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

### Rules additions (proposed)

- Timestamps must not be in the future.
- `createdBy` and `updatedBy` equal the caller.
- Required `amount` for fuel, expense, service and income, with `amount.currency` equal to the vehicle currency.
- `memberIds` has at most 10 entries. The owner is in `memberIds`. `members` keys match `memberIds`. `ownerId` changes only to an existing member.
- Text lengths and array sizes are capped (5 attachments, 50 template items, 10 members). The exact length limits are set during rules design.
- Foundation ships default-deny for `invites`, self-join, leave and transfer, tested as denied, and the `checklistTemplates` rules from the matrix.

## Limitations, open questions and deferred decisions

No setup choice remains open before implementation starts (the Firebase project id is chosen). The rest are accepted limitations, decisions recorded in the sections above, or belong to later sub-projects.

**Open before implementation**

- [x] App name: **Milevana**.
- [x] Android package id: `dev.poovarasu.milevana`. It cannot change after the first Play Store release.
- [x] Web address: `milevana.poovarasu.dev`, pointed at Firebase Hosting. Invite links (sub-project 6) and the Google consent screen (sub-project 8) use it.
- [x] Firebase project id: `milevana`. Permanent once created; it also forms the fallback `milevana.web.app` address. If the id is taken when the project is created, the id actually created is recorded here.

**Accepted limitations**

- First launch on Android needs the network once, to create the anonymous account.
- An anonymous user who uninstalls before linking Google or exporting a CSV loses their data. The app says so plainly.
- Abandoned anonymous accounts from the merge flow leave orphaned documents that cannot be deleted without server code.
- The web app is online-only; it shows and edits reminders but sends no notifications.
- Reminder edits by another member, and receipt sharing for new members, reach a phone only when the relevant app next opens (tabs 3 and 6).
- Whether members can view other members' receipts inside the app depends on the `drive.file` spike in tab 6; the fallback is an Open in Drive button.
- The Spark plan allows 50,000 Firestore reads and 20,000 writes per day; beyond that, requests fail until the daily reset. The project does not move to the Blaze plan.
- Web has no crash reporting in v1.
- Rules cap field lengths and array sizes but cannot limit document counts. There is no App Check in v1, so abuse resistance beyond field limits is not provided.
- A removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground.
- Members who join later cannot see receipts from a member who has left. An uploader who is neither the entry's creator nor the owner cannot update receipt sharing.
- After account deletion, entries the user logged on other members' vehicles keep the user's name.
- The limit of 20 checklist templates per vehicle is enforced by the app only.

**Decisions recorded in later tabs**

- Entry detail shapes, fuel calculations and categories: tab 2. Services are one entry with line items (see Data model), and the other tab 2 decisions are in "Logging: decisions for tab 2".
- Reminder schema, auto-complete and km-per-day prediction: tab 3. The other tab 3 decisions are in "Reminders: decisions for tab 3".
- Report metrics and charting library (react-native-gifted-charts): tab 4. The other tab 4 decisions are in "Reports and dashboard: decisions for tab 4".
- Backup format, restore behavior, receipt upload queue and CSV format: tab 5. The tab 5 decisions are in "Drive and export: decisions for tab 5".
- Invites, roles, ownership transfer and receipt sharing: tab 6. The tab 6 decisions are in "Sharing: decisions for tab 6".
- Checklist templates stored per vehicle: tab 7. The tab 7 decisions are in "Checklists: decisions for tab 7".
- Account deletion, policies, consent screen and launch timeline: tab 8. The tab 8 decisions are in "Release: decisions for tab 8".

**Sources:** [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Cloud Storage for Firebase plan change FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Play testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465), [Drivvo on Google Play](https://play.google.com/store/apps/details?id=br.com.ctncardoso.ctncar).
