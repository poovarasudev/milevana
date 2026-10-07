# Milevana v1 — Sub-project 6: Sharing — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 16 in 5 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**Same thin specification as sub-projects 2 to 5.** PRD §23.6 records "what the source already fixes", the tab 6 decisions, OQ-55, OQ-56, OQ-58, and the approved invite shape (Appendix E). It says "Acceptance criteria: defined in tab 6".
- **There are no PRD acceptance criteria and no `FR-` IDs for sub-project 6** (PRD §25.4). The criteria below are **derived from stated behavior** and cite the row they restate. They are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-15`, `PRV-09`, `PRV-14`, `PRV-15`, `FR-SEC-09`, `FR-SEC-12`, `FR-NAV-05`, `FR-LINK-03`, `TS-02`, `OQ-15`, `OQ-22`, `OQ-25`, `OQ-34`, `OQ-35`, `OQ-39`, `OQ-51`, `OQ-55` to `OQ-58`, limitations `L5`, `L6`, `L14`, `L15`, deferred decision `DD-06`, and Foundation `AC-D*` items. Where the PRD gives only a row in §23.6, the row name is cited, for example "§23.6 *Invite rules*".

**Labels.** `SHR-nn` story IDs and `SD-nn` decision labels are tracking labels, not requirement IDs. Earlier decisions are `DR-nn` (Foundation), `LD-nn` (Logging), `RD-nn` (Reminders), `PD-nn` (Reports) and `ED-nn` (Drive and export).

**Priority.** The source assigns none. Stories carry a dependency **wave** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL > 2 weeks.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `SD-nn`, plus the earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope

**In scope (PRD §23.6):** invite codes and links, owner and member roles, joining, leaving, removing a member, ownership transfer, receipt sharing on Drive, and the rules for all of these.

**What earlier sub-projects provide** (assumed accepted): the membership model (`memberIds` and the `members` map) and the vehicle and entry rules with invites, self-join, leave and transfer shipped default-deny and tested as denied (`FND-SEC-01` to `FND-SEC-03`); `inviteRepo` as a schema and skeleton (`FND-DAT-07`); linking Google and the conflict and merge flow (`FND-AUTH-03` to `FND-AUTH-07`); the "require a linked account" gate (`FND-AUTH-04`); "Join a vehicle" shown as "Coming soon" (`FND-SHL-02`); the access-denied and rejected-write behaviors (`FND-OBS-03`, `FND-OBS-04`); the Drive client, receipt upload and `uploaderUids` (`DRV-03`, `DRV-05`, `DRV-12`); entry "Logged by" labels (`LOG-11`); notifications to all members (`REM-03`).

**Out of scope:** account deletion and the ownership hand-over it relies on beyond the transfer feature itself (tab 8); the privacy policy text that discloses member data and delayed access revocation (tab 8, though the removal confirmation is here); the web landing page, `/privacy`, `/terms` and `/delete-account` (tab 8); checklist templates shared by members beyond the existing rules (tab 7); server push (none by design).

**Scope notes (not product decisions):**
1. This sub-project **changes the Foundation rules**. It replaces the default-deny stance for invites, self-join, leave, remove and transfer with the real rules, and adds adversarial tests for each (TS-02). The Foundation "denied" tests become conditional tests.
2. The PRD says Hosting at `milevana.poovarasu.dev` with `/join/:code` and the Android App Links file is set up at the start of this sub-project (OQ-57).
3. Whether members can view each other's receipts inside the app depends on a Drive spike (DD-06, L6); the stated fallback is an "Open in Drive" button. `SHR-01` settles this and `SHR-15` implements whichever result holds.
4. Anything about a second user is verified with two or more test Google accounts and two devices or an emulator and a browser.

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| S1 | Sharing foundations | SHR-01 to SHR-06 |
| S2 | Inviting and joining | SHR-07 to SHR-09 |
| S3 | Membership | SHR-10 to SHR-13 |
| S4 | Receipt sharing | SHR-14, SHR-15 |
| S5 | Verification | SHR-16 |

---

# S1 — Sharing foundations

### SHR-01 — Spike: members' access to each other's receipts under `drive.file`
- **Epic:** S1 · **Type:** Spike · **Size:** S · **Readiness:** Ready; verifies a PRD open item (DD-06, L6)
- **User story:** As the maintainer, I want to know exactly what a member's app can do with a receipt another member uploaded, so that I build the right viewing experience and do not promise something Drive will not allow.
- **Business value:** The PRD says in-app viewing "depends on the `drive.file` spike" and names "Open in Drive" as the fallback. Auto-sharing grants Drive access but "in-app viewing is not guaranteed by it" (§23.6).
- **Scope:** *In:* with two test accounts, check: (1) that the uploader's app can add and remove read permissions on files it created; (2) whether Drive sends notification emails when permission is added; (3) whether the second user's app can list, open or download the shared file under `drive.file`; (4) whether an Open in Drive link works for the second user; (5) what Drive returns when a permission is removed. *Out:* building share sync (SHR-14).
- **Preconditions:** `DRV-01` and `DRV-03`; two test Google accounts.
- **Functional behavior:** A written result stating which of the above work, and recommending in-app viewing or the fallback.
- **Business rules:** Receipts are shared through Drive permissions (PRV-09). The app only sees files it created under `drive.file`.
- **Edge cases:** A member with a Google account that has no Drive; a member whose email in `members` differs from their Drive identity.
- **Android/web differences:** Both clients are tried (links from `DRV-01`).
- **Offline behavior:** N/A.
- **Security implications:** Confirms permissions are granted only to named members and are revocable.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The result states whether the uploader's app can grant and revoke read access on its own files [PRV-09].
  2. The result states whether a member's app can open another member's receipt in-app, or that only "Open in Drive" works [DD-06, L6].
  3. The result states whether Drive emails the member on sharing [OQ-56].
- **Test requirements:** Manual run with two test accounts.
- **Dependencies:** DRV-01, DRV-03.
- **PRD requirement IDs:** PRV-09, DD-06, L6, OQ-56, RK-17.
- **SRS reference:** Photo sharing mechanics L522–526; Limitations L830; OQ-56 L695.

### SHR-02 — Hosting, domain and Android App Links
- **Epic:** S1 · **Type:** Architecture (setup) · **Size:** L · **Readiness:** Ready once the external inputs below exist
- **User story:** As the maintainer, I want the web app live at `milevana.poovarasu.dev` with a `/join/:code` route and a verified Android App Links file, so that an invite link opens the app, or a web page if the app is not installed.
- **Business value:** Without a live, verified domain an invite link cannot open the app. The PRD places this at the start of sub-project 6 (OQ-57).
- **Scope:** *In:* point `milevana.poovarasu.dev` at Firebase Hosting and verify it; deploy the Expo web build; serve `/join/:code`; publish the Android App Links verification file; add the domain to Firebase Authentication's authorized domains and the Google OAuth web client origins. *Out:* `/privacy`, `/terms`, `/delete-account` and the landing page (tab 8).
- **Preconditions:** `FND-PLT-02`; control of the `poovarasu.dev` DNS; the release signing certificate fingerprint `[External — verify]`.
- **Functional behavior:**
  1. The domain serves the web app over HTTPS from Firebase Hosting.
  2. `/join/<code>` loads the web app's join route.
  3. The App Links file lets Android open `/join/*` links in the installed app.
  4. The fallback address `milevana.web.app` also works.
- **Business rules:** Hosting at `milevana.poovarasu.dev`; Android App Links must be verified on the Hosting domain; otherwise the link opens a web join page (§23.6 *Invite link*, OQ-57). Rules and indexes deploy on tagged releases and Hosting deploys from CI (OQ-38).
- **Edge cases:** The signing fingerprint differs between a development build and the Play-signed build (both must be accounted for). DNS propagation delay. A browser that does not honor App Links.
- **Android/web differences:** Android opens the app for a verified link; web opens the page.
- **Offline behavior:** N/A.
- **Security implications:** HTTPS only; the verification file lists only the app's package and fingerprint.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. `https://milevana.poovarasu.dev` serves the web app [OQ-57].
  2. `https://milevana.poovarasu.dev/join/ABCD1234` loads the join route [OQ-57].
  3. The App Links file is served and Android reports the link as verified for `dev.poovarasu.milevana` [§23.6 *Invite link*].
  4. The domain is authorized for sign-in on web [§14.8].
- **Test requirements:** Manual verification on a device and in a browser; CI deploy of Hosting.
- **Dependencies:** FND-PLT-02, FND-PLT-03.
- **PRD requirement IDs:** PR-15, OQ-38, OQ-57; §14.8, §24.4 DNS and App Links items.
- **SRS reference:** Invite link L503; Release hosting L617; OQ-57 L708; OQ-38 L659.

### SHR-03 — Spike: quota budget for sharing
- **Epic:** S1 · **Type:** Spike · **Size:** S · **Readiness:** Ready: decisions applied; the pass threshold is 50% of the daily quota at 500 daily active users (DR-20).
- **User story:** As the maintainer, I want the cost of the app-open share check and of invites counted, so that sharing does not exhaust the free quota.
- **Business value:** On every app open the phone checks the receipts the user uploaded to shared vehicles, which reads entries (the PRD flags this in OQ-18). There is no Blaze fallback.
- **Scope:** *In:* counts of reads and writes for: the app-open share check across several shared vehicles with many receipts; creating, reading and cancelling invites; joining (the two-document write and its rules reads); membership changes; projection at 100 to 500 daily active users, cache-first; a recommendation to bound the share check. *Out:* Drive API quotas (outside Firestore's free-plan limits).
- **Preconditions:** `FND-VER-01` method and DR-20; results of `LOG-01`, `RPT-01`, `DRV-02`.
- **Functional behavior:** A written budget with per-operation counts and the daily projection.
- **Business rules:** NFR-06, NFR-20, OQ-18, OQ-35: rules for joining must read only a few distinct documents (a write reading 11 distinct documents is denied in the emulator spike).
- **Edge cases:** A user in 10 shared vehicles. The share check on every foreground return as well as every app open (OQ-56).
- **Android/web differences:** The share check is an Android phone behavior unless SD-11 says otherwise.
- **Offline behavior:** Counts assume cache reads.
- **Security implications:** None.
- **Data/schema impact:** May recommend an index or a bounded query for `uploaderUids`.
- **Acceptance criteria:**
  1. A document lists reads and writes per operation named above [NFR-06].
  2. The projection at 100 and 500 users is compared with the threshold and recorded pass or fail [OQ-18].
  3. SHR-14 is not accepted before this passes.
- **Decisions applied:** DR-20 ✔, SD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-20 ✔] The quota budget passes only if projected daily usage at 500 daily active users is at most 25,000 reads and 10,000 writes.
  2. **D2** [SD-11 ◐] The web join page signs the visitor in first, then shows the vehicle and owner names and a Join button; after joining it opens the vehicle in the web app with a 'Get the Android app' link; web offers copy-link and the browser share sheet for invites and does not run receipt share sync.
- **Test requirements:** Measured from the emulator with request logging.
- **Dependencies:** FND-VER-01, LOG-01, RPT-01, DRV-02.
- **PRD requirement IDs:** NFR-06, NFR-19, NFR-20, RK-25, OQ-18, OQ-35, OQ-56.
- **SRS reference:** OQ-18 L642; OQ-35 L656; OQ-56 L695.

### SHR-04 — Rules: invites and self-join
- **Epic:** S1 · **Type:** Architecture · **Size:** XL · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want the invite and join rules written and attacked in tests, so that no one can join a vehicle without a valid invite and no invite can be forged or reused.
- **Business value:** With no server, rules are the only enforcement of "valid, unused invite" (RK-03, RK-18). A flaw lets strangers into someone's vehicle data.
- **Scope:** *In:* `invites/{code}` rules: the owner of the vehicle creates an invite with the Appendix E fields (`vehicleId`, `vehicleName`, `ownerId`, `ownerName`, `createdBy`, `createdAt`, `expiresAt` 7 days after creation); an existing code cannot be overwritten; reads per SD-01; the owner cancels (deletes); the join write. Vehicle self-join: a user may add themselves only if a valid, unused invite for that vehicle exists and the same write marks the invite used; at most 10 members including the owner; the new member record has the member role. Adversarial tests for each path. *Out:* leave, remove, transfer (SHR-05).
- **Preconditions:** `FND-SEC-01` to `FND-SEC-03`; SD-01 to SD-03.
- **Functional behavior:**
  1. An owner can create an invite for their own vehicle only.
  2. A signed-in user can join only with a valid invite: unused, not expired, for that vehicle, with fewer than 10 members.
  3. The join changes exactly the member list and marks the invite used in one write.
  4. A used, expired, cancelled or mismatched invite never lets anyone in.
- **Business rules:** Invite: single-use, expires in 7 days, the owner can see and cancel pending invites (§23.6 *Invite rules*). Valid means unused, not expired, and the vehicle has fewer than 10 members (Appendix E). The 10-member limit includes the owner and is enforced in rules (OQ-55). Membership invariants stay: owner in `memberIds`, `members` keys match `memberIds` (OQ-34, FR-SEC-12).
- **Edge cases:** Replay of a used code. Joining as another uid. Changing other vehicle fields in the same write. The 11th member. An invite for a deleted or archived vehicle. Two users joining with one code at the same time (only one can succeed). An anonymous user joining (SD-03). Rules read cost: the join must read only a few distinct documents (OQ-35).
- **Android/web differences:** None.
- **Offline behavior:** A queued join is judged by the server on reconnect; see SD-03 for the user-facing behavior.
- **Security implications:** This story is the security boundary for membership. Codes are capability tokens, and rate limiting is not possible without a server (accepted limitation, OQ-33).
- **Data/schema impact:** Rules for `invites/{code}`; join write on `vehicles/{id}`.
- **Acceptance criteria:**
  1. An invite for a vehicle the caller does not own is denied; the owner's is allowed [§23.6 *Invite rules*].
  2. A join with a valid unused invite that also marks it used is allowed; the same join with the invite not marked used is denied [§23.6 *Joining*].
  3. A used, expired or other-vehicle invite is denied [Appendix E].
  4. The 11th member is denied; the 10th is allowed [OQ-55, FR-SEC-12].
  5. A join that also changes any other vehicle field is denied [FR-SEC-04].
  6. Foundation's default-deny tests for `invites` and self-join are replaced by these conditional tests, and each path has its own adversarial tests [FR-SEC-09, TS-02].
- **Decisions applied:** SD-01 ◐, SD-02 ◐, SD-03 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-01 ◐] Any signed-in user, an anonymous one included, can read an invite by its exact code; listing invites is denied except the owner's query by `ownerId`.
  2. **D2** [SD-02 ◐] Codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed XXXX-XXXX; typing 'k7qx m2pa' or 'K7QX-M2PA' resolves the same invite; links carry the plain uppercase code; a collision regenerates the code up to 5 times.
  3. **D3** [SD-03 ◐] A join writes `members[uid]` with role `member`, the joiner's Google name and email, `joinedAt` and `inviteCode`, and sets `usedBy` and `usedAt` on the invite in one write; the rules deny a join by an anonymous user; an invite for an archived vehicle is invalid; a deleted vehicle shows 'This vehicle no longer exists'; Join is disabled offline.
- **Test requirements:** Emulator rules suite, allowed and denied per case, on every push (TS-01, TS-02); one recorded production run of the join write (as G3 did for batches).
- **Dependencies:** FND-SEC-01, FND-SEC-02, FND-SEC-03.
- **PRD requirement IDs:** PR-15, FR-SEC-09, FR-SEC-12, NFR-10, TS-01, TS-02, OQ-33, OQ-34, OQ-35, OQ-55.
- **SRS reference:** Rules L193–198; Invites L500–505; Joining L507–510; Invite shape L774–776; OQ-55 L694.

### SHR-05 — Rules: leave, remove, ownership transfer and receipt-sharing updates
- **Epic:** S1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want the leave, remove and transfer rules written and attacked in tests, so that membership changes only the way the roles allow.
- **Business value:** Prevents a member removing others, an owner being stranded, or ownership moving to a non-member.
- **Scope:** *In:* **leave:** a member removes only themselves from `memberIds` and `members`; **remove:** the owner removes another member; **transfer:** the owner sets `ownerId` to an existing member and the roles in `members` follow; `attachments[].sharedWithUids` updates reuse the creator-or-owner entry rule; adversarial tests. *Out:* invites and join (SHR-04).
- **Preconditions:** `FND-SEC-01` to `FND-SEC-03`; SD-06, SD-07; Foundation DR-12.
- **Functional behavior:**
  1. A member can leave; they cannot remove anyone else.
  2. The owner can remove any other member.
  3. The owner can transfer ownership to a member; `ownerId` can never point at a non-member.
  4. After any change the invariants hold: the owner is in `memberIds`, `members` keys match `memberIds`.
- **Business rules:** Members may change `ownerId`, `memberIds` or `members` only to leave (§23.6 and PRD §15.5); an owner must transfer ownership or delete the vehicle rather than leave (OQ-55); `ownerId` changes only to an existing member (OQ-34); entry updates for `sharedWithUids` use the existing creator-or-owner rule, and an uploader who is neither cannot update sharing (OQ-56, L15).
- **Edge cases:** A member removing themselves and adding someone in the same write. The last non-owner member leaving. An owner removing themselves. Transfer to the same user. Two concurrent membership changes. Decision applied: SD-06, SD-07.
- **Android/web differences:** None.
- **Offline behavior:** Queued membership writes are judged by the server on reconnect; a rejection is surfaced by the Foundation behavior (`FND-OBS-04`).
- **Security implications:** The boundary for who can remove whom; each path has its own adversarial tests.
- **Data/schema impact:** Rules only.
- **Acceptance criteria:**
  1. A member's leave write that removes only themselves is allowed; removing anyone else is denied [PRD §15.5].
  2. The owner's removal of another member is allowed; a non-owner's is denied [§23.6 *Owner role*].
  3. A transfer to an existing member is allowed; a transfer to a non-member is denied [OQ-34].
  4. The owner removing themselves is denied [OQ-55].
  5. Updating `sharedWithUids` is allowed to the entry's creator or the owner and denied to anyone else [§23.6 *Rules*, L15].
  6. Foundation's default-deny tests for leave and transfer are replaced by conditional tests and each path has adversarial tests [FR-SEC-09, TS-02].
- **Decisions applied:** DR-12 ✔, SD-06 ◐, SD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-12 ✔] In the Foundation rules any update, by the owner or anyone else, that changes `ownerId`, `memberIds` or `members` is denied; creating a vehicle with the owner as the only member is allowed.
  2. **D2** [SD-06 ◐] A member's write removing only their own uid is allowed; the owner removing another member is allowed; the owner removing themselves is denied; a transfer must set `ownerId` to an existing member and swap the roles in the same write, and a transfer to a non-member or without the role swap is denied.
  3. **D3** [SD-07 ◐] The leave, remove and transfer confirmations show the stated texts, the remove one including the delayed receipt-access statement; a re-invited member can edit entries whose `createdBy` is theirs; a leaver's reminders and templates stay on the vehicle.
- **Test requirements:** Emulator rules suite on every push (TS-01, TS-02); a recorded production run.
- **Dependencies:** FND-SEC-01, FND-SEC-02, FND-SEC-03.
- **PRD requirement IDs:** PR-15, FR-SEC-09, FR-SEC-12, TS-01, TS-02, OQ-34, OQ-55, OQ-56, L15.
- **SRS reference:** Rules L193–198; Roles L512–516; Rules L535–537; OQ-55 L694; OQ-56 L695.

### SHR-06 — Invite and membership repositories, and the invite code
- **Epic:** S1 · **Type:** Architecture · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want the invite, join, leave, remove and transfer operations behind repositories with a tested invite-code module, so that screens never touch Firestore and codes are generated and read consistently.
- **Business value:** One place for the membership writes that the rules judge, and one definition of the code format.
- **Scope:** *In:* `inviteRepo` (create with generation and collision retry, get by code, list a vehicle's pending invites, cancel, join); `vehicleRepo` additions (leave, remove, transfer); a pure `invites` module: generating an 8-character code from an unambiguous alphabet, displaying it like K7QX-M2PA, normalizing typed input, and computing "valid, used, expired, full" for the UI. *Out:* screens (SHR-07 onward).
- **Preconditions:** SHR-04, SHR-05, `FND-DAT-06`, `FND-DAT-07`.
- **Functional behavior:**
  1. `createInvite(vehicleId)` writes an invite with a new code and `expiresAt` 7 days later, retrying on a collision.
  2. `joinVehicle(code)` writes the member record and marks the invite used in one batch.
  3. `leave`, `remove` and `transfer` write the membership changes the rules allow.
  4. The code module formats and normalizes codes.
- **Business rules:** Codes are 8 characters from an unambiguous alphabet, displayed like K7QX-M2PA (OQ-55, §23.6 *Invite creation*). The invite carries the vehicle name and owner name for the join screen (OQ-55). Invites are single-use and expire in 7 days.
- **Edge cases:** Code collision. Typed code in lowercase or with the hyphen omitted. A cancelled invite. The vehicle renamed after the invite is created (the invite holds the old name). Decision applied: SD-02, SD-03, SD-05.
- **Android/web differences:** None.
- **Offline behavior:** Creating an invite and joining need the network to be useful; offline behavior is SD-03 and SD-05.
- **Security implications:** Code generation must use a secure random source; invite documents are capability tokens.
- **Data/schema impact:** Writes `invites` and the vehicle's membership fields.
- **Acceptance criteria:**
  1. A generated code is 8 characters from the agreed alphabet and displays in the K7QX-M2PA style [OQ-55].
  2. A typed code in any case, with or without the hyphen, resolves to the same invite [§23.6 *Invite link*].
  3. A join against the emulator rules succeeds once and fails the second time [§23.6 *Invite rules*].
  4. Leave, remove and transfer succeed for the allowed roles and fail otherwise [§23.6 *Roles*].
  5. Validity helper returns valid, used, expired or full correctly [Appendix E].
- **Decisions applied:** SD-02 ◐, SD-03 ◐, SD-05 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-02 ◐] Codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed XXXX-XXXX; typing 'k7qx m2pa' or 'K7QX-M2PA' resolves the same invite; links carry the plain uppercase code; a collision regenerates the code up to 5 times.
  2. **D2** [SD-03 ◐] A join writes `members[uid]` with role `member`, the joiner's Google name and email, `joinedAt` and `inviteCode`, and sets `usedBy` and `usedAt` on the invite in one write; the rules deny a join by an anonymous user; an invite for an archived vehicle is invalid; a deleted vehicle shows 'This vehicle no longer exists'; Join is disabled offline.
  3. **D3** [SD-05 ◐] The owner sees Invite on the vehicle's row in More → Vehicles; at most 5 invites can be pending; Invite is disabled at 10 members; expired invites show 'Expired' and can be deleted.
- **Test requirements:** Jest for the code module; Jest + Firestore emulator for the repositories (TS-04).
- **Dependencies:** SHR-04, SHR-05, FND-DAT-06, FND-DAT-07.
- **PRD requirement IDs:** PR-15, FR-DATA-02, TS-04, OQ-55; §23.6 *Invite creation*.
- **SRS reference:** Invites L500–505; Invite shape L774–776; OQ-55 L694.

---

# S2 — Inviting and joining

### SHR-07 — Invite a member
- **Epic:** S2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to invite someone with a short code or a link, so that my family can see and log entries for the same vehicle.
- **Business value:** Sharing is how families use one vehicle record (§3.1, PR-15).
- **Scope:** *In:* an **Invite** action for the owner: it creates an invite and shows its code (like K7QX-M2PA) and its link; sending it through the Android share sheet (for example WhatsApp); a list of the vehicle's pending invites with the expiry and a Cancel action. *Out:* joining (SHR-08), links opening the app (SHR-09).
- **Preconditions:** SHR-06, `FND-AUTH-04` (gate), SHR-02 for the link domain.
- **Functional behavior:**
  1. The owner taps Invite; if the account is anonymous the link flow comes first.
  2. The app creates an invite, shows the code and the link and offers to share them.
  3. Pending invites are listed with their expiry; the owner can cancel one, which deletes it.
- **Business rules:** Only the owner invites. Invites are single-use and expire in 7 days; the owner can see and cancel pending invites (§23.6 *Invite rules*). Linking Google is a required step before sharing (FR-LINK-03). A vehicle has at most 10 members including the owner (OQ-55).
- **Edge cases:** Inviting when the vehicle already has 10 members. Several pending invites. An expired invite still listed. Offline. Decision applied: SD-05: where Invite and the pending list live, any limit on pending invites, expired-invite display; SD-11: the web equivalent of the share sheet.
- **Android/web differences:** Android uses the system share sheet; the web way to send a link is SD-11.
- **Offline behavior:** Needs the network (the invite must exist on the server to be usable).
- **Security implications:** The code is a capability token; showing it only to the owner and sharing it by choice is the control.
- **Data/schema impact:** Creates and deletes `invites` documents.
- **Acceptance criteria:**
  1. An anonymous owner is routed through linking before an invite is created [FR-LINK-03].
  2. Tapping Invite creates an invite and shows a code in the K7QX-M2PA style and a link on `milevana.poovarasu.dev` [§23.6 *Invite creation*].
  3. The code and link can be sent through the share sheet [§23.6].
  4. The owner sees pending invites with their expiry and can cancel one [§23.6 *Invite rules*].
  5. A non-owner has no Invite action [§23.6 *Roles*].
- **Decisions applied:** SD-02 ◐, SD-05 ◐, SD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-02 ◐] Codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed XXXX-XXXX; typing 'k7qx m2pa' or 'K7QX-M2PA' resolves the same invite; links carry the plain uppercase code; a collision regenerates the code up to 5 times.
  2. **D2** [SD-05 ◐] The owner sees Invite on the vehicle's row in More → Vehicles; at most 5 invites can be pending; Invite is disabled at 10 members; expired invites show 'Expired' and can be deleted.
  3. **D3** [SD-11 ◐] The web join page signs the visitor in first, then shows the vehicle and owner names and a Join button; after joining it opens the vehicle in the web app with a 'Get the Android app' link; web offers copy-link and the browser share sheet for invites and does not run receipt share sync.
- **Test requirements:** RNTL with a share-sheet fake; emulator repository test.
- **Dependencies:** SHR-06, FND-AUTH-04; SHR-02 for the link.
- **PRD requirement IDs:** PR-15, FR-LINK-03, OQ-55; §23.6 *Invite creation*, *Invite rules*.
- **SRS reference:** Invites L500–505; Roles L512–516; OQ-55 L694.

### SHR-08 — Join a vehicle by code
- **Epic:** S2 · **Type:** User-facing · **Size:** L · **Readiness:** Ready: decisions applied (see below).
- **User story:** As someone invited to a vehicle, I want to type the code, see which vehicle and whose it is, and join, so that I can start logging.
- **Business value:** Completes the sharing loop; codes can be typed when no link works.
- **Scope:** *In:* More → Join a vehicle (replacing "Coming soon"): enter a code; a join screen showing the vehicle name and owner name from the invite; the join action; for an anonymous user, linking Google first including the conflict path; clear states for an invalid, expired, used or full invite and for already being a member; the vehicle then appears in the switcher. *Out:* link and web entry points (SHR-09).
- **Preconditions:** SHR-06, `FND-AUTH-03` to `FND-AUTH-07`, `FND-SHL-02`.
- **Functional behavior:**
  1. The user enters a code; the app finds the invite and shows the vehicle name and owner name.
  2. An anonymous user is walked through linking first.
  3. Joining writes the member record and marks the invite used; the vehicle appears.
  4. An invite that is invalid, expired, used or full shows a specific message.
- **Business rules:** Joining requires a Google-linked account, so anonymous users are walked through linking first (§23.6 *Joining*). The invite carries the vehicle name and owner name because a joiner cannot read the vehicle yet (OQ-55). No server: rules decide (§23.6).
- **Edge cases:** Typing errors. The owner opening their own code. A joiner whose Google account already has data (the merge path). Joining while offline. Race: two people using one code. Decision applied: SD-01, SD-03, SD-04.
- **Android/web differences:** The same screen on web at the Join route (SHR-09).
- **Offline behavior:** Joining needs the network; the offline behavior is SD-03.
- **Security implications:** Reading an invite by code reveals only the vehicle and owner names the owner chose to share.
- **Data/schema impact:** Updates the vehicle's member fields and the invite.
- **Acceptance criteria:**
  1. More → Join a vehicle opens the join entry instead of "Coming soon" [FR-NAV-05].
  2. A valid code shows the vehicle name and owner name [OQ-55].
  3. An anonymous user must link Google before joining [§23.6 *Joining*].
  4. After joining, the vehicle is in the switcher and its entries are visible [§23.6].
  5. An expired, used, invalid or full invite shows a distinct message and joins nothing [Appendix E].
- **Decisions applied:** SD-01 ◐, SD-03 ◐, SD-04 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-01 ◐] Any signed-in user, an anonymous one included, can read an invite by its exact code; listing invites is denied except the owner's query by `ownerId`.
  2. **D2** [SD-03 ◐] A join writes `members[uid]` with role `member`, the joiner's Google name and email, `joinedAt` and `inviteCode`, and sets `usedBy` and `usedAt` on the invite in one write; the rules deny a join by an anonymous user; an invite for an archived vehicle is invalid; a deleted vehicle shows 'This vehicle no longer exists'; Join is disabled offline.
  3. **D3** [SD-04 ◐] After a link conflict resolved with Move and switch or Switch without moving, the pending join completes with the Google uid and the invite is still valid.
- **Test requirements:** RNTL; emulator tests of the join; manual run with two accounts.
- **Dependencies:** SHR-06, FND-AUTH-03, FND-AUTH-05, FND-AUTH-06, FND-SHL-02.
- **PRD requirement IDs:** PR-15, FR-NAV-05, FR-LINK-03, OQ-25, OQ-55; §23.6 *Joining*.
- **SRS reference:** Joining L507–510; Navigation L259; OQ-55 L694; OQ-25 L648.

### SHR-09 — Invite links and the web join page
- **Epic:** S2 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As someone who receives an invite link, I want it to open the app on the join screen, or a web page if I do not have the app, so that joining takes one tap.
- **Business value:** Links are how invites are normally shared (WhatsApp); a link that does not work wastes the invite.
- **Scope:** *In:* an Android verified link to `milevana.poovarasu.dev/join/<code>` opening the app on the join screen with the code filled in; otherwise the web join page: Google sign-in on web and the same join steps; carrying the code through sign-in. *Out:* the landing page and other web pages (tab 8).
- **Preconditions:** SHR-02, SHR-08, `FND-AUTH-02`.
- **Functional behavior:**
  1. With the app installed, tapping the link opens the join screen with the code.
  2. Without the app, the link opens the web join page.
  3. The web join page signs the user in with Google and joins, as in SHR-08.
- **Business rules:** Android App Links verified on the Hosting domain; otherwise a web join page (§23.6 *Invite link*). The code can still be typed (SHR-08). Web is Google sign-in only (FR-WEB-01).
- **Edge cases:** A browser that opens the link in a webview. The code lost during sign-in. A signed-in user opening a link for a vehicle they already belong to. Decision applied: SD-11: the web page content, what the user does next, any pointer to install the app; SD-04: anonymous and conflict cases on a phone.
- **Android/web differences:** App Links open the app on Android; web opens the page elsewhere.
- **Offline behavior:** Needs the network.
- **Security implications:** The code in the URL is a capability token; it is not logged or reported (invite paths are redacted from crash reports, OQ-36).
- **Data/schema impact:** None beyond SHR-08.
- **Acceptance criteria:**
  1. Tapping a verified invite link on a device with the app opens the join screen with the code [§23.6 *Invite link*].
  2. On a device without the app, or in a desktop browser, the link opens the web join page [§23.6].
  3. The web join page completes a join after Google sign-in [FR-WEB-01].
  4. The code does not appear in crash reports [PRV-13].
- **Decisions applied:** SD-02 ◐, SD-04 ◐, SD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-02 ◐] Codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displayed XXXX-XXXX; typing 'k7qx m2pa' or 'K7QX-M2PA' resolves the same invite; links carry the plain uppercase code; a collision regenerates the code up to 5 times.
  2. **D2** [SD-04 ◐] After a link conflict resolved with Move and switch or Switch without moving, the pending join completes with the Google uid and the invite is still valid.
  3. **D3** [SD-11 ◐] The web join page signs the visitor in first, then shows the vehicle and owner names and a Join button; after joining it opens the vehicle in the web app with a 'Get the Android app' link; web offers copy-link and the browser share sheet for invites and does not run receipt share sync.
- **Test requirements:** Manual on a device and in a browser; RNTL for the code hand-off.
- **Dependencies:** SHR-02, SHR-08, FND-AUTH-02.
- **PRD requirement IDs:** PR-15, FR-WEB-01, PRV-13, OQ-36, OQ-57; §23.6 *Invite link*.
- **SRS reference:** Invite link L503; Crash reports OQ-36 L657; OQ-57 L708.

---

# S3 — Membership

### SHR-10 — Shared-vehicle visibility and the members list
- **Epic:** S3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a member, I want to see that a vehicle is shared and who is on it, so that I know who can see my entries.
- **Business value:** Members can see each other's names and Google emails; the app must make that visible and not a surprise (PRV-14).
- **Scope:** *In:* a people icon and member count on shared vehicles (in the switcher and the Vehicles list); a members list showing each member's name, email and role; "Logged by …" on History rows for other members' entries (already built; verified with real members); changes showing up when the app opens or listeners run. *Out:* the privacy policy text (tab 8).
- **Preconditions:** SHR-06, `FND-SHL-04`, `LOG-11`.
- **Functional behavior:**
  1. A vehicle with more than one member shows a people icon and the member count.
  2. The members list shows names, Google emails and roles.
  3. Joining, removals and new entries appear when each person next opens the app or their listeners are running.
- **Business rules:** §23.6 *Visibility*; OQ-58 (names and emails are visible to members; a leaver's email is removed and their name stays on entries). No server push (§23.6 *Propagation*, L5).
- **Edge cases:** Ten members. A member with no name. A removed member's name on old entries. Decision applied: SD-10.
- **Android/web differences:** Same on both.
- **Offline behavior:** Shows cached membership.
- **Security implications:** Emails are shown only to members of that vehicle (rules).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A shared vehicle shows a people icon and a member count in the switcher and the Vehicles list [§23.6 *Visibility*].
  2. The members list shows each member's name, email and role [§23.6 *Visibility*, OQ-58].
  3. History rows show who logged each entry [§23.6 *Visibility*].
  4. A new member appears on another member's device when that app next opens or while its listener runs [§23.6 *Propagation*].
- **Decisions applied:** SD-10 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-10 ◐] A vehicle with more than one member shows a people icon and count in the switcher and the Vehicles rows; the members list is ordered owner first then by join date and shows name, email, role and join date.
- **Test requirements:** RNTL with seeded members; manual with two devices.
- **Dependencies:** SHR-06, FND-SHL-04, LOG-11.
- **PRD requirement IDs:** PR-15, PRV-14, L5, OQ-58; §23.6 *Visibility*, *Propagation*.
- **SRS reference:** Visibility L528–533; OQ-58 L696.

### SHR-11 — Leave a vehicle
- **Epic:** S3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a member, I want to leave a shared vehicle, so that it no longer appears for me and I stop being a member.
- **Business value:** Members must be able to withdraw without the owner's help.
- **Scope:** *In:* **Leave** for a member (not the owner) in More → Vehicles; a confirmation; removal of the member's own record, including their email; the vehicle disappears from their switcher; the owner sees "must transfer ownership or delete" instead of Leave. *Out:* removal by the owner (SHR-12), transfer (SHR-13).
- **Preconditions:** SHR-06, SHR-10, `FND-OBS-03`.
- **Functional behavior:**
  1. A member chooses Leave and confirms.
  2. Their record is removed from `memberIds` and `members`.
  3. The vehicle leaves their switcher and another is selected.
  4. Their past entries stay, labelled "Logged by <name>".
- **Business rules:** Members can leave; an owner must transfer ownership or delete the vehicle instead (§23.6, OQ-55). A leaver's email is removed from `members` and their name stays on entries (OQ-58, OQ-15). Receipts they uploaded stay visible to remaining members until deleted (§23.6 *Leaving*).
- **Edge cases:** Leaving while offline (a queued write). Leaving with queued entries. The owner opening the menu. Decision applied: SD-07: wording, whether a person who leaves and is re-invited regains edit rights on their old entries, handling of their reminders.
- **Android/web differences:** Same.
- **Offline behavior:** A queued leave takes effect on sync; if it is rejected the Foundation Sync issues behavior applies.
- **Security implications:** Rules allow removing only oneself.
- **Data/schema impact:** Updates `memberIds` and `members` on the vehicle.
- **Acceptance criteria:**
  1. A member can leave and the vehicle disappears from their switcher [§23.6 *Roles*].
  2. Their email is no longer in `members` and their name remains on entries [OQ-58].
  3. The owner sees no Leave action and is told to transfer ownership or delete [OQ-55].
  4. Another member's data is unchanged [§23.6].
- **Decisions applied:** SD-06 ◐, SD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-06 ◐] A member's write removing only their own uid is allowed; the owner removing another member is allowed; the owner removing themselves is denied; a transfer must set `ownerId` to an existing member and swap the roles in the same write, and a transfer to a non-member or without the role swap is denied.
  2. **D2** [SD-07 ◐] The leave, remove and transfer confirmations show the stated texts, the remove one including the delayed receipt-access statement; a re-invited member can edit entries whose `createdBy` is theirs; a leaver's reminders and templates stay on the vehicle.
- **Test requirements:** RNTL; emulator test; manual with two accounts.
- **Dependencies:** SHR-06, SHR-10, FND-OBS-03.
- **PRD requirement IDs:** PR-15, OQ-15, OQ-55, OQ-58; §23.6 *Leaving or removal*.
- **SRS reference:** Leaving or removal L518–520; Roles L512–516; OQ-55 L694; OQ-58 L696.

### SHR-12 — Remove a member
- **Epic:** S3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner, I want to remove a member, so that someone who should no longer see the vehicle loses access.
- **Business value:** The owner stays in control of who sees the vehicle's data (§23.6 *Owner role*).
- **Scope:** *In:* **Remove** for the owner on a member in the members list; a confirmation that says the removed member keeps Drive access to any receipt until its uploader's app next opens or returns to the foreground; removal of the member's record; what the removed person sees. *Out:* receipt revocation itself (SHR-14).
- **Preconditions:** SHR-06, SHR-10, `FND-OBS-03`, `FND-OBS-04`.
- **Functional behavior:**
  1. The owner chooses Remove on a member and sees the confirmation with the receipt-access statement.
  2. After confirming, the member's record is removed.
  3. On the removed person's device the vehicle becomes inaccessible: "You no longer have access to this vehicle", then the app switches vehicle.
  4. Their past entries stay, labelled "Logged by <name>".
- **Business rules:** Owners can remove members (§23.6 *Roles*). The removal confirmation and the privacy policy state that a removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground (PRV-15, OQ-56, L14). A queued write by the removed member is rejected and shown through Sync issues (OQ-26).
- **Edge cases:** Removing a member who has queued writes. Removing the last other member (the vehicle becomes unshared). Removing while offline. Decision applied: SD-07.
- **Android/web differences:** Same.
- **Offline behavior:** A queued removal is judged on sync.
- **Security implications:** Rules allow removal by the owner only; the delayed Drive revocation is a stated, disclosed limitation.
- **Data/schema impact:** Updates `memberIds` and `members`.
- **Acceptance criteria:**
  1. The owner can remove a member and the member's record disappears [§23.6 *Roles*].
  2. The confirmation states that the removed member keeps Drive access to receipts until the uploader's app next opens or returns to the foreground [PRV-15].
  3. The removed member's device shows "You no longer have access to this vehicle" and switches vehicle [AC-D11].
  4. A non-owner has no Remove action [§23.6 *Roles*].
- **Decisions applied:** SD-06 ◐, SD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-06 ◐] A member's write removing only their own uid is allowed; the owner removing another member is allowed; the owner removing themselves is denied; a transfer must set `ownerId` to an existing member and swap the roles in the same write, and a transfer to a non-member or without the role swap is denied.
  2. **D2** [SD-07 ◐] The leave, remove and transfer confirmations show the stated texts, the remove one including the delayed receipt-access statement; a re-invited member can edit entries whose `createdBy` is theirs; a leaver's reminders and templates stay on the vehicle.
- **Test requirements:** RNTL; emulator test; manual with two accounts.
- **Dependencies:** SHR-06, SHR-10, FND-OBS-03, FND-OBS-04.
- **PRD requirement IDs:** PR-15, PRV-15, OQ-26, OQ-56, L14; AC-D11, AC-D24.
- **SRS reference:** Roles L512–516; Leaving or removal L518–520; OQ-56 L695; Limitations L834.

### SHR-13 — Transfer ownership
- **Epic:** S3 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a vehicle owner who wants to step back, I want to hand the vehicle to another member, so that it keeps going without me.
- **Business value:** An owner cannot leave, so transfer is the only way out other than deleting; account deletion (tab 8) relies on it (§23.6 *Owner role*).
- **Scope:** *In:* **Transfer ownership** for the owner: choose a member; confirm; the roles in `members` and `ownerId` change; the former owner becomes a member. *Out:* the account deletion flow (tab 8).
- **Preconditions:** SHR-06, SHR-10.
- **Functional behavior:**
  1. The owner picks a member as the new owner and confirms.
  2. `ownerId` becomes that member and the roles in `members` follow.
  3. The former owner keeps access as a member; the new owner has owner rights.
- **Business rules:** Owners can transfer ownership to a member (§23.6 *Owner role*); `ownerId` changes only to an existing member (OQ-34); transfer is also what account deletion relies on (§23.6).
- **Edge cases:** A vehicle with no other member (no transfer possible). Concurrent transfer and removal. Decision applied: SD-06: whether the new owner must accept and what the write contains; SD-07: wording.
- **Android/web differences:** Same.
- **Offline behavior:** A queued transfer is judged on sync.
- **Security implications:** Rules keep `ownerId` pointing at a member; the former owner's rights end with the change.
- **Data/schema impact:** Updates `ownerId` and `members`.
- **Acceptance criteria:**
  1. The owner can transfer ownership to an existing member [§23.6 *Roles*].
  2. After the transfer the former owner is a member with member rights and the new owner can invite, remove, archive and delete [§23.6].
  3. A transfer to a non-member is impossible [OQ-34].
- **Decisions applied:** SD-06 ◐, SD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-06 ◐] A member's write removing only their own uid is allowed; the owner removing another member is allowed; the owner removing themselves is denied; a transfer must set `ownerId` to an existing member and swap the roles in the same write, and a transfer to a non-member or without the role swap is denied.
  2. **D2** [SD-07 ◐] The leave, remove and transfer confirmations show the stated texts, the remove one including the delayed receipt-access statement; a re-invited member can edit entries whose `createdBy` is theirs; a leaver's reminders and templates stay on the vehicle.
- **Test requirements:** RNTL; emulator test; manual with two accounts.
- **Dependencies:** SHR-06, SHR-10.
- **PRD requirement IDs:** PR-15, OQ-34; §23.6 *Owner role*.
- **SRS reference:** Roles L512–516; OQ-34 L655.

---

# S4 — Receipt sharing

### SHR-14 — Receipt sharing sync
- **Epic:** S4 · **Type:** Architecture / user-facing · **Size:** XL · **Readiness:** Ready: decisions applied (see below); acceptance waits on SHR-03.
- **User story:** As a member who uploaded a receipt, I want my phone to share it with the other members and stop sharing it with removed ones, so that the family sees the bills without me doing anything.
- **Business value:** Receipts are auto-shared with members, with no server to do it (§23.6).
- **Scope:** *In:* `src/data/drive/` share sync: on every app open and when the app returns to the foreground, for each shared vehicle find the entries the user uploaded to (using `uploaderUids`); add Drive read access for members who do not have it; remove access for members who are gone (reading the file's permission list); record the result in `attachments[].sharedWithUids`; mark items not yet shared as pending. *Out:* viewing (SHR-15).
- **Preconditions:** SHR-01, SHR-03 (gate), SHR-05, `DRV-03`, `DRV-05`, `DRV-12`.
- **Functional behavior:**
  1. On app open and on returning to the foreground, the phone checks the receipts the user uploaded to shared vehicles.
  2. For each, it grants read access to current members who lack it and records them in `sharedWithUids`.
  3. For members who were removed, it removes their access, found from the file's permission list.
  4. Other members see "Shared once <name> opens the app" until the uploader's phone has done this.
- **Business rules:** Receipts are auto-shared; access catches up when each uploader's app opens (§23.6). Revocation is delayed until the uploader's app opens or returns to the foreground (OQ-56, L14). Revocation reads the file's Drive permission list because a removed member's record is gone. Members who join later cannot see receipts from a member who left, and an uploader who is neither the entry's creator nor the owner cannot update sharing (OQ-56, L15). Receipt sharing for new members reaches a phone only when the relevant app next opens (L5).
- **Edge cases:** A member with no Google email. Drive unreachable. Many receipts. Drive access not granted on this device. Decision applied: SD-08: permission type, notification emails, throttling, handling when the uploader cannot update `sharedWithUids`; SD-11: web.
- **Android/web differences:** Android phone behavior; whether web runs it is SD-11.
- **Offline behavior:** Skipped offline; retried on the next open.
- **Security implications:** Access is granted only to named current members and revoked for removed ones; the revocation delay is stated and disclosed (PRV-15).
- **Data/schema impact:** Updates `attachments[].sharedWithUids`; Drive permissions.
- **Acceptance criteria:**
  1. A receipt uploaded on a shared vehicle becomes readable in Drive by every current member after the uploader's app next opens [§23.6 *Photo sharing mechanics*].
  2. A new member gains access to the uploader's receipts at the uploader's next open [§23.6, L5].
  3. A removed member's access is revoked at the uploader's next open or return to the foreground [OQ-56, L14].
  4. `sharedWithUids` lists who each receipt is shared with [PRV-09].
  5. Until then, other members see "Shared once <name> opens the app" [§23.6].
- **Decisions applied:** SD-08 ◐, SD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-08 ◐] Receipt sharing grants reader access with notification emails off, runs at most once per 15 minutes per vehicle and up to 200 receipts per run, skips members with no email, and for an uploader who is neither creator nor owner still changes Drive access but logs one non-fatal instead of updating `sharedWithUids`.
  2. **D2** [SD-11 ◐] The web join page signs the visitor in first, then shows the vehicle and owner names and a Join button; after joining it opens the vehicle in the web app with a 'Get the Android app' link; web offers copy-link and the browser share sheet for invites and does not run receipt share sync.
- **Test requirements:** Jest with a fake Drive and fake time; manual with two accounts.
- **Dependencies:** SHR-01, SHR-03, SHR-05, DRV-03, DRV-05, DRV-12.
- **PRD requirement IDs:** PR-15, PRV-09, PRV-15, OQ-56, L5, L14, L15; §23.6 *Photo sharing mechanics*.
- **SRS reference:** Photo sharing mechanics L522–526; Receipt photos L498; OQ-56 L695; Limitations L829, L834–835.

### SHR-15 — View other members' receipts
- **Epic:** S4 · **Type:** User-facing · **Size:** M · **Readiness:** Ready: assumes `SHR-01` finds in-app viewing impossible (SD-09); revisit if the spike says otherwise.
- **User story:** As a member, I want to open a receipt another member uploaded, so that I can see the bill behind an entry.
- **Business value:** The point of sharing receipts.
- **Scope:** *In:* showing other members' attachments on shared entries; opening one in the app if SHR-01 shows that is possible, otherwise through an **Open in Drive** button; the "Shared once <name> opens the app" state; receipts from someone who left. *Out:* viewing one's own receipts (`DRV-13`).
- **Preconditions:** SHR-01, SHR-14, `DRV-13`.
- **Functional behavior:**
  1. A member sees the attachments on an entry they can read.
  2. If shared with them, they can open it in the app or through Open in Drive.
  3. If not yet shared, they see "Shared once <name> opens the app".
- **Business rules:** Whether members can view each other's receipts inside the app depends on the Drive spike; the fallback is an Open in Drive button (§23.6, L6, DD-06). Members who join later cannot see receipts from a member who left (OQ-56, L15).
- **Edge cases:** The uploader never opens the app. Access revoked. A file deleted in Drive. Decision applied: SD-09.
- **Android/web differences:** Per SHR-01.
- **Offline behavior:** Per `DRV-13` and SD-09.
- **Security implications:** A member sees only receipts shared with them.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. A receipt shared with the member can be opened in the app or through Open in Drive, as SHR-01 determined [DD-06, L6].
  2. An unshared receipt shows "Shared once <name> opens the app" [§23.6].
  3. A receipt from a member who left is not visible to someone who joined later [OQ-56, L15].
- **Decisions applied:** SD-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [SD-09 ◐] Other members' receipts open through an 'Open in Drive' button unless `SHR-01` proves in-app viewing; an unshared receipt shows 'Shared once <name> opens the app' per attachment; a receipt from someone who left shows 'No longer available' to anyone without access.
- **Test requirements:** RNTL with fakes; manual with two accounts.
- **Dependencies:** SHR-01, SHR-14, DRV-13.
- **PRD requirement IDs:** PR-15, DD-06, L6, L15, OQ-56, RK-17; §23.6 *Photo sharing mechanics*.
- **SRS reference:** Photo sharing mechanics L522–526; Limitations L830, L835; OQ-56 L695.

---

# S5 — Verification

### SHR-16 — Sharing verification: adversarial rules tests and multi-account flows
- **Epic:** S5 · **Type:** Verification · **Size:** L · **Readiness:** Ready once SHR-04 to SHR-15 are built
- **User story:** As the maintainer, I want every sharing path attacked in tests and every flow run with two real accounts, so that no one gains or keeps access they should not have.
- **Business value:** Rules are the entire backend; tab 6 is where the riskiest rules live (PRD §15.6).
- **Scope:** *In:* the full adversarial suite for invites, self-join, leave, remove, transfer and `sharedWithUids` (TS-02); a recorded production run of the join and membership writes; multi-account manual runs: invite, join by code and by link, log entries on both devices, receipt sharing, removal and its message, leave, transfer, the 10-member limit, the anonymous joiner path; confirmation that earlier behaviors work with real members (access-denied message, delete warning with member count, archive hides for all and only the owner unarchives, reminders notify all members, backup lists members by name without emails). *Out:* the privacy policy text (tab 8).
- **Preconditions:** SHR-04 to SHR-15.
- **Functional behavior:** Runnable by someone other than the author.
- **Business rules:** Tab 6 paths each get their own adversarial tests (TS-02). Web has a manual smoke test (TS-07).
- **Edge cases:** Two devices acting at once; a removed member with queued writes; an expired invite.
- **Android/web differences:** Device and browser runs.
- **Offline behavior:** Join, leave and remove while one device is offline.
- **Security implications:** Test accounts only.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Each of the invite, join, leave, remove, transfer and `sharedWithUids` paths has its own adversarial tests and all pass [TS-02].
  2. A removed member sees "You no longer have access to this vehicle" and their queued write appears in Sync issues [AC-D11, AC-D24].
  3. Archiving a shared vehicle hides it for all members and only the owner can unarchive it [OQ-55].
  4. Deleting a shared vehicle warns with the member count and members' files stay in their own Drives [FR-VEH-14, OQ-51].
  5. The backup of a shared vehicle lists members by name with no email [OQ-53].
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** SHR-04 to SHR-15.
- **PRD requirement IDs:** PR-15, TS-01, TS-02, TS-07, FR-VEH-14, OQ-51, OQ-53, OQ-55; AC-D11, AC-D24.
- **SRS reference:** Rules L535–537; Testing L309–322; OQ-55 L694.

---

# A. Sharing epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **S1 Sharing foundations** | Two spikes (Drive access to members' receipts, quota), Hosting with App Links, the rules for invites, join, leave, remove and transfer, and the repositories and invite code | SHR-01 to SHR-06 |
| **S2 Inviting and joining** | Invite a member, join by code, invite links and the web join page | SHR-07 to SHR-09 |
| **S3 Membership** | Shared-vehicle visibility and members list, leave, remove, transfer ownership | SHR-10 to SHR-13 |
| **S4 Receipt sharing** | The Drive share sync and viewing other members' receipts | SHR-14, SHR-15 |
| **S5 Verification** | Adversarial rules tests and multi-account runs | SHR-16 |

**Architectural versus user-facing.** Architecture, setup or spike: SHR-01 to SHR-06 (SHR-14 is the sync mechanism and also user-visible). User-facing: SHR-07 to SHR-13, SHR-15. Verification: SHR-16.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`SD-nn`, or an earlier `DR-nn`, `LD-nn`, `ED-nn`) that blocks part of it; section E says which part.

| Wave | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- |
| W1 | SHR-01 | Spike: members' access to receipts under `drive.file` | S | DRV-01, DRV-03 |
| W1 | SHR-02 | Hosting, domain and Android App Links | L | FND-PLT-02, FND-PLT-03 |
| W1 | SHR-03 ◆ | Spike: quota budget for sharing | S | FND-VER-01, LOG-01, RPT-01, DRV-02 |
| W1 | SHR-04 ◆ | Rules: invites and self-join | XL | FND-SEC-01 to FND-SEC-03 |
| W1 | SHR-05 ◆ | Rules: leave, remove, transfer, receipt sharing | L | FND-SEC-01 to FND-SEC-03 |
| W2 | SHR-06 ◆ | Invite and membership repositories, invite code | L | SHR-04, SHR-05, FND-DAT-06, FND-DAT-07 |
| W2 | SHR-14 ◆ | Receipt sharing sync | XL | SHR-01, SHR-03 (gate), SHR-05, DRV-03, DRV-05, DRV-12 |
| W3 | SHR-07 ◆ | Invite a member | M | SHR-06, FND-AUTH-04; SHR-02 |
| W3 | SHR-08 ◆ | Join a vehicle by code | L | SHR-06, FND-AUTH-03 to FND-AUTH-06, FND-SHL-02 |
| W3 | SHR-10 ◆ | Shared-vehicle visibility and members list | M | SHR-06, FND-SHL-04, LOG-11 |
| W3 | SHR-15 ◆ | View other members' receipts | M | SHR-01, SHR-14, DRV-13 |
| W4 | SHR-09 ◆ | Invite links and the web join page | M | SHR-02, SHR-08, FND-AUTH-02 |
| W4 | SHR-11 ◆ | Leave a vehicle | M | SHR-06, SHR-10, FND-OBS-03 |
| W4 | SHR-12 ◆ | Remove a member | M | SHR-06, SHR-10, FND-OBS-03, FND-OBS-04 |
| W4 | SHR-13 ◆ | Transfer ownership | M | SHR-06, SHR-10 |
| W5 | SHR-16 | Sharing verification | L | SHR-04 to SHR-15 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Start | SHR-01 ∥ SHR-02 ∥ SHR-03 ∥ SHR-04 ∥ SHR-05 | Two spikes, an infrastructure setup, and two independent rules sets |
| Repositories and sync | SHR-06 ∥ SHR-14 | Membership repositories versus the Drive share sync |
| Invite, join, visibility, viewing | SHR-07 ∥ SHR-08 ∥ SHR-10 ∥ SHR-15 | Different screens |
| Links and membership changes | SHR-09 ∥ SHR-11 ∥ SHR-12 ∥ SHR-13 | The link entry point and three membership actions |

**Not parallel:** SHR-06 waits on both rules stories. SHR-09 waits on SHR-08. SHR-11 to SHR-13 wait on SHR-10. SHR-14's acceptance waits on SHR-03. SHR-16 is last.

**Early starts.** SHR-02 can begin as soon as the external inputs exist. SHR-16's adversarial tests are written alongside SHR-04 and SHR-05.

---

# D. Blocking dependencies

**D1. Earlier sub-projects must be accepted first.** The PRD lists Foundation (data model, vehicle rules, membership), Drive and export (Drive client, `drive.file`) and linking. Needed specifically: `FND-SEC-01` to `FND-SEC-03`, `FND-DAT-06`, `FND-DAT-07`, `FND-AUTH-02` to `FND-AUTH-06`, `FND-SHL-02`, `FND-SHL-04`, `FND-OBS-03`, `FND-OBS-04`; from Logging `LOG-11`; from Drive and export `DRV-01`, `DRV-02`, `DRV-03`, `DRV-05`, `DRV-12`, `DRV-13`.

**D2. Spike SHR-01 decides the viewing design.** The PRD makes in-app viewing of other members' receipts depend on this spike, with Open in Drive as the fallback. SHR-15 cannot be finished before it.

**D3. External inputs for SHR-02.** DNS control of `poovarasu.dev` for the `milevana` subdomain and Firebase's domain verification (PRD §24.4 notes these are not stated in the source); the release signing certificate fingerprint, including the Play app-signing key once a Play upload exists `[External — verify]`.

**D4. The rules are the riskiest part.** SHR-04 and SHR-05 should be settled before anything else in this sub-project is accepted. They depend on SD-01 to SD-03 and SD-06, and on Foundation's DR-12 (owner writes to membership fields). Each also needs a recorded production run, as the batch behavior had in Foundation (G3).

**D5. Quota gate.** SHR-03 must pass before SHR-14 is accepted; it cannot pass until Foundation's DR-20 is answered.

**D6. Decisions that block data and rule shapes.** SD-03 (the join write), SD-06 (leave, remove, transfer shapes) and SD-08 (what `sharedWithUids` records and when) fix what rules and documents look like. The model is meant to avoid migrations, so settle them before SHR-04, SHR-05 and SHR-14 ship.

**D7. Upstream decisions that carry in.** Foundation DR-02 (the member's `name` and `email` values) determines what a join writes and what the members list shows. Foundation DR-12 (owner writes) determines what SHR-05 must deny. Logging LD-13 (whether an owner edits other members' entries) is finally observable here. Drive ED-01 (which Google account Drive uses) matters because receipts are shared by email.

**D8. Test setup.** Two or three test Google accounts, two devices (or a device and a browser) and a test Drive.

**D9. Later tabs.** Account deletion (tab 8) relies on ownership transfer built here; the privacy policy must state the member-data and delayed-revocation facts (PRV-14, PRV-15). Nothing here should block them.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Schema/rules** = needed before rules or documents in the final shape are written · **Story** = before the named story is accepted · **Copy** = does not block engineering.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **SD-01** | **Reading invites and guessing.** Who may read an invite (any signed-in user by exact code, only the owner, whether an anonymous user may read before linking); whether listing is denied; any guard against guessing codes beyond the 8-character alphabet. | The rules matrix says `invites/{code}` is "denied in Foundation; defined in tab 6". OQ-55 fixes the code length and that the invite carries the names, not who may read it. | SHR-04, SHR-08 | Schema/rules |
| **SD-02** | **Code details.** The exact alphabet; the display form (the example K7QX-M2PA has a hyphen after 4 characters); case-insensitive entry; the random source; whether the link carries the plain or hyphenated code; collision handling. | OQ-55 says "8 characters from an unambiguous alphabet" and §23.6 gives one example. | SHR-06, SHR-07, SHR-09 | Story |
| **SD-03** | **Join write and validity.** The exact member record written (`role`, `name`, `email`, `joinedAt`, `inviteCode`) and where the joiner's name and email come from; whether rules also require a non-anonymous account; whether an archived vehicle can be joined; behavior if the vehicle was deleted after the invite; what Join does offline on Android. | Appendix E and §23.6 say a join "adds themselves only if a valid, unused invite exists and the same write marks it used" and that joining requires a linked account. Foundation DR-02 leaves member identity values open. | SHR-04, SHR-06, SHR-08 | Schema/rules |
| **SD-04** | **Anonymous joiner and the conflict path.** When a joiner links Google and the account already has data, how the pending invite continues after **Move and switch** or **Switch without moving**; whether the invite stays valid; the same on a phone opened from a web link. | PRD OQ-55 raises "what if the joiner is an anonymous user whose Google account already has data (the merge path)" and the recorded decision does not answer it. | SHR-08, SHR-09 | Story |
| **SD-05** | **Invite management.** Where the Invite action and the pending list live; whether several invites may be pending; what the screen does at 10 members; how expired invites are shown, given no server removes them. | §23.6 says the owner "can see and cancel pending invites" without placement or limits. | SHR-06, SHR-07 | Story |
| **SD-06** | **Leave, remove and transfer write shapes.** The exact fields each write changes; whether the new owner must accept a transfer (OQ-62 says no acceptance for the account-deletion hand-over only); whether roles swap in one write; whether rules or only the UI stop an owner removing themselves; what the "transfer" adversarial test attempts in light of Foundation DR-12. | OQ-34 and OQ-55 give invariants and "an owner must transfer or delete rather than leave". | SHR-05, SHR-11, SHR-12, SHR-13 | Schema/rules |
| **SD-07** | **Membership change effects and wording.** Texts for leave, remove and transfer confirmations and notices; whether someone re-invited after leaving regains edit rights over their old entries (their `createdBy` still matches); what happens to a leaver's reminders and mute entry; what the owner sees when a member leaves. | §23.6 *Leaving or removal* fixes only that entries stay "Logged by <name>" and receipts stay visible. | SHR-05, SHR-11, SHR-12, SHR-13 | Story / Copy |
| **SD-08** | **Receipt sharing sync details.** The Drive permission type and whether Drive sends notification emails; how often the sync may run and any limit per run; members with no email; what the phone does when the uploader is neither the entry's creator nor the owner and so cannot update `sharedWithUids`; retry after Drive failure; progress shown. | §23.6 and OQ-56 fix the schedule (every open and foreground return), the Drive permission-list read for revocation, and the accepted limitations. | SHR-14 | Story |
| **SD-09** | **Viewing others' receipts.** The result of SHR-01 (in-app or Open in Drive); the exact states and wording of "Shared once <name> opens the app" (per attachment or per entry); offline viewing; web; what a member sees for a receipt from someone who left. | The PRD makes the choice depend on the spike. | SHR-15 | Story |
| **SD-10** | **Visibility placement.** Where the people icon and member count appear; where the members list lives; its order; whether join date and the owner are marked. | §23.6 *Visibility* says the icon, the count, "Logged by" and visible names and emails. | SHR-10 | Story |
| **SD-11** | **Web specifics.** What the web join page shows before sign-in and what the user does next (open the web app, any pointer to the Android app); how an owner sends an invite from web (copy link or browser share); whether web runs the receipt share sync through Google Identity Services or only phones do. | §23.6 says only that the link opens "a web join page" when the app is not installed. OQ-20 says sharing works on web. | SHR-07, SHR-09, SHR-14 | Story |

**Decisions from earlier sub-projects that carry in:** Foundation DR-02 member identity values · DR-12 owner writes to membership fields · DR-13 archived-vehicle actions · DR-15 selected vehicle · DR-16 copy gaps · DR-17 shell content · DR-20 quota threshold · DR-21 rules deployment · Logging LD-13 owner and other members' entries · Drive ED-01 Drive account match · ED-08 upload queue · ED-10 cleanup · Reports PD-08 shared vehicles in "All vehicles".

**Can start before any decision is answered:** SHR-01, SHR-02 (once its external inputs exist), SHR-03, the stated-rule parts of SHR-04 and SHR-05 (owner-only invite, 10-member limit, invariants), and SHR-10's icon and count.

---

# F. Sharing Definition of Done

The PRD defines no acceptance criteria for sub-project 6, so this list is derived from the stated scope and decisions. The product owner should confirm it.

**Scope delivered (PRD §23.6)**
- [ ] An owner can create an invite (a code like K7QX-M2PA and a link on `milevana.poovarasu.dev`), send it through the share sheet, see pending invites and cancel them; invites are single-use and expire in 7 days.
- [ ] A user can join by typing the code under More → Join a vehicle, or by opening the link, which opens the app on the join screen or a web join page; an anonymous user is walked through linking first.
- [ ] A vehicle has at most 10 members including the owner.
- [ ] Members see everything, log entries, edit their own entries, manage reminders and can leave; owners also edit the vehicle, invite, remove members, archive or delete it and transfer ownership; an owner must transfer or delete rather than leave.
- [ ] Past entries stay after a member leaves or is removed, labelled "Logged by <name>"; the leaver's email is removed.
- [ ] Shared vehicles show a people icon and member count; members see each other's names and emails.
- [ ] Receipts are auto-shared through Drive permissions, recorded in `sharedWithUids`, and catch up whenever each uploader's app opens or returns to the foreground; other members see "Shared once <name> opens the app" until then.
- [ ] Members can view other members' receipts in the app, or through Open in Drive if the spike says in-app viewing is not possible.
- [ ] The removal confirmation states that a removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground.

**Rules and evidence**
- [ ] Invite, join, leave, remove, transfer and `sharedWithUids` paths each have adversarial tests that pass (TS-02), replacing Foundation's default-deny tests for them.
- [ ] A recorded production run of the join and membership writes.
- [ ] SHR-01 and SHR-03 passed; SHR-02's App Links verified on a device.
- [ ] SHR-16 is run and recorded with two or more accounts.

**Scope and quality**
- [ ] No out-of-scope feature exists: no server push, no account deletion flow, no privacy policy pages.
- [ ] All new text goes through i18n; tap targets, labels, dark mode and font scaling hold on new screens (AC-D17).
- [ ] Every `SD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The PRD has no acceptance criteria for sub-project 6; the last column cites the story's own criteria (`#n`) plus the applicable Foundation `AC-D` or test requirement.

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| SHR-01 | PRV-09, DD-06, L6, OQ-56, RK-17 | Photo sharing L522–526; Limitations L830; OQ-56 L695 | #1–#3 |
| SHR-02 | PR-15, OQ-38, OQ-57; §14.8, §24.4 | Invite link L503; Hosting L617; OQ-57 L708; OQ-38 L659 | #1–#4 |
| SHR-03 | NFR-06, NFR-19, NFR-20, RK-25, OQ-18, OQ-35, OQ-56 | OQ-18 L642; OQ-35 L656; OQ-56 L695 | #1–#3 |
| SHR-04 | PR-15, FR-SEC-09, FR-SEC-12, NFR-10, TS-01, TS-02, OQ-33, OQ-34, OQ-35, OQ-55 | Rules L193–198; Invites L500–505; Joining L507–510; L774–776; OQ-55 L694 | #1–#6 |
| SHR-05 | PR-15, FR-SEC-09, FR-SEC-12, TS-01, TS-02, OQ-34, OQ-55, OQ-56, L15 | Rules L193–198; Roles L512–516; L535–537; OQ-55 L694; OQ-56 L695 | #1–#6 |
| SHR-06 | PR-15, FR-DATA-02, TS-04, OQ-55; §23.6 Invite creation | Invites L500–505; L774–776; OQ-55 L694 | #1–#5 |
| SHR-07 | PR-15, FR-LINK-03, OQ-55; §23.6 Invite creation, Invite rules | Invites L500–505; Roles L512–516; OQ-55 L694 | #1–#5 |
| SHR-08 | PR-15, FR-NAV-05, FR-LINK-03, OQ-25, OQ-55; §23.6 Joining | Joining L507–510; Navigation L259; OQ-55 L694; OQ-25 L648 | #1–#5 |
| SHR-09 | PR-15, FR-WEB-01, PRV-13, OQ-36, OQ-57; §23.6 Invite link | Invite link L503; OQ-36 L657; OQ-57 L708 | #1–#4 |
| SHR-10 | PR-15, PRV-14, L5, OQ-58; §23.6 Visibility, Propagation | Visibility L528–533; OQ-58 L696 | #1–#4 |
| SHR-11 | PR-15, OQ-15, OQ-55, OQ-58; §23.6 Leaving or removal | Leaving L518–520; Roles L512–516; OQ-55 L694; OQ-58 L696 | #1–#4 |
| SHR-12 | PR-15, PRV-15, OQ-26, OQ-56, L14; AC-D11, AC-D24 | Roles L512–516; Leaving L518–520; OQ-56 L695; L834 | #1–#4; AC-D11 |
| SHR-13 | PR-15, OQ-34; §23.6 Owner role | Roles L512–516; OQ-34 L655 | #1–#3 |
| SHR-14 | PR-15, PRV-09, PRV-15, OQ-56, L5, L14, L15; §23.6 Photo sharing mechanics | Photo sharing L522–526; Receipts L498; OQ-56 L695; Limitations L829, L834–835 | #1–#5 |
| SHR-15 | PR-15, DD-06, L6, L15, OQ-56, RK-17 | Photo sharing L522–526; L830, L835; OQ-56 L695 | #1–#3 |
| SHR-16 | PR-15, TS-01, TS-02, TS-07, FR-VEH-14, OQ-51, OQ-53, OQ-55; AC-D11, AC-D24 | Rules L535–537; Testing L309–322; OQ-55 L694 | #1–#5; AC-D11, AC-D24 |

**G2. §23.6 scope item → covering stories** (proves each item is covered).

| §23.6 scope item | Stories |
| --- | --- |
| Invite codes (8 characters, unambiguous alphabet, K7QX-M2PA style) | SHR-06, SHR-07 |
| Invite links on `milevana.poovarasu.dev`; App Links; web join page | SHR-02, SHR-09 |
| Single-use, 7-day expiry, owner sees and cancels pending invites | SHR-04, SHR-06, SHR-07 |
| Join by typing the code under More → Join a vehicle; linking first | SHR-08 |
| Rules: invite validation, self-join marks invite used, 10-member limit | SHR-04 |
| Owner and member roles and what each can do | SHR-05, SHR-10 to SHR-13 |
| Leave | SHR-05, SHR-11 |
| Remove a member, with the delayed-access statement in the confirmation | SHR-05, SHR-12 |
| Ownership transfer | SHR-05, SHR-13 |
| "Logged by …" after leaving; leaver's email removed | SHR-10, SHR-11 |
| People icon, member count, names and emails visible | SHR-10 |
| Receipt auto-sharing through Drive permissions; `sharedWithUids`; catch-up on app open | SHR-05, SHR-14 |
| Viewing other members' receipts or Open in Drive; "Shared once … opens the app" | SHR-01, SHR-15 |
| No server push; propagation on next open | SHR-10, SHR-14 |
| Adversarial tests for each new path | SHR-04, SHR-05, SHR-16 |
| Quota budget | SHR-03 |
