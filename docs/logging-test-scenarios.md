# Milevana v1 — Sub-project 2: Logging — Test Scenarios

**Source:** `docs/logging-backlog.md` (15 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story. The PRD has no acceptance criteria for this sub-project, so these criteria are the derived ones the backlog proposed.
- **Decisions are applied.** Expected values come from the register (✔ answered by the owner, ◐ assumed). Where an assumed value would change, update the scenario with the register.
- **Level:** U Unit (Jest, domain) · C Component (React Native Testing Library) · E Emulator (repository or rules tests against the Firebase emulator) · M Maestro (Android end to end) · MAN Manual (device or browser). **Priority:** C Critical (data loss, correctness of money or odometer) · H High · M Medium · L Low.
- **Format:** each scenario lists steps with the expected result after ⇒. "Pre" is preconditions. Scenario IDs (`SC-…`) are labels, not requirement IDs.
- **Fixtures** assume an INR vehicle on kilometres unless a scenario says otherwise.

---

### LOG-01 — Spike: quota budget for Logging (G2)
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG01-01 | Operation counts are measured | Emulator with request logging; a vehicle with 100, 1,000 and 5,000 seeded entries | 1. Add an entry ⇒ reads, writes and the rules read counted.<br>2. Edit, delete, refresh, filter and search ⇒ counted; filter and search show 0 reads.<br>3. Cold-open History at each size ⇒ counted | MAN | H | #1 |
| SC-LOG01-02 | Projection against the 50% threshold | Counts from SC-LOG01-01 | 1. Project at 100 and 500 daily active users, cache-first ⇒ a table.<br>2. Compare with 25,000 reads and 10,000 writes per day ⇒ recorded pass or fail | MAN | C | #2, D1 |
| SC-LOG01-03 | History loading and the gate | Measured History cold open | 1. Confirm History loads all entries of a vehicle once and reuses them ⇒ one read set per vehicle.<br>2. Try to mark `LOG-11` accepted with the spike open ⇒ not accepted | MAN | H | #3, D2 |

### LOG-02 — Domain: fuel logic
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG02-01 | Two-of-three solver and rounding | `money.ts` ready | 1. Price 1.459/L and quantity 12.5 L ⇒ total 18.24 (1824 minor, half-up).<br>2. Total 18.24 and quantity 12.5 ⇒ price rounded half-up to the milli-unit.<br>3. Total and price ⇒ quantity to 3 decimals.<br>4. Edit total after typing price then quantity ⇒ the two most recent fields are the inputs, the third recalculates.<br>5. G7 fixtures (price to three decimals, 12.5 UK gallons) ⇒ round-trip exactly | U | C | #1, D3 |
| SC-LOG02-02 | Mileage between consecutive full fills | Fixture: petrol, full fill at 10,000 km, next full fill at 10,500 km with 40 L | 1. Compute ⇒ 12.5 km/l.<br>2. Add a partial 5 L fill at 10,200 km ⇒ divisor 45 L, result 11.1 km/l.<br>3. First fill of a fuel ⇒ no mileage | U | C | #2, D1 |
| SC-LOG02-03 | Missed fills and bi-fuel | Petrol + CNG vehicle with interleaved fills | 1. Later fill with `missedPrevious` on ⇒ no mileage for that interval.<br>2. In-between fill with it on ⇒ none.<br>3. Petrol and CNG ⇒ separate figures per fuel, never mixed | U | C | #3, D1 |
| SC-LOG02-04 | Units and defaults | Vehicle fixtures per fuel | 1. CNG ⇒ km/kg; electric ⇒ km/kWh; mile vehicle ⇒ mi/kg, mi/kWh.<br>2. Petrol and diesel ⇒ follow Efficiency format.<br>3. Default quantity unit for petrol, diesel, LPG follows the Volume setting; CNG kg; electric kWh | U | H | #4, D2 |
| SC-LOG02-05 | `hours` vehicle | Vehicle with `hours` odometer | 1. Compute mileage ⇒ "not applicable".<br>2. Two-of-three solver still works ⇒ true | U | M | #5, D1 |

### LOG-03 — Domain: entry rules
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG03-01 | Service total | Lines 1200 and 400, labour 300, discount 100 | 1. Total ⇒ 1800.<br>2. Discount 5000 ⇒ total floors at 0 and is accepted for a service.<br>3. No lines ⇒ validation error | U | C | #1, D2 |
| SC-LOG03-02 | Trip figures and rounding | Start 1,000, end 1,042, rate stored per distance unit | 1. Distance ⇒ 42.<br>2. With a rate ⇒ reimbursement rounded half-up to the minor unit.<br>3. Without a rate ⇒ none stored | U | C | #2, D2 |
| SC-LOG03-03 | Odometer sanity check | Entries with odometer at 9 Oct 10,000 and 20 Oct 10,500; a trip 15 Oct 10,200 to 10,260 | 1. Candidate 9,800 dated 12 Oct ⇒ warns "lower than 10,000 on 9 Oct".<br>2. Candidate 10,700 dated 12 Oct ⇒ warns higher than a later reading.<br>3. Trip start and end count as readings ⇒ true.<br>4. The check never blocks ⇒ true | U | H | #3, D3 |
| SC-LOG03-04 | Category lists and stored values | i18n English resources | 1. Expense list has 10 categories plus "Other"; Services 11 plus "Other"; Income 4 plus "Other" ⇒ match the SRS.<br>2. Stored `category` is the English name text; service line `serviceType` is a lowercase id ⇒ true.<br>3. "Other" stores the typed text in `category`, or `serviceType: other` with `otherLabel` on a line ⇒ true | U | H | #4, D1, D4 |

### LOG-04 — Entry form shell and Add sheet
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG04-01 | Add sheet opens real forms | A selected vehicle | 1. Tap Add on Dashboard ⇒ sheet lists Fuel, Expense, Service, Income, Trip, Inspection.<br>2. Open each of the first five ⇒ a form; Inspection ⇒ placeholder.<br>3. Remove all vehicles ⇒ Add button hidden | C | H | #1, D2 |
| SC-LOG04-02 | Save writes entry and `lastOdometer` | Vehicle `lastOdometer` 9,000 | 1. Save an entry with odometer 10,000 ⇒ one batch holds the entry and `lastOdometer` 10,000 with `createdBy` = signer.<br>2. Save one with 9,500 ⇒ `lastOdometer` stays 10,000 | E | C | #2 |
| SC-LOG04-03 | Default date and future dates | Add form open | 1. Open ⇒ date and time default to now, to the minute.<br>2. Choose a date next month ⇒ accepted with a "future date" note | C | M | D3 |
| SC-LOG04-04 | Odometer warning does not block | Earlier entry at 10,000 | 1. Enter 9,500 ⇒ inline warning under the field.<br>2. Tap Save ⇒ saves | C | H | #3, D4 |
| SC-LOG04-05 | Locks and the 5th-entry prompt | Anonymous user, two vehicles | 1. Save the first entry ⇒ odometer unit, currency and `startOdometer` become read-only in the edit form.<br>2. Save entries until 3 + 2 across vehicles ⇒ link prompt shows once; dismiss; save more ⇒ not shown again | M | C | #4, #5 |
| SC-LOG04-06 | Offline, web and archived vehicle | Airplane mode; archived vehicle selected | 1. Save in airplane mode ⇒ saved with the sync icon.<br>2. On web offline ⇒ Save disabled with the banner.<br>3. Select an archived vehicle ⇒ Add unavailable and forms not editable | M | C | #6, D1 |

### LOG-05 — Log a fuel fill-up
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG05-01 | Any two of three | Petrol vehicle, Volume litres | 1. Enter price 102.5 and quantity 10 ⇒ total 1025.00.<br>2. Enter total and quantity ⇒ price filled.<br>3. Save ⇒ `amount.minor` equals the total | C | C | #1, D3 |
| SC-LOG05-02 | Required and default fields | Add Fuel form | 1. Save with no odometer ⇒ blocked.<br>2. Full tank on by default; Missed previous off; Station optional ⇒ true.<br>3. A zero total ⇒ rejected | C | C | #2, D3 |
| SC-LOG05-03 | No location, defaults | App build | 1. Save a fill with a station name ⇒ plain text stored.<br>2. Inspect permissions ⇒ no location permission.<br>3. Default quantity unit follows the Volume setting; a unit picker overrides it ⇒ true | C | H | #3, D2 |
| SC-LOG05-04 | Bi-fuel vehicle | Petrol + CNG vehicle | 1. Open the form ⇒ fuel type defaults to petrol then the last used.<br>2. Choose CNG ⇒ unit is kg | C | H | #4, D2 |
| SC-LOG05-05 | Mileage display | Two full fills 500 km apart, 40 L | 1. Save the second fill ⇒ summary line and History row show 12.5 km/l.<br>2. `hours` vehicle ⇒ no mileage | C | H | #5, D1 |
| SC-LOG05-06 | Entry date | Add form | 1. Default date and time now, to the minute; a future date accepted with a note ⇒ true | C | M | D4 |

### LOG-06 — Log EV charging
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG06-01 | EV form | Electric vehicle | 1. Open Fuel ⇒ unit kWh, home or public choice shown, flag labelled "Full charge".<br>2. Save with `chargingLocation` public ⇒ stored only for electric | C | H | #1, #2, D2 |
| SC-LOG06-02 | EV mileage | Two full charges 300 km apart, 50 kWh | 1. Second save ⇒ 6.0 km/kWh (mi/kWh for a mile vehicle) | C | H | #3, D1 |
| SC-LOG06-03 | Required odometer and amounts | EV form | 1. Save without odometer ⇒ blocked.<br>2. Zero cost ⇒ rejected; cost with 2 decimals ⇒ accepted | C | H | #4, D3 |

### LOG-07 — Log an expense
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG07-01 | Categories offered | Expense form | 1. List ⇒ insurance, road tax, FASTag/toll, parking, fine/challan, PUC certificate, registration/permit, loan EMI, cleaning, accessories and "Other" | C | H | #1 |
| SC-LOG07-02 | Required fields and stored shape | Expense form | 1. Save with no category or amount ⇒ blocked.<br>2. Save "Insurance" 2,450 ⇒ `category` "Insurance", `amount` 245000 minor INR.<br>3. Choose Other and type "Wiper blades" ⇒ `category` holds that text | E | C | #2, #3, #4, D4 |
| SC-LOG07-03 | Limits and date | Expense form | 1. Notes of 500 characters ⇒ accepted; 501 ⇒ rejected; "Other" text of 61 characters ⇒ rejected.<br>2. Amount zero ⇒ rejected.<br>3. Default date now; future date accepted ⇒ true | C | M | D1, D2, D3 |

### LOG-08 — Log a service visit
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG08-01 | Service types and lines | Service form | 1. Type picker ⇒ 11 types plus "Other".<br>2. Add lines Engine oil 1200 and Air filter 400 ⇒ total 1600.<br>3. Add 0 lines ⇒ blocked; 21 lines ⇒ blocked; 1 and 20 accepted; a zero-cost line accepted | C | C | #1, D3 |
| SC-LOG08-02 | Total, labour and discount | Lines 1200 and 400 | 1. Labour 300, discount 100 ⇒ displayed and stored total 1800 (`amount.minor` 180000).<br>2. Discount larger than the sum ⇒ total 0 accepted | E | C | #2, #4, D1 |
| SC-LOG08-03 | One entry, one category | Service form | 1. Save ⇒ one `service` entry with a single category chosen from the Services list, any value regardless of lines.<br>2. "Other" line ⇒ `serviceType: other`, `otherLabel` stored | E | H | #3, D2, D3 |

### LOG-09 — Log income
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG09-01 | Categories and platform | Income form | 1. Categories ⇒ ride-hailing, delivery, rental, reimbursement, Other.<br>2. Platform suggestions Uber, Ola, Rapido, Swiggy, Zomato; free text accepted ⇒ true | C | H | #1, #2 |
| SC-LOG09-02 | Stored shape | Income form | 1. Save with platform "Uber" ⇒ `details.platform` "Uber" (max 60 characters); no platform ⇒ no `details`.<br>2. "Reimbursement" ⇒ saved as ordinary income.<br>3. Amount positive in vehicle currency; zero rejected | E | C | #3, #4, D1, D3 |
| SC-LOG09-03 | "Other" | Income form | 1. Choose Other and type text ⇒ stored in `category` | C | M | D2 |

### LOG-10 — Log a manual trip
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG10-01 | Distance and reimbursement | Trip form, rate set | 1. Start 1,000, end 1,042 ⇒ distance 42, updates on edit.<br>2. With a rate ⇒ reimbursement rounded half-up.<br>3. Without a rate ⇒ none stored | C | C | #1, #2, D1 |
| SC-LOG10-02 | Saved shape and no income | Trip form | 1. Save ⇒ no `amount`, no `category`, `date` = start date, end odometer stored as the entry `odometer`, `lastOdometer` can rise, start does not.<br>2. History/income lists ⇒ no income entry created | E | C | #3, #4, D2 |
| SC-LOG10-03 | Validation and hours | Trip form | 1. Missing times, odometers or purpose ⇒ rejected.<br>2. End before start; end odometer below start ⇒ rejected.<br>3. `hours` vehicle ⇒ distance shown in hours, rate per hour | C | H | D3 |

### LOG-11 — History list
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG11-01 | One list, newest first | Entries of all six types over 3 months | 1. Open History ⇒ all types in one list, newest first, under month headers.<br>2. Service visit with three lines ⇒ one row.<br>3. Each row shows type icon, date, category or fuel summary, amount, odometer if present | C | C | #1, #2, D3 |
| SC-LOG11-02 | Placeholders and fuel mileage | Fresh vehicle; fuel entries with mileage | 1. Tabs without content ⇒ "Coming soon" naming the vehicle (Dashboard/Reports).<br>2. Fuel row shows mileage 12.5 km/l | C | M | D1, D2 |
| SC-LOG11-03 | Malformed, pending, refresh | One malformed entry; airplane mode | 1. Open ⇒ it is skipped, "1 entry couldn't be shown", a non-fatal with the path logged.<br>2. Pending item ⇒ sync icon.<br>3. Pull to refresh online ⇒ fresh data | E | C | #3, #4, #5 |
| SC-LOG11-04 | Others' entries | Seeded entry by another member | 1. Row shows "Logged by <name>" ⇒ true | C | H | D3 |

### LOG-12 — History filters and search
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG12-01 | Type and date filters | Mixed entries | 1. Select Fuel and Service chips ⇒ only those types.<br>2. Set an inclusive date range ⇒ entries inside only | C | H | #1, #2, D2 |
| SC-LOG12-02 | Search | Notes, categories, line items, station, platform, from/to seeded | 1. Search "engine" case-insensitively ⇒ matches line-item type.<br>2. Search an amount ⇒ no match.<br>3. Relaunch ⇒ filters cleared | C | H | #3, D2 |
| SC-LOG12-03 | No extra reads and loaded set | Emulator read counter | 1. Apply filters and search ⇒ 0 extra reads.<br>2. History uses the vehicle's single loaded set ⇒ true | E | H | #4, D1 |

### LOG-13 — Edit an entry
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG13-01 | Open and save | Entries of each type | 1. Tap a row ⇒ pre-filled form of the right type.<br>2. Save ⇒ `updatedBy` = signer, `createdBy` unchanged, type cannot be changed, date can | E | C | #1, #2, D2, D4 |
| SC-LOG13-02 | `lastOdometer` recompute | Entry holds the maximum odometer | 1. Lower it ⇒ `lastOdometer` recomputed from remaining entries and `startOdometer`.<br>2. Edit with an out-of-order odometer ⇒ warning, still saves | E | C | #3, D3 |
| SC-LOG13-03 | Authority | Owner and a member; seeded entries | 1. Owner opens a member's entry ⇒ editable.<br>2. Member opens another's ⇒ read-only | C | H | #4, D4 |
| SC-LOG13-04 | Offline and archived | Airplane mode; archived vehicle | 1. Edit offline ⇒ saves, sync icon.<br>2. Open an entry on an archived vehicle ⇒ read-only | M | H | #5, D1 |

### LOG-14 — Delete an entry with Undo
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG14-01 | Undo window | Entry in History | 1. Delete ⇒ row disappears at once, Undo shown.<br>2. Undo within 5 s ⇒ restored, no write.<br>3. Wait 5 s ⇒ entry deleted, no soft-deleted copy | C | C | #1, #2, #3 |
| SC-LOG14-02 | `lastOdometer` and entry points | Entry holds the maximum | 1. Commit the delete ⇒ `lastOdometer` recomputed.<br>2. Delete from the edit screen and by row swipe ⇒ both work | E | C | #4, D1 |
| SC-LOG14-03 | Edge cases | Two entries | 1. Delete two quickly ⇒ each has a window, Undo for the latest.<br>2. Background the app during a window ⇒ delete commits.<br>3. Member deletes another member's entry ⇒ not offered; owner deletes it ⇒ allowed | C | H | D1, D2 |

### LOG-15 — Airplane-mode flow and Foundation seams live
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-LOG15-01 | Log every type offline | Android device, airplane mode | 1. Log fuel, EV charging, expense, service, income, trip ⇒ each saves with the sync icon.<br>2. Reconnect ⇒ all six reach the server | M | C | #1 |
| SC-LOG15-02 | Link prompt on the 5th entry | Anonymous user, two vehicles | 1. Save 3 + 2 entries ⇒ prompt appears once | M | H | #2 |
| SC-LOG15-03 | Locks, malformed, rejected | Seeded data | 1. After the first entry, unit and currency locked.<br>2. Seeded malformed entry ⇒ "1 entry couldn't be shown".<br>3. Queued entry the server rejects ⇒ warning and Sync issues with Retry and Discard | MAN | C | #3, #4, #5 |
