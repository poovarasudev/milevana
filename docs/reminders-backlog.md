# Milevana v1 — Sub-project 3: Reminders — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 12 in 4 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Same thin specification as Logging.** PRD §23.3 records "what the source already fixes", the tab 3 decisions, OQ-46, OQ-47 and the approved reminder schema (Appendix E), and says "Acceptance criteria: defined in tab 3".
- **There are no PRD acceptance criteria and no `FR-` IDs for sub-project 3** (PRD §25.4). The criteria below are **derived from stated behavior** and cite the row they restate. They are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-11`, `PR-03`, `FR-SET-05`, `FR-SET-07`, `FR-OFF-11`, `FR-OUT-05`, `FR-NAV-05`, `FR-SEC-*`, `OQ-11`, `OQ-31`, `OQ-32`, `OQ-41`, `OQ-46`, `OQ-47`, limitation `L5`, and Foundation `AC-D*` items. Where the PRD gives only a row in §23.3, the row name is cited, for example "§23.3 *Odometer prediction*".

**Labels.** `REM-nn` story IDs and `RD-nn` decision labels are tracking labels, not requirement IDs. Foundation decisions are `DR-nn` (`docs/foundation-backlog.md`); Logging decisions are `LD-nn` (`docs/logging-backlog.md`).

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `RD-nn`, plus the earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.3):** date and odometer reminders, auto-complete from matching entries, km-per-day prediction, local notifications, per-vehicle mute, and the "Upcoming & overdue" Dashboard card (OQ-47 puts the card in this sub-project).

**What earlier sub-projects provide** (assumed accepted): the reminder schema, `reminders` rules and a validated `reminderRepo` (`FND-DAT-02`, `FND-SEC-02`, `FND-DAT-07`); the More list with "Coming soon" for Reminders and the Dashboard shell (`FND-SHL-02`); the `mutedReminderVehicleIds` settings key (`FND-DAT-02`, `FND-SET-02`); the sign-out step that clears scheduled notifications (`FND-AUTH-08`); entries, categories and the expense and service forms (`LOG-03`, `LOG-04`, `LOG-07`, `LOG-08`).

**Out of scope:** reports and the rest of the Dashboard (tab 4); Drive backup of reminders (tab 5, via the serializer); sharing UI (tab 6); recurring auto-entries (excluded from v1: a recurring payment is a reminder that opens a pre-filled form, and the app never logs anything without the user); notifications on web (none by design); an exact-alarm permission (the PRD says notifications are inexact with no exact-alarm permission).

**Scope notes (not product decisions):**
1. Foundation's DR-23 (which operations `reminderRepo` exposes) is answered in practice by `REM-05`, because this is the first sub-project that writes reminders. If the owner answered DR-23 differently, that answer applies.
2. Reminders belong to a vehicle and are shared by all members; snooze is per user and stored on the device; mute is per user and stored in `users/{uid}.settings` (OQ-46).
3. Other members cannot exist until tab 6. Behaviors for them (reminder edits by another member, notifications to all members) are built and tested with seeded data.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| R1 | Reminders domain and scheduling | REM-01 to REM-03 |
| R2 | Managing reminders | REM-04, REM-05, REM-07 |
| R3 | Automatic behavior and notifications | REM-06, REM-08, REM-09, REM-11 |
| R4 | Dashboard and verification | REM-10, REM-12 |

---

# R1 — Reminders domain and scheduling

### REM-01 — Domain: reminder logic
- **Epic:** R1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure reminder functions, so that status, matching, roll-forward, prediction and notification times are correct and tested before any screen uses them.
- **Business value:** Domain functions hold the bug-prone calculations and are written test-first (PRD §21.1). A wrong prediction or a missed roll-forward silently breaks every reminder.
- **Scope:** *In:* `src/domain/reminders.ts`: matching an entry to a reminder; roll-forward of a repeating reminder from the completing entry; km-per-day prediction; notification times; urgency ordering; derived status. *Out:* scheduling (REM-03), UI, storage.
- **Preconditions:** `FND-DAT-01`, `FND-DAT-02` (reminder shape).
- **Functional behavior:**
  1. **Matching:** an entry matches a reminder when it is a service entry with a line item of the reminder's service type, or an expense in the reminder's category. A custom-title reminder has nothing to match.
  2. **Roll-forward:** a repeating reminder moves to its next due date and/or odometer from the completing entry's date and odometer. When a reminder has both triggers, both roll forward from that entry.
  3. **Prediction:** average km per day from the last 90 days of readings, by entry date, needing at least 2 readings spanning 7 days. With enough data the due date is predicted; without it the result is "due in N km".
  4. **Notification times:** 7 days before and on the due date at 9 AM device local time (lead days adjustable); for odometer reminders, when predicted to be within 500 km (lead distance adjustable); with no prediction, when a logged reading is within the lead distance.
  5. **Urgency order:** overdue first, then soonest due; odometer reminders with no prediction rank after dated ones.
- **Business rules:** §23.3 *Triggers*, *Auto-complete*, *Odometer prediction*, *Notification timing*; OQ-46, OQ-47. Distance-based figures are hidden for `hours` vehicles (OQ-11). A reminder needs at least one trigger (Appendix E).
- **Edge cases:** Leap-year and month-end repeats; a reminder past due; no readings; readings on one day only; entries with no odometer. *Decisions applied:* derived status and the meaning of "overdue" for each trigger (RD-01); the prediction formula, which entries supply readings, `hours` and mile vehicles (RD-02); schedule details such as follow-ups and snooze effects (RD-03); matching windows and what happens when a completing entry is later edited or deleted (RD-04); roll-forward arithmetic and what "Mark done" does to a repeating reminder (RD-05).
- **Android/web differences:** None (pure TypeScript).
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None (uses the Appendix E reminder shape).
- **Acceptance criteria:**
  1. A service line of the reminder's type and an expense in its category each match; a non-matching entry and a custom reminder do not [§23.3 *Auto-complete*].
  2. A repeating reminder with date and odometer triggers rolls both forward from the completing entry [OQ-46].
  3. Prediction returns a due date only with at least 2 readings spanning 7 days in the 90-day window; otherwise it returns the remaining distance [§23.3 *Odometer prediction*, OQ-46].
  4. Notification times are 7 days before and on the due date at 9 AM local, and odometer reminders notify within 500 km, with both lead times adjustable [§23.3 *Notification timing*].
  5. Ordering puts overdue first, then soonest due, and odometer reminders with no prediction after dated ones [OQ-47].
  6. Distance-based figures are not produced for an `hours` vehicle [OQ-11].
- **Decisions applied:** RD-01 ◐, RD-02 ◐, RD-03 ◐, RD-04 ◐, RD-05 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-01 ◐] A date reminder shows Due today on its due date and Overdue from the next day; an odometer reminder is Overdue when `lastOdometer` is at or past its due odometer; the states Upcoming, Due soon, Due today, Overdue and Done exist.
  2. **D2** [RD-02 ◐] With readings spanning at least 7 days in the last 90 days the average per day is (largest minus smallest reading) divided by the days between them and the predicted due date is the latest reading's date plus the remaining distance divided by that average; with fewer than 2 readings or a span under 7 days the reminder shows 'due in N km'; an `hours` vehicle cannot add an odometer trigger.
  3. **D3** [RD-03 ◐] A date reminder schedules a lead notification at 9:00 local `leadDays` before the due date, a due-date notification at 9:00, and one overdue notification the next day, and nothing more; a snoozed reminder schedules nothing until the snooze ends.
  4. **D4** [RD-04 ◐] An expense in category X dated on or after a reminder's creation completes every active reminder for category X, and one dated earlier does not; a service line of the reminder's type completes it while a service entry's own category alone does not; editing or deleting the completing entry later does not reopen the reminder.
  5. **D5** [RD-05 ◐] Adding 1 month to 31 January gives 28 February (29 in a leap year); a completing entry without an odometer rolls the odometer trigger from `lastOdometer`; a repeating reminder stays active with the latest completion in `completedAt` and `completedByEntryId` while a one-off becomes done; Mark done on a repeating reminder rolls forward from today.
- **Test requirements:** Jest, test-first, with fixtures for each rule and the edge cases above (TS-03 style).
- **Dependencies:** FND-DAT-01, FND-DAT-02.
- **PRD requirement IDs:** PR-11, NFR-08, FR-DATA-12, OQ-11, OQ-41, OQ-46, OQ-47, TS-03.
- **SRS reference:** Triggers L376–379; Auto-complete L383–387; Prediction L389–393; Timing L395–399; Schemas L757–772; OQ-46 L674; OQ-47 L675.

### REM-02 — Spike: quota cost of reminder scheduling
- **Epic:** R1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the read cost of scheduling counted, so that rescheduling on every app open and every entry does not exhaust the free quota.
- **Business value:** There is no Blaze fallback (NFR-06). Each phone reschedules for every vehicle it belongs to on every open, and prediction reads recent entries.
- **Scope:** *In:* count reads and writes for: app-open rescheduling across all of a user's vehicles; the readings read for prediction; rescheduling after a reminder change and after an entry; the Dashboard card's reads; projection at 100 to 500 daily active users, cache-first; a recommendation if over. This applies the method of Foundation gate G2 (PRD §24.6), which lists operations but not reminder scheduling. *Out:* Reports (tab 4).
- **Preconditions:** `FND-VER-01` method and DR-20 threshold.
- **Functional behavior:** A written budget with per-operation counts and the daily projection.
- **Business rules:** NFR-06, NFR-20, OQ-18: roughly 100 to 500 daily active users, cache-first reads, refresh control.
- **Edge cases:** A user with many vehicles. Vehicles with years of entries. Listeners left open versus one-shot reads.
- **Android/web differences:** Android only for scheduling; the card and list apply to web.
- **Offline behavior:** Counts assume cache reads.
- **Security implications:** None.
- **Data/schema impact:** May recommend reading fewer entries for prediction.
- **Acceptance criteria:**
  1. A document lists reads and writes per operation named above [NFR-06].
  2. The projection at 100 and 500 users is compared with the threshold and recorded pass or fail [OQ-18].
  3. REM-03 is not accepted before this passes.
- **Decisions applied:** DR-20 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
- **Test requirements:** Measured from the emulator with request logging.
- **Dependencies:** FND-VER-01 (method), FND-DAT-07.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12.
- **SRS reference:** OQ-18 L642; Scheduling L401–405; Error handling L307.

### REM-03 — Local notification scheduling service
- **Epic:** R1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below); acceptance waits on REM-02.
- **User story:** As a user, I want reminders to alert me on my phone at the right time even when the app is closed, so that I do not miss an insurance renewal or a service.
- **Business value:** Notifications are the point of a reminder; they must work offline and without a server (PR-11, RK-01).
- **Scope:** *In:* `src/data/notifications/`: scheduling with `expo-notifications` as local, inexact notifications on each Android device; computing the schedule from REM-01; rescheduling whenever the app opens, a reminder changes, or an entry is logged; skipping muted vehicles and snoozed reminders; clearing everything on sign-out; no exact-alarm permission; no notifications on web. *Out:* the permission prompt (REM-08), mute UI (REM-09), tap handling (REM-11).
- **Preconditions:** REM-01, `FND-DAT-07`, `FND-AUTH-08` (sign-out step).
- **Functional behavior:**
  1. On app open, after a reminder change and after an entry is logged, cancel and recreate the device's scheduled notifications from current data.
  2. Schedule per REM-01: lead-days and due-date notifications at 9 AM local; odometer notifications per prediction or threshold.
  3. Do not schedule for vehicles in `mutedReminderVehicleIds` or for snoozed reminders.
  4. Sign-out clears all scheduled notifications.
- **Business rules:** All members of a vehicle are notified, each on their own device. Reminder edits by another member reach a phone only when the app next opens (L5). Local, inexact, no exact-alarm permission (§23.3 *Notifications*). Mute silences phone notifications only (OQ-46).
- **Edge cases:** Permission denied (reminders still show in the app, OQ-46). Device time zone change. Many reminders. Decision applied: RD-03: follow-ups after the due date, snooze effects, how a predicted odometer notification is timed; RD-12: whether archived vehicles' reminders are scheduled and how far ahead.
- **Android/web differences:** Android only. Web schedules nothing.
- **Offline behavior:** Fully local; scheduling uses cached data.
- **Security implications:** Notification content may show on a locked screen; content is RD-10.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The device's scheduled set is rebuilt on app open, on a reminder change and on an entry being logged [§23.3 *Scheduling on the phone*].
  2. Muted vehicles and snoozed reminders have no scheduled notification [OQ-46].
  3. Sign-out leaves no scheduled notification [FR-OUT-05].
  4. The release manifest has no exact-alarm permission [§23.3 *Notifications*].
  5. Web schedules nothing and does not error [§23.3 *Web*].
- **Decisions applied:** RD-03 ◐, RD-06 ◐, RD-10 ◐, RD-12 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-03 ◐] A date reminder schedules a lead notification at 9:00 local `leadDays` before the due date, a due-date notification at 9:00, and one overdue notification the next day, and nothing more; a snoozed reminder schedules nothing until the snooze ends.
  2. **D2** [RD-06 ◐] Snooze for tomorrow, 3 days and next week ends at 9:00 local on that day; a snoozed reminder is absent from the Dashboard card and silent but listed as 'Snoozed until <date>' and can be cancelled; changing its due date clears the snooze.
  3. **D3** [RD-10 ◐] A reminder notification shows the reminder title and the vehicle name with due information, never an amount or plate; tapping it opens that vehicle's Reminders screen at the reminder; tapping an EMI notification opens the Expense form with category 'Loan EMI', the amount and the current date.
  4. **D4** [RD-12 ◐] Reminders of archived vehicles are not scheduled and cannot be created or edited; at most the soonest 60 notifications within the next 60 days are scheduled across the user's non-archived vehicles.
- **Test requirements:** Jest with a fake scheduler; manual device checks of delivery time and rebuild (REM-12).
- **Dependencies:** REM-01; gate REM-02; FND-DAT-07, FND-AUTH-08.
- **PRD requirement IDs:** PR-11, FR-OFF-11, FR-OUT-05, NFR-03, L5, OQ-46.
- **SRS reference:** Scheduling L401–405; Notifications library L116; Sign-out L245; Limitations L829.

---

# R2 — Managing reminders

### REM-05 — Create, edit and delete a reminder
- **Epic:** R2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle member, I want to set a reminder by date, by odometer or both, so that I am told before something is due.
- **Business value:** The core of the sub-project: a reminder only exists if it can be created and kept correct (PR-11).
- **Scope:** *In:* the reminder form: subject (a service type, an expense category, or a custom title); title pre-filled from the subject; optional date trigger (due date, optional repeat every N months); optional odometer trigger (due odometer, optional repeat every N distance); lead days (default 7) and lead distance (default 500), adjustable; optional amount for recurring payments; save, edit and delete through `reminderRepo` write operations. *Out:* the list (REM-04), auto-complete (REM-06), notification permission (REM-08).
- **Preconditions:** REM-01, `FND-DAT-07`, `FND-SEC-02`, `LOG-03` (category lists).
- **Functional behavior:**
  1. Pick a subject: a service type, an expense category, or a custom title; the title is filled in and can be edited.
  2. Set a date trigger, an odometer trigger, or both; each can repeat.
  3. Adjust lead days and lead distance; optionally set an amount.
  4. Save creates the reminder with `status` active; edit updates it; delete removes it.
  5. Every member of the vehicle can create, edit and delete.
- **Business rules:** At least one of `dateTrigger` and `odometerTrigger` is required; odometer values are in the vehicle's unit; `amountMinor` is an integer in minor units; reminders are read, created, updated and deleted by any member (rules) (Appendix E, §23.3 *Storage*).
- **Edge cases:** A due date in the past. A due odometer below the current reading. Reminders on an archived vehicle (Foundation DR-13, RD-12). Offline edit on Android. Decision applied: RD-09: validation, ranges, limits and which reminders may carry an amount; RD-05: repeat meaning.
- **Android/web differences:** Android works offline with the sync icon; web edits online only, with dialogs at 768 px and wider.
- **Offline behavior:** Saves locally on Android and rebuilds the schedule (REM-03).
- **Security implications:** Rules allow any member; title is user text and is never sent to Crashlytics.
- **Data/schema impact:** `reminders` documents per Appendix E; resolves Foundation DR-23 for this repository.
- **Acceptance criteria:**
  1. A reminder can be created for a service type, an expense category, or a custom title, with the title pre-filled [§23.3 *What a reminder is about*].
  2. Saving is blocked when neither a date nor an odometer trigger is set [Appendix E].
  3. A reminder can have both triggers, each one-off or repeating [§23.3 *Triggers*].
  4. Lead days default to 7 and lead distance to 500, and both can be changed per reminder [§23.3 *Notification timing*].
  5. A second member can edit and delete the reminder [§23.3 *Storage*, rules].
  6. Creating, editing and deleting work offline on Android [PR-03].
- **Decisions applied:** DR-03 ✔, DR-13 ◐, DR-23 ◐, LD-06 ◐, RD-02 ◐, RD-05 ◐, RD-09 ◐, RD-12 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  2. **D2** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  3. **D3** [DR-23 ◐] `reminderRepo`, `templateRepo` and `inviteRepo` read and validate in Foundation, and `inviteRepo` has no write operations until the Sharing sub-project.
  4. **D4** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
  5. **D5** [RD-02 ◐] With readings spanning at least 7 days in the last 90 days the average per day is (largest minus smallest reading) divided by the days between them and the predicted due date is the latest reading's date plus the remaining distance divided by that average; with fewer than 2 readings or a span under 7 days the reminder shows 'due in N km'; an `hours` vehicle cannot add an odometer trigger.
  6. **D6** [RD-05 ◐] Adding 1 month to 31 January gives 28 February (29 in a leap year); a completing entry without an odometer rolls the odometer trigger from `lastOdometer`; a repeating reminder stays active with the latest completion in `completedAt` and `completedByEntryId` while a one-off becomes done; Mark done on a repeating reminder rolls forward from today.
  7. **D7** [RD-09 ◐] A title over 60 characters, a 51st reminder, repeat months outside 1 to 120, repeat distance outside 1 to 999,999, lead days outside 0 to 365 or lead distance outside 0 to 99,999 is rejected; a past due date is accepted; a due odometer below the current reading is accepted with a warning; an amount is accepted on any reminder.
  8. **D8** [RD-12 ◐] Reminders of archived vehicles are not scheduled and cannot be created or edited; at most the soonest 60 notifications within the next 60 days are scheduled across the user's non-archived vehicles.
- **Test requirements:** RNTL form tests; emulator repository tests.
- **Dependencies:** REM-01; FND-DAT-07, FND-SEC-02; LOG-03.
- **PRD requirement IDs:** PR-11, PR-03, FR-SEC-02, FR-SEC-03, OQ-31, OQ-41; §23.3 *Triggers*, *What a reminder is about*.
- **SRS reference:** Triggers L376–379; Subject L381; Schemas L757–772; Rules matrix L190.

### REM-04 — Reminders screen: list, status and quick-add suggestions
- **Epic:** R2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want one place that lists my vehicle's reminders and their state, so that I can see what is coming and add common ones in a tap.
- **Business value:** Replaces "Coming soon" in More; makes reminders visible and quick to start.
- **Scope:** *In:* More → Reminders for the selected vehicle: the list with each reminder's due date or "due in N km" and its status; quick-add chips ("Insurance renewal", "PUC expiry", "Service every 10,000 km / 12 months") that open the form pre-filled; empty state; web view and edit. *Out:* creating the form (REM-05), Mark done and Snooze actions (REM-07).
- **Preconditions:** REM-01, REM-05, `FND-SHL-02`, `FND-SHL-04`.
- **Functional behavior:**
  1. The list shows reminders sorted by urgency with their due information and state.
  2. Tapping a chip opens the create form pre-filled; nothing is created until the user saves.
  3. For an odometer reminder without a prediction the row shows "due in 1,200 km"-style text.
- **Business rules:** Nothing is auto-created (§23.3 *Quick-add suggestions*). Reminders can be viewed and edited on web (§23.3 *Web*). Distance figures are hidden for `hours` vehicles (OQ-11).
- **Edge cases:** No reminders. Many reminders. Malformed reminder document (skipped with the Foundation message). Decision applied: RD-01 (state names), RD-11 (row content, grouping).
- **Android/web differences:** Web is online-only for edits; dialogs at 768 px and wider.
- **Offline behavior:** Lists from the cache; pending items show the sync icon.
- **Security implications:** Members only (rules).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. More → Reminders opens the list instead of "Coming soon" [FR-NAV-05].
  2. Each of the three chips opens the form pre-filled and creates nothing until saved [§23.3 *Quick-add suggestions*].
  3. An odometer reminder with no prediction shows the remaining distance [§23.3 *Odometer prediction*].
  4. The list opens and edits on web [§23.3 *Web*].
- **Decisions applied:** DR-16 ◐, RD-01 ◐, RD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-16 ◐] Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen.
  2. **D2** [RD-01 ◐] A date reminder shows Due today on its due date and Overdue from the next day; an odometer reminder is Overdue when `lastOdometer` is at or past its due odometer; the states Upcoming, Due soon, Due today, Overdue and Done exist.
  3. **D3** [RD-11 ◐] A reminder row shows its title, due text, status chip and repeat icon in OQ-47 order; the Dashboard card shows at most 3 reminders with 'See all'; with none it shows 'No upcoming reminders' and an Add reminder shortcut.
- **Test requirements:** RNTL with seeded reminders.
- **Dependencies:** REM-01, REM-05; FND-SHL-02, FND-SHL-04.
- **PRD requirement IDs:** PR-11, FR-NAV-05, OQ-11, OQ-46; §23.3 *Quick-add suggestions*, *Web*.
- **SRS reference:** Quick-add L407; Web L413; Navigation L259.

### REM-07 — Mark done and Snooze
- **Epic:** R2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to mark a reminder done or snooze it, so that I can deal with it on my terms.
- **Business value:** Not every completion is a logged entry, and not every reminder is wanted right now (§23.3 *Manual actions*).
- **Scope:** *In:* **Mark done** on a reminder (sets `status`, `completedAt`); **Snooze** with three choices, tomorrow, in 3 days, or next week, stored per user on the device; effects on the list, Dashboard card and scheduled notifications. *Out:* auto-complete (REM-06).
- **Preconditions:** REM-01, REM-05, REM-04.
- **Functional behavior:**
  1. Mark done completes the reminder for all members (the document is shared).
  2. Snooze hides or de-emphasizes the reminder for this user only, until the chosen time.
  3. Snoozing removes its scheduled notifications until then.
- **Business rules:** Snooze is per user and stored on the device, not in the reminder (Appendix E, OQ-46). Overdue reminders stay on the Dashboard until done or snoozed (§23.3 *Dashboard*).
- **Edge cases:** Snooze on web (storage place). Device reinstall loses snoozes. Snooze expiring while the app is closed. Decision applied: RD-05: what Mark done does to a repeating reminder; RD-06: what a snooze hides, its time of day, and snooze storage on web.
- **Android/web differences:** Snooze storage on web is RD-06.
- **Offline behavior:** Mark done is a local-first write on Android; snooze is local only.
- **Security implications:** None.
- **Data/schema impact:** Updates `status`, `completedAt` on the reminder; snooze is not stored in Firestore.
- **Acceptance criteria:**
  1. Mark done changes the reminder for every member [§23.3 *Manual actions*].
  2. Snooze offers tomorrow, in 3 days and next week [OQ-46].
  3. A snooze affects only the user who set it [OQ-46].
  4. A snoozed reminder has no scheduled notification until the snooze ends [§23.3 *Manual actions*, OQ-46].
- **Decisions applied:** RD-05 ◐, RD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-05 ◐] Adding 1 month to 31 January gives 28 February (29 in a leap year); a completing entry without an odometer rolls the odometer trigger from `lastOdometer`; a repeating reminder stays active with the latest completion in `completedAt` and `completedByEntryId` while a one-off becomes done; Mark done on a repeating reminder rolls forward from today.
  2. **D2** [RD-06 ◐] Snooze for tomorrow, 3 days and next week ends at 9:00 local on that day; a snoozed reminder is absent from the Dashboard card and silent but listed as 'Snoozed until <date>' and can be cancelled; changing its due date clears the snooze.
- **Test requirements:** RNTL; Jest with fake timers.
- **Dependencies:** REM-01, REM-05, REM-04, REM-03.
- **PRD requirement IDs:** PR-11, OQ-46, OQ-47; §23.3 *Manual actions*.
- **SRS reference:** Auto-complete and manual actions L383–387; OQ-46 L674; Schemas snooze note L772.

---

# R3 — Automatic behavior and notifications

### REM-06 — Auto-complete and roll-forward on matching entries
- **Epic:** R3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want a reminder to complete itself when I log the matching service or expense, so that I do not have to tick it off by hand.
- **Business value:** Removes double entry and keeps repeating reminders accurate (PR-11).
- **Scope:** *In:* when an entry is saved, find matching active reminders on that vehicle; mark them done (`completedAt`, `completedByEntryId`); roll repeating reminders forward from the entry's date and odometer; rebuild the schedule. *Out:* editing or deleting a completing entry afterwards (decided by RD-04), Mark done (REM-07).
- **Preconditions:** REM-01, REM-05, `LOG-04`, `LOG-07`, `LOG-08`.
- **Functional behavior:**
  1. Saving a service entry with a line item of a reminder's service type, or an expense in its category, completes that reminder.
  2. A one-off reminder becomes done; a repeating reminder rolls forward and stays active.
  3. A repeating reminder with both triggers rolls both forward from that entry.
  4. The notification schedule is rebuilt.
- **Business rules:** "Matching" means a service line item of that type or an expense in that category (§23.3 *Auto-complete*, OQ-41). Any member can update reminders (rules).
- **Edge cases:** An entry matches several reminders. An entry with no odometer when the reminder has an odometer trigger. The entry is saved offline. Decision applied: RD-04, RD-05.
- **Android/web differences:** Same logic; web needs the network.
- **Offline behavior:** The reminder update queues with the entry on Android.
- **Security implications:** Rules require the caller to be a member; the update sets `updatedAt` and audit fields from the session.
- **Data/schema impact:** Updates `status`, `completedAt`, `completedByEntryId`, triggers on `reminders`.
- **Acceptance criteria:**
  1. Logging a service entry with an "engine oil" line completes an active "engine oil" reminder [§23.3 *Auto-complete*].
  2. Logging an expense in "insurance" completes an "insurance" reminder [§23.3 *Auto-complete*].
  3. A repeating "every 12 months and/or 10,000 km" reminder rolls both forward from the entry's date and odometer [OQ-46].
  4. A custom-title reminder is never auto-completed [§23.3 *What a reminder is about*].
  5. Completion works offline on Android [PR-03].
- **Decisions applied:** RD-04 ◐, RD-05 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-04 ◐] An expense in category X dated on or after a reminder's creation completes every active reminder for category X, and one dated earlier does not; a service line of the reminder's type completes it while a service entry's own category alone does not; editing or deleting the completing entry later does not reopen the reminder.
  2. **D2** [RD-05 ◐] Adding 1 month to 31 January gives 28 February (29 in a leap year); a completing entry without an odometer rolls the odometer trigger from `lastOdometer`; a repeating reminder stays active with the latest completion in `completedAt` and `completedByEntryId` while a one-off becomes done; Mark done on a repeating reminder rolls forward from today.
- **Test requirements:** Jest (REM-01 fixtures); emulator test of the batch with an entry.
- **Dependencies:** REM-01, REM-05; LOG-04, LOG-07, LOG-08.
- **PRD requirement IDs:** PR-11, PR-03, OQ-41, OQ-46; §23.3 *Auto-complete*.
- **SRS reference:** Auto-complete L383–387; OQ-46 L674; Schemas L757–772.

### REM-08 — Notification permission
- **Epic:** R3 · **Type:** User-facing · **Size:** S · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an Android 13+ user, I want to be asked for notification permission only when I create my first reminder, so that I understand why it is needed.
- **Business value:** Asking at install without context lowers acceptance; the SRS fixes the moment of the ask.
- **Scope:** *In:* ask for the Android 13+ notification permission when the user creates their first reminder; the denied state: reminders still appear in the app. *Out:* scheduling (REM-03).
- **Preconditions:** REM-03, REM-05.
- **Functional behavior:**
  1. Nothing is asked at install.
  2. Creating the first reminder triggers the system permission prompt.
  3. If denied, the reminder is still saved and shown in the app; no notifications are scheduled.
- **Business rules:** §23.3 *Permission*, OQ-46.
- **Edge cases:** Android 12 and below (no runtime permission). The user later enables it in system settings. "Don't ask again". Decision applied: RD-08: any in-app notice when notifications are off and how the user is guided to enable them.
- **Android/web differences:** Android only.
- **Offline behavior:** N/A.
- **Security implications:** Only the notification permission is requested; no location or media (PR-01).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A fresh install does not request the permission [§23.3 *Permission*].
  2. Creating the first reminder requests it [§23.3 *Permission*].
  3. After denial the reminder remains visible in the app and nothing is scheduled [OQ-46].
- **Decisions applied:** RD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-08 ◐] With notification permission denied the Reminders screen shows the one-time notice with an Open settings button; on Android 12 and lower no prompt or notice appears.
- **Test requirements:** Manual on Android 13+ and on a lower version.
- **Dependencies:** REM-03, REM-05.
- **PRD requirement IDs:** PR-11, PR-01, OQ-46; §23.3 *Permission*.
- **SRS reference:** Scheduling L401–405; OQ-46 L674.

### REM-09 — Per-vehicle mute
- **Epic:** R3 · **Type:** User-facing · **Size:** S · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a family member, I want to mute a vehicle's reminders on my phone, so that I am not notified about a car I do not manage, without affecting anyone else.
- **Business value:** Shared vehicles notify everyone; mute makes that tolerable (§23.3 *Mute*).
- **Scope:** *In:* a "Mute reminders" toggle per vehicle, default off, stored in the user's own `users/{uid}.settings.mutedReminderVehicleIds`; muted vehicles get no scheduled phone notifications. *Out:* hiding reminders in the app.
- **Preconditions:** REM-03, `FND-SET-02`, `FND-VEH-02`.
- **Functional behavior:** Switching mute on adds the vehicle id to the user's list; REM-03 schedules nothing for it; switching it off restores scheduling.
- **Business rules:** Mute silences phone notifications only; the in-app list and Dashboard card are unaffected; mute is per user (FR-SET-07, OQ-46).
- **Edge cases:** Muting an archived or deleted vehicle (stale ids). Mute on web has no effect on notifications. Decision applied: RD-07.
- **Android/web differences:** The setting syncs; web sends no notifications either way.
- **Offline behavior:** Local-first write on Android.
- **Security implications:** The setting is in the user's own document (self only, rules).
- **Data/schema impact:** Updates `users/{uid}.settings.mutedReminderVehicleIds`.
- **Acceptance criteria:**
  1. The toggle defaults to off and is set per vehicle [§23.3 *Mute*, FR-SET-07].
  2. Muting vehicle A on one user's phone does not change another member's notifications [§23.3 *Mute*].
  3. A muted vehicle's reminders still show in the app and on the card [OQ-46].
- **Decisions applied:** RD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-07 ◐] Every member of a vehicle sees the mute switch on its vehicle settings sheet; turning it on adds the vehicle id to that user's own `mutedReminderVehicleIds` and changes nothing for other members.
- **Test requirements:** RNTL; Jest with the scheduler fake.
- **Dependencies:** REM-03; FND-SET-02, FND-VEH-02.
- **PRD requirement IDs:** PR-11, FR-SET-05, FR-SET-07, OQ-46; §23.3 *Mute*.
- **SRS reference:** Who is notified and muting L369–374; Settings L282; Data model L137.

### REM-11 — Recurring payment reminders open a pre-filled expense form
- **Epic:** R3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As someone paying a monthly EMI, I want the reminder to open a ready-to-save expense form, so that logging takes one tap, while the app never logs anything for me.
- **Business value:** Delivers recurring payments without recurring auto-entries, which are out of v1.
- **Scope:** *In:* a repeating date reminder with an amount; tapping its notification (or its row) opens the expense form pre-filled; the user must save. *Out:* any automatic entry creation.
- **Preconditions:** REM-03, REM-05, `LOG-07`.
- **Functional behavior:**
  1. A reminder with a repeating date trigger and an amount shows the amount in its notification.
  2. Tapping the notification opens the Expense form with fields pre-filled from the reminder.
  3. Nothing is saved until the user saves; saving also completes the matching reminder (REM-06).
- **Business rules:** "The app never logs anything without the user" (§23.3 *Recurring payments*); recurring auto-entries remain out of v1.
- **Edge cases:** The user dismisses the form. The notification is tapped on a vehicle other than the selected one. Decision applied: RD-10.
- **Android/web differences:** Notifications are Android only; on web the row action can open the form.
- **Offline behavior:** The form saves locally on Android.
- **Security implications:** Notification text may show on a lock screen (RD-10).
- **Data/schema impact:** None until the user saves an expense.
- **Acceptance criteria:**
  1. Tapping the notification opens the Expense form pre-filled and no entry exists yet [§23.3 *Recurring payments*].
  2. Saving creates one expense and completes or rolls the reminder forward [§23.3, OQ-46].
  3. Dismissing the form creates nothing [§23.3].
- **Decisions applied:** RD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-10 ◐] A reminder notification shows the reminder title and the vehicle name with due information, never an amount or plate; tapping it opens that vehicle's Reminders screen at the reminder; tapping an EMI notification opens the Expense form with category 'Loan EMI', the amount and the current date.
- **Test requirements:** RNTL with a notification-response fake; manual on device.
- **Dependencies:** REM-03, REM-05, REM-06; LOG-07.
- **PRD requirement IDs:** PR-11, OQ-31, OQ-46; §23.3 *Recurring payments such as EMI*.
- **SRS reference:** Recurring payments L409; Schemas L757–772.

---

# R4 — Dashboard and verification

### REM-10 — Dashboard "Upcoming & overdue" card
- **Epic:** R4 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to see what is overdue and coming up when I open the app, so that I act on it without opening the Reminders screen.
- **Business value:** Surfaces due items where users look first; OQ-47 puts this card in this sub-project.
- **Scope:** *In:* an "Upcoming & overdue" card on the Dashboard for the selected vehicle, sorted by urgency; overdue reminders stay until done or snoozed; a tap opens the reminder. *Out:* other Dashboard content (tab 4).
- **Preconditions:** REM-01, REM-05, REM-07, `FND-SHL-02`.
- **Functional behavior:**
  1. The card lists the vehicle's active reminders, overdue first, then soonest due; odometer reminders without a prediction rank after dated ones.
  2. Overdue reminders remain until marked done or snoozed.
  3. A muted vehicle's reminders still appear (mute affects phone notifications only).
- **Business rules:** OQ-47, OQ-46, §23.3 *Dashboard*.
- **Edge cases:** No reminders (card state, RD-11). Many items. Snoozed items. Dashboard content when the vehicle has other widgets arrives in tab 4.
- **Android/web differences:** Same card; web at 768 px and wider uses the rail layout.
- **Offline behavior:** Reads from the cache.
- **Security implications:** Members only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The card orders items overdue first, then soonest due, with unpredicted odometer reminders after dated ones [OQ-47].
  2. An overdue reminder stays until done or snoozed [§23.3 *Dashboard*].
  3. A muted vehicle's overdue reminder still shows [OQ-46].
- **Decisions applied:** DR-17 ◐, RD-01 ◐, RD-06 ◐, RD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
  2. **D2** [RD-01 ◐] A date reminder shows Due today on its due date and Overdue from the next day; an odometer reminder is Overdue when `lastOdometer` is at or past its due odometer; the states Upcoming, Due soon, Due today, Overdue and Done exist.
  3. **D3** [RD-06 ◐] Snooze for tomorrow, 3 days and next week ends at 9:00 local on that day; a snoozed reminder is absent from the Dashboard card and silent but listed as 'Snoozed until <date>' and can be cancelled; changing its due date clears the snooze.
  4. **D4** [RD-11 ◐] A reminder row shows its title, due text, status chip and repeat icon in OQ-47 order; the Dashboard card shows at most 3 reminders with 'See all'; with none it shows 'No upcoming reminders' and an Add reminder shortcut.
- **Test requirements:** RNTL with seeded reminders and a fixed clock.
- **Dependencies:** REM-01, REM-05, REM-07; FND-SHL-02.
- **PRD requirement IDs:** PR-11, OQ-46, OQ-47; §23.3 *Dashboard*.
- **SRS reference:** Dashboard L411; OQ-47 L675.

### REM-12 — Device verification of notifications and reminder flows
- **Epic:** R4 · **Type:** Verification · **Size:** M · **Readiness:** Ready once REM-03 to REM-11 are built
- **User story:** As the maintainer, I want the reminder flows and notification delivery proven on a real device, so that I know reminders actually fire.
- **Business value:** Local notifications cannot be proven in unit tests alone; delivery timing and rebuild behavior are device behaviors.
- **Scope:** *In:* a manual checklist and run record on a real Android device: delivery at 9 AM local for date reminders and the lead notification; odometer notification on prediction and on threshold; rebuild on app open, reminder change and entry; permission flows on Android 13+ and lower; mute; snooze; sign-out clears scheduled notifications; the stated propagation limit (another member's edit reaching the phone only on next open); web view and edit with no notification. Updates to the Maestro flows if any step can be automated. *Out:* the Play closed test.
- **Preconditions:** REM-03 to REM-11.
- **Functional behavior:** Runnable by someone other than the author.
- **Business rules:** Notifications are inexact (§23.3 *Notifications*): timing checks allow for that.
- **Edge cases:** Device time-zone change; reboot; battery optimizations affecting delivery.
- **Android/web differences:** Device checks are Android; web is a smoke test.
- **Offline behavior:** Airplane mode delivery of already scheduled notifications.
- **Security implications:** Test data only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A date reminder notifies 7 days before and on the due date at 9 AM local on a real device [§23.3 *Notification timing*].
  2. Muting a vehicle silences its notifications and not another member's [§23.3 *Mute*].
  3. After sign-out no scheduled notification fires [FR-OUT-05].
  4. With permission denied the reminders show in the app and nothing is scheduled [OQ-46].
  5. Another member's edit reaches this phone only after the app is next opened [L5].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** REM-03 to REM-11.
- **PRD requirement IDs:** PR-11, FR-OUT-05, L5, OQ-46, TS-07.
- **SRS reference:** Scheduling L401–405; Limitations L829; Testing L309–322.

---

# A. Reminders epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **R1 Reminders domain and scheduling** | The pure reminder logic, the quota check, and the local notification service | REM-01 to REM-03 |
| **R2 Managing reminders** | Create, edit and delete; the list with quick-add chips; Mark done and Snooze | REM-04, REM-05, REM-07 |
| **R3 Automatic behavior and notifications** | Auto-complete and roll-forward, the permission ask, per-vehicle mute, recurring-payment form | REM-06, REM-08, REM-09, REM-11 |
| **R4 Dashboard and verification** | The Upcoming & overdue card and real-device verification | REM-10, REM-12 |

**Architectural versus user-facing.** Architecture or spike: REM-01, REM-02, REM-03. User-facing: REM-04 to REM-11. Verification: REM-12.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`RD-nn`, or an earlier `DR-nn` / `LD-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | REM-01 ◆ | Domain: reminder logic | L | FND-DAT-01, FND-DAT-02 |
| W1 | REM-02 ◆ | Spike: quota cost of scheduling | S | FND-VER-01, FND-DAT-07 |
| W2 | REM-03 ◆ | Local notification scheduling service | L | REM-01; gate REM-02; FND-DAT-07, FND-AUTH-08 |
| W2 | REM-05 ◆ | Create, edit and delete a reminder | L | REM-01; FND-DAT-07, FND-SEC-02; LOG-03 |
| W3 | REM-04 ◆ | Reminders screen: list, status, quick-add | M | REM-01, REM-05; FND-SHL-02, FND-SHL-04 |
| W3 | REM-06 ◆ | Auto-complete and roll-forward | L | REM-01, REM-05; LOG-04, LOG-07, LOG-08 |
| W3 | REM-08 ◆ | Notification permission | S | REM-03, REM-05 |
| W3 | REM-09 ◆ | Per-vehicle mute | S | REM-03; FND-SET-02, FND-VEH-02 |
| W4 | REM-07 ◆ | Mark done and Snooze | M | REM-01, REM-03, REM-04, REM-05 |
| W4 | REM-11 ◆ | Recurring-payment reminder opens pre-filled expense | M | REM-03, REM-05, REM-06; LOG-07 |
| W5 | REM-10 ◆ | Dashboard "Upcoming & overdue" card | M | REM-01, REM-05, REM-07; FND-SHL-02 |
| W6 | REM-12 | Device verification of notifications | M | REM-03 to REM-11 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | REM-01 ∥ REM-02 | Domain code versus a measurement spike |
| Service and form | REM-03 ∥ REM-05 | Notification service versus the reminder form and repository |
| After the form | REM-04 ∥ REM-06 ∥ REM-08 ∥ REM-09 | List, auto-complete, permission ask and mute touch different files |
| Late features | REM-07 ∥ REM-11 | Row actions versus notification-tap routing |

**Not parallel:** REM-10 needs snooze (REM-07). REM-12 is last. REM-03's acceptance waits on REM-02.

**Early starts.** REM-04's list component can begin in W2 against seeded reminders once REM-01's status shape exists. REM-12's checklist can be drafted as stories land.

---

# D. Blocking dependencies

**D1. Earlier sub-projects must be accepted first.** The PRD lists the dependencies as Foundation and Logging (entries to match, and the odometer). Needed specifically: `FND-DAT-07`, `FND-SEC-02`, `FND-SHL-02`, `FND-SHL-04`, `FND-SET-02`, `FND-VEH-02`, `FND-AUTH-08`, and from Logging `LOG-03`, `LOG-04`, `LOG-07`, `LOG-08`, plus the entry edit and delete behavior (`LOG-13`, `LOG-14`) for RD-04.

**D2. Quota.** REM-02 should pass before REM-03 is accepted. It cannot pass until Foundation's DR-20 (the threshold) is answered.

**D3. Decisions that block the domain code.** RD-01 to RD-05 define statuses, prediction, schedule, matching and roll-forward. REM-01's tests cannot be finished without them, and every other story reads REM-01.

**D4. Decisions that block the data shape.** RD-05 (what fields hold after a roll-forward or Mark done) affects the reminder document. The model is meant to need no migrations, so RD-05 should be settled before REM-05 and REM-06 write real data.

**D5. Earlier decisions that carry in.** Foundation DR-01 and Logging LD-05 (which odometer readings exist) feed prediction. DR-03 and LD-06 (stored encodings, category storage, "Other") feed matching and the subject field. DR-13 (archived vehicles) and RD-12 affect creation and scheduling on archived vehicles. DR-17 affects the Dashboard shell the card lives in.

**D6. External.** An Android device (and one on Android 12 or lower) for notification checks. No new scope or permission beyond notifications; the SRS asks for no exact-alarm permission.

**D7. Later tabs.** Reminders are included in Drive backup and restore through the serializer (tab 5); sharing makes the "all members are notified" rule observable (tab 6); checklists create reminders by shortcut (tab 7). Nothing here should block them.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema** = needed before reminder documents are written · **Story** = before the named story is accepted · **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **RD-01** | **Status and "overdue".** The states shown to users and when a reminder moves between them: when a date reminder becomes overdue, when an odometer reminder does (reading at or past the due value, or a predicted date passing), and what "due soon" means inside the lead window. | Appendix E stores only `status` as `active` or `done`. OQ-47 and the Dashboard text use "overdue" and "upcoming" without defining them. | REM-01, REM-04, REM-10 | Story |
| **RD-02** | **Prediction details.** The formula for average km per day over the 90-day window; which entries supply readings (all types with an odometer, trips' odometers, the starting odometer); how the predicted due date is derived; units for mile-based vehicles; whether odometer reminders exist for `hours` vehicles. | §23.3 states "average km per day from the last 90 days of readings" with at least 2 readings spanning 7 days. OQ-11 hides km-per-day reminders for `hours`. Foundation DR-01 and Logging LD-05 leave the reading sources open. | REM-01, REM-05 | Story |
| **RD-03** | **Notification schedule details.** Whether anything follows after the due date; what a snooze does to scheduled notifications; how a predicted odometer notification is timed (date and hour); when the no-prediction threshold notification fires (only when a reading is logged on this phone, or also after another member's reading is picked up on next open); whether the due-date notification is independent of lead days. | §23.3 and OQ-46 give "7 days before and on the due date at 9 AM", "within 500 km" and the no-prediction rule, not these cases. | REM-01, REM-03 | Story |
| **RD-04** | **Matching details.** Whether any matching entry completes a reminder regardless of its date, or only entries after the reminder's creation or inside a window; behavior when several reminders match; what happens when a completing entry is later edited (category, odometer) or deleted; whether a service entry's own category (not just its line items) matches. | §23.3 and OQ-41 define "matching" only as "a service line item of that type, or an expense in that category". | REM-01, REM-06 | Story |
| **RD-05** | **Roll-forward and Mark done.** Month arithmetic at month-ends; the base when the completing entry lacks an odometer; what fields hold after a roll-forward (status, `completedAt`, `completedByEntryId`); what Mark done does to a repeating reminder (end it, or roll forward, and from when). | OQ-46 says repeating reminders roll forward from the completing entry. Appendix E says `completedAt` and `completedByEntryId` are "set by auto-complete or Mark done" and does not say what a repeating reminder holds afterward. | REM-01, REM-05, REM-06, REM-07 | Schema |
| **RD-06** | **Snooze semantics.** What a snooze hides (list, card, notifications); the time of day "tomorrow", "in 3 days" and "next week" end; storage on web; what happens if the reminder changes during a snooze; whether a snooze can be cancelled. | OQ-46 fixes the three choices and that snooze is per user and stored on the device. | REM-03, REM-07, REM-10 | Story |
| **RD-07** | **Where mute lives.** Which screen holds "Mute reminders" ("on the vehicle's settings") and its wording. | FR-SET-07 and §23.3 say "set per vehicle, on the vehicle's settings" without naming the screen. | REM-09 | Story |
| **RD-08** | **Permission-off states.** Any in-app notice when notifications are off, any link to system settings, behavior on Android 12 and lower, and the wording. | §23.3 and OQ-46 fix when to ask and that reminders still show in the app if denied. | REM-08 | Copy |
| **RD-09** | **Reminder form rules.** Title length; maximum reminders per vehicle; whether a past due date or a due odometer below the current reading is allowed; ranges for repeat months, repeat distance, lead days and lead distance (including zero); which reminders may carry an amount; the currency of the amount; the label for a service-type subject of "Other". | Appendix E lists the fields, defaults (7 and 500) and the at-least-one-trigger rule only. | REM-05 | Story |
| **RD-10** | **Notification content and taps.** The notification text (for example whether it names the vehicle, plate or amount, given lock-screen visibility); what a normal reminder notification opens; which fields of the Expense form an EMI reminder pre-fills (category, amount, date); behavior when the tapped vehicle is not the selected one. | §23.3 says tapping the EMI notification "opens a pre-filled expense form" without naming the fields. | REM-03, REM-11 | Story |
| **RD-11** | **List and card content.** What each row shows; how many items the card shows and whether there is a "see all"; the card's empty state; grouping and status wording. | OQ-47 fixes ordering only. | REM-04, REM-10 | Story |
| **RD-12** | **Scheduling scope.** Whether archived vehicles' reminders are scheduled, created or edited; which vehicles a phone schedules for (all of the user's vehicles); how far ahead and how many notifications at once. | §23.3 says all members are notified and notifications are scheduled on each device; archive is read-only (OQ-39). | REM-03, REM-05 | Story |

**Decisions from earlier sub-projects that carry in:** Foundation DR-01 starting odometer · DR-03 stored encodings · DR-06 text-length caps · DR-07 formatting · DR-13 archived-vehicle actions · DR-16 copy gaps · DR-17 shell content · DR-20 quota threshold · DR-23 `reminderRepo` operations (answered in practice by REM-05) · Logging LD-04 entry date · LD-05 odometer readings · LD-06 category storage and "Other".

**Can start before any decision is answered:** REM-02, the mechanism parts of REM-03 (scheduler wrapper, cancel-all, sign-out hook), REM-05's form shell, REM-09's toggle and storage, REM-08's permission call, and REM-04's list structure.

---

# F. Reminders Definition of Done

The PRD defines no acceptance criteria for sub-project 3, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.3)**
- [ ] A member can create, edit and delete date and odometer reminders, each one-off or repeating, for a service type, an expense category, or a custom title.
- [ ] Logging a matching service line item or expense completes the reminder, and a repeating reminder rolls forward from that entry's date and odometer, both triggers together.
- [ ] Mark done and Snooze work; snooze is per user and on the device.
- [ ] Prediction uses the last 90 days of readings and falls back to "due in N km" without enough data.
- [ ] Local notifications fire on each Android device at the stated times, with lead times adjustable per reminder, and are rebuilt on app open, reminder change and entry.
- [ ] Per-vehicle mute silences only the user's own phone notifications.
- [ ] The "Upcoming & overdue" card orders overdue first, then soonest due, odometer without prediction after dated ones.
- [ ] A recurring-payment reminder opens a pre-filled expense form and logs nothing by itself.
- [ ] Reminders can be viewed and edited on web, with no notifications.

**Behavior**
- [ ] The notification permission is asked at the first reminder, not at install; with it denied, reminders still show in the app.
- [ ] Sign-out clears scheduled notifications.
- [ ] No exact-alarm, location or media permission was added (AC-D19, AC-D20).

**Evidence**
- [ ] Domain tests written first pass (TS-03 style).
- [ ] REM-02 passed: the quota budget holds with rescheduling.
- [ ] The device checklist (REM-12) is run and recorded.
- [ ] The Foundation rules suite still passes for the `reminders` path.

**Scope and quality**
- [ ] No out-of-scope feature exists: no automatic entries, no web notifications, no reports.
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `RD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 3; the last column cites the story's own criteria (`#n`) plus the applicable Foundation `AC-D`, test requirement or gate.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| REM-01 | PR-11, NFR-08, FR-DATA-12, OQ-11, OQ-41, OQ-46, OQ-47, TS-03 | Triggers L376–379; Auto-complete L383–387; Prediction L389–393; Timing L395–399; L757–772; OQ-46 L674; OQ-47 L675 | #1–#6 |
| REM-02 | NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12 | OQ-18 L642; Scheduling L401–405; L307 | #1–#3 |
| REM-03 | PR-11, FR-OFF-11, FR-OUT-05, NFR-03, L5, OQ-46 | Scheduling L401–405; L116; Sign-out L245; Limitations L829 | #1–#5 |
| REM-04 | PR-11, FR-NAV-05, OQ-11, OQ-46; §23.3 Quick-add, Web | Quick-add L407; Web L413; Navigation L259 | #1–#4 |
| REM-05 | PR-11, PR-03, FR-SEC-02, FR-SEC-03, OQ-31, OQ-41; §23.3 Triggers, Subject | Triggers L376–379; Subject L381; L757–772; Rules matrix L190 | #1–#6 |
| REM-06 | PR-11, PR-03, OQ-41, OQ-46; §23.3 Auto-complete | Auto-complete L383–387; OQ-46 L674; L757–772 | #1–#5 |
| REM-07 | PR-11, OQ-46, OQ-47; §23.3 Manual actions | L383–387; OQ-46 L674; L772 | #1–#4 |
| REM-08 | PR-11, PR-01, OQ-46; §23.3 Permission | Scheduling L401–405; OQ-46 L674 | #1–#3 |
| REM-09 | PR-11, FR-SET-05, FR-SET-07, OQ-46; §23.3 Mute | Muting L369–374; Settings L282; Data model L137 | #1–#3 |
| REM-10 | PR-11, OQ-46, OQ-47; §23.3 Dashboard | Dashboard L411; OQ-47 L675 | #1–#3 |
| REM-11 | PR-11, OQ-31, OQ-46; §23.3 Recurring payments | Recurring payments L409; L757–772 | #1–#3 |
| REM-12 | PR-11, FR-OUT-05, L5, OQ-46, TS-07 | Scheduling L401–405; Limitations L829; Testing L309–322 | #1–#5 |

**G2. §23.3 scope item → covering stories** (proves each item is covered).

| §23.3 scope item | Stories |
| --- | --- |
| Date reminders | REM-01, REM-05 |
| Odometer reminders | REM-01, REM-05 |
| Both triggers, one-off or repeating | REM-01, REM-05, REM-06 |
| Subject: service type, expense category, custom title | REM-05 |
| Auto-complete from matching entries and roll-forward | REM-01, REM-06 |
| Manual Mark done and Snooze | REM-07 |
| Km-per-day prediction and "due in N km" | REM-01, REM-04 |
| Local notifications (7 days before, on the due date, 9 AM; odometer within 500 km) | REM-01, REM-03, REM-12 |
| All members notified; reschedule on open, change, entry | REM-03 |
| Android 13+ permission at the first reminder | REM-08 |
| Per-vehicle mute in each user's own settings | REM-09 |
| Quick-add suggestions | REM-04 |
| Recurring payments (EMI) via pre-filled expense | REM-05 (amount), REM-11 |
| "Upcoming & overdue" Dashboard card | REM-10 |
| Web: view and edit, no notifications | REM-04, REM-05, REM-03 |
| Quota budget | REM-02 |
