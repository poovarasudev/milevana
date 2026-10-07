# Milevana v1 — Sprint Capacity Estimate

**Scope:** all 138 stories in the eight backlogs · **Date:** 2026-10-07 · **Generated** from the story sizes and wave tables in `docs/*-backlog.md`

## How to read this estimate

This is a **planning aid, not a commitment.** The source documents give no velocity, team size or dates (PRD §24.5: "no calendar dates or durations" except the Play gate), so every number below rests on the assumptions in section 1. Change an assumption and the figures change in a known way (section 6). Elapsed-time items that no amount of developer capacity shortens are listed separately (section 7).

## Headline

Taken at face value, the 138 stories add up to **525 to 945 developer-days (planning figure 882)**. That is about **126 sprints for one developer** (roughly 4.8 years) or about **80 sprints for two** (roughly 3.1 years). **Treat this as an upper-end figure.** The story sizes were assigned for sequencing, as relative sizes, and not as calibrated effort. Section 6 shows how the total scales if actual effort per size is smaller, and says how to recalibrate after the first Foundation sprints.

## 1. Assumptions

| # | Assumption | Basis |
| --- | --- | --- |
| A1 | Story size converts to working days for **one developer, including tests**: S 1–2, M 3–5, L 5–10, XL 10–15 (mid-points 1.5, 4, 7.5, 12.5). | The backlogs define S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL > 2 weeks. The XL upper bound of 15 is an assumption. |
| A2 | A sprint is **2 weeks = 10 working days**; a developer's **focus factor is 0.7**, giving **7 productive dev-days per sprint**. | A typical allowance for meetings, review, build and CI waits and interruptions. Not from the sources. |
| A3 | **Planning figure = mid-point × 1.2** (20% contingency for rework, device testing and integration). Low and high use the range ends with no contingency. | Contingency is an assumption. |
| A4 | **Two developers** deliver 2 × 7 × 0.8 = **11.2 dev-days per sprint** (80% parallel efficiency), and no block finishes faster than its own critical path. | Coordination overhead is an assumption. |
| A5 | Sub-projects run in the PRD order 1 → 8, except that the **Release Phase A stories run right after sub-project 2** (VD-01) and the closed test then runs in parallel with sub-projects 3 to 7 (OQ-61). | PRD §24.1, §24.5, OQ-61. |
| A6 | Operations, content and asset stories (types `Release operations`, `Content and web`, `Visual assets`) use the same size scale but are **not developer work** in the strict sense; they are also totalled separately. | Their effort is real but may be done by someone other than the developer. |
| A7 | The 90 assumed decisions stand (see `docs/decisions-register.md`); the estimate does not include rework if they are overturned. | The owner's instruction to proceed with assumptions. |

## 2. Effort by sub-project

Days are for one developer. **Planning** = mid-point × 1.2. Sprints = planning days ÷ 7.

| Sub-project | Stories | S | M | L | XL | Low days | Mid days | High days | Planning days | Sprints (1 dev, planning) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Foundation | 39 | 3 | 20 | 15 | 1 | 148 | 210 | 271 | 251 | 35.9 |
| 2 Logging | 15 | 1 | 7 | 7 | 0 | 57 | 82 | 107 | 98 | 14.1 |
| 3 Reminders | 12 | 3 | 5 | 4 | 0 | 38 | 54 | 71 | 65 | 9.3 |
| 4 Reports and dashboard | 14 | 2 | 7 | 5 | 0 | 48 | 68 | 89 | 82 | 11.7 |
| 5 Drive and export | 17 | 2 | 7 | 5 | 3 | 78 | 106 | 134 | 127 | 18.2 |
| 6 Sharing | 16 | 2 | 7 | 5 | 2 | 68 | 94 | 119 | 112 | 16.0 |
| 7 Checklists | 10 | 0 | 8 | 2 | 0 | 34 | 47 | 60 | 56 | 8.1 |
| 8 Release | 15 | 2 | 9 | 3 | 1 | 54 | 74 | 94 | 89 | 12.7 |
| **Total** | **138** | 15 | 70 | 46 | 7 | **525** | **735** | **945** | **882** | **126.0** |

Of the total, **8 stories are operations, content or asset work** (REL-01, REL-02, REL-03, REL-04, REL-10, REL-12, REL-13, REL-14), worth 24 to 42 days (mid 33). The other 130 stories are engineering, spikes and verification.

## 3. Effort by kind of work

| Kind | Stories | Mid days | Share of mid |
| --- | --- | --- | --- |
| User-facing | 77 | 394 | 54% |
| Architecture / setup | 36 | 253 | 34% |
| Verification | 9 | 43 | 6% |
| Operations / content / assets | 8 | 33 | 4% |
| Spike | 8 | 12 | 2% |

## 4. Critical path inside each sub-project

Stories in the same wave can run in parallel, so a sub-project's fastest possible duration (with enough developers) is the sum over its waves of the largest story in each wave. The ratio to the single-developer total shows how much a second developer can absorb.

| Sub-project | Waves | Critical path low | mid | high (days) | Single-developer mid | Parallelism available |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Foundation | 11 | 56 | 80 | 105 | 210 | 2.6× |
| 2 Logging | 6 | 26 | 38 | 50 | 82 | 2.2× |
| 3 Reminders | 6 | 24 | 34 | 45 | 54 | 1.6× |
| 4 Reports and dashboard | 7 | 31 | 46 | 60 | 68 | 1.5× |
| 5 Drive and export | 7 | 46 | 60 | 75 | 106 | 1.8× |
| 6 Sharing | 5 | 33 | 44 | 55 | 94 | 2.1× |
| 7 Checklists | 5 | 19 | 27 | 35 | 47 | 1.7× |
| 8 Release | 8 | 37 | 51 | 65 | 74 | 1.5× |

## 5. Timeline in sprints

Sub-projects in PRD order, with Release Phase A (`REL-01`, `REL-02`, `REL-03`, `REL-04`, `REL-10`, `REL-13`) inserted after sub-project 2. Sprint counts use the planning figure (mid × 1.2). **One developer** works serially at 7 dev-days per sprint. **Two developers** work at 11.2 dev-days per sprint, but each block lasts at least its critical path (planning figure) at 7 dev-days per sprint. "Start" and "end" are sprint counts from the beginning of the project.

| Block | Planning days | Start (1 dev) | End (1 dev) | Sprints (2 devs) | End (2 devs) |
| --- | --- | --- | --- | --- | --- |
| 1 Foundation | 251 | 0.0 | 35.9 | 22.4 | 22.4 |
| 2 Logging | 98 | 35.9 | 50.0 | 8.8 | 31.2 |
| Release Phase A (closed-test prerequisites) | 30 | 50.0 | 54.3 | 3.3 | 34.6 |
| 3 Reminders | 65 | 54.3 | 63.6 | 5.9 | 40.5 |
| 4 Reports and dashboard | 82 | 63.6 | 75.3 | 7.8 | 48.3 |
| 5 Drive and export | 127 | 75.3 | 93.5 | 11.4 | 59.6 |
| 6 Sharing | 112 | 93.5 | 109.5 | 10.0 | 69.7 |
| 7 Checklists | 56 | 109.5 | 117.6 | 5.0 | 74.7 |
| 8 Release Phase C (deletion, policies, listing, verification, rollout) | 59 | 117.6 | 126.0 | 5.4 | 80.1 |
| **Total** | **882** | 0 | **126.0 sprints (about 58 months)** | | **80.1 sprints (about 37 months)** |

Months use 2-week sprints (about 0.46 months each). **Range for one developer without contingency:** 75.0 sprints (low) to 135.0 sprints (high).

**The closed test fits inside the build.** Release Phase A ends at about sprint 54 (one developer), leaving about 63 further sprints of development for the 14-day closed test to run alongside. The wait after the app is finished is Google's production-access review, not the closed test (OQ-61).

## 6. Sensitivity

Total planning effort is 882 dev-days (mid × 1.2).

| Case | Productive dev-days per sprint | Sprints for the total |
| --- | --- | --- |
| 1 dev, focus 0.6 | 6.0 | 147.0 |
| 1 dev, focus 0.7 (assumed) | 7.0 | 126.0 |
| 1 dev, focus 0.8 | 8.0 | 110.2 |
| 2 devs, 70% efficiency | 9.8 | 90.0 (never below the critical-path floor of about 65.3) |
| 2 devs, 80% efficiency (assumed) | 11.2 | 78.7 (never below the critical-path floor of about 65.3) |
| 2 devs, 90% efficiency | 12.6 | 70.0 (never below the critical-path floor of about 65.3) |

Contingency matters as much as team size: using 1.0 instead of 1.2 removes about 21.0 sprints for one developer; using the high end of every size instead of the mid-point adds about 30.0 sprints.

### Calibrating the size scale

The largest uncertainty is how many days a size really takes (assumption A1). If actual effort is a fraction of the scale used here, the totals scale linearly:

| Actual effort as a share of the scale | Planning dev-days | Sprints, 1 dev | Sprints, 2 devs | Years, 1 dev |
| --- | --- | --- | --- | --- |
| 100% | 882 | 126.0 | 78.7 | 4.8 |
| 75% | 662 | 94.5 | 59.1 | 3.6 |
| 50% | 441 | 63.0 | 39.4 | 2.4 |
| 35% | 309 | 44.1 | 27.6 | 1.7 |

**How to recalibrate:** after the first two Foundation sprints, record the actual days for each finished story, divide by that size's mid-point (S 1.5, M 4, L 7.5, XL 12.5), and use the average ratio in place of 100% above.

## 7. Elapsed-time items that developer capacity cannot shorten

| Item | Elapsed time | Where | Note |
| --- | --- | --- | --- |
| Play closed test | 14 continuous days with 12 or more testers | `REL-04` | Starts at the first closed-test upload after Phase A; runs alongside sub-projects 3 to 7 |
| Google production-access review after the closed test | Not stated; outside the project's control | `REL-04` | The wait after the app is finished (OQ-61) |
| Google consent-screen brand verification | Not stated; outside the project's control | `REL-02` | Start as soon as the domain is live |
| DNS propagation and domain verification | Not stated | `SHR-02`, `REL-02` | The owner can change DNS now (VD-01) |
| Policy, terms and draft review by a qualified person | Not stated | `REL-10` | Owner task |
| Final artwork, screenshots, landing-page content | Not stated | `REL-12`, `REL-13`, `REL-14` | Owner-supplied (VD-11, VD-12) |

## 8. Largest stories (highest estimation risk)

| Story | Title | Size | Mid days |
| --- | --- | --- | --- |
| FND-AUTH-06 | Account merge: Move and switch | XL | 12.5 |
| DRV-03 | Drive client (native and web) | XL | 12.5 |
| DRV-10 | Restore: apply | XL | 12.5 |
| DRV-12 | Offline upload queue | XL | 12.5 |
| SHR-04 | Rules: invites and self-join | XL | 12.5 |
| SHR-14 | Receipt sharing sync | XL | 12.5 |
| REL-05 | Account deletion engine | XL | 12.5 |
| FND-PLT-01 | Project scaffold, identity and build guardrails | L | 7.5 |
| FND-DAT-02 | Complete Firestore schema and validation (zod) | L | 7.5 |
| FND-DAT-03 | Platform adapter contract and native adapter (Android) | L | 7.5 |
| FND-DAT-05 | Repository core: validated reads, local-first writes, subscriptions | L | 7.5 |
| FND-DAT-06 | userRepo and vehicleRepo | L | 7.5 |
| FND-DAT-08 | Shared export/import serializer | L | 7.5 |
| FND-SEC-01 | Rules: default deny, users and vehicles | L | 7.5 |
| FND-SEC-02 | Rules: entries, reminders and checklist templates | L | 7.5 |
| FND-AUTH-03 | Link Google (Android): mechanics and Account screen | L | 7.5 |
| FND-AUTH-08 | Sign-out | L | 7.5 |
| FND-SHL-02 | Navigation shell | L | 7.5 |
| FND-VEH-01 | Add a vehicle (including the first-vehicle empty state) | L | 7.5 |
| FND-VEH-04 | Delete a vehicle | L | 7.5 |
| FND-SET-02 | Settings | L | 7.5 |
| FND-OBS-04 | Pending-sync indicator and Sync issues | L | 7.5 |
| LOG-02 | Domain: fuel logic (two-of-three input and mileage) | L | 7.5 |
| LOG-04 | Entry form shell and Add sheet wiring | L | 7.5 |
| LOG-05 | Log a fuel fill-up | L | 7.5 |
| LOG-08 | Log a service visit with line items | L | 7.5 |
| LOG-10 | Log a manual trip | L | 7.5 |
| LOG-11 | History list | L | 7.5 |
| LOG-13 | Edit an entry | L | 7.5 |
| REM-01 | Domain: reminder logic | L | 7.5 |
| REM-03 | Local notification scheduling service | L | 7.5 |
| REM-05 | Create, edit and delete a reminder | L | 7.5 |
| REM-06 | Auto-complete and roll-forward on matching entries | L | 7.5 |
| RPT-02 | Domain: periods, distance and cost metrics | L | 7.5 |
| RPT-03 | Domain: section metrics | L | 7.5 |
| RPT-08 | Fuel section | L | 7.5 |
| RPT-12 | "All vehicles" report | L | 7.5 |
| RPT-13 | Per-vehicle Dashboard | L | 7.5 |
| DRV-06 | Backup file: build and read | L | 7.5 |
| DRV-07 | Backup & export screen and manual backup | L | 7.5 |
| DRV-09 | Restore: choose a backup and review | L | 7.5 |
| DRV-11 | Add receipt photos and PDFs to an entry | L | 7.5 |
| DRV-15 | CSV builder | L | 7.5 |
| SHR-02 | Hosting, domain and Android App Links | L | 7.5 |
| SHR-05 | Rules: leave, remove, ownership transfer and receipt-sharing updates | L | 7.5 |
| SHR-06 | Invite and membership repositories, and the invite code | L | 7.5 |
| SHR-08 | Join a vehicle by code | L | 7.5 |
| SHR-16 | Sharing verification: adversarial rules tests and multi-account flows | L | 7.5 |
| CHK-04 | Create, edit and delete a template | L | 7.5 |
| CHK-06 | Run an inspection | L | 7.5 |
| REL-01 | Release pipeline: EAS Build, Play tracks, signing, no OTA | L | 7.5 |
| REL-06 | Delete account in the app | L | 7.5 |
| REL-15 | Release verification and production rollout | L | 7.5 |

The XL stories (FND-AUTH-06, DRV-03, DRV-10, DRV-12, SHR-04, SHR-14, REL-05) are the least certain and the first candidates to split once work starts.

## 9. What would change these numbers

- **A different team size or focus factor** (section 6).
- **Overturned assumptions** among the 90 in the decision register, especially those in its section 0b (they add rules, fields or screens).
- **Spike outcomes:** `FND-VER-01`, `LOG-01`, `REM-02`, `RPT-01`, `DRV-01`, `DRV-02`, `SHR-01` and `SHR-03` can force design changes (a failed quota budget or `drive.file` result).
- **Native-module surprises** in Expo development builds, the Google Sign-In and Drive integrations, and notification delivery on real devices, the usual sources of rework in device-only code.
- **Scope:** the estimate covers the 138 stories as written; no new features.

## 10. Per-story sizes

| Story | Sub-project | Size | Wave | Kind | Title |
| --- | --- | --- | --- | --- | --- |
| FND-PLT-01 | Foundation | L | W1 | Architecture | Project scaffold, identity and build guardrails |
| FND-PLT-02 | Foundation | M | W1 | Architecture (setup) | Firebase project and Google OAuth configuration |
| FND-PLT-03 | Foundation | M | W2 | Architecture | Continuous integration pipeline |
| FND-DAT-01 | Foundation | M | W2 | Architecture | Domain: money and units |
| FND-DAT-02 | Foundation | L | W2 | Architecture | Complete Firestore schema and validation (zod) |
| FND-DAT-03 | Foundation | L | W2 | Architecture | Platform adapter contract and native adapter (Android) |
| FND-DAT-04 | Foundation | M | W3 | Architecture | Web adapter (Firebase JS SDK, online-only) |
| FND-DAT-05 | Foundation | L | W4 | Architecture | Repository core: validated reads, local-first writes, subscriptions |
| FND-DAT-06 | Foundation | L | W5 | Architecture | userRepo and vehicleRepo |
| FND-DAT-07 | Foundation | M | W5 | Architecture | entryRepo, reminderRepo, templateRepo, inviteRepo |
| FND-DAT-08 | Foundation | L | W6 | Architecture | Shared export/import serializer |
| FND-SEC-01 | Foundation | L | W3 | Architecture | Rules: default deny, users and vehicles |
| FND-SEC-02 | Foundation | L | W4 | Architecture | Rules: entries, reminders and checklist templates |
| FND-SEC-03 | Foundation | M | W5 | Verification | Rules: later-tab paths denied, matrix coverage and merge-path proof |
| FND-AUTH-01 | Foundation | M | W6 | User-facing | Android first launch: anonymous bootstrap and offline gate |
| FND-AUTH-02 | Foundation | M | W6 | User-facing | Web Google sign-in |
| FND-AUTH-03 | Foundation | L | W7 | User-facing | Link Google (Android): mechanics and Account screen |
| FND-AUTH-04 | Foundation | M | W8 | User-facing | Link triggers: banner, 5th-entry prompt, required-step gate |
| FND-AUTH-05 | Foundation | M | W8 | User-facing | Account conflict: detection and the three-way choice |
| FND-AUTH-06 | Foundation | XL | W9 | User-facing | Account merge: Move and switch |
| FND-AUTH-07 | Foundation | M | W10 | User-facing | Merge resume and discard ("Finish moving your data") |
| FND-AUTH-08 | Foundation | L | W8 | User-facing | Sign-out |
| FND-SHL-01 | Foundation | S | W8 | User-facing | Android welcome screen and first-run routing |
| FND-SHL-02 | Foundation | L | W3 | User-facing | Navigation shell |
| FND-SHL-03 | Foundation | M | W2 | Architecture | UI foundation: theme, dark mode and accessibility baseline |
| FND-SHL-04 | Foundation | M | W6 | User-facing | Vehicle switcher and selected-vehicle state |
| FND-VEH-01 | Foundation | L | W7 | User-facing | Add a vehicle (including the first-vehicle empty state) |
| FND-VEH-02 | Foundation | M | W8 | User-facing | Edit a vehicle (locked units) |
| FND-VEH-03 | Foundation | M | W8 | User-facing | Archive, unarchive and the Vehicles list |
| FND-VEH-04 | Foundation | L | W9 | User-facing | Delete a vehicle |
| FND-SET-01 | Foundation | M | W2 | Architecture | i18n scaffolding |
| FND-SET-02 | Foundation | L | W6 | User-facing | Settings |
| FND-OBS-01 | Foundation | S | W4 | User-facing | Per-screen error boundaries |
| FND-OBS-02 | Foundation | M | W5 | User-facing | Connectivity and quota behaviors |
| FND-OBS-03 | Foundation | M | W7 | User-facing | Access-denied and malformed-document behaviors |
| FND-OBS-04 | Foundation | L | W5 | User-facing | Pending-sync indicator and Sync issues |
| FND-OBS-05 | Foundation | M | W3 | Architecture | Crashlytics and privacy-safe error reporting |
| FND-VER-01 | Foundation | S | W2 | Spike | Spike: Firestore quota budget (gate G2) |
| FND-VER-02 | Foundation | M | W11 | Verification | Foundation end-to-end and manual verification pack |
| LOG-01 | Logging | S | W1 | Spike | Spike: quota budget for Logging operations (gate G2) |
| LOG-02 | Logging | L | W1 | Architecture | Domain: fuel logic (two-of-three input and mileage) |
| LOG-03 | Logging | M | W1 | Architecture | Domain: entry rules (service total, trip figures, odometer check, category lists |
| LOG-04 | Logging | L | W2 | Architecture | Entry form shell and Add sheet wiring |
| LOG-05 | Logging | L | W3 | User-facing | Log a fuel fill-up |
| LOG-06 | Logging | M | W4 | User-facing | Log EV charging |
| LOG-07 | Logging | M | W3 | User-facing | Log an expense |
| LOG-08 | Logging | L | W3 | User-facing | Log a service visit with line items |
| LOG-09 | Logging | M | W3 | User-facing | Log income |
| LOG-10 | Logging | L | W3 | User-facing | Log a manual trip |
| LOG-11 | Logging | L | W3 | User-facing | History list |
| LOG-12 | Logging | M | W4 | User-facing | History filters and search |
| LOG-13 | Logging | L | W5 | User-facing | Edit an entry |
| LOG-14 | Logging | M | W4 | User-facing | Delete an entry with Undo |
| LOG-15 | Logging | M | W6 | Verification | Airplane-mode logging flow and Foundation seams going live |
| REM-01 | Reminders | L | W1 | Architecture | Domain: reminder logic |
| REM-02 | Reminders | S | W1 | Spike | Spike: quota cost of reminder scheduling |
| REM-03 | Reminders | L | W2 | Architecture | Local notification scheduling service |
| REM-05 | Reminders | L | W2 | User-facing | Create, edit and delete a reminder |
| REM-04 | Reminders | M | W3 | User-facing | Reminders screen: list, status and quick-add suggestions |
| REM-07 | Reminders | M | W4 | User-facing | Mark done and Snooze |
| REM-06 | Reminders | L | W3 | User-facing | Auto-complete and roll-forward on matching entries |
| REM-08 | Reminders | S | W3 | User-facing | Notification permission |
| REM-09 | Reminders | S | W3 | User-facing | Per-vehicle mute |
| REM-11 | Reminders | M | W4 | User-facing | Recurring payment reminders open a pre-filled expense form |
| REM-10 | Reminders | M | W5 | User-facing | Dashboard "Upcoming & overdue" card |
| REM-12 | Reminders | M | W6 | Verification | Device verification of notifications and reminder flows |
| RPT-01 | Reports | S | W1 | Spike | Spike: quota budget for reports (gate G2) |
| RPT-02 | Reports | L | W1 | Architecture | Domain: periods, distance and cost metrics |
| RPT-03 | Reports | L | W2 | Architecture | Domain: section metrics |
| RPT-04 | Reports | M | W2 | Architecture | Report data loading and caching |
| RPT-05 | Reports | M | W3 | User-facing | Reports tab: scope, time range and layout |
| RPT-06 | Reports | M | W4 | User-facing | Overview section |
| RPT-07 | Reports | M | W4 | User-facing | Monthly spend and the chart foundation |
| RPT-08 | Reports | L | W5 | User-facing | Fuel section |
| RPT-09 | Reports | M | W5 | User-facing | Services and expenses section |
| RPT-10 | Reports | M | W5 | User-facing | Income and profit section |
| RPT-11 | Reports | S | W5 | User-facing | Trips section |
| RPT-12 | Reports | L | W6 | User-facing | "All vehicles" report |
| RPT-13 | Reports | L | W3 | User-facing | Per-vehicle Dashboard |
| RPT-14 | Reports | M | W7 | Verification | Report accuracy and cross-platform verification |
| DRV-01 | Drive | S | W1 | Spike | Spike: `drive.file` visibility across Android and web |
| DRV-02 | Drive | S | W1 | Spike | Spike: quota and cost of backup, restore, export and uploads |
| DRV-03 | Drive | XL | W2 | Architecture | Drive client (native and web) |
| DRV-04 | Drive | M | W3 | User-facing | Drive permission flow |
| DRV-05 | Drive | M | W3 | Architecture | Drive layout and per-vehicle receipt folders |
| DRV-06 | Drive | L | W2 | Architecture | Backup file: build and read |
| DRV-07 | Drive | L | W4 | User-facing | Backup & export screen and manual backup |
| DRV-08 | Drive | M | W5 | User-facing | Automatic backup and retention |
| DRV-09 | Drive | L | W5 | User-facing | Restore: choose a backup and review |
| DRV-10 | Drive | XL | W6 | User-facing | Restore: apply |
| DRV-11 | Drive | L | W4 | User-facing | Add receipt photos and PDFs to an entry |
| DRV-12 | Drive | XL | W5 | Architecture | Offline upload queue |
| DRV-13 | Drive | M | W6 | User-facing | View receipts and handle missing files |
| DRV-14 | Drive | M | W6 | User-facing | Receipt cleanup on delete |
| DRV-15 | Drive | L | W1 | Architecture | CSV builder |
| DRV-16 | Drive | M | W5 | User-facing | Export CSV from Backup & export |
| DRV-17 | Drive | M | W7 | Verification | Drive, receipts and export verification |
| SHR-01 | Sharing | S | W1 | Spike | Spike: members' access to each other's receipts under `drive.file` |
| SHR-02 | Sharing | L | W1 | Architecture (setup) | Hosting, domain and Android App Links |
| SHR-03 | Sharing | S | W1 | Spike | Spike: quota budget for sharing |
| SHR-04 | Sharing | XL | W1 | Architecture | Rules: invites and self-join |
| SHR-05 | Sharing | L | W1 | Architecture | Rules: leave, remove, ownership transfer and receipt-sharing updates |
| SHR-06 | Sharing | L | W2 | Architecture | Invite and membership repositories, and the invite code |
| SHR-07 | Sharing | M | W3 | User-facing | Invite a member |
| SHR-08 | Sharing | L | W3 | User-facing | Join a vehicle by code |
| SHR-09 | Sharing | M | W4 | User-facing | Invite links and the web join page |
| SHR-10 | Sharing | M | W3 | User-facing | Shared-vehicle visibility and the members list |
| SHR-11 | Sharing | M | W4 | User-facing | Leave a vehicle |
| SHR-12 | Sharing | M | W4 | User-facing | Remove a member |
| SHR-13 | Sharing | M | W4 | User-facing | Transfer ownership |
| SHR-14 | Sharing | XL | W2 | Architecture | Receipt sharing sync |
| SHR-15 | Sharing | M | W3 | User-facing | View other members' receipts |
| SHR-16 | Sharing | L | W5 | Verification | Sharing verification: adversarial rules tests and multi-account flows |
| CHK-01 | Checklists | M | W1 | Architecture | Domain: checklist logic |
| CHK-02 | Checklists | M | W2 | User-facing | Checklists screen |
| CHK-03 | Checklists | M | W3 | User-facing | Starter templates |
| CHK-04 | Checklists | L | W2 | User-facing | Create, edit and delete a template |
| CHK-05 | Checklists | M | W3 | User-facing | Copy a template to another vehicle |
| CHK-06 | Checklists | L | W3 | User-facing | Run an inspection |
| CHK-07 | Checklists | M | W4 | User-facing | Inspection photos tagged to items |
| CHK-08 | Checklists | M | W4 | User-facing | Summary and failed-item shortcuts |
| CHK-09 | Checklists | M | W4 | User-facing | Inspections in History |
| CHK-10 | Checklists | M | W5 | Verification | Checklists verification |
| REL-01 | Release | L | W1 | ops / content | Release pipeline: EAS Build, Play tracks, signing, no OTA |
| REL-02 | Release | M | W2 | ops / content | Google consent screen and OAuth publishing (gate G6) |
| REL-03 | Release | M | W3 | ops / content | Play Console setup and minimal declarations |
| REL-04 | Release | M | W4 | ops / content | Closed test and production access |
| REL-05 | Release | XL | W5 | Architecture | Account deletion engine |
| REL-06 | Release | L | W6 | User-facing | Delete account in the app |
| REL-07 | Release | M | W7 | User-facing | Resume and recover an interrupted deletion |
| REL-08 | Release | M | W6 | User-facing | "Delete all my data" for anonymous users |
| REL-09 | Release | M | W6 | User-facing | Web `/delete-account` page |
| REL-10 | Release | M | W2 | ops / content | Privacy policy and terms pages |
| REL-11 | Release | S | W6 | User-facing | About & privacy in the app |
| REL-12 | Release | M | W5 | ops / content | Web landing page |
| REL-13 | Release | S | W1 | ops / content | App icon, adaptive icon and splash screen |
| REL-14 | Release | M | W7 | ops / content | Full Play listing and declarations |
| REL-15 | Release | L | W8 | Verification and release operations | Release verification and production rollout |
