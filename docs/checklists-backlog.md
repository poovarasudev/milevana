# Milevana v1 — Sub-project 7: Checklists — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 10 in 4 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Same thin specification as sub-projects 2 to 6.** PRD §23.7 records "what the source already fixes", the tab 7 decisions, OQ-59, OQ-60 and the approved template and inspection shapes (Appendix E). It says "Acceptance criteria: defined in tab 7".
- **There are no PRD acceptance criteria and no `FR-` IDs for sub-project 7** (PRD §25.4). The criteria below are **derived from stated behavior** and cite the row they restate. They are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-16`, `PR-18`, `FR-NAV-04`, `FR-NAV-05`, `FR-SEC-09`, `FR-SEC-13`, `FR-VEH-07`, `FR-MERGE-02`, `FR-SER-02`, `FR-I18N-03`, `OQ-31`, `OQ-41`, `OQ-45`, `OQ-53`, `OQ-59`, `OQ-60`, limitation `L17`, and Foundation `AC-D*` items. Where the PRD gives only a row in §23.7, the row name is cited, for example "§23.7 *Failed items*".

**Labels.** `CHK-nn` story IDs and `CD-nn` decision labels are tracking labels, not requirement IDs. Earlier decisions are `DR-nn` (Foundation), `LD-nn` (Logging), `RD-nn` (Reminders), `ED-nn` (Drive and export).

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `CD-nn`, plus the earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.7):** per-vehicle checklist templates, the three starter templates, running an inspection, inspection photos tagged to items, the failed-item shortcuts, inspections in History, and copying a template to another vehicle.

**What earlier sub-projects provide** (assumed accepted): the `checklistTemplates` schema and rules (members read, create and update with at most 50 items; the creator or owner deletes) and a validated `templateRepo` (`FND-DAT-02`, `FND-SEC-02`, `FND-DAT-07`); the Add sheet with an Inspection placeholder and More → Checklists as "Coming soon" (`FND-SHL-02`); the entry form shell, History, edit and delete with Undo (`LOG-04`, `LOG-11`, `LOG-13`, `LOG-14`); the reminder form and the service form (`REM-05`, `LOG-08`); receipt attachments through Drive (`DRV-11`, `DRV-12`); templates already included in account merge and backup (`FND-DAT-08`, `DRV-06`) and removed on vehicle delete (`FND-VEH-04`).

**Out of scope:** checklist-specific reports (not in v1); scheduled inspections (not in v1; a custom repeating reminder covers "inspect weekly"); number or text item types (only pass, fail and N/A with notes); search over inspection item notes (excluded); any automatic creation of reminders or services.

**Scope notes (not product decisions):**
1. The 20-templates-per-vehicle limit is enforced by the app only, because rules cannot count documents (OQ-59, L17).
2. An inspection has no `amount` and no `category` (OQ-31, OQ-60). It is not a cost, so reports do not count it.
3. Foundation's DR-23 (which operations `templateRepo` exposes) is answered in practice by `CHK-04`. If the owner answered it differently, that answer applies.
4. Behaviors for several members use seeded data or the Sharing sub-project's test accounts.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| C1 | Checklists foundation | CHK-01 |
| C2 | Templates | CHK-02 to CHK-05 |
| C3 | Inspections | CHK-06 to CHK-09 |
| C4 | Verification | CHK-10 |

---

# C1 — Checklists foundation

### CHK-01 — Domain: checklist logic
- **Epic:** C1 · **Type:** Architecture · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want pure checklist functions, so that templates, snapshots, issue counts and limits are correct and tested before any screen uses them.
- **Business value:** The snapshot rule ("editing or deleting the template later never changes past inspections") is easy to break; one tested definition protects it.
- **Scope:** *In:* `src/domain/` checklist module: the starter templates and which are offered per vehicle type; template validation (name, up to 50 items); building an inspection snapshot from a template and the user's answers (stable item ids, results pass, fail or N/A, optional notes, `issueCount`); the list of failed items; the 20-per-vehicle check for create and copy. *Out:* screens, storage.
- **Preconditions:** `FND-DAT-02` (template and inspection shapes).
- **Functional behavior:**
  1. `startersFor(vehicleType)` returns Car pre-trip and Long trip for car, truck, bus and other; Two-wheeler and Long trip for bike and scooter.
  2. `buildInspection(template, answers)` returns `templateName`, `items` as `{ id, label, group?, result, note? }` and `issueCount` equal to the number of `fail` items.
  3. `failedItems(inspection)` returns the failed items for the summary.
  4. `canAddTemplate(count)` is false at 20.
- **Business rules:** Up to 50 items and 20 templates per vehicle; snapshot item ids are stable; result values are `pass`, `fail`, `na`; an inspection has no `amount` and no `category` (Appendix E, OQ-59, OQ-60).
- **Edge cases:** A template with no failed items. A template edited after the snapshot. Item with a group and without. Decision applied: CD-01 (constraints), CD-02 (starter content), CD-03 (snapshot id source), CD-04 (unanswered items).
- **Android/web differences:** None.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None (uses Appendix E shapes).
- **Acceptance criteria:**
  1. Starters are offered per vehicle type as OQ-60 states [OQ-60].
  2. A snapshot copies labels, groups and results and counts `fail` items in `issueCount` [Appendix E].
  3. Changing the template afterwards leaves a built snapshot unchanged [§23.7 *Saving*].
  4. A template over 50 items is invalid and a 21st template is refused [OQ-59].
- **Decisions applied:** CD-01 ◐, CD-02 ◐, CD-03 ◐, CD-04 ◐, CD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [CD-01 ◐] A template name over 60 characters, or a duplicate on the same vehicle ignoring case, is rejected; item labels and groups of 1 to 60 characters are accepted; a template with 0 items is rejected; items can be reordered; duplicate labels are accepted.
  2. **D2** [CD-02 ◐] The Car pre-trip starter has four separate document items (RC, insurance, PUC, licence) under a 'Documents' group; starters are offered whenever the vehicle has no templates, including after the last one is deleted; several can be picked at once.
  3. **D3** [CD-03 ◐] A saved inspection's item ids equal the template's item ids; two members saving the same template in turn leaves the later version; a run in progress is unaffected by a template edit.
  4. **D4** [CD-04 ◐] Saving with 3 unanswered items asks for confirmation and stores them as `na`; an answer can be cleared before saving; leaving the run asks for confirmation and discards it; a note over 500 characters is rejected.
  5. **D5** [CD-08 ◐] Copying a template named 'Pre-trip' to a vehicle that already has one names the copy 'Pre-trip (copy)', then 'Pre-trip (copy 2)'; the copy has new item ids and the copier as creator; a destination with 20 templates shows 'That vehicle already has 20 checklists.'; starters count toward the 20.
- **Test requirements:** Jest, written first (TS-03 style), including snapshot immutability.
- **Dependencies:** FND-DAT-02.
- **PRD requirement IDs:** PR-16, FR-DATA-12, FR-SEC-13, OQ-59, OQ-60, TS-03.
- **SRS reference:** Templates L545–552; Saving L560–564; Checklist template L778–780; Inspection details L753–755; OQ-60 L701.

---

# C2 — Templates

### CHK-02 — Checklists screen
- **Epic:** C2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle member, I want to see the vehicle's checklists in one place, so that I can manage them and start an inspection.
- **Business value:** Replaces "Coming soon" in More; the home of everything in this sub-project.
- **Scope:** *In:* More → Checklists for the selected vehicle: its templates with item counts; an action to add a template; an action to start an inspection from a template; the empty state offering starters (CHK-03); a message at the limit of 20; web layout. *Out:* the template editor (CHK-04), copy (CHK-05).
- **Preconditions:** CHK-01, `FND-SHL-02`, `FND-SHL-04`.
- **Functional behavior:**
  1. The screen lists the vehicle's templates and their item counts.
  2. With no templates it offers the starters.
  3. At 20 templates adding is blocked with a clear message.
- **Business rules:** Templates are stored per vehicle (§23.7 *Storage*); any member can read, create and edit; 20 per vehicle enforced by the app (OQ-59). Archived vehicles are read-only until unarchived (OQ-39).
- **Edge cases:** A malformed template document (skipped with the Foundation message). Offline. A vehicle with other members' templates. Decision applied: Foundation DR-13 for archived vehicles.
- **Android/web differences:** Web at 768 px and wider uses the rail layout and dialogs.
- **Offline behavior:** Lists from the cache; pending items show the sync icon.
- **Security implications:** Members only (rules).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. More → Checklists opens the list instead of "Coming soon" [FR-NAV-05, AC-D16].
  2. The list shows each template's name and item count [§23.7].
  3. With none, the starters are offered [§23.7 *Starter templates*].
  4. At 20 templates, adding shows a message and does nothing [OQ-59].
- **Decisions applied:** DR-13 ◐, CD-01 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [CD-01 ◐] A template name over 60 characters, or a duplicate on the same vehicle ignoring case, is rejected; item labels and groups of 1 to 60 characters are accepted; a template with 0 items is rejected; items can be reordered; duplicate labels are accepted.
- **Test requirements:** RNTL with seeded templates.
- **Dependencies:** CHK-01, FND-SHL-02, FND-SHL-04.
- **PRD requirement IDs:** PR-16, FR-NAV-05, OQ-39, OQ-59; AC-D16.
- **SRS reference:** Where templates live L541–543; Templates L545–552; Navigation L259.

### CHK-03 — Starter templates
- **Epic:** C2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a new user with no checklist, I want ready-made starters for my kind of vehicle, so that I can run my first inspection in a minute.
- **Business value:** Lowers the effort to start; most users will begin from a starter.
- **Scope:** *In:* offering the starters when the vehicle has no templates; by vehicle type (car, truck, bus, other: Car pre-trip and Long trip; bike, scooter: Two-wheeler and Long trip); the user can pick any of them; picking creates an ordinary editable template with the stated items. *Out:* the template editor (CHK-04).
- **Preconditions:** CHK-01, CHK-02, CHK-04.
- **Functional behavior:**
  1. A vehicle with no templates shows the offered starters.
  2. Choosing one creates a template with its items and groups.
  3. The user can pick a starter not offered for the vehicle type.
- **Business rules:** §23.7 *Starter templates* contents: **Car pre-trip** (tyre pressure and tread, lights and indicators, brakes, horn, wipers, engine oil, coolant, brake fluid, mirrors, documents RC, insurance, PUC, licence); **Two-wheeler** (tyres, chain lubrication and tension, brakes, lights, horn, mirrors, fuel, documents); **Long trip** (spare tyre and jack, toolkit, first-aid kit, fluids, battery, AC, FASTag balance). Offered when the vehicle has none yet; offered by vehicle type and any may be picked (OQ-60). All text goes through i18n (FR-I18N-03).
- **Edge cases:** Creating a starter at the 20 limit. Picking several starters. A user who deletes every template. Decision applied: CD-02.
- **Android/web differences:** None.
- **Offline behavior:** Creating a starter works offline on Android.
- **Security implications:** None.
- **Data/schema impact:** Creates `checklistTemplates` documents with the creator as `createdBy`.
- **Acceptance criteria:**
  1. A car, truck, bus or other vehicle with no templates is offered Car pre-trip and Long trip [OQ-60].
  2. A bike or scooter is offered Two-wheeler and Long trip [OQ-60].
  3. Picking a starter creates a template whose items match the SRS list [§23.7 *Starter templates*].
  4. The user can pick a starter that was not offered for the type [OQ-60].
- **Decisions applied:** CD-02 ◐, CD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [CD-02 ◐] The Car pre-trip starter has four separate document items (RC, insurance, PUC, licence) under a 'Documents' group; starters are offered whenever the vehicle has no templates, including after the last one is deleted; several can be picked at once.
  2. **D2** [CD-08 ◐] Copying a template named 'Pre-trip' to a vehicle that already has one names the copy 'Pre-trip (copy)', then 'Pre-trip (copy 2)'; the copy has new item ids and the copier as creator; a destination with 20 templates shows 'That vehicle already has 20 checklists.'; starters count toward the 20.
- **Test requirements:** RNTL; Jest (`startersFor`).
- **Dependencies:** CHK-01, CHK-02, CHK-04.
- **PRD requirement IDs:** PR-16, FR-I18N-03, OQ-59, OQ-60; §23.7 *Starter templates*.
- **SRS reference:** Templates L545–552; OQ-60 L701.

### CHK-04 — Create, edit and delete a template
- **Epic:** C2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle member, I want to build and change my own checklists, so that they match how I actually check the vehicle.
- **Business value:** Checklists are only useful if they fit the vehicle and the user.
- **Scope:** *In:* the template editor: a name and a list of items, each a short label with an optional group such as "Tyres", "Lights" or "Documents"; up to 50 items; save, edit and delete through `templateRepo` write operations; delete limited to the creator or the owner. *Out:* copy (CHK-05).
- **Preconditions:** CHK-01, `FND-DAT-07`, `FND-SEC-02`.
- **Functional behavior:**
  1. Add, remove and edit items; each has a label and an optional group.
  2. Save creates or updates the template.
  3. Delete is offered only to the creator or the owner.
- **Business rules:** Any member can read, create and update; the creator or owner deletes (§23.7 *Permissions*, rules). Up to 50 items per template (rules) and 20 templates per vehicle (app) (OQ-59). Rules cap text lengths (OQ-60). Editing or deleting a template never changes past inspections (§23.7 *Saving*).
- **Edge cases:** The 51st item. Empty name or no items. Two members editing at once. Editing offline. Decision applied: CD-01, CD-03; Foundation DR-06 for text caps.
- **Android/web differences:** Android works offline with the sync icon; web is online only.
- **Offline behavior:** Saves locally on Android.
- **Security implications:** Rules enforce who may delete and the 50-item cap; the client mirrors them.
- **Data/schema impact:** `checklistTemplates` documents per Appendix E; resolves Foundation DR-23 for this repository.
- **Acceptance criteria:**
  1. A member can create a template with a name and items having optional groups [§23.7 *Items*].
  2. A 51st item cannot be added [FR-SEC-13, §23.7 *Template size*].
  3. Another member can edit the template; only its creator or the owner can delete it [§23.7 *Permissions*].
  4. Editing or deleting a template does not change an existing inspection [§23.7 *Saving*].
- **Decisions applied:** DR-06 ✔, DR-23 ◐, CD-01 ◐, CD-03 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-06 ✔] The rules accept short text of exactly 60 characters, a plate of 15 and notes of 500, and reject one more character in each; they reject more than 5 attachments, 50 template items or 10 members.
  2. **D2** [DR-23 ◐] `reminderRepo`, `templateRepo` and `inviteRepo` read and validate in Foundation, and `inviteRepo` has no write operations until the Sharing sub-project.
  3. **D3** [CD-01 ◐] A template name over 60 characters, or a duplicate on the same vehicle ignoring case, is rejected; item labels and groups of 1 to 60 characters are accepted; a template with 0 items is rejected; items can be reordered; duplicate labels are accepted.
  4. **D4** [CD-03 ◐] A saved inspection's item ids equal the template's item ids; two members saving the same template in turn leaves the later version; a run in progress is unaffected by a template edit.
- **Test requirements:** RNTL; emulator repository tests; rules tests already exist (`FND-SEC-02`).
- **Dependencies:** CHK-01, FND-DAT-07, FND-SEC-02.
- **PRD requirement IDs:** PR-16, FR-SEC-09, FR-SEC-13, OQ-59, OQ-60; §23.7 *Items*, *Permissions*.
- **SRS reference:** Templates L545–552; Permissions L566–568; Rules L195; OQ-59 L700.

### CHK-05 — Copy a template to another vehicle
- **Epic:** C2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an owner of several vehicles, I want to copy a checklist to another of my vehicles, so that I do not rebuild it.
- **Business value:** Templates are per vehicle, so copy is how a good checklist travels.
- **Scope:** *In:* **Copy to another vehicle** on a template: a list of every vehicle the user is a member of, excluding archived vehicles; creating the copy on the chosen vehicle; blocking the copy when that vehicle already has 20 templates. *Out:* the editor (CHK-04).
- **Preconditions:** CHK-02, CHK-04.
- **Functional behavior:**
  1. The user chooses Copy; the app lists the user's non-archived vehicles.
  2. Choosing one creates a copy there.
  3. A full destination blocks the copy with a message.
- **Business rules:** "Copy to another vehicle" lists every vehicle the user is a member of; the copy list excludes archived vehicles; a copy to a vehicle that is full is blocked (§23.7 *Copy*, OQ-60, OQ-59).
- **Edge cases:** Only one vehicle. A destination where the user cannot create (every member can). A name already used there. Decision applied: CD-08.
- **Android/web differences:** None.
- **Offline behavior:** Works offline on Android with the sync icon.
- **Security implications:** Members only on both vehicles (rules).
- **Data/schema impact:** Creates a `checklistTemplates` document on the destination vehicle.
- **Acceptance criteria:**
  1. The copy list shows every non-archived vehicle the user belongs to [§23.7 *Copy*, OQ-60].
  2. Choosing one creates a copy with the same items [§23.7].
  3. A destination with 20 templates blocks the copy and explains why [OQ-59].
- **Decisions applied:** CD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [CD-08 ◐] Copying a template named 'Pre-trip' to a vehicle that already has one names the copy 'Pre-trip (copy)', then 'Pre-trip (copy 2)'; the copy has new item ids and the copier as creator; a destination with 20 templates shows 'That vehicle already has 20 checklists.'; starters count toward the 20.
- **Test requirements:** RNTL with several vehicles; emulator test.
- **Dependencies:** CHK-02, CHK-04.
- **PRD requirement IDs:** PR-16, OQ-59, OQ-60; §23.7 *Copy*.
- **SRS reference:** Copy L570–572; OQ-59 L700; OQ-60 L701.

---

# C3 — Inspections

### CHK-06 — Run an inspection
- **Epic:** C3 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver, I want to go through a checklist and mark each item Pass, Fail or N/A, so that I have a record of the vehicle's condition.
- **Business value:** The core of the sub-project: a dated record of an inspection.
- **Scope:** *In:* the Add sheet's Inspection item opens the flow (replacing the placeholder): pick a template; for each item tap Pass, Fail or N/A with an optional note; optional odometer; date; save as an `inspection` entry holding a snapshot (`templateName`, `items` with stable ids, `issueCount`), with no `amount` and no `category`. *Out:* photos (CHK-07), the summary shortcuts (CHK-08).
- **Preconditions:** CHK-01, CHK-04, `LOG-04`.
- **Functional behavior:**
  1. Choosing Inspection opens the template picker; a vehicle with none is offered the starters.
  2. Each item gets a result and an optional note; the odometer is optional.
  3. Save writes one inspection entry with the snapshot; if an odometer is entered, `lastOdometer` is updated in the same batch.
- **Business rules:** Pick a template, tap Pass, Fail or N/A per item, with an optional note on any item; odometer is optional; the result is a snapshot of labels and results, and later template changes never alter it (§23.7). Any member can run inspections (§23.7 *Permissions*). Inspections have no `amount` (OQ-31, OQ-60).
- **Edge cases:** Leaving items unanswered. Leaving the flow midway. A template with 50 items. Archived vehicle (Foundation DR-13). Decision applied: CD-03, CD-04; Logging LD-04 (date), LD-05 (odometer check).
- **Android/web differences:** Web works online only; Android saves offline.
- **Offline behavior:** The entry saves locally on Android and shows the sync icon.
- **Security implications:** Item notes are user text and are never sent to Crashlytics.
- **Data/schema impact:** `entries` of type `inspection` with inspection details.
- **Acceptance criteria:**
  1. The Add sheet's Inspection item opens the template picker instead of a placeholder [FR-NAV-04, AC-D15].
  2. Each item can be marked Pass, Fail or N/A with an optional note [§23.7 *Running an inspection*].
  3. The saved entry has a snapshot with stable item ids, `issueCount` equal to the failed items, no `amount` and no `category` [Appendix E, OQ-60].
  4. Editing the template afterwards leaves the saved inspection unchanged [§23.7 *Saving*].
  5. The inspection saves offline on Android [PR-03].
- **Decisions applied:** DR-13 ◐, LD-04 ◐, LD-05 ◐, CD-03 ◐, CD-04 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-13 ◐] An archived vehicle cannot be edited and accepts no entry, reminder or template changes in the app; it can be unarchived and deleted.
  2. **D2** [LD-04 ◐] A new entry defaults to the current local date and time to the minute, and a future date is accepted with a 'future date' note.
  3. **D3** [LD-05 ◐] Saving an entry whose odometer is lower than an earlier-dated entry's (any type, a trip's start and end included) shows an inline warning under the field and Save stays enabled; a trip's end odometer becomes the entry odometer and can raise `lastOdometer`, its start odometer does not.
  4. **D4** [CD-03 ◐] A saved inspection's item ids equal the template's item ids; two members saving the same template in turn leaves the later version; a run in progress is unaffected by a template edit.
  5. **D5** [CD-04 ◐] Saving with 3 unanswered items asks for confirmation and stores them as `na`; an answer can be cleared before saving; leaving the run asks for confirmation and discards it; a note over 500 characters is rejected.
- **Test requirements:** RNTL; emulator save test.
- **Dependencies:** CHK-01, CHK-04, LOG-04.
- **PRD requirement IDs:** PR-16, PR-03, FR-NAV-04, OQ-31, OQ-60; AC-D15; §23.7 *Running an inspection*, *Saving*.
- **SRS reference:** Running an inspection L554–558; Saving L560–564; Inspection details L753–755.

### CHK-07 — Inspection photos tagged to items
- **Epic:** C3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver, I want to attach photos to an inspection and say which item each shows, so that a failed item comes with proof.
- **Business value:** A photo of a worn tyre next to "Tyres: Fail" is the point of an inspection record.
- **Scope:** *In:* attaching up to 5 photos (and the other attachment types the Drive sub-project allows) to an inspection through Drive; tagging each photo with the item it shows through `attachments[].itemId`, which points at an item in the entry's snapshot. *Out:* the attachment and queue mechanism itself (`DRV-11`, `DRV-12`).
- **Preconditions:** CHK-06, `DRV-11`, `DRV-12`.
- **Functional behavior:**
  1. In the inspection flow the user adds photos, as for any entry.
  2. For each photo the user can choose the item it shows.
  3. Saving stores `itemId` on the attachment; uploads follow the offline queue.
- **Business rules:** Photos attach to the inspection like any entry, up to 5, through Drive; each photo can be tagged with the item it shows; `itemId` is used for inspection item tags only (§23.7 *Photos*, OQ-41, OQ-60). Linking Google is required (FR-LINK-03).
- **Edge cases:** An untagged photo. Several photos for one item. Editing tags after saving. Decision applied: CD-06.
- **Android/web differences:** Android has the camera and offline queue; web is online only (OQ-20).
- **Offline behavior:** The entry saves and photos wait in the queue.
- **Security implications:** Same as `DRV-11`.
- **Data/schema impact:** Sets `attachments[].itemId` to a snapshot item id.
- **Acceptance criteria:**
  1. A photo can be added to an inspection, with a maximum of 5 [§23.7 *Photos*].
  2. A photo can be tagged with an item, and `itemId` equals that item's snapshot id [OQ-41, OQ-60].
  3. `itemId` is never set on a non-inspection entry [OQ-41].
- **Decisions applied:** ED-07 ◐, ED-14 ◐, CD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [ED-07 ◐] Attachment statuses are `queued`, `uploading`, `uploaded`, `failed` and `missing` with the stated transitions; a photo is stored as JPEG at quality 80 with a 1600 px long edge, orientation applied and metadata stripped; the Drive name follows `<date>_<type>_<id>.<ext>`; a PDF over 5 MB is refused.
  2. **D2** [ED-14 ◐] On web, attachments are chosen through a file picker that accepts images and PDF, an entry is saved only after its upload finishes, and there is no automatic backup.
  3. **D3** [CD-06 ◐] A photo can stay untagged or carry one tag chosen from the inspection's items; tags can be changed while editing; tagged photos show under their item and untagged ones in a 'Photos' row.
- **Test requirements:** RNTL with the attachment fakes; emulator save test.
- **Dependencies:** CHK-06, DRV-11, DRV-12.
- **PRD requirement IDs:** PR-16, PR-14, FR-LINK-03, OQ-20, OQ-41, OQ-60; §23.7 *Photos*.
- **SRS reference:** Running an inspection L554–558; OQ-41 L666; OQ-60 L701.

### CHK-08 — Summary and failed-item shortcuts
- **Epic:** C3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a driver who found a problem, I want a summary of the failed items with one-tap ways to remind myself or log a service, so that a failure leads to action.
- **Business value:** Turns an inspection into follow-up without any automatic changes the user did not choose.
- **Scope:** *In:* a summary screen listing the failed items, each with **Create reminder** (title pre-filled) and **Log service** shortcuts; both open the existing forms pre-filled; nothing is created automatically. *Out:* the reminder and service forms themselves (`REM-05`, `LOG-08`).
- **Preconditions:** CHK-06, `REM-05`, `LOG-08`.
- **Functional behavior:**
  1. After an inspection is saved, the summary lists the failed items.
  2. **Create reminder** opens the reminder form with the title pre-filled.
  3. **Log service** opens the service form.
  4. Closing a form creates nothing.
- **Business rules:** The summary screen lists failed items, each with "Create reminder" (title pre-filled) and "Log service" shortcuts; nothing is created automatically (§23.7 *Failed items*).
- **Edge cases:** No failed items (the summary has none to list). The user leaves without choosing. A reminder needs at least one trigger, so the form cannot save as pre-filled alone (Reminders RD-09). Decision applied: CD-07.
- **Android/web differences:** None.
- **Offline behavior:** The forms save offline on Android.
- **Security implications:** None.
- **Data/schema impact:** None until the user saves a reminder or service.
- **Acceptance criteria:**
  1. The summary lists exactly the items marked Fail [§23.7 *Failed items*].
  2. **Create reminder** opens the reminder form with its title pre-filled [§23.7].
  3. **Log service** opens the service form [§23.7].
  4. Leaving the summary or a form creates no reminder and no service [§23.7].
- **Decisions applied:** RD-09 ◐, CD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [RD-09 ◐] A title over 60 characters, a 51st reminder, repeat months outside 1 to 120, repeat distance outside 1 to 999,999, lead days outside 0 to 365 or lead distance outside 0 to 99,999 is rejected; a past due date is accepted; a due odometer below the current reading is accepted with a warning; an amount is accepted on any reminder.
  2. **D2** [CD-07 ◐] After saving an inspection with failed items the summary shows; Create reminder pre-fills '<item label> — <vehicle name>' with subject kind `custom`; Log service pre-fills the notes '<item label> failed in inspection' with no service type chosen; the shortcuts are also available from the saved inspection.
- **Test requirements:** RNTL with form-navigation fakes.
- **Dependencies:** CHK-06, REM-05, LOG-08.
- **PRD requirement IDs:** PR-16, PR-11, PR-10; §23.7 *Failed items*.
- **SRS reference:** Saving L560–564; OQ-60 L701.

### CHK-09 — Inspections in History
- **Epic:** C3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want inspections to appear in History with an issue badge and to open one to see what was recorded, so that I can look back at a vehicle's condition.
- **Business value:** An inspection is only useful if it can be found and read later.
- **Scope:** *In:* inspection rows in History with a badge such as "2 issues"; opening an inspection to see its snapshot (items, results, notes, tagged photos); the type filter including Inspection; delete with Undo; read-only for other members' inspections. *Out:* search over item notes (excluded).
- **Preconditions:** CHK-06, `LOG-11`, `LOG-13`, `LOG-14`.
- **Functional behavior:**
  1. The History list shows each inspection with its template name, date and an issue badge.
  2. Opening it shows the snapshot as saved, including photos tagged to items.
  3. Delete follows the Undo behavior of other entries; Drive files are removed after the window.
- **Business rules:** An inspection is an entry in History, shows a badge such as "2 issues" (§23.7 *Saving*). History search does not cover item notes (OQ-60). Other members' entries are read-only (OQ-45). Inspections have no amount (OQ-31).
- **Edge cases:** An inspection with no issues. A template since renamed or deleted. Editing a saved inspection. Decision applied: CD-05, CD-09; Logging LD-11 (filter controls), LD-12 (delete edges), LD-13 (who may edit).
- **Android/web differences:** None.
- **Offline behavior:** From the cache.
- **Security implications:** Members only.
- **Data/schema impact:** None unless editing is allowed (CD-05).
- **Acceptance criteria:**
  1. An inspection appears in History with a badge showing its issue count, such as "2 issues" [§23.7 *Saving*].
  2. Opening it shows the saved snapshot even if the template was later edited or deleted [§23.7].
  3. Filtering by type can show only inspections [§23.2 *History*].
  4. Searching text does not match item notes [OQ-60].
  5. Deleting an inspection follows the Undo window [OQ-45].
- **Decisions applied:** LD-11 ◐, LD-12 ◐, LD-13 ◐, CD-05 ◐, CD-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [LD-11 ◐] The type filter accepts several types at once; the date range narrows by inclusive start and end dates; filters reset on relaunch; search matches notes, category, line-item types, station, platform, from and to, case-insensitively, and does not match amounts.
  2. **D2** [LD-12 ◐] Backgrounding the app during the 5-second window commits the delete; two quick deletes each get their own window with Undo for the latest; `lastOdometer` is recomputed when the delete commits; Delete is available on the edit screen and as a row swipe.
  3. **D3** [LD-13 ◐] An owner can edit and delete another member's entry, a member sees another member's entry read-only, and an entry's type cannot change on edit while its date can.
  4. **D4** [CD-05 ◐] The creator or owner can edit results, notes, odometer, date and photos of a saved inspection; the item list cannot change; `issueCount` and the badge update on save.
  5. **D5** [CD-09 ◐] History badges read '2 issues', '1 issue' and 'No issues'; an inspection row shows template name, date, badge and the odometer if present; search matches the template name and the entry's notes but not item notes.
- **Test requirements:** RNTL with seeded inspections.
- **Dependencies:** CHK-06, LOG-11, LOG-13, LOG-14.
- **PRD requirement IDs:** PR-16, PR-10, OQ-31, OQ-45, OQ-60; §23.7 *Saving*.
- **SRS reference:** Saving L560–564; History L357–363; OQ-60 L701; OQ-45 L670.

---

# C4 — Verification

### CHK-10 — Checklists verification
- **Epic:** C4 · **Type:** Verification · **Size:** M · **Readiness:** Ready once CHK-02 to CHK-09 are built
- **User story:** As the maintainer, I want the checklist behaviors proven across the whole app, so that snapshots stay immutable and templates survive merge, backup and vehicle deletion correctly.
- **Business value:** The sub-project touches rules, merge, backup and deletion; those seams must be proven, not assumed.
- **Scope:** *In:* tests and a manual run: snapshot immutability after template edit and delete; the 50-item and 20-template limits and the blocked copy; rules for templates (members create and update, creator or owner deletes, a 51st item denied) with two accounts; an inspection run offline; photos tagged to items from Drive; templates included in account merge, in backup and restore, and removed when the vehicle is deleted; the failed-item shortcuts; History badge. *Out:* the Play closed test.
- **Preconditions:** CHK-02 to CHK-09.
- **Functional behavior:** Runnable by someone other than the author.
- **Business rules:** Account merge copies checklist templates and vehicle delete removes them (§23.7 *Related*, FR-MERGE-02, FR-VEH-07); backups include checklist templates (OQ-53).
- **Edge cases:** Concurrent creation pushing a vehicle past 20 (the accepted app-only limit, L17).
- **Android/web differences:** Android offline run; web smoke test.
- **Offline behavior:** The airplane-mode inspection run is the native proof.
- **Security implications:** Test accounts only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. An inspection saved before a template is edited or deleted is unchanged afterwards [§23.7 *Saving*].
  2. A 51st item and a 21st template are refused, and a copy to a full vehicle is blocked [OQ-59].
  3. A member who is neither the creator nor the owner cannot delete a template [§23.7 *Permissions*].
  4. Templates survive an account merge and a backup and restore round trip, and are removed with the vehicle [FR-MERGE-02, OQ-53, FR-VEH-07].
  5. An inspection with photos tagged to items round-trips to Drive and back [OQ-41].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** CHK-02 to CHK-09.
- **PRD requirement IDs:** PR-16, TS-01, TS-07, FR-MERGE-02, FR-SER-02, FR-VEH-07, OQ-41, OQ-53, OQ-59, L17.
- **SRS reference:** Testing L309–322; Related L539–578; OQ-59 L700.

---

# A. Checklists epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **C1 Checklists foundation** | The pure checklist logic: starters, snapshot, issue count, limits | CHK-01 |
| **C2 Templates** | The Checklists screen, starter templates, create, edit and delete, copy to another vehicle | CHK-02 to CHK-05 |
| **C3 Inspections** | Running an inspection, photos tagged to items, the failed-item summary, inspections in History | CHK-06 to CHK-09 |
| **C4 Verification** | Snapshot immutability and the merge, backup and delete seams | CHK-10 |

**Architectural versus user-facing.** Architecture: CHK-01. User-facing: CHK-02 to CHK-09. Verification: CHK-10.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`CD-nn`, or an earlier `DR-nn`, `LD-nn`, `RD-nn`, `ED-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | CHK-01 ◆ | Domain: checklist logic | M | FND-DAT-02 |
| W2 | CHK-02 ◆ | Checklists screen | M | CHK-01, FND-SHL-02, FND-SHL-04 |
| W2 | CHK-04 ◆ | Create, edit and delete a template | L | CHK-01, FND-DAT-07, FND-SEC-02 |
| W3 | CHK-03 ◆ | Starter templates | M | CHK-01, CHK-02, CHK-04 |
| W3 | CHK-05 ◆ | Copy a template to another vehicle | M | CHK-02, CHK-04 |
| W3 | CHK-06 ◆ | Run an inspection | L | CHK-01, CHK-04, LOG-04 |
| W4 | CHK-07 ◆ | Inspection photos tagged to items | M | CHK-06, DRV-11, DRV-12 |
| W4 | CHK-08 ◆ | Summary and failed-item shortcuts | M | CHK-06, REM-05, LOG-08 |
| W4 | CHK-09 ◆ | Inspections in History | M | CHK-06, LOG-11, LOG-13, LOG-14 |
| W5 | CHK-10 | Checklists verification | M | CHK-02 to CHK-09 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Screen and editor | CHK-02 ∥ CHK-04 | The list screen and the editor are separate screens on the same repository |
| Starters, copy, run | CHK-03 ∥ CHK-05 ∥ CHK-06 | Starters and copy act on templates; running acts on entries |
| Photos, summary, History | CHK-07 ∥ CHK-08 ∥ CHK-09 | Each extends the saved inspection in a different place |

**Not parallel:** CHK-01 first. CHK-03 waits on CHK-02 and CHK-04. CHK-06 waits on CHK-04. CHK-10 is last.

**Early starts.** CHK-06's item-answer screen can be built against a fixture template while CHK-04 is finished.

---

# D. Blocking dependencies

**D1. Earlier sub-projects must be accepted first.** The PRD lists Foundation and Logging (entries). Needed specifically: `FND-DAT-02`, `FND-DAT-07`, `FND-SEC-02`, `FND-SHL-02`, `FND-SHL-04`; from Logging `LOG-04`, `LOG-08`, `LOG-11`, `LOG-13`, `LOG-14`; from Reminders `REM-05`; from Drive and export `DRV-11`, `DRV-12` for the photos. The photo story (CHK-07) and the History edit and delete behavior are the parts that wait on later sub-projects.

**D2. Decisions that block the data shape.** CD-03 (whether snapshot item ids come from the template item ids) and CD-05 (whether a saved inspection can be edited) fix what the stored inspection looks like and how `attachments[].itemId` is used. The model is meant to avoid migrations, so settle CD-03 before CHK-06 ships.

**D3. Limits are app-only.** The 20-templates-per-vehicle limit cannot be enforced by rules (OQ-59, L17), so concurrent creation by two members can exceed it; CD-08 asks how the app behaves.

**D4. Upstream decisions that carry in.** Foundation DR-06 (text-length caps) fixes template and note limits; DR-13 (archived vehicles) fixes whether templates and inspections can change there; Logging LD-04 and LD-05 (entry date and odometer check) apply to an inspection's date and odometer; LD-13 decides who may edit an inspection; Reminders RD-09 decides how a pre-filled reminder form validates.

**D5. External.** None beyond Foundation's and the Drive sub-project's (a test Drive for the photo checks).

**D6. Later tabs.** Release (tab 8) adds the store listing and policies; nothing here should block it. Backup and merge already include templates through the serializer.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema** = needed before documents in the final shape are written · **Story** = before the named story is accepted · **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **CD-01** | **Template constraints.** Name length and whether names must be unique on a vehicle; label and group length; whether groups are free text or a fixed set and how they display; minimum number of items; ordering and reordering; duplicate labels. | Appendix E gives `name`, `items` of up to 50 `{ id, label, group? }`. OQ-60 says only "rules cap text lengths", with Foundation DR-06 leaving the values open. | CHK-01, CHK-02, CHK-04 | Schema |
| **CD-02** | **Starter content and offering.** Whether "documents (RC, insurance, PUC, licence)" is one item or four, and how items map to groups; whether starters are stored as English text or translated at creation; when starters are offered again (for example after every template is deleted); whether several can be picked at once. | §23.7 lists each starter's items as prose and says starters are "offered when the vehicle has none yet". OQ-60 fixes the offering by vehicle type and that any may be picked. | CHK-01, CHK-03 | Story |
| **CD-03** | **Item ids and concurrent edits.** Whether snapshot item ids are the template's item ids or new ids; how item ids are generated; what happens when two members edit one template at once; editing a template while someone runs an inspection from it. | OQ-60 says "snapshot items get stable ids" and Appendix E gives template items an `id`, without saying how they relate. | CHK-01, CHK-04, CHK-06 | Schema |
| **CD-04** | **Run rules.** Whether every item must be answered before saving and what an unanswered item is stored as; whether an answer can be cleared; whether an unfinished run can be saved or resumed; item order and grouping while answering; note length. | §23.7 *Running an inspection* says "tap Pass / Fail / N/A per item, with an optional note". | CHK-01, CHK-06 | Story |
| **CD-05** | **Editing a saved inspection.** Whether results, notes, odometer, date and photos can be edited after saving, and how `issueCount` and the badge then update; whether the item list can change; who may edit (Logging LD-13). | §23.7 says the snapshot never changes when the template does, and History lets users tap an entry to edit, without saying whether that covers an inspection's answers. | CHK-09 | Story |
| **CD-06** | **Photo tagging.** Whether a photo may be untagged; one tag per photo or several; the tagging interaction; whether tags can be changed after saving; where tagged photos show (at the item or at the inspection). | §23.7 *Photos* says "each photo can be tagged with the item it shows" and Appendix E names `itemId`. | CHK-07 | Story |
| **CD-07** | **Failed-item shortcuts.** When the summary appears (after saving or inside the flow); the pre-filled reminder title (the item label alone, or with the template or vehicle name); the reminder's subject kind; what Log service pre-fills; whether the shortcuts remain available later from the saved inspection or only on the summary. | §23.7 *Failed items* names the two shortcuts, "title pre-filled" and "nothing is created automatically". | CHK-08 | Story |
| **CD-08** | **Copy and limit details.** The copy's name when one with that name exists; whether the copy keeps item ids; who becomes the creator of the copy; the message when the destination is full; whether starters count toward the 20; how the app behaves when concurrent creation pushes a vehicle past 20. | OQ-59 and OQ-60 fix the blocked copy to a full vehicle and the list of vehicles; L17 accepts that rules cannot count. | CHK-01, CHK-03, CHK-05 | Story |
| **CD-09** | **History wording and search.** The badge for 0 and for 1 issue and whether an all-clear badge shows; what an inspection row shows besides template name, date and badge; whether search covers the template name and the entry's `notes`; plural forms. | §23.7 gives the example badge "2 issues". OQ-60 excludes item notes from search. | CHK-09 | Copy / Story |

**Decisions from earlier sub-projects that carry in:** Foundation DR-03 stored encodings · DR-06 text-length caps · DR-13 archived-vehicle actions · DR-16 copy gaps · DR-23 `templateRepo` operations (answered in practice by CHK-04) · Logging LD-04 entry date · LD-05 odometer check · LD-11 filter controls · LD-12 delete edges · LD-13 edit authority · Reminders RD-09 reminder form rules · Drive ED-07 attachment details · ED-08 upload queue · ED-14 web attachments.

**Can start before any decision is answered:** CHK-01's starters-by-type and issue count, CHK-02's list, CHK-04's stated rules (50 items, who deletes), CHK-06's Pass, Fail and N/A answering, and CHK-08's failed-item list.

---

# F. Checklists Definition of Done

The PRD defines no acceptance criteria for sub-project 7, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.7)**
- [ ] A member can create, edit and view a vehicle's checklist templates: a name and up to 50 items, each a short label with an optional group; up to 20 templates per vehicle, enforced by the app.
- [ ] A vehicle with no templates is offered the starters by vehicle type (car, truck, bus, other: Car pre-trip and Long trip; bike, scooter: Two-wheeler and Long trip), and any starter can be picked.
- [ ] Only a template's creator or the vehicle's owner can delete it; any member can run inspections and create or edit templates.
- [ ] "Copy to another vehicle" lists every non-archived vehicle the user belongs to and is blocked when the destination has 20 templates.
- [ ] Running an inspection: pick a template, mark Pass, Fail or N/A per item with an optional note, optional odometer; the saved entry holds a snapshot with stable item ids and `issueCount`, with no `amount` and no `category`.
- [ ] Up to 5 photos can be attached through Drive, each taggable to an item through `itemId`.
- [ ] The summary lists failed items with Create reminder and Log service shortcuts; nothing is created automatically.
- [ ] Inspections appear in History with a badge such as "2 issues"; editing or deleting a template never changes a past inspection.

**Behavior**
- [ ] Everything works offline on Android with the sync icon, except photo upload which waits in the Drive queue.
- [ ] Inspection item notes are not searched in History.

**Evidence**
- [ ] Domain tests written first pass, including snapshot immutability.
- [ ] CHK-10 is run and recorded: limits, permissions with two accounts, merge, backup and restore, vehicle delete, photos tagged to items.
- [ ] The Foundation rules suite still passes for `checklistTemplates`.

**Scope and quality**
- [ ] No out-of-scope feature exists: no checklist reports, no scheduled inspections, no number or text item types.
- [ ] The Add sheet's Inspection item and More → Checklists are real screens; no "Coming soon" remains for them.
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `CD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 7; the last column cites the story's own criteria (`#n`) plus the applicable Foundation `AC-D` or test requirement.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| CHK-01 | PR-16, FR-DATA-12, FR-SEC-13, OQ-59, OQ-60, TS-03 | Templates L545–552; Saving L560–564; L778–780; L753–755; OQ-60 L701 | #1–#4 |
| CHK-02 | PR-16, FR-NAV-05, OQ-39, OQ-59; AC-D16 | Where templates live L541–543; Templates L545–552; Navigation L259 | #1–#4; AC-D16 |
| CHK-03 | PR-16, FR-I18N-03, OQ-59, OQ-60; §23.7 Starter templates | Templates L545–552; OQ-60 L701 | #1–#4 |
| CHK-04 | PR-16, FR-SEC-09, FR-SEC-13, OQ-59, OQ-60; §23.7 Items, Permissions | Templates L545–552; Permissions L566–568; Rules L195; OQ-59 L700 | #1–#4 |
| CHK-05 | PR-16, OQ-59, OQ-60; §23.7 Copy | Copy L570–572; OQ-59 L700; OQ-60 L701 | #1–#3 |
| CHK-06 | PR-16, PR-03, FR-NAV-04, OQ-31, OQ-60; AC-D15 | Running an inspection L554–558; Saving L560–564; L753–755 | #1–#5; AC-D15 |
| CHK-07 | PR-16, PR-14, FR-LINK-03, OQ-20, OQ-41, OQ-60; §23.7 Photos | Running L554–558; OQ-41 L666; OQ-60 L701 | #1–#3 |
| CHK-08 | PR-16, PR-11, PR-10; §23.7 Failed items | Saving L560–564; OQ-60 L701 | #1–#4 |
| CHK-09 | PR-16, PR-10, OQ-31, OQ-45, OQ-60; §23.7 Saving | Saving L560–564; History L357–363; OQ-60 L701; OQ-45 L670 | #1–#5 |
| CHK-10 | PR-16, TS-01, TS-07, FR-MERGE-02, FR-SER-02, FR-VEH-07, OQ-41, OQ-53, OQ-59, L17 | Testing L309–322; L539–578; OQ-59 L700 | #1–#5 |

**G2. §23.7 scope item → covering stories** (proves each item is covered).

| §23.7 scope item | Stories |
| --- | --- |
| Per-vehicle templates (name and up to 50 items with optional groups; 20 per vehicle) | CHK-01, CHK-02, CHK-04 |
| Starter templates by vehicle type; any may be picked | CHK-01, CHK-03 |
| Permissions: any member creates, edits and runs; creator or owner deletes | CHK-04, CHK-10 |
| Copy to another vehicle (non-archived, blocked when full) | CHK-05 |
| Running an inspection: Pass, Fail, N/A, notes, optional odometer | CHK-06 |
| Snapshot with stable ids and `issueCount`; no amount or category | CHK-01, CHK-06 |
| Photos (up to 5, through Drive) tagged to items | CHK-07 |
| Failed-item summary with Create reminder and Log service shortcuts | CHK-08 |
| Inspection in History with a badge; template changes never alter past inspections | CHK-09 |
| Search does not cover item notes | CHK-09 |
| Navigation: Add sheet "Inspection" and More → "Checklists" | CHK-02, CHK-06 |
| Account merge copies templates; vehicle delete removes them | CHK-10 |
