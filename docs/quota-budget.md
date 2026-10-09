# FND-VER-01 — Firestore quota budget (gate G2)

Threshold (DR-20): the projection at **500 daily active users** must be at most
**25,000 reads/day** and **10,000 writes/day** — half of the Spark plan's
50,000 read / 20,000 write free quotas. There is no Blaze fallback (RK-25),
so an overrun pauses sync for everyone until the daily reset.

## Method

Counts are per Firestore document operation (reads include `get()` calls the
rules make for `vehicleData(vid)` on every child write — RK-04). The counts
below were taken by tracing each repository path in `src/data/repos/` and
verified against the emulator suite (`repos.emulator.test.ts`), which runs
every listed operation against real rules.

Session model assumed for the projection: 500 DAU, each with 2 vehicles and
~40 stored entries total, ~6 logged entries/day, Android-first (durable cache,
cache-first reads, listener deltas only after the initial snapshot).

## Per-operation counts

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Cold start (existing user, V vehicles) | 1 + V | 0 | `users/{uid}` watch + `vehicles` member query. Entry watches only while anonymous, capped at 5 docs/vehicle (see below). |
| First launch (new anonymous user) | 1 | 1 | `ensureUser` create. |
| 5th-entry link-prompt watches (anonymous only) | ≤ 5 × V | 0 | `linkPrompt.syncEntryWatch` subscribes `limit 5` per vehicle; linked users never pay this. |
| Add vehicle | 0 | 1 | Single `setDoc`. |
| Edit vehicle | 1 | 1 | `mustGet` + `updateDoc`. |
| Archive / unarchive | 1 | 1 | `mustGet` + `updateDoc`. |
| Delete vehicle with N children | 1 + ⌈N/500⌉ pages per subcollection | 1 + N | Children drained in ≤500-op batches, parent last (DR-14). N=100 → 4 batch commits, 101 writes. |
| Log an entry (fuel/expense/…) | 1 | 1 or 2 | Entry `set` + `vehicles.lastOdometer` update only when the odometer advances (FR-OFF-01). |
| Edit entry | 2 | 2 | `mustGet` + `updateDoc` + possible lastOdometer recompute write. |
| Settings change | 1 | 1 | `getUser` + `updateDoc` merge. |
| Account merge: 1 vehicle + N entries | 1 + N (export) | 1 + ⌈(1+N)/500⌉ commits | Vehicles first, then children; ≤500 ops/batch (FR-MERGE-05). |
| Manual refresh | 1 + V | 0 | Same as cold start without auth. |

## Daily projection (500 DAU)

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| Session starts (2 starts/user/day) | 500 × 2 × 3 = 3,000 | 0 |
| Entry logging (6 entries/day) | 500 × 6 × 1 = 3,000 | 500 × 6 × 2 = 6,000 |
| Vehicle edits/archives (0.2/user/day) | 500 × 0.2 × 2 = 200 | 100 |
| Entry edits/deletes (1/user/day) | 500 × 1 × 2 = 1,000 | 1,000 |
| Settings changes (0.1/user/day) | 50 | 50 |
| Anonymous link-prompt watches (amortized — only while <5 entries) | ~500 | 0 |
| **Total** | **≈ 7,750** | **≈ 7,150** |

At 100 DAU the same model gives ≈ 1,550 reads and ≈ 1,430 writes.

## Verdict

**PASS.** 7,750 reads < 25,000 and 7,150 writes < 10,000 at 500 DAU — roughly
31% and 72% of the DR-20 budget. The binding resource is writes; the model
leaves ~28% headroom. No query changes recommended.

Watch items for later tabs: entry *list* growth (tab 2 history paging),
reminder evaluation frequency, and invite/member queries (sharing phase).
This budget covers Foundation operations only, per the story scope.

## Gate status (G2)

DAT-05, DAT-06 and DAT-07 may be marked accepted: the projection passes DR-20.

---

# LOG-01 — Logging quota budget (gate G2, tab 2)

Same method and threshold (DR-20: ≤ 25,000 reads and ≤ 10,000 writes/day at
500 DAU). The numbers below replace the Foundation model's placeholder
entry-logging line and add History reads; counted from the repository paths
in `src/data/repos/entryRepo.ts` and verified by `repos.emulator.test.ts`.

Model: 500 DAU, 2 vehicles each, ~100 lifetime entries per vehicle,
~6 entries logged/user/day, 2 sessions/day. History loads ALL of a vehicle's
entries in ONE watch (LD-10) — that is the recommendation this budget
supports.

## Per-operation counts (Logging)

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Add entry | 2 | 1–2 | `mustGetVehicle` + rules `vehicleData` get (RK-04); entry `set` + `vehicles.lastOdometer` only when the odometer advances (FR-OFF-01). Trip start odometer never counts — the entry carries the END reading (LD-09). |
| Edit entry | 3 | 1–2 | `safeGet` entry + rules get + top-odometer query; entry `setDoc` (+ vehicle update only when the max changed). |
| Delete entry | 3 | 1–2 | `mustGetVehicle` + rules get + top-odometer query; `deleteDoc` (+ vehicle update when the max went away). |
| History watch attach (warm) | ≈ changed docs | 0 | Snapshot listeners serve the durable cache first; billed reads are deltas only — typically the day's new entries. |
| History cold open (fresh install / cache miss) | N | 0 | One full scan per vehicle per fresh install — 100 entries → 100 reads. Not a daily cost for an installed app. |
| Pull-to-refresh | N | 0 | `getDocs(source:'server')` reads all N entries — the only operation whose billed cost scales with list size per call. User-initiated only; the app never auto-refreshes (recommendation below). |
| Filters + search | 0 | 0 | In-memory over the loaded set (OQ-45) — verified by `filterEntries`/`entryMatchesQuery` tests; no query is re-issued. |
| Vehicle switch → new watch | ≈ deltas | 0 | Same cache-first attach semantics as History warm attach. |

## Daily projection (500 DAU)

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| Entry creates (6/user/day) | 500 × 6 × 2 = 6,000 | 500 × 6 × 1.5 ≈ 4,500 |
| Entry edits (1/user/day) | 500 × 3 = 1,500 | 500 × 1.5 ≈ 750 |
| Entry deletes (0.2/user/day) | 300 | ~120 |
| Watch deltas (own/other-device writes: ~2 docs × 2 vehicles × 2 sessions) | 4,000 | 0 |
| Pull-to-refresh (0.1/user/day × 100 docs) | 5,000 | 0 |
| Cold opens amortized (~2% of DAU reinstall/day × 200 docs) | 2,000 | 0 |
| Filters/search | 0 | 0 |
| **Logging total** | **≈ 18,800** | **≈ 5,370** |
| **Foundation non-entry ops (sessions, vehicles, settings, link prompt)** | **≈ 3,750** | **≈ 150** |
| **Combined** | **≈ 22,600** | **≈ 5,520** |

## Verdict

**PASS.** ≈22,600 reads (< 25,000, ~90% of budget) and ≈5,520 writes (< 10,000,
~55%) at 500 DAU. Reads are the binding resource, and the single lever is the
per-refresh cost N.

**Recommendation (applied in LD-10/FR-OFF-12):** History loads every entry in
one watch with month grouping client-side (D2), filter and search never touch
the network, and refresh stays pull-to-refresh only — no automatic re-fetch on
tab focus or watch re-attach. If a vehicle ever approaches ~5,000 entries,
revisit paging before raising the budget.

Gate G2 for tab 2 may be marked satisfied.

---

# REM-02 — Reminders quota spike (gate G2, tab 3)

Same method and threshold (DR-20: ≤ 25,000 reads and ≤ 10,000 writes/day at
500 DAU). Counted from `src/features/reminders.ts`, `src/data/repos/reminderRepo.ts`
and `src/data/repos/entryRepo.ts` (`watchSince`). Scheduling itself is local —
a rebuild cancels and recreates OS notifications and bills nothing; the costs
below are the watches that feed it and the writes it triggers.

Model: 500 DAU, 2 vehicles each, ≤10 reminders/vehicle (cap 50, RD-09), ~half
the non-selected vehicles carrying an odometer reminder (so their 90-day
entries window is watched), 2 sessions/day, ~0.2 reminder CRUD ops,
~0.15 matching-entry completions and ~0.02 mute toggles per user per day.

## Per-operation counts (Reminders)

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| App-open scheduling (rebuild) | 0 | 0 | Pure local: cancels + recreates OS notifications from the read model. No Firestore call. |
| Reminders watch attach per vehicle (warm) | ≈ changed docs | 0 | Cache-first resume; reminder docs change ≈0.35/vehicle/day (CRUD + completions). Cold attach bills the reminder count (≤50). |
| Prediction window watch (`watchSince`, non-selected vehicle with an odometer reminder) | ≈ window deltas | 0 | Bills only entries in the 90-day window, deltas after first attach. The selected vehicle's window is already paid for by the History watch — no second listen. |
| Reminder create | 1 | 1 | Rules `vehicleData` get on the write (RK-04) + `setDoc`. |
| Reminder update / delete | 2 | 1 | `safeGet` + rules get + one `setDoc`/`deleteDoc`. |
| Entry logged, matching reminder | 2 | 1 | Completion write on top of the entry write counted under Logging: `reminders.update` = `get` + rules get + `setDoc`. |
| Dashboard card / Reminders list render | 0 | 0 | Reads the watch-driven read model only. |
| Mute toggle | 1 | 1 | `getUser` + `updateDoc` settings merge (FR-SET-07). |
| Sign-out clear | 0 | 0 | Local `clearAll` only. |

## Daily projection (500 DAU)

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| Reminders watch deltas (0.35 docs × 2 vehicles × 500 users) | 350 | 0 |
| Odometer window deltas (1 entry/day × ~500 non-selected odo-reminder vehicles) | 500 | 0 |
| Cold attaches amortized (2% reinstall/day × ~80 docs: 20 reminders + 60 window entries) | 800 | 0 |
| Reminder CRUD (0.2/user/day) | 200 | 100 |
| Auto-complete writes (0.15/user/day) | 150 | 75 |
| Mute toggles (0.02/user/day) | 10 | 10 |
| **Reminders total** | **≈ 2,000** | **≈ 185** |
| **Logging + Foundation carry-over** | **≈ 22,600** | **≈ 5,520** |
| **Combined** | **≈ 24,600** | **≈ 5,700** |

At 100 DAU the same model gives ≈ 5,000 reads and ≈ 1,150 writes.

## Verdict

**PASS, marginal on reads.** ≈24,600 reads (~98% of the 25,000 DR-20 budget)
and ≈5,700 writes (~57%) at 500 DAU. Reads are the binding resource; the
single reminder-side driver is the second entries listen (`watchSince`) on
non-selected vehicles with an odometer trigger.

**Watch items / levers if the projection is ever exceeded:** attach the
90-day window only while the Reminders screen or a pending rebuild actually
needs a prediction (currently it stays live for the session); skip the window
listen when `lastOdometer` is already inside the lead distance (odoNow needs
no prediction); cap the per-vehicle reminder count below 50. No change is
recommended at the current numbers.

Gate G2 for tab 3 may be marked satisfied: REM-03 is acceptable.

---

# RPT-01 — Reports quota spike (gate G2, tab 4)

Same method and threshold (DR-20: ≤ 25,000 reads and ≤ 10,000 writes/day at
500 DAU). Counted from `src/features/reportData.ts`, `src/features/entries.ts`
and `src/data/repos/entryRepo.ts` (`watch`/`refresh`). Reports are read-only:
they add no writes of their own; every cost below is a read.

Model: 500 DAU, 2 vehicles each, ~100 lifetime entries per vehicle,
~6 entries logged/user/day, 2 sessions/day. Reports opened ~0.3 times per
user per day (secondary tab); the "All vehicles" scope — the only scope that
adds listens — ~0.1 opens/user/day; pull-to-refresh ~0.02/user/day
(the live watch already streams changes, so refresh is rare); ~2% of DAU
reinstalls/clears cache daily.

## Per-operation counts (Reports)

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Per-vehicle report open / Dashboard open | 0 | 0 | The selected vehicle reuses the one shared session entry watch (PD-10); Reports, History and Dashboard read the same loaded set — opening a report bills nothing new. |
| Range change (all six ranges, custom included) | 0 | 0 | In-memory recompute over the loaded set; verified by `reportData`/UI tests — no query is issued. |
| "All vehicles" attach, per extra vehicle (warm) | ≈ changed docs | 0 | Cache-first resume bills deltas only; vehicles load strictly one at a time and failed vehicles are skipped without blocking the rest (RPT-12). |
| "All vehicles" attach (cold — fresh install / web reload) | N per extra vehicle | 0 | ~100 docs per vehicle, once per fresh install/web reload that opens the scope. |
| Report watch live while open | ≈ entry deltas | 0 | Changes from another device or member stream through the open listener (PD-10) — billed once per changed doc per listener. |
| Pull-to-refresh on Reports | N per scope vehicle | 0 | `entries.refresh` = `getDocs(source:'server')`; user-initiated only, never automatic. |
| Archived vehicle report (`?vehicle=` deep link) | ≈ warm attach / N cold | 0 | Same one-vehicle listen as any non-selected scope vehicle. |
| Malformed/failed vehicle | ≈ failed attach | 0 | Skip + per-vehicle notice; no retries, so no read amplification. |

## Daily projection (500 DAU)

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| All-vehicles warm attaches (0.1 opens × ~5 delta docs × 500 users) | 250 | 0 |
| Watch deltas on extra vehicles while reports are open (~2 docs × 0.1 × 500) | 100 | 0 |
| Cold attaches amortized (2% reinstall × ~50% scope users × 100 docs) | 500 | 0 |
| Pull-to-refresh (0.02/user/day × ~120 docs average scope) | 1,200 | 0 |
| Per-vehicle opens, Dashboard opens, range changes | 0 | 0 |
| **Reports total** | **≈ 2,050** | **0** |
| **Foundation + Logging + Reminders carry-over** | **≈ 24,600** | **≈ 5,700** |
| **Combined** | **≈ 26,650** | **≈ 5,700** |

At 100 DAU the same model gives ≈ 5,300 reads and ≈ 1,150 writes.

## Verdict

**FAIL on reads, marginal; PASS on writes.** ≈26,650 reads is ~107% of the
25,000 DR-20 share (≈53% of the actual 50,000-read Spark quota) at 500 DAU;
writes stay ≈5,700 (~57%). At 100 DAU the projection is ≈5,300 reads —
comfortably inside.

The breach is driven by the carry-over already sitting at ~98% of the share
before Reports: essentially any non-trivial reads push past 25k. Within
Reports the dominant term is the N-scaled pull-to-refresh (~1,200/day);
attaches and deltas are small because the shared-set design (PD-10) makes the
common case — per-vehicle report, dashboard, every range change — cost zero
extra reads.

**Recommendation (implemented in RPT-04/RPT-12, `src/features/reportData.ts`):**
one loaded entry set per vehicle shared between Reports, History and
Dashboard (single hook, loaded once); extra vehicles attach lazily, strictly
in turn, only while an All-vehicles/archived report is mounted, and stop on
unmount; refresh stays pull-only; range changes never touch the network. No
cheaper design exists on Spark without giving up required report detail —
aggregate counters can't produce the per-fuel/per-category/per-platform
breakdowns the stories need, and paging a report is deferred by PD-10 until a
vehicle nears ~5,000 entries.

**Levers if the owner wants the projection under the share:** re-weigh
DR-20's 50% policy share against real telemetry (the hard cap is 50k);
attach an aggregate/counter doc per vehicle (adds one write per entry — write
headroom exists — but loses the breakdowns); or accept it and re-check with
production usage numbers before v1 launch.

Gate G2 for tab 4 does not pass cleanly at this model: RPT-04 and RPT-12 are
recorded as implemented to the cheapest available design with the marginal
breach flagged for re-check on real telemetry.
