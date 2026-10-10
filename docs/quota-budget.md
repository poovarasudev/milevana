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

---

# DRV-02 — Drive, backup, restore and export quota budget (gate G2, tab 5)

Same method and threshold (DR-20: ≤ 25,000 reads and ≤ 10,000 writes/day at
500 DAU). Session model unchanged: 2 vehicles/user, ~40 stored entries,
~6 logged/day, Android-first with a durable cache. Drive API calls and
AsyncStorage queue/cache writes are outside Firestore quota and are not
counted.

## Per-operation counts

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Manual backup (V vehicles, N entries, R reminders, T templates) | 1 + V + N + R + T cold; ≈0 warm | 1 | `getUser` (folder ids) + `listOwned` + full subcollection scans — all served from the durable cache after the first run; the single write is the `drive` map merge (`lastBackupAt`, folder ids). |
| Automatic backup | same as manual | 1 | At most once per interval (default weekly; 0.14/user/day). `maybeRunAutomaticBackup` itself costs 1 `getUser` + 1 local flag read per app open — negligible. |
| Restore (V vehicles, N+R+T children restored) | 1 + V + (N + R + T) merge-scan + (N + R + T) rules gets | V + N + R + T + 1 | `listOwned` + per-vehicle child lists for keep/replace merge; each child write bills the `vehicleData(vid)` rules read. Commits batch ≤500 ops (OQ-35). Settings patch is one `updateDoc`. |
| CSV export, one vehicle | 1 + E_v cold; ≈0 warm | 0 | `vehicles.get` + `entries.list`. |
| CSV export, all vehicles | V + N cold; ≈0 warm | 0 | Same reads as a backup minus the user doc. |
| Receipt upload status write | 2 | 1 | `entries.get` + `vehicleData` rules read + `updateDoc` merge (status/driveFileId/uploaderUids). At most 2 updates per receipt (queued → uploaded/failed). |
| Pending Drive delete retry | 0 | 0 | Local flag queue + Drive API calls only. |
| Restore review (no apply) | 1 + V + (N + R + T over vehicles present both sides) | 0 | `reviewBackup` diffs child sets for vehicles that exist locally to classify `same`/`differs`; `missing`/`not-yours` vehicles cost no child reads. |

## Daily projection (500 DAU)

Assumptions: automatic backup weekly by default (≈0.14 run/user/day) plus
occasional manual backups (≈0.06/user/day) → 0.2 backup runs/user/day, warm
cache; restores are rare (≈1% of users/day, new-device flow) with the
session-model 40 entries + ~5 reminders/templates; CSV export ≈0.1/user/day
warm; ≈0.5 receipt uploads/user/day.

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| Backups (0.2/user/day, warm) | ≈0 billed (cache) + 500 × 0.2 × 1 getUser = 100 | 500 × 0.2 × 1 = 100 |
| Restores (5/day, ≈90 reads + 48 writes each) | ≈450 | ≈240 |
| CSV export (0.1/user/day, warm; cold worst ≈+2,050) | ≈200 | 0 |
| Receipt status writes (0.5/user/day × 2 updates worst case) | 500 × 0.5 × 2 × 2 = 1,000 | 500 × 0.5 × 2 = 500 |
| **Drive-phase total** | **≈ 1,750** | **≈ 840** |
| **Foundation + Logging + Reminders + Reports carry-over** | **≈ 26,650** | **≈ 5,700** |
| **Combined** | **≈ 28,400** | **≈ 6,540** |

At 100 DAU the Drive-phase increment is ≈ 350 reads and ≈ 170 writes
(combined ≈ 5,650 / ≈ 1,320).

## Verdict

**Drive-phase increment: PASS** — ≈1,750 reads / ≈840 writes/day at 500 DAU
is well under any reasonable share; backups and exports are cache-first by
design (they reuse the warm entry set, so steady-state billing is near zero)
and restores amortize to a handful of users per day.

**Combined: still fails reads, marginally.** ≈28,400 is ~114% of the 25,000
DR-20 share, driven by the pre-existing ~98% carry-over entering Reports —
the DRV increment adds ~6% of that share. Writes stay ≈6,540 (~65%).

Per DRV-02 AC #3, DRV-08 and DRV-10 depend on this gate. The breach is the
same one recorded under RPT-01 (carry-over, not a Drive regression); DRV-08
and DRV-10 are recorded as implemented with the flag carried forward — the
recommended re-check is production telemetry before v1 launch, and the
levers listed under RPT-01 (re-weighing the DR-20 share against real usage,
or an aggregate doc) remain the available moves.

Gate G2 for tab 5 does not pass cleanly at this model: DRV-08 and DRV-10 are
recorded as implemented with the marginal breach flagged for re-check on
real telemetry.

---

# SHR-03 — Sharing quota budget (gate G2, tab 6)

Same method and threshold (DR-20: ≤ 25,000 reads and ≤ 10,000 writes/day at
500 DAU). Session model unchanged; Drive API permission calls are outside
Firestore quota and are not counted. Counted from `src/data/repos/inviteRepo.ts`,
`src/data/repos/vehicleRepo.ts` membership ops, `src/data/repos/entryRepo.ts`
(`listUploadedBy`) and `src/features/receiptShare.ts`.

Model additions: 30% of users belong to a shared vehicle (~150 uploaders —
members who upload receipts — active/day); each shared vehicle averages
~15 entries carrying the uploader's attachments; ~10 invites created, ~8
joins, ~5 membership changes fleet-wide per day; the receipt share sync runs
≈4 times/day per active uploader (app open + foreground returns, bounded by
the 15-minute per-vehicle throttle in SD-08).

## Per-operation counts (Sharing)

| Operation | Reads | Writes | Notes |
| --- | --- | --- | --- |
| Invite create | 1 | 1 | Rules `vehicleData` read + `invites/{code}` set. Collision retry ≤5 (SD-02) is rare and bounded. |
| Invite get by code | 2 | 0 | `getDoc` + rules `vehicleData` existence check (SD-01; deleted vehicle → denied → "no longer exists"). |
| Owner pending-invite list | ≤ 10 | 0 | `ownerId ==` query, vehicleId filtered client-side; capped by the 5-pending limit plus stragglers. |
| Invite cancel | 1 | 1 | Rules existence read + `deleteDoc`. |
| Join (atomic) | 3 | 2 | Rules read invite + vehicle + request resource; batch writes `members[uid]` + `memberIds` union and `usedBy/usedAt`. Inside OQ-35's write-read limit. |
| Leave / remove / transfer | 2 | 1 | Rules `vehicleData` get + one vehicle `updateDoc`. |
| Share sync run per vehicle | N_up | 0–1 per changed entry | `uploaderUids array-contains` worklist (N_up = entries with the caller's uploads, ~15). `sharedWithUids` writes only when the grant set changed; each entry write bills entry + vehicle rules gets. |
| Members list / switcher count | 0 | 0 | Reads the watched vehicle read model — no extra query (SHR-10). |
| 'Open in Drive' tap | 0 | 0 | A URL open; the Drive permission is checked by Google, not Firestore. |

## Daily projection (500 DAU)

| Driver | Reads/day | Writes/day |
| --- | --- | --- |
| Share sync (150 uploaders × 4 runs × ~15 docs) | ≈ 9,000 | 0 |
| `sharedWithUids` updates (~50 entry writes × 2 rules reads) | 100 | 50 |
| Invites (10 creates, 8 joins, 12 lookups, 3 cancels, ~40 pending-list loads) | ≈ 450 | ≈ 25 |
| Membership changes (5/day) | 10 | 5 |
| **Sharing total** | **≈ 9,560** | **≈ 80** |
| **Carry-over (FND + LOG + REM + RPT + DRV)** | **≈ 28,400** | **≈ 6,540** |
| **Combined** | **≈ 37,960** | **≈ 6,620** |

At 100 DAU the sharing increment is ≈ 1,900 reads and ≈ 16 writes
(combined ≈ 7,550 / ≈ 1,340).

## Verdict

**Sharing increment: bounded by design, but the combined projection FAILS
reads.** ≈9,560 reads/day at 500 DAU — the dominant term is the share sync's
`uploaderUids` worklist read per run, already held down by the SD-08
15-minute throttle and the 200-receipt cap. Combined reads ≈37,960
(~152% of the DR-20 share, ~76% of the actual 50,000-read Spark quota);
writes ≈6,620 (~66% of the share) stay inside.

The breach compounds the carry-over recorded under RPT-01/DRV-02 — the
pre-existing model was at ~114% of the share before Sharing. Per SHR-03
AC #3, SHR-14 is recorded as implemented to the cheapest available design
(cache-first everywhere else; sync is native-only, member-only, throttled)
with the flag carried forward.

**Levers if reads must drop:** skip the worklist query when the vehicle's
`updatedAt` is unchanged since the last run (entries churn bumps it);
persist a per-vehicle "nothing changed" marker after a clean run and skip
the next query until the vehicle watch reports a delta; or push the run
interval above 15 minutes. The first is a one-field comparison and is the
recommended follow-up — it would cut the dominant term when nothing moved.

Gate G2 for tab 6 does not pass cleanly at this model: SHR-14 is recorded
as implemented with the marginal breach flagged for re-check on real
telemetry.
