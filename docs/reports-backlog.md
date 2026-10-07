# Milevana v1 — Sub-project 4: Reports and dashboard — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 14 in 4 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Same thin specification as Logging and Reminders.** PRD §23.4 records "what the source already fixes", the tab 4 decisions, OQ-19, OQ-48, OQ-49, and says "Acceptance criteria: defined in tab 4" and "Field shapes: none beyond the entry shapes".
- **There are no PRD acceptance criteria and no `FR-` IDs for sub-project 4** (PRD §25.4). The criteria below are **derived from stated behavior** and cite the row they restate. They are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-12`, `PR-03`, `FR-NAV-09`, `FR-DATA-12`, `FR-OFF-12`, `FR-VEH-16`, `NFR-06`, `NFR-08`, `NFR-19`, `NFR-20`, `OQ-11`, `OQ-18`, `OQ-19`, `OQ-32`, `OQ-42`, `OQ-44`, `OQ-47` to `OQ-49`, `TS-03`, gate `G2`. Where the PRD gives only a row in §23.4, the row name is cited, for example "§23.4 *Overview*".

**Labels.** `RPT-nn` story IDs and `PD-nn` decision labels are tracking labels, not requirement IDs. Earlier decisions are cited as `DR-nn` (Foundation), `LD-nn` (Logging) and `RD-nn` (Reminders).

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `PD-nn`, plus the earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.4):** per-vehicle and "All vehicles" reports; the six time ranges including the financial year; cost and profit metrics; charts; and the per-vehicle Dashboard.

**What earlier sub-projects provide** (assumed accepted): the entry data and schema (`FND-DAT-02`, `FND-DAT-07`); the vehicle switcher with an "All vehicles" entry that changes only Reports (`FND-SHL-04`); the Reports tab and Dashboard shells (`FND-SHL-02`); settings formatters and unit conversion (`FND-SET-02`, `FND-DAT-01`); entry data and fuel mileage logic (`LOG-02`, `LOG-03`, `LOG-05` to `LOG-11`); the "Upcoming & overdue" card (`REM-10`).

**Out of scope:** PDF or image export of reports (not in v1); CSV export (tab 5); checklist-specific reports (not in v1); sharing UI (tab 6); any new entry type or form; currency conversion (totals are never converted).

**Scope notes (not product decisions):**
1. Costs are fuel, service and expense entries. Income entries are not costs. Trips and inspections carry no `amount`, so they do not add to cost.
2. Everything is computed on the device from the vehicle's entries (§23.4 *Computation*). No Cloud Function or server aggregate exists.
3. Other members' entries and shared vehicles cannot exist until tab 6; they are tested with seeded data.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| P1 | Reports domain and data loading | RPT-01 to RPT-04 |
| P2 | Reports tab | RPT-05 to RPT-12 |
| P3 | Dashboard | RPT-13 |
| P4 | Verification | RPT-14 |

---

# P1 — Reports domain and data loading

### RPT-01 — Spike: quota budget for reports (gate G2)
- **Epic:** P1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the read cost of opening reports counted, so that "All vehicles" and the Dashboard do not exhaust the free quota.
- **Business value:** Reports read every entry of a vehicle and "All vehicles" reads every vehicle in turn. PRD §24.6 lists the All-vehicles report as a G2 operation and says G2 gates tab 4.
- **Scope:** *In:* counts of reads for a per-vehicle report open at several entry counts, an "All vehicles" open across several vehicles, the Dashboard open, a range change (device only, expected zero reads), and a refresh; projection at 100 to 500 daily active users, cache-first; a recommendation for how entries are loaded and shared with History. *Out:* tab 5 operations.
- **Preconditions:** `FND-VER-01` method and DR-20; `LOG-01` results for History loading.
- **Functional behavior:** A written budget with per-operation counts and the daily projection.
- **Business rules:** Budget for roughly 100 to 500 daily active users, no Blaze fallback, cache-first reads with a refresh control (OQ-18, NFR-20). Entries are "loaded once and kept until they change" (§23.4 *Computation*).
- **Edge cases:** A user with many vehicles and years of entries. Several screens reading the same entries. Decision applied: PD-10.
- **Android/web differences:** Android cache-first; web has an in-memory cache only.
- **Offline behavior:** Counts assume cache reads.
- **Security implications:** None.
- **Data/schema impact:** May recommend a different loading approach before RPT-04 is accepted.
- **Acceptance criteria:**
  1. A document lists reads per operation named above [G2, OQ-18].
  2. The projection at 100 and 500 users is compared with the threshold and recorded pass or fail [G2].
  3. RPT-04 and RPT-12 are not accepted before this passes [PRD §24.6].
- **Decisions applied:** DR-20 ✔, PD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
  2. **D2** [PD-10 ◐] Opening Reports and then History for the same vehicle reads its entries once; a change from another device appears while the screen is mounted; Refresh re-reads from the server.
- **Test requirements:** Measured from the emulator with request logging.
- **Dependencies:** FND-VER-01, LOG-01, FND-DAT-07.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12; G2.
- **SRS reference:** Computation L446; OQ-18 L642; Error handling L307.

### RPT-02 — Domain: periods, distance and cost metrics
- **Epic:** P1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure period, distance and cost functions, so that every report and the Dashboard use one tested definition of "distance" and "cost per km".
- **Business value:** These figures are the headline numbers (cost per km, cost per day). A wrong definition makes every chart misleading, and the PRD asks for the definitions and their tests (OQ-48).
- **Scope:** *In:* `src/domain/reports.ts` part 1: the six time ranges (this month, last 3 months, last 12 months, this financial year April to March, all time, custom); distance for a period; total cost; cost per km; cost per day; per-currency and per-odometer-unit grouping; hiding distance metrics for `hours` vehicles. Written test-first. *Out:* section-specific metrics (RPT-03), UI.
- **Preconditions:** `FND-DAT-01`, `FND-DAT-02`, `LOG-03`.
- **Functional behavior:**
  1. **Ranges:** resolve each range to start and end dates; the financial year runs April to March in the device time zone; all time starts at vehicle creation.
  2. **Distance:** the last odometer reading in the period minus the last reading before it; the vehicle's starting odometer and a trip's start and end odometers count as readings; all-time distance is the last reading minus the starting odometer.
  3. **Cost:** the sum of costs in the period, excluding income and trip reimbursements.
  4. **Cost per km:** total costs divided by that distance. **Cost per day:** total costs divided by the period length.
  5. Totals are grouped per currency and never converted; distance and cost per km are grouped per odometer unit.
- **Business rules:** §23.4 *Time ranges*, *Distance for a period*, *Cost per km*; OQ-19, OQ-32, OQ-48, OQ-11. Distance-based metrics are hidden for `hours` vehicles.
- **Edge cases:** No reading in the period; only one reading; back-dated or out-of-order readings (the odometer check only warns); a custom range before the vehicle existed; zero distance. *Decisions applied:* exact meaning and boundaries of each range, default and custom ranges (PD-01); behavior for missing readings, negative or zero distance and what remains for `hours` vehicles (PD-02). Foundation DR-01 and Logging LD-05 decide which readings exist.
- **Android/web differences:** None (pure TypeScript).
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Each of the six ranges resolves as defined, with the financial year April to March in the device time zone [§23.4 *Time ranges*, OQ-32].
  2. Distance equals the last reading in the period minus the last reading before it, with starting and trip odometers counted, and all-time distance equals last minus starting [OQ-48].
  3. Costs exclude income and trip reimbursements; cost per km is costs divided by that distance; cost per day uses the period length [§23.4, OQ-48].
  4. Totals are per currency and never converted; distance and cost per km are per odometer unit [OQ-19].
  5. No distance-based figure is produced for an `hours` vehicle [OQ-11].
- **Decisions applied:** DR-01 ✔, LD-05 ◐, PD-01 ◐, PD-02 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-01 ✔] Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected.
  2. **D2** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
  3. **D3** [PD-01 ◐] On 7 October 2026 'This month' covers 1 to 7 October, 'Last 3 months' covers 7 July to 7 October inclusive, 'This financial year' covers 1 April 2026 to today (and on 15 February 2027 still starts 1 April 2026), and 'All time' starts at vehicle creation; a custom range whose start is after its end is rejected; the default is This month and persists per vehicle.
  4. **D4** [PD-02 ◐] Distance shows '—' with no reading, one reading, a negative result or zero; cost per km shows '—' when distance is unavailable; cost per day uses the days from the later of the range start and vehicle creation to the earlier of the range end and today; an `hours` vehicle's Overview shows total cost, cost per day and the split by type only.
- **Test requirements:** Jest, test-first, with hand-calculated fixtures (TS-03 style), including month and financial-year boundaries.
- **Dependencies:** FND-DAT-01, FND-DAT-02, LOG-03.
- **PRD requirement IDs:** PR-12, NFR-08, FR-DATA-12, OQ-11, OQ-19, OQ-32, OQ-48, TS-03.
- **SRS reference:** Time ranges L421–428; Distance and cost per km L439–442; OQ-19 L679; OQ-48 L680; OQ-32 L653.

### RPT-03 — Domain: section metrics
- **Epic:** P1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure functions for each report section and the Dashboard figures, so that every chart and card is computed from tested definitions.
- **Business value:** One definition of each figure prevents the Reports tab and the Dashboard disagreeing.
- **Scope:** *In:* `src/domain/reports.ts` part 2: split of cost by type (fuel, service, expense); monthly spend by type; fuel figures (mileage trend per fuel type, fuel price trend, fuel cost per km, EV home versus public charging cost); totals by category and service history by type; income and profit (income versus cost per month, net profit, profit per km, income by platform); trips (business versus personal distance, total reimbursement); whether a vehicle has income entries; Dashboard figures (last mileage or, for bi-fuel, cost per km; this month's spend; 90-day cost per km; this month's income versus cost). *Out:* rendering, charts.
- **Preconditions:** RPT-02, `LOG-02` (mileage), `LOG-03`.
- **Functional behavior:**
  1. Each function takes a vehicle's entries and a period and returns a structure the UI can chart.
  2. Net profit is income minus costs and excludes trip reimbursements; profit per km uses the period distance.
  3. Trip reimbursement is reported separately and never added to cost or profit; an income entry categorised "reimbursement" is ordinary income.
  4. For a bi-fuel vehicle the Dashboard figure is cost per km instead of last mileage.
- **Business rules:** §23.4 sections and Dashboard rows; OQ-44, OQ-48, OQ-42. "Income & profit" applies only when the vehicle has income entries; a gig-driver view means the vehicle has income entries.
- **Edge cases:** Months with no data. Entries on archived vehicles (kept for lifetime reports). Fuel entries of several fuel types. EV entries without `chargingLocation`. Service labour and discount against per-type totals. Income entries without a platform. *Decisions applied:* PD-03 (fuel figure definitions), PD-04 (category and type totals), PD-05 (income and profit definitions), PD-06 (when a section exists); Logging LD-01 (mileage), LD-06 (category storage), LD-07 (platform storage).
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Cost split by type sums to total cost [§23.4 *Overview*].
  2. Net profit excludes trip reimbursements and counts "reimbursement" income as income [OQ-44, OQ-48].
  3. Income and profit figures are produced only when the vehicle has income entries [§23.4 *Income & profit*, OQ-48].
  4. The bi-fuel Dashboard figure is cost per km, not last mileage [OQ-48].
  5. Business versus personal distance and total reimbursement come from trip entries [§23.4 *Trips*].
- **Decisions applied:** LD-01 ◐, LD-06 ◐, LD-07 ◐, PD-03 ◐, PD-04 ◐, PD-05 ◐, PD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  2. **D2** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
  3. **D3** [LD-07 ◐] An income entry with a platform stores `details.platform` (up to 60 characters) and an expense has no `details`.
  4. **D4** [PD-03 ◐] The mileage trend has one point per fill that has a mileage and one series per fuel type; EV charging with no location groups as 'Not specified'; fuel cost per km equals fuel cost divided by the period distance; litre and gallon prices follow the Volume setting.
  5. **D5** [PD-04 ◐] Totals by category list expense and service categories together with a type tag and one 'Other' bucket; service history by type shows visit count, last date and line-cost total per type, with Labour and Discount as separate rows.
  6. **D6** [PD-05 ◐] Income versus cost shows calendar-month grouped bars; profit per km equals net profit divided by the period distance; income with no platform is 'Not specified'; the Income & profit section appears when the vehicle has any income entry even if none falls in the period.
  7. **D7** [PD-06 ◐] A section with no entries in the range shows 'No data for this period', and a vehicle with no entries shows 'Add entries to see reports' in place of the sections.
- **Test requirements:** Jest, test-first, fixtures for each section (TS-03 style).
- **Dependencies:** RPT-02; LOG-02, LOG-03.
- **PRD requirement IDs:** PR-12, G8, NFR-08, FR-DATA-12, OQ-42, OQ-44, OQ-48, TS-03.
- **SRS reference:** Report sections L430–437; Dashboard L448–455; OQ-44 L669; OQ-48 L680.

### RPT-04 — Report data loading and caching
- **Epic:** P1 · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below); acceptance waits on RPT-01.
- **User story:** As a developer, I want a vehicle's entries loaded once and reused until they change, so that opening Reports is fast and cheap.
- **Business value:** Quota and responsiveness (NFR-06, NFR-20).
- **Scope:** *In:* a hook or service that loads all entries for a vehicle, keeps them in memory until they change, shares them across report sections and the Dashboard, loads each vehicle in turn for "All vehicles", skips malformed entries with the Foundation message, and supports the refresh control. *Out:* the metrics and UI.
- **Preconditions:** RPT-01 (gate), `FND-DAT-07`, `FND-OBS-03`.
- **Functional behavior:**
  1. First request loads the vehicle's entries; later requests reuse them.
  2. A change to the vehicle's entries refreshes the cached set.
  3. "All vehicles" loads each vehicle in turn.
  4. A malformed entry is skipped and "1 entry couldn't be shown" appears with a non-fatal logged.
- **Business rules:** Computation is on the device, entries loaded once and kept until they change (§23.4 *Computation*). Reads are cache-first with a refresh control (NFR-20).
- **Edge cases:** Very large vehicles. A change arriving while a report is open. A vehicle that becomes inaccessible. Decision applied: PD-10: invalidation, memory limits, sharing with History.
- **Android/web differences:** Android reads from the durable cache; web from the in-memory cache.
- **Offline behavior:** Works from the cache on Android.
- **Security implications:** Members only (rules).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Opening Reports, then the Dashboard, for the same vehicle reads its entries once [§23.4 *Computation*].
  2. A new entry updates the cached set and the report [§23.4 *Computation*].
  3. A malformed entry is skipped and reported [AC-D12].
  4. "All vehicles" loads each vehicle in turn [§23.4 *Computation*].
- **Decisions applied:** PD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [PD-10 ◐] Opening Reports and then History for the same vehicle reads its entries once; a change from another device appears while the screen is mounted; Refresh re-reads from the server.
- **Test requirements:** Jest + emulator with read counting; RNTL for the hook.
- **Dependencies:** RPT-01; FND-DAT-07, FND-OBS-03.
- **PRD requirement IDs:** NFR-06, NFR-20, FR-OFF-12, FR-ERR-03, OQ-18; AC-D12.
- **SRS reference:** Computation L446; OQ-18 L642.

---

# P2 — Reports tab

### RPT-05 — Reports tab: scope, time range and layout
- **Epic:** P2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want one scrolling Reports tab where I choose the vehicle scope and the period, so that every section answers the question I am asking.
- **Business value:** The frame all report sections sit in.
- **Scope:** *In:* the Reports tab as one scrolling page; scope following the switcher (the selected vehicle, or "All vehicles"); a time-range selector with This month, Last 3 months, Last 12 months, This financial year, All time and Custom; a custom date range input; the section container; the empty state; web layout. *Out:* the sections (RPT-06 to RPT-11), the All-vehicles content (RPT-12).
- **Preconditions:** RPT-02, RPT-04, `FND-SHL-04`.
- **Functional behavior:**
  1. The tab shows the selected scope and range; changing the range recomputes all sections without new reads.
  2. "All vehicles" changes only this tab (the other tabs keep the last single vehicle).
  3. Custom opens a date range input.
- **Business rules:** One scrolling Reports tab; the six ranges (§23.4); "All vehicles" lives in the switcher and changes only Reports (OQ-49).
- **Edge cases:** No entries. A custom range ending before it starts. Archived vehicle selected. Decision applied: PD-01, PD-06.
- **Android/web differences:** Web at 768 px and wider uses the rail layout; same charts on both.
- **Offline behavior:** Works from the cache on Android.
- **Security implications:** Members only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The tab lists the six ranges and recomputes on change with no extra reads [§23.4 *Time ranges*, *Computation*].
  2. Choosing "All vehicles" changes only the Reports tab [OQ-49, AC-D25].
  3. A custom range can be entered and applied [§23.4].
  4. The tab renders on Android and web with the same sections [§23.4 *Charts*].
- **Decisions applied:** DR-17 ◐, PD-01 ◐, PD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
  2. **D2** [PD-01 ◐] On 7 October 2026 'This month' covers 1 to 7 October, 'Last 3 months' covers 7 July to 7 October inclusive, 'This financial year' covers 1 April 2026 to today (and on 15 February 2027 still starts 1 April 2026), and 'All time' starts at vehicle creation; a custom range whose start is after its end is rejected; the default is This month and persists per vehicle.
  3. **D3** [PD-06 ◐] A section with no entries in the range shows 'No data for this period', and a vehicle with no entries shows 'Add entries to see reports' in place of the sections.
- **Test requirements:** RNTL with seeded entries; read-count check.
- **Dependencies:** RPT-02, RPT-04; FND-SHL-04.
- **PRD requirement IDs:** PR-12, FR-NAV-09, OQ-49; AC-D25; §23.4 *Report layout*, *Time ranges*.
- **SRS reference:** Time ranges L421–428; Layout L430; OQ-49 L681.

### RPT-06 — Overview section
- **Epic:** P2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want one summary of what my vehicle cost in a period, so that I understand the totals at a glance.
- **Business value:** The headline answer to "what does this vehicle cost me".
- **Scope:** *In:* total cost, cost per km, cost per day, distance driven, and a split by type (fuel, service, expense), formatted with the user's settings. *Out:* charts beyond the split (RPT-07).
- **Preconditions:** RPT-03, RPT-05.
- **Functional behavior:** Show the five figures for the chosen scope and period; the split shows each type's share.
- **Business rules:** Cost excludes income and trip reimbursements; distance and cost per km are hidden for `hours` vehicles (OQ-11, OQ-48).
- **Edge cases:** No reading in the period (distance unavailable); zero cost; one type only. Decision applied: PD-02.
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The section shows total cost, cost per km, cost per day, distance driven and the split by type [§23.4 *Overview*].
  2. Figures follow the Currency, Distance unit and formatting settings and never convert between currencies [FR-SET-03, OQ-19].
  3. For an `hours` vehicle distance-based figures are not shown [OQ-11].
- **Decisions applied:** DR-07 ◐, DR-08 ◐, PD-02 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-07 ◐] 245000 minor units of INR show as ₹2,450.00 and 123456700 as ₹12,34,567.00; a USD amount shows with international grouping; funds, metal and test codes such as XAU, XTS and XXX are not selectable; `mpg` uses US gallons unless the Volume setting is UK gallons; any combination of Distance, Volume and Efficiency settings is accepted; converted distance and volume show one decimal.
  2. **D2** [DR-08 ◐] A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes.
  3. **D3** [PD-02 ◐] Distance shows '—' with no reading, one reading, a negative result or zero; cost per km shows '—' when distance is unavailable; cost per day uses the days from the later of the range start and vehicle creation to the earlier of the range end and today; an `hours` vehicle's Overview shows total cost, cost per day and the split by type only.
- **Test requirements:** RNTL against RPT-02/03 fixtures.
- **Dependencies:** RPT-03, RPT-05.
- **PRD requirement IDs:** PR-12, FR-SET-03, OQ-11, OQ-19, OQ-48; §23.4 *Overview*.
- **SRS reference:** Report sections L430–437; Distance L439–442.

### RPT-07 — Monthly spend and the chart foundation
- **Epic:** P2 · **Type:** User-facing / architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to see my spending month by month split by type, and tap a bar to read its value, so that I can spot expensive months.
- **Business value:** The first chart; also sets up the shared chart components the other sections reuse.
- **Scope:** *In:* integrating `react-native-gifted-charts` (SVG, same charts on Android and web); stacked bars per month by type; tapping a point or bar shows its value; shared chart wrappers for the later sections. *Out:* the other sections' charts (RPT-08 to RPT-10).
- **Preconditions:** RPT-03, RPT-05.
- **Functional behavior:** The section draws one stacked bar per month in the range with fuel, service and expense segments; tapping shows the value.
- **Business rules:** Charts are SVG-based and identical on Android and web; tapping a chart point shows its value (§23.4 *Charts*).
- **Edge cases:** A range with one month; months with no spend; a very long range. Decision applied: PD-07: colours, legend, month boundaries, screen-reader alternative.
- **Android/web differences:** Same chart code; web at 768 px and wider has more room.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Stacked bars show spend per month split by fuel, service and expense [§23.4 *Monthly spend*].
  2. Tapping a bar shows its value [§23.4 *Charts*].
  3. The same chart renders on Android and web [§23.4 *Charts*].
  4. The bars sum to the total cost for the period [§23.4 *Overview*].
- **Decisions applied:** PD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [PD-07 ◐] Each section uses its stated chart type, tapping a data point shows its value, and every chart has a 'Show as table' toggle that exposes the same values to a screen reader.
- **Test requirements:** RNTL for the section; manual rendering check on both platforms (RPT-14).
- **Dependencies:** RPT-03, RPT-05.
- **PRD requirement IDs:** PR-12, NFR-11, §11.2 charts; §23.4 *Monthly spend*, *Charts*.
- **SRS reference:** Monthly spend L430–437; Charts L444; Libraries L115.

### RPT-08 — Fuel section
- **Epic:** P2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver, I want to see how my mileage and fuel price change over time and what fuel costs per km, so that I know whether my vehicle is getting more or less efficient.
- **Business value:** The question fuel logging exists to answer.
- **Scope:** *In:* a mileage trend per fuel type; a fuel price trend; fuel cost per km; for EVs, home versus public charging cost. *Out:* editing fuel entries.
- **Preconditions:** RPT-03, RPT-07, `LOG-02`, `LOG-05`, `LOG-06`.
- **Functional behavior:**
  1. The mileage trend shows one series per fuel type, using the Logging mileage rule.
  2. The price trend shows price per unit over time.
  3. Fuel cost per km is fuel cost divided by the period distance.
  4. For EVs a split shows home versus public charging cost.
- **Business rules:** Mileage per fuel type only between consecutive full fills of that fuel (§23.2). Units: CNG km/kg, EV km/kWh, petrol and diesel follow the Efficiency setting (OQ-42). Bi-fuel's headline is cost per km (§23.4 *Cost per km*). Distance-based figures are hidden for `hours` vehicles (OQ-11).
- **Edge cases:** A vehicle with one fill (no mileage). Several fuels. EV entries without a charging location. Decision applied: PD-03 and PD-07; Logging LD-01 and LD-02.
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A mileage trend per fuel type is shown for vehicles with at least two consecutive full fills of that fuel [§23.4 *Fuel*, §23.2].
  2. A fuel price trend and fuel cost per km are shown [§23.4 *Fuel*].
  3. For an EV, home and public charging cost are shown separately [§23.4 *Fuel*].
  4. Units follow OQ-42 and the section is hidden or distance-free for an `hours` vehicle [OQ-42, OQ-11].
- **Decisions applied:** LD-01 ◐, LD-02 ◐, PD-03 ◐, PD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-01 ◐] A full fill 500 km after the previous full fill of the same fuel with 40 L added shows 12.5 km/l; a fill with `missedPrevious` on, or an in-between fill with it on, gives no mileage for that interval; partial fills between two full fills add to the quantity divided into the distance; a fuel's first fill shows no mileage; an `hours` vehicle shows none.
  2. **D2** [LD-02 ◐] Petrol, diesel and LPG default to the Volume setting's unit with a per-entry picker; CNG is kg; electric is kWh and the full flag is labelled 'Full charge'; the default fuel is the vehicle's first fuel type, then the one last used; `missedPrevious` defaults to off.
  3. **D3** [PD-03 ◐] The mileage trend has one point per fill that has a mileage and one series per fuel type; EV charging with no location groups as 'Not specified'; fuel cost per km equals fuel cost divided by the period distance; litre and gallon prices follow the Volume setting.
  4. **D4** [PD-07 ◐] Each section uses its stated chart type, tapping a data point shows its value, and every chart has a 'Show as table' toggle that exposes the same values to a screen reader.
- **Test requirements:** RNTL with seeded fuel fixtures; Jest in RPT-03.
- **Dependencies:** RPT-03, RPT-07; LOG-02, LOG-05, LOG-06.
- **PRD requirement IDs:** PR-12, OQ-11, OQ-42, TS-03; §23.4 *Fuel*, *Cost per km*.
- **SRS reference:** Fuel L434; Mileage L337–340; OQ-42 L667.

### RPT-09 — Services and expenses section
- **Epic:** P2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want totals by category and a history of services by type, so that I see where money goes and when a service was last done.
- **Business value:** Shows the non-fuel cost drivers and the service history behind reminders.
- **Scope:** *In:* totals by category for services and expenses; service history by type. *Out:* editing entries.
- **Preconditions:** RPT-03, RPT-07, `LOG-07`, `LOG-08`.
- **Functional behavior:** Category totals for the period; service history grouped by service type with dates and costs, drawn from line items.
- **Business rules:** Category name is copied onto each entry (§13.4); a service entry carries line items by type and one entry category (OQ-41, OQ-43).
- **Edge cases:** "Other" categories with free text; labour and discount against per-type totals; a service with several lines. Decision applied: PD-04, PD-07; Logging LD-06.
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Totals by category are shown for the chosen period [§23.4 *Services & expenses*].
  2. Service history by type shows each service type's visits [§23.4 *Services & expenses*].
  3. The totals agree with the Overview cost split [§23.4 *Overview*].
- **Decisions applied:** LD-06 ◐, PD-04 ◐, PD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-06 ◐] Choosing 'Other' on an expense stores the typed text in `category`; on a service line it stores `serviceType: other` with the text in `otherLabel`; fixed categories store their English names.
  2. **D2** [PD-04 ◐] Totals by category list expense and service categories together with a type tag and one 'Other' bucket; service history by type shows visit count, last date and line-cost total per type, with Labour and Discount as separate rows.
  3. **D3** [PD-07 ◐] Each section uses its stated chart type, tapping a data point shows its value, and every chart has a 'Show as table' toggle that exposes the same values to a screen reader.
- **Test requirements:** RNTL with seeded fixtures.
- **Dependencies:** RPT-03, RPT-07; LOG-07, LOG-08.
- **PRD requirement IDs:** PR-12, OQ-41, OQ-43; §23.4 *Services & expenses*.
- **SRS reference:** Services & expenses L435; OQ-43 L668.

### RPT-10 — Income and profit section
- **Epic:** P2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a gig or rideshare driver, I want to see income against cost, net profit and profit per km, so that I know what I really earn.
- **Business value:** "Real profit figures" is a stated product goal (G8).
- **Scope:** *In:* the section, shown only when the vehicle has income entries: income versus cost per month, net profit, profit per km, income by platform. *Out:* trip reimbursement (RPT-11).
- **Preconditions:** RPT-03, RPT-07, `LOG-09`.
- **Functional behavior:** The section appears only for vehicles with income entries; it shows the four items for the period.
- **Business rules:** Net profit excludes trip reimbursements; an income entry categorised "reimbursement" counts as income (OQ-44, OQ-48). Profit per km uses the period distance and is hidden for `hours` vehicles (OQ-11).
- **Edge cases:** Income with no platform; a period with income but no cost; a vehicle that earns in some months only. Decision applied: PD-05, PD-06, PD-07; Logging LD-07.
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The section does not appear for a vehicle with no income entries and appears when one exists [§23.4 *Income & profit*, OQ-48].
  2. Income versus cost per month, net profit, profit per km and income by platform are shown [§23.4].
  3. Net profit excludes trip reimbursements [OQ-44, OQ-48].
- **Decisions applied:** LD-07 ◐, PD-05 ◐, PD-06 ◐, PD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-07 ◐] An income entry with a platform stores `details.platform` (up to 60 characters) and an expense has no `details`.
  2. **D2** [PD-05 ◐] Income versus cost shows calendar-month grouped bars; profit per km equals net profit divided by the period distance; income with no platform is 'Not specified'; the Income & profit section appears when the vehicle has any income entry even if none falls in the period.
  3. **D3** [PD-06 ◐] A section with no entries in the range shows 'No data for this period', and a vehicle with no entries shows 'Add entries to see reports' in place of the sections.
  4. **D4** [PD-07 ◐] Each section uses its stated chart type, tapping a data point shows its value, and every chart has a 'Show as table' toggle that exposes the same values to a screen reader.
- **Test requirements:** RNTL with seeded income fixtures.
- **Dependencies:** RPT-03, RPT-07; LOG-09.
- **PRD requirement IDs:** PR-12, G8, OQ-11, OQ-44, OQ-48; §23.4 *Income & profit*.
- **SRS reference:** Income & profit L436; OQ-44 L669; OQ-48 L680.

### RPT-11 — Trips section
- **Epic:** P2 · **Type:** User-facing · **Size:** S · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver who is reimbursed for business trips, I want business versus personal distance and total reimbursement, so that I can make a claim.
- **Business value:** Supports reimbursement claims, a stated reason for the financial-year range.
- **Scope:** *In:* business versus personal distance and total reimbursement, shown separately from costs and income. *Out:* creating or editing trips.
- **Preconditions:** RPT-03, RPT-07, `LOG-10`.
- **Functional behavior:** The section totals trip distance by purpose and the calculated reimbursement for the period.
- **Business rules:** Trip reimbursement is shown only here and is excluded from cost and from net profit; trips never create income (OQ-44).
- **Edge cases:** Trips without a rate; trips on an `hours` vehicle; a period with no trips. Decision applied: PD-06, PD-07.
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Business and personal distance are shown for the period [§23.4 *Trips*].
  2. Total reimbursement is shown and is not included in cost or net profit [OQ-44].
  3. Trips without a rate contribute distance and no reimbursement [OQ-42].
- **Decisions applied:** PD-06 ◐, PD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [PD-06 ◐] A section with no entries in the range shows 'No data for this period', and a vehicle with no entries shows 'Add entries to see reports' in place of the sections.
  2. **D2** [PD-07 ◐] Each section uses its stated chart type, tapping a data point shows its value, and every chart has a 'Show as table' toggle that exposes the same values to a screen reader.
- **Test requirements:** RNTL with seeded trip fixtures.
- **Dependencies:** RPT-03, RPT-07; LOG-10.
- **PRD requirement IDs:** PR-12, OQ-42, OQ-44; §23.4 *Trips*, *Reimbursements*.
- **SRS reference:** Trips L437; OQ-44 L669.

### RPT-12 — "All vehicles" report
- **Epic:** P2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below); acceptance waits on RPT-01.
- **User story:** As an owner of several vehicles, I want one report across all of them, so that I see my total running cost without adding anything up myself.
- **Business value:** Answers the "what do my vehicles cost altogether" question; OQ-49 puts the entry in the switcher.
- **Scope:** *In:* the Reports content when the switcher is on "All vehicles": totals shown per currency and never converted; mileage kept per vehicle; distance and cost per km shown per odometer unit; an include-archived toggle, off by default; each vehicle loaded in turn; the way to reach an archived vehicle's report. *Out:* the Dashboard, which stays per vehicle.
- **Preconditions:** RPT-05 to RPT-11, RPT-04, RPT-01 (gate).
- **Functional behavior:**
  1. With "All vehicles" selected, sections aggregate across the user's vehicles, grouped per currency.
  2. Mileage and distance appear per vehicle or per odometer unit, never summed across units.
  3. Archived vehicles are excluded unless the toggle is on.
  4. Archived vehicles are also reachable through More → Vehicles.
- **Business rules:** §23.4 *Scope of reports*, *Archived vehicles in All vehicles*; OQ-19, OQ-49.
- **Edge cases:** Vehicles in different currencies and units; one vehicle failing to load; no vehicles. Decision applied: PD-08: presentation of several currencies and units, which vehicles are included, how an archived vehicle's own report is opened.
- **Android/web differences:** Same.
- **Offline behavior:** From the cache.
- **Security implications:** Only vehicles the user is a member of.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Totals appear separately per currency and are never converted [OQ-19, §23.4 *Scope of reports*].
  2. Mileage stays per vehicle and distance and cost per km are per odometer unit [OQ-19].
  3. Archived vehicles are excluded by default and included when the toggle is on [§23.4].
  4. Each vehicle is loaded in turn [§23.4 *Computation*].
- **Decisions applied:** DR-13 ◐, PD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [PD-08 ◐] All vehicles shows one block per currency; distance and cost per km are grouped per odometer unit; archived vehicles are excluded until the toggle is switched on (off by default, not persisted); a vehicle that fails to load is skipped with 'Couldn't load <name>' and left out of totals; an archived vehicle's report opens from More → Vehicles.
- **Test requirements:** RNTL with vehicles in INR and USD and in km and mi; read-count check.
- **Dependencies:** RPT-05 to RPT-11, RPT-04, RPT-01.
- **PRD requirement IDs:** PR-12, FR-NAV-09, OQ-19, OQ-48, OQ-49; AC-D25; §23.4 *Scope of reports*.
- **SRS reference:** Scope of reports L419; Computation L446; OQ-19 L679; OQ-49 L681.

---

# P3 — Dashboard

### RPT-13 — Per-vehicle Dashboard
- **Epic:** P3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user opening the app, I want a summary of my vehicle on the Dashboard, so that I see how it is doing before I log anything.
- **Business value:** The first screen users see every day.
- **Scope:** *In:* the Dashboard body for the selected vehicle: last mileage (for a bi-fuel vehicle, cost per km instead); this month's spend; 90-day cost per km; the "Upcoming & overdue" reminders card; the 5 most recent entries; for gig drivers, this month's income versus cost. *Out:* "All vehicles" on the Dashboard (Reports only).
- **Preconditions:** RPT-03, RPT-04, `REM-10`, `LOG-11`, `FND-SHL-02`.
- **Functional behavior:**
  1. The Dashboard shows the six items for the selected vehicle.
  2. A bi-fuel vehicle shows cost per km in place of last mileage.
  3. The income versus cost item appears only when the vehicle has income entries.
  4. A first-time user with no vehicle still sees "Add your first vehicle".
- **Business rules:** §23.4 *Dashboard (per vehicle)*; OQ-48; the Upcoming & overdue card is from sub-project 3 (OQ-47). A gig-driver view means the vehicle has income entries.
- **Edge cases:** A new vehicle with no entries; an `hours` vehicle (distance figures hidden, OQ-11); fewer than 5 entries; an archived vehicle. Decision applied: PD-09; Foundation DR-17.
- **Android/web differences:** Web at 768 px and wider uses the rail layout.
- **Offline behavior:** From the cache.
- **Security implications:** Members only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The Dashboard shows last mileage, this month's spend, 90-day cost per km, the Upcoming & overdue card and the 5 most recent entries [§23.4 *Dashboard*].
  2. A bi-fuel vehicle shows cost per km instead of last mileage [OQ-48].
  3. This month's income versus cost appears only for a vehicle with income entries [§23.4, OQ-48].
  4. Distance-based items are hidden for an `hours` vehicle [OQ-11].
- **Decisions applied:** DR-17 ◐, RD-01 ◐, RD-11 ◐, PD-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
  2. **D2** [RD-01 ◐] A date reminder shows Due today on its due date and Overdue from the next day; an odometer reminder is Overdue when `lastOdometer` is at or past its due odometer; the states Upcoming, Due soon, Due today, Overdue and Done exist.
  3. **D3** [RD-11 ◐] A reminder row shows its title, due text, status chip and repeat icon in OQ-47 order; the Dashboard card shows at most 3 reminders with 'See all'; with none it shows 'No upcoming reminders' and an Add reminder shortcut.
  4. **D4** [PD-09 ◐] A petrol plus CNG vehicle's Dashboard shows cost per km instead of last mileage while other multi-fuel vehicles show the first fuel's last mileage; 90-day cost per km uses costs dated in the last 90 days over the distance across that window; the recent-entries card shows the 5 newest by date and opens the tapped entry.
- **Test requirements:** RNTL with seeded entries and a fixed clock.
- **Dependencies:** RPT-03, RPT-04; REM-10, LOG-11; FND-SHL-02.
- **PRD requirement IDs:** PR-12, OQ-11, OQ-47, OQ-48; §23.4 *Dashboard (per vehicle)*.
- **SRS reference:** Dashboard L448–455; OQ-48 L680; OQ-47 L675.

---

# P4 — Verification

### RPT-14 — Report accuracy and cross-platform verification
- **Epic:** P4 · **Type:** Verification · **Size:** M · **Readiness:** Ready once RPT-05 to RPT-13 are built
- **User story:** As the maintainer, I want the report figures checked against hand calculations and the charts checked on both platforms, so that users can trust the numbers.
- **Business value:** A wrong total or a broken chart on one platform destroys trust in the whole app.
- **Scope:** *In:* a fixture vehicle with hand-calculated expected figures for every section and the Dashboard; checks of the financial-year boundaries (April and March) in the device time zone; an `hours` vehicle; a multi-currency, multi-unit "All vehicles" case; chart rendering and tap-to-show-value on Android and web; the quota check on a large vehicle; manual checklist updates. *Out:* PDF or image export (not in v1).
- **Preconditions:** RPT-05 to RPT-13.
- **Functional behavior:** Runnable by someone other than the author.
- **Business rules:** Domain code is test-first (PRD §21.1); web has a manual smoke test (TS-07).
- **Edge cases:** Device time-zone change; a vehicle with years of data.
- **Android/web differences:** Charts are checked on both.
- **Offline behavior:** Reports open from the cache in airplane mode.
- **Security implications:** Test data only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Every figure on the fixture vehicle matches the hand-calculated value [§23.4].
  2. Financial-year ranges start in April and end in March in the device time zone [OQ-32].
  3. Charts render and show a value on tap on Android and on web [§23.4 *Charts*].
  4. "All vehicles" shows separate totals for INR and USD vehicles and never a converted total [OQ-19].
  5. Reports open offline on Android [PR-03].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** RPT-05 to RPT-13.
- **PRD requirement IDs:** PR-12, PR-03, OQ-19, OQ-32, TS-03, TS-07.
- **SRS reference:** Testing L309–322; Charts L444; Time ranges L421–428.

---

# A. Reports and dashboard epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **P1 Reports domain and data loading** | The quota check, the pure period, distance, cost and section metrics, and loading a vehicle's entries once | RPT-01 to RPT-04 |
| **P2 Reports tab** | The scrolling tab, its range selector, each report section, and the "All vehicles" view | RPT-05 to RPT-12 |
| **P3 Dashboard** | The per-vehicle Dashboard | RPT-13 |
| **P4 Verification** | Hand-calculated accuracy and cross-platform chart checks | RPT-14 |

**Architectural versus user-facing.** Architecture or spike: RPT-01 to RPT-04. User-facing: RPT-05 to RPT-13 (RPT-07 also sets up the shared chart components). Verification: RPT-14.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`PD-nn`, or an earlier `DR-nn`, `LD-nn`, `RD-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | RPT-01 ◆ | Spike: quota budget for reports (G2) | S | FND-VER-01, LOG-01, FND-DAT-07 |
| W1 | RPT-02 ◆ | Domain: periods, distance and cost metrics | L | FND-DAT-01, FND-DAT-02, LOG-03 |
| W2 | RPT-03 ◆ | Domain: section metrics | L | RPT-02, LOG-02, LOG-03 |
| W2 | RPT-04 ◆ | Report data loading and caching | M | RPT-01 (gate), FND-DAT-07, FND-OBS-03 |
| W3 | RPT-05 ◆ | Reports tab: scope, time range, layout | M | RPT-02, RPT-04, FND-SHL-04 |
| W3 | RPT-13 ◆ | Per-vehicle Dashboard | L | RPT-03, RPT-04, REM-10, LOG-11, FND-SHL-02 |
| W4 | RPT-06 ◆ | Overview section | M | RPT-03, RPT-05 |
| W4 | RPT-07 ◆ | Monthly spend and the chart foundation | M | RPT-03, RPT-05 |
| W5 | RPT-08 ◆ | Fuel section | L | RPT-03, RPT-07, LOG-02, LOG-05, LOG-06 |
| W5 | RPT-09 ◆ | Services and expenses section | M | RPT-03, RPT-07, LOG-07, LOG-08 |
| W5 | RPT-10 ◆ | Income and profit section | M | RPT-03, RPT-07, LOG-09 |
| W5 | RPT-11 ◆ | Trips section | S | RPT-03, RPT-07, LOG-10 |
| W6 | RPT-12 ◆ | "All vehicles" report | L | RPT-05 to RPT-11, RPT-04, RPT-01 |
| W7 | RPT-14 | Accuracy and cross-platform verification | M | RPT-05 to RPT-13 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | RPT-01 ∥ RPT-02 | Measurement spike versus domain code |
| Domain and loading | RPT-03 ∥ RPT-04 | Pure metrics versus the loading hook |
| Shell and Dashboard | RPT-05 ∥ RPT-13 | The Reports frame and the Dashboard read the same metrics but own different screens |
| First sections | RPT-06 ∥ RPT-07 | Overview figures versus the first chart |
| Remaining sections | RPT-08 ∥ RPT-09 ∥ RPT-10 ∥ RPT-11 | Each section owns its own component on the shared chart foundation |

**Not parallel:** the chart-based sections wait on RPT-07. RPT-12 needs every section. RPT-14 is last.

**Early starts.** RPT-02 and RPT-03 can begin before RPT-01 finishes because they involve no reads. The Dashboard's recent-entries card can begin once `LOG-11` rows exist.

---

# D. Blocking dependencies

**D1. Earlier sub-projects must be accepted first.** The PRD lists Foundation and Logging (data to report on). Needed specifically: `FND-DAT-07`, `FND-SHL-02`, `FND-SHL-04`, `FND-SET-02`, `FND-OBS-03`; from Logging `LOG-01` to `LOG-03` and the entry forms and History (`LOG-05` to `LOG-11`); from Reminders `REM-10` for the Dashboard card.

**D2. Gate G2.** PRD §24.6 lists the All-vehicles report as a G2 operation and says G2 gates tab 4. RPT-01 must pass before RPT-04 and RPT-12 are accepted. It cannot pass until Foundation's DR-20 (the threshold) is answered, and it depends on PD-10.

**D3. Decisions that block the domain code.** PD-01 and PD-02 (ranges and metric edge cases) block RPT-02. PD-03 to PD-06 (section definitions and visibility) block RPT-03. Everything else reads these two stories.

**D4. Upstream decisions that carry in.** Logging LD-01 (the mileage formula) determines every mileage figure; LD-06 and LD-07 (category storage, platform storage) determine category and platform totals; LD-05 and Foundation DR-01 (which odometer readings exist) determine distance; DR-07 and DR-08 determine how figures are formatted and which odometer unit is shown.

**D5. Library.** `react-native-gifted-charts` is fixed by the PRD. The PRD does not say whether it has been checked on web; RPT-07 and RPT-14 are where that is proven.

**D6. External.** None beyond Foundation's.

**D7. Later tabs.** CSV export (tab 5) covers taking data elsewhere; checklist-specific reports are not in v1; sharing (tab 6) makes members' entries appear in shared vehicles' reports. Nothing here should block them.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema** is not applicable (this sub-project adds no stored fields). **Story** = before the named story is accepted. **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **PD-01** | **Time ranges.** Whether "This month" is the calendar month to date; whether "Last 3 months" and "Last 12 months" are rolling or whole calendar months and whether the current partial month counts; inclusive boundaries and time of day in the device time zone; the default range on first open and whether it persists; limits and validation of a custom range. | §23.4 lists the six ranges and says the financial year is April to March; OQ-32 sets the device time zone. Boundaries and defaults are not stated. | RPT-02, RPT-05 | Story |
| **PD-02** | **Metric edge cases.** Distance when the period has no reading, only one reading, or a back-dated reading that makes it negative; display when distance is zero (cost per km); cost per day for a custom range that starts before the vehicle existed or ends in the future; decimals and rounding for cost per km and cost per day; which Overview figures remain for an `hours` vehicle. | OQ-48 defines distance and cost per day for the normal cases. The odometer check only warns, so odd readings occur. OQ-11 hides distance metrics for `hours` and names no replacement. | RPT-02, RPT-06 | Story |
| **PD-03** | **Fuel figure definitions.** Whether the mileage trend is per fill or per month; the unit and basis of the fuel price trend (per litre, gallon, kg, kWh; across fuels; with the Volume setting); how fuel cost per km is computed for the period; how EV charging with no location is grouped; whether per-fuel mileage still shows for bi-fuel vehicles. | §23.4 *Fuel* names the four items only. Logging LD-01 leaves the mileage formula open. | RPT-03, RPT-08 | Story |
| **PD-04** | **Services and expenses definitions.** What "totals by category" covers (service entries by their one category and expenses by category, together or apart); how "Other" free text groups; what "service history by type" lists (visits, dates, costs) and whether per-type costs include a share of labour and discount; list or chart. | §23.4 *Services & expenses* names the two items only. A service entry's total includes labour and discount, but its lines do not. | RPT-03, RPT-09 | Story |
| **PD-05** | **Income and profit definitions.** The monthly grouping for "income versus cost"; the denominator of profit per km; how income with no platform is grouped; whether "has income entries" is tested over all time or the chosen period (and across vehicles in "All vehicles"). | §23.4 and OQ-48 define "shown only when the vehicle has income entries" and net profit's exclusion of trip reimbursement, not these cases. Logging LD-07 leaves the platform's storage open. | RPT-03, RPT-10 | Story |
| **PD-06** | **Section visibility and empty states.** When sections other than Income & profit are hidden for lack of data; the Reports empty state; per-section "no data" wording. | The only stated visibility rule is for Income & profit. PRD §17.4 says other loading and empty states are not specified. | RPT-05, RPT-10, RPT-11 | Copy / Story |
| **PD-07** | **Chart presentation.** Chart type per section (bars or lines), colours and legend, month boundaries, number of points, how a tapped value is shown, a screen-reader alternative to a chart, and the dark-mode palette. | §23.4 *Charts* fixes the library, SVG and tap-to-show-value, and names stacked bars for Monthly spend only. Design is a visual reference, not a requirement. | RPT-07 to RPT-11 | Story |
| **PD-08** | **"All vehicles" presentation.** How several currencies and odometer units are laid out; which vehicles are included (all the user belongs to, including shared vehicles owned by others); the include-archived toggle's default and persistence; how a single archived vehicle's own report is opened; behavior when one vehicle fails to load. | §23.4 and OQ-49 fix per-currency totals, per-vehicle mileage, the toggle and More → Vehicles. | RPT-12 | Story |
| **PD-09** | **Dashboard definitions.** What "last mileage" is for a vehicle with several fuels that is not bi-fuel; which fuel combinations count as "bi-fuel" (the SRS example is petrol plus CNG); the window and distance rule for "90-day cost per km"; the order and tap action of the "5 most recent entries"; card order and layout; behavior with no data. | §23.4 *Dashboard (per vehicle)* names the items. OQ-48 says a bi-fuel Dashboard shows cost per km. | RPT-13 | Story |
| **PD-10** | **Loading and caching.** How "loaded once and kept until they change" works with History (one shared loaded set or two); how changes from another device or member reach an open report; any memory limit or paging for very large vehicles; the refresh behavior. | §23.4 *Computation* states the principle only. Logging LD-10 leaves History's loading open. | RPT-01, RPT-04 | Story |

**Decisions from earlier sub-projects that carry in:** Foundation DR-01 starting odometer · DR-07 formatting · DR-08 odometer display unit · DR-13 archived-vehicle actions · DR-15 selected vehicle · DR-17 shell content · DR-20 quota threshold · Logging LD-01 mileage · LD-04 entry date · LD-05 odometer readings · LD-06 category storage and "Other" · LD-07 income platform · LD-10 History loading · Reminders RD-01 statuses · RD-11 card content.

**Can start before any decision is answered:** RPT-01's measurement setup, RPT-02's stated rules (distance as last minus last-before, cost exclusions, per-currency grouping), RPT-04's loader mechanism, RPT-07's chart wrapper and tap behavior, and RPT-05's frame.

---

# F. Reports and dashboard Definition of Done

The PRD defines no acceptance criteria for sub-project 4, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.4)**
- [ ] A user can open one scrolling Reports tab for the selected vehicle or for "All vehicles" and pick any of the six time ranges, including the April–March financial year and a custom range.
- [ ] The Overview, Monthly spend, Fuel, Services & expenses, Income & profit and Trips sections show the stated figures and charts.
- [ ] Income & profit appears only when the vehicle has income entries.
- [ ] "All vehicles" shows totals per currency, never converted, mileage per vehicle, distance and cost per km per odometer unit, and an include-archived toggle that is off by default.
- [ ] The per-vehicle Dashboard shows last mileage (cost per km for bi-fuel), this month's spend, 90-day cost per km, the Upcoming & overdue card, the 5 most recent entries, and for gig drivers this month's income versus cost.

**Behavior**
- [ ] Distance is the last reading in the period minus the last reading before it; cost per km excludes income and trip reimbursements; net profit excludes trip reimbursements.
- [ ] Distance-based figures are hidden for `hours` vehicles.
- [ ] Entries are loaded once and kept until they change; reports and the Dashboard open from the cache offline on Android.
- [ ] Tapping a chart point shows its value, and the charts are the same on Android and web.

**Evidence**
- [ ] Domain tests written first pass, with hand-calculated fixtures (TS-03 style).
- [ ] RPT-01 passed: the quota budget holds with All vehicles.
- [ ] RPT-14 is run and recorded, including the web smoke test.

**Scope and quality**
- [ ] No out-of-scope feature exists: no PDF or image export, no currency conversion, no checklist reports.
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `PD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 4; the last column cites the story's own criteria (`#n`) plus the applicable Foundation `AC-D`, test requirement or gate.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| RPT-01 | NFR-06, NFR-19, NFR-20, RK-25, OQ-18, FR-OFF-12; G2 | Computation L446; OQ-18 L642; L307 | #1–#3; G2 |
| RPT-02 | PR-12, NFR-08, FR-DATA-12, OQ-11, OQ-19, OQ-32, OQ-48, TS-03 | Time ranges L421–428; Distance L439–442; OQ-19 L679; OQ-48 L680; OQ-32 L653 | #1–#5 |
| RPT-03 | PR-12, G8, NFR-08, FR-DATA-12, OQ-42, OQ-44, OQ-48, TS-03 | Sections L430–437; Dashboard L448–455; OQ-44 L669; OQ-48 L680 | #1–#5 |
| RPT-04 | NFR-06, NFR-20, FR-OFF-12, FR-ERR-03, OQ-18 | Computation L446; OQ-18 L642 | #1–#4; AC-D12 |
| RPT-05 | PR-12, FR-NAV-09, OQ-49; §23.4 Report layout, Time ranges | Time ranges L421–428; Layout L430; OQ-49 L681 | #1–#4; AC-D25 |
| RPT-06 | PR-12, FR-SET-03, OQ-11, OQ-19, OQ-48; §23.4 Overview | Sections L430–437; Distance L439–442 | #1–#3 |
| RPT-07 | PR-12, NFR-11; §23.4 Monthly spend, Charts | Sections L430–437; Charts L444; Libraries L115 | #1–#4 |
| RPT-08 | PR-12, OQ-11, OQ-42, TS-03; §23.4 Fuel, Cost per km | Fuel L434; Mileage L337–340; OQ-42 L667 | #1–#4 |
| RPT-09 | PR-12, OQ-41, OQ-43; §23.4 Services & expenses | L435; OQ-43 L668 | #1–#3 |
| RPT-10 | PR-12, G8, OQ-11, OQ-44, OQ-48; §23.4 Income & profit | L436; OQ-44 L669; OQ-48 L680 | #1–#3 |
| RPT-11 | PR-12, OQ-42, OQ-44; §23.4 Trips, Reimbursements | L437; OQ-44 L669 | #1–#3 |
| RPT-12 | PR-12, FR-NAV-09, OQ-19, OQ-48, OQ-49; §23.4 Scope of reports | Scope L419; Computation L446; OQ-19 L679; OQ-49 L681 | #1–#4; AC-D25 |
| RPT-13 | PR-12, OQ-11, OQ-47, OQ-48; §23.4 Dashboard | Dashboard L448–455; OQ-48 L680; OQ-47 L675 | #1–#4 |
| RPT-14 | PR-12, PR-03, OQ-19, OQ-32, TS-03, TS-07 | Testing L309–322; Charts L444; Time ranges L421–428 | #1–#5 |

**G2. §23.4 scope item → covering stories** (proves each item is covered).

| §23.4 scope item | Stories |
| --- | --- |
| Per-vehicle reports | RPT-05, RPT-06 to RPT-11 |
| "All vehicles" view; per-currency totals; include-archived toggle | RPT-12 |
| Six time ranges incl. financial year (April–March) | RPT-02, RPT-05 |
| One scrolling Reports tab | RPT-05 |
| Overview (total cost, cost per km, cost per day, distance, split by type) | RPT-02, RPT-06 |
| Monthly spend (stacked bars by type) | RPT-03, RPT-07 |
| Fuel (mileage trend, price trend, fuel cost per km, EV home vs public) | RPT-03, RPT-08 |
| Services & expenses (category totals, service history by type) | RPT-03, RPT-09 |
| Income & profit (shown only with income entries) | RPT-03, RPT-10 |
| Trips (business vs personal distance, total reimbursement) | RPT-03, RPT-11 |
| Distance for a period; cost per km | RPT-02 |
| Charts, same on Android and web, tap shows value | RPT-07, RPT-14 |
| Computation on device, loaded once, kept until change | RPT-04 |
| Dashboard (per vehicle) | RPT-13 |
| Bi-fuel Dashboard shows cost per km | RPT-03, RPT-13 |
| Quota budget (G2) | RPT-01 |
