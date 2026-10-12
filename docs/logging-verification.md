# LOG-15 — Logging verification checklist

Manual run record for the checks Maestro cannot drive (web offline, seeded
malformed documents, second-member authority, the 5th-entry link prompt).
Fill the Result column per run; link a bug or notes for anything that fails.

**Prerequisites**

- Android dev build installed (`dev.poovarasu.milevana`), Firebase emulator or
  dev project configured via `EXPO_PUBLIC_FIREBASE_*`.
- A second test account that can be added as a member of the test vehicle
  (seed `memberIds`/`members.<uid>` via the emulator UI for the read-only
  rows — sharing UI lands in tab 6).
- Web build served from the same project (`npx expo start --web`).

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Maestro `.maestro/logging-airplane-mode.yaml`: fuel, EV charge, expense, service, income, trip logged offline; after reconnect the entries reach the server and no Sync issues banner shows | TS-06, PR-03 | Not run — device |
| 2 | Fifth logged entry across two vehicles → link prompt appears once; "Not now" dismisses it forever; the More banner stays | FR-LINK-01, DR-09 | Not run |
| 3 | After the first entry, the vehicle's odometer unit, currency and start odometer are read-only in Edit vehicle | AC-D7 | Pass (web) |
| 4 | Seed one malformed entry doc (emulator UI) → History shows "1 entry couldn't be shown" and the row is absent | AC-D12 | Not run |
| 5 | Reject a queued write (e.g. archive the vehicle server-side while the app is offline, then log an entry) → after reconnect the row shows the warning state and Sync issues lists it | AC-D24 | Not run — device |
| 6 | Web: pull the network offline → the offline banner shows and Save is disabled on every form; online again → Save works | FR-WEB-*, FR-ERR-07 | Pass (web) |
| 7 | Member opens another member's entry → read-only banner, no Save/Delete; owner opens it → editable and deletable | LD-13, SC-LOG13-03 | Not run — owner-only |
| 8 | Select an archived vehicle's entry (deep link or entry open while archiving) → read-only; Add unavailable for archived vehicles | DR-13, SC-LOG04-06 | Not run |
| 9 | Delete an entry → snackbar "Entry deleted" with Undo for ~5 s; Undo restores the row; without Undo the entry is gone after reconnect; `lastOdometer` recomputes | LD-12 | Partial (web) — edit-screen Delete verified; Undo snackbar window not exercised |
| 10 | Background the app inside the Undo window → the delete commits without waiting | LD-12 | Not run |
| 11 | Add/edit/delete the entry holding the max odometer → `lastOdometer` tracks the new max or falls back to the start odometer | DR-01, OQ-17 | Partial (web) — lastOdometer tracked 500→600→700 on fills |
| 12 | Enter an out-of-order odometer → inline warning text but Save still works | LD-05 | Not run |
| 13 | Fuel: two-of-three derivation (quantity+price→total etc.), mileage shows on a second full fill's History row, `missedPrevious` suppresses it | LD-01/03 | Pass (web) |
| 14 | Service: 0 lines blocked, 21st line not offered, Other line needs a label, total = lines + labour − discount floored at 0 | LD-08 | Not run |
| 15 | History filters (type chips, date range) and search (notes/category/station/platform/from-to; amounts never match) hit the loaded set only — airplane mode proves no reads | LD-11/12 | Partial (web) — chips/search render on web; airplane-mode part device-only |
| 16 | Pull-to-refresh after a server-side change → row appears | FR-OFF-12 | Not run |
| 17 | Inspection tile opens the placeholder (out of scope for Logging) | SC-LOG04-01 | Pass (web) — inspection tile opens |

**Maestro flows**

- `.maestro/logging-airplane-mode.yaml` — airplane-mode entry logging +
  reconnect (TS-06). `setAirplaneMode` needs Maestro ≥1.39; otherwise toggle
  airplane mode manually at the marked steps.

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
| 2026-10-10 | web dev (expo start --web, Metro :8081) | Devin — Chrome CDP via scripts/webcdp.mjs, Auth+Firestore emulators | See per-row results | Web-only pass per user direction; device rows remain for manual Expo run. Screenshots in docs/device-runs/2026-10-10/ |
