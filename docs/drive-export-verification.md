# DRV-17 — Drive, receipts and export verification checklist

Manual run record for the checks unit/component/emulator tests cannot drive:
real Google OAuth consent, real Drive files, cross-client visibility, Android
offline behaviour with real radios, and the merged release manifest. Fill the
Result column per run; link a bug or notes for anything that fails.

**Prerequisites**

- Owner-supplied config in place: Google Cloud project with the Drive API
  enabled and `drive.file` on the OAuth consent screen (test-user publishing
  is enough), Android OAuth client id in `google-services.json`/app.json, and
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` for web (DRV-01/DRV-03 owner-only items).
- Android dev build installed (`dev.poovarasu.milevana`); web build served
  (`npx expo export --platform web` → `npx serve dist`, or the dev server).
- Two test Google accounts and one real test Drive; the test user linked via
  Settings → Link Google before the checks that need it.
- A spreadsheet app for the CSV check and a way to fill the Drive quota (or a
  very small Drive) for the full-Drive check.

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | On Backup & export tap Back up now → consent runs once asking only `drive.file`; second use never re-asks | SC-DRV03-01, SC-DRV04-01 | ☐ |
| 2 | Decline the consent → the feature does not run, "Allow Drive access" stays offered, every other feature unaffected | SC-DRV04-03 | ☐ |
| 3 | Anonymous user taps Back up now → routed through Link Google first; anonymous CSV export still works | SC-DRV04-02, SC-DRV16-01 | ☐ |
| 4 | Folder+file created from Android are visible/downloadable on web and vice versa; files land only inside `Milevana/` | SC-DRV01-01, SC-DRV03-02 | ☐ |
| 5 | Web consent picker offers a different Google account than the linked one → rejected with "Use \<linked email\>" | SC-DRV03-04, SC-DRV04-04 | ☐ |
| 6 | Revoke access in Google account settings → next Drive action shows "Drive access was removed" and re-runs consent | SC-DRV03-03, SC-DRV04-04, SC-DRV08-04 | ☐ |
| 7 | First Drive use creates `Milevana/Backups` + `Milevana/Receipts`; ids stored in `users.drive`; first vehicle receipt creates `Receipts/<vehicle>/` | SC-DRV05-01/02 | ☐ |
| 8 | Back up on Android → restore on web brings the data back; back up on web → restore on Android; latest backup preselected | SC-DRV17-01, SC-DRV09-01/03 | ☐ |
| 9 | Back up, delete 5 entries, restore → review shows "Will be restored" + deleted-on-purpose warning; entries return with original dates and `lastOdometer` recomputed | SC-DRV17-02, SC-DRV09-02, SC-DRV10-01 | ☐ |
| 10 | Differing vehicle → Keep current / Replace with backup chips once each; Keep leaves local docs, Replace overwrites with the backup version and never deletes | SC-DRV09-02, SC-DRV10-02 | ☐ |
| 11 | Backup containing a vehicle now owned by someone else → listed "Not restored (not yours)", never offered or written | SC-DRV10-05, SC-DRV09-02 | ☐ |
| 12 | Weekly frequency with a stale `lastBackupAt` → next Android open uploads a `kind=automatic` backup; with 10 automatics present the oldest is deleted and manuals are untouched | SC-DRV08-01/03 | ☐ |
| 13 | Kill the app mid-upload / add a receipt in airplane mode → on reopen+reconnect the photo lands in `Receipts/<vehicle>/`, status `uploaded`, no duplicate file | SC-DRV17-03, SC-DRV12-01/02 | ☐ |
| 14 | Drive full → upload shows a clear message, item stays queued; freeing space + Retry completes it | SC-DRV12-03 | ☐ |
| 15 | Delete an uploaded receipt's file in Drive → entry shows "File no longer in Drive" and stays usable; trashed file same | SC-DRV13-02 | ☐ |
| 16 | Photo receipt opens thumbnail → full screen; PDF opens in the system viewer; another member's receipt is not visible to this account; cache works offline, capped ~100 MB, cleared on sign-out | SC-DRV13-01/03 | ☐ |
| 17 | Remove one attachment → its Drive file deleted; delete an entry and Undo inside 5 s → no Drive delete; delete and wait → files gone; delete the vehicle → receipt files + folder gone, other members' files kept, Firestore subtree removed | SC-DRV14-01/02/03 | ☐ |
| 18 | Sign out with queued uploads → warning counts them; after sign-out no Drive token or Google session remains; queued items discarded | SC-DRV12-05, SC-DRV03-05 | ☐ |
| 19 | Export CSV (one vehicle and all-vehicles, incl. archived-toggle check and each range) → filename `milevana-export-<vehicle\|all>-<YYYY-MM-DD>.csv`; Android share sheet delivers it, web downloads it, the temp copy is removed | SC-DRV16-02/03 | ☐ |
| 20 | Open the CSV in a spreadsheet → ₹ and commas/quotes/line breaks intact; anonymous user can export with no Google account | SC-DRV17-04, SC-DRV16-01 | ☐ |
| 21 | Airplane mode on Android → CSV export still works from the local cache | SC-DRV16-04 | ☐ |
| 22 | Web offline → Drive actions are unreachable/disabled cleanly; receipt picker suppressed; reload with network restores the flow | SC-DRV12-05, DRV-16 offline rule | ☐ |
| 23 | Release build merged manifest: `android.permission.CAMERA` present; no `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, or any location permission (`npm run check:manifest` re-verifies post-build) | SC-DRV17-05, SC-DRV11-03 | ☐ |
| 24 | A large backup (3 vehicles, ~5,000 entries) → backup, list, review and restore complete without UI stalls; restore batches ≤500 writes | SC-DRV17 edge, SC-DRV10-03 | ☐ |

**Notes**

- Everything automatable is covered by Jest + the fake Drive client
  (`src/features/__tests__/*`, `src/data/drive/__tests__/*`,
  `app/__tests__/backupExport.test.tsx`, `app/__tests__/restore.test.tsx`,
  `src/ui/__tests__/attachments.test.tsx`) and by the rules emulator suite.
  The rows above cover the OS/Drive-account half only.
- Maestro smoke: extend `logging-airplane-mode.yaml` with a receipt
  attachment step for row 13 when the flow is updated.
- Drive API quota/consent verification is external (`[External — verify]`) —
  not gated here.

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
|      |       |        |        |       |
