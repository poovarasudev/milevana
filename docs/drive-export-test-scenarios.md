# Milevana v1 — Sub-project 5: Drive and export — Test Scenarios

**Source:** `docs/drive-export-backlog.md` (17 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story; the criteria are the derived ones the backlog proposed.
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual with real Google accounts. **Priority:** C Critical · H High · M Medium · L Low.
- Drive scenarios need **two test Google accounts** and a test Drive. Link Google is manual (OQ-37).

---

### DRV-01 — Spike: `drive.file` visibility across clients
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV01-01 | Cross-client visibility | One Google account, Android app and web app | 1. Create a folder and file from Android ⇒ list and download on web.<br>2. Create from web ⇒ list and download on Android.<br>3. Repeat with a different Google account than the linked one ⇒ result recorded | MAN | C | #1, D1 |
| SC-DRV01-02 | Configuration and feasibility | Results above | 1. OAuth and project configuration written down.<br>2. "Restore on web" and "view receipts on web" marked feasible or not | MAN | H | #2, #3 |

### DRV-02 — Spike: quota of backup, restore, export, uploads
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV02-01 | Count and project | Emulator logging; 3 vehicles, 5,000 entries | 1. Measure manual backup, automatic backup on open, restore of 501 and 5,000 entries, CSV for one and all vehicles, metadata updates ⇒ table.<br>2. Project at 100 and 500 users against 25,000 reads and 10,000 writes ⇒ pass or fail.<br>3. `DRV-08`/`DRV-10` accepted before pass ⇒ not allowed | MAN | H | #1, #2, #3, D1 |

### DRV-03 — Drive client (native and web)
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV03-01 | Incremental scope | Linked account, no Drive access yet | 1. First Drive call ⇒ requests `drive.file`.<br>2. Later calls ⇒ no new request | MAN | C | #1 |
| SC-DRV03-02 | Operations on both platforms | Test Drive | 1. Create, upload, download, list, delete on Android and on web ⇒ succeed | MAN | C | #2 |
| SC-DRV03-03 | Errors | Fake Drive API | 1. Drive full, file missing, access revoked ⇒ three distinct normalized errors.<br>2. Revoked access ⇒ next action shows "Drive access was removed" and re-runs the permission flow | U | H | #3, D1 |
| SC-DRV03-04 | Account match and flag | Web, two Google accounts | 1. Choose an account other than the linked one ⇒ rejected with "Use <linked email>".<br>2. The "access granted" flag is stored per device keyed by uid | MAN | H | D1 |
| SC-DRV03-05 | Sign-out and boundaries | Linked user | 1. Sign out ⇒ no Drive token or Google session left.<br>2. Lint ⇒ no file outside the client imports a platform Drive library | U | H | #4, #5 |

### DRV-04 — Drive permission flow
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV04-01 | Explanation then request | Linked account | 1. Open Backup & export, tap Back up now ⇒ one-line text "Milevana needs a folder it creates in your Google Drive… It can't see your other files." then the Drive request.<br>2. Grant ⇒ later uses show no second request | C | C | #1, #4, D2 |
| SC-DRV04-02 | Anonymous routing | Anonymous user | 1. Tap a Drive feature ⇒ routed through linking first | M | H | #2 |
| SC-DRV04-03 | Decline | Linked account | 1. Decline ⇒ the feature does not run, everything else works.<br>2. "Allow Drive access" button appears on Backup & export and in the attachment area ⇒ true | C | H | #3, D2 |
| SC-DRV04-04 | Revoked access and account match | Access granted earlier; web with two Google accounts | 1. Remove the app's access in the Google account, then tap Back up now ⇒ "Drive access was removed" and the permission flow runs again.<br>2. On web choose a Google account other than the linked one ⇒ rejected with "Use <linked email>".<br>3. The "granted once" flag is kept per device keyed by uid ⇒ true | MAN | H | D1 |

### DRV-05 — Drive layout and receipt folders
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV05-01 | Root and subfolders | Empty Drive | 1. First action ⇒ "Milevana" with `Backups/` and `Receipts/`; ids stored in `users.drive` | MAN | C | #1 |
| SC-DRV05-02 | Per-vehicle folder, rename | Vehicle "Swift" | 1. First receipt ⇒ `Receipts/Swift/` and its id in `drive.vehicleFolderIds`.<br>2. Rename the vehicle ⇒ no new folder, old one not moved | MAN | H | #2, #3 |
| SC-DRV05-03 | Recovery and names | Folder deleted in Drive; two vehicles with the same name | 1. Stale id ⇒ recovered without duplicating a folder that still exists.<br>2. Vehicle names are unique per owner, so two same-name folders only arise through merge/restore ⇒ handled by id | U | H | #4, D1 |

### DRV-06 — Backup file: build and read
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV06-01 | Format | Fixture: 2 owned vehicles, 1 shared (not owned) | 1. File name `milevana-backup-YYYY-MM-DD-HHMM.json` ⇒ true.<br>2. Top level has `formatVersion` 1, `createdAt`, `kind`, `app` (Milevana, version), `settings`, `vehicles` ⇒ true | U | C | #1, D1 |
| SC-DRV06-02 | Scope and privacy | Owned vehicle with members | 1. Only owned vehicles included; members as `{uid, name, role}` with no email.<br>2. Settings hold only the listed keys; entries keep `attachments[]` and `uploaderUids` with `sharedWithUids` empty | U | C | #2, #4, D1 |
| SC-DRV06-03 | Round trip | 501-entry vehicle | 1. Build then read ⇒ every field equal | U | C | #3 |

### DRV-07 — Backup & export screen and manual backup
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV07-01 | Screen content | Linked, Drive granted | 1. Shows last backup time, Back up now, Restore, frequency setting (daily, weekly default, monthly, off), CSV export | C | H | #1, #4, D2 |
| SC-DRV07-02 | Back up now | Linked, Drive granted | 1. Tap ⇒ `milevana-backup-…` appears in `Milevana/Backups/`, last backup time updates.<br>2. Settings key list per the backup rule ⇒ true | MAN | C | #2, D1 |
| SC-DRV07-03 | Platforms and states | Android, web, anonymous, declined, offline | 1. Works on Android and web.<br>2. States: "Link Google to back up", "Allow Drive access", "Backing up…", "Last backup failed. Retry".<br>3. "Your backups" lists manual backups with Delete removing the Drive file.<br>4. Declining leaves the app unaffected | MAN | H | #3, #5, D2 |

### DRV-08 — Automatic backup and retention
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV08-01 | Stale on open | Weekly; `lastBackupAt` 8 days ago; Drive granted | 1. Open the app ⇒ automatic backup created with property `kind=automatic`.<br>2. A manual backup the day before ⇒ no automatic one | U | C | #1, D2 |
| SC-DRV08-02 | Not eligible | Frequency off; Drive never granted; anonymous; web | 1. No backup runs in any of these cases ⇒ true | U | C | #2, #4, #5 |
| SC-DRV08-03 | Retention and failure | 10 existing automatic + 2 manual backups | 1. Make an 11th automatic ⇒ oldest automatic deleted, manual untouched.<br>2. Failed upload ⇒ silent, "Last backup failed", retried next open.<br>3. Failed delete ⇒ retried at the next automatic backup | U | H | #3, D2 |
| SC-DRV08-04 | Token behavior | Revoked access | 1. Open the app ⇒ automatic backup does not run and the next Drive action prompts again | MAN | M | D1 |

### DRV-09 — Restore: choose and review
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV09-01 | List and preselect | Three backups in Drive | 1. Restore lists them, latest preselected ⇒ true | C | H | #1 |
| SC-DRV09-02 | Summary | Backup vs current: 2 entries deleted, 1 vehicle edited, 1 vehicle no longer owned | 1. Summary lists the missing entries; the edited vehicle gets Keep current / Replace asked once.<br>2. Deleted-on-purpose warning shown.<br>3. Settings tick-box off by default.<br>4. The not-owned vehicle listed "Not restored (not yours)" and not offered | C | C | #2, #3, #4, #5, D1 |
| SC-DRV09-03 | Web | Browser | 1. Same review screens on web ⇒ true | MAN | M | D2 |

### DRV-10 — Restore: apply
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV10-01 | Missing items return | 5 entries deleted after the backup | 1. Restore ⇒ the 5 entries return with original dates; `lastOdometer` recomputed | E | C | #1, D1 |
| SC-DRV10-02 | Keep vs replace | One differing vehicle | 1. Keep current ⇒ existing documents untouched, missing ones still restored.<br>2. Replace ⇒ backup's version overwrites matching documents; nothing is deleted | E | C | #2, D1 |
| SC-DRV10-03 | Batches and rules | Backup with 1 vehicle, 501 entries | 1. Restore ⇒ batches of 500, vehicle first, no rules denial | E | C | #3 |
| SC-DRV10-04 | Failure, cancel, versions, quota | Failure injection | 1. Fail after batch 1, retry ⇒ no duplicates.<br>2. Cancel ⇒ stops after the current batch; re-run safe.<br>3. Newer `formatVersion` ⇒ refused "Update the app to restore this backup"; older ⇒ upgraded.<br>4. Quota error ⇒ "Sync paused" | E | C | #4, D2 |
| SC-DRV10-05 | Owned only | Backup includes a vehicle now owned by someone else | 1. Only owned vehicles change ⇒ true | E | C | #5 |

### DRV-11 — Add receipt photos and PDFs
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV11-01 | Sources | Linked, Drive granted, Android | 1. Add from camera, gallery and a PDF ⇒ each becomes an attachment with status `queued` | MAN | C | #1, D1 |
| SC-DRV11-02 | Limits and compression | Entry with 5 attachments; large photo; 6 MB PDF | 1. Add a sixth ⇒ refused.<br>2. Photo ⇒ JPEG quality 80, 1600 px long edge, orientation applied, metadata stripped, `sizeBytes` the stored size.<br>3. PDF over 5 MB ⇒ refused | U | C | #2, #3, D1 |
| SC-DRV11-03 | Anonymous and manifest | Anonymous user; release manifest | 1. Anonymous ⇒ routed through linking.<br>2. Manifest has the camera permission and none of `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, location | CI | C | #4, #5 |
| SC-DRV11-04 | Web | Browser | 1. File picker accepts images and PDF; the entry saves only after its upload finishes ⇒ true | MAN | H | D2 |

### DRV-12 — Offline upload queue
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV12-01 | Offline then upload | Airplane mode | 1. Save an entry with a photo ⇒ entry appears at once.<br>2. Reconnect ⇒ photo in `Receipts/<vehicle>/`, status `uploaded`, `driveFileId` and `uploaderUids` set | M | C | #1, #4 |
| SC-DRV12-02 | Resume after kill | Upload in progress | 1. Kill the app and reopen ⇒ upload resumes, no duplicate file | MAN | C | #2 |
| SC-DRV12-03 | Full Drive | Drive at quota | 1. Upload ⇒ clear message, item stays `queued` | MAN | H | #3 |
| SC-DRV12-04 | Retry and statuses | Fake Drive failing | 1. Retries after 1, 5, 15 minutes then 1 hour; after 5 attempts `failed` with manual Retry; Retry ⇒ `queued`.<br>2. FIFO, one at a time, foreground and online only, any network.<br>3. Queued items show a chip and "Waiting to upload (N)" | U | H | D1, D2 |
| SC-DRV12-05 | Sign-out, delete, web | Queued items; web | 1. Sign out ⇒ warning counts queued uploads; items discarded.<br>2. Delete the entry ⇒ queued items cancelled.<br>3. Web ⇒ no queue; upload only online | MAN | H | #5, D2 |

### DRV-13 — View receipts and missing files
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV13-01 | Open | Uploaded photo and PDF | 1. Photo opens as thumbnail then full screen; PDF opens in the system viewer ⇒ true | MAN | H | #1, D1 |
| SC-DRV13-02 | Missing file | Delete the file in Drive (and trash it in a second case) | 1. Entry shows "File no longer in Drive" and still works ⇒ true | MAN | C | #2 |
| SC-DRV13-03 | Visibility and cache | Shared vehicle; offline; sign-out | 1. Another member's photo not shown to this user.<br>2. Cached items viewable offline, uncached not; cache capped at 100 MB (LRU); cleared at sign-out | MAN | H | #3, D1 |

### DRV-14 — Receipt cleanup on delete
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV14-01 | Attachment and entry | Entry with 2 uploaded receipts | 1. Remove one ⇒ its Drive file deleted.<br>2. Delete the entry and Undo within 5 s ⇒ no Drive file deleted.<br>3. Delete and wait ⇒ files deleted (permanent) | MAN | C | #1, #2 |
| SC-DRV14-02 | Vehicle delete order | Vehicle with receipts and a Drive failure injected | 1. Delete ⇒ Drive receipt files and folder removed first, a Drive failure does not block, then the Firestore subtree | E | C | #3, D2 |
| SC-DRV14-03 | Others' files and retries | Shared vehicle with another member's receipt | 1. Other member's file not deleted.<br>2. A failed Drive delete ⇒ retried up to 5 times on later opens, then dropped.<br>3. Deleting the entry cancels queued uploads | MAN | H | #4, D1, D2 |

### DRV-15 — CSV builder
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV15-01 | Encoding | Any export | 1. File starts with a UTF-8 byte-order mark; ₹ displays in a spreadsheet ⇒ true | U | C | #1 |
| SC-DRV15-02 | Columns | One entry of each type | 1. Common columns then fuel, service, income, trip, inspection groups in that order; English headers; `odometer unit` column; inspection columns present even when empty ⇒ true | U | C | #2, D1 |
| SC-DRV15-03 | Service cell | Service with 2 lines, labour, discount | 1. Cell "Engine oil: 1200; Air filter: 400"; labour and discount in own columns ⇒ true | U | C | #3 |
| SC-DRV15-04 | Amounts and text | 0-, 2-, 3-decimal currencies; notes with commas, quotes, line breaks | 1. Plain decimals with a Currency column, digits per currency.<br>2. Dates `YYYY-MM-DD HH:mm`; `yes`/`no`; `.` decimals; RFC 4180 quoting with line breaks in quotes; empty cells where not applicable | U | C | #4, D1 |

### DRV-16 — Export CSV from Backup & export
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV16-01 | Anonymous export | Anonymous user with data | 1. Export ⇒ works with no Google account | MAN | C | #1 |
| SC-DRV16-02 | Delivery | Android; web | 1. Android ⇒ share sheet opens with the file.<br>2. Web ⇒ browser download.<br>3. Temporary copy deleted after the share sheet closes | MAN | H | #2, D1 |
| SC-DRV16-03 | Scope and range | Several vehicles incl. archived | 1. One vehicle or all; ranges = Reports ranges + Custom, default All time.<br>2. "All vehicles" excludes archived unless the toggle is on.<br>3. File name `milevana-export-<vehicle or all>-<YYYY-MM-DD>.csv` | C | H | #3, D1 |
| SC-DRV16-04 | Offline | Airplane mode | 1. Export on Android ⇒ works from the cache | MAN | M | #4 |

### DRV-17 — Drive, receipts and export verification
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DRV17-01 | Cross-platform restore | Backup from Android | 1. Restore it on web, and the reverse ⇒ succeeds | MAN | C | #1 |
| SC-DRV17-02 | Round trip with warning | Vehicle with deleted entries | 1. Back up, delete entries, restore ⇒ entries return with the warning shown | MAN | C | #2 |
| SC-DRV17-03 | Offline receipt | Airplane mode | 1. Add a receipt offline ⇒ appears in Drive after reconnecting | MAN | C | #3 |
| SC-DRV17-04 | CSV in a spreadsheet | Data with ₹, commas, line breaks | 1. Open ⇒ characters intact | MAN | H | #4 |
| SC-DRV17-05 | Release manifest | Release build | 1. Camera present; no `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` or location ⇒ true | CI | C | #5 |
