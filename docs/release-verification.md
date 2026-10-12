# REL-15 — Release verification and production rollout

The release-level manual checklist (AC-R2/AC-R3/AC-R4/AC-R5) runnable by
someone other than the author. Record each run in
`docs/release-runs/<tag>.md` (see `docs/release-runs/TEMPLATE.md`) — the
release workflow refuses an unrecorded tag.

**Prerequisites**

- Release candidate installed from the internal/closed track (REL-01/03).
- A second Android device or browser profile with a different Google account.
- One install that has never linked Google (anonymous user with data).
- `https://milevana.poovarasu.dev` deployed (Hosting + rewrites).

## 1. Feature completeness (AC-R3)

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Review each sub-project's Definition of Done (sub-projects 1–7): every item met, or deferred **in writing** by the owner. | SC-REL15-01 | Not run — owner-only |

## 2. Manual release checklist (AC-R2)

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 2 | Run every `.maestro/*.yaml` flow on the release candidate and record the outcome in the run file. | SC-REL15-02 | Not run — device |
| 3 | Account-conflict merge: anonymous data moves into a Google account; cancel path leaves both untouched. | per `auth.test.ts` flows, manual pass | Not run — owner-only |
| 4 | Web smoke test on `milevana.poovarasu.dev`: sign in, add an expense, verify it syncs to the Android app. | FR-WEB-01 | Not run — owner-only |
| 5 | Dark mode and font scaling: switch the theme in Settings and the OS font size; no clipped or unreadable text. | FND-SET-02, NFR-06 | Partial (web) — dark mode verified on web; font scaling device-only |
| 6 | Each earlier sub-project's `docs/*-verification.md` checklist run recorded as pass or linked to a bug. | TS-06/TS-07 | Partial (web) — this file + the 7 checklists updated with web results |

## 3. Live routes (AC-R4)

Open each in a signed-out browser and a signed-in browser:

| # | Route | Expected | Covers | Result |
|---|-------|----------|--------|--------|
| 7 | `/` | Signed-out: landing (name, tagline, features, sign-in, policy links, badge + screenshot placeholders). Signed-in: the app. | SC-REL12-01/02, SC-REL15-03 | Pass (web) — signed-out landing + signed-in app both render on web dev server |
| 8 | `/privacy` | Full privacy policy, no sign-in required. | SC-REL10-01 | Not run — owner-only — hosted on production domain, not an app route |
| 9 | `/terms` | Terms of use, no sign-in required. | SC-REL10-01 | Not run — owner-only — hosted on production domain, not an app route |
| 10 | `/delete-account` | Signed-out: Google sign-in prompt. Signed-in: the deletion summary. | SC-REL09-01/02 | Pass (web) — delete-account summary renders correctly on web (DELETED/KEPT sections) |
| 11 | `/join/<valid code>` | Invite page → sign-in → join. (On a device with the app installed: opens the app.) | SC-REL15-03 | Not run — needs valid invite + second account (owner-only) |

## 4. Release-build hygiene (SC-REL15-04)

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 12 | `npm run guardrails` on the tagged tree passes: no ad/analytics/OTA SDK in the dependency tree, `blockedPermissions` covers location/broad-media/exact-alarm, camera permission text present. | SC-REL01-03, SC-REL15-04 | Pass (web) — `npm run guardrails` green on this tree |
| 13 | On the installed build: Settings → Apps → Milevana → Permissions shows **Camera** only (granted or not granted — but no Location, no Photos/videos broad access). | SC-REL15-04 | Not run — device |

## 5. Account deletion end to end (AC-R5)

Use two linked Google accounts (A = deleter who owns a shared vehicle, B =
member) and the anonymous install.

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 14 | Linked in-app: More → Account → Delete account → summary shows deletes/handoffs/leaves + Drive-folder link → back up first → re-sign-in → type `DELETE` → "Your account and data were deleted"; app returns to first launch. B sees the shared vehicle now owned by them; A's entries on B's vehicles keep A's name. | SC-REL06-*, SC-REL15-05 | Not run — needs two linked Google accounts (owner-only) |
| 15 | Interrupted run: delete on a device, force-kill mid-run (or toggle airplane mode between steps) → relaunch shows "Finish deleting your account" with Continue and **no cancel** → re-sign-in resumes and completes. | SC-REL07-01/02 | Not run — device |
| 16 | Anonymous: More → Account → **Delete all my data** → warning → confirm → no Google sign-in asked → app restarts at first launch with a fresh anonymous account; all local data gone. | SC-REL08-01/02 | Not run — anonymous path is native/device |
| 17 | Web: `/delete-account` as the shared-vehicle owner → same summary/handoff choices → DELETE → signed out at the end. An account with no data sees "No Milevana data found". An unfinished in-app deletion resumes after sign-in. | SC-REL09-01/02/03 | Partial (web) — deletion summary/handoff UI renders on web; full DELETE run against emulator not completed |
| 18 | Drive untouched: A's receipt files and backups are still in A's Google Drive after deletion (SC-REL05-04). | SC-REL05-04 | Not run — owner-only (real Drive) |

## 6. Weekly Firestore usage check (SC-REL15-06, §23.8 Usage monitoring)

Spark has no budget alerts, so usage is reviewed by hand.

**Procedure — run weekly, and immediately if a `resource-exhausted`
non-fatal reaches production:**

1. Firebase console → project `milevana` → **Usage and billing → Usage**.
2. Record Firestore reads/writes/deletes for the last 24 h and the last 30 d.
3. Compare against the Spark daily limits and `docs/quota-budget.md`
   (≈7.8k reads / ≈7.2k writes projected at 500 DAU vs 25k/10k Spark caps).
4. If daily usage exceeds ~50% of a limit, or grows faster than the
   projection for two consecutive weeks, open a review: identify the
   read/write hot path before touching limits or billing.
5. Paste the numbers into a dated line in the release log.

| Date | Reads 24h | Writes 24h | vs projection | Review needed? |
|------|-----------|------------|---------------|----------------|
|      |           |            |               | ☐              |

## 7. Promotion (SC-REL15-07, VD-03)

Do this only after every row above passes and the closed-test gate (REL-04)
has granted production access:

| # | Step | Result |
|---|------|--------|
| 19 | In Play Console, promote the tested closed-track release to **production** as a full rollout (no staged percentage). | ☐ |
| 20 | Record the production release date and versionCode in `docs/release-runs/`. | ☐ |
