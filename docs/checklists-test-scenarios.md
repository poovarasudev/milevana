# Milevana v1 — Sub-project 7: Checklists — Test Scenarios

**Source:** `docs/checklists-backlog.md` (10 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story; the criteria are the derived ones the backlog proposed.
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual. **Priority:** C Critical · H High · M Medium · L Low.

---

### CHK-01 — Domain: checklist logic
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK01-01 | Starters by type | Vehicle types | 1. car, truck, bus, other ⇒ Car pre-trip and Long trip.<br>2. bike, scooter ⇒ Two-wheeler and Long trip | U | H | #1 |
| SC-CHK01-02 | Snapshot | Template of 12 items, answers with 2 Fail | 1. Build ⇒ `templateName`, items `{id, label, group?, result, note?}`, `issueCount` 2.<br>2. Item ids equal the template item ids | U | C | #2, D3 |
| SC-CHK01-03 | Immutability | Built snapshot | 1. Edit or delete the template afterwards ⇒ snapshot unchanged | U | C | #3 |
| SC-CHK01-04 | Limits and constraints | Templates | 1. 51 items ⇒ invalid; 21st template ⇒ refused.<br>2. Name 61 characters, duplicate name ignoring case, 0 items ⇒ invalid; reorder and duplicate labels allowed.<br>3. Starters offered whenever there are no templates; copy naming ' (copy)', ' (copy 2)'.<br>4. Unanswered items stored as `na` after confirmation; note over 500 characters ⇒ rejected | U | C | #4, D1, D2, D4, D5 |

### CHK-02 — Checklists screen
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK02-01 | List | Vehicle with 3 templates | 1. More → Checklists ⇒ list (not "Coming soon"), each with name and item count | C | H | #1, #2 |
| SC-CHK02-02 | Empty and limit | No templates; 20 templates | 1. Empty ⇒ starters offered.<br>2. 20 templates ⇒ adding blocked with a message | C | H | #3, #4 |
| SC-CHK02-03 | Archived and names | Archived vehicle | 1. Cannot add or edit templates; name rule applies on creation (unique ignoring case) | C | H | D1, D2 |

### CHK-03 — Starter templates
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK03-01 | Offering by type | Car; bike | 1. Car with none ⇒ Car pre-trip and Long trip offered.<br>2. Bike ⇒ Two-wheeler and Long trip offered | C | H | #1, #2 |
| SC-CHK03-02 | Contents | Pick Car pre-trip | 1. Items match the SRS list; "documents" are four items (RC, insurance, PUC, licence) under a "Documents" group; created from English i18n strings | C | C | #3, D1 |
| SC-CHK03-03 | Picking | Bike with no templates; vehicle at 19 templates | 1. Pick Car pre-trip on the bike ⇒ allowed; several at once ⇒ allowed.<br>2. Starters count toward 20 ⇒ the 21st blocked.<br>3. Delete every template ⇒ starters offered again | C | H | #4, D1, D2 |

### CHK-04 — Create, edit and delete a template
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK04-01 | Create | Member | 1. Name plus items with optional groups ⇒ saved; labels and groups 1–60 characters; reorder works | C | H | #1, D3 |
| SC-CHK04-02 | 50-item cap and text limits | Editor | 1. 51st item ⇒ cannot add; rules reject it.<br>2. Short text over 60 characters ⇒ rejected | E | C | #2, D1 |
| SC-CHK04-03 | Permissions | Creator, other member, owner | 1. Other member edits ⇒ allowed.<br>2. Delete by creator or owner ⇒ allowed; by another member ⇒ denied | E | C | #3 |
| SC-CHK04-04 | Past inspections, ids, repo | Existing inspection | 1. Edit or delete the template ⇒ inspection unchanged.<br>2. Template item ids random; two members saving in turn ⇒ later version wins.<br>3. `templateRepo` supports create, update, delete here ⇒ true | E | C | #4, D2, D4 |

### CHK-05 — Copy a template to another vehicle
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK05-01 | Choose destination | User in 3 vehicles, one archived | 1. Copy ⇒ lists non-archived vehicles only | C | H | #1 |
| SC-CHK05-02 | Copy | Template "Pre-trip" | 1. Copy ⇒ same items.<br>2. Destination already has "Pre-trip" ⇒ copy named "Pre-trip (copy)", then "Pre-trip (copy 2)"; new item ids; copier is creator | E | C | #2, D1 |
| SC-CHK05-03 | Full destination | Destination has 20 | 1. Copy ⇒ blocked "That vehicle already has 20 checklists." | C | H | #3, D1 |

### CHK-06 — Run an inspection
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK06-01 | Add sheet | Vehicle with templates | 1. Add → Inspection ⇒ template picker (not a placeholder); none ⇒ starters | C | H | #1 |
| SC-CHK06-02 | Answer items | Template of 12 items | 1. Mark Pass, Fail, N/A with notes; items under their groups in template order.<br>2. Clear an answer before saving ⇒ unanswered | C | C | #2, D5 |
| SC-CHK06-03 | Save snapshot | 12 items, 2 Fail, odometer 10,500 | 1. Save ⇒ one `inspection` entry with snapshot, template item ids, `issueCount` 2, no `amount`, no `category`; `lastOdometer` updated in the same batch.<br>2. Date defaults to now; an out-of-order odometer warns without blocking | E | C | #3, D2, D3, D4 |
| SC-CHK06-04 | Unanswered and leaving | 3 unanswered items | 1. Save ⇒ confirmation, stored as `na`.<br>2. Leave the run ⇒ confirmation, then discarded.<br>3. Note of 501 characters ⇒ rejected | C | H | D5 |
| SC-CHK06-05 | Immutability and offline | Saved inspection; airplane mode; archived vehicle | 1. Edit the template afterwards ⇒ inspection unchanged; a run in progress is unaffected by a template edit.<br>2. Inspection saves offline with the sync icon.<br>3. Archived vehicle ⇒ cannot run an inspection | M | C | #4, #5, D1, D4 |

### CHK-07 — Inspection photos tagged to items
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK07-01 | Add photos | Linked user, Drive granted | 1. Add photos to an inspection, maximum 5 ⇒ a sixth refused; statuses follow the attachment lifecycle | C | H | #1, D1 |
| SC-CHK07-02 | Tag | Photos on an inspection | 1. Tag a photo with an item ⇒ `itemId` equals that item's snapshot id.<br>2. One tag per photo; untagged allowed; change the tag while editing ⇒ true | C | C | #2, D3 |
| SC-CHK07-03 | Scope and web | Non-inspection entry; web | 1. `itemId` never set on other entry types.<br>2. Web ⇒ file picker; upload must finish before the entry saves | E | H | #3, D2 |

### CHK-08 — Summary and failed-item shortcuts
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK08-01 | Summary content | Inspection with 2 Fail | 1. After saving ⇒ summary lists exactly the Fail items | C | C | #1 |
| SC-CHK08-02 | Create reminder | Failed item "Tyre pressure" on "Swift" | 1. Tap Create reminder ⇒ form with title "Tyre pressure — Swift", subject kind `custom`, no trigger set (saving requires one) | C | H | #2, D1, D2 |
| SC-CHK08-03 | Log service and nothing automatic | Same | 1. Tap Log service ⇒ Service form with notes "Tyre pressure failed in inspection" and no service type.<br>2. Close either form or leave the summary ⇒ no reminder or service created.<br>3. Shortcuts also available from the saved inspection | C | C | #3, #4, D2 |

### CHK-09 — Inspections in History
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK09-01 | Row and badge | Inspections with 2, 1 and 0 issues | 1. Rows show template name, date, badge "2 issues", "1 issue", "No issues" and the odometer if present | C | H | #1, D5 |
| SC-CHK09-02 | Snapshot after template change | Template later renamed and deleted | 1. Opening the inspection shows the snapshot as saved | C | C | #2 |
| SC-CHK09-03 | Filter and search | Mixed entries | 1. Type filter shows only inspections.<br>2. Search for text in an item note ⇒ no match; template name and entry notes ⇒ match | C | H | #3, #4, D1, D5 |
| SC-CHK09-04 | Delete and edit | Inspection by creator; member viewing; owner | 1. Delete ⇒ Undo window, then removed; Drive files removed after the window.<br>2. Creator or owner edits results, notes, odometer, date, photos ⇒ `issueCount` and badge update; item list fixed.<br>3. Another member ⇒ read-only | E | C | #5, D2, D3, D4 |

### CHK-10 — Checklists verification
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-CHK10-01 | Snapshot immutability end to end | Saved inspection | 1. Edit then delete the template ⇒ inspection unchanged | MAN | C | #1 |
| SC-CHK10-02 | Limits | Vehicles at 20 templates | 1. 51st item refused, 21st template refused, copy to a full vehicle blocked | MAN | C | #2 |
| SC-CHK10-03 | Permissions with two accounts | Creator, other member | 1. Other member cannot delete; owner can ⇒ true | MAN | C | #3 |
| SC-CHK10-04 | Merge, backup, delete | Anonymous data with templates | 1. Account merge copies templates.<br>2. Backup and restore round-trips them.<br>3. Vehicle delete removes them | MAN | C | #4 |
| SC-CHK10-05 | Tagged photos round trip | Inspection with tagged photos | 1. Photos upload to Drive and come back with their tags ⇒ true | MAN | H | #5 |
