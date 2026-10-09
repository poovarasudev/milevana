# RPT-14 — Reports and dashboard verification checklist

Manual run record for the checks unit/component/emulator tests cannot drive:
chart rendering and tap-to-show-value on real surfaces, offline opens, real
device time zones, and the read-counter spot check on a large vehicle. Fill
the Result column per run; link a bug or notes for anything that fails.

**Prerequisites**

- Android dev build installed (`dev.poovarasu.milevana`), Firebase emulator or
  dev project configured via `EXPO_PUBLIC_FIREBASE_*`.
- A web build served on the same data (`npx expo export --platform web` plus a
  static server, or `npx expo start --web`).
- Seed fixture vehicles:
  - **A** — INR, km, petrol: ≥3 months of fuel/service/expense/income/trip
    entries with hand-calculated expected figures for every report section and
    the Dashboard.
  - **B** — USD, mi, any fuel type, with entries (multi-currency scope check).
  - **C** — `hours` unit vehicle with entries (no distance figures).
  - **D** — petrol + CNG bi-fuel vehicle (dashboard cost-per-km check).
  - One archived vehicle with entries; optionally a 5th vehicle with a large
    (~1,000+) entry set for the quota spot check.

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Fixture A: every section figure (overview, monthly spend, fuel, services & expenses, income & profit, trips, lifetime) and every dashboard figure matches the hand-calculated value | RPT-14 #1, SC-RPT02/03/06/10/11 | ☐ |
| 2 | Device time zone set anywhere: report on 15 Feb → Financial year starts 1 Apr previous year and ends 31 Mar; a March 31 entry falls inside, an April 1 entry falls outside. Repeat on web | RPT-14 #2, SC-RPT02-01, OQ-32 | ☐ |
| 3 | Android: monthly-spend stacked bar, mileage trend, fuel-price trend render; tap a bar/point → value tooltip shows; "Show as table" toggles to exact figures and back | RPT-14 #3, SC-RPT07-01, §23.4 Charts | ☐ |
| 4 | Web (≥768 px and a narrow window): same charts render, tap → value, table toggle works; same sections as Android | RPT-14 #3, SC-RPT05-03 | ☐ |
| 5 | "All vehicles" scope with A (INR) + B (USD): separate currency blocks, no converted or merged total; km/mi distances reported per unit, never mixed | RPT-14 #4, SC-RPT12-01/02, OQ-19 | ☐ |
| 6 | `hours` vehicle C: no distance, cost-per-km or mileage figure anywhere in the report or on the dashboard | SC-RPT02-05, SC-RPT06-02 | ☐ |
| 7 | Bi-fuel vehicle D: Dashboard shows all-time cost per km (no last-mileage figure); petrol+diesel comparison vehicle still shows first-fuel last mileage | SC-RPT03-03 | ☐ |
| 8 | Airplane mode on Android: Reports and Dashboard open from cache with figures; pull-to-refresh shows the offline notice rather than wrong data | RPT-14 #5, SC-RPT04-02, FR-OFF-12 | ☐ |
| 9 | Open Reports (per-vehicle) then History then Dashboard for the same vehicle → one entry load; flip through all six ranges → no network reads (proxy: instant + no activity; emulator read-counter if available) | SC-RPT01-01, SC-RPT04-01, SC-RPT05-01 | ☐ |
| 10 | Large vehicle (~1,000+ entries): All-vehicles report loads in turn, stays responsive, figures correct; refresh completes | SC-RPT01-01, RPT-04 edge | ☐ |
| 11 | Kill a vehicle's read access (or inject a rules deny) mid-report: that vehicle is skipped with "couldn't load" while the others still render | SC-RPT04-02, SC-RPT12-03 | ☐ |
| 12 | Archived vehicle → Vehicles → View reports: the report opens for that vehicle; All-vehicles "Include archived" adds it | SC-RPT12-04, PD-08 | ☐ |
| 13 | Custom range → set start after end → validation blocks; valid range persists per vehicle across relaunch (This month etc. per PD-01) | SC-RPT05-01/03, PD-01 | ☐ |

**Notes**

- Automated coverage already verifies: every domain figure against
  hand-calculated values (`src/domain/__tests__/reports.test.ts`), the
  load-once/sequential-watch/failure-skip behavior
  (`src/features/__tests__/reportData.test.ts`), and the full UI incl. range
  chips, custom-range validation, sections, chart/table toggle, all-vehicles
  blocks, archived deep-link and dashboard figures
  (`src/ui/__tests__/reports.test.tsx`, charts mocked). The rows above cover
  the real-surface half.
- The RPT-01 quota projection is recorded in `docs/quota-budget.md`
  (marginal read-budget breach at 500 DAU — see its verdict and levers); the
  large-vehicle spot check here confirms the per-attach N-read cost in
  practice.

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
|      |       |        |        |       |
