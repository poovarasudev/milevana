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
