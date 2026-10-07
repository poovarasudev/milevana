# Milevana v1 — Sub-project 5: Drive and export — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 17 in 5 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Same thin specification as sub-projects 2 to 4.** PRD §23.5 records "what the source already fixes", the tab 5 decisions, OQ-13 and OQ-50 to OQ-54, and the approved backup-file and CSV-column formats (Appendix E). It says "Acceptance criteria: defined in tab 5".
- **There are no PRD acceptance criteria and no `FR-` IDs for sub-project 5** (PRD §25.4). The criteria below are **derived from stated behavior** and cite the row they restate. They are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-13`, `PR-14`, `PR-02`, `PRV-02`, `PRV-05`, `PRV-08`, `NFR-03`, `FR-LINK-03`, `FR-LINK-07`, `FR-SCAF-03`, `FR-SCAF-04`, `FR-SER-*`, `FR-OFF-10`, `FR-OUT-05`, `OQ-13`, `OQ-20`, `OQ-22`, `OQ-35`, `OQ-45`, `OQ-50` to `OQ-54`, limitation `L2`, and Foundation `AC-D*` items. Where the PRD gives only a row in §23.5, the row name is cited, for example "§23.5 *Retention*".

**Labels.** `DRV-nn` story IDs and `ED-nn` decision labels are tracking labels, not requirement IDs. Earlier decisions are `DR-nn` (Foundation), `LD-nn` (Logging), `RD-nn` (Reminders) and `PD-nn` (Reports).

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL > 2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `ED-nn`, plus the earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.5):** Drive backup and restore (manual and automatic), receipt photos and PDFs with an offline upload queue, and CSV export.

**What earlier sub-projects provide** (assumed accepted): the OAuth client and Google linking, with the "require a linked account" gate (`FND-PLT-02`, `FND-AUTH-03`, `FND-AUTH-04`); the shared serializer and merge write path (`FND-DAT-08`, `FND-AUTH-06`); the schema including `attachments[]` and the `drive` and `settings` keys on the user (`FND-DAT-02`); the More list with "Coming soon" for Backup & export (`FND-SHL-02`); entry forms, History, edit and delete with Undo (`LOG-04` to `LOG-14`); the vehicle delete flow (`FND-VEH-04`).

**Out of scope:** sharing receipts with members and Drive permissions for others (tab 6; until then only the uploader sees a photo); account deletion and what happens to receipts then (tab 8); inspection photo tagging (tab 7, though the `itemId` field exists); the privacy policy "Limited Use" wording and the Google consent screen (tab 8); PDF or image export of reports (not in v1); any server component.

**Scope notes (not product decisions):**
1. The `drive.file` scope lets the app see only files it created. Everything here works inside that limit.
2. Android grants Drive access through `@react-native-google-signin/google-signin`; web uses Google Identity Services (PRD §11.2). Backup and restore work on both; automatic backup is Android only; attachments on web are online only (OQ-20).
3. The camera permission is accepted and declared in this sub-project (OQ-54). No broad media permission is added (`READ_MEDIA_IMAGES` and `READ_EXTERNAL_STORAGE` stay stripped).
4. Backups contain only vehicles the user owns. Other members cannot exist until tab 6, so member behavior is tested with seeded data.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| D1 | Drive foundation | DRV-01 to DRV-05 |
| D2 | Backup and restore | DRV-06 to DRV-10 |
| D3 | Receipts | DRV-11 to DRV-14 |
| D4 | CSV export | DRV-15, DRV-16 |
| D5 | Verification | DRV-17 |

---

# D1 — Drive foundation

### DRV-01 — Spike: `drive.file` visibility across Android and web
- **Epic:** D1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want to prove that files created by the Android client can be seen by the web client and the reverse, so that "backup and restore work on web too" is true before it is built.
- **Business value:** Web restore of an Android backup, and web viewing of receipts, depend on it. The `drive.file` scope shows each client only files it created, and the PRD says the check is needed (OQ-54).
- **Scope:** *In:* with one Google project, create a folder and a file from the Android client and read it from the web client, and the reverse; record how scope grants and the OAuth clients must be set up; note any limit that changes the design. *Out:* building the Drive client.
- **Preconditions:** `FND-PLT-02` (OAuth clients), two test Google accounts.
- **Functional behavior:** A written result stating whether cross-client visibility holds and under what configuration.
- **Business rules:** Android and web use one Google project so `drive.file` visibility can be verified (OQ-54). The app can only see files it created (§23.5 *Drive layout*).
- **Edge cases:** A different Google account than the linked one (ED-01). Files created before the scope was granted on the other client.
- **Android/web differences:** This is the comparison.
- **Offline behavior:** N/A.
- **Security implications:** Confirms the app sees only its own files.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A file created on Android is listed and downloadable on web, and the reverse, or the document states exactly why not [OQ-54].
  2. The required OAuth and project configuration is written down [FR-SCAF-04].
  3. The result states whether "restore on web" and "view receipts on web" are feasible as specified [OQ-20].
- **Decisions applied:** ED-01 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-01 ◐] A Drive action after access was revoked shows 'Drive access was removed' and re-runs the permission flow; on web a Google account different from the linked one is rejected with 'Use <linked email>'; the 'Drive access granted' flag is stored per device keyed by uid.
- **Test requirements:** Manual run with two test accounts.
- **Dependencies:** FND-PLT-02.
- **PRD requirement IDs:** FR-SCAF-04, OQ-20, OQ-54; §24.4 `[External — verify]`.
- **SRS reference:** Drive details OQ-54 L690; Permission L490–492; Backup L465–472.

### DRV-02 — Spike: quota and cost of backup, restore, export and uploads
- **Epic:** D1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the Firestore cost of backing up, restoring and exporting counted, so that these features do not exhaust the free quota.
- **Business value:** Backup reads every entry of every owned vehicle; restore writes many documents (OQ-53 raises this). There is no Blaze fallback (NFR-06).
- **Scope:** *In:* counts of reads and writes for a manual backup, an automatic backup on app open, a restore of N entries (batches of 500), a CSV export for one vehicle and for all vehicles, and attachment metadata updates; projection at 100 to 500 daily active users, cache-first; a recommendation if over. *Out:* Drive API quotas, which are outside Firestore's free-plan limits and are an `[External — verify]` item.
- **Preconditions:** `FND-VER-01` method, DR-20; `LOG-01`, `RPT-01` results.
- **Functional behavior:** A written budget with per-operation counts and the daily projection.
- **Business rules:** NFR-06, NFR-20, OQ-18, OQ-35 (500 per batch, rules read only the parent vehicle).
- **Edge cases:** Years of entries. Many vehicles. Automatic backup on every open when stale versus once per interval.
- **Android/web differences:** Automatic backup is Android only.
- **Offline behavior:** Counts assume cache reads.
- **Security implications:** None.
- **Data/schema impact:** May recommend reading from a cached set (shared with `RPT-04`).
- **Acceptance criteria:**
  1. A document lists reads and writes per operation named above [NFR-06].
  2. The projection at 100 and 500 users is compared with the threshold and recorded pass or fail [OQ-18].
  3. DRV-08 and DRV-10 are not accepted before this passes.
- **Decisions applied:** DR-20 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
- **Test requirements:** Measured from the emulator with request logging.
- **Dependencies:** FND-VER-01, LOG-01, RPT-01.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-25, OQ-18, OQ-35.
- **SRS reference:** OQ-18 L642; OQ-35 L656; OQ-53 L689.

### DRV-03 — Drive client (native and web)
- **Epic:** D1 · **Type:** Architecture · **Size:** XL · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want one Drive client interface with a native and a web implementation, so that backup, restore and receipts do not know which platform they run on.
- **Business value:** One place for every Drive call keeps the platform split where the rest of the app keeps it (NFR-14).
- **Scope:** *In:* `src/data/drive/driveClient.native.ts` and `driveClient.web.ts` with one interface: obtain an access token for the `drive.file` scope incrementally (native through Google Sign-In, web through Google Identity Services on demand); create and find folders; create, upload, download, list and delete files; error mapping (storage full, file not found, access revoked, network). *Out:* the permission UI (DRV-04), the folder layout (DRV-05), uploads from the queue (DRV-12).
- **Preconditions:** `FND-PLT-02`, `FND-DAT-03`, `FND-DAT-04`, DRV-01.
- **Functional behavior:**
  1. A call that needs Drive obtains a token, requesting the scope the first time.
  2. The client exposes folder and file operations and normalized errors.
  3. Sign-out clears the Google Sign-In session and any Drive token.
- **Business rules:** Drive access is the user's own Drive under `drive.file`; Firebase Storage is not used (PRV-05, RK-09). The scope is requested incrementally; the OAuth client was set up in Foundation (FR-SCAF-04, FR-LINK-07).
- **Edge cases:** Token expiry during a long upload. Access revoked in the Google account. A Google account different from the linked one. Decision applied: ED-01.
- **Android/web differences:** Native uses `@react-native-google-signin/google-signin`; web uses Google Identity Services and needs the network.
- **Offline behavior:** Drive calls need the network; callers queue (DRV-12) or fail clearly.
- **Security implications:** Tokens are never logged or sent to Crashlytics; the scope is limited to files the app creates.
- **Data/schema impact:** None directly (folder ids are stored by DRV-05).
- **Acceptance criteria:**
  1. The first Drive call requests `drive.file` and later calls reuse the grant [PRD §23.5 *Auth*].
  2. Create, upload, download, list and delete work on a test Drive on Android and web [OQ-54].
  3. A full Drive, a missing file and revoked access each produce a distinct, normalized error [§23.5 *Attachment errors*].
  4. Sign-out leaves no Drive token or Google session [FR-OUT-05].
  5. No file outside the Drive client imports a platform Drive library [NFR-14].
- **Decisions applied:** ED-01 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-01 ◐] A Drive action after access was revoked shows 'Drive access was removed' and re-runs the permission flow; on web a Google account different from the linked one is rejected with 'Use <linked email>'; the 'Drive access granted' flag is stored per device keyed by uid.
- **Test requirements:** Jest with a fake Drive API; manual runs with a test Google account on both platforms.
- **Dependencies:** FND-PLT-02, FND-DAT-03, FND-DAT-04, DRV-01.
- **PRD requirement IDs:** PR-13, PR-14, PRV-05, RK-09, FR-LINK-07, FR-SCAF-04, FR-OUT-05, NFR-14.
- **SRS reference:** Libraries L113–114; Permission L490–492; OQ-54 L690.

### DRV-04 — Drive permission flow
- **Epic:** D1 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to be told in one line why Drive access is needed before I am asked, and to keep using everything else if I say no.
- **Business value:** Trust: the app asks for the narrowest scope with a reason, and does not punish a decline.
- **Scope:** *In:* the first time a Drive feature is used, a one-line explanation, then the system Google permission request for `drive.file`; for an anonymous user, the required link step first (the gate from Foundation); handling of grant, decline and failure. *Out:* the features themselves.
- **Preconditions:** DRV-03, `FND-AUTH-04` (gate), `FND-SET-01`.
- **Functional behavior:**
  1. Using Backup, Restore or adding a receipt for the first time shows a one-line explanation, then asks for Drive access.
  2. An anonymous user is first taken through linking Google.
  3. If the user declines, the feature does not run and everything else keeps working.
  4. After a grant, later uses do not ask again.
- **Business rules:** Linking Google is required before Drive backup or receipt photos (FR-LINK-03). Drive access is requested the first time a Drive feature is used, with a one-line explanation first; if declined, everything else keeps working (§23.5 *Permission*). Automatic backup stays off until Drive access has been granted once (OQ-53).
- **Edge cases:** Declining then trying again later. Revoked access found later. Decision applied: ED-02: the explanation text, how a user who declined is invited to try again, and ED-01 for where "granted once" is recorded.
- **Android/web differences:** Native system dialog versus web popup.
- **Offline behavior:** The request needs the network.
- **Security implications:** Only `drive.file` is requested; no other Google scope.
- **Data/schema impact:** None (the grant state storage is ED-01).
- **Acceptance criteria:**
  1. The first Drive use shows a one-line explanation and then the Drive access request [§23.5 *Permission*].
  2. An anonymous user is routed through linking first [FR-LINK-03].
  3. Declining leaves every other feature working and runs no Drive action [§23.5 *Permission*].
  4. After a grant, no second request appears [§23.5].
- **Decisions applied:** ED-01 ◐, ED-02 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-01 ◐] A Drive action after access was revoked shows 'Drive access was removed' and re-runs the permission flow; on web a Google account different from the linked one is rejected with 'Use <linked email>'; the 'Drive access granted' flag is stored per device keyed by uid.
  2. **D2** [ED-02 ◐] The first Drive use shows 'Milevana needs a folder it creates in your Google Drive to store backups and receipts. It can't see your other files.' once per device; after a decline an 'Allow Drive access' button appears on Backup & export and in the attachment area.
- **Test requirements:** RNTL with a fake client; manual run with a test Google account.
- **Dependencies:** DRV-03, FND-AUTH-04, FND-SET-01.
- **PRD requirement IDs:** PR-13, PR-14, FR-LINK-03, FR-LINK-07, OQ-53; §23.5 *Permission*.
- **SRS reference:** Permission L490–492; OQ-53 L689.

### DRV-05 — Drive layout and per-vehicle receipt folders
- **Epic:** D1 · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want my Drive organised under one "Milevana" folder, so that I can find backups and receipts there.
- **Business value:** Predictable, user-visible structure; renames must not move or lose files.
- **Scope:** *In:* ensure the "Milevana" root folder with `Backups/` and `Receipts/`; ensure a `Receipts/<vehicle name>/` folder per vehicle when first needed; store folder ids in `users/{uid}.drive` (`rootFolderId`, `backupsFolderId`, `receiptsFolderId`) and the per-vehicle ids in `drive.vehicleFolderIds`. *Out:* uploading files (DRV-12), deleting folders (DRV-14).
- **Preconditions:** DRV-03, `FND-DAT-06`.
- **Functional behavior:**
  1. The first Drive action creates the root, `Backups/` and `Receipts/` if they do not exist and records their ids.
  2. The first receipt for a vehicle creates its folder and records the id.
  3. Later actions reuse the stored ids.
- **Business rules:** The Drive folder is named "Milevana" and backup files are prefixed `milevana-backup-` (OQ-50). Per-vehicle receipt folder ids are stored in the user's own document, so renaming a vehicle does not move its folder (OQ-54). The app sees only files it created.
- **Edge cases:** The user deleted or renamed the folder in Drive. Two vehicles with the same name. A folder id that no longer resolves. A second device creating the folders at the same time.
- **Android/web differences:** Same through the Drive client.
- **Offline behavior:** Needs the network; callers handle that.
- **Security implications:** Folder ids are in the user's own document (self-only rules).
- **Data/schema impact:** Writes `users.drive` fields and `drive.vehicleFolderIds`.
- **Acceptance criteria:**
  1. The first Drive action creates "Milevana" with `Backups/` and `Receipts/` and stores their ids [OQ-50, §23.5 *Drive layout*].
  2. The first receipt for a vehicle creates `Receipts/<vehicle name>/` and stores its id [OQ-54].
  3. Renaming the vehicle afterwards does not create a new folder or move the old one [OQ-54].
  4. A stored id that no longer resolves is recovered without duplicating a folder that still exists [§23.5 *Attachment cleanup*].
- **Decisions applied:** DR-05 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-05 ✔] A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected.
- **Test requirements:** Jest with the fake Drive; manual run on both platforms.
- **Dependencies:** DRV-03, FND-DAT-06.
- **PRD requirement IDs:** PR-13, PR-14, OQ-50, OQ-54; §23.5 *Drive layout*.
- **SRS reference:** Drive layout L465–472; Names OQ-50 L686; OQ-54 L690; User record L782–785.

---

# D2 — Backup and restore

### DRV-06 — Backup file: build and read
- **Epic:** D2 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want the backup file built and read through the shared serializer, so that backup, restore and account merge use one tested format.
- **Business value:** One format and one code path for data leaving and re-entering the app (FR-SER).
- **Scope:** *In:* build a readable JSON file named `milevana-backup-YYYY-MM-DD-HHMM.json` with `formatVersion`, `createdAt`, `kind` (manual or automatic), `app` (name and version), `settings`, and `vehicles`; each vehicle holds its fields, `members` as `[{ uid, name, role }]` with no emails, and its `entries`, `reminders` and `checklistTemplates`; only vehicles the user owns; reading a backup file back through the serializer. *Out:* Drive upload (DRV-07), restore decisions (DRV-09, DRV-10).
- **Preconditions:** `FND-DAT-08`, `FND-DAT-07`.
- **Functional behavior:**
  1. `buildBackup(uid, kind)` returns the file contents and name.
  2. `readBackup(file)` validates and returns the serialized structure.
  3. Members appear by name and role only.
- **Business rules:** Backups contain settings and owned vehicles only, with entries, reminders and checklist templates; members of an owned vehicle appear by name only, with no emails (OQ-53). Plain, readable JSON, roughly 1 MB for years of data (§23.5 *Backup format*).
- **Edge cases:** A vehicle with 501 or more entries. A vehicle owned by the user but with other members' entries. Archived vehicles. A file with an unknown `formatVersion`. Decision applied: ED-04: which settings keys are included, how entry `attachments[]` references are handled, the value and scheme of `formatVersion`, the source of the app version.
- **Android/web differences:** None.
- **Offline behavior:** Building uses cached data.
- **Security implications:** Emails are excluded; the file contains personal data and goes only to the user's own Drive.
- **Data/schema impact:** Defines the backup format (Appendix E).
- **Acceptance criteria:**
  1. The file has the Appendix E top-level fields and the stated name pattern [Appendix E *Backup file*].
  2. Only owned vehicles are included, and members carry no email [OQ-53].
  3. Build then read round-trips every field of every document [FR-SER-04].
  4. Entries, reminders and checklist templates of each vehicle are included [§23.5 *Backup format*].
- **Decisions applied:** ED-04 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-04 ◐] A backup's settings hold currency, units, formats, theme, locale and backup frequency only; entries keep `attachments[]` and `uploaderUids` with `sharedWithUids` empty; `formatVersion` is 1 and `app` holds 'Milevana' and the installed version.
- **Test requirements:** Jest round-trip with large fixtures (TS-03 style).
- **Dependencies:** FND-DAT-08, FND-DAT-07.
- **PRD requirement IDs:** PR-13, FR-SER-01, FR-SER-04, PRV-08, OQ-53; Appendix E *Backup file*.
- **SRS reference:** Backup L465–472; Backup file L787–789; OQ-53 L689.

### DRV-07 — Backup & export screen and manual backup
- **Epic:** D2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to back my data up to my own Google Drive whenever I choose, and to see when I last did, so that I know it is safe.
- **Business value:** Backup is free forever and is the main answer to "your data is never held hostage" (PR-02).
- **Scope:** *In:* More → Backup & export replaces "Coming soon": last backup time, **Back up now**, **Restore** (opens DRV-09), the automatic-backup frequency setting (daily, weekly by default, monthly, off), and the CSV export entry (DRV-16); a manual backup written to `Backups/` in Drive; recording `lastBackupAt` and `lastBackupFileId`; web too. *Out:* automatic backup (DRV-08), restore logic.
- **Preconditions:** DRV-04, DRV-05, DRV-06, `FND-SHL-02`.
- **Functional behavior:**
  1. The screen shows the last backup time, **Back up now**, **Restore** and the frequency setting.
  2. **Back up now** builds the file and uploads it to `Backups/`, then shows the new last-backup time.
  3. Manual backups are kept until the user deletes them.
  4. The first use goes through the permission flow.
- **Business rules:** Backup and restore work on web too (§23.5 *Backup & export screen*, OQ-20). Linked accounts only for Drive features (FR-LINK-03). Backup, sync, restore and export are never paywalled (PR-02).
- **Edge cases:** Offline (cannot back up). Drive full. Upload interrupted. Anonymous user (link first). Decision applied: ED-13: states of the screen (not linked, no access, in progress, failed), where a user deletes a manual backup.
- **Android/web differences:** Both platforms; web needs the network and uses Identity Services.
- **Offline behavior:** **Back up now** is unavailable offline with a clear message.
- **Security implications:** The file goes only to the user's own Drive.
- **Data/schema impact:** Updates `users.drive.lastBackupAt` and `lastBackupFileId`; writes the `backupFrequency` setting.
- **Acceptance criteria:**
  1. More → Backup & export shows last backup time, **Back up now**, **Restore** and the frequency setting [§23.5 *Backup & export screen*].
  2. **Back up now** creates a `milevana-backup-…` file in `Milevana/Backups/` and updates the last-backup time [§23.5, OQ-50].
  3. The screen works on Android and web [OQ-20].
  4. The frequency setting offers daily, weekly, monthly and off with weekly as the default [§23.5 *Automatic backup*, FR-SET-05].
  5. Declining Drive access leaves the rest of the app unaffected [§23.5 *Permission*].
- **Decisions applied:** ED-04 ◐, ED-13 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-04 ◐] A backup's settings hold currency, units, formats, theme, locale and backup frequency only; entries keep `attachments[]` and `uploaderUids` with `sharedWithUids` empty; `formatVersion` is 1 and `app` holds 'Milevana' and the installed version.
  2. **D2** [ED-13 ◐] Backup & export shows the states 'Link Google to back up', 'Allow Drive access', 'Backing up…', 'Last backup <time>' and 'Last backup failed. Retry'; 'Your backups' lists manual backups with a Delete action that removes the Drive file; CSV export sits on the same screen.
- **Test requirements:** RNTL with the fake client; manual run on both platforms.
- **Dependencies:** DRV-04, DRV-05, DRV-06, FND-SHL-02.
- **PRD requirement IDs:** PR-02, PR-13, FR-LINK-03, FR-SET-05, OQ-20, OQ-50; §23.5 *Backup & export screen*.
- **SRS reference:** Backup L465–472; Navigation L259; Settings L281.

### DRV-08 — Automatic backup and retention
- **Epic:** D2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below); acceptance waits on DRV-02.
- **User story:** As a linked Android user, I want my data backed up automatically, so that I do not have to remember to do it.
- **Business value:** Most users never back up by hand; the weekly default protects them (§23.5).
- **Scope:** *In:* on app open, if the last backup is older than the chosen frequency, create an automatic backup; linked accounts only; any network; off until Drive access has been granted once; after each automatic backup keep the last 10 automatic backups and delete older ones; manual backups are never deleted by this. *Out:* web (automatic backup is Android only).
- **Preconditions:** DRV-07, DRV-02 (gate).
- **Functional behavior:**
  1. On app open, compare `lastBackupAt` with the frequency; if stale, back up automatically.
  2. After a successful automatic backup, delete automatic backups beyond the latest 10.
  3. With the frequency set to off, or before Drive access was granted, nothing runs.
- **Business rules:** OQ-13, OQ-53, §23.5 *Retention*: last 10 automatic backups kept, older deleted; manual backups kept until deleted. Runs on any network because the file is small.
- **Edge cases:** Two devices both stale at once. A failed upload. Unlinked user. App opened offline. Decision applied: ED-03: how "older than the frequency" is measured, whether an unchanged dataset is skipped, handling of failures, and how automatic backups are told apart for retention.
- **Android/web differences:** Android only; web has no automatic backup (OQ-20).
- **Offline behavior:** Skipped when offline; retried on a later open.
- **Security implications:** Same as DRV-07.
- **Data/schema impact:** Updates `lastBackupAt`, `lastBackupFileId`; deletes old Drive files.
- **Acceptance criteria:**
  1. With a weekly frequency and a last backup older than a week, opening the app creates an automatic backup [OQ-13].
  2. With the frequency off, or Drive access never granted, no backup is created [OQ-53].
  3. After an 11th automatic backup the oldest automatic backup is deleted and manual backups are untouched [§23.5 *Retention*].
  4. An anonymous (unlinked) user gets no automatic backup [OQ-13].
  5. Web does not run automatic backup [OQ-20].
- **Decisions applied:** ED-01 ◐, ED-03 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-01 ◐] A Drive action after access was revoked shows 'Drive access was removed' and re-runs the permission flow; on web a Google account different from the linked one is rejected with 'Use <linked email>'; the 'Drive access granted' flag is stored per device keyed by uid.
  2. **D2** [ED-03 ◐] With weekly frequency and `lastBackupAt` 8 days ago an automatic backup runs on app open; a manual backup resets the clock; a failed run shows 'Last backup failed' and retries on the next open; after the 11th automatic backup the oldest automatic one is deleted and manual ones are untouched; automatic backups carry the Drive property `kind=automatic`.
- **Test requirements:** Jest with fake time and Drive; manual check on a device.
- **Dependencies:** DRV-07; gate DRV-02.
- **PRD requirement IDs:** PR-13, PR-02, OQ-13, OQ-20, OQ-53; §23.5 *Automatic backup*, *Retention*.
- **SRS reference:** Backup L465–472; OQ-13 L685; OQ-53 L689.

### DRV-09 — Restore: choose a backup and review
- **Epic:** D2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user who lost or damaged data, I want to pick a backup and see exactly what restoring will do, so that I stay in control of my data.
- **Business value:** Restore can overwrite or resurrect data, so it must be understandable first (OQ-53).
- **Scope:** *In:* **Restore** lists the backups in `Backups/` with the latest preselected; the user picks one; the app compares it with current data for vehicles the user owns and shows a summary: what is missing and will be restored, and per vehicle that exists but differs a keep-current or replace choice; a warning that entries deleted on purpose after the backup will come back; a tick-box to restore settings (off by default). *Out:* applying the restore (DRV-10).
- **Preconditions:** DRV-06, DRV-07.
- **Functional behavior:**
  1. List backups newest first with the latest preselected.
  2. Build the comparison for owned vehicles only.
  3. Show the summary, ask once per differing vehicle (keep current or replace with the backup's copy), show the deleted-entries warning, and offer the settings tick-box.
- **Business rules:** Restore restores what is missing, asks about the rest, and only ever touches vehicles the user owns (§23.5 *Restore*, OQ-53). Settings are not restored unless ticked. Vehicles the user does not own are never changed.
- **Edge cases:** A backup of a vehicle the user no longer owns. A backup with an unknown `formatVersion`. An empty backup folder. Decision applied: ED-05: how a backup item is matched to current data, what "differs" compares, and what "replace" does to entries that are not in the backup.
- **Android/web differences:** Same screens; web needs the network.
- **Offline behavior:** Needs the network and Drive.
- **Security implications:** Only owned vehicles are touched; members' emails are not in the file.
- **Data/schema impact:** None until DRV-10 applies it.
- **Acceptance criteria:**
  1. Restore lists backups with the latest preselected [OQ-53].
  2. The summary lists what is missing and, for each owned vehicle that exists but differs, a keep-current or replace choice asked once per vehicle [OQ-53].
  3. The summary warns that entries deleted on purpose after the backup will return [OQ-53].
  4. Settings are restored only when the tick-box is selected [OQ-53].
  5. A vehicle in the backup that the user does not own is not offered for restore [§23.5 *Restore*].
- **Decisions applied:** ED-05 ◐, ED-14 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-05 ◐] Restore matches by id on owned vehicles; missing items are always restored; Keep current leaves existing documents untouched; Replace overwrites the vehicle and children found in the backup and deletes none; `lastOdometer` is recomputed afterwards; a vehicle the user no longer owns is listed 'Not restored (not yours)'.
  2. **D2** [ED-14 ◐] On web, attachments are chosen through a file picker that accepts images and PDF, an entry is saved only after its upload finishes, and there is no automatic backup.
- **Test requirements:** RNTL with fixtures; Jest for the comparison.
- **Dependencies:** DRV-06, DRV-07.
- **PRD requirement IDs:** PR-13, PR-02, OQ-20, OQ-53; §23.5 *Restore*.
- **SRS reference:** Restore L472; OQ-53 L689.

### DRV-10 — Restore: apply
- **Epic:** D2 · **Type:** User-facing · **Size:** XL · **Readiness:** Ready: decisions applied (see below); acceptance waits on DRV-02.
- **User story:** As a user, I want the restore I reviewed to be applied safely, so that I get my data back without duplicates or surprises.
- **Business value:** Completes the "never held hostage" promise; it reuses the merge write path.
- **Scope:** *In:* write missing items and replaced vehicles through the serializer in batches of 500, vehicles before their entries; apply the user's per-vehicle choices and the settings choice; progress and result; failure handling and retry; recompute `lastOdometer`. *Out:* the review screen (DRV-09).
- **Preconditions:** DRV-09, `FND-DAT-08`, `FND-SEC-02`, DRV-02 (gate).
- **Functional behavior:**
  1. Restore missing items; apply keep-current or replace per vehicle as chosen.
  2. Restore settings only if ticked.
  3. Show progress, then a result summary.
  4. On failure, offer a retry that does not duplicate documents.
- **Business rules:** Items in the backup that no longer exist are restored (OQ-53). Restored entries by other members on a shared vehicle the user owns are attributed to the user; original `createdAt` and `updatedAt` are kept; vehicles are written before entries; batches of 500 (OQ-22, OQ-35). Only owned vehicles are touched.
- **Edge cases:** Failure partway. A very large backup. The app killed during restore. A backup from an older or newer app. Decision applied: ED-05 and ED-06.
- **Android/web differences:** Both; web needs the network and cannot keep unsynced writes.
- **Offline behavior:** Needs the network to read the backup; writes then use the normal path.
- **Security implications:** Rules still validate every write (timestamps not in the future, `createdBy` rewritten).
- **Data/schema impact:** Creates and replaces vehicle subtree documents.
- **Acceptance criteria:**
  1. Restoring into an account where a vehicle's entries were deleted brings those entries back [OQ-53].
  2. A "replace" choice applies the backup's copy and "keep current" leaves that vehicle unchanged [OQ-53].
  3. A fixture with 501 entries restores in batches of 500 with no rules denial [OQ-35, AC-D21].
  4. A failed restore can be retried and creates no duplicates [FR-SER-03].
  5. Only vehicles the user owns are changed [§23.5 *Restore*].
- **Decisions applied:** ED-05 ◐, ED-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-05 ◐] Restore matches by id on owned vehicles; missing items are always restored; Keep current leaves existing documents untouched; Replace overwrites the vehicle and children found in the backup and deletes none; `lastOdometer` is recomputed afterwards; a vehicle the user no longer owns is listed 'Not restored (not yours)'.
  2. **D2** [ED-06 ◐] Cancel stops a restore after the current batch and running it again creates no duplicates; a backup with a newer `formatVersion` is refused with 'Update the app to restore this backup' and an older one is upgraded; quota exhaustion shows 'Sync paused'.
- **Test requirements:** Emulator integration test of the restore write path, including failure and retry, mirroring the merge test (OQ-37); manual restore from a real Drive backup.
- **Dependencies:** DRV-09; FND-DAT-08, FND-SEC-02; gate DRV-02.
- **PRD requirement IDs:** PR-13, FR-SER-02, FR-SER-03, OQ-22, OQ-35, OQ-37, OQ-53; AC-D21; §23.5 *Restore*.
- **SRS reference:** Restore L472; OQ-22 L645; OQ-35 L656; OQ-53 L689.

---

# D3 — Receipts

### DRV-11 — Add receipt photos and PDFs to an entry
- **Epic:** D3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to attach photos or a PDF of a bill to an entry, so that the proof sits next to the record.
- **Business value:** Garage bills often arrive as PDFs; one receipt per bill is the stated intent (§13.3.1).
- **Scope:** *In:* an attachments section in the entry forms (add and edit): take a photo with the camera, pick from the gallery through the system photo picker, or pick a PDF from files; up to 5 per entry; photos compressed to about 1600 px on the long edge (roughly 200 to 400 KB); PDFs up to 5 MB; each added file becomes an `attachments[]` item with `id`, `ownerUid`, `mimeType`, `sizeBytes`, `status`; the requirement to be linked and to have Drive access. *Out:* uploading (DRV-12), viewing (DRV-13), inspection item tagging (tab 7), sharing (tab 6).
- **Preconditions:** DRV-04, DRV-05, `LOG-04`, `LOG-13`.
- **Functional behavior:**
  1. In an entry form the user chooses camera, gallery or PDF.
  2. A photo is compressed; a PDF over 5 MB is refused with a clear message.
  3. The item is added to the entry and marked as waiting to upload; the entry saves immediately.
  4. A sixth attachment is not allowed.
- **Business rules:** Up to 5 attachments per entry; photos about 1600 px on the long edge; PDFs up to 5 MB (§23.5 *Adding attachments*, OQ-41). The system photo picker and document picker are used, with no broad media permission (PRV-02, FR-SCAF-03). The camera permission is accepted and declared (OQ-54). Linking Google is required before receipt photos (FR-LINK-03).
- **Edge cases:** Camera permission denied. The user cancels a picker. A photo with orientation metadata. Editing an entry that already has 5. Decision applied: ED-07: the `status` values, accepted image types, compression quality and output format, naming in Drive; ED-14: how attachments are chosen and handled on web.
- **Android/web differences:** Android has the camera and system pickers; web uses file selection and is online only (OQ-20).
- **Offline behavior:** The entry saves and the attachment waits locally (DRV-12). On web attachments need the network.
- **Security implications:** Only the camera permission is added; `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` and location stay absent (AC-D19, AC-D20).
- **Data/schema impact:** Writes `attachments[]` items on entries (and `uploaderUids` once uploaded).
- **Acceptance criteria:**
  1. The user can add a photo from the camera, a photo from the gallery and a PDF to an entry [§23.5 *Adding attachments*].
  2. A sixth attachment is refused [§23.5].
  3. A photo is reduced to about 1600 px on the long edge and a PDF over 5 MB is refused [§23.5].
  4. An anonymous user is routed through linking first [FR-LINK-03].
  5. The release manifest contains the camera permission and none of `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or a location permission [OQ-54, AC-D19, AC-D20].
- **Decisions applied:** ED-07 ◐, ED-14 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-07 ◐] Attachment statuses are `queued`, `uploading`, `uploaded`, `failed` and `missing` with the stated transitions; a photo is stored as JPEG at quality 80 with a 1600 px long edge, orientation applied and metadata stripped; the Drive name follows `<date>_<type>_<id>.<ext>`; a PDF over 5 MB is refused.
  2. **D2** [ED-14 ◐] On web, attachments are chosen through a file picker that accepts images and PDF, an entry is saved only after its upload finishes, and there is no automatic backup.
- **Test requirements:** RNTL with picker fakes; Jest for the compression rules; manifest check in CI.
- **Dependencies:** DRV-04, DRV-05, LOG-04, LOG-13.
- **PRD requirement IDs:** PR-14, PRV-02, FR-SCAF-03, FR-LINK-03, NFR-03, OQ-41, OQ-54; AC-D19, AC-D20; §23.5 *Adding attachments*.
- **SRS reference:** Receipt photos L474–480; Entries L152–153; OQ-41 L666; OQ-54 L690.

### DRV-12 — Offline upload queue
- **Epic:** D3 · **Type:** Architecture / user-facing · **Size:** XL · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user who logs a receipt in a garage with no signal, I want the entry saved at once and the photo uploaded later, so that I never lose either.
- **Business value:** "Log anywhere" extends to receipts (P3, FR-OFF-10).
- **Scope:** *In:* a durable local queue of attachments waiting to upload; uploading to the vehicle's receipt folder when online; updating the attachment's status and `driveFileId` and the entry's `uploaderUids`; handling a full Drive (a clear message, the photo stays queued); progress visibility; retry. *Out:* adding attachments (DRV-11), viewing (DRV-13), deleting (DRV-14).
- **Preconditions:** DRV-03, DRV-05, DRV-11.
- **Functional behavior:**
  1. A new attachment is queued locally while the entry is saved.
  2. When online, queued files upload in turn to `Receipts/<vehicle name>/`.
  3. After upload the attachment records `driveFileId` and the new status; the entry records the uploader in `uploaderUids`.
  4. If Drive storage is full the user sees a clear message and the item stays queued.
- **Business rules:** The entry saves immediately; attachments wait in a local queue until online, then upload (§23.5 *Attachments offline*). A full Drive shows a clear message and keeps the photo queued (§23.5 *Attachment errors*). Receipt uploads use an offline upload queue (FR-OFF-10).
- **Edge cases:** App killed mid-upload. The entry deleted while queued. Sign-out with queued items. Uninstall (the queue is lost; limitation L2 covers anonymous data loss generally). Access revoked. Decision applied: ED-08: retry and ordering, which networks and when uploads run, how the user sees the queue, what happens at sign-out and when the entry is deleted while queued.
- **Android/web differences:** Android has the durable queue; on web attachments are online only and there is no offline queue (OQ-20).
- **Offline behavior:** This story is the offline behavior for receipts.
- **Security implications:** Queued files hold personal documents in app-private storage until uploaded; they are removed after upload or discard.
- **Data/schema impact:** Updates `attachments[].status`, `driveFileId`, `uploaderUids`.
- **Acceptance criteria:**
  1. An entry with a photo saved in airplane mode appears at once, and after reconnecting the photo is in the vehicle's receipt folder in Drive [§23.5 *Attachments offline*].
  2. A killed app resumes uploads on next open without duplicating files [FR-OFF-10].
  3. A full Drive shows a clear message and the item stays queued [§23.5 *Attachment errors*].
  4. After upload, `driveFileId` and `uploaderUids` are set [Appendix E, OQ-56].
  5. On web an attachment upload happens only online [OQ-20].
- **Decisions applied:** ED-07 ◐, ED-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-07 ◐] Attachment statuses are `queued`, `uploading`, `uploaded`, `failed` and `missing` with the stated transitions; a photo is stored as JPEG at quality 80 with a 1600 px long edge, orientation applied and metadata stripped; the Drive name follows `<date>_<type>_<id>.<ext>`; a PDF over 5 MB is refused.
  2. **D2** [ED-08 ◐] Uploads run one at a time in order, retry after 1, 5 and 15 minutes then 1 hour, and become `failed` after 5 attempts with a manual Retry; sign-out warns about queued uploads and discards them; deleting the entry cancels its queued items; the queue runs only while the app is in the foreground and online.
- **Test requirements:** Jest with a fake Drive and a fake network; manual airplane-mode run; Maestro extension of the airplane-mode flow.
- **Dependencies:** DRV-03, DRV-05, DRV-11.
- **PRD requirement IDs:** PR-14, PR-03, FR-OFF-10, OQ-20, OQ-56, L2; §23.5 *Attachments offline*, *Attachment errors*.
- **SRS reference:** Receipt photos L474–480; OQ-56 L695; Limitations L826.

### DRV-13 — View receipts and handle missing files
- **Epic:** D3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to open the receipts I attached, and be told clearly if a file is gone from Drive, so that nothing breaks.
- **Business value:** A receipt is only useful if it can be seen again.
- **Scope:** *In:* showing an entry's attachments (photos and PDFs) to the user who uploaded them; opening one; a "File no longer in Drive" state when the file was deleted in Drive; the queued and failed states. *Out:* other members seeing photos (tab 6).
- **Preconditions:** DRV-03, DRV-11, DRV-12.
- **Functional behavior:**
  1. An entry shows its attachments with their state.
  2. Tapping an uploaded attachment opens it.
  3. If the Drive file no longer exists, the item shows "File no longer in Drive" instead of failing.
- **Business rules:** Until sub-project 6, only the uploader sees their photos on shared vehicles (§23.5 *Attachment visibility*). A deleted Drive file shows "File no longer in Drive" (§23.5 *Attachment cleanup*).
- **Edge cases:** Offline viewing of an already uploaded photo. A very large PDF. Access revoked. Decision applied: ED-09.
- **Android/web differences:** Web fetches online; native behavior per ED-09.
- **Offline behavior:** Per ED-09.
- **Security implications:** A user sees only the files they uploaded.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. An uploaded photo and an uploaded PDF each open from the entry [§23.5].
  2. A file deleted in Drive shows "File no longer in Drive" and the entry still works [§23.5 *Attachment cleanup*].
  3. On a shared vehicle, a photo uploaded by someone else is not shown to this user [§23.5 *Attachment visibility*].
- **Decisions applied:** ED-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-09 ◐] A photo opens as a thumbnail then full screen from a cache capped at 100 MB (least recently used); a PDF opens in the system viewer; the cache is cleared at sign-out; uncached items are unavailable offline.
- **Test requirements:** RNTL with fakes; manual check after deleting a file in Drive.
- **Dependencies:** DRV-03, DRV-11, DRV-12.
- **PRD requirement IDs:** PR-14, OQ-54; §23.5 *Attachment visibility*, *Attachment cleanup*.
- **SRS reference:** Receipt photos L474–480.

### DRV-14 — Receipt cleanup on delete
- **Epic:** D3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want deleting an attachment, an entry or a vehicle to remove the receipts I uploaded, so that no orphan files stay in my Drive.
- **Business value:** Keeps the user's Drive tidy and honors deletion (OQ-51).
- **Scope:** *In:* deleting an attachment deletes its Drive file if the user uploaded it; deleting an entry deletes its Drive files after the 5-second Undo window; deleting a vehicle deletes the receipt files the user uploaded and that vehicle's receipt folder, after the typed-name confirmation; files uploaded by other members stay in their own Drives; cancelling queued uploads for deleted items. *Out:* account deletion (tab 8: receipts stay in the user's Drive).
- **Preconditions:** DRV-12, `LOG-14`, `FND-VEH-04`.
- **Functional behavior:**
  1. Removing an attachment from an entry deletes its Drive file when `ownerUid` is the user.
  2. After the Undo window of an entry delete, the entry's Drive files are deleted.
  3. Deleting a vehicle also deletes the user's uploaded receipts for it and the vehicle's receipt folder.
  4. Queued uploads for removed items are cancelled.
- **Business rules:** Entry deletion deletes the Drive files after the Undo window; vehicle deletion deletes the receipt files the user uploaded and the vehicle's receipt folder after the typed-name confirmation; files uploaded by other members stay in their own Drives; for account deletion, receipts stay (OQ-51, OQ-45).
- **Edge cases:** Drive unreachable at delete time. The file is already gone. Partial vehicle deletion. Decision applied: ED-10: retry of failed Drive deletes, permanent delete versus Drive trash, and ordering relative to the Firestore delete.
- **Android/web differences:** Web needs the network; Android may defer.
- **Offline behavior:** Per ED-10.
- **Security implications:** Only files the user's app created and the user uploaded are deleted.
- **Data/schema impact:** Updates `attachments[]` and `uploaderUids` on edit; none for deleted entries.
- **Acceptance criteria:**
  1. Removing an attachment deletes its Drive file when the user uploaded it [§23.5 *Attachment cleanup*].
  2. Undoing an entry delete within 5 seconds deletes no Drive file; after the window the files are deleted [OQ-45, OQ-51].
  3. Deleting a vehicle removes the user's uploaded receipts and the vehicle's folder [OQ-51].
  4. A file uploaded by another member is not deleted [OQ-51].
- **Decisions applied:** ED-08 ◐, ED-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-08 ◐] Uploads run one at a time in order, retry after 1, 5 and 15 minutes then 1 hour, and become `failed` after 5 attempts with a manual Retry; sign-out warns about queued uploads and discards them; deleting the entry cancels its queued items; the queue runs only while the app is in the foreground and online.
  2. **D2** [ED-10 ◐] A failed Drive delete is retried up to 5 times on later opens; deletes are permanent; a file reported missing or trashed shows 'File no longer in Drive'; vehicle delete removes the Drive receipt files and receipt folder before the Firestore subtree, and a Drive failure does not block it.
- **Test requirements:** Jest with fake Drive and timers; manual run on a test Drive.
- **Dependencies:** DRV-12, LOG-14, FND-VEH-04.
- **PRD requirement IDs:** PR-14, OQ-45, OQ-51; §23.5 *Attachment cleanup*.
- **SRS reference:** Receipt photos L474–480; History L363; OQ-51 L687; OQ-45 L670.

---

# D4 — CSV export

### DRV-15 — CSV builder
- **Epic:** D4 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want a pure CSV builder, so that the export is correct for every entry type and every currency.
- **Business value:** CSV is how a user takes their data elsewhere; mistakes here are mistakes in the user's own records.
- **Scope:** *In:* build one combined CSV for a vehicle or all vehicles and a date range: common columns date, vehicle, type, category, amount, currency, odometer, notes, logged by, then type-specific columns for fuel, service, income, trip and inspection; service line items flattened into one cell such as "Engine oil: 1200; Air filter: 400"; labour and discount in their own columns; amounts as plain decimals with the currency in its own column and decimal digits following each currency; UTF-8 with a byte-order mark. *Out:* delivery (DRV-16).
- **Preconditions:** `FND-DAT-01` (`money.ts`), `FND-DAT-02`, `LOG-03`.
- **Functional behavior:**
  1. `buildCsv(entries, vehicles, range)` returns the file contents.
  2. Each row is one entry; type-specific columns are filled only for that type.
  3. Amounts are decimals with the currency's own digits and a Currency column.
- **Business rules:** §23.5 *CSV content*, Appendix E *CSV columns*; OQ-52. The file is UTF-8 with a byte-order mark so Excel shows ₹ correctly.
- **Edge cases:** Notes with commas, quotes or line breaks. Currencies with 0 or 3 decimals. Trips and inspections with no amount. Mixed currencies in "all vehicles". Decision applied: ED-11: date and time format and zone, boolean and decimal text, header wording and order, and how quantities and per-unit prices are written.
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** The file contains personal data; delivery is by the user's choice.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The file starts with a UTF-8 byte-order mark and ₹ displays correctly in a spreadsheet [OQ-52].
  2. Common and type-specific columns match Appendix E [Appendix E *CSV columns*].
  3. A service with two lines produces one cell like "Engine oil: 1200; Air filter: 400", with labour and discount in their own columns [§23.5 *CSV content*].
  4. Amounts are plain decimals with digits per currency and a separate Currency column [OQ-52].
- **Decisions applied:** ED-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-11 ◐] The CSV uses `YYYY-MM-DD HH:mm` local dates, English Appendix E headers, common columns first then the fuel, service, income, trip and inspection groups, `yes` and `no` booleans, `.` decimals, an `odometer unit` column, RFC 4180 quoting with line breaks allowed inside quotes, and empty cells where not applicable.
- **Test requirements:** Jest with fixtures for every type and for 0-, 2- and 3-decimal currencies (TS-03 style).
- **Dependencies:** FND-DAT-01, FND-DAT-02, LOG-03.
- **PRD requirement IDs:** PR-13, PR-02, NFR-08, FR-DATA-13, OQ-31, OQ-52, TS-03; Appendix E *CSV columns*.
- **SRS reference:** CSV export L482–488; CSV columns L791–801; OQ-52 L688.

### DRV-16 — Export CSV from Backup & export
- **Epic:** D4 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As any user, including one who never linked Google, I want to export my data as a CSV and take it elsewhere, so that I am never held hostage.
- **Business value:** The "never held hostage" promise in practice; anonymous users can take their data out too (§23.5 *CSV delivery*).
- **Scope:** *In:* an export action on More → Backup & export: choose one vehicle or all vehicles and a date range; build the file (DRV-15); hand it to the Android share sheet or start a browser download. *Out:* PDF or image export (not in v1).
- **Preconditions:** DRV-15, DRV-07.
- **Functional behavior:**
  1. The user chooses the scope and the date range and taps export.
  2. On Android the system share sheet opens with the file; on web the browser downloads it.
  3. No Google account or Drive access is needed.
- **Business rules:** One combined CSV per vehicle (or all vehicles) for a date range; delivered by the share sheet or a browser download; no Google account needed (§23.5 *CSV scope*, *CSV delivery*). Export is free forever (PR-02).
- **Edge cases:** A range with no entries. Very large exports. The user cancels the share sheet. Decision applied: ED-12: how the range is chosen, the file name, whether archived vehicles are included in "all vehicles".
- **Android/web differences:** Share sheet on Android; browser download on web.
- **Offline behavior:** Works fully offline on Android from the cache (no Drive needed).
- **Security implications:** The file leaves the app only through the user's chosen share target; a temporary file is removed afterwards.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. An anonymous user can export a CSV with no Google account [§23.5 *CSV delivery*].
  2. Android opens the share sheet and web downloads the file [§23.5].
  3. The user can export one vehicle or all vehicles for a chosen date range [§23.5 *CSV scope*].
  4. Export works in airplane mode on Android [PR-03].
- **Decisions applied:** ED-12 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-12 ◐] The export range offers the Reports ranges plus Custom with the default All time; 'all vehicles' excludes archived vehicles unless a toggle is on; the file is named `milevana-export-<vehicle or all>-<YYYY-MM-DD>.csv` and its temporary copy is deleted after the share sheet closes.
- **Test requirements:** RNTL with share-sheet fake; manual run on both platforms, opening the file in a spreadsheet.
- **Dependencies:** DRV-15, DRV-07.
- **PRD requirement IDs:** PR-02, PR-13, PR-03, L2; §23.5 *CSV scope*, *CSV delivery*.
- **SRS reference:** CSV export L482–488; OQ-52 L688; Limitations L826.

---

# D5 — Verification

### DRV-17 — Drive, receipts and export verification
- **Epic:** D5 · **Type:** Verification · **Size:** M · **Readiness:** Ready once DRV-03 to DRV-16 are built
- **User story:** As the maintainer, I want the Drive, receipt and export flows proven with a real Google account on both platforms, so that users' data and files are safe.
- **Business value:** These features touch the user's own Drive and their records; nothing here can be proven with unit tests alone.
- **Scope:** *In:* a manual checklist and run record with test accounts: scope request and decline; cross-client file visibility; a full backup and restore round trip including the "deleted on purpose" warning and per-vehicle choices; automatic backup after the interval and retention of the last 10; airplane-mode receipt queue and resume after a kill; full-Drive message; "File no longer in Drive"; cleanup on attachment, entry and vehicle delete; CSV opened in a spreadsheet (₹, commas, line breaks) and exported by an anonymous user; Maestro airplane-mode flow extended with an attachment; the manifest check (camera allowed; no media-read or location permission). *Out:* the Play closed test.
- **Preconditions:** DRV-03 to DRV-16.
- **Functional behavior:** Runnable by someone other than the author.
- **Business rules:** Link Google is manual (OQ-37). Web has a manual smoke test (TS-07).
- **Edge cases:** A different Google account than the linked one; a very large backup.
- **Android/web differences:** Both platforms are exercised.
- **Offline behavior:** The airplane-mode receipt and export flows are the native offline proof.
- **Security implications:** Test accounts and test data only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A backup made on Android restores on web, and the reverse [OQ-54, OQ-20].
  2. Backup then restore of a vehicle whose entries were deleted brings them back with the warning shown [OQ-53].
  3. A receipt added in airplane mode appears in Drive after reconnecting [§23.5 *Attachments offline*].
  4. The CSV opens in a spreadsheet with ₹ and special characters intact [OQ-52].
  5. The release manifest has the camera permission and no `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or location permission [AC-D19, AC-D20].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** DRV-03 to DRV-16.
- **PRD requirement IDs:** PR-13, PR-14, TS-06, TS-07, OQ-37; AC-D19, AC-D20.
- **SRS reference:** Testing L309–322; Drive and export L459–492; OQ-37 L658.

---

# A. Drive and export epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **D1 Drive foundation** | Two spikes, the Drive client for Android and web, the permission flow, the folder layout | DRV-01 to DRV-05 |
| **D2 Backup and restore** | The backup file, the Backup & export screen with manual backup, automatic backup with retention, restore review and apply | DRV-06 to DRV-10 |
| **D3 Receipts** | Adding receipts, the offline upload queue, viewing, cleanup on delete | DRV-11 to DRV-14 |
| **D4 CSV export** | The CSV builder and the export action | DRV-15, DRV-16 |
| **D5 Verification** | Real-account checks on both platforms | DRV-17 |

**Architectural versus user-facing.** Architecture or spike: DRV-01, DRV-02, DRV-03, DRV-05, DRV-06, DRV-15 (DRV-12 is the queue mechanism and also user-visible). User-facing: DRV-04, DRV-07 to DRV-14, DRV-16. Verification: DRV-17.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`ED-nn`, or an earlier `DR-nn`, `LD-nn`, `PD-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | DRV-01 | Spike: `drive.file` visibility across clients | S | FND-PLT-02 |
| W1 | DRV-02 ◆ | Spike: quota of backup, restore, export, uploads | S | FND-VER-01, LOG-01, RPT-01 |
| W1 | DRV-15 ◆ | CSV builder | L | FND-DAT-01, FND-DAT-02, LOG-03 |
| W2 | DRV-03 ◆ | Drive client (native and web) | XL | FND-PLT-02, FND-DAT-03, FND-DAT-04, DRV-01 |
| W2 | DRV-06 ◆ | Backup file: build and read | L | FND-DAT-08, FND-DAT-07 |
| W3 | DRV-04 ◆ | Drive permission flow | M | DRV-03, FND-AUTH-04, FND-SET-01 |
| W3 | DRV-05 ◆ | Drive layout and per-vehicle receipt folders | M | DRV-03, FND-DAT-06 |
| W4 | DRV-07 ◆ | Backup & export screen and manual backup | L | DRV-04, DRV-05, DRV-06, FND-SHL-02 |
| W4 | DRV-11 ◆ | Add receipt photos and PDFs | L | DRV-04, DRV-05, LOG-04, LOG-13 |
| W5 | DRV-08 ◆ | Automatic backup and retention | M | DRV-07; gate DRV-02 |
| W5 | DRV-09 ◆ | Restore: choose and review | L | DRV-06, DRV-07 |
| W5 | DRV-12 ◆ | Offline upload queue | XL | DRV-03, DRV-05, DRV-11 |
| W5 | DRV-16 ◆ | Export CSV from Backup & export | M | DRV-15, DRV-07 |
| W6 | DRV-10 ◆ | Restore: apply | XL | DRV-09, FND-DAT-08, FND-SEC-02; gate DRV-02 |
| W6 | DRV-13 ◆ | View receipts and missing files | M | DRV-03, DRV-11, DRV-12 |
| W6 | DRV-14 ◆ | Receipt cleanup on delete | M | DRV-12, LOG-14, FND-VEH-04 |
| W7 | DRV-17 | Drive, receipts and export verification | M | DRV-03 to DRV-16 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | DRV-01 ∥ DRV-02 ∥ DRV-15 | Two spikes and a pure CSV builder with no Drive dependency |
| Client and format | DRV-03 ∥ DRV-06 | The Drive client and the backup file format are independent |
| Permission and layout | DRV-04 ∥ DRV-05 | The permission UI and the folder service use the client differently |
| Screen and receipts | DRV-07 ∥ DRV-11 | Backup screen versus entry-form attachments |
| Backup, restore, queue, CSV | DRV-08 ∥ DRV-09 ∥ DRV-12 ∥ DRV-16 | Different screens and services |
| Last features | DRV-10 ∥ DRV-13 ∥ DRV-14 | Restore apply, viewing and cleanup |

**Not parallel:** DRV-04 and DRV-05 wait on DRV-03; DRV-10 waits on DRV-09; DRV-12 waits on DRV-11; DRV-17 is last.

**Early starts.** DRV-15 and DRV-16's non-Drive parts need no Drive access and can ship as soon as ready. DRV-06's format work can begin during W1.

---

# D. Blocking dependencies

**D1. Earlier sub-projects must be accepted first.** The PRD lists Foundation (serializer, OAuth client), Logging (entries) and linking. Needed specifically: `FND-PLT-02`, `FND-AUTH-03`, `FND-AUTH-04`, `FND-AUTH-06`, `FND-DAT-08`, `FND-DAT-06`, `FND-SHL-02`, `FND-SET-01`; from Logging `LOG-03`, `LOG-04`, `LOG-13`, `LOG-14`; `FND-VEH-04` for vehicle deletion. Reports and Reminders are not prerequisites, but their data is part of the backup (reminders) and `RPT-01` informs the quota check.

**D2. Spike DRV-01 first.** The PRD calls Android/web `drive.file` visibility an `[External — verify]` item. If cross-client visibility does not hold, "backup and restore work on web too" and web receipt viewing change, which affects DRV-03, DRV-07, DRV-09, DRV-13.

**D3. Quota gate.** DRV-02 must pass before DRV-08 and DRV-10 are accepted; it cannot pass until Foundation's DR-20 is answered.

**D4. Decisions that block the data and format.** ED-04 (backup contents) and ED-07 (`attachments[].status` values and file rules) fix formats that users' backups and Drive files will carry. The model and file format are meant to avoid later migrations, so both should be settled before DRV-06 and DRV-11 ship.

**D5. Restore depends on the merge path.** DRV-10 reuses the serializer write path proven in Foundation (batches of 500, vehicles first, rewritten attribution). ED-05 and ED-06 should be settled before it is built.

**D6. External.** A Google Cloud project with the Drive API enabled and the `drive.file` scope available to the existing OAuth clients; two test Google accounts; a test Drive. The consent-screen publishing and verification are tab 8 work (OQ-28); a test-user-only consent screen may restrict who can grant the scope during development.

**D7. Later tabs.** Receipt sharing with members through Drive permissions is tab 6 and builds on `uploaderUids` and `sharedWithUids` written here; account deletion (tab 8) leaves receipts in the user's Drive; inspection photos (tab 7) reuse the attachment mechanism. Nothing here should block them.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema** = needed before data or files in the final format are written · **Story** = before the named story is accepted · **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **ED-01** | **Drive token life and account match.** How the access token is obtained and refreshed after expiry on each platform; what happens when access is revoked in the Google account; whether Drive must use the same Google account that is linked to Firebase and what happens if the user picks another (notably in the web popup); where "Drive access granted once" is remembered, given that Android and web grant separately. | §23.5 *Auth* names the libraries and incremental scope request. OQ-53 says automatic backup stays off until access was granted once. No lifecycle or storage is stated. | DRV-03, DRV-04, DRV-08 | Story |
| **ED-02** | **Permission explanation and decline.** The one-line text; how a user who declined is invited to try again; whether the ask is once or per feature. | §23.5 *Permission* fixes "one-line explanation first" and "if declined, everything else keeps working". | DRV-04 | Copy |
| **ED-03** | **Automatic backup details.** How "older than the chosen frequency" is measured (24 hours or calendar days); whether a manual backup resets the clock; whether an unchanged dataset is skipped; what a failure does (retry on next open, a message, silence); two devices stale at once; how automatic backups are told apart from manual ones for retention; when old ones are deleted and what a failed delete does. | OQ-13 and §23.5 *Retention* give the trigger and the count of 10. | DRV-08 | Story |
| **ED-04** | **Backup contents.** Which settings keys are included; whether entries' `attachments[]` and `uploaderUids` and `sharedWithUids` are kept or stripped (receipt files are not in the backup); the `formatVersion` value and scheme; the source of the app version. | Appendix E lists the fields and says "settings" without naming keys. | DRV-06, DRV-07 | Schema |
| **ED-05** | **Restore matching and replace.** How backup items are matched to current ones (by id); what "missing" means per document type; what "differs" compares (vehicle fields only, or entries, reminders, templates too); what "replace" does to current documents that are not in the backup; what happens to `lastOdometer`; what happens when the user no longer owns a vehicle. | §23.5 and OQ-53 say "restores what's missing, asks about the rest" and "keep current or replace with the backup's copy" once per vehicle. | DRV-09, DRV-10 | Story |
| **ED-06** | **Restore execution.** Progress and cancel; failure partway and whether retry data is kept on disk like the merge; behavior if the app is killed; an unsupported older or newer `formatVersion`; quota exhaustion midway. | OQ-22 and OQ-35 cover write ordering and batch size. Failure and resume are stated only for the merge. | DRV-10 | Story |
| **ED-07** | **Attachment details.** The values and transitions of `attachments[].status`; accepted image types and output format and quality; whether only PDFs are allowed as documents; the file name in Drive; `sizeBytes` after compression; handling of orientation metadata. | Appendix E names the fields; §23.5 gives only size targets. | DRV-11, DRV-12 | Schema |
| **ED-08** | **Upload queue semantics.** Order and concurrency; retry and give-up; which networks and when the queue runs (foreground only or also in the background); how the user sees queued items; what happens to queued items at sign-out (FR-OUT-05 does not list them), when the user unlinks, and when their entry is deleted while queued. | PRD §16.4 says "the upload queue's semantics, retry policy and ordering are defined in tab 5", and §23.5 gives only "wait in a local queue until online, then upload". | DRV-12, DRV-14 | Story |
| **ED-09** | **Viewing receipts.** How photos and PDFs are fetched and shown (thumbnails, full size, an external PDF viewer); local caching and offline viewing; cache limits and clearing at sign-out; web behavior. | §23.5 says only that the uploader sees their photos and "File no longer in Drive" is shown for a missing file. | DRV-13 | Story |
| **ED-10** | **Cleanup details.** Retry of a failed Drive delete; permanent delete versus Drive trash; how "File no longer in Drive" is detected (missing or trashed); the order of vehicle-delete steps (Drive files and folder versus the Firestore subtree) and what a partial failure leaves. | OQ-51 fixes what is deleted and when relative to the Undo window. | DRV-14 | Story |
| **ED-11** | **CSV content.** The date and time format and zone (ISO or the user's date-format setting); header wording and language; column order within groups; true and false text; decimal separator; how quantity and price per unit are written (price is stored in thousandths of a minor unit); the odometer's unit; whether inspection columns are present before tab 7; quoting and line-break rules; empty cells. | Appendix E lists the column names only; OQ-52 fixes amount decimals, the Currency column and the byte-order mark. | DRV-15 | Story |
| **ED-12** | **CSV range and delivery.** How the date range is chosen (the Reports ranges or custom only) and its default; whether "all vehicles" includes archived vehicles; the file name; the lifetime of the temporary file. | §23.5 says "for a date range" and "per vehicle (or all vehicles)". | DRV-16 | Story |
| **ED-13** | **Backup & export screen.** States and wording (not linked, no Drive access, in progress, failed); where a user deletes a manual backup (in the app, or only in Drive); whether backups are listed outside Restore; where the CSV export sits. | §23.5 lists last backup time, Back up now, Restore and the frequency setting; "manual backups are kept until the user deletes them" names no delete action. | DRV-07 | Story |
| **ED-14** | **Web specifics.** How attachments are chosen on web (file selection, any camera use); whether an upload must finish before the entry is saved on web; any other web differences for backup and restore. | OQ-20 says attachments work on web online only and automatic backup is Android only. | DRV-09, DRV-11 | Story |

**Decisions from earlier sub-projects that carry in:** Foundation DR-03 stored encodings and seeded settings keys (`backupFrequency`) · DR-05 vehicle name rules (folder names) · DR-13 archived vehicles · DR-16 copy gaps · DR-20 quota threshold · Logging LD-04 entry date · LD-06 category storage · LD-07 income platform · LD-12 and LD-13 delete and Undo edges · Reports PD-01 ranges · PD-08 archived vehicles in "all vehicles".

**Can start before any decision is answered:** DRV-01 and DRV-02, DRV-15's stated columns and encoding, DRV-03's interface, DRV-05's folder creation, DRV-06's stated fields, and DRV-11's picker and size rules.

---

# F. Drive and export Definition of Done

The PRD defines no acceptance criteria for sub-project 5, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.5)**
- [ ] A linked user can back up manually to `Milevana/Backups/` in their own Drive, see the last backup time, and set the frequency (daily, weekly by default, monthly, off); web works too.
- [ ] Automatic backup runs on app open on Android when stale, for linked users, on any network, only after Drive access was granted once; the last 10 automatic backups are kept and manual ones never deleted automatically.
- [ ] Restore lists backups with the latest preselected, restores what is missing, asks once per differing owned vehicle (keep current or replace), warns that entries deleted on purpose will return, restores settings only if ticked, and touches only owned vehicles.
- [ ] A user can attach up to 5 photos or PDFs to an entry; photos are compressed and PDFs are limited to 5 MB; entries save at once and files upload later from a durable queue.
- [ ] A full Drive shows a clear message and keeps the item queued; a file deleted in Drive shows "File no longer in Drive".
- [ ] Deleting an attachment, an entry (after the Undo window) or a vehicle removes the user's uploaded files and the vehicle's receipt folder; other members' files stay.
- [ ] CSV export works for one vehicle or all vehicles and a date range, with the Appendix E columns, flattened service items, plain decimals with a Currency column, UTF-8 with a byte-order mark; delivered through the share sheet or a browser download with no Google account needed.
- [ ] Drive access is requested the first time a Drive feature is used with a one-line explanation; declining leaves everything else working.

**Behavior**
- [ ] Only the uploader sees their photos until sub-project 6.
- [ ] The camera permission is declared; `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` and location permissions are absent (AC-D19, AC-D20).
- [ ] Backup, restore and export are not paywalled (PR-02).

**Evidence**
- [ ] DRV-01 confirmed cross-client visibility (or the design was changed accordingly).
- [ ] DRV-02 passed: the quota budget holds.
- [ ] Round-trip tests of the backup file and the CSV builder pass (TS-03 style).
- [ ] An emulator integration test of the restore write path passes, including failure and retry (OQ-37).
- [ ] DRV-17 is run and recorded on both platforms.

**Scope and quality**
- [ ] No out-of-scope feature exists: no sharing of receipts, no account deletion, no report export.
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `ED-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 5; the last column cites the story's own criteria (`#n`) plus the applicable Foundation `AC-D`, test requirement or gate.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| DRV-01 | FR-SCAF-04, OQ-20, OQ-54; §24.4 | OQ-54 L690; Permission L490–492; Backup L465–472 | #1–#3 |
| DRV-02 | NFR-06, NFR-19, NFR-20, RK-25, OQ-18, OQ-35 | OQ-18 L642; OQ-35 L656; OQ-53 L689 | #1–#3 |
| DRV-03 | PR-13, PR-14, PRV-05, RK-09, FR-LINK-07, FR-SCAF-04, FR-OUT-05, NFR-14 | Libraries L113–114; Permission L490–492; OQ-54 L690 | #1–#5 |
| DRV-04 | PR-13, PR-14, FR-LINK-03, FR-LINK-07, OQ-53; §23.5 Permission | Permission L490–492; OQ-53 L689 | #1–#4 |
| DRV-05 | PR-13, PR-14, OQ-50, OQ-54; §23.5 Drive layout | Drive layout L465–472; OQ-50 L686; OQ-54 L690; L782–785 | #1–#4 |
| DRV-06 | PR-13, FR-SER-01, FR-SER-04, PRV-08, OQ-53; App. E Backup file | Backup L465–472; L787–789; OQ-53 L689 | #1–#4 |
| DRV-07 | PR-02, PR-13, FR-LINK-03, FR-SET-05, OQ-20, OQ-50; §23.5 Backup & export screen | Backup L465–472; Navigation L259; Settings L281 | #1–#5 |
| DRV-08 | PR-13, PR-02, OQ-13, OQ-20, OQ-53; §23.5 Automatic backup, Retention | Backup L465–472; OQ-13 L685; OQ-53 L689 | #1–#5 |
| DRV-09 | PR-13, PR-02, OQ-20, OQ-53; §23.5 Restore | Restore L472; OQ-53 L689 | #1–#5 |
| DRV-10 | PR-13, FR-SER-02, FR-SER-03, OQ-22, OQ-35, OQ-37, OQ-53; AC-D21 | Restore L472; OQ-22 L645; OQ-35 L656; OQ-53 L689 | #1–#5; AC-D21 |
| DRV-11 | PR-14, PRV-02, FR-SCAF-03, FR-LINK-03, NFR-03, OQ-41, OQ-54; AC-D19, AC-D20 | Receipt photos L474–480; L152–153; OQ-41 L666; OQ-54 L690 | #1–#5; AC-D19, AC-D20 |
| DRV-12 | PR-14, PR-03, FR-OFF-10, OQ-20, OQ-56, L2 | Receipt photos L474–480; OQ-56 L695; Limitations L826 | #1–#5 |
| DRV-13 | PR-14, OQ-54; §23.5 Attachment visibility, Attachment cleanup | Receipt photos L474–480 | #1–#3 |
| DRV-14 | PR-14, OQ-45, OQ-51; §23.5 Attachment cleanup | Receipt photos L474–480; History L363; OQ-51 L687; OQ-45 L670 | #1–#4 |
| DRV-15 | PR-13, PR-02, NFR-08, FR-DATA-13, OQ-31, OQ-52, TS-03; App. E CSV columns | CSV export L482–488; L791–801; OQ-52 L688 | #1–#4 |
| DRV-16 | PR-02, PR-13, PR-03, L2; §23.5 CSV scope, CSV delivery | CSV export L482–488; OQ-52 L688; Limitations L826 | #1–#4 |
| DRV-17 | PR-13, PR-14, TS-06, TS-07, OQ-37; AC-D19, AC-D20 | Testing L309–322; Drive and export L459–492; OQ-37 L658 | #1–#5; AC-D19, AC-D20 |

**G2. §23.5 scope item → covering stories** (proves each item is covered).

| §23.5 scope item | Stories |
| --- | --- |
| Drive access, scope requested incrementally, one-line explanation first, decline keeps app working | DRV-03, DRV-04 |
| Linking required before Drive features | DRV-04, DRV-07, DRV-11 |
| Drive folder "Milevana" with `Backups/` and `Receipts/<vehicle name>/`; folder ids in user document | DRV-05 |
| Backup file format (JSON, owned vehicles, settings, members by name) | DRV-06 |
| Manual backup; Backup & export screen; frequency setting; works on web | DRV-07 |
| Automatic backup on open when stale; retention of last 10 | DRV-08 |
| Restore: latest preselected, restore missing, ask per vehicle, owned vehicles only, settings if ticked | DRV-09, DRV-10 |
| Receipt photos and PDFs: camera, gallery, PDF; up to 5; compression and size limits | DRV-11 |
| Offline upload queue; full-Drive message | DRV-12 |
| Uploader-only visibility; "File no longer in Drive" | DRV-13 |
| Cleanup on attachment, entry and vehicle delete | DRV-14 |
| CSV: columns, flattening, decimals and Currency column, UTF-8 with byte-order mark | DRV-15 |
| CSV delivery without a Google account | DRV-16 |
| `drive.file` visibility across Android and web; quota budget | DRV-01, DRV-02 |
