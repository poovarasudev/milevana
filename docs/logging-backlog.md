# Milevana v1 — Sub-project 2: Logging — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 15 in 4 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Sub-project 2 is specified more thinly than Foundation.** The PRD says so itself: §23.2 records "what the source already fixes", the 2026-10-06 decisions (OQ-30, OQ-41 to OQ-45) and the approved field shapes (Appendix E), and states "Acceptance criteria: defined in tab 2". Two consequences:
- **There are no PRD acceptance criteria for sub-project 2** (PRD §25.4), and no `FR-` requirement IDs. The criteria in each story below are **derived from stated behavior** and cite the SRS or PRD row they restate. They are proposals for the product owner to confirm, in the same way the PRD labels its `AC-D` items as derived. They are not new requirements.
- **Requirement IDs cited are the PRD's existing ones**: `PR-10`, `PR-03`, `PR-18`, `NFR-*`, the Foundation `FR-*` that Logging builds on (`FR-DATA-11`, `FR-SEC-*`, `FR-OFF-*`, `FR-ERR-*`, `FR-NAV-04`), `OQ-*`, `TS-06`, gates `G2` and `G7`, and `AC-D*` items that Logging makes live. Where the PRD gives only a row in §23.2, the row name is cited, for example "§23.2 *Fuel entry input*".

**Labels.** `LOG-nn` story IDs and `LD-nn` decision labels are tracking labels, not requirement IDs. Foundation decisions are cited as `DR-nn` and Foundation stories as `FND-…`; both are defined in `docs/foundation-backlog.md`.

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `LD-nn`, and lists the open Foundation `DR-nn` items that carry into this sub-project.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.2):** fuel and EV charging with mileage, expenses, services with line items, income, manual trips, and the History list.

**What Foundation already provides** (assumed accepted): the full schema and `entryRepo` with the `lastOdometer` batch (`FND-DAT-02`, `FND-DAT-07`); entry rules (`FND-SEC-02`); the Add sheet with placeholders and the More list (`FND-SHL-02`); the vehicle switcher and selection (`FND-SHL-04`); settings and formatters (`FND-SET-02`, `FND-DAT-01`); offline, quota, access-denied, malformed-document and sync-icon behaviors (`FND-OBS-02` to `OBS-04`); the link prompt after the 5th entry (`FND-AUTH-04`); locked units (`FND-VEH-02`).

**Out of scope:** receipt photos and PDFs and the Drive upload queue (tab 5, so no attachment UI appears in any Logging form; the 5-attachment cap already exists in the schema and rules); inspection entries and checklists (tab 7, so the Inspection item in the Add sheet stays a placeholder); reminders and auto-complete (tab 3); reports, dashboard figures and cost per km as a metric (tab 4); CSV export and backup (tab 5); sharing and invites (tab 6); payment method, GPS location for fuel stations, and recurring auto-entries (the SRS lists these as left out of Logging); the Play closed test (tab 8; it starts after this sub-project).

**Scope notes (not product decisions):**
1. Members and other users' entries cannot exist until tab 6. Behaviors for them (read-only other-member entries, "Logged by …") are built and tested with seeded data.
2. Foundation's open decisions that Logging also needs are listed in section E (DR-01, DR-03, DR-06, DR-07, DR-08, DR-13, DR-15, DR-16). If Foundation has already answered them, those answers apply here.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| L1 | Logging domain and shared form | LOG-01 to LOG-04 |
| L2 | Entry types | LOG-05 to LOG-10 |
| L3 | History | LOG-11 to LOG-14 |
| L4 | Verification | LOG-15 |

---

# L1 — Logging domain and shared form

### LOG-01 — Spike: quota budget for Logging operations (gate G2)
- **Epic:** L1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the read and write cost of adding an entry and opening History counted, so that I know the free plan holds before History is built.
- **Business value:** There is no Blaze fallback, and History reads every entry of a vehicle. PRD §24.6 says G2 gates tabs 2 and 4.
- **Scope:** *In:* counts of Firestore reads and writes for add entry (the entry write, the `lastOdometer` write, the rules `get()`), edit, delete, History cold open at several entry counts, refresh, and filter and search (device-only, expected zero reads); projection at 100 to 500 daily active users, cache-first; a recommendation for how History loads entries. *Out:* Reports operations (tab 4).
- **Preconditions:** Foundation `FND-VER-01` method and DR-20 threshold.
- **Functional behavior:** A written budget with per-operation counts and the daily projection, and the History loading approach it supports.
- **Business rules:** Budget for roughly 100 to 500 daily active users with no Blaze fallback; reads are cache-first with a refresh control (OQ-18, NFR-20). Search and filters run on the device over loaded entries (OQ-45).
- **Edge cases:** A vehicle with years of entries. Shared-vehicle rules reads count once per request (OQ-35). Decision applied: LD-10: how many entries History loads at once.
- **Android/web differences:** Android cache-first; web has an in-memory cache only.
- **Offline behavior:** Counts assume cache reads.
- **Security implications:** None.
- **Data/schema impact:** May recommend query or loading changes before LOG-11 is accepted.
- **Acceptance criteria:**
  1. A document lists reads and writes per operation, including History cold open at several sizes [G2, OQ-18].
  2. The projection at 100 and 500 users is compared with the threshold and recorded pass or fail [G2].
  3. LOG-11 is not accepted before this passes [PRD §24.6].
- **Decisions applied:** DR-20 ✔, LD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
  2. **D2** [LD-10 ◐] History loads all of a vehicle's entries once, groups them under month headers, and each row shows the type icon, date, category or fuel summary, amount, 'Logged by' for others' entries, the odometer if present, and the sync icon.
- **Test requirements:** Measured from the emulator with request logging.
- **Dependencies:** FND-VER-01 (method), FND-DAT-07.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12; G2.
- **SRS reference:** OQ-18 L642; OQ-45 L670; History L357–363.

### LOG-02 — Domain: fuel logic (two-of-three input and mileage)
- **Epic:** L1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure fuel functions, so that the fuel form and mileage figures are correct and the bug-prone calculations are tested first.
- **Business value:** Domain functions hold the bug-prone calculations and get the deepest coverage (PRD §21.1).
- **Scope:** *In:* `src/domain/fuel.ts`: the "any two of price per unit, quantity and total" solver using `pricePerUnitMilli` and integer-minor totals; mileage per fuel type between two consecutive full fills of the same fuel; handling of `missedPrevious`; unit rules (CNG km/kg, EV km/kWh, mi variants for mile-based vehicles, fixed and not user-selectable; petrol and diesel follow the Efficiency format setting); `hours` vehicles return "not applicable". Written test-first. *Out:* cost per km as a Reports metric (tab 4), UI.
- **Preconditions:** FND-DAT-01 (`units.ts`, `money.ts`), FND-DAT-02 (fuel details shape).
- **Functional behavior:**
  1. Given any two of price per unit, quantity and total, return the third; the total stays in integer minor units so the input round-trips.
  2. Given a vehicle's fuel entries, return mileage per fuel type, only between two consecutive full fills of that same fuel; a bi-fuel vehicle yields separate figures per fuel.
  3. Convert display units per the rules above.
- **Business rules:** §23.2 *Fuel entry input*, *Mileage*; OQ-30, OQ-42. "Full tank" is on by default; "Missed previous fill-up" is a toggle.
- **Edge cases:** First fill (no earlier full fill). Partial fills between full fills. A missed previous fill. Bi-fuel. Equal or lower odometer. Zero quantity. *Decisions applied:* the mileage formula and what happens to partial and missed fills (LD-01); quantity units per fuel type and LPG efficiency (LD-02); rounding and zero or negative inputs (LD-03).
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None (uses the fuel details shape).
- **Acceptance criteria:**
  1. For each pair of the three inputs the solver returns the third and the G7 fixtures (a price quoted to three decimals; 12.5 UK gallons) round-trip exactly [OQ-30, G7].
  2. Mileage is computed only between two consecutive full fills of the same fuel [§23.2 *Mileage*].
  3. Bi-fuel and missed-fill fixtures produce the results fixed by LD-01 [TS-03].
  4. CNG and EV figures use km/kg and km/kWh (mi/kg, mi/kWh for mile-based vehicles); petrol and diesel follow the Efficiency format [OQ-42].
  5. An `hours` vehicle returns "not applicable" for distance-based figures [OQ-11].
- **Decisions applied:** LD-01 ◐, LD-02 ◐, LD-03 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  2. **D2** [LD-02 ◐] Petrol, diesel and LPG default to the Volume setting's unit with a per-entry picker; CNG is kg; electric is kWh and the full flag is labelled 'Full charge'; the default fuel is the vehicle's first fuel type, then the one last used; `missedPrevious` defaults to off.
  3. **D3** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
- **Test requirements:** Jest, test-first, including bi-fuel and missed fills (TS-03).
- **Dependencies:** FND-DAT-01, FND-DAT-02.
- **PRD requirement IDs:** PR-10, NFR-08, FR-DATA-12, TS-03, OQ-11, OQ-30, OQ-42; G7.
- **SRS reference:** Fuel entries L328–335; Mileage L337–340; Fuel details L175, L724–737; OQ-30 L665; OQ-42 L667.

### LOG-03 — Domain: entry rules (service total, trip figures, odometer check, category lists)
- **Epic:** L1 · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want the other entry calculations and fixed lists as pure code, so that every form and the History list use one definition.
- **Business value:** One source for totals, trip figures and category names prevents mismatched numbers between forms, History and later reports.
- **Scope:** *In:* service total (sum of line costs plus labour minus discount, never below zero); trip distance (end odometer minus start odometer) and calculated reimbursement from the optional rate; the odometer sanity check (warn when a reading is lower than an earlier entry's or higher than a later one's); the fixed category lists (expenses, services, income, each plus "Other" with free text) with English names through i18n. *Out:* forms, History.
- **Preconditions:** FND-DAT-01, FND-DAT-02, FND-SET-01.
- **Functional behavior:**
  1. `serviceTotal(lines, labour?, discount?)` returns integer minor units, floored at zero.
  2. `tripFigures(start, end, rate?)` returns distance and, when a rate is set, reimbursement in minor units.
  3. `odometerCheck(entries, candidate)` returns a warning, never a block.
  4. The category lists are exported with stable stored values and display names.
- **Business rules:** The discount is a fixed amount, not a percentage (approved). Trips have no `amount` and never create income entries. Warn, don't block (§23.2 *Odometer sanity checks*).
- **Edge cases:** Discount larger than the sum. No lines. Rate with a trip of zero distance. Candidate between two readings. *Decisions applied:* rounding of reimbursement (LD-03), which entries the check compares (LD-05), how "Other" and category names are stored (LD-06, with Foundation DR-03).
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** Defines the stored category values.
- **Acceptance criteria:**
  1. `serviceTotal` matches lines + labour − discount and never goes below zero [Appendix E, OQ-41].
  2. `tripFigures` returns distance, and reimbursement only when a rate is set [OQ-42].
  3. `odometerCheck` warns for a lower-than-earlier and a higher-than-later reading and never blocks [§23.2].
  4. The three category lists match the SRS lists exactly, each with "Other" [SRS L342–346].
- **Decisions applied:** DR-03 ✔, LD-03 ◐, LD-05 ◐, LD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-03 ✔] Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one.
  2. **D2** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  3. **D3** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
  4. **D4** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
- **Test requirements:** Jest unit tests (TS-03 style).
- **Dependencies:** FND-DAT-01, FND-DAT-02, FND-SET-01.
- **PRD requirement IDs:** PR-10, NFR-08, FR-DATA-12, OQ-31, OQ-41, OQ-42, OQ-43, OQ-44; TS-03.
- **SRS reference:** Categories L342–346; Trips L348–353; Odometer checks L355; Service L177, L739–747; OQ-43 L668.

### LOG-04 — Entry form shell and Add sheet wiring
- **Epic:** L1 · **Type:** Architecture / user-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want the Add button to open real entry forms, so that I can start logging against my selected vehicle.
- **Business value:** Replaces the Foundation placeholders; makes the app usable (PRD: a usable personal app exists after tab 2).
- **Scope:** *In:* the Add sheet opening Fuel, Expense, Service, Income and Trip forms (Inspection stays a placeholder); a shared form shell: date and time, odometer with the non-blocking sanity warning, notes, currency fixed to the vehicle's, save through `entryRepo`; the Android bottom-sheet and web dialog presentation; first-save effects (units and currency lock, the 5th-entry link prompt). *Out:* the per-type fields (LOG-05 to LOG-10), attachments (tab 5).
- **Preconditions:** LOG-03, FND-DAT-07, FND-SHL-02, FND-SHL-04, FND-SET-02, FND-OBS-02.
- **Functional behavior:**
  1. Tapping Add on Dashboard or History opens the sheet; choosing a type opens its form in the selected vehicle's scope.
  2. Save writes the entry with `createdBy` set to the signer and updates `lastOdometer` in the same batch, keeping the maximum.
  3. A sanity-check warning appears when the odometer is out of order and the user can still save.
  4. After the first entry exists, odometer unit and currency are locked on the vehicle.
  5. When the user's entry count across vehicles reaches 5, the link prompt appears.
- **Business rules:** `amount.currency` equals the vehicle's currency; odometer is in the vehicle's unit; archived vehicles are read-only until unarchived (OQ-39). Members create with `createdBy` = self (rules).
- **Edge cases:** Archived vehicle selected (Decision applied: Foundation DR-13). No vehicle selected (Foundation DR-17). Double save. Decision applied: LD-04: default date and time, time precision, whether a future date is allowed. LD-05: the comparison basis for the warning and how it is shown.
- **Android/web differences:** Android works offline with the sync icon; web disables Save offline with the banner; web at 768 px and wider shows a dialog.
- **Offline behavior:** The entry and the `lastOdometer` update queue together; the new row shows the sync icon.
- **Security implications:** Rules reject forged `createdBy`; the client sets it from the session.
- **Data/schema impact:** Creates `entries` documents; updates `lastOdometer`, `lastOdometerAt`, `updatedAt` on the vehicle.
- **Acceptance criteria:**
  1. The Add sheet's Fuel, Expense, Service, Income and Trip items open forms; Inspection still opens a placeholder [FR-NAV-04, AC-D15 superseded for five items].
  2. Saving writes the entry and the `lastOdometer` update in one batch with `createdBy` = signer [FR-DATA-11].
  3. An out-of-order odometer shows a warning and still saves [§23.2].
  4. After one entry exists the vehicle's odometer unit and currency are locked [FR-VEH-04].
  5. The 5th entry across all vehicles triggers the link prompt for an anonymous user [FR-LINK-01].
  6. On Android in airplane mode the entry saves and shows the sync icon; on web offline Save is disabled [FR-OFF-03, FR-ERR-07].
- **Decisions applied:** DR-13 ◐, DR-17 ◐, LD-04 ◐, LD-05 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
  3. **D3** [LD-04 ◐] A new entry defaults to the current local date and time to the minute, and a future date is accepted with a 'future date' note.
  4. **D4** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
- **Test requirements:** RNTL for the shell; emulator repository test for the batch; Maestro airplane-mode flow (LOG-15).
- **Dependencies:** LOG-03; FND-DAT-07, FND-SHL-02, FND-SHL-04, FND-SET-02, FND-OBS-02, FND-AUTH-04.
- **PRD requirement IDs:** PR-10, PR-03, FR-NAV-04, FR-DATA-11, FR-LINK-01, FR-VEH-04, FR-OFF-03, FR-ERR-07, OQ-17, OQ-31, OQ-32, OQ-39; AC-D7, AC-D15.
- **SRS reference:** Navigation L258; Entry rules L189; Odometer checks L355; OQ-17 L641; OQ-31 L652; OQ-32 L653.

---

# L2 — Entry types

### LOG-05 — Log a fuel fill-up
- **Epic:** L2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver, I want to record a fill-up by entering any two of price per unit, quantity and total, so that I log it quickly and the app works out the rest.
- **Business value:** Fuel is the most frequent log; it feeds mileage, the main thing drivers look for (PR-10).
- **Scope:** *In:* the Fuel form for petrol, diesel, CNG and LPG fill-ups: fuel type chosen from the vehicle's fuel types, quantity and unit, price per unit, total, odometer (required), "Full tank" (on by default), "Missed previous fill-up" toggle, optional station name (free text, no GPS); saving the details shape; showing mileage where LD-01 decides. *Out:* electric charging (LOG-06), location features (excluded).
- **Preconditions:** LOG-02, LOG-04.
- **Functional behavior:**
  1. The user enters any two of the three amounts and the third is calculated.
  2. Odometer is required; Full tank starts on; Missed previous is a toggle; Station name is optional.
  3. Save stores `fuelType`, `quantity`, `quantityUnit`, `pricePerUnitMilli`, `fullTank`, `missedPrevious`, optional `stationName`, and `amount` equal to the total.
  4. For a vehicle with several fuel types the user picks the fuel per fill.
- **Business rules:** OQ-30 shape; the total is the entry `amount` in integer minor units; no category on fuel entries (OQ-12); no GPS and no location permission (P1).
- **Edge cases:** Editing a calculated field. Bi-fuel vehicle. `hours` vehicle (distance-based mileage hidden). *Decisions applied:* LD-01 mileage display and partial or missed fills; LD-02 quantity units per fuel type and form defaults; LD-03 zero, limits, rounding, which two inputs count as entered; LD-04 date.
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** Station name is user text; it is never sent to Crashlytics.
- **Data/schema impact:** `entries` of type `fuel` with fuel details.
- **Acceptance criteria:**
  1. Entering any two of the three fills in the third, and the saved `amount.minor` equals the total [§23.2 *Fuel entry input*, OQ-30].
  2. Saving without an odometer is blocked; Full tank is on by default; Missed previous can be toggled [§23.2].
  3. The station name is optional and no location permission is requested [§23.2, PR-01].
  4. A bi-fuel vehicle lets the user choose the fuel for each fill [§23.2 *Mileage*].
  5. Mileage is shown as decided in LD-01 and is hidden for an `hours` vehicle [OQ-11].
- **Decisions applied:** LD-01 ◐, LD-02 ◐, LD-03 ◐, LD-04 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  2. **D2** [LD-02 ◐] Petrol, diesel and LPG default to the Volume setting's unit with a per-entry picker; CNG is kg; electric is kWh and the full flag is labelled 'Full charge'; the default fuel is the vehicle's first fuel type, then the one last used; `missedPrevious` defaults to off.
  3. **D3** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  4. **D4** [LD-04 ◐] A new entry defaults to the current local date and time to the minute, and a future date is accepted with a 'future date' note.
- **Test requirements:** RNTL form tests; Jest for `fuel.ts` (LOG-02); emulator save test.
- **Dependencies:** LOG-02, LOG-04.
- **PRD requirement IDs:** PR-10, OQ-12, OQ-30, OQ-42, G7; §23.2 *Fuel entry input*, *Mileage*.
- **SRS reference:** Fuel entries L328–335; Fuel details L724–737; OQ-30 L665.

### LOG-06 — Log EV charging
- **Epic:** L2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an EV driver, I want to record a charging session with kWh and cost and whether it was home or public, so that my running cost is tracked like any fuel.
- **Business value:** EV owners are a stated user group for fuel and charging logging (PR-10).
- **Scope:** *In:* the charging variant of the Fuel form: fuel type electric, quantity in kWh, cost, optional price per unit, odometer (required, as for fuel entries), "full" and "missed previous" flags, and `chargingLocation` home or public (optional). *Out:* charging-station features, location.
- **Preconditions:** LOG-05.
- **Functional behavior:** The form for an electric fuel type uses kWh and shows the home or public choice; saving writes a `fuel` entry with `fuelType` electric and `quantityUnit` kWh.
- **Business rules:** EV charging "records kWh and cost, with home or public charging as a field" (§23.2). EV mileage is km/kWh (mi/kWh for mile-based vehicles) and is calculated between consecutive full fills (OQ-42). `chargingLocation` is for electric only (Appendix E).
- **Edge cases:** A vehicle with both a combustion fuel and electric (plug-in). A charge with no price per unit. *Decisions applied:* what "full tank" means for a charge and how it is labelled (LD-02); amount rules (LD-03).
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** None beyond LOG-05.
- **Data/schema impact:** `entries` of type `fuel` with `chargingLocation`.
- **Acceptance criteria:**
  1. For an electric fuel type the form uses kWh and offers home or public [§23.2 *EV charging*].
  2. Saved entries have `fuelType` electric, `quantityUnit` kWh, `amount` = cost, and `chargingLocation` only when electric [Appendix E].
  3. EV mileage uses km/kWh, or mi/kWh for a mile-based vehicle [OQ-42].
  4. Odometer is required as for other fuel entries [§23.2].
- **Decisions applied:** LD-01 ◐, LD-02 ◐, LD-03 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  2. **D2** [LD-02 ◐] Petrol, diesel and LPG default to the Volume setting's unit with a per-entry picker; CNG is kg; electric is kWh and the full flag is labelled 'Full charge'; the default fuel is the vehicle's first fuel type, then the one last used; `missedPrevious` defaults to off.
  3. **D3** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
- **Test requirements:** RNTL; Jest (`fuel.ts` EV fixtures).
- **Dependencies:** LOG-05.
- **PRD requirement IDs:** PR-10, OQ-30, OQ-42; §23.2 *EV charging*.
- **SRS reference:** Fuel entries L328–335; Fuel details L724–737; OQ-42 L667.

### LOG-07 — Log an expense
- **Epic:** L2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to log expenses such as insurance, tolls or parking under a category, so that I see what the vehicle really costs.
- **Business value:** Non-fuel costs are a large part of real running cost (PR-10).
- **Scope:** *In:* the Expense form: category from the fixed list (insurance, road tax, FASTag/toll, parking, fine/challan, PUC certificate, registration/permit, loan EMI, cleaning, accessories) or "Other" with free text; amount; date and time; optional odometer; optional notes. *Out:* payment method and recurring auto-entries (left out of Logging).
- **Preconditions:** LOG-03, LOG-04.
- **Functional behavior:** Pick a category (or Other and type a name), enter an amount, save. The category name is copied onto the entry. An odometer is optional.
- **Business rules:** `amount` required, positive, in the vehicle's currency (OQ-31); category name copied onto each entry so renames do not rewrite history (§13.4); odometer not required for expenses (§23.2).
- **Edge cases:** "Other" with empty text. A very long note (cap is Foundation DR-06). *Decisions applied:* where the "Other" text is stored (LD-06); amount limits (LD-03).
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** Notes are user text, never sent to Crashlytics.
- **Data/schema impact:** `entries` of type `expense` with `category`.
- **Acceptance criteria:**
  1. All ten expense categories and "Other" with free text are offered [SRS L344].
  2. Save requires a category and an amount; odometer and notes are optional [§23.2, OQ-31].
  3. The saved `amount.currency` equals the vehicle's currency [OQ-31].
  4. The category name is stored on the entry [§23.2 *Categories*].
- **Decisions applied:** DR-06 ✔, LD-03 ◐, LD-04 ◐, LD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
  2. **D2** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  3. **D3** [LD-04 ◐] A new entry defaults to the current local date and time to the minute, and a future date is accepted with a 'future date' note.
  4. **D4** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
- **Test requirements:** RNTL form tests; emulator save test.
- **Dependencies:** LOG-03, LOG-04.
- **PRD requirement IDs:** PR-10, OQ-31, OQ-12; §23.2 *Expense categories*, *Categories*, *Left out of Logging*.
- **SRS reference:** Categories L342–346; Left out L365; Entry additions L717–722.

### LOG-08 — Log a service visit with line items
- **Epic:** L2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to record one garage visit with several services and their costs, so that the total matches the bill I paid.
- **Business value:** One entry per visit matches how the bill is paid and keeps one History row per garage visit (§13.3.1).
- **Scope:** *In:* the Service form: one or more lines each with a service type (general service, engine oil, oil filter, air filter, brake pads, tyres, battery, coolant, wheel alignment/balancing, clutch, AC service, or "Other" with free text) and a cost; optional labour; optional discount (a fixed amount); a computed total; one entry category from the same Services list; date, optional odometer, notes. *Out:* receipt photos (tab 5), reminders that read the lines (tab 3).
- **Preconditions:** LOG-03, LOG-04.
- **Functional behavior:**
  1. Add and remove lines; each line has a type and a cost.
  2. The total is the sum of lines plus labour minus discount, never below zero, and is stored as `amount.minor`.
  3. The user picks one entry category from the Services list.
  4. Save writes one `service` entry.
- **Business rules:** One entry per visit; `lines` is `{ id, serviceType, otherLabel?, costMinor }`; discount is a fixed amount, not a percentage; the stored total is `amount.minor` (Appendix E, OQ-41, OQ-43).
- **Edge cases:** Discount larger than the sum. A line with "Other" and no text. *Decisions applied:* minimum and maximum lines, zero-cost lines (LD-08); storage of "Other" text (LD-06); rounding and amount limits (LD-03).
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** None beyond text handling.
- **Data/schema impact:** `entries` of type `service` with service details.
- **Acceptance criteria:**
  1. The form offers the eleven service types and "Other" with free text for each line [OQ-43].
  2. The displayed and stored total equals lines + labour − discount, floored at zero [Appendix E].
  3. A service visit is saved as a single entry with one category from the Services list [OQ-41, OQ-43].
  4. Labour and discount are optional integers in minor units [Appendix E].
- **Decisions applied:** LD-03 ◐, LD-06 ◐, LD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  2. **D2** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
  3. **D3** [LD-08 ◐] A service with 0 or 21 lines is rejected and 1 or 20 accepted; a zero-cost line is accepted; the entry category can be any Services-list value regardless of the lines.
- **Test requirements:** RNTL; Jest (`serviceTotal`); emulator save test.
- **Dependencies:** LOG-03, LOG-04.
- **PRD requirement IDs:** PR-10, OQ-31, OQ-41, OQ-43, §13.3.1; §23.2 *Service entries*, *Service categories*.
- **SRS reference:** Service entries L177; Schemas L739–747; OQ-41 L666; OQ-43 L668.

### LOG-09 — Log income
- **Epic:** L2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a gig or rideshare driver, I want to log what I earned with this vehicle, so that I can see real profit later.
- **Business value:** "Real profit figures" for gig drivers is a stated product goal (G8).
- **Scope:** *In:* the Income form: category (ride-hailing, delivery, rental, reimbursement, or "Other" with free text); amount; optional platform name with suggestions (Uber, Ola, Rapido, Swiggy, Zomato and so on) that remain free text; date and time; optional odometer; notes. *Out:* profit figures (tab 4).
- **Preconditions:** LOG-03, LOG-04.
- **Functional behavior:** Pick a category, enter an amount, optionally type or pick a platform, save.
- **Business rules:** Amount is stored positive and the entry type makes it income (OQ-31). An income entry categorised "reimbursement" is ordinary income and counts toward profit; trip reimbursements are separate (OQ-44).
- **Edge cases:** A platform not in the suggestion list. *Decisions applied:* Appendix E defines no `details` shape for income, so the platform field's location is LD-07; "Other" storage LD-06.
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** Platform text is user text.
- **Data/schema impact:** `entries` of type `income`; shape decision LD-07.
- **Acceptance criteria:**
  1. The four income categories and "Other" with free text are offered [SRS L346].
  2. The platform name is optional, suggestions are offered, and any text is accepted [§23.2 *Income categories*].
  3. A "reimbursement" income entry saves as ordinary income [OQ-44].
  4. The amount is positive and in the vehicle's currency [OQ-31].
- **Decisions applied:** LD-03 ◐, LD-06 ◐, LD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  2. **D2** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
  3. **D3** [LD-07 ◐] An income entry with a platform stores `details.platform` (up to 60 characters) and an expense has no `details`.
- **Test requirements:** RNTL; emulator save test.
- **Dependencies:** LOG-03, LOG-04.
- **PRD requirement IDs:** PR-10, G8, OQ-31, OQ-44; §23.2 *Income categories*.
- **SRS reference:** Categories L342–346; OQ-44 L669.

### LOG-10 — Log a manual trip
- **Epic:** L2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver who is reimbursed or tracks business use, I want to log a trip with start and end details, so that I can see the distance and the reimbursement I am owed.
- **Business value:** Supports business versus personal tracking and reimbursement claims (PR-10).
- **Scope:** *In:* the Trip form: start and end date and time; start and end odometer in the vehicle's unit; calculated distance; from and to as text; purpose business or personal; optional reimbursement rate per odometer unit with a calculated reimbursement; notes. *Out:* GPS tracking (not in v1), reimbursement reports (tab 4).
- **Preconditions:** LOG-03, LOG-04.
- **Functional behavior:**
  1. The user enters start and end times and odometers; distance is calculated.
  2. With a rate, the reimbursement is calculated and stored in `details`.
  3. Save writes a `trip` entry whose `date` is the start date, with no `amount` and no `category`.
- **Business rules:** A trip has no `amount`; it never creates an income entry; the rate is per the vehicle's odometer unit; trip-calculated reimbursement is excluded from cost and from net profit (OQ-42, OQ-44).
- **Edge cases:** End before start. End odometer below start odometer. A trip on an `hours` vehicle. *Decisions applied:* validation rules and `hours` vehicles (LD-09); whether the entry's `odometer` and `lastOdometer` use the trip's odometers (LD-05); reimbursement rounding (LD-03).
- **Android/web differences:** As LOG-04.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** From and to are free text and are personal data; they are never sent to Crashlytics.
- **Data/schema impact:** `entries` of type `trip` with trip details.
- **Acceptance criteria:**
  1. Distance equals end minus start odometer and updates as the user edits [§23.2 *Trips*].
  2. With a rate, a reimbursement is calculated; without one, none is stored [OQ-42].
  3. The saved entry has no `amount` and no `category`, and `date` equals the start date [Appendix E].
  4. Saving a trip creates no income entry [§23.2].
- **Decisions applied:** LD-03 ◐, LD-05 ◐, LD-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-03 ◐] A zero amount is rejected (except a service total that floors at zero); amounts up to 12 digits and quantity to 3 decimals are accepted; price 1.459 per litre for 12.5 litres derives a total of 18.24 (1824 minor units, rounded half-up); entering total and quantity derives the price rounded half-up to the milli-unit; the two most recently edited fields count as entered.
  2. **D2** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
  3. **D3** [LD-09 ◐] A trip missing start or end time, start or end odometer, or purpose is rejected; an end before the start, or an end odometer below the start, is rejected; a trip on an `hours` vehicle shows hours and a per-hour rate.
- **Test requirements:** RNTL; Jest (`tripFigures`); emulator save test.
- **Dependencies:** LOG-03, LOG-04.
- **PRD requirement IDs:** PR-10, OQ-42, OQ-44; §23.2 *Trips*.
- **SRS reference:** Trips L348–353; Schemas L749–751; OQ-42 L667; OQ-44 L669.

---

# L3 — History

### LOG-11 — History list
- **Epic:** L3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below); acceptance waits on LOG-01.
- **User story:** As a user, I want one list of everything I logged for my vehicle, newest first, so that I can review it at a glance.
- **Business value:** History is how a user trusts their data; it is the main browse surface of the usable personal app.
- **Scope:** *In:* the History tab body for the selected vehicle: one list across all entry types, newest first; a row per entry with type, date, category and amount; one row per service visit; "Logged by …" for entries by other members; the sync icon on pending items; the warning state for rejected queued writes; skipped malformed entries with "1 entry couldn't be shown"; empty state; a refresh control. *Out:* filters and search (LOG-12), edit (LOG-13), delete (LOG-14), attachments.
- **Preconditions:** LOG-01 (gate), LOG-03, FND-DAT-07, FND-SHL-04, FND-OBS-03, FND-OBS-04.
- **Functional behavior:**
  1. History shows the selected vehicle's entries newest first across all types.
  2. A service visit is one row.
  3. Rows from another member show their `createdByName`.
  4. Pending items show the sync icon; rejected queued writes show the warning.
  5. A malformed entry is skipped and "1 entry couldn't be shown" appears, with a non-fatal logged.
  6. Pull-to-refresh pulls the latest data from the cloud.
- **Business rules:** Reads are cache-first with a refresh control (NFR-20). Entries by shared members show `createdByName` (§23.2 business rules). "All vehicles" does not affect History (OQ-49).
- **Edge cases:** Thousands of entries. Archived vehicle (read-only). Entries without odometer. Decision applied: LD-10: how many entries load at once and what a row shows per type; Foundation DR-17 for the empty state.
- **Android/web differences:** Web at 768 px and wider uses the rail layout.
- **Offline behavior:** Lists from the cache; works fully offline on Android.
- **Security implications:** Members see only entries of vehicles they belong to (rules).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Entries of all types appear in one list, newest first [§23.2 *History*].
  2. A service visit with three lines shows as one row [§13.3.1].
  3. A malformed entry is skipped, "1 entry couldn't be shown" appears and a non-fatal with the document path is logged [AC-D12].
  4. An item with a pending write shows the sync icon [FR-OFF-03].
  5. Refresh pulls fresh data [FR-OFF-12].
- **Decisions applied:** DR-17 ◐, LD-01 ◐, LD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
  2. **D2** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  3. **D3** [LD-10 ◐] History loads all of a vehicle's entries once, groups them under month headers, and each row shows the type icon, date, category or fuel summary, amount, 'Logged by' for others' entries, the odometer if present, and the sync icon.
- **Test requirements:** RNTL with seeded entries; emulator test for the malformed case; large-list check against LOG-01's budget.
- **Dependencies:** LOG-01, LOG-03; FND-DAT-07, FND-SHL-04, FND-OBS-03, FND-OBS-04.
- **PRD requirement IDs:** PR-10, PR-03, NFR-20, FR-OFF-03, FR-OFF-12, FR-ERR-03, OQ-49; AC-D12, AC-D24; §23.2 *History*.
- **SRS reference:** History L357–363; Navigation L257; OQ-45 L670.

### LOG-12 — History filters and search
- **Epic:** L3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user with many entries, I want to filter by type and date range and search my notes, so that I can find a specific entry fast.
- **Business value:** Large histories are unusable without finding tools.
- **Scope:** *In:* filter by entry type; filter by date range; search across notes, categories and service line-item types; all on the device over the loaded entries; clearing filters. *Out:* server-side search (not available in Firestore), search of inspection item notes (excluded).
- **Preconditions:** LOG-11.
- **Functional behavior:** Applying a filter or search narrows the visible list at once without extra reads.
- **Business rules:** Search and filters run on the device over loaded entries (notes, categories, line-item types) (OQ-45).
- **Edge cases:** No results. Search over entries not yet loaded (depends on LD-10). Filters combined with search. Decision applied: LD-11: filter controls, defaults, persistence, matching rules.
- **Android/web differences:** None.
- **Offline behavior:** Works fully offline.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Filtering by one type shows only that type [§23.2 *History*].
  2. A date range shows only entries inside it [§23.2].
  3. Searching text finds matches in notes, category names and service line-item types [OQ-45].
  4. Filters and search cause no additional Firestore reads [OQ-45, LOG-01].
- **Decisions applied:** LD-10 ◐, LD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-10 ◐] History loads all of a vehicle's entries once, groups them under month headers, and each row shows the type icon, date, category or fuel summary, amount, 'Logged by' for others' entries, the odometer if present, and the sync icon.
  2. **D2** [LD-11 ◐] The type filter accepts several types at once; the date range narrows by inclusive start and end dates; filters reset on relaunch; search matches notes, category, line-item types, station, platform, from and to, case-insensitively, and does not match amounts.
- **Test requirements:** RNTL with seeded entries; read-count check in the emulator.
- **Dependencies:** LOG-11.
- **PRD requirement IDs:** PR-10, OQ-18, OQ-45; §23.2 *History*.
- **SRS reference:** History L357–363; OQ-45 L670.

### LOG-13 — Edit an entry
- **Epic:** L3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to tap an entry and correct it, so that a typo does not stay in my records.
- **Business value:** "Typos happen" is the stated reason the odometer check only warns (§23.2).
- **Scope:** *In:* tap a History row to open its form pre-filled; save changes; read-only view for entries the user may not edit; `lastOdometer` recompute. *Out:* changing an entry's type, attachments (tab 5).
- **Preconditions:** LOG-05 to LOG-11, FND-DAT-07.
- **Functional behavior:**
  1. Tapping a row opens the form for that type with its values.
  2. Save updates the entry with `updatedBy` = signer and a new `updatedAt`; `createdBy` is unchanged.
  3. The vehicle's `lastOdometer` is recomputed from its entries.
  4. Other members' entries open read-only.
- **Business rules:** Creator or owner updates; `createdBy` immutable (rules); other members' entries are read-only (OQ-45); `lastOdometer` is the maximum across entries and is recomputed by the client on edit (OQ-17); units and currency stay locked.
- **Edge cases:** Editing the entry that holds the maximum odometer. Editing while offline. Edit of a rejected queued write. Decision applied: LD-13: the owner's ability to edit other members' entries (OQ-45 says read-only; the roles table says the owner updates any entry); whether type and date can change; Foundation DR-13 for archived vehicles.
- **Android/web differences:** Web at 768 px and wider uses dialogs.
- **Offline behavior:** Saves locally on Android with the sync icon.
- **Security implications:** Rules enforce creator-or-owner and `createdBy` immutability; the UI mirrors but does not replace them.
- **Data/schema impact:** Updates `entries`; may update three vehicle fields.
- **Acceptance criteria:**
  1. Tapping a row opens a pre-filled form of the right type [§23.2 *History*].
  2. Saving sets `updatedBy` to the signer and keeps `createdBy` [FR-SEC-05, FR-SEC-10].
  3. Lowering or raising the maximum odometer recomputes `lastOdometer` [OQ-17].
  4. An entry logged by another member opens read-only [OQ-45].
  5. The edit works offline on Android and shows the sync icon [FR-OFF-03].
- **Decisions applied:** DR-13 ◐, LD-04 ◐, LD-05 ◐, LD-13 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [LD-04 ◐] A new entry defaults to the current local date and time to the minute, and a future date is accepted with a 'future date' note.
  3. **D3** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
  4. **D4** [LD-13 ◐] An owner can edit and delete another member's entry, a member sees another member's entry read-only, and an entry's type cannot change on edit while its date can.
- **Test requirements:** RNTL; emulator tests for update and recompute; rules already cover denial (FND-SEC-02).
- **Dependencies:** LOG-05, LOG-06, LOG-07, LOG-08, LOG-09, LOG-10, LOG-11.
- **PRD requirement IDs:** PR-10, FR-DATA-11, FR-SEC-05, FR-SEC-10, FR-OFF-03, OQ-17, OQ-45; §23.2 *History*, *Entry rules*.
- **SRS reference:** History L357–363; Entry rules L189; OQ-17 L641; OQ-45 L670.

### LOG-14 — Delete an entry with Undo
- **Epic:** L3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to delete an entry and be able to undo it for a moment, so that an accidental tap does not destroy data.
- **Business value:** Protects users from accidental deletion without storing soft-deleted data.
- **Scope:** *In:* Delete on an entry; the entry disappears from History at once; an Undo option for 5 seconds; after the window the real delete happens; `lastOdometer` recompute. *Out:* Drive file deletion (tab 5; the delayed delete is where it will attach).
- **Preconditions:** LOG-11, FND-DAT-07.
- **Functional behavior:**
  1. Delete hides the row immediately and shows Undo.
  2. Undo within 5 seconds restores the row with nothing written.
  3. After 5 seconds the delete is committed and `lastOdometer` is recomputed.
- **Business rules:** Delayed delete, no soft delete stored (OQ-45); creator or owner deletes (rules); `lastOdometer` recomputed on delete (OQ-17).
- **Edge cases:** App killed or backgrounded during the window. Two deletes in quick succession. Delete while offline. Decision applied: LD-12 and LD-13.
- **Android/web differences:** Web needs the network at commit time; Android commits locally and syncs.
- **Offline behavior:** On Android the committed delete is applied locally and syncs later.
- **Security implications:** Rules enforce who may delete.
- **Data/schema impact:** Deletes an `entries` document; updates `lastOdometer`.
- **Acceptance criteria:**
  1. Deleting an entry removes it from History at once and shows Undo [§23.2 *History*].
  2. Tapping Undo within 5 seconds restores it and no write occurred [OQ-45].
  3. After 5 seconds the entry is deleted and no soft-deleted copy exists [OQ-45].
  4. After deleting the entry that held the maximum odometer, `lastOdometer` is recomputed [OQ-17].
- **Decisions applied:** LD-12 ◐, LD-13 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-12 ◐] Backgrounding the app during the 5-second window commits the delete; two quick deletes each get their own window with Undo for the latest; `lastOdometer` is recomputed when the delete commits; Delete is available on the edit screen and as a row swipe.
  2. **D2** [LD-13 ◐] An owner can edit and delete another member's entry, a member sees another member's entry read-only, and an entry's type cannot change on edit while its date can.
- **Test requirements:** RNTL with fake timers; emulator test for the commit.
- **Dependencies:** LOG-11; FND-DAT-07.
- **PRD requirement IDs:** PR-10, OQ-17, OQ-45; §23.2 *History*.
- **SRS reference:** History L357–363; OQ-45 L670.

---

# L4 — Verification

### LOG-15 — Airplane-mode logging flow and Foundation seams going live
- **Epic:** L4 · **Type:** Verification · **Size:** M · **Readiness:** Ready once LOG-04 to LOG-14 are built
- **User story:** As the maintainer, I want the logging flows proven end to end, including offline, so that the usable personal app is trustworthy before the next sub-project.
- **Business value:** "Log anywhere" is a product principle (P3); Maestro covers airplane-mode logging before each release (TS-06).
- **Scope:** *In:* a Maestro flow that logs each entry type in airplane mode, reconnects and checks sync; first checks, now possible with real entries, of Foundation behaviors that were proven with fixtures: the 5th-entry prompt, locked units after the first entry, the "1 entry couldn't be shown" message, the sync icon and Sync issues notice on entries, and `lastOdometer` after add, edit and delete; updated manual checklist items. *Out:* the Play closed test (tab 8).
- **Preconditions:** LOG-04 to LOG-14.
- **Functional behavior:** The flows and checklist are runnable by someone other than the author.
- **Business rules:** TS-06; link Google stays manual (OQ-37).
- **Edge cases:** A queued entry rejected by the server (Sync issues). Entries on two vehicles for the 5th-entry count.
- **Android/web differences:** Maestro is Android only; web is a manual smoke test.
- **Offline behavior:** This story is the native offline proof for entries.
- **Security implications:** Test data only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Maestro logs fuel, EV charging, expense, service, income and trip in airplane mode and, after reconnecting, the entries are on the server [TS-06, PR-03].
  2. The 5th entry across two vehicles shows the link prompt once [FR-LINK-01].
  3. After the first entry the vehicle's odometer unit and currency are locked [AC-D7].
  4. A seeded malformed entry shows "1 entry couldn't be shown" [AC-D12].
  5. A server-rejected queued entry shows the warning and the Sync issues notice [AC-D24].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** LOG-04 to LOG-14.
- **PRD requirement IDs:** TS-06, TS-07, PR-03, PR-10, §21.5; AC-D7, AC-D12, AC-D24, FR-LINK-01.
- **SRS reference:** Testing L309–322; OQ-37 L658.

---

# A. Logging epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **L1 Logging domain and shared form** | The quota check, the pure fuel and entry logic, and the form shell that replaces the Add sheet placeholders | LOG-01 to LOG-04 |
| **L2 Entry types** | Fuel, EV charging, expense, service with line items, income, manual trip | LOG-05 to LOG-10 |
| **L3 History** | The list, filters and search, edit, delete with Undo | LOG-11 to LOG-14 |
| **L4 Verification** | Airplane-mode logging and Foundation behaviors proven with real entries | LOG-15 |

**Architectural versus user-facing.** Architecture or spike: LOG-01, LOG-02, LOG-03 (LOG-04 is the shared shell and the first user-visible change). User-facing: LOG-04 to LOG-14. Verification: LOG-15.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`LD-nn` here, or a Foundation `DR-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | LOG-01 ◆ | Spike: quota budget for Logging (G2) | S | FND-VER-01, FND-DAT-07 |
| W1 | LOG-02 ◆ | Domain: fuel logic | L | FND-DAT-01, FND-DAT-02 |
| W1 | LOG-03 ◆ | Domain: entry rules | M | FND-DAT-01, FND-DAT-02, FND-SET-01 |
| W2 | LOG-04 ◆ | Entry form shell and Add sheet wiring | L | LOG-03; FND-DAT-07, FND-SHL-02, FND-SHL-04, FND-SET-02, FND-OBS-02, FND-AUTH-04 |
| W3 | LOG-05 ◆ | Log a fuel fill-up | L | LOG-02, LOG-04 |
| W3 | LOG-07 ◆ | Log an expense | M | LOG-03, LOG-04 |
| W3 | LOG-08 ◆ | Log a service visit | L | LOG-03, LOG-04 |
| W3 | LOG-09 ◆ | Log income | M | LOG-03, LOG-04 |
| W3 | LOG-10 ◆ | Log a manual trip | L | LOG-03, LOG-04 |
| W3 | LOG-11 ◆ | History list | L | LOG-01 (gate), LOG-03; FND-SHL-04, FND-OBS-03, FND-OBS-04 |
| W4 | LOG-06 ◆ | Log EV charging | M | LOG-05 |
| W4 | LOG-12 ◆ | History filters and search | M | LOG-11 |
| W4 | LOG-14 ◆ | Delete an entry with Undo | M | LOG-11 |
| W5 | LOG-13 ◆ | Edit an entry | L | LOG-05 to LOG-11 |
| W6 | LOG-15 | Airplane-mode flow and Foundation seams live | M | LOG-04 to LOG-14 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | LOG-01 ∥ LOG-02 ∥ LOG-03 | Spike, fuel domain and entry-rules domain touch different files |
| Entry forms | LOG-05 ∥ LOG-07 ∥ LOG-08 ∥ LOG-09 ∥ LOG-10 | Each owns one form on the shared shell |
| Forms versus History | (LOG-05, 07, 08, 09, 10) ∥ LOG-11 | History builds against seeded entries until forms land |
| After History | LOG-12 ∥ LOG-14, and LOG-06 | Filters, delete and the EV variant are independent |

**Not parallel:** LOG-04 must land before any form. LOG-13 needs every form. LOG-15 is last.

**Early starts.** The History row component in LOG-11 can begin in W2 once LOG-03's category lists exist. LOG-15's Maestro skeleton can be drafted as each form lands.

---

# D. Blocking dependencies

**D1. Foundation must be accepted first.** Logging reuses the schema, rules, `entryRepo`, shell, switcher, settings and failure behaviors. Foundation's Definition of Done (its section F) is the entry condition. Specifically needed: `FND-DAT-07`, `FND-SEC-02`, `FND-SHL-02`, `FND-SHL-04`, `FND-SET-02`, `FND-OBS-02`, `FND-OBS-03`, `FND-OBS-04`, `FND-AUTH-04`, `FND-VEH-02`.

**D2. Gate G2.** PRD §24.6 says G2 gates tabs 2 and 4. LOG-01 must pass before LOG-11 is accepted. It cannot pass until Foundation's DR-20 (the threshold) is answered, and LOG-01 itself depends on LD-10.

**D3. Decisions that block the domain code.** LD-01, LD-02 and LD-03 block LOG-02's mileage and rounding. Because the fuel shape is frozen in Foundation (G7), LD-02 and LD-03 should be settled before LOG-05 and LOG-06 are accepted.

**D4. Decisions that block the data shape.** LD-06 (how "Other" and category names are stored) and LD-07 (where the income platform is stored) affect entry documents. Appendix E gives no `details` shape for income or expense. The model is meant to need no migrations, so these two should be settled before LOG-07 and LOG-09 write real data.

**D5. Foundation decisions that carry over.** DR-01 (starting odometer) affects `lastOdometer` recompute in LOG-13 and LOG-14. DR-03 (stored encodings) affects category and service-type values. DR-06 (text caps) affects notes, station, from and to. DR-07 and DR-08 affect how amounts and odometers are displayed. DR-13 (archived vehicles) affects whether Add and Edit are available. DR-15 affects selection after deleting the selected vehicle.

**D6. External.** None beyond Foundation's. No new service, scope or permission is introduced (no location, no media).

**D7. Later tabs.** Attachments on service and other entries arrive in tab 5; reminders that read service lines arrive in tab 3; reports that use cost per km and reimbursement arrive in tab 4. Nothing in Logging should block them: the stored shapes already follow Appendix E.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema** = needed before entry documents are written · **Story** = before the named story is accepted · **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **LD-01** | **Mileage definition and display.** The formula (distance and fuel used between two consecutive full fills of the same fuel); how partial fills in between and `missedPrevious` are treated; rounding; where mileage appears in tab 2 (entry form after save, History row, entry detail); how a bi-fuel vehicle is presented here, since the headline figure there is cost per km, which the SRS places in Reports. | §23.2 says "fuel and EV charging with mileage" and states only that mileage is "only between two consecutive full fills of that same fuel". TS-03 requires bi-fuel and missed-fill tests with no formula given. Dashboard "last mileage" is tab 4 (OQ-48). | LOG-02 (tests), LOG-05, LOG-06, LOG-11 | Story |
| **LD-02** | **Fuel form units and defaults.** Which `quantityUnit` each fuel type allows (the SRS fixes CNG as km/kg and EV as km/kWh only); LPG efficiency unit; whether the user's Volume setting or a per-entry choice sets litres or gallons for petrol and diesel; the default fuel type for a multi-fuel vehicle; the default of "Missed previous fill-up"; what "Full tank" means and is called for an EV charge. | OQ-42 and Appendix E list units and flags but not these rules. | LOG-02, LOG-05, LOG-06 | Story |
| **LD-03** | **Amount and input rules.** Whether zero is allowed; limits and decimals per currency; rounding when the app derives total or price per unit (to milli-units) and when it computes trip reimbursement; which two fields count as "entered" after a user edits a calculated one. | OQ-31 says amounts are positive integers in minor units; OQ-30 says "any two of three" round-trips. Neither fixes rounding or limits. | LOG-02, LOG-03, LOG-05 to LOG-10 | Schema |
| **LD-04** | **Entry date.** Default date and time for a new entry, time precision, and whether a future date is allowed. | OQ-32 says `date` is a timestamp of the chosen local date and time. The rules check only `createdAt` and `updatedAt` against the future (FR-SEC-10). | LOG-04, LOG-07, LOG-13 | Story |
| **LD-05** | **Odometer sanity check.** Which entries are compared (all types with an odometer, or by type), the ordering used (entry date or creation time), whether trips' start and end odometers count, and how the warning is shown. Also whether a trip's odometers set the entry's `odometer` and update `lastOdometer`. | §23.2 states "warn, don't block when lower than an earlier entry's or higher than a later one's" only. OQ-17 defines `lastOdometer` over "entries" and OQ-48 counts trip odometers as readings for reports. | LOG-03, LOG-04, LOG-10, LOG-13 | Story |
| **LD-06** | **"Other" free text and category storage.** Where the typed text for "Other" is stored on expense and income entries and on a service entry's category (the schema has `category` and, for service lines only, `otherLabel`); whether stored values are display names or fixed ids (also Foundation DR-03(b)). | §13.4 says "the category name is copied onto each entry". Appendix E defines `otherLabel` for service lines only. | LOG-03, LOG-07, LOG-08, LOG-09 | Schema |
| **LD-07** | **Income and expense `details`.** Where the optional income platform name lives. Appendix E has no `details` shape for income or expense, yet the CSV columns list "Income: platform". | Appendix E fixes details for fuel, service, trip and inspection only. | LOG-09 | Schema |
| **LD-08** | **Service constraints.** Minimum and maximum number of lines; whether a zero-cost line is allowed; whether the entry category must relate to the lines. | OQ-41 and OQ-43 fix the shapes and the category choice, not these constraints. | LOG-08 | Story |
| **LD-09** | **Trip validation.** Which fields are required; whether end must not precede start (time and odometer); trips on `hours` vehicles; time zone for start and end. | §23.2 lists the fields only. OQ-11 hides distance metrics for `hours`. | LOG-10 | Story |
| **LD-10** | **History loading and rows.** How many entries load at once (all, or paged); what each row shows per type; grouping by date. | OQ-45 says search and filters run "over loaded entries" without saying how many are loaded. G2 asks for a History cold-open count. | LOG-01, LOG-11, LOG-12 | Story |
| **LD-11** | **Filters and search controls.** Single or multiple types; how a date range is entered and its default; whether filters persist; case and accent matching; whether search covers amounts. | §23.2 and OQ-45 name the filters and the searched fields only. | LOG-12 | Story |
| **LD-12** | **Delete and Undo edges.** What happens if the app is killed or backgrounded during the 5-second window; how several quick deletes behave; where the Delete action lives (row, edit screen); when `lastOdometer` is recomputed relative to the window. | OQ-45 fixes a 5-second delayed delete and no soft delete, not these cases. | LOG-14 | Story |
| **LD-13** | **Edit and delete authority.** OQ-45 says other members' entries are read-only; the roles table (PRD §15.5) says the owner updates or deletes any entry. Which applies in the UI for an owner? Can an entry's type or date change on edit? | These two statements point in different directions. Other members cannot exist until tab 6, but the UI is built now. | LOG-13, LOG-14 | Story |

**Foundation decisions that carry into Logging** (defined in `docs/foundation-backlog.md`): DR-01 starting odometer · DR-03 stored encodings · DR-06 text-length caps · DR-07 currency and number formatting · DR-08 display surfaces and odometer display unit · DR-13 archived-vehicle actions · DR-15 selected vehicle · DR-16 copy gaps · DR-17 shell content · DR-20 quota threshold.

**Can start before any decision is answered:** LOG-04's shell structure, LOG-02's two-of-three solver, LOG-03's service total and category lists (subject to LD-06 for stored values), LOG-11's list structure, and LOG-14's timing logic.

---

# F. Logging Definition of Done

The PRD defines no acceptance criteria for sub-project 2, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.2)**
- [ ] A user can log fuel, EV charging, an expense, a service visit with line items, income and a manual trip against a selected vehicle.
- [ ] A user can browse one History list across all types, newest first; filter by type and date range; search notes, categories and line-item types; tap to edit; delete with Undo.
- [ ] Mileage is calculated per fuel type between consecutive full fills, with bi-fuel and EV handled as decided in LD-01 and LD-02.

**Behavior**
- [ ] Everything above works offline on Android with the sync icon, and saving is disabled offline on web (PR-03, FR-ERR-07).
- [ ] Odometer sanity checks warn and never block (§23.2).
- [ ] `lastOdometer` is the maximum across entries, written in the same batch as the entry and recomputed on edit and delete (FR-DATA-11, OQ-17).
- [ ] Other members' entries are read-only in the UI as decided in LD-13.

**Evidence**
- [ ] Domain tests written first pass, including bi-fuel and missed fills (TS-03) and the G7 fuel fixtures.
- [ ] The Foundation rules suite still passes with entries in use, including the batch behavior.
- [ ] LOG-01 passed: the quota budget holds with History's loading approach (G2).
- [ ] Maestro airplane-mode logging passes (TS-06) and the manual checklist items for web are run.

**Scope and quality**
- [ ] The Add sheet's Fuel, Expense, Service, Income and Trip items are real forms; Inspection is still a placeholder.
- [ ] No out-of-scope feature exists: no receipts or attachments UI, reminders, reports, Drive, CSV, sharing, checklists, payment method, GPS or recurring auto-entries.
- [ ] No location or media permission has been added (AC-D19, AC-D20).
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `LD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 2; the last column cites the story's own criteria (`#n`) plus the Foundation `AC-D`, test requirement or gate that applies.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| LOG-01 | NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12; G2 | OQ-18 L642; OQ-45 L670; History L357–363 | #1–#3; G2 |
| LOG-02 | PR-10, NFR-08, FR-DATA-12, OQ-11, OQ-30, OQ-42; TS-03; G7 | Fuel entries L328–335; Mileage L337–340; L175; L724–737; OQ-30 L665; OQ-42 L667 | #1–#5; TS-03; G7 |
| LOG-03 | PR-10, NFR-08, FR-DATA-12, OQ-31, OQ-41, OQ-42, OQ-43, OQ-44; TS-03 | Categories L342–346; Trips L348–353; Odometer checks L355; Service L177, L739–747; OQ-43 L668 | #1–#4 |
| LOG-04 | PR-10, PR-03, FR-NAV-04, FR-DATA-11, FR-LINK-01, FR-VEH-04, FR-OFF-03, FR-ERR-07, OQ-17, OQ-31, OQ-32, OQ-39 | Navigation L258; Entry rules L189; Odometer checks L355; OQ-17 L641; OQ-31 L652; OQ-32 L653 | #1–#6; AC-D7, AC-D15 |
| LOG-05 | PR-10, OQ-12, OQ-30, OQ-42; G7; §23.2 Fuel entry input, Mileage | Fuel entries L328–335; L724–737; OQ-30 L665 | #1–#5 |
| LOG-06 | PR-10, OQ-30, OQ-42; §23.2 EV charging | Fuel entries L328–335; L724–737; OQ-42 L667 | #1–#4 |
| LOG-07 | PR-10, OQ-12, OQ-31; §23.2 Expense categories, Categories | Categories L342–346; Left out L365; L717–722 | #1–#4 |
| LOG-08 | PR-10, OQ-31, OQ-41, OQ-43, §13.3.1; §23.2 Service entries | Service L177; L739–747; OQ-41 L666; OQ-43 L668 | #1–#4 |
| LOG-09 | PR-10, G8, OQ-31, OQ-44; §23.2 Income categories | Categories L342–346; OQ-44 L669 | #1–#4 |
| LOG-10 | PR-10, OQ-42, OQ-44; §23.2 Trips | Trips L348–353; L749–751; OQ-42 L667; OQ-44 L669 | #1–#4 |
| LOG-11 | PR-10, PR-03, NFR-20, FR-OFF-03, FR-OFF-12, FR-ERR-03, OQ-49; §23.2 History | History L357–363; Navigation L257; OQ-45 L670 | #1–#5; AC-D12, AC-D24 |
| LOG-12 | PR-10, OQ-18, OQ-45; §23.2 History | History L357–363; OQ-45 L670 | #1–#4 |
| LOG-13 | PR-10, FR-DATA-11, FR-SEC-05, FR-SEC-10, FR-OFF-03, OQ-17, OQ-45; §23.2 History, Entry rules | History L357–363; Entry rules L189; OQ-17 L641; OQ-45 L670 | #1–#5 |
| LOG-14 | PR-10, OQ-17, OQ-45; §23.2 History | History L357–363; OQ-45 L670 | #1–#4 |
| LOG-15 | TS-06, TS-07, PR-03, PR-10, §21.5, FR-LINK-01 | Testing L309–322; OQ-37 L658 | #1–#5; TS-06; AC-D7, AC-D12, AC-D24 |

**G2. Scope item → covering stories** (proves each §23.2 scope item is covered).

| §23.2 scope item | Stories |
| --- | --- |
| Fuel (with mileage) | LOG-02, LOG-05 |
| EV charging | LOG-02, LOG-06 |
| Expenses | LOG-03, LOG-07 |
| Services with line items | LOG-03, LOG-08 |
| Income | LOG-03, LOG-09 |
| Manual trips | LOG-03, LOG-10 |
| History list: one list, newest first | LOG-11 |
| Filters by type and date range; search | LOG-12 |
| Tap to edit | LOG-13 |
| Delete with Undo | LOG-14 |
| Odometer sanity checks (warn, don't block) | LOG-03, LOG-04 |
| `lastOdometer` in the same batch | LOG-04, LOG-13, LOG-14 |
| Offline with the sync icon; airplane-mode logging (TS-06) | LOG-04, LOG-11, LOG-15 |
| Quota budget (G2) | LOG-01 |
