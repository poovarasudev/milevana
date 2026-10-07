# Milevana v1 — Foundation: Test Scenarios

**Source:** `docs/foundation-backlog.md` (39 stories, acceptance criteria, business rules, edge cases), traced to `docs/prd.md` and `docs/requirements.md` · **Date:** 2026-10-07

**Total scenarios:** 295 (209 original plus 86 decision-derived in the last section), across all 39 stories · **Coverage:** happy path, edge cases, error handling, security and privacy (no performance scenarios: the PRD sets no latency or coverage targets, NFR-19)

## How to read this document

- **Nothing new is specified here.** Every scenario restates a story's acceptance criterion, business rule or edge case. Decisions are now **applied** (✔ answered by the owner, ◐ assumed; see `docs/decisions-register.md`). Scenarios that depend on one are marked **Decisions applied** with the `DR-nn`, and the expected values come from the register. The one open fact is the Firestore location (DR-22).
- **Scenario IDs** (`SC-<story>-nn`) are labels for this document, not requirement IDs. The criterion a scenario covers is cited as `#n` (the n-th acceptance criterion of that story in the backlog), plus the PRD ID in brackets.
- **Level** says where it runs, following the PRD test layers (§21.2): **Unit** (Jest, domain), **Component** (React Native Testing Library), **Emulator** (Jest or rules suite against the Firebase emulator), **CI** (workflow check), **Maestro** (Android end-to-end), **Manual** (release checklist, test device or test Google account).
- **Priority:** Critical = data loss, security, or a "Done when" criterion (AC-F1 to AC-F7). High = a derived criterion (AC-D) or a stated business rule. Medium = edge case. Low = cosmetic or secondary. The source assigns no priorities, so this ranking is for test ordering only.
- **Roles:** *Anonymous user* (Android), *Linked user* (Android), *Web user* (Google-signed-in), *Owner*, *Maintainer* (build and CI work), *Non-member* (a signed-in user who is not a member of the vehicle).
- **Shortcuts in tables:** "Pre" is preconditions. Counts in examples (2 vehicles and 14 entries; 501 entries; 1,203 children; 3 + 2 entries) come from the backlog and PRD.

---

# E1 — Platform and tooling

### SC-PLT01-01 · Both platforms start from one codebase
**Tests:** FND-PLT-01 #1, #5 [FR-SCAF-01, FR-SCAF-02] · **Level:** Manual · **Priority:** High · **Role:** Maintainer
**Pre:** Repository checked out, dependencies installed.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Build and install an Android development build | Installs under `dev.poovarasu.milevana`, launches to the route stub |
| 2 | Serve the web build locally | Same route renders in the browser |
| 3 | Try to open the app in Expo Go | Not supported or not required; the development build is the supported path |

### SC-PLT01-02 · Release manifest has no forbidden permissions
**Tests:** FND-PLT-01 #2 [AC-D19, AC-D20] · **Level:** CI · **Priority:** Critical
**Pre:** A release Android build (or its merged manifest).

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Inspect the merged manifest | No `READ_MEDIA_IMAGES`, no `READ_EXTERNAL_STORAGE` |
| 2 | Search it for location permissions | None present |

### SC-PLT01-03 · A library re-adding a stripped permission is caught (edge)
**Tests:** FND-PLT-01 edge case, #2 · **Level:** CI · **Priority:** High
**Pre:** A throw-away branch whose dependency adds `READ_MEDIA_IMAGES` to the manifest.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Run the build config and the manifest check | The build config strips it, or the check fails the run if it survives |

### SC-PLT01-04 · No ad or analytics SDK
**Tests:** FND-PLT-01 #3 [AC-D20, PRV-04] · **Level:** CI · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Scan the dependency tree against a list of ad and analytics SDKs | None found |
| 2 | Add a listed SDK on a throw-away branch | The check fails |

### SC-PLT01-05 · Platform and native-SDK boundary is enforced
**Tests:** FND-PLT-01 #4 [FR-DATA-01, NFR-14] · **Level:** Unit (lint rule test) · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | In a file outside the adapters, import a native Firebase module | Lint fails |
| 2 | In a screen file, branch on `Platform.OS` | Lint fails |
| 3 | Make the same imports inside `firebase.native.ts` | Lint passes |

### SC-PLT01-06 · Native import reaching the web bundle fails the web build (edge)
**Tests:** FND-PLT-01 edge case · **Level:** CI · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Import a native-only module in shared code and build web | The web build fails |

---

### SC-PLT02-01 · Anonymous sign-in against the project
**Tests:** FND-PLT-02 #1 [FR-AUTH-02] · **Level:** Manual · **Priority:** Critical · **Decisions applied:** DR-22 (database must exist), DR-21 (rules available)
**Pre:** Development build, project `milevana` configured.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Launch the build with network and call anonymous sign-in | A Firebase anonymous user is created |

### SC-PLT02-02 · Google credential obtained on Android and web
**Tests:** FND-PLT-02 #2 [FR-LINK-04, FR-WEB-01] · **Level:** Manual · **Priority:** Critical · **Role:** Maintainer, test Google account
**Pre:** Test Google account.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | On Android, run Google Sign-In | An ID token is returned and can be exchanged for a Firebase credential |
| 2 | On web, open the Google popup and sign in | Sign-in completes |
| 3 | Run the same on a build lacking the SHA-1 (edge) | Fails clearly on device, confirming the SHA-1 requirement |

### SC-PLT02-03 · No Drive scope requested
**Tests:** FND-PLT-02 #3, #5 [FR-LINK-07, FR-SCAF-04] · **Level:** Manual · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Log the scopes requested during Android and web sign-in | Only basic sign-in scopes; no `drive.file` |
| 2 | Review the OAuth client configuration | No new client would be needed to add `drive.file` later |

### SC-PLT02-04 · Secrets are not in the repository
**Tests:** FND-PLT-02 #4 [OQ-38] · **Level:** CI · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Search the repository and history for `google-services.json` and signing material | None found |
| 2 | Run the build in CI | Config files are supplied from GitHub and EAS secrets |

### SC-PLT02-05 · Emulator starts with the project's rules and indexes
**Tests:** FND-PLT-02 Functional #3 · **Level:** CI · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Start the emulator suite | Starts with project id `milevana`, loads rules and indexes files |

---

### SC-PLT03-01 · A push runs every job
**Tests:** FND-PLT-03 #1 [FR-SCAF-06] · **Level:** CI · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Push a commit | Lint, typecheck, unit (domain and component), repository and rules jobs all start |
| 2 | Check the repository and rules jobs | Each starts and tears down the emulator |

### SC-PLT03-02 · A failing rules test fails the run
**Tests:** FND-PLT-03 #2 [TS-01] · **Level:** CI · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | On a throw-away branch, break one rules test | The run fails and shows which test |
| 2 | Repeat with a lint error, a type error, a failing unit test and a failing repository test | Each fails its own job |

### SC-PLT03-03 · A tag builds Android through EAS
**Tests:** FND-PLT-03 #3 [PRD §22.2] · **Level:** CI · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Push a release tag | An EAS Android build starts using secrets from the secret stores |
| 2 | Inspect the logs | No secret is printed |

### SC-PLT03-04 · Privacy checks run in CI
**Tests:** FND-PLT-03 #4 [AC-D19, AC-D20] · **Level:** CI · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Introduce a forbidden permission or ad SDK on a throw-away branch | The run fails |

### SC-PLT03-05 · Fork pull request without secrets (edge)
**Tests:** FND-PLT-03 edge case · **Level:** CI · **Priority:** Low

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open a PR from a fork | Jobs that need no secrets still run; jobs that need them are skipped without exposing anything |

---

# E2 — Domain and data layer

### SC-DAT01-01 · Money round trip
**Tests:** FND-DAT-01 #1 [FR-DATA-13] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Convert `{ minor: 245000, currency: "INR" }` to a decimal | ₹2,450.00 (symbol before the number; INR uses Indian grouping, DR-07 ◐) |
| 2 | Convert it back | `245000` exactly |
| 3 | Repeat for a 0-decimal and a 3-decimal currency | Round-trips exactly |

### SC-DAT01-02 · Unit conversions both directions
**Tests:** FND-DAT-01 #2 [TS-03] · **Level:** Unit · **Priority:** High · **Decisions applied:** DR-07 (`mpg` definition, displayed decimals)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Convert km → mi → km | Returns the original within the defined precision |
| 2 | Convert litres ↔ US gallons ↔ UK gallons | Same |
| 3 | Convert efficiency km/l ↔ L/100 km | Same |
| 4 | Convert to `mpg` | US gallons unless the Volume setting is UK gallons (DR-07 ◐) |

### SC-DAT01-03 · Display conversion never changes stored values or currencies
**Tests:** FND-DAT-01 #3 [AC-D10, FR-SET-03] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Call every exported display function with a stored value | The input is unchanged afterwards |
| 2 | Try to format a USD amount with INR as the Currency setting | Shown as USD with its own code; no conversion |

### SC-DAT01-04 · `hours` is not converted
**Tests:** FND-DAT-01 #4 [FR-VEH-16] · **Level:** Unit · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Pass an odometer in `hours` with Distance unit = mi | Value is unchanged; helper reports "no distance conversion" and "hide distance metrics" |

### SC-DAT01-05 · Values that do not convert exactly (edge)
**Tests:** FND-DAT-01 edge case · **Level:** Unit · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Convert a value that has no exact equivalent and convert back | Display value rounded per the defined precision; the stored value never rounded |

---

### SC-DAT02-01 · Valid fixtures parse for every shape
**Tests:** FND-DAT-02 #1 [PR-18, Appendix E] · **Level:** Unit · **Priority:** Critical · **Decisions applied:** DR-01/02/03/05 (final field sets and encodings)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Parse a valid `users`, `vehicles`, `entries` (fuel, expense, service, income, trip, inspection), `reminders`, `invites` and `checklistTemplates` fixture | Each parses into its domain type |

### SC-DAT02-02 · Invalid documents are rejected
**Tests:** FND-DAT-02 #2 [FR-DATA-03, FR-SEC-11/12/13 mirror] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Parse an entry with a non-integer `amount.minor` | Rejected |
| 2 | Parse an entry with an unknown `type` | Rejected |
| 3 | Parse a trip entry with an `amount` | Rejected |
| 4 | Parse an expense entry with no `amount` | Rejected |
| 5 | Parse a service entry whose `amount.minor` ≠ lines + labour − discount (floor 0) | Rejected |
| 6 | Parse an entry with 6 attachments, a vehicle with 11 members, a template with 51 items, a reminder with no trigger | Each rejected |

### SC-DAT02-03 · Errors carry codes and paths only
**Tests:** FND-DAT-02 Security (PRV-03) · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Reject a document containing an amount, a plate, a name and a note | Error output contains paths and codes; none of those values |

### SC-DAT02-04 · Older shape upgrades on read
**Tests:** FND-DAT-02 #3 [FR-DATA-06] · **Level:** Unit · **Priority:** High · **Decisions applied:** DR-03(c) (`schemaVersion` start value and type)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Parse an older-`schemaVersion` fixture | Upgraded to the current shape |
| 2 | Parse a document whose `schemaVersion` is newer than the app | Skipped and reported like a malformed document (DR-03 ✔) |

### SC-DAT02-05 · G7 fuel fixtures round-trip
**Tests:** FND-DAT-02 #4 [G7] · **Level:** Unit · **Priority:** High · **Decisions applied:** DR-03(d) (`quantity` numeric type)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Round-trip a price quoted to three decimals and a quantity of 12.5 UK gallons through schema and serializer | Identical values after the round trip |

### SC-DAT02-06 · Form schema derives from the vehicle schema
**Tests:** FND-DAT-02 #5 [FR-DATA-04] · **Level:** Unit · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Build the vehicle form resolver from the vehicle schema and submit valid and invalid input | Same accept and reject outcomes as direct parsing |

### SC-DAT02-07 · Membership invariants (edge)
**Tests:** FND-DAT-02 business rules [OQ-34] · **Level:** Unit · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Parse a vehicle whose owner is missing from `memberIds` | Rejected |
| 2 | Parse a vehicle whose `members` keys differ from `memberIds` | Rejected |

---

### SC-DAT03-01 · Offline write is immediately visible with the pending flag
**Tests:** FND-DAT-03 #1 [FR-OFF-01, FR-OFF-03] · **Level:** Maestro / Manual · **Priority:** Critical · **Role:** Android device
**Pre:** Existing session; airplane mode on.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Write a document through the adapter | A live subscription shows it at once with `hasPendingWrites = true` |
| 2 | Turn airplane mode off | The write syncs; the flag clears |

### SC-DAT03-02 · Pending writes survive a restart
**Tests:** FND-DAT-03 #2 [NFR-05] · **Level:** Manual · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | In airplane mode make a write, then kill and relaunch the app | The write is still pending and visible |
| 2 | Go online | It syncs |

### SC-DAT03-03 · `clearPersistence` empties the cache
**Tests:** FND-DAT-03 #3 [AC-D3] · **Level:** Manual · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Load documents, then clear persistence (Firestore not in use) | Previously cached documents are gone on next read offline |

### SC-DAT03-04 · A 500-operation batch commits
**Tests:** FND-DAT-03 #4 [FR-VEH-07, FR-MERGE-04] · **Level:** Emulator (contract) · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Commit a batch of exactly 500 operations | Commits |

### SC-DAT03-05 · No native import outside the adapters
**Tests:** FND-DAT-03 #5 [FR-DATA-01] · **Level:** Unit (lint) · **Priority:** High
Same checks as SC-PLT01-05; confirm they still pass after the adapter is added.

### SC-DAT03-06 · App killed with pending writes (edge)
**Tests:** FND-DAT-03 edge case · **Level:** Manual · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create several pending writes offline and force-stop the app | On relaunch all are present and sync once online, with none duplicated |

---

### SC-DAT04-01 · Shared contract tests pass on the web adapter
**Tests:** FND-DAT-04 #1 [FR-DATA-01] · **Level:** Emulator · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Run the contract suite against the web adapter | Same results as on the native adapter for shared semantics |

### SC-DAT04-02 · Web bundle has no native imports
**Tests:** FND-DAT-04 #2 [NFR-14] · **Level:** CI · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Build the web bundle | Builds; no native module is included |

### SC-DAT04-03 · Offline and online events reach the app
**Tests:** FND-DAT-04 #3 [FR-OFF-14] · **Level:** Component / Manual · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Toggle the browser offline then online | The adapter reports offline then online |

### SC-DAT04-04 · Blocked popup falls back to redirect
**Tests:** FND-DAT-04 #4 [OQ-27] · **Level:** Manual · **Priority:** High · **Decisions applied:** DR-18 (how a block is detected)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Block popups and start Google sign-in | The redirect flow completes sign-in |

### SC-DAT04-05 · `clearPersistence` is a safe no-op on web
**Tests:** FND-DAT-04 Functional #2 · **Level:** Unit · **Priority:** Low

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Call it on the web adapter | No error, no effect |

---

### SC-DAT05-01 · Malformed document is skipped and reported
**Tests:** FND-DAT-05 #1 [FR-DATA-05, FR-ERR-03, AC-D12] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Seed a collection with 3 valid and 1 invalid document and read it | 3 valid returned; skipped count 1 |
| 2 | Inspect the reported event | One non-fatal with the document path only |

### SC-DAT05-02 · All documents malformed (edge)
**Tests:** FND-DAT-05 edge case · **Level:** Emulator · **Priority:** Medium

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Read a collection where every document is invalid | Empty list, skipped count equals the number of documents, no crash |

### SC-DAT05-03 · Upgrade on read
**Tests:** FND-DAT-05 #2 [FR-DATA-06] · **Level:** Emulator · **Priority:** High
Seed an older-shape document and read it: returned in the current shape.

### SC-DAT05-04 · Android write returns immediately
**Tests:** FND-DAT-05 #3 [FR-DATA-07, FR-DATA-08] · **Level:** Manual (native) + Emulator (flag logic) · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | In airplane mode make a repository write | The call returns immediately without waiting for the server |
| 2 | Observe the item | `hasPendingWrites` is true until acknowledged |

### SC-DAT05-05 · Web write awaits the server
**Tests:** FND-DAT-05 Android/web differences · **Level:** Emulator · **Priority:** Medium
Make a repository write on web: the call resolves only after the server confirms.

### SC-DAT05-06 · Refresh pulls from the server
**Tests:** FND-DAT-05 #4 [FR-OFF-12] · **Level:** Emulator · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Change a document directly on the server, then trigger refresh | Subscribers receive the new value |
| 2 | Trigger refresh while offline (edge) | Cached data stays; no crash |

### SC-DAT05-07 · Only UI state in Zustand
**Tests:** FND-DAT-05 #5 [FR-DATA-10] · **Level:** Unit · **Priority:** Medium
Inspect store contents after loading data: only UI-only state (such as the selected vehicle), no Firestore documents.

---

### SC-DAT06-01 · `ensureUser` is idempotent
**Tests:** FND-DAT-06 #1 [FR-AUTH-03, FR-SET-06, OQ-39] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-02/03 (field values)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Call `ensureUser(uid)` for a new uid | Document has INR, km, litres and the device language |
| 2 | Change a setting, then call it again | Existing document untouched |

### SC-DAT06-02 · Created vehicle has owner invariants
**Tests:** FND-DAT-06 #2 [FR-VEH-11] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-01, DR-02

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create a vehicle as uid A | `ownerId` = A; `memberIds` = [A]; `members` has only A |

### SC-DAT06-03 · Units and currency lock once an entry exists
**Tests:** FND-DAT-06 #3 [AC-D7] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | With no entries change `odometerUnit` and `currency` | Succeeds |
| 2 | Seed one entry, then change either | Rejected by the repository |

### SC-DAT06-04 · Delete removes children in batches, vehicle last
**Tests:** FND-DAT-06 #4 [AC-D8, FR-VEH-07] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Seed a vehicle with 1,203 children across entries, reminders and templates | — |
| 2 | Delete the vehicle | No children remain; the vehicle is deleted only after the last child batch (order verified) |

### SC-DAT06-05 · Interrupted delete leaves the vehicle
**Tests:** FND-DAT-06 #5 [FR-VEH-14] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-14 (automatic resume)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Inject a failure after the second batch | The vehicle document still exists |
| 2 | Re-run delete | Remaining children and then the vehicle are deleted; no error for already-deleted children |

### SC-DAT06-06 · "My vehicles" returns members' vehicles only
**Tests:** FND-DAT-06 #6 [FR-VEH-12] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Seed vehicles owned by A and B; query as A | Only A's vehicles |

### SC-DAT06-07 · Session without user document (edge)
**Tests:** FND-DAT-06 edge case [OQ-39] · **Level:** Emulator · **Priority:** High
Call `ensureUser` for a uid with no document: created with defaults, no error.

### SC-DAT06-08 · Delete offline on Android (edge)
**Tests:** FND-DAT-06 offline · **Level:** Manual · **Priority:** High
In airplane mode delete a vehicle with children: it disappears locally; reconnect and confirm the batches sync and nothing reappears.

---

### SC-DAT07-01 · Entry create updates `lastOdometer` in one batch, keeping the maximum
**Tests:** FND-DAT-07 #1 [FR-DATA-11] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-01

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create an entry with odometer 10,000 on a vehicle with `lastOdometer` 9,000 | Entry and `lastOdometer` = 10,000 written in one batch |
| 2 | Create an entry with odometer 9,500 | `lastOdometer` stays 10,000 |

### SC-DAT07-02 · Edit or delete recomputes `lastOdometer`
**Tests:** FND-DAT-07 #2 [OQ-17] · **Level:** Emulator · **Priority:** High · **Decisions applied:** DR-01 (starting odometer)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Delete the entry holding the maximum | `lastOdometer` becomes the maximum of the remaining entries (and `startOdometer`, DR-01 ✔) |
| 2 | Edit an entry to a lower odometer | Recomputed |
| 3 | Delete an entry with no odometer; and a vehicle with no entries (edge) | No error; value per decision |

### SC-DAT07-03 · Malformed entry skipped
**Tests:** FND-DAT-07 #3 [AC-D12] · **Level:** Emulator · **Priority:** High
Seed one malformed entry among valid ones: valid ones load; the malformed one is skipped and reported.

### SC-DAT07-04 · Older-shape entry upgrades
**Tests:** FND-DAT-07 #4 [FR-DATA-06] · **Level:** Emulator · **Priority:** High

### SC-DAT07-05 · `inviteRepo` calls are denied
**Tests:** FND-DAT-07 #5 [FR-SEC-09] · **Level:** Emulator · **Priority:** Critical
Call every `inviteRepo` operation under the Foundation rules: all denied. `reminderRepo`, `templateRepo` and `inviteRepo` expose validated read and subscribe only in Foundation (DR-23 ◐).

### SC-DAT07-06 · `createdBy` and `updatedBy` come from the session
**Tests:** FND-DAT-07 Security · **Level:** Emulator · **Priority:** High
Create an entry while passing a different `createdBy` as input: the stored value is the caller's uid.

---

### SC-DAT08-01 · Round trip reproduces every field
**Tests:** FND-DAT-08 #1 [FR-SER-04] · **Level:** Unit · **Priority:** Critical · **Decisions applied:** DR-02 (`members` values)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Serialize a fixture (vehicles, entries, reminders, templates), plan an import, read the plan back | Every field of every document matches, apart from the intended rewrites |

### SC-DAT08-02 · Deterministic ids and batches
**Tests:** FND-DAT-08 #2 [FR-SER-03] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Plan the same input twice | Identical ids and identical batch boundaries |
| 2 | Plan two different source accounts into the same target | No id collisions |

### SC-DAT08-03 · Batch size and write order
**Tests:** FND-DAT-08 #3 [OQ-22, OQ-35] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Plan a vehicle with 501 entries | Batches of at most 500; the vehicle's batch precedes its entries' batches |

### SC-DAT08-04 · Attribution rewrite and preserved timestamps
**Tests:** FND-DAT-08 #4 [FR-MERGE-08] · **Level:** Unit · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Plan an import into uid B | `date`, `createdAt`, `updatedAt` unchanged; `createdBy` and `updatedBy` = B; `createdByName` kept; `ownerId`/`memberIds`/`members` point at B |

### SC-DAT08-05 · Lossless through a file
**Tests:** FND-DAT-08 #5 [FR-SER-04] · **Level:** Unit · **Priority:** High
Write the serialized structure to a file and read it back: timestamps and money are identical.

### SC-DAT08-06 · Archived vehicles included; counts correct (edge)
**Tests:** FND-DAT-08 edge case, Functional #1 · **Level:** Unit · **Priority:** Medium
Serialize 2 vehicles (one archived) with 14 entries in total: both included; counts report 2 vehicles and 14 entries.

---

# E3 — Security rules

*All rules scenarios run on the Firebase emulator with `@firebase/rules-unit-testing` on every push (TS-01). Each row has an allowed and a denied case.*

### SC-SEC01-01 · `users/{uid}` is self-only
**Tests:** FND-SEC-01 #1 [FR-SEC-08, AC-D18] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | As the owner of the document: read, create, update, delete | Allowed |
| 2 | As another signed-in user: read, create, update, delete | Denied |
| 3 | Unauthenticated | Denied |

### SC-SEC01-02 · Vehicle create requires self as owner and only member
**Tests:** FND-SEC-01 #3 [FR-VEH-11] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-01/02/03/05/06 (required fields, caps)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | As signed-in A (including anonymous) create with `ownerId` A and `memberIds` [A] | Allowed |
| 2 | Create with `ownerId` B | Denied |
| 3 | Create with `memberIds` [A, B] | Denied |
| 4 | Create with a missing required field or wrong type | Denied |
| 5 | Create with `createdAt` in the future | Denied |

### SC-SEC01-03 · Vehicle read is members-only
**Tests:** FND-SEC-01 #5 [FR-SEC-02] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Member reads the vehicle | Allowed |
| 2 | Non-member reads it | Denied |
| 3 | Non-member runs a query that could return it | Denied |
| 4 | Member runs the `array-contains` "my vehicles" query | Allowed |

### SC-SEC01-04 · Member updates only the three allowed fields
**Tests:** FND-SEC-01 #2 [FR-SEC-04] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Member (non-owner) updates only `lastOdometer`, `lastOdometerAt`, `updatedAt` | Allowed |
| 2 | Same plus `name` in one write | Denied |
| 3 | Update `lastOdometer` to a negative number or a non-number | Denied |
| 4 | Member changes `ownerId`, `memberIds` or `members` | Denied |

### SC-SEC01-05 · Owner update and invariants
**Tests:** FND-SEC-01 #4 [FR-SEC-12] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-12 (which owner writes to the membership fields are allowed)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Owner edits `name`, `archived` | Allowed |
| 2 | Owner update that removes the owner from `memberIds` | Denied |
| 3 | Update where `members` keys differ from `memberIds` | Denied |
| 4 | Update that makes `memberIds` exceed 10 | Denied |
| 5 | Owner changes `ownerId`, adds or removes uids | Denied: the three fields are set at creation only (DR-12 ✔) |

### SC-SEC01-06 · Vehicle delete is owner-only; default deny elsewhere
**Tests:** FND-SEC-01 #1 [FR-SEC-01] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Owner deletes the vehicle | Allowed |
| 2 | Member (non-owner) and non-member delete | Denied |
| 3 | Read or write a path with no rule | Denied |

### SC-SEC01-07 · Archived vehicle (edge)
**Tests:** FND-SEC-01 edge case · **Level:** Emulator · **Priority:** Medium · **Decision applied:** DR-13
Owner updates an archived vehicle: the rules are unchanged and allow it; the app does not offer editing (DR-13 ◐, app-level restriction).

---

### SC-SEC02-01 · Entries matrix rows
**Tests:** FND-SEC-02 #1 [FR-SEC-08] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Member reads an entry | Allowed |
| 2 | Non-member reads, creates, updates, deletes | Denied |
| 3 | Member creates an entry with `createdBy` = self | Allowed |
| 4 | Member creates with `createdBy` = another uid | Denied |
| 5 | Creator updates and deletes their entry; owner updates and deletes another's | Allowed |
| 6 | A member who is neither creator nor owner updates or deletes it | Denied |

### SC-SEC02-02 · `createdBy` immutable, `updatedBy` equals caller
**Tests:** FND-SEC-02 #2 [FR-SEC-05, FR-SEC-10] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Creator updates the entry changing `createdBy` | Denied |
| 2 | Update with `updatedBy` ≠ caller | Denied |
| 3 | Update with `updatedBy` = caller | Allowed |

### SC-SEC02-03 · Type and amount validation
**Tests:** FND-SEC-02 #3, #4 [FR-SEC-03, FR-SEC-11] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-03 (encodings)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create an entry with `type` outside the six | Denied |
| 2 | Create fuel, expense, service, income entries with `amount.minor` not an integer | Denied |
| 3 | Create a fuel, expense, service or income entry with no `amount` | Denied |
| 4 | Create one whose `amount.currency` differs from the vehicle's | Denied |
| 5 | Create a trip or inspection entry without `amount` | Allowed |

### SC-SEC02-04 · Timestamps, caps
**Tests:** FND-SEC-02 Scope [FR-SEC-10, FR-SEC-13] · **Level:** Emulator · **Priority:** High · **Decisions applied:** DR-06 (cap values)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create an entry with `createdAt` in the future | Denied |
| 2 | Create an entry with a copied (past) `createdAt` and `updatedAt` | Allowed |
| 3 | Create an entry with 6 attachments | Denied |
| 4 | Create an entry with text over the cap | Denied above 60 (short text), 15 (plate) and 500 (notes) (DR-06 ✔) |

### SC-SEC02-05 · Reminders and checklist templates
**Tests:** FND-SEC-02 #1 [FR-SEC-08, FR-SEC-09] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Member reads, creates, updates, deletes a reminder | Allowed |
| 2 | Non-member does any of these | Denied |
| 3 | Member reads, creates and updates a template with 50 items | Allowed |
| 4 | Create or update a template with 51 items | Denied |
| 5 | Creator deletes a template; owner deletes another member's | Allowed |
| 6 | A member who is neither deletes it | Denied |

### SC-SEC02-06 · Batch of 500 entries passes
**Tests:** FND-SEC-02 #5 [OQ-35] · **Level:** Emulator · **Priority:** Critical
Commit a batch of 500 entries under one existing vehicle as a member: passes (rules read only the parent vehicle).

### SC-SEC02-07 · Entry in the same batch as its vehicle's creation (edge)
**Tests:** FND-SEC-02 edge case [OQ-22] · **Level:** Emulator · **Priority:** High
Create a vehicle and an entry in one batch: the entry is denied. Create the vehicle first in its own batch, then the entry: allowed.

### SC-SEC02-08 · Cross-vehicle access (edge)
**Tests:** FND-SEC-02 Security · **Level:** Emulator · **Priority:** Critical
A member of vehicle X reads, writes or deletes entries, reminders and templates under vehicle Y: denied.

---

### SC-SEC03-01 · Later-tab paths are denied
**Tests:** FND-SEC-03 #1 [FR-SEC-09, AC-F6] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-12 (how "transfer" is exercised)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Read, create, update, delete on `invites/{code}` as owner, member and non-member | All denied |
| 2 | A non-member adds themselves to `memberIds` (self-join) | Denied |
| 3 | A member removes themselves (leave) | Denied |
| 4 | A non-owner removes another member | Denied |
| 5 | An ownership-transfer write | Denied: any change to `ownerId`, `memberIds` or `members` is denied in Foundation (DR-12 ✔) |

### SC-SEC03-02 · Matrix inventory fails CI when incomplete
**Tests:** FND-SEC-03 #2 [TS-01, AC-D18] · **Level:** CI · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Run the inventory | Lists every matrix row, `lastOdometer` exception and `createdBy` immutability, each with an allowed and a denied test |
| 2 | Remove one denied test on a throw-away branch | CI fails |

### SC-SEC03-03 · Merge path passes the Foundation rules
**Tests:** FND-SEC-03 #3 [AC-D21, G3] · **Level:** Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Under uid B write a serialized fixture of 1 vehicle and 501 entries in batches of 500, vehicle first | All batches pass; no denial and no access-call error |
| 2 | Write an entry batch before the vehicle exists | Denied |

### SC-SEC03-04 · Production confirmation of batch behavior
**Tests:** FND-SEC-03 #4 [G3] · **Level:** Manual · **Priority:** High · **Decision applied:** DR-21
Run the same fixture against the production project with deployed rules and record the result.

---

# E4 — Identity and account

### SC-AUTH01-01 · Fresh install with network
**Tests:** FND-AUTH-01 #1 [AC-F1, FR-AUTH-01/02/03] · **Level:** Maestro · **Priority:** Critical · **Role:** Anonymous user · **Decisions applied:** DR-02/03 (document field values)
**Pre:** Fresh install, network on.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Launch the app | No sign-in screen is shown at any point |
| 2 | Inspect the account | An anonymous session exists |
| 3 | Inspect `users/{uid}` | Created with INR, km, litres and the device language |

### SC-AUTH01-02 · Offline first launch shows "Connect to get started"
**Tests:** FND-AUTH-01 #2 [AC-D1, FR-AUTH-05] · **Level:** Manual / Component · **Priority:** Critical
**Pre:** Fresh install, airplane mode on.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Launch the app | "Connect to get started" is shown |
| 2 | Wait, still offline | It keeps retrying by itself; no crash |
| 3 | Turn the network on | Onboarding proceeds without user action |

### SC-AUTH01-03 · Relaunch offline after a successful first launch
**Tests:** FND-AUTH-01 #3 [FR-AUTH-06] · **Level:** Maestro · **Priority:** Critical
After a successful first launch, enable airplane mode, kill and relaunch: the app opens with the persisted session.

### SC-AUTH01-04 · Session without user document
**Tests:** FND-AUTH-01 #4 [OQ-39] · **Level:** Emulator / Unit · **Priority:** High
Create a session, skip the document (simulate a kill between steps), relaunch: the document is created with defaults.

### SC-AUTH01-05 · Non-offline sign-in failure
**Tests:** FND-AUTH-01 #5 [PRD §19.2] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-16 (message text)
Make anonymous sign-in fail with an unknown error while online: a message with Retry appears; Retry attempts again.

### SC-AUTH01-06 · Network drops during the first call (edge)
**Tests:** FND-AUTH-01 edge case · **Level:** Manual · **Priority:** Medium
Drop the network mid-call: the app returns to "Connect to get started" and does not create two anonymous accounts after reconnecting.

---

### SC-AUTH02-01 · Google sign-in reaches the shell
**Tests:** FND-AUTH-02 #1 [FR-WEB-01, AC-F4] · **Level:** Manual · **Priority:** Critical · **Role:** Web user
**Pre:** Signed-out browser, test Google account.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open the app | The Google-only sign-in screen shows |
| 2 | Choose Google and complete the popup | The shell loads |

### SC-AUTH02-02 · First-time versus returning account
**Tests:** FND-AUTH-02 #2 [FR-WEB-02] · **Level:** Emulator · **Priority:** High · **Decisions applied:** DR-02/03 (`isLinked`, `displayName`)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Sign in with a Google account that has no `users/{uid}` | A document is created with defaults |
| 2 | Sign out and sign in again | No second document; existing one reused |

### SC-AUTH02-03 · Same vehicles as the linked Android account
**Tests:** FND-AUTH-02 #3 [FR-WEB-03, AC-F4] · **Level:** Manual · **Priority:** Critical
**Pre:** An Android user who added a vehicle then linked a test Google account.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Sign in on web with the same Google account | The same uid; the same vehicles show |

### SC-AUTH02-04 · Cancel and error
**Tests:** FND-AUTH-02 #4 [FR-ERR-06] · **Level:** Component · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Close the Google dialog | No message, no change |
| 2 | Cause a network or unknown error | A message with Retry appears; Retry tries again |

### SC-AUTH02-05 · Blocked popup uses redirect
**Tests:** FND-AUTH-02 #5 [OQ-27] · **Level:** Manual · **Priority:** High · **Decisions applied:** DR-18
Block popups: sign-in completes through the redirect flow.

### SC-AUTH02-06 · Session survives reload; signed-out visitor sees only sign-in (edge)
**Tests:** FND-AUTH-02 edge case · **Level:** Manual · **Priority:** Medium
Reload a signed-in page: still signed in. Visit a deep link while signed out: the sign-in screen shows, not app content.

---

### SC-AUTH03-01 · Successful link keeps the uid
**Tests:** FND-AUTH-03 #1 [AC-D4, FR-LINK-05] · **Level:** Manual · **Priority:** Critical · **Role:** Anonymous user · **Decisions applied:** DR-02 (what linking writes to `displayName` and `members`)
**Pre:** Anonymous account with a vehicle; test Google account with no data.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Note the uid; More → Account → Link Google | Google Sign-In opens |
| 2 | Complete it | The uid is unchanged; `isLinked` is `true`; the vehicle is still there |

### SC-AUTH03-02 · Account shows Link Google, no sign-out
**Tests:** FND-AUTH-03 #2 [AC-D2, FR-OUT-03] · **Level:** Component · **Priority:** Critical
As an anonymous user open Account: "Link Google" is shown; no sign-out action. As a linked user: no Link button (edge).

### SC-AUTH03-03 · Cancel is silent
**Tests:** FND-AUTH-03 #3 [FR-ERR-06] · **Level:** Manual · **Priority:** High
Dismiss the Google account picker: no message, state unchanged, the user can try again.

### SC-AUTH03-04 · Error with Retry; offline during link
**Tests:** FND-AUTH-03 #4 [PRD §19.2] · **Level:** Component / Manual · **Priority:** High · **Decisions applied:** DR-16 (message)
Cause a network or unknown error, and try linking in airplane mode: a message with Retry appears each time.

### SC-AUTH03-05 · No Drive scope
**Tests:** FND-AUTH-03 #5 [FR-LINK-07] · **Level:** Manual · **Priority:** High
Log the scopes requested during linking: basic sign-in only.

### SC-AUTH03-06 · `isLinked` write while offline (edge)
**Tests:** FND-AUTH-03 edge case · **Level:** Manual · **Priority:** Medium
Link, then immediately go offline: `isLinked` shows true locally and syncs on reconnect.

---

### SC-AUTH04-01 · Banner on More
**Tests:** FND-AUTH-04 #1 [FR-LINK-02] · **Level:** Component · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Anonymous user opens More | "Your data isn't backed up" banner is shown |
| 2 | Dismiss attempt / restart | The banner stays |
| 3 | After linking | Banner is gone; a linked user never sees it |

### SC-AUTH04-02 · 5th entry across vehicles triggers the prompt
**Tests:** FND-AUTH-04 #2 [FR-LINK-01, OQ-05] · **Level:** Emulator fixtures + Component · **Priority:** Critical · **Decisions applied:** DR-09 (fires at 5 versus 5 or more; deletes)
**Pre:** Two vehicles; entries seeded 3 on one and 2 on the other (no entry forms exist until tab 2).

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Create entries until the count across vehicles reaches 5 | The dismissible link prompt appears |
| 2 | With 4 entries | No prompt |

### SC-AUTH04-03 · Dismissed prompt does not return
**Tests:** FND-AUTH-04 #3 [FR-LINK-08] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-09 (where dismissal is kept)
Dismiss the prompt, add more entries, restart the app: the prompt does not reappear; the banner on More remains.

### SC-AUTH04-04 · Required-step gate
**Tests:** FND-AUTH-04 #4 [FR-LINK-03] · **Level:** Unit / Component · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Call the gate as an anonymous user | The link flow starts |
| 2 | Complete, cancel, and fail the link in turn | The caller receives linked, cancelled, failed respectively |
| 3 | Call the gate as a linked user | Returns linked without opening the flow |

### SC-AUTH04-05 · Count includes archived vehicles (edge)
**Tests:** FND-AUTH-04 edge case · **Level:** Emulator · **Priority:** Medium
Seed entries on an archived and an active vehicle totalling 5: the trigger fires.

---

### SC-AUTH05-01 · Conflict prompt shows counts and three actions
**Tests:** FND-AUTH-05 #1 [AC-D5, FR-MERGE-07] · **Level:** Component + Manual · **Priority:** Critical · **Decisions applied:** DR-10 (singular and plural wording)
**Pre:** Anonymous phone with 2 vehicles and 14 entries; a test Google account that already has data.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Start linking with that account | `auth/credential-already-in-use` is detected |
| 2 | Read the prompt | "This Google account already has data. Move the 2 vehicles and 14 entries from this phone into it?" with **Move and switch**, **Switch without moving**, **Cancel** |

### SC-AUTH05-02 · Cancel changes nothing
**Tests:** FND-AUTH-05 #2 [OQ-06] · **Level:** Manual · **Priority:** Critical
Choose Cancel: the user is still anonymous, same uid, all data intact, no writes made.

### SC-AUTH05-03 · Switch without moving warns first
**Tests:** FND-AUTH-05 #3 [OQ-06] · **Level:** Manual · **Priority:** Critical · **Decisions applied:** DR-16 (warning text), DR-15 (selection after switching)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Choose Switch without moving | A warning says the phone's data cannot be recovered |
| 2 | Decline | Nothing changes |
| 3 | Repeat and confirm | Signed in to the Google account; its own data shows; the phone's data was not copied |

### SC-AUTH05-04 · Move and switch hands off to the merge
**Tests:** FND-AUTH-05 #4 [FR-MERGE-01] · **Level:** Unit · **Priority:** High
Choose Move and switch: the merge flow (AUTH-06) starts with the retained credential.

### SC-AUTH05-05 · Phone has nothing to move (edge)
**Tests:** FND-AUTH-05 edge case · **Level:** Manual · **Priority:** High · **Decision applied:** DR-10
Link from a fresh anonymous account with 0 vehicles and 0 entries: a two-button dialog 'This Google account already has data. Switch to it?' with Switch and Cancel (DR-10 ◐).

### SC-AUTH05-06 · Credential expires before the user chooses (edge)
**Tests:** FND-AUTH-05 edge case · **Level:** Unit · **Priority:** Low
Hold the prompt until the credential is invalid: the user is told to retry linking; no data is changed.

---

### SC-AUTH06-01 · Full merge succeeds
**Tests:** FND-AUTH-06 #1 [AC-F3, FR-MERGE-08] · **Level:** Manual + Emulator integration · **Priority:** Critical · **Decisions applied:** DR-02, DR-11, DR-15
**Pre:** Anonymous phone with data (including archived vehicle, reminders, templates); Google account with other data.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Choose Move and switch | Serialized data is stored on disk before sign-in |
| 2 | Wait for completion | The Google account shows the phone's vehicles, entries, reminders and templates alongside its existing data |
| 3 | Check copies | Original `date`, `createdAt`, `updatedAt`; `createdBy` and `updatedBy` = Google uid; `createdByName` kept |
| 4 | Check storage | The on-disk data is deleted after success |

### SC-AUTH06-02 · Failure partway, then retry without duplicates
**Tests:** FND-AUTH-06 #2 [AC-D6, FR-MERGE-05/06] · **Level:** Emulator integration · **Priority:** Critical · **Decisions applied:** DR-11 (failure detection)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Inject a failure after the first batch | Data kept in memory and on disk; Retry offered |
| 2 | Retry | Completes; the count of documents equals the source count; no duplicates |
| 3 | Retry a second time after success (edge) | No change |

### SC-AUTH06-03 · Settings are not merged
**Tests:** FND-AUTH-06 #3 [FR-MERGE-09] · **Level:** Emulator · **Priority:** High
Anonymous settings differ from the Google account's: afterward the Google account's settings are unchanged and the anonymous settings are discarded.

### SC-AUTH06-04 · 501 entries against the rules
**Tests:** FND-AUTH-06 #4 [AC-D21] · **Level:** Emulator integration · **Priority:** Critical
Merge a fixture with 1 vehicle and 501 entries: batches of 500, vehicle first, no rules denial.

### SC-AUTH06-05 · Rules rejection or quota partway (edge)
**Tests:** FND-AUTH-06 edge case · **Level:** Emulator · **Priority:** High
Inject `permission-denied`, then `resource-exhausted`: a non-fatal is logged (codes and paths only); the data is retained; Retry is offered.

### SC-AUTH06-06 · Connectivity lost mid-write (edge)
**Tests:** FND-AUTH-06 edge case · **Level:** Manual · **Priority:** Critical · **Decision applied:** DR-11
Turn the network off during the write: after 30 seconds without confirmation, 'Couldn't finish moving your data' with Retry; the stored data remains (DR-11 ◐).

### SC-AUTH06-07 · Stored data is private
**Tests:** FND-AUTH-06 Security · **Level:** Manual · **Priority:** High
Inspect Crashlytics events and logs during a merge: no stored data appears; the file is in app-private storage.

---

### SC-AUTH07-01 · Kill after sign-in, relaunch shows "Finish moving your data"
**Tests:** FND-AUTH-07 #1 [FR-MERGE-10, OQ-23] · **Level:** Manual + Integration · **Priority:** Critical
**Pre:** A merge in progress.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Kill the app after sign-in and before the write completes | — |
| 2 | Relaunch | "Finish moving your data" appears before normal navigation |

### SC-AUTH07-02 · Retry completes without duplicates
**Tests:** FND-AUTH-07 #2 [AC-D6] · **Level:** Integration · **Priority:** Critical
Choose Retry after a partial write: remaining documents are written; none duplicated; the stored data is deleted.

### SC-AUTH07-03 · Discard
**Tests:** FND-AUTH-07 #3 [FR-MERGE-10] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-10 (confirmation)
Choose Discard: the stored data is deleted and the prompt does not return on the next launch.

### SC-AUTH07-04 · Sign-out clears retry data (edge)
**Tests:** FND-AUTH-07 Business rules [FR-OUT-05] · **Level:** Integration · **Priority:** High
With retry data present, sign out: the data is removed.

---

### SC-AUTH08-01 · Sign-out clears the persisted cache
**Tests:** FND-AUTH-08 #1 [AC-D3, FR-OUT-02] · **Level:** Manual · **Priority:** Critical · **Role:** Linked user

| Step | Action | Expected |
| --- | --- | --- |
| 1 | With synced data, sign out | Signed out |
| 2 | Relaunch offline | The previous user's data is not visible |

### SC-AUTH08-02 · Pending writes dialog
**Tests:** FND-AUTH-08 #2 [AC-D23, FR-OUT-04] · **Level:** Component + Manual · **Priority:** Critical · **Decisions applied:** DR-16 (wording), DR-11 (Wait and sync offline)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | In airplane mode create changes, then tap sign out | The dialog shows how many changes have not synced, with **Wait and sync** and **Sign out and discard** |
| 2 | Choose Sign out and discard | Signs out at once; the changes are lost |
| 3 | Repeat, choose Wait and sync, go online | The changes sync, then sign-out proceeds |
| 4 | With zero pending writes (edge) | No dialog |

### SC-AUTH08-03 · Everything local is cleared
**Tests:** FND-AUTH-08 #3 [FR-OUT-05] · **Level:** Integration + Manual · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Sign out with a saved selected vehicle, retry data present and a Google Sign-In session | Selection, retry data, Google Sign-In session and scheduled notifications are cleared |
| 2 | Next launch | A fresh anonymous bootstrap (the welcome screen shows again for the new uid, DR-09 ◐) |

### SC-AUTH08-04 · Anonymous users cannot sign out
**Tests:** FND-AUTH-08 #4 [AC-D2, FR-OUT-03] · **Level:** Component · **Priority:** High
Anonymous user opens Account: no sign-out; "Link Google" is present.

### SC-AUTH08-05 · Gate G5 run
**Tests:** FND-AUTH-08 #5 [G5] · **Level:** Maestro / Manual · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Airplane mode → add a vehicle → sign out → see the count | Count of 1 shown |
| 2 | Sign out and discard, reconnect | The vehicle never reaches the server |
| 3 | Repeat with Wait and sync | The vehicle reaches the server |

### SC-AUTH08-06 · Web sign-out
**Tests:** FND-AUTH-08 Functional #4 · **Level:** Manual · **Priority:** High
On web sign out: back to the sign-in screen; no pending-writes dialog; saved selection cleared.

### SC-AUTH08-07 · Killed between sign-out and cache clearing (edge)
**Tests:** FND-AUTH-08 edge case · **Level:** Manual · **Priority:** Medium
Kill the app right after sign-out, relaunch: no previous-user data is visible.

---

# E5 — App shell and UX foundation

### SC-SHL01-01 · One welcome screen then Add your first vehicle
**Tests:** FND-SHL-01 #1 [AC-F1, AC-D22] · **Level:** Maestro · **Priority:** Critical · **Decisions applied:** DR-09 (when it shows again)
**Pre:** Fresh install, network on.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Launch | One welcome screen: "Free. No ads. Your data stays yours." |
| 2 | Tap **Get started** | "Add your first vehicle" opens; no sign-in screen at any point |

### SC-SHL01-02 · Accessibility of the welcome screen
**Tests:** FND-SHL-01 #2 [AC-D17] · **Level:** Component · **Priority:** High
**Get started** has a tap target of at least 48 dp and a screen-reader label; text scales with system font size.

### SC-SHL01-03 · Relaunch before adding a vehicle; back from the form (edge)
**Tests:** FND-SHL-01 edge case · **Level:** Manual · **Priority:** Medium · **Decision applied:** DR-09
Kill the app after the welcome screen and relaunch: it goes straight to 'Add your first vehicle', with no second welcome (DR-09 ◐).

---

### SC-SHL02-01 · Same routes, rail at 768 px
**Tests:** FND-SHL-02 #1 [AC-D14, FR-NAV-06/07] · **Level:** Component + Manual · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open a route on Android and on web | Same route works on both |
| 2 | Web at 768 px | Left navigation rail and dialog forms |
| 3 | Web at 767 px | Mobile layout with tabs |
| 4 | Resize across 768 px (edge) | Layout switches without losing the current route |

### SC-SHL02-02 · Add sheet
**Tests:** FND-SHL-02 #2 [AC-D15, FR-NAV-04] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-17 (visibility with no vehicle; placeholder content)
Tap Add on Dashboard and on History: the sheet lists Fuel, Expense, Service, Income, Trip, Inspection; each opens a placeholder.

### SC-SHL02-03 · More list and "Coming soon"
**Tests:** FND-SHL-02 #3 [AC-D16, FR-NAV-05] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-17 (About & privacy content)
More lists Vehicles, Reminders, Checklists, Backup & export, Join a vehicle, Settings, Account, About & privacy. Reminders, Checklists, Backup & export and Join a vehicle show "Coming soon"; Vehicles, Settings and Account open their screens.

### SC-SHL02-04 · Empty state
**Tests:** FND-SHL-02 #4 [FR-NAV-08] · **Level:** Component · **Priority:** Critical
A user with no vehicle sees "Add your first vehicle" instead of an empty dashboard.

### SC-SHL02-05 · Four tabs
**Tests:** FND-SHL-02 Functional #1 [FR-NAV-03] · **Level:** Component · **Priority:** High
Android shows Dashboard, History, Reports, More; each scoped to the selected vehicle.

### SC-SHL02-06 · Web below 768 px
**Tests:** FND-SHL-02 #5 [FR-NAV-10] · **Level:** Component · **Priority:** Medium
Covered by SC-SHL02-01 step 3, including that forms are not dialogs below 768 px.

---

### SC-SHL03-01 · Targets and labels
**Tests:** FND-SHL-03 #1 [AC-D17] · **Level:** Component + Lint · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Measure every shared interactive component | At least 48 dp |
| 2 | Render an icon-only button without a label | Type-check or lint fails |

### SC-SHL03-02 · Theme switching
**Tests:** FND-SHL-03 #2 · **Level:** Component + Manual · **Priority:** High
Switch light, dark and system: all shared components follow; no hard-coded colour appears outside the theme (static check).

### SC-SHL03-03 · Font scaling
**Tests:** FND-SHL-03 #3 [NFR-11] · **Level:** Manual (release checklist) · **Priority:** High
At the largest OS font scale, shared components show no clipped text.

---

### SC-SHL04-01 · Archived vehicles hidden
**Tests:** FND-SHL-04 #1 [AC-D9, FR-NAV-01] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-04 (palette visuals)
The switcher lists non-archived vehicles with name, type icon and colour; an archived vehicle is absent.

### SC-SHL04-02 · "All vehicles" changes only Reports
**Tests:** FND-SHL-04 #2 [AC-D25, FR-NAV-09] · **Level:** Component · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Choose vehicle A, then "All vehicles" | Reports scope = all; Dashboard and History stay on A |
| 2 | Choose vehicle B | All tabs rescope to B |

### SC-SHL04-03 · Selection persists
**Tests:** FND-SHL-04 #3 [FR-NAV-02] · **Level:** Component + Maestro · **Priority:** High · **Decisions applied:** DR-15 (storage)
Select B, restart: B is still selected. Sign out clears it (SC-AUTH08-03).

### SC-SHL04-04 · Fallback after archive or delete
**Tests:** FND-SHL-04 #4 [FR-VEH-13] · **Level:** Component · **Priority:** High · **Decision applied:** DR-15 ("most recently used")
Archive or delete the selected vehicle: the most recently selected remaining vehicle is chosen, else the first non-archived by creation date (DR-15 ◐).

### SC-SHL04-05 · Single and zero vehicles (edge)
**Tests:** FND-SHL-04 edge case · **Level:** Component · **Priority:** Medium
With one vehicle the switcher shows it; with none it is hidden and the empty state shows.

---

# E6 — Vehicle management

### SC-VEH01-01 · First vehicle from the empty state
**Tests:** FND-VEH-01 #1 [FR-VEH-08, AC-F1] · **Level:** Maestro · **Priority:** Critical · **Decisions applied:** DR-01, DR-04, DR-05

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Tap "Add your first vehicle" | The form opens |
| 2 | Fill name, type, fuel types, odometer unit, current odometer, pick a colour, save | The vehicle appears in the switcher and becomes the scope of all tabs |

### SC-VEH01-02 · Required-field validation
**Tests:** FND-VEH-01 #2 [FR-VEH-01, TS-05] · **Level:** Component · **Priority:** Critical · **Decisions applied:** DR-05 (limits)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Save with name empty | Blocked with an inline error |
| 2 | Leave type, fuel types, odometer unit, current odometer empty in turn | Each blocked with an inline error |
| 3 | Fill all required, leave make, model, year, plate empty | Saves |
| 4 | Double-tap Save (edge) | One vehicle created |

### SC-VEH01-03 · Saved vehicle has owner invariants and colour
**Tests:** FND-VEH-01 #3 [FR-VEH-03, FR-VEH-11] · **Level:** Emulator · **Priority:** Critical
The saved document has the signer as `ownerId` and only member and the chosen colour.

### SC-VEH01-04 · Offline add on Android
**Tests:** FND-VEH-01 #4 [AC-F2, FR-VEH-09] · **Level:** Maestro (airplane mode) · **Priority:** Critical
In airplane mode add a vehicle: it appears at once with the sync icon; reconnect and it syncs.

### SC-VEH01-05 · Defaults and overrides
**Tests:** FND-VEH-01 #5 [FR-VEH-10] · **Level:** Component · **Priority:** High
With Currency = USD and Distance unit = mi in Settings the form starts with those; changing the vehicle's currency and odometer unit saves the overrides.

### SC-VEH01-06 · `hours` for any type; all types and fuel types
**Tests:** FND-VEH-01 Business rules [FR-VEH-16/17] · **Level:** Component · **Priority:** Medium
Select `hours` for each vehicle type and any combination of petrol, diesel, CNG, LPG, electric: all accepted.

### SC-VEH01-07 · Web offline disables Save; dialog at 768 px
**Tests:** FND-VEH-01 Android/web differences · **Level:** Manual · **Priority:** High
On web offline: Save is disabled with the banner. At ≥768 px the form is a dialog.

### SC-VEH01-08 · Rules rejection returns an error (edge)
**Tests:** FND-VEH-01 edge case · **Level:** Component · **Priority:** Medium
Force a rules denial: the form shows an error and the user's input is kept.

---

### SC-VEH02-01 · Units locked once entries exist
**Tests:** FND-VEH-02 #1 [AC-D7, FR-VEH-04] · **Level:** Component · **Priority:** Critical
**Pre:** A vehicle with one seeded entry.
Open edit: odometer unit and currency are read-only with a short reason; other fields are editable.

### SC-VEH02-02 · Units editable with no entries
**Tests:** FND-VEH-02 #2 · **Level:** Component · **Priority:** High
A vehicle with no entries: both fields are editable and save.

### SC-VEH02-03 · Repository blocks direct changes
**Tests:** FND-VEH-02 #3 [AC-D7] · **Level:** Emulator · **Priority:** Critical
Attempt to change a locked field through the repository: rejected.

### SC-VEH02-04 · Offline edit
**Tests:** FND-VEH-02 #4 [AC-F2] · **Level:** Maestro · **Priority:** High
Edit a vehicle in airplane mode: saves locally with the sync icon; syncs later.

### SC-VEH02-05 · Archived vehicle and current odometer (edge)
**Tests:** FND-VEH-02 edge cases · **Level:** Manual · **Priority:** Medium · **Decision applied:** DR-13, DR-01
Edit an archived vehicle ⇒ not editable (DR-13 ◐). With entries present, `startOdometer`, odometer unit and currency are locked (DR-01 ✔).

---

### SC-VEH03-01 · Archive and unarchive
**Tests:** FND-VEH-03 #1 [AC-D9, FR-VEH-06] · **Level:** Component + Emulator · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Archive vehicle A | Gone from the switcher; listed as archived in More → Vehicles; entries kept |
| 2 | Unarchive from More → Vehicles | Back in the switcher |

### SC-VEH03-02 · Archive keeps entries
**Tests:** FND-VEH-03 #2 [FR-VEH-05] · **Level:** Emulator · **Priority:** High
Archive a vehicle with seeded entries: all entries still exist.

### SC-VEH03-03 · All archived
**Tests:** FND-VEH-03 #3 [FR-VEH-13] · **Level:** Component · **Priority:** High · **Decisions applied:** DR-15
Archive every vehicle: an empty state offers **Unarchive** and **Add**.

### SC-VEH03-04 · Offline archive
**Tests:** FND-VEH-03 #4 [AC-F2] · **Level:** Maestro · **Priority:** High
Archive and unarchive in airplane mode: rows show the sync icon until confirmed.

### SC-VEH03-05 · Actions on an archived vehicle (edge)
**Tests:** FND-VEH-03 edge case · **Level:** Manual · **Priority:** Medium · **Decision applied:** DR-13

---

### SC-VEH04-01 · Typed-name gate
**Tests:** FND-VEH-04 #1 [AC-D8, FR-VEH-07] · **Level:** Component · **Priority:** Critical · **Decisions applied:** DR-14 (how the name is matched)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Choose Delete | A confirmation asks for the vehicle name |
| 2 | Type a wrong name | Delete stays disabled |
| 3 | Type the exact name | Delete is enabled |

### SC-VEH04-02 · Large delete
**Tests:** FND-VEH-04 #2 [AC-D8] · **Level:** Emulator · **Priority:** Critical
Delete a vehicle with more than 500 children: removed in batches of 500, vehicle last; no child remains.

### SC-VEH04-03 · Interrupted delete retried
**Tests:** FND-VEH-04 #3 [FR-VEH-14] · **Level:** Emulator · **Priority:** Critical · **Decisions applied:** DR-14 (automatic resume; display of a partly deleted vehicle)
Induce a failure mid-delete: the vehicle remains; a retry finishes the job.

### SC-VEH04-04 · Member count warning
**Tests:** FND-VEH-04 #4 [FR-VEH-14] · **Level:** Component · **Priority:** High
A vehicle with more than one member (seeded) shows the member count before the typed-name step; a single-member vehicle does not.

### SC-VEH04-05 · Offline delete
**Tests:** FND-VEH-04 #5 [AC-F2] · **Level:** Maestro · **Priority:** High
Delete in airplane mode: the vehicle disappears locally; after reconnecting the deletion is complete.

### SC-VEH04-06 · Selection after delete; web offline (edge)
**Tests:** FND-VEH-04 Functional #5, Android/web differences · **Level:** Component / Manual · **Priority:** Medium · **Decisions applied:** DR-15
After deleting the selected vehicle another is selected. On web offline, Delete is blocked.

### SC-VEH04-07 · Non-owner cannot delete
**Tests:** FND-VEH-04 Security · **Level:** Emulator · **Priority:** Critical
A member (non-owner) delete attempt is denied by rules.

---

# E7 — Settings and localization

### SC-SET01-01 · No hard-coded UI strings
**Tests:** FND-SET-01 #1 [FR-I18N-03, FR-SCAF-07] · **Level:** CI (automated check) · **Priority:** High

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Run the string-literal check on `app/` and `features/` | Passes |
| 2 | Add a hard-coded user-visible string on a throw-away branch | The check fails |

### SC-SET01-02 · Unsupported device language resolves to English
**Tests:** FND-SET-01 #2 [FR-I18N-05] · **Level:** Unit · **Priority:** High
Device language `fr`, then `en-IN`, then an unknown code: English resources are used each time.

### SC-SET01-03 · Adding a language needs no code change
**Tests:** FND-SET-01 #3 [NFR-13] · **Level:** Unit · **Priority:** Medium
In a test, register a dummy second bundle: strings switch with no application code change.

### SC-SET01-04 · Plurals (edge)
**Tests:** FND-SET-01 Functional · **Level:** Unit · **Priority:** Medium
Render a count message with 1 and with 2 items (such as "2 vehicles and 14 entries"): the correct plural form shows. The conflict prompt uses '1 vehicle'/'2 vehicles' and '1 entry'/'14 entries' (DR-10 ◐).

---

### SC-SET02-01 · All settings persist and drive display
**Tests:** FND-SET-02 #1 [AC-F5, FR-SET-01] · **Level:** Component + Maestro · **Priority:** Critical · **Decisions applied:** DR-03 (stored values), DR-07 (formats), DR-08 (which screens display each setting)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Open More → Settings | Seven settings are listed with their options and current values |
| 2 | Change each: Currency, Distance unit, Volume unit, Efficiency format, Date format, Theme, Language | Each saves |
| 3 | Restart the app | Each value persists |
| 4 | Check each Foundation screen that displays a related value | Display follows the setting (vehicle rows convert the odometer to the Distance unit; the Settings preview line shows currency, volume, efficiency and date; DR-08 ◐) |

### SC-SET02-02 · Display changes, stored data does not
**Tests:** FND-SET-02 #2 [AC-D10, FR-SET-03] · **Level:** Emulator + Component · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Record the stored values of a vehicle and seeded entries | — |
| 2 | Change Distance unit and Currency | Displayed values change; stored documents are byte-identical |
| 3 | Check an existing USD amount after setting Currency to INR | Still USD; not converted |

### SC-SET02-03 · New vehicles use the defaults
**Tests:** FND-SET-02 #3 [FR-VEH-10, FR-SET-02] · **Level:** Component · **Priority:** High
Set Currency and units, add a vehicle: the form starts with them. Existing vehicles do not change (edge).

### SC-SET02-04 · New user defaults
**Tests:** FND-SET-02 #4 [FR-SET-06] · **Level:** Emulator · **Priority:** High
A new user's settings are INR, km, litres, DD/MM/YYYY, System theme and the device language (or English).

### SC-SET02-05 · Theme applies immediately
**Tests:** FND-SET-02 #5 [AC-D17] · **Level:** Component + Manual · **Priority:** High
Switch to dark, light and System: the app updates at once. With System, follow the OS setting changing.

### SC-SET02-06 · Settings sync across devices of one account
**Tests:** FND-SET-02 Functional #2 · **Level:** Manual · **Priority:** Medium
Change a setting on Android and open web with the same account: the same value shows.

### SC-SET02-07 · Offline and web
**Tests:** FND-SET-02 Android/web differences · **Level:** Maestro + Manual · **Priority:** High
On Android in airplane mode a settings change saves locally and syncs later; on web offline the change is blocked with the banner.

### SC-SET02-08 · `hours` vehicle and missing user document (edge)
**Tests:** FND-SET-02 edge cases · **Level:** Unit · **Priority:** Medium
A vehicle in `hours` with Distance unit = mi: shown unconverted. With a missing user document the bootstrap recreates it with defaults.

---

# E8 — Resilience and observability

### SC-OBS01-01 · Error stays in one screen
**Tests:** FND-OBS-01 #1 [AC-F7, FR-ERR-02] · **Level:** Component · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Make one screen throw while rendering | "Something went wrong" with Retry shows in that screen |
| 2 | Switch to another tab | It works normally |

### SC-OBS01-02 · Retry re-renders
**Tests:** FND-OBS-01 #2 [AC-F7] · **Level:** Component · **Priority:** High
Fix the cause and tap Retry: the screen re-mounts and renders. If it fails again the fallback shows again (edge).

### SC-OBS01-03 · Reporting per platform
**Tests:** FND-OBS-01 Scope [OQ-10] · **Level:** Manual · **Priority:** Medium
On Android the error reaches Crashlytics as a non-fatal; on web the boundary shows and nothing is reported.

---

### SC-OBS02-01 · Android offline is normal
**Tests:** FND-OBS-02 #1 [FR-OFF-05, FR-OFF-03] · **Level:** Maestro · **Priority:** Critical
In airplane mode on Android: no error banner; a write saves and shows the pending icon.

### SC-OBS02-02 · Web offline banner disables saving
**Tests:** FND-OBS-02 #2 [FR-ERR-07, FR-OFF-06] · **Level:** Manual + Component · **Priority:** Critical · **Decisions applied:** DR-16 (banner text), DR-18 (time-out)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Take the browser offline | A banner shows; Save buttons are disabled |
| 2 | Go offline during a save (edge) | Detected via the write time-out; after 15 seconds the save is treated as failed: banner shown, form open with Retry (DR-18 ◐) |
| 3 | Go online | Banner clears; saving works |

### SC-OBS02-03 · Quota exceeded messages
**Tests:** FND-OBS-02 #3 [FR-OFF-07] · **Level:** Unit / Component · **Priority:** Critical
Inject `resource-exhausted`: Android shows "Sync paused, your entries are safe on this device"; web shows "Service busy, try again later". A non-fatal with the error code is logged.

### SC-OBS02-04 · Android sync resumes by itself
**Tests:** FND-OBS-02 #4 [FR-OFF-07] · **Level:** Unit · **Priority:** High
After the injected quota error clears, pending writes sync without user action and the message disappears.

---

### SC-OBS03-01 · Member loses access
**Tests:** FND-OBS-03 #1 [AC-D11, FR-ERR-04] · **Level:** Component + Emulator · **Priority:** Critical
**Pre:** A seeded vehicle whose membership the user loses.
Read it: "You no longer have access to this vehicle" shows and the app switches vehicle.

### SC-OBS03-02 · Malformed document
**Tests:** FND-OBS-03 #2 [AC-D12, FR-ERR-03] · **Level:** Emulator + Component · **Priority:** Critical · **Decisions applied:** DR-16 (wording for non-entry lists)
Seed one malformed entry: it is skipped, "1 entry couldn't be shown" shows, and a non-fatal with the document path is logged. With several malformed items plural wording follows '1 vehicle couldn't be shown' style (DR-16 ◐).

### SC-OBS03-03 · Owner permission denied
**Tests:** FND-OBS-03 #3 [FR-ERR-04] · **Level:** Unit · **Priority:** High · **Decision applied:** DR-16 (what "report as a bug" means to the user)
Inject permission-denied for the owner: a non-fatal is logged and the owner sees 'Something went wrong' with Retry (DR-16 ◐); the member message is not shown.

---

### SC-OBS04-01 · Pending icon
**Tests:** FND-OBS-04 #1 [FR-OFF-03] · **Level:** Maestro · **Priority:** Critical
Create a vehicle offline: its row shows the sync icon until the server confirms, then the icon clears.

### SC-OBS04-02 · Rejected queued write
**Tests:** FND-OBS-04 #2 [AC-D24, FR-OFF-13] · **Level:** Unit + Emulator · **Priority:** Critical · **Decisions applied:** DR-19 (Retry and Discard meaning), DR-16 (wording)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Queue a write offline that the rules will reject (for example, after losing membership) and go online | The item shows a warning state |
| 2 | Open the Sync issues notice | The change is listed with **Retry** and **Discard** |
| 3 | Choose Retry, then Discard on another | Retry resubmits the original change; Discard returns the item to server state (DR-19 ◐) |
| 4 | Close the app before the rejection arrives (edge) | The Sync issues list is not kept after a restart (DR-19 ◐) |

### SC-OBS04-03 · Web rejected write
**Tests:** FND-OBS-04 #3 [PRD §19.2] · **Level:** Component · **Priority:** High
On web a rejected write shows an error message with Retry.

### SC-OBS04-04 · Permission-denied after removal
**Tests:** FND-OBS-04 Functional #4 · **Level:** Unit · **Priority:** High
A queued write rejected as permission-denied after removal uses "You no longer have access to this vehicle".

---

### SC-OBS05-01 · Test crash and test non-fatal appear without personal data
**Tests:** FND-OBS-05 #1 [AC-F7, AC-D13] · **Level:** Manual · **Priority:** Critical
**Pre:** A non-production build with a way to trigger a test crash and non-fatal, seeded with an amount, plate, name and note in app state.

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Trigger a crash and a non-fatal | Both appear in the Crashlytics console |
| 2 | Inspect keys, logs and stack data | No amount, plate, name or note anywhere |

### SC-OBS05-02 · Sanitizer
**Tests:** FND-OBS-05 #2 [PRV-03] · **Level:** Unit · **Priority:** Critical
Pass inputs laden with amounts, plates, names, notes and error messages that embed field values: output holds only document ids and paths, error codes and app state.

### SC-OBS05-03 · Invite paths and user id
**Tests:** FND-OBS-05 #3 [PRV-13] · **Level:** Unit · **Priority:** High
Report an event whose path is `invites/ABCD1234`: the code is redacted. Check initialization: no uid is set as the Crashlytics user id.

### SC-OBS05-04 · No analytics SDK; web no-op
**Tests:** FND-OBS-05 #4 [PRV-04] · **Level:** CI + Unit · **Priority:** High
The dependency scan finds no analytics SDK. On web the reporting wrapper does nothing and throws nothing.

---

# E9 — Verification gates

### SC-VER01-01 · Quota budget document
**Tests:** FND-VER-01 #1, #2 [G2] · **Level:** Manual (spike) · **Priority:** Critical · **Decision applied:** DR-20 (threshold)

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Measure reads and writes in the emulator for: cold start with vehicle list, add, edit, archive, delete with N children, merge of one vehicle with N entries, the 5th-entry count, settings change, refresh | A table of counts per operation |
| 2 | Project at 100 and at 500 daily active users, cache-first | Daily reads and writes compared with 50,000 and 20,000 |
| 3 | Compare with the agreed share | Recorded as pass or fail |

### SC-VER01-02 · Gate is enforced
**Tests:** FND-VER-01 #3 [PRD §24.6] · **Level:** Manual (process) · **Priority:** High
DAT-05, DAT-06 and DAT-07 are not marked accepted while G2 is open.

---

### SC-VER02-01 · Maestro: first launch → add vehicle → change settings
**Tests:** FND-VER-02 #1 [TS-06, AC-F1, AC-F5] · **Level:** Maestro · **Priority:** Critical

| Step | Action | Expected |
| --- | --- | --- |
| 1 | Fresh install, launch | Welcome screen; Get started |
| 2 | Add a vehicle | Appears in the switcher |
| 3 | Change a setting | Persists and displays |

### SC-VER02-02 · Maestro: airplane-mode vehicle lifecycle
**Tests:** FND-VER-02 #2 [TS-06, AC-F2] · **Level:** Maestro · **Priority:** Critical
In airplane mode add, edit, archive, unarchive and delete a vehicle; reconnect and the server state matches. (The entry-logging variant is added in tab 2.)

### SC-VER02-03 · Manual checklist run
**Tests:** FND-VER-02 #3 [TS-07] · **Level:** Manual · **Priority:** Critical

| Check | Covers |
| --- | --- |
| Link Google with a test account | AC-F3, AC-D4 |
| Account-conflict merge (account with data) | AC-F3, AC-D5, AC-D6 |
| Merge resume after a kill | AC-D6 |
| Web smoke test (sign in, same vehicles, offline banner) | AC-F4 |
| Dark mode and font scaling | AC-D17 |
| Test crash and test non-fatal | AC-F7, AC-D13 |
| Sign-out with pending writes (G5) | AC-D23 |

---

# Coverage matrix

Every acceptance criterion in the backlog maps to at least one scenario. "Happy" = expected flow, "Edge" = boundaries and unusual states, "Error" = failure handling, "Sec" = security or privacy. A scenario marked "Decisions applied" depends on a decision in section E of the backlog, now answered or assumed in the register.

| Story | Criteria | Happy | Edge | Error | Sec | Decisions applied |
| --- | --- | --- | --- | --- | --- | --- |
| PLT-01 | 5 | PLT01-01, 02, 04, 05 | 03, 06 | 03, 06 | 02, 04 | — |
| PLT-02 | 5 | PLT02-01, 02, 03, 05 | 02 (no SHA-1) | 02 | 03, 04 | DR-21, DR-22 |
| PLT-03 | 4 | PLT03-01, 03 | 05 | 02, 04 | 03 | — |
| DAT-01 | 4 | DAT01-01, 02, 04 | 05 | — | 03 | DR-07 |
| DAT-02 | 5 | DAT02-01, 04, 05, 06 | 07 | 02 | 03 | DR-01/02/03/05/06 |
| DAT-03 | 5 | DAT03-01, 02, 03, 04, 05 | 06 | — | 03 | — |
| DAT-04 | 4 | DAT04-01, 02, 03 | 05 | 04 | — | DR-18 |
| DAT-05 | 5 | DAT05-03, 04, 05, 06, 07 | 02 | 01 | 01 | — (acceptance waits on G2) |
| DAT-06 | 6 | DAT06-01, 02, 03, 04, 06 | 07, 08 | 05 | 03 | DR-01/02/13/14 |
| DAT-07 | 5 | DAT07-01, 02, 04 | 02 | 03, 05 | 06 | DR-01, DR-23 |
| DAT-08 | 5 | DAT08-01, 02, 03, 04, 05 | 06 | — | — | DR-02 |
| SEC-01 | 5 | SEC01-01, 02, 03, 04, 05 | 07 | 02, 04, 05 | all | DR-01/02/03/05/06/12/13 |
| SEC-02 | 5 | SEC02-01, 05, 06 | 07, 08 | 02, 03, 04 | 08 | DR-03, DR-06 |
| SEC-03 | 4 | SEC03-03 | — | 01, 02 | 01 | DR-12, DR-21 |
| AUTH-01 | 5 | AUTH01-01, 02, 03 | 04, 06 | 05 | — | DR-02/03/16 |
| AUTH-02 | 5 | AUTH02-01, 02, 03 | 06 | 04, 05 | — | DR-02/03/18 |
| AUTH-03 | 5 | AUTH03-01, 02, 05 | 06 | 03, 04 | — | DR-02, DR-16, DR-17 |
| AUTH-04 | 4 | AUTH04-01, 02, 04 | 05 | 03 | — | DR-09 |
| AUTH-05 | 4 | AUTH05-01, 02, 03, 04 | 05, 06 | — | 03 | DR-10/15/16 |
| AUTH-06 | 4 | AUTH06-01, 03, 04 | 06 | 02, 05 | 07 | DR-02/11/15 |
| AUTH-07 | 3 | AUTH07-01, 02 | 04 | 03 | — | DR-10 |
| AUTH-08 | 5 | AUTH08-01, 02, 03, 04, 05 | 07 | 02 | 01, 03 | DR-09/11/16 |
| SHL-01 | 2 | SHL01-01, 02 | 03 | — | — | DR-09 |
| SHL-02 | 5 | SHL02-01, 02, 03, 04, 05, 06 | 01 (resize) | — | — | DR-17 |
| SHL-03 | 3 | SHL03-01, 02, 03 | — | — | — | — |
| SHL-04 | 4 | SHL04-01, 02, 03, 04 | 05 | — | 03 (via AUTH08) | DR-04/15 |
| VEH-01 | 5 | VEH01-01, 03, 04, 05, 06 | 06 | 02, 08 | 03 | DR-01/02/04/05 |
| VEH-02 | 4 | VEH02-01, 02, 04 | 05 | 03 | — | DR-01/05/13 |
| VEH-03 | 4 | VEH03-01, 02, 03, 04 | 05 | — | — | DR-13/15 |
| VEH-04 | 5 | VEH04-01, 02, 04, 05 | 06 | 03 | 07 | DR-14/15 |
| SET-01 | 3 | SET01-01, 02, 03 | 04 | — | — | DR-10 |
| SET-02 | 5 | SET02-01, 03, 04, 05 | 06, 08 | — | 02 | DR-03/07/08 |
| OBS-01 | 2 | OBS01-01, 02 | 02 | — | 03 | — |
| OBS-02 | 4 | OBS02-01, 02, 04 | 02 | 03 | — | DR-16/18 |
| OBS-03 | 3 | OBS03-01 | — | 02, 03 | — | DR-16 |
| OBS-04 | 3 | OBS04-01 | 02 (closed app) | 02, 03, 04 | — | DR-16/19 |
| OBS-05 | 4 | OBS05-01 | — | 04 | 01, 02, 03 | — |
| VER-01 | 3 | VER01-01, 02 | — | — | — | DR-20 |
| VER-02 | 3 | VER02-01, 02, 03 | — | — | — | DR-08 |

**Acceptance-criterion coverage.** AC-F1: AUTH01-01, SHL01-01, VEH01-01, VER02-01. AC-F2: DAT03-01, DAT06-04, VEH01-04, VEH02-04, VEH03-04, VEH04-05, VER02-02. AC-F3: AUTH03-01, AUTH05-01, AUTH06-01, AUTH07-01, VER02-03. AC-F4: AUTH02-01, AUTH02-03, VER02-03. AC-F5: SET02-01, VER02-01. AC-F6: SEC01-01 to SEC03-04. AC-F7: OBS01-01, OBS05-01, VER02-03. AC-D1 to AC-D25 are each cited in a scenario header above.

---

# Test data requirements

| Need | Used by | Notes |
| --- | --- | --- |
| **Two test Google accounts**: one with no data, one with existing vehicles, entries, reminders, templates and different settings | AUTH-02, AUTH-03, AUTH-05, AUTH-06, AUTH-07, VER-02 | Not real accounts; hold no personal data |
| **Android device or emulator with Google Play services**, and a second for airplane-mode tests | All Maestro and manual Android scenarios | Maestro cannot drive the Google dialog; link scenarios are manual (OQ-37) |
| **Firebase Emulator** (Firestore, Auth) with the Foundation rules and indexes | All Emulator-level scenarios | Production project only for SC-SEC03-04 and the manual device runs |
| **Vehicle fixtures**: one vehicle per type (car, bike, scooter, truck, bus, other); fuel type combinations; units km, mi, hours; an archived vehicle; a shared vehicle with more than one member (seeded by test setup, since no invite flow exists) | VEH, SHL-04, DAT-06, SEC | Names and plates are fake |
| **Entry fixtures** (seeded directly, since no entry forms exist until tab 2): fuel, expense, service with lines and labour and discount, income, trip, inspection; entries with and without an odometer; 3 + 2 entries across two vehicles; 14 entries across 2 vehicles | DAT-02, DAT-07, AUTH-04, AUTH-05, AUTH-06, VEH-02, SET-02 | Include the G7 values: a price quoted to three decimals; 12.5 UK gallons |
| **Large fixtures**: 1 vehicle with 501 entries; 1 vehicle with 1,203 children across entries, reminders and templates | DAT-08, SEC-02, SEC-03, AUTH-06, VEH-04, DAT-06 | For batch and delete tests |
| **Malformed and old-shape documents**: wrong types, missing required fields, an older `schemaVersion`, a newer `schemaVersion` | DAT-02, DAT-05, DAT-07, OBS-03 | The newer-version case is blocked by DR-03(g) |
| **PII-laden inputs**: amounts, plates, names, notes embedded in errors and state | DAT-02, OBS-05 | Verifies sanitization |
| **Rules test identities**: owner, member (non-owner), non-member, unauthenticated, anonymous | SEC-01 to SEC-03 | A multi-member vehicle is created with security rules disabled in test setup |
| **Failure injection**: adapter that fails after batch N, rejects after acknowledgement, emits `resource-exhausted`, `permission-denied`, offline | DAT-06, AUTH-06, AUTH-07, OBS-02, OBS-03, OBS-04 | Fake adapter for unit tests |
| **Non-production Crashlytics build** with a test crash trigger | OBS-05, VER-02 | Trigger must not exist in release builds |
| **Browsers**: current Chrome plus one other, one mobile browser (popup blocking) | AUTH-02, DAT-04, OBS-02 | Web widths 767 px and 768 px |
| **CI throw-away branches** that break one check each | PLT-01, PLT-03, SEC-03, SET-01 | Evidence that each guard fails when it should |

## Scenarios that depend on a decision

Scenarios whose expected result depends on a backlog decision (section E of `docs/foundation-backlog.md`). Each decision is now answered (✔) or assumed (◐) in `docs/decisions-register.md`; if an assumption is overturned, update these scenarios.

| Decision | Scenarios |
| --- | --- |
| DR-01 | DAT06-02, DAT07-01, DAT07-02, VEH01-01, VEH02-05 |
| DR-02 | DAT06-02, DAT08-01, AUTH03-01, AUTH06-01, SEC01-02 |
| DR-03 | DAT02-04, DAT02-05, SEC02-03, SET02-01, AUTH02-02 |
| DR-04, DR-05 | SHL04-01, VEH01-01, VEH01-02, SEC01-02 |
| DR-06 | SEC02-04 |
| DR-07, DR-08 | DAT01-01, DAT01-02, SET02-01, VER02 (display checks) |
| DR-09 | AUTH04-02, AUTH04-03, AUTH08-03, SHL01-01, SHL01-03 |
| DR-10 | AUTH05-01, AUTH05-05, AUTH07-03, SET01-04 |
| DR-11 | AUTH06-02, AUTH06-06, AUTH08-02 |
| DR-12 | SEC01-05, SEC03-01 |
| DR-13 | SEC01-07, VEH02-05, VEH03-05 |
| DR-14 | VEH04-01, VEH04-03, DAT06-05 |
| DR-15 | SHL04-03, SHL04-04, VEH03-03, VEH04-06, AUTH05-03, AUTH06-01 |
| DR-16 | AUTH01-05, AUTH03-04, AUTH05-03, AUTH08-02, OBS02-02, OBS03-02, OBS03-03, OBS04-02 |
| DR-17 | SHL02-02, SHL02-03 |
| DR-18 | DAT04-04, AUTH02-05, OBS02-02 |
| DR-19 | OBS04-02 |
| DR-20 | VER01-01 |
| DR-21, DR-22 | PLT02-01, SEC03-04 |
| DR-23 | DAT07-05 |

---

# Decision-derived scenarios

Added after the decisions were applied. One scenario per decision-derived criterion (`Dn`) of each Foundation story in `docs/foundation-backlog.md`; the expected result is the criterion text, which comes from `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed). **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual · CI Workflow check.

#### FND-PLT-02 — Firebase project and Google OAuth configuration

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-PLT02-D1 | DR-21 ✔ | Decision applied | Verify ⇒ A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release. | CI | H | D1 [DR-21 ✔] |
| SC-PLT02-D2 | DR-22 ✔ | Decision applied | Verify ⇒ The Firestore database location is recorded in the setup runbook once the owner supplies it. | MAN | M | D2 [DR-22 ✔] |

#### FND-PLT-03 — Continuous integration pipeline

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-PLT03-D1 | DR-21 ✔ | Decision applied | Verify ⇒ A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release. | CI | H | D1 [DR-21 ✔] |

#### FND-DAT-01 — Domain: money and units

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT01-D1 | DR-07 ◐ | Decision applied | Verify ⇒ 245000 minor units of INR show as ₹2,450.00 and 123456700 as ₹12,34,567.00; a USD amount shows with international grouping; funds, metal and test codes such as XAU, XTS and XXX are not selectable; `mpg` uses US gallons unless the Volume setting is UK gallons; any combination of Distance, Volume and Efficiency settings is accepted; converted distance and volume show one decimal. | U | H | D1 [DR-07 ◐] |

#### FND-DAT-02 — Complete Firestore schema and validation (zod)

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT02-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-DAT02-D2 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D2 [DR-02 ✔] |
| SC-DAT02-D3 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D3 [DR-03 ✔] |
| SC-DAT02-D4 | DR-05 ✔ | Decision applied | Verify ⇒ A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected. | C | C | D4 [DR-05 ✔] |
| SC-DAT02-D5 | DR-06 ✔ | Decision applied | Verify ⇒ The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members. | E | C | D5 [DR-06 ✔] |

#### FND-DAT-04 — Web adapter (Firebase JS SDK, online-only)

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT04-D1 | DR-18 ◐ | Decision applied | Verify ⇒ A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not. | C | H | D1 [DR-18 ◐] |

#### FND-DAT-05 — Repository core: validated reads, local-first writes, subscriptions

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT05-D1 | DR-20 ✔ | Decision applied | Verify ⇒ The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes. | MAN | C | D1 [DR-20 ✔] |

#### FND-DAT-06 — userRepo and vehicleRepo

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT06-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-DAT06-D2 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D2 [DR-02 ✔] |
| SC-DAT06-D3 | DR-13 ◐ | Decision applied | Verify ⇒ An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted. | C | H | D3 [DR-13 ◐] |
| SC-DAT06-D4 | DR-14 ◐ | Decision applied | Verify ⇒ An interrupted vehicle delete leaves the vehicle listed with a 'Delete didn't finish' badge and Retry, and does not resume by itself at launch; the typed name matches ignoring case and surrounding spaces. | E | H | D4 [DR-14 ◐] |
| SC-DAT06-D5 | DR-20 ✔ | Decision applied | Verify ⇒ The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes. | MAN | C | D5 [DR-20 ✔] |

#### FND-DAT-07 — entryRepo, reminderRepo, templateRepo, inviteRepo

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT07-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-DAT07-D2 | DR-20 ✔ | Decision applied | Verify ⇒ The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes. | MAN | C | D2 [DR-20 ✔] |
| SC-DAT07-D3 | DR-23 ◐ | Decision applied | Verify ⇒ `reminderRepo`, `templateRepo` and `inviteRepo` read and validate in Foundation, and `inviteRepo` has no write operations until the Sharing sub-project. | E | H | D3 [DR-23 ◐] |

#### FND-DAT-08 — Shared export/import serializer

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-DAT08-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-DAT08-D2 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D2 [DR-02 ✔] |
| SC-DAT08-D3 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D3 [DR-03 ✔] |

#### FND-SEC-01 — Rules: default deny, users and vehicles

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SEC01-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-SEC01-D2 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D2 [DR-02 ✔] |
| SC-SEC01-D3 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D3 [DR-03 ✔] |
| SC-SEC01-D4 | DR-05 ✔ | Decision applied | Verify ⇒ A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected. | C | C | D4 [DR-05 ✔] |
| SC-SEC01-D5 | DR-06 ✔ | Decision applied | Verify ⇒ The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members. | E | C | D5 [DR-06 ✔] |
| SC-SEC01-D6 | DR-12 ✔ | Decision applied | Verify ⇒ In the Foundation rules any update, by the owner or anyone else, that changes `ownerId`, `memberIds` or `members` is denied; creating a vehicle with the owner as the only member is allowed. | E | C | D6 [DR-12 ✔] |
| SC-SEC01-D7 | DR-13 ◐ | Decision applied | Verify ⇒ An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted. | C | H | D7 [DR-13 ◐] |

#### FND-SEC-02 — Rules: entries, reminders and checklist templates

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SEC02-D1 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D1 [DR-03 ✔] |
| SC-SEC02-D2 | DR-06 ✔ | Decision applied | Verify ⇒ The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members. | E | C | D2 [DR-06 ✔] |

#### FND-SEC-03 — Rules: later-tab paths denied, matrix coverage and merge-path proof

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SEC03-D1 | DR-12 ✔ | Decision applied | Verify ⇒ In the Foundation rules any update, by the owner or anyone else, that changes `ownerId`, `memberIds` or `members` is denied; creating a vehicle with the owner as the only member is allowed. | E | C | D1 [DR-12 ✔] |
| SC-SEC03-D2 | DR-21 ✔ | Decision applied | Verify ⇒ A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release. | CI | H | D2 [DR-21 ✔] |

#### FND-AUTH-01 — Android first launch: anonymous bootstrap and offline gate

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH01-D1 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D1 [DR-02 ✔] |
| SC-AUTH01-D2 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D2 [DR-03 ✔] |
| SC-AUTH01-D3 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D3 [DR-16 ◐] |

#### FND-AUTH-02 — Web Google sign-in

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH02-D1 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D1 [DR-02 ✔] |
| SC-AUTH02-D2 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D2 [DR-03 ✔] |
| SC-AUTH02-D3 | DR-18 ◐ | Decision applied | Verify ⇒ A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not. | C | H | D3 [DR-18 ◐] |

#### FND-AUTH-03 — Link Google (Android): mechanics and Account screen

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH03-D1 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D1 [DR-02 ✔] |
| SC-AUTH03-D2 | DR-17 ◐ | Decision applied | Verify ⇒ With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user. | C | H | D2 [DR-17 ◐] |

#### FND-AUTH-04 — Link triggers: banner, 5th-entry prompt, required-step gate

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH04-D1 | DR-09 ◐ | Decision applied | Verify ⇒ The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted. | C | H | D1 [DR-09 ◐] |

#### FND-AUTH-05 — Account conflict: detection and the three-way choice

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH05-D1 | DR-10 ◐ | Decision applied | Verify ⇒ With 0 vehicles and 0 entries the conflict dialog offers only Switch and Cancel; counts use plural forms ('1 vehicle', '2 vehicles'); Discard on 'Finish moving your data' asks for confirmation before deleting the stored data. | C | H | D1 [DR-10 ◐] |
| SC-AUTH05-D2 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D2 [DR-15 ◐] |
| SC-AUTH05-D3 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D3 [DR-16 ◐] |

#### FND-AUTH-06 — Account merge: Move and switch

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH06-D1 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D1 [DR-02 ✔] |
| SC-AUTH06-D2 | DR-11 ◐ | Decision applied | Verify ⇒ A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline. | U | H | D2 [DR-11 ◐] |
| SC-AUTH06-D3 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D3 [DR-15 ◐] |

#### FND-AUTH-07 — Merge resume and discard ("Finish moving your data")

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH07-D1 | DR-10 ◐ | Decision applied | Verify ⇒ With 0 vehicles and 0 entries the conflict dialog offers only Switch and Cancel; counts use plural forms ('1 vehicle', '2 vehicles'); Discard on 'Finish moving your data' asks for confirmation before deleting the stored data. | C | H | D1 [DR-10 ◐] |
| SC-AUTH07-D2 | DR-11 ◐ | Decision applied | Verify ⇒ A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline. | U | H | D2 [DR-11 ◐] |

#### FND-AUTH-08 — Sign-out

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-AUTH08-D1 | DR-09 ◐ | Decision applied | Verify ⇒ The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted. | C | H | D1 [DR-09 ◐] |
| SC-AUTH08-D2 | DR-11 ◐ | Decision applied | Verify ⇒ A merge batch not confirmed within 30 seconds shows 'Couldn't finish moving your data' with Retry and keeps the stored data; Wait and sync can be cancelled at any time and shows the pending-change count while offline. | U | H | D2 [DR-11 ◐] |
| SC-AUTH08-D3 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D3 [DR-16 ◐] |

#### FND-SHL-01 — Android welcome screen and first-run routing

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHL01-D1 | DR-09 ◐ | Decision applied | Verify ⇒ The welcome screen shows once per uid; killing the app before adding a vehicle and relaunching goes straight to 'Add your first vehicle'; a new anonymous uid shows the welcome again; the link prompt shows when the cross-vehicle entry count is 5 or more, the user is unlinked and has not dismissed it, and stays dismissed after entries are deleted. | C | H | D1 [DR-09 ◐] |

#### FND-SHL-02 — Navigation shell

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHL02-D1 | DR-17 ◐ | Decision applied | Verify ⇒ With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user. | C | H | D1 [DR-17 ◐] |

#### FND-SHL-04 — Vehicle switcher and selected-vehicle state

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHL04-D1 | DR-04 ◐ | Decision applied | Verify ⇒ The palette has 12 ids `c01` to `c12`, each with contrast-checked colours in light and dark mode, and each of the six vehicle types shows its own icon. | C | H | D1 [DR-04 ◐] |
| SC-SHL04-D2 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D2 [DR-15 ◐] |

#### FND-VEH-01 — Add a vehicle (including the first-vehicle empty state)

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VEH01-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-VEH01-D2 | DR-02 ✔ | Decision applied | Verify ⇒ An anonymous owner's `members[uid]` has no `name` or `email`, and entries logged while anonymous have `createdByName` 'Me'. After linking Google, `users.displayName` and the owner's `members` name and email are set on every owned vehicle, and entries holding the placeholder are rewritten with the Google name in batches of 500 without changing `updatedAt` or `updatedBy`; running the rewrite again changes nothing. | E | C | D2 [DR-02 ✔] |
| SC-VEH01-D3 | DR-04 ◐ | Decision applied | Verify ⇒ The palette has 12 ids `c01` to `c12`, each with contrast-checked colours in light and dark mode, and each of the six vehicle types shows its own icon. | C | H | D3 [DR-04 ◐] |
| SC-VEH01-D4 | DR-05 ✔ | Decision applied | Verify ⇒ A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected. | C | C | D4 [DR-05 ✔] |
| SC-VEH01-D5 | DR-06 ✔ | Decision applied | Verify ⇒ The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members. | E | C | D5 [DR-06 ✔] |
| SC-VEH01-D6 | DR-08 ◐ | Decision applied | Verify ⇒ A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes. | C | H | D6 [DR-08 ◐] |
| SC-VEH01-D7 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D7 [DR-15 ◐] |

#### FND-VEH-02 — Edit a vehicle (locked units)

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VEH02-D1 | DR-01 ✔ | Decision applied | Verify ⇒ Adding a vehicle with odometer 12,000 stores `startOdometer` 12,000, `lastOdometer` 12,000 and `lastOdometerAt` equal to the creation time. Once the vehicle has an entry, `startOdometer`, odometer unit and currency are read-only in the edit form and a repository attempt to change any of them is rejected. | E | C | D1 [DR-01 ✔] |
| SC-VEH02-D2 | DR-05 ✔ | Decision applied | Verify ⇒ A vehicle name of 60 characters is accepted and 61 rejected; plate 15 accepted and 16 rejected; years 1950 and next year accepted, 1949 and the year after next rejected; odometer 0 and 9,999,999.9 accepted, negative values, more than one decimal and values above 9,999,999.9 rejected; a second vehicle with the same name (ignoring case and spaces) owned by the same user, archived vehicles included, is rejected at create and rename; a vehicle with no fuel type is rejected. | C | C | D2 [DR-05 ✔] |
| SC-VEH02-D3 | DR-13 ◐ | Decision applied | Verify ⇒ An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted. | C | H | D3 [DR-13 ◐] |

#### FND-VEH-03 — Archive, unarchive and the Vehicles list

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VEH03-D1 | DR-08 ◐ | Decision applied | Verify ⇒ A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes. | C | H | D1 [DR-08 ◐] |
| SC-VEH03-D2 | DR-13 ◐ | Decision applied | Verify ⇒ An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted. | C | H | D2 [DR-13 ◐] |
| SC-VEH03-D3 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D3 [DR-15 ◐] |

#### FND-VEH-04 — Delete a vehicle

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VEH04-D1 | DR-13 ◐ | Decision applied | Verify ⇒ An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted. | C | H | D1 [DR-13 ◐] |
| SC-VEH04-D2 | DR-14 ◐ | Decision applied | Verify ⇒ An interrupted vehicle delete leaves the vehicle listed with a 'Delete didn't finish' badge and Retry, and does not resume by itself at launch; the typed name matches ignoring case and surrounding spaces. | E | H | D2 [DR-14 ◐] |
| SC-VEH04-D3 | DR-15 ◐ | Decision applied | Verify ⇒ After the selected vehicle is archived or deleted, the most recently selected remaining vehicle on this device is chosen; with nothing stored, the first non-archived vehicle by creation date is selected. | C | H | D3 [DR-15 ◐] |
| SC-VEH04-D4 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D4 [DR-16 ◐] |

#### FND-SET-01 — i18n scaffolding

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SET01-D1 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D1 [DR-03 ✔] |
| SC-SET01-D2 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D2 [DR-16 ◐] |

#### FND-SET-02 — Settings

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SET02-D1 | DR-03 ✔ | Decision applied | Verify ⇒ Stored enums use lowercase machine ids (for example `petrol`, `cng`, `owner`, `member`, `system`, `km_per_l`), values the SRS spells out are exact, colour is a palette id, `category` holds the name text and `serviceType` a lowercase id, `schemaVersion` is the integer 1, `quantity` is a decimal number, a user document created at web sign-in has `isLinked: true`, a new user document holds every settings key including `backupFrequency: weekly` and an empty `mutedReminderVehicleIds`, and a document with a higher `schemaVersion` than the app knows is skipped and reported like a malformed one. | U | C | D1 [DR-03 ✔] |
| SC-SET02-D2 | DR-07 ◐ | Decision applied | Verify ⇒ 245000 minor units of INR show as ₹2,450.00 and 123456700 as ₹12,34,567.00; a USD amount shows with international grouping; funds, metal and test codes such as XAU, XTS and XXX are not selectable; `mpg` uses US gallons unless the Volume setting is UK gallons; any combination of Distance, Volume and Efficiency settings is accepted; converted distance and volume show one decimal. | U | H | D2 [DR-07 ◐] |
| SC-SET02-D3 | DR-08 ◐ | Decision applied | Verify ⇒ A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes. | C | H | D3 [DR-08 ◐] |

#### FND-OBS-02 — Connectivity and quota behaviors

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-OBS02-D1 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D1 [DR-16 ◐] |
| SC-OBS02-D2 | DR-18 ◐ | Decision applied | Verify ⇒ A web save not confirmed within 15 seconds shows the offline banner and keeps the form open with Retry; a sign-in popup that rejects as blocked starts the redirect flow and a user-cancelled popup does not. | C | H | D2 [DR-18 ◐] |

#### FND-OBS-03 — Access-denied and malformed-document behaviors

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-OBS03-D1 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D1 [DR-16 ◐] |

#### FND-OBS-04 — Pending-sync indicator and Sync issues

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-OBS04-D1 | DR-16 ◐ | Decision applied | Verify ⇒ Every message the specs leave open exists as an i18n key with provisional English text; an owner's permission-denied shows 'Something went wrong' with Retry and logs a non-fatal; the anonymous data-loss warning appears on the More banner and the Account screen. | C | H | D1 [DR-16 ◐] |
| SC-OBS04-D2 | DR-19 ◐ | Decision applied | Verify ⇒ Retry in Sync issues resubmits the original change; Discard returns the item to its server state; the list is not kept after a restart and never shows amounts, plates or notes. | U | H | D2 [DR-19 ◐] |

#### FND-VER-01 — Spike: Firestore quota budget (gate G2)

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VER01-D1 | DR-20 ✔ | Decision applied | Verify ⇒ The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes. | MAN | C | D1 [DR-20 ✔] |

#### FND-VER-02 — Foundation end-to-end and manual verification pack

| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-VER02-D1 | DR-08 ◐ | Decision applied | Verify ⇒ A km vehicle's odometer shows in miles when the Distance unit is mi, an `hours` vehicle stays in hours, and the Settings screen shows a read-only preview of currency, volume, efficiency and date that updates as each setting changes. | C | H | D1 [DR-08 ◐] |

