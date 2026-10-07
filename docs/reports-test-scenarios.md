# Milevana v1 — Sub-project 4: Reports and dashboard — Test Scenarios

**Source:** `docs/reports-backlog.md` (14 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story; the criteria are the derived ones the backlog proposed.
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual. **Priority:** C Critical · H High · M Medium · L Low.
- **Reference fixture "A"** (used by the numeric scenarios): an INR vehicle on km, created 1 January 2026, `startOdometer` 10,000. Readings: 15 Aug 12,000; 28 Sep 12,900. September entries: fuel 3,000, service 4,500, expense 1,500 (total 9,000); income 20,000; one business trip with reimbursement 600. "Today" is 7 October 2026.

---

### RPT-01 — Spike: quota budget for reports
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT01-01 | Counts | Emulator logging; vehicles with 100, 1,000 and 5,000 entries; a user with 5 vehicles | 1. Open a per-vehicle report, All vehicles, the Dashboard; change range; refresh ⇒ reads counted; a range change shows 0 reads | MAN | H | #1 |
| SC-RPT01-02 | Projection and gate | Counts available | 1. Project at 100 and 500 users against 25,000 reads and 10,000 writes ⇒ pass or fail recorded.<br>2. Opening Reports then History for one vehicle reads its entries once ⇒ true.<br>3. `RPT-04`/`RPT-12` accepted before pass ⇒ not allowed | MAN | C | #2, #3, D1, D2 |

### RPT-02 — Domain: periods, distance and cost metrics
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT02-01 | Ranges | Today 7 Oct 2026 | 1. This month ⇒ 1–7 Oct.<br>2. Last 3 months ⇒ 7 Jul–7 Oct inclusive; Last 12 months ⇒ 7 Oct 2025–7 Oct 2026.<br>3. This financial year ⇒ 1 Apr 2026–today; on 15 Feb 2027 ⇒ still starts 1 Apr 2026.<br>4. All time ⇒ from vehicle creation.<br>5. Custom with start after end ⇒ rejected. 00:00 to 23:59:59 local boundaries | U | C | #1, D3 |
| SC-RPT02-02 | Distance | Fixture A, range 1–30 Sep | 1. Last reading in range 12,900 minus last before 12,000 ⇒ 900.<br>2. All time ⇒ 12,900 − startOdometer 10,000 = 2,900.<br>3. Trip start and end odometers count as readings ⇒ true | U | C | #2, D1, D2 |
| SC-RPT02-03 | Costs and per-km figures | Fixture A, September | 1. Total cost ⇒ 9,000 (income and trip reimbursement excluded).<br>2. Cost per km ⇒ 9,000 ÷ 900 = 10.00.<br>3. Cost per day ⇒ 9,000 ÷ 30 = 300.00 | U | C | #3 |
| SC-RPT02-04 | Edge cases | Variations of Fixture A | 1. No reading, one reading, back-dated negative result, zero distance ⇒ distance and cost per km "—".<br>2. Range starting before 1 Jan 2026 ⇒ cost per day counts from creation.<br>3. Range ending in the future ⇒ counts to today | U | H | D4 |
| SC-RPT02-05 | Currency, unit, hours | INR km and USD mi vehicles; an `hours` vehicle | 1. Totals grouped per currency, never converted; distance and cost per km grouped per odometer unit.<br>2. `hours` vehicle ⇒ no distance-based figure | U | C | #4, #5 |

### RPT-03 — Domain: section metrics
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT03-01 | Split by type | Fixture A | 1. Fuel 3,000 + service 4,500 + expense 1,500 ⇒ sums to 9,000 | U | C | #1 |
| SC-RPT03-02 | Net profit | Fixture A | 1. Income 20,000 − cost 9,000 ⇒ 11,000; trip reimbursement 600 excluded; an income entry in category "reimbursement" counts as income.<br>2. Profit per km ⇒ 11,000 ÷ 900 = 12.22.<br>3. Section exists only when an income entry exists (any period) | U | C | #2, #3, D6 |
| SC-RPT03-03 | Bi-fuel and Dashboard figures | Petrol + CNG vehicle; petrol + diesel vehicle | 1. Petrol + CNG ⇒ cost per km instead of last mileage.<br>2. Petrol + diesel ⇒ first fuel's last mileage | U | H | #4, D1 |
| SC-RPT03-04 | Trips | Business 120 and personal 40, reimbursement 600 | 1. Business 120, personal 40, total reimbursement 600, kept out of cost and profit ⇒ true | U | H | #5 |
| SC-RPT03-05 | Fuel, category, empty rules | Fuel across two fuels; categories with "Other" texts | 1. One mileage point per fill that has mileage; EV with no location ⇒ "Not specified"; fuel cost per km = fuel cost ÷ distance.<br>2. Expense and service categories combine with one "Other" bucket; labour and discount as separate rows.<br>3. Income with no platform ⇒ "Not specified".<br>4. A section with no entries ⇒ "No data for this period".<br>5. Service line storage and platform storage read as `serviceType`/`otherLabel`, `details.platform` ⇒ true | U | H | D2, D3, D4, D5, D7 |

### RPT-04 — Report data loading and caching
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT04-01 | Loaded once, kept until change | Emulator read counter | 1. Open Reports then Dashboard then History for one vehicle ⇒ one read of its entries.<br>2. Add an entry ⇒ cached set and report update | E | C | #1, #2, D1 |
| SC-RPT04-02 | Malformed, All vehicles, refresh | One malformed entry; three vehicles | 1. Malformed entry ⇒ skipped with the message and a non-fatal.<br>2. All vehicles ⇒ vehicles load in turn.<br>3. Change from another device appears while mounted; Refresh re-reads from the server | E | H | #3, #4, D1 |

### RPT-05 — Reports tab: scope, time range, layout
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT05-01 | Ranges recompute without reads | Seeded entries | 1. Switch through the six ranges ⇒ sections recompute, 0 new reads.<br>2. Default This month; the chosen range persists per vehicle after relaunch ⇒ true | C | H | #1, D2 |
| SC-RPT05-02 | Scope | Several vehicles | 1. Choose "All vehicles" ⇒ only the Reports tab changes; Dashboard and History keep the last vehicle | C | H | #2 |
| SC-RPT05-03 | Custom range, empty, platforms | Web at 768 px and Android | 1. Custom range ⇒ entered and applied.<br>2. Vehicle with no entries ⇒ "Add entries to see reports".<br>3. Same sections on Android and web | C | M | #3, #4, D1, D3 |

### RPT-06 — Overview section
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT06-01 | Figures and formatting | Fixture A, September | 1. Total cost ₹9,000.00, cost per km 10.00, cost per day 300.00, distance 900 km and the split ⇒ shown.<br>2. Distance unit mi ⇒ distance converted, one decimal; INR amounts grouped Indian-style ⇒ true | C | C | #1, #2, D1, D2 |
| SC-RPT06-02 | Edge figures and hours | No readings; an `hours` vehicle | 1. No reading ⇒ distance and cost per km "—".<br>2. `hours` vehicle ⇒ total cost, cost per day and split only | C | H | #3, D3 |

### RPT-07 — Monthly spend and chart foundation
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT07-01 | Stacked bars | Fixture over 3 months | 1. One stacked bar per month with fuel, service, expense segments and a legend; bars sum to the period total.<br>2. Tap a bar ⇒ value tooltip | C | C | #1, #2, #4, D1 |
| SC-RPT07-02 | Platforms and table | Android and web | 1. Same chart on both ⇒ true.<br>2. "Show as table" ⇒ same values exposed to a screen reader | MAN | H | #3, D1 |

### RPT-08 — Fuel section
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT08-01 | Trends | Petrol vehicle with fills over 3 months | 1. Mileage line, one point per fill with mileage (needs two consecutive full fills).<br>2. Price line per litre or gallon following the Volume setting; fuel cost per km shown | C | H | #1, #2, D1, D3, D4 |
| SC-RPT08-02 | EV | EV with home and public charges, one with no location | 1. Home vs public cost shown; the unlocated one under "Not specified" | C | H | #3, D3 |
| SC-RPT08-03 | Units and hours | CNG, EV, mile vehicle, `hours` vehicle | 1. CNG km/kg, EV km/kWh (mi variants); petrol/diesel follow Efficiency.<br>2. `hours` vehicle ⇒ distance-free section | C | H | #4, D2 |

### RPT-09 — Services and expenses section
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT09-01 | Category totals | Expenses and services with "Other" texts | 1. Totals by category with a type tag and one "Other" bucket; agree with the Overview split ⇒ true | C | H | #1, #3, D1, D2 |
| SC-RPT09-02 | Service history by type | Visits with several lines, labour and discount | 1. Per type: visit count, last date, line-cost total.<br>2. Labour and Discount shown as separate rows; chart toggle to table works | C | H | #2, D2, D3 |

### RPT-10 — Income and profit section
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT10-01 | Appears only with income | Vehicle without income; then add one | 1. No income entry ⇒ section absent.<br>2. Add one dated outside the chosen range ⇒ section appears | C | C | #1, D3 |
| SC-RPT10-02 | Figures | Fixture A | 1. Income vs cost by calendar month (grouped bars), net profit 11,000, profit per km 12.22, income by platform with "Not specified" ⇒ shown.<br>2. Trip reimbursement not in net profit ⇒ true | C | C | #2, #3, D1, D2, D4 |

### RPT-11 — Trips section
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT11-01 | Distance and reimbursement | Business 120, personal 40, rate on business trips | 1. Business and personal distance shown; total reimbursement 600 shown separately; not in cost or profit | C | H | #1, #2 |
| SC-RPT11-02 | No-rate trips, empty | Trips without a rate; a period without trips | 1. Distance counted, reimbursement 0.<br>2. No trips ⇒ "No data for this period"; chart type matches the stated type ⇒ true | C | M | #3, D1, D2 |

### RPT-12 — "All vehicles" report
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT12-01 | Currencies and units | INR km vehicle and USD mi vehicle | 1. One block per currency, never combined.<br>2. Distance and cost per km grouped per odometer unit; mileage per vehicle ⇒ true | C | C | #1, #2, D2 |
| SC-RPT12-02 | Archived, loading, failure | An archived vehicle; one vehicle that fails to load | 1. Archived excluded; toggle (default off, not persisted) includes them.<br>2. Vehicles load in turn.<br>3. Failing vehicle ⇒ "Couldn't load <name>" and excluded from totals.<br>4. An archived vehicle's own report opens from More → Vehicles | C | H | #3, #4, D1, D2 |

### RPT-13 — Per-vehicle Dashboard
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT13-01 | Items | Fixture A with reminders | 1. Last mileage, this month's spend, 90-day cost per km, Upcoming & overdue card (up to 3, "See all"), 5 most recent entries (newest first, tap opens) ⇒ shown | C | C | #1, D3, D4 |
| SC-RPT13-02 | Bi-fuel and gig | Petrol + CNG vehicle; vehicle with income | 1. Bi-fuel ⇒ cost per km instead of last mileage.<br>2. This month's income vs cost appears only with income entries | C | H | #2, #3, D4 |
| SC-RPT13-03 | Hours, empty, placeholders | `hours` vehicle; new vehicle; no vehicle | 1. `hours` ⇒ distance items hidden.<br>2. No data ⇒ each card "—" with a hint.<br>3. No vehicle ⇒ "Add your first vehicle"; reminder status wording follows the reminder states | C | M | #4, D1, D2 |

### RPT-14 — Accuracy and cross-platform verification
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-RPT14-01 | Hand-calculated figures | Fixture A loaded | 1. Compare every section and the Dashboard with the hand values (distance 900, cost 9,000, cost per km 10.00, net profit 11,000, profit per km 12.22) ⇒ equal | MAN | C | #1 |
| SC-RPT14-02 | Financial year boundaries | Device time zone set to IST then a UTC−8 zone | 1. Entries at 31 Mar 23:30 and 1 Apr 00:30 local ⇒ fall in the right financial years | MAN | C | #2 |
| SC-RPT14-03 | Charts on both platforms | Android device and browser | 1. Charts render and show a value on tap on both ⇒ true | MAN | H | #3 |
| SC-RPT14-04 | Multi-currency and offline | INR and USD vehicles; airplane mode | 1. All vehicles shows separate INR and USD totals, no converted total.<br>2. Reports open offline on Android | MAN | C | #4, #5 |
