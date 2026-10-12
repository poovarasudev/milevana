# FND-VER-02 — Foundation manual verification checklist

Run record for the checks Maestro cannot drive (Google sign-in dialogs,
emulator back-end mutations, OS font scaling). Fill the Result column per run;
link a bug or notes for anything that fails.

**Prerequisites**

- Android dev build installed (`dev.poovarasu.milevana`), emulator or dev
  Firebase project configured via `EXPO_PUBLIC_*`.
- A test Google account **with no Milevana data** and a second one **with
  existing data** (for the conflict merge).
- Web build served from the same Firebase project (`npx expo start --web`).

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Fresh install offline → "Connect to get started" → go online → app continues without restart | AC-F1, FR-AUTH-05 | Not run — device |
| 2 | Anonymous first launch → Welcome → add vehicle → vehicle in switcher and on `vehicles` list | AC-F1, AC-F2 | Pass (web: Google sign-in via Auth emulator + vehicle create + switcher/list) |
| 3 | Link Google (test account, no data) → name/email fill owner member record; entry authors become the Google name | AC-F3, AC-D4, DR-02 | Partial (web) — emulator Google sign-in fills owner record; link-anonymous path is native |
| 4 | Link Google → account-conflict dialog → **Move and switch** → anonymous vehicles/entries appear under the Google account (web shows them too) | AC-F3, AC-D5, AC-D6 | Not run — owner-only |
| 5 | Same flow → **Switch without moving** shows the unrecoverable warning, then switches; anonymous data remains on the old account | AC-D5, DR-16 | Not run — owner-only |
| 6 | Same flow → **Cancel** → nothing changed; the anonymous session continues | FR-MERGE-07 | Not run — owner-only |
| 7 | Kill the app mid-merge (e.g. right after choosing "Move and switch") → relaunch → "Finish moving your data" → Resume completes; Discard (two steps) clears it | AC-D6, FR-MERGE-10 | Not run — device |
| 8 | Fifth logged entry (across vehicles) → link prompt appears once; "Not now" never shows it again, More banner remains | FR-LINK-01/08, DR-09 | Not run |
| 9 | Web smoke: sign in with the linked account → same vehicles; pull the network offline → offline banner; writes are refused with timeout | AC-F4 | Pass (web) |
| 10 | Dark mode (Settings → Theme) and system font scaling → all screens legible, no clipped 48 dp targets | AC-D17 | Partial (web) — dark theme verified on web (screenshot 20-dark-theme.png); OS font scaling device-only |
| 11 | Test crash (Account → diagnostics) appears in Crashlytics; a triggered non-fatal carries no uid/names/plates in the console | AC-F7, AC-D13, PRV-03 | Not run — owner-only |
| 12 | Sign out with pending writes → dialog offers Wait & sync / Discard; Discard signs out and wipes device-local flags | AC-D23, FR-OUT-04/05, G5 | Not run |
| 13 | Delete a vehicle while online → typed-name confirmation required; owner-only and shared warnings correct | AC-F2, DR-14 | Not run |
| 14 | Airplane mode → vehicle add/edit/archive/delete queue → reconnect → server matches (Maestro flow 2) | AC-F2 | Not run — device |
| 15 | Edit a vehicle that has entries → odometer unit, currency and start odometer are locked | DR-01 | Pass (web) |

**Maestro flows**

- `.maestro/foundation-first-launch.yaml` — first launch → add vehicle →
  settings change persists across restart (SC-VER02-01).
- `.maestro/foundation-offline-lifecycle.yaml` — airplane-mode vehicle
  lifecycle (SC-VER02-02). `setAirplaneMode` needs Maestro ≥1.39; otherwise
  toggle airplane mode manually at the marked steps.

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
| 2026-10-10 | web dev (expo start --web, Metro :8081) | Devin — Chrome CDP via scripts/webcdp.mjs, Auth+Firestore emulators | See per-row results | Web-only pass per user direction; device rows remain for manual Expo run. Screenshots in docs/device-runs/2026-10-10/ |
