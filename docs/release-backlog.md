# Milevana v1 — Sub-project 8: Release — Implementation Backlog

**Format:** User stories (Card / Conversation / Confirmation, checked against INVEST) · **Stories:** 15 in 5 epics · **Date:** 2026-10-07

## How to read this backlog

**Sources.** Only `docs/requirements.md` (the SRS) and `docs/prd.md` (the PRD) define requirements. Nothing here adds, removes or changes a requirement. Claude Design is a visual reference during implementation only.

**This sub-project mixes software and release operations.** Account deletion and the web pages are software. The Play listing, the consent screen, tester recruitment and the policy text are tasks in external consoles or documents. Each story says which kind it is (`Type`). Operational stories still get acceptance criteria so they can be checked.

**Specification.** PRD §23.8 records "what the source already fixes", the tab 8 decisions and OQ-15, OQ-16, OQ-28, OQ-57, OQ-61 to OQ-63, and says "Acceptance criteria: defined in tab 8".
- **Unlike tabs 2 to 7, the PRD does give release-level acceptance criteria**: `AC-R1` to `AC-R5` (PRD §25.3). They are cited where they apply. The story criteria below are otherwise **derived from stated behavior** and cite the row they restate; they are proposals for the product owner to confirm.
- **Requirement IDs cited are the PRD's existing ones**: `PR-17`, `PRV-10` to `PRV-15`, `FR-NAV-05`, `FR-OUT-05`, `FR-VEH-07`, `NFR-01`, `OQ-15`, `OQ-16`, `OQ-28`, `OQ-36`, `OQ-38`, `OQ-57`, `OQ-61` to `OQ-63`, risks `RK-05`, `RK-06`, `RK-10`, limitations `L3`, `L16`, gate `G6`, and `AC-R1` to `AC-R5`. Where the PRD gives only a row in §23.8, the row name is cited, for example "§23.8 *In-app deletion flow*".

**Labels.** `REL-nn` story IDs and `VD-nn` decision labels are tracking labels, not requirement IDs. Earlier decisions are `DR-nn` (Foundation), `LD-nn` (Logging), `ED-nn` (Drive and export), `SD-nn` (Sharing).

**Priority.** The source assigns none. Stories carry a dependency **wave** and a **phase** (section B). Sizes are relative: S ≈ 1–2 days, M ≈ 3–5 days, L ≈ 1–2 weeks, XL > 2 weeks. External waiting time, such as Google's review, is not counted in size.

**`[DECISION REQUIRED]`** marks something an implementer needs that the SRS/PRD does not specify. None is resolved here. Section E lists them as `VD-nn`, plus earlier decisions that carry in.

**Decision status (2026-10-07).** Every `[DECISION REQUIRED]` item in this backlog now has either an answer from the owner or an applied assumption, recorded in `docs/decisions-register.md` (answered items marked ✔, assumed items ◐). The Readiness lines and the decision table below are as originally written; read them together with the register.

## Scope and timing

**In scope (PRD §23.8):** Play closed testing and production access, account deletion, the privacy policy and terms, the Play listing and data-safety declarations, the Google consent screen, and web deployment of `/privacy`, `/terms`, `/delete-account` and the landing page at `milevana.poovarasu.dev`; launch polish (icon, adaptive icon, splash); the release flow EAS Build → internal testing → closed testing → production.

**Two phases.** The PRD says the closed test starts after sub-project 2 and runs in parallel with sub-projects 3 to 7 (OQ-61), and that a minimal privacy-policy URL, data-safety form and store listing are prepared just before the first closed-test upload (OQ-16). So this backlog has two phases:
- **Phase A: before the first closed-test upload (after sub-project 2):** `REL-01`, `REL-02`, `REL-13`, `REL-10` (minimal), `REL-03`, then `REL-04` runs alongside tabs 3 to 7.
- **Phase C: after all features exist:** account deletion (`REL-05` to `REL-09`), the full policies, landing page and in-app About, the full listing, final verification and the production rollout.

**What earlier sub-projects provide** (assumed accepted for Phase C): everything in sub-projects 1 to 7. Specifically for deletion: ownership transfer, leave and remove (`SHR-11` to `SHR-13`), vehicle delete (`FND-VEH-04`), sign-out clearing and `clearPersistence()` (`FND-AUTH-08`), the `deletion` field in the user schema (`FND-DAT-02`), the Backup & export screen (`DRV-07`). Hosting, `/join/:code` and the App Links file already exist from `SHR-02`. The welcome screen is `FND-SHL-01`.

**Out of scope:** any new product feature; iOS; over-the-air code updates (not in v1); a custom domain purchase (decided against, OQ-61); recurring auto-entries and other items in PRD §6.1; paid tiers.

**Scope notes (not product decisions):**
1. Account deletion uses only the existing rule paths; no extra rule is needed (PRD §15.4). Deleting a vehicle's documents, handing off ownership, leaving a vehicle and deleting the user's own document all use rules built earlier.
2. Entries a user logged on other members' vehicles keep their name after deletion, and the policy says so (OQ-62, L16). Receipts stay in the user's own Drive.
3. Orphaned documents from abandoned anonymous accounts cannot be deleted without server code (L3); the policy must not promise full deletion for them (OQ-62).

## Epics

| Code | Epic | Stories |
| --- | --- | --- |
| V1 | Release pipeline and Google setup | REL-01, REL-02 |
| V2 | Account deletion | REL-05 to REL-09 |
| V3 | Policies, web and launch polish | REL-10 to REL-13 |
| V4 | Play | REL-03, REL-04, REL-14 |
| V5 | Verification and rollout | REL-15 |

---

# V1 — Release pipeline and Google setup

### REL-01 — Release pipeline: EAS Build, Play tracks, signing, no OTA
- **Epic:** V1 · **Type:** Release operations · **Size:** L · **Phase:** A · **Readiness:** Ready: decisions applied (see below).
- **User story:** As the maintainer, I want one repeatable path from a tagged commit to a Play track, so that every build testers and users get is built, signed and published the same way.
- **Business value:** The closed test needs real builds on a Play track. A repeatable pipeline also makes "tested before each release" a gate and not a habit.
- **Scope:** *In:* EAS Build for Android on tagged releases (started in Foundation CI); EAS Submit to Play; the flow internal testing → closed testing → production; Play app signing; secrets kept in GitHub and EAS secrets; rules and indexes deployed on tagged releases and Hosting deployed from CI; confirming that no over-the-air update library is present. *Out:* the closed-test run itself (`REL-04`), store content (`REL-03`, `REL-14`).
- **Preconditions:** `FND-PLT-03`, `FND-PLT-02`; a Play developer account (REL-03).
- **Functional behavior:**
  1. A release tag builds a signed Android app bundle and submits it to the chosen Play track.
  2. The same tag deploys the security rules and indexes and the web build to Hosting.
  3. Builds reach internal testing first, then closed testing, then production.
- **Business rules:** EAS Build produces an Android build on tagged releases; EAS Submit publishes to Play; Hosting deploys from CI; rules and indexes deploy on tagged releases; secrets live in GitHub and EAS secrets (OQ-38). Updates ship through Play only, with no over-the-air code updates (§23.8 *Updates*, RK-10). Maestro and the manual checklist run before each release (§23.8, AC-R2). The package id `dev.poovarasu.milevana` is permanent after the first Play release (RK-05).
- **Edge cases:** A rules deploy that fails after the build succeeds. Two tags close together. A rules change that must reach the project before a client build needs it (Foundation DR-21). Decision applied: VD-03: version numbering and Play App Signing enrollment.
- **Android/web differences:** Android build and Play submission; the web build goes to Hosting.
- **Offline behavior:** N/A.
- **Security implications:** Signing material and service credentials only in secret stores; nothing in the repository (OQ-38).
- **Data/schema impact:** Deploys rules and indexes.
- **Acceptance criteria:**
  1. A release tag produces a signed build on the internal testing track without manual steps beyond approval [OQ-38].
  2. The same run deploys rules, indexes and the web build [OQ-38].
  3. The dependency tree contains no over-the-air update library [RK-10].
  4. A release run is blocked until the Maestro and manual checklist results are recorded [AC-R2].
- **Decisions applied:** DR-21 ✔, VD-03 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-21 ✔] A runbook documents the manual deploy of rules and indexes for development, and the tag workflow deploys them on a release.
  2. **D2** [VD-03 ✔] Release builds get an EAS-managed build number and a semantic version name, the upload keystore is EAS-managed with Play App Signing, closed testers are added through a Google Group, and the production release is a full rollout.
- **Test requirements:** A dry-run tag on internal testing; manual verification of each track.
- **Dependencies:** FND-PLT-02, FND-PLT-03.
- **PRD requirement IDs:** NFR-01, RK-05, RK-10, OQ-38, AC-R2; §23.8 *Release flow*, *Updates*.
- **SRS reference:** Launch polish L612–619; OQ-38 L659; Libraries L119–121.

### REL-02 — Google consent screen and OAuth publishing (gate G6)
- **Epic:** V1 · **Type:** Release operations · **Size:** M · **Phase:** A · **Readiness:** Ready once the domain is live (VD-01); Google's brand-verification review time is outside the project's control.
- **User story:** As the maintainer, I want the Google sign-in consent screen published with the app's name and domain, so that closed testers who are not on a test-user list can link their Google account.
- **Business value:** Linking is required for backup, receipts and sharing (RK-28). If testers cannot link, the closed test cannot exercise them.
- **Scope:** *In:* configure the consent screen with the app name and logo and the `milevana.poovarasu.dev` domain (PRV-12); publish it with basic sign-in scopes before the closed test, and later add `drive.file` (sub-project 5); verify with a Google account that is not a listed test user (gate G6); confirm the exact verification requirement Google applies. *Out:* the privacy-policy page content (`REL-10`).
- **Preconditions:** `FND-PLT-02`; the Hosting domain (`SHR-02`) or its interim (VD-01); `REL-13` for the logo.
- **Functional behavior:**
  1. The consent screen shows the app name and logo for sign-in.
  2. A non-test-user account can link Google on a Play-signed build.
  3. When `drive.file` is added, the same account can grant Drive access.
- **Business rules:** The consent screen is published with basic sign-in scopes before the closed test and `drive.file` is added in sub-project 5; verify with an account that is not a listed test user (OQ-28, G6). Google will likely want a verified domain, which a free `.web.app` address cannot provide; the exact requirement is confirmed at the start of this sub-project (§23.8 *Google consent screen*, PRV-12). Also confirm separate Android and web OAuth clients, the Play app-signing SHA-1 and the authorized domains (§14.8).
- **Edge cases:** Verification review time. A scope that triggers a stricter review. A domain not yet verified. Decision applied: VD-01, VD-02.
- **Android/web differences:** Android and web OAuth clients are both covered.
- **Offline behavior:** N/A.
- **Security implications:** Only the scopes the app needs are published; no broader scope is added.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The consent screen shows the app name, logo and domain [PRV-12].
  2. A Google account that is not a listed test user can link Google in a Play-signed build [G6, OQ-28].
  3. After sub-project 5, the same account can grant `drive.file` [OQ-28].
  4. The Play app-signing SHA-1 and the domain are registered where Google requires them [§14.8].
- **Decisions applied:** VD-01 ✔, VD-02 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-01 ✔] `https://milevana.poovarasu.dev` serves the web sign-in with a minimal `/privacy` page right after sub-project 2, before `/join` and the App Links file exist.
  2. **D2** [VD-02 ✔] The consent screen shows the Milevana name and logo with a contact mailbox on `poovarasu.dev`, is brand-verified before the first closed-test upload, and a non-test-user account can link Google.
- **Test requirements:** Manual run with a non-test-user account on a Play-signed build.
- **Dependencies:** FND-PLT-02; SHR-02 or the VD-01 interim; REL-13.
- **PRD requirement IDs:** PRV-12, RK-28, OQ-28, OQ-57, AC-R5; G6; §14.8.
- **SRS reference:** Google consent screen L610; OQ-28 L707; OQ-57 L708.

---

# V4 — Play

### REL-03 — Play Console setup and minimal declarations
- **Epic:** V4 · **Type:** Release operations · **Size:** M · **Phase:** A · **Readiness:** Ready once the assets (VD-12) and a live policy URL (VD-01, `REL-10`) exist.
- **User story:** As the maintainer, I want the Play app created with the minimum a closed test needs, so that I can upload the first build as soon as sub-project 2 is done.
- **Business value:** The closed test's 14 days start only after the first upload. Every day of delay moves the production date.
- **Scope:** *In:* a Play developer account (the one-time US$25 fee); the app created with package id `dev.poovarasu.milevana`; a minimal privacy-policy URL, a minimal data-safety form and a minimal store listing prepared just before the first closed-test upload; category and audience; the internal and closed testing tracks. *Out:* the full listing, screenshots and final declarations (`REL-14`), the tester run (`REL-04`).
- **Preconditions:** `REL-01`, `REL-02`, `REL-10` (minimal), `REL-13`.
- **Functional behavior:**
  1. The app exists in Play Console under the permanent package id.
  2. The minimal policy URL, data-safety form and listing are saved.
  3. An internal-testing build can be uploaded and installed.
- **Business rules:** The only fixed cost is the one-time US$25 Play registration (NFR-01). A minimal privacy policy URL, data-safety form and store listing are prepared just before the first closed-test upload; what Play requires is verification pending (OQ-16). Category Auto & Vehicles; audience 18+ (§23.8 *Play listing*). Declare crash logs and the Crashlytics installation id, state that receipts live in the user's Drive, and mention members' emails and the camera permission (OQ-63).
- **Edge cases:** Play asks for a declaration the PRD does not list. A policy URL that is not live yet. The package id cannot change after the first release (RK-05). Decision applied: VD-01, VD-03, VD-12.
- **Android/web differences:** Android only.
- **Offline behavior:** N/A.
- **Security implications:** The data-safety form must match what the app does (no ads, no location, crash logs, encrypted in transit).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The app is created with package id `dev.poovarasu.milevana` [RK-05].
  2. A minimal privacy-policy URL, data-safety form and listing are saved and accepted by Play [OQ-16].
  3. A build can be uploaded to internal testing [§23.8 *Release flow*].
  4. The only payment made is the one-time registration fee [NFR-01].
- **Decisions applied:** VD-01 ✔, VD-03 ✔, VD-12 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-01 ✔] `https://milevana.poovarasu.dev` serves the web sign-in with a minimal `/privacy` page right after sub-project 2, before `/join` and the App Links file exist.
  2. **D2** [VD-03 ✔] Release builds get an EAS-managed build number and a semantic version name, the upload keystore is EAS-managed with Play App Signing, closed testers are added through a Google Group, and the production release is a full rollout.
  3. **D3** [VD-12 ✔] The first closed-test build contains an interim icon, adaptive icon and splash, and the final artwork replaces them before production.
- **Test requirements:** Manual in Play Console.
- **Dependencies:** REL-01, REL-02, REL-10, REL-13.
- **PRD requirement IDs:** NFR-01, RK-05, RK-06, OQ-16, OQ-63; §23.8 *Play listing*, *Data-safety form*.
- **SRS reference:** Policies and listing L605–610; Play Store gate L586–591; OQ-16 L706; OQ-63 L711.

### REL-04 — Closed test and production access
- **Epic:** V4 · **Type:** Release operations · **Size:** M (plus about 14 days of elapsed time) · **Phase:** A, running through Phase C · **Readiness:** Ready once `REL-03` is done; about 14 days of elapsed time.
- **User story:** As the maintainer, I want the Play closed test run as early as possible with enough testers, so that production access is the only wait left when the app is finished.
- **Business value:** Google's gate for new personal accounts is 12 or more testers for 14 continuous days, then answering Google's questions. Starting after sub-project 2 hides most of that time behind development (G10).
- **Scope:** *In:* recruit 15 to 20 testers; get them opted in to the closed test; keep at least 12 opted in for 14 continuous days; ship later sub-projects to testers as updates; after the 14 days answer Google's questions about the test; request and obtain production access. *Out:* store content (`REL-03`, `REL-14`), the production rollout (`REL-15`).
- **Preconditions:** `REL-03`; a usable personal app (sub-project 2 complete).
- **Functional behavior:**
  1. Testers install through the closed track and stay opted in.
  2. The 14-day count is tracked and not reset by a dropout.
  3. After 14 days the questions are answered and production access is requested.
- **Business rules:** Personal developer accounts created after November 13, 2023 must run a closed test for each app before production; at least 12 testers stay opted in for 14 continuous days; the developer then answers Google's questions (§23.8 *Play gate details*, RK-06). Recruit 15 to 20 friends or family so one dropout does not reset the clock (§23.8 *Timeline*). The closed test starts as early as sub-project 2 and later sub-projects ship as updates (OQ-61).
- **Edge cases:** Opt-outs dropping below 12. An update that breaks testers. A tester without a Google account that can link (REL-02). Decision applied: VD-03 for recruitment and tracking mechanics and what to answer.
- **Android/web differences:** Android only.
- **Offline behavior:** N/A.
- **Security implications:** Testers' emails are kept only in Play Console.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. At least 12 testers stay opted in for 14 continuous days [AC-R1].
  2. Google's post-test questions are answered [§23.8 *Play gate details*].
  3. Production access is granted [AC-R1].
- **Decisions applied:** VD-03 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-03 ✔] Release builds get an EAS-managed build number and a semantic version name, the upload keystore is EAS-managed with Play App Signing, closed testers are added through a Google Group, and the production release is a full rollout.
- **Test requirements:** A weekly check of the opted-in count recorded in the release log.
- **Dependencies:** REL-03.
- **PRD requirement IDs:** G10, RK-06, OQ-61, AC-R1; §23.8 *Play gate details*, *Timeline*.
- **SRS reference:** Play Store gate and timeline L586–591; OQ-61 L709.

---

# V2 — Account deletion

### REL-05 — Account deletion engine
- **Epic:** V2 · **Type:** Architecture · **Size:** XL · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a developer, I want one deletion service that hands off or deletes each vehicle, leaves memberships, records its progress and removes the account last, so that every deletion path (app, web, anonymous) behaves the same and can resume.
- **Business value:** Account deletion is a Play requirement and a privacy promise (PRV-11). Without a server, the device performs the whole deletion, so it must be safe to interrupt and repeat.
- **Scope:** *In:* a deletion plan built for the signed-in user: owned vehicles with other members (each handed to a member or deleted), owned vehicles with no other members (deleted), and memberships on other people's vehicles (left); execution of the plan using the existing rule paths; progress recorded in `users/{uid}.deletion` (`status`, `startedAt`, `handoffs`, `completedSteps`); data deleted first and the Firebase account last; `clearPersistence()` after deletion. *Out:* screens (`REL-06`, `REL-08`, `REL-09`), resume UI (`REL-07`).
- **Preconditions:** `SHR-11`, `SHR-12`, `SHR-13`, `FND-VEH-04` mechanics, `FND-AUTH-08` clearing steps, `FND-DAT-02` (`deletion` field).
- **Functional behavior:**
  1. `buildPlan(uid)` lists, for each owned shared vehicle, the default new owner (the longest-standing member); for each owned vehicle with no other member, "delete"; and each membership to leave.
  2. `execute(plan, choices)` hands off ownership (no acceptance needed), deletes the chosen vehicles' documents (entries, reminders, templates, then the vehicle), leaves the memberships, records each completed step, deletes the user's data and finally the Firebase account.
  3. After completion the local cache is cleared and the session ends.
- **Business rules:** Shared vehicles you own go to a member, with a choice per vehicle; vehicles only you use are deleted; your receipts stay in your Drive (§23.8 *Shared vehicles on account deletion*, OQ-51). The summary pre-selects the longest-standing member as the new owner; the user can pick another member or delete the vehicle; the new owner needs no acceptance (OQ-62). Entries logged on vehicles the user leaves keep the user's name; the user's email is removed from `members` when they leave (OQ-15, OQ-62). Progress is stored on `users/{uid}`; data is deleted first and the Firebase account last (OQ-62). `clearPersistence()` runs after deletion (OQ-62). Account deletion uses only the existing rule paths, with no extra rule (PRD §15.4).
- **Edge cases:** The chosen new owner leaves or is removed during deletion. A vehicle with 500 or more children. Quota exhaustion midway. Pending invites on a handed-off vehicle. Archived vehicles. Receipts: no Drive deletion here, unlike a vehicle delete (OQ-51). Decision applied: VD-04 (what is deleted and in what order), VD-05 (handoff details).
- **Android/web differences:** Same service; web is online-only and has no `clearPersistence`.
- **Offline behavior:** Deletion needs the network because the server must confirm each step; offline behavior is VD-07.
- **Security implications:** Rules still judge every write; the account is removed only after a recent Google re-sign-in, which Firebase requires. The plan and progress hold document ids and counts only.
- **Data/schema impact:** Writes `users/{uid}.deletion`; deletes vehicle subtrees and the user document; changes `ownerId` and `members` on handed-off vehicles.
- **Acceptance criteria:**
  1. For a user who owns one shared and one unshared vehicle and belongs to a third, the plan lists the longest-standing member as the default new owner, "delete" for the unshared vehicle and "leave" for the third [OQ-62].
  2. After execution the unshared vehicle and its subtree are gone, the shared vehicle belongs to the new owner, the user is not in any `members`, and their entries on other vehicles still show their name [OQ-62, OQ-15].
  3. Each completed step appears in `deletion.completedSteps` as it finishes [OQ-62].
  4. The Firebase account is deleted only after all data steps complete [OQ-62].
  5. Receipt files in the user's Drive are untouched [OQ-51].
- **Decisions applied:** VD-04 ◐, VD-05 ◐, VD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-04 ◐] Account deletion runs handoffs, vehicle deletes, membership leaves, invite deletes, the user document and the Firebase account in that order; entries logged on others' vehicles keep the user's name; Drive receipts and backups stay; a local marker stops a restart from recreating the user document.
  2. **D2** [VD-05 ◐] The default new owner is the non-owner member with the earliest `joinedAt` (ties to the smallest uid); if they leave mid-deletion the next one is used; pending invites on a handed-off vehicle are deleted; the archived state is kept; members are not notified.
  3. **D3** [VD-07 ◐] An unfinished deletion shows 'Finish deleting your account' at launch with Continue after re-sign-in and no cancel once confirmed; the recorded steps are `handoffs`, `vehicles`, `memberships`, `invites`, `user` and `account`.
- **Test requirements:** Emulator integration test of the whole sequence with several vehicles, members and failure injection (OQ-37 style); Jest for the plan.
- **Dependencies:** SHR-11, SHR-12, SHR-13, FND-VEH-04, FND-AUTH-08, FND-DAT-02.
- **PRD requirement IDs:** PR-17, PRV-11, FR-OUT-05, FR-VEH-07, OQ-15, OQ-51, OQ-62, L3, L16; AC-R5; §23.8 *Shared vehicles on account deletion*.
- **SRS reference:** Account deletion L593–603; OQ-15 L705; OQ-62 L710; User record L785; Rules L198.

### REL-06 — Delete account in the app
- **Epic:** V2 · **Type:** User-facing · **Size:** L · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a linked user, I want to delete my account from the app after seeing exactly what will happen, so that I can leave and know my data is gone.
- **Business value:** Play requires an in-app deletion path; users must see the consequences first (PRV-11).
- **Scope:** *In:* **Delete account** under the Account area; a summary screen showing what gets deleted, which shared vehicles go to whom (changeable per vehicle, including choosing to delete it), which memberships will be left, and a link to the user's Drive folder; an offer of **Back up / export first**; Google re-sign-in; typing DELETE to confirm; progress and a completion screen. *Out:* the engine (`REL-05`), resume (`REL-07`), anonymous users (`REL-08`), web (`REL-09`).
- **Preconditions:** REL-05, `FND-SHL-02`, `FND-AUTH-03`, `DRV-07`.
- **Functional behavior:**
  1. The user chooses Delete account and sees the summary.
  2. The summary offers **Back up / export first**, which opens Backup & export.
  3. For each shared owned vehicle the new owner is pre-selected and can be changed, or the vehicle can be deleted.
  4. The user signs in with Google again and types DELETE.
  5. Deletion runs with progress, then the session ends.
- **Business rules:** In-app flow "Settings → Account → Delete account"; a summary first with "Back up / export first" offered: what gets deleted, which shared vehicles go to whom (changeable), which memberships you will leave, and a link to your Drive folder; then Google re-sign-in (which Firebase requires) and typing DELETE (§23.8 *In-app deletion flow*, OQ-62).
- **Edge cases:** The user picks a different Google account at re-sign-in. The user backs out before typing DELETE (nothing changes). A vehicle with no other member. Decision applied: VD-06: the entry point (the PRD says Settings → Account, the app also has More → Account), wording, matching rules for DELETE, where the user lands afterwards.
- **Android/web differences:** Android in-app; web uses `REL-09`.
- **Offline behavior:** Needs the network.
- **Security implications:** Re-sign-in and a typed confirmation guard against accidental or unauthorized deletion.
- **Data/schema impact:** Starts the deletion record on `users/{uid}`.
- **Acceptance criteria:**
  1. The summary lists what will be deleted, the handoffs with the longest-standing member pre-selected, the memberships to leave, and a link to the Drive folder [§23.8 *In-app deletion flow*, OQ-62].
  2. The user can change a handoff or choose to delete that vehicle instead [OQ-62].
  3. **Back up / export first** leads to Backup & export [§23.8].
  4. Deletion starts only after Google re-sign-in and typing DELETE [§23.8].
  5. Backing out at any point before confirmation changes nothing [§23.8].
- **Decisions applied:** VD-05 ◐, VD-06 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-05 ◐] The default new owner is the non-owner member with the earliest `joinedAt` (ties to the smallest uid); if they leave mid-deletion the next one is used; pending invites on a handed-off vehicle are deleted; the archived state is kept; members are not notified.
  2. **D2** [VD-06 ◐] The deletion flow starts at More → Account → Delete account; the summary lists the counts and handoffs; DELETE must be typed exactly in capitals; re-sign-in with another Google account shows 'Use <email>'; completion shows 'Your account and data were deleted' and returns to first launch.
- **Test requirements:** RNTL with a fake engine; manual end to end with two accounts.
- **Dependencies:** REL-05, FND-SHL-02, FND-AUTH-03, DRV-07.
- **PRD requirement IDs:** PR-17, PRV-11, FR-OUT-05, OQ-62, AC-R5; §23.8 *In-app deletion flow*.
- **SRS reference:** Account deletion L593–603; OQ-62 L710.

### REL-07 — Resume and recover an interrupted deletion
- **Epic:** V2 · **Type:** User-facing · **Size:** M · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user whose deletion was interrupted, I want it to continue the next time I open the app, so that I am never left half-deleted.
- **Business value:** Deletion runs on the device in many steps; an interruption without resume would leave personal data behind.
- **Scope:** *In:* on launch, detect an in-progress deletion from the recorded progress and resume it; require a fresh Google re-sign-in to resume; clear messages and Retry on failure. *Out:* the first-run flow (`REL-06`).
- **Preconditions:** REL-05, REL-06.
- **Functional behavior:**
  1. After a kill or failure, the next launch recognizes an unfinished deletion.
  2. The app asks the user to sign in with Google again, then continues from the last completed step.
  3. A step that fails shows a message with Retry.
- **Business rules:** Progress is recorded, so an interrupted deletion resumes on next launch; resuming needs a fresh re-sign-in (§23.8 *Resumable*, OQ-62).
- **Edge cases:** The app reinstalled mid-deletion. The user abandons re-sign-in. Quota exhaustion. Decision applied: VD-07: what the app shows meanwhile, whether the user can cancel, how a reinstall finds the record.
- **Android/web differences:** Web resumes when the user opens `/delete-account` again.
- **Offline behavior:** Needs the network; offline shows a waiting state.
- **Security implications:** Resuming requires proof of identity again.
- **Data/schema impact:** Reads and updates `users/{uid}.deletion`.
- **Acceptance criteria:**
  1. Killing the app mid-deletion and relaunching shows that a deletion is in progress and asks for re-sign-in [OQ-62].
  2. After re-sign-in the deletion continues from the last completed step and completes [§23.8 *Resumable*].
  3. A failed step offers Retry and does not repeat completed steps [OQ-62].
- **Decisions applied:** VD-07 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-07 ◐] An unfinished deletion shows 'Finish deleting your account' at launch with Continue after re-sign-in and no cancel once confirmed; the recorded steps are `handoffs`, `vehicles`, `memberships`, `invites`, `user` and `account`.
- **Test requirements:** Integration test killing between steps; manual run.
- **Dependencies:** REL-05, REL-06.
- **PRD requirement IDs:** PR-17, PRV-11, OQ-62, AC-R5; §23.8 *Resumable*.
- **SRS reference:** Account deletion L593–603; OQ-62 L710.

### REL-08 — "Delete all my data" for anonymous users
- **Epic:** V2 · **Type:** User-facing · **Size:** M · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As an anonymous user, I want to delete everything I stored without having to sign in, so that I can leave cleanly.
- **Business value:** Anonymous users hold real data too; Play's deletion requirement covers them.
- **Scope:** *In:* "Delete all my data" for an anonymous user, without re-sign-in, in the app; the same engine; a clear warning that the data cannot be recovered. *Out:* a web route for anonymous users (none exists; anonymous deletion is in-app only).
- **Preconditions:** REL-05, `FND-AUTH-03` (Account screen).
- **Functional behavior:**
  1. An anonymous user opens the Account area and sees "Delete all my data".
  2. After the warning and confirmation, the engine deletes their vehicles and data and ends the account.
- **Business rules:** Anonymous users: "Delete all my data" works without re-sign-in (§23.8 *Anonymous users*). Anonymous users can delete in-app only (OQ-62). The policy does not promise full deletion for documents orphaned by earlier merges (OQ-62, L3).
- **Edge cases:** Documents orphaned by an earlier merge cannot be deleted. Offline. Decision applied: VD-08.
- **Android/web differences:** Android only.
- **Offline behavior:** Needs the network.
- **Security implications:** The anonymous session itself is the authority.
- **Data/schema impact:** Deletes the user's documents and the anonymous account.
- **Acceptance criteria:**
  1. An anonymous user can delete all their data with no Google sign-in [§23.8 *Anonymous users*].
  2. After deletion none of their vehicles or entries remain [PRV-11].
  3. There is no web route for anonymous deletion [OQ-62].
- **Decisions applied:** VD-08 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-08 ◐] 'Delete all my data' for an anonymous user deletes the owned vehicles, the user document and the anonymous account after the stated warning, then restarts at first launch with a new anonymous account and the welcome screen.
- **Test requirements:** RNTL; emulator integration; manual run.
- **Dependencies:** REL-05, FND-AUTH-03.
- **PRD requirement IDs:** PR-17, PRV-11, L3, OQ-62, AC-R5; §23.8 *Anonymous users*.
- **SRS reference:** Account deletion L593–603; OQ-62 L710.

### REL-09 — Web `/delete-account` page
- **Epic:** V2 · **Type:** User-facing · **Size:** M · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user who no longer has the app installed, I want to delete my account from a web page, so that I can leave from anywhere.
- **Business value:** Play also requires a deletion route outside the app (PRV-11).
- **Scope:** *In:* a `/delete-account` route on the web app running the same flow: Google sign-in, the summary, the handoff choices, typing DELETE, progress. *Out:* the engine (`REL-05`).
- **Preconditions:** REL-05, `SHR-02` (Hosting), `FND-AUTH-02`.
- **Functional behavior:** A visitor signs in with Google, sees the same summary and choices as in the app, confirms by typing DELETE, and the engine runs.
- **Business rules:** A `/delete-account` page runs the same flow because Play requires a deletion route outside the app (§23.8 *Web deletion*). Web is online-only and Google-only (FR-WEB-01).
- **Edge cases:** A visitor with no account. An anonymous user (not served here). A deletion started in the app and resumed on web. Decision applied: VD-09.
- **Android/web differences:** Web only.
- **Offline behavior:** Needs the network.
- **Security implications:** Google re-authentication and the typed confirmation apply as in the app.
- **Data/schema impact:** As `REL-05`.
- **Acceptance criteria:**
  1. `https://milevana.poovarasu.dev/delete-account` loads and asks for Google sign-in [§23.8 *Web deployment*].
  2. The signed-in user sees the same summary and handoff choices as in the app [§23.8 *Web deletion*].
  3. Typing DELETE completes the deletion and signs the user out [§23.8].
- **Decisions applied:** VD-06 ◐, VD-09 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-06 ◐] The deletion flow starts at More → Account → Delete account; the summary lists the counts and handoffs; DELETE must be typed exactly in capitals; re-sign-in with another Google account shows 'Use <email>'; completion shows 'Your account and data were deleted' and returns to first launch.
  2. **D2** [VD-09 ◐] `/delete-account` asks a signed-out visitor to sign in, shows 'No Milevana data found for this account' when nothing exists, resumes an unfinished deletion, and tells anonymous users to delete from the app.
- **Test requirements:** Manual run in a browser with a test account; RNTL for the page states.
- **Dependencies:** REL-05, SHR-02, FND-AUTH-02.
- **PRD requirement IDs:** PR-17, PRV-11, FR-WEB-01, OQ-62, AC-R4, AC-R5; §23.8 *Web deletion*.
- **SRS reference:** Account deletion L593–603; Web deploy L617; OQ-62 L710.

---

# V3 — Policies, web and launch polish

### REL-10 — Privacy policy and terms pages
- **Epic:** V3 · **Type:** Content and web · **Size:** M · **Phase:** A (minimal), then C (full) · **Readiness:** Ready: minimal and full drafts are in `docs/policies/`; owner and qualified review are needed before publishing.
- **User story:** As a user and as Google Play, I want a clear privacy policy and short terms at stable addresses, so that I can see what the app collects and how deletion works.
- **Business value:** Play and Google's sign-in review need a privacy policy URL; users need to know what is stored and who can see it.
- **Scope:** *In:* `/privacy` and `/terms` on Firebase Hosting. Stage 1 (before the first closed-test upload): a minimal privacy policy at a live URL. Stage 2 (before production): the full privacy policy and short terms. Content: what is collected (Google name and email, vehicle data, crash diagnostics), how Drive access is used, no ads and no selling, how deletion works, and the Google API "Limited Use" statement. Disclosures: the Crashlytics installation id; that members see each other's names and emails; that a leaver's name stays on entries and that entries logged on others' vehicles keep the user's name after deletion; that a removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground; the camera permission; that receipts live in the user's own Drive. *Out:* the in-app links (`REL-11`).
- **Preconditions:** `SHR-02` (Hosting) or the VD-01 interim; the policy text (VD-10).
- **Functional behavior:**
  1. `/privacy` and `/terms` load over HTTPS without sign-in.
  2. The privacy policy contains each statement listed above that is true of the app at that time.
  3. The deletion section names the in-app route and the `/delete-account` page.
- **Business rules:** Privacy policy and short terms at `/privacy` and `/terms` on Firebase Hosting stating what is collected, how Drive access is used, no ads and no selling, how deletion works, and the Limited Use statement (§23.8 *Policies*, PRV-10). Disclose the Crashlytics installation id (PRV-13, OQ-36), that members see names and emails, that a leaver's name stays on entries and that entries on others' vehicles keep the user's name (PRV-14, OQ-15, OQ-58, OQ-62), and the delayed receipt-access revocation (PRV-15, OQ-56). The policy must not promise full deletion for documents orphaned by account merges (L3, OQ-62). A minimal policy is prepared just before the first closed-test upload (OQ-16).
- **Edge cases:** A statement that becomes untrue when a feature changes. Keeping the stage 1 URL unchanged when stage 2 replaces its content. Decision applied: VD-10 (the text, contact details, retention wording), VD-01 (hosting before tab 6).
- **Android/web differences:** Web pages, linked from Android's About & privacy and Play.
- **Offline behavior:** N/A.
- **Security implications:** The policy must match the app's real behavior and the Play data-safety form (NFR-04, PRV-01 to PRV-05).
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. `/privacy` and `/terms` are served over HTTPS without sign-in [PRV-10, AC-R4].
  2. The privacy policy states what is collected, how Drive is used, no ads and no selling, how deletion works, and includes the Limited Use statement [§23.8 *Policies*].
  3. It discloses the Crashlytics installation id, member name and email visibility, entries keeping a user's name, and delayed receipt revocation [PRV-13, PRV-14, PRV-15].
  4. It does not promise deletion of documents orphaned by merges [L3].
  5. A minimal version is live before the first closed-test upload [OQ-16].
- **Decisions applied:** VD-01 ✔, VD-10 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-01 ✔] `https://milevana.poovarasu.dev` serves the web sign-in with a minimal `/privacy` page right after sub-project 2, before `/join` and the App Links file exist.
  2. **D2** [VD-10 ✔] The privacy policy and terms exist as drafts for the owner's review, naming the individual developer, the `poovarasu.dev` contact mailbox and India as governing law.
- **Test requirements:** A statement-by-statement review against the shipped app; manual load check.
- **Dependencies:** SHR-02 (or the VD-01 interim).
- **PRD requirement IDs:** PRV-10, PRV-13, PRV-14, PRV-15, OQ-15, OQ-16, OQ-36, OQ-56, OQ-58, OQ-62, L3, AC-R4, AC-R5.
- **SRS reference:** Policies and listing L605–610; OQ-16 L706; OQ-57 L708.

### REL-11 — About & privacy in the app
- **Epic:** V3 · **Type:** User-facing · **Size:** S · **Phase:** C · **Readiness:** Ready: decisions applied (see below).
- **User story:** As a user, I want to reach the privacy policy and terms from inside the app, so that I can read them without searching.
- **Business value:** Play and the PRD expect the policy to be linked from the app (PRV-10).
- **Scope:** *In:* More → About & privacy replacing its shell content with links to the privacy policy and terms, and the delete-account entry point reference. *Out:* the policy text (`REL-10`).
- **Preconditions:** REL-10, `FND-SHL-02`.
- **Functional behavior:** The screen opens the policy and terms pages in the browser; it works offline by showing a clear message when the pages cannot load.
- **Business rules:** A privacy policy and terms linked from "About & privacy" (PRV-10); policy content is sub-project 8, the shell was sub-project 1 (PRD §17.2).
- **Edge cases:** Offline. Decision applied: Foundation DR-17 (what else the screen shows, such as the app version).
- **Android/web differences:** Android opens the system browser; web opens the pages.
- **Offline behavior:** The links need the network.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. More → About & privacy links to `/privacy` and `/terms` [PRV-10].
  2. The links open the live pages [AC-R5].
- **Decisions applied:** DR-17 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [DR-17 ◐] With a vehicle selected, Dashboard, History and Reports show a 'Coming soon' placeholder naming the vehicle; the Add button is hidden when no vehicle is selected; Account shows Link Google for an anonymous user, or the name, email and Sign out for a linked user.
- **Test requirements:** RNTL; manual.
- **Dependencies:** REL-10, FND-SHL-02.
- **PRD requirement IDs:** PRV-10, FR-NAV-05, AC-R5; §17.2.
- **SRS reference:** Navigation L259; Policies L605–610.

### REL-12 — Web landing page
- **Epic:** V3 · **Type:** Content and web · **Size:** M · **Phase:** C · **Readiness:** Ready with provisional content (VD-11); final copy and screenshots come from the owner.
- **User story:** As a visitor to `milevana.poovarasu.dev`, I want to see what the app is before I sign in, so that I know what I am signing in to.
- **Business value:** The web root is the first thing a new visitor and a Play reviewer see (§23.8 *Web landing page*).
- **Scope:** *In:* a landing page at the web root, before sign-in, with the supplied content and screenshots; a path from the landing page to sign-in and to the privacy and terms pages. *Out:* writing the content and capturing the screenshots (supplied).
- **Preconditions:** `SHR-02`, `FND-AUTH-02`; content (VD-11).
- **Functional behavior:** An unsigned-in visitor sees the landing page; a way to continue to Google sign-in; a signed-in visitor goes to the app.
- **Business rules:** A landing page with comprehensive content and screenshots at the web root, before sign-in; the content and screenshots are to be supplied (§23.8 *Web landing page*, OQ-61). Web sign-in is Google only (FR-WEB-01).
- **Edge cases:** A signed-in visitor opening the root. Slow connections and screenshot size. Decision applied: VD-11.
- **Android/web differences:** Web only.
- **Offline behavior:** N/A.
- **Security implications:** No sign-in secrets on the page.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The web root shows the landing page to an unsigned-in visitor [§23.8, OQ-61].
  2. It links to Google sign-in, the privacy policy and the terms [§23.8].
  3. A signed-in visitor reaches the app [FR-WEB-01].
- **Decisions applied:** VD-11 ◐. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-11 ◐] The landing page shows the name, the tagline, the v1 feature list, a sign-in button, privacy and terms links and a Play badge placeholder, with placeholder screenshots.
- **Test requirements:** Manual in a browser at 767 px and 768 px.
- **Dependencies:** SHR-02, FND-AUTH-02.
- **PRD requirement IDs:** FR-WEB-01, OQ-61, AC-R4; §23.8 *Web landing page*.
- **SRS reference:** Launch polish L612–619; OQ-61 L709.

### REL-13 — App icon, adaptive icon and splash screen
- **Epic:** V3 · **Type:** Visual assets and configuration · **Size:** S · **Phase:** A · **Readiness:** Ready with an interim generated mark (VD-12); final artwork before production.
- **User story:** As a user, I want the app to have its own icon and a splash screen, so that it looks finished on my phone and in Play.
- **Business value:** Play, the consent screen and the first closed-test build all need an icon.
- **Scope:** *In:* the app icon, the Android adaptive icon (foreground and background) and the splash screen, wired into the build. *Out:* store screenshots and feature graphic (`REL-14`).
- **Preconditions:** `FND-PLT-01`; the assets (VD-12).
- **Functional behavior:** The installed app shows the icon in the launcher, including the adaptive shape; the splash screen shows at launch.
- **Business rules:** App icon, adaptive icon and splash screen are part of launch polish (§23.8 *Launch polish*). Visual style comes from the design reference without adding requirements.
- **Edge cases:** Launcher shapes that crop the icon. Dark mode splash. Decision applied: VD-12.
- **Android/web differences:** Android adaptive icon and splash; web favicon follows the same artwork.
- **Offline behavior:** N/A.
- **Security implications:** None.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The installed app shows the icon in the launcher [§23.8 *Launch polish*].
  2. The adaptive icon renders correctly in round and square launcher shapes [§23.8].
  3. The splash screen appears on launch [§23.8].
- **Decisions applied:** VD-12 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-12 ✔] The first closed-test build contains an interim icon, adaptive icon and splash, and the final artwork replaces them before production.
- **Test requirements:** Manual on two launcher shapes.
- **Dependencies:** FND-PLT-01.
- **PRD requirement IDs:** PR-17, AC-R5; §23.8 *Launch polish*.
- **SRS reference:** Launch polish L612–619.

---

# V4 — Play (full listing)

### REL-14 — Full Play listing and declarations
- **Epic:** V4 · **Type:** Release operations · **Size:** M · **Phase:** C · **Readiness:** Ready once the app is feature-complete; screenshots and final text come from the build; what Play requires is still to be verified (OQ-63).
- **User story:** As the maintainer, I want the final Play listing and data-safety declarations to match the finished app, so that review passes and users see an accurate page.
- **Business value:** A mismatch between the data-safety form, the policy and the app can fail Play review (OQ-63).
- **Scope:** *In:* the final listing: category Auto & Vehicles, audience 18+, phone screenshots, a feature graphic, descriptions; the final data-safety form: account info, app content and crash logs; encrypted in transit; deletable; not shared; no ads; the declarations in OQ-63 (crash logs and the Crashlytics installation id, receipts live in the user's Drive, members' emails, the camera permission); the deletion route (in-app and `/delete-account`). *Out:* the minimal versions (`REL-03`).
- **Preconditions:** REL-03, REL-05 to REL-10, all features built.
- **Functional behavior:** The listing and form are saved and submitted with the production release.
- **Business rules:** Category Auto & Vehicles; audience 18+ keeps the app clear of children's-app policies; phone screenshots and a feature graphic; data-safety form: account info, app content, crash logs; encrypted in transit; deletable; not shared; no ads (§23.8 *Play listing*, *Data-safety form*). Declare crash logs and the Crashlytics installation id, state that receipts live in the user's Drive, and mention members' emails and the camera permission (OQ-63).
- **Edge cases:** Play asks for a declaration the PRD does not list. A feature added after the form was filled. Decision applied: VD-12, VD-10; OQ-63 verification.
- **Android/web differences:** Android only.
- **Offline behavior:** N/A.
- **Security implications:** The declarations must be true of the shipped build.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. The listing has category Auto & Vehicles, audience 18+, phone screenshots and a feature graphic [§23.8 *Play listing*].
  2. The data-safety form lists account info, app content and crash logs, encrypted in transit, deletable, not shared, no ads [§23.8].
  3. The OQ-63 declarations are present and each is true of the build [OQ-63].
  4. The deletion routes are declared [PRV-11].
- **Decisions applied:** VD-10 ✔, VD-12 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-10 ✔] The privacy policy and terms exist as drafts for the owner's review, naming the individual developer, the `poovarasu.dev` contact mailbox and India as governing law.
  2. **D2** [VD-12 ✔] The first closed-test build contains an interim icon, adaptive icon and splash, and the final artwork replaces them before production.
- **Test requirements:** Statement-by-statement review against the release build.
- **Dependencies:** REL-03, REL-05 to REL-10.
- **PRD requirement IDs:** PRV-11, PRV-13, PRV-14, OQ-63, AC-R5; §23.8 *Play listing*, *Data-safety form*.
- **SRS reference:** Policies and listing L605–610; OQ-63 L711.

---

# V5 — Verification and rollout

### REL-15 — Release verification and production rollout
- **Epic:** V5 · **Type:** Verification and release operations · **Size:** L · **Phase:** C · **Readiness:** Ready once REL-05 to REL-14 are done and production access exists: decisions applied (see below).
- **User story:** As the maintainer, I want the whole product proven against the release criteria and then promoted to production, so that what users get is what was tested.
- **Business value:** This is the gate between "all features exist" and "the public can install it" (AC-R2, AC-R3).
- **Scope:** *In:* the full Maestro flows and the manual release checklist across all sub-projects (account-conflict merge, web smoke test, dark mode, font scaling and each sub-project's verification story); account deletion end to end with two accounts (handoff, leave, anonymous, web, resume); checks that the policy, terms, deletion page, landing page and join route are live at `milevana.poovarasu.dev`; the final release-build permission check (no ad SDK, no location, no broad media permission; the camera permission present); a documented weekly Firestore usage check; the promotion from closed testing to production. *Out:* new features.
- **Preconditions:** REL-05 to REL-14; production access (`REL-04`).
- **Functional behavior:** Runnable by someone other than the author; the production promotion happens only after the checks pass.
- **Business rules:** Maestro flows and the manual release checklist pass before each release (AC-R2, TS-06, TS-07). All v1 features are delivered (AC-R3). Web is deployed at `milevana.poovarasu.dev` (AC-R4). Account deletion, privacy policy and terms, Play listing and Google consent screen are complete (AC-R5). Firestore usage is checked weekly in the Firebase console because the free plan has no budget alerts, and any `resource-exhausted` non-fatal in production triggers a usage review (§23.8 *Usage monitoring*, §19.4).
- **Edge cases:** A checklist item failing after production access was granted. A quota event in the first week. Decision applied: VD-03 for rollout choices.
- **Android/web differences:** Maestro on Android; web smoke test and live-route checks.
- **Offline behavior:** The airplane-mode flows are the native offline proof.
- **Security implications:** The final permission and SDK check protects the principles of no ads and no location.
- **Data/schema impact:** None.
- **Acceptance criteria:**
  1. Every sub-project's Definition of Done (sub-projects 1 to 7) is met or deferred in writing by the owner [AC-R3].
  2. The Maestro flows and the manual release checklist pass and are recorded [AC-R2].
  3. `/`, `/privacy`, `/terms`, `/delete-account` and `/join/:code` work at `milevana.poovarasu.dev` [AC-R4].
  4. The release build has no ad SDK, no location or broad media permission, and the camera permission [AC-D19, AC-D20, OQ-54].
  5. Account deletion works end to end in the app, for an anonymous user, and on web [AC-R5].
  6. The weekly usage-check procedure is written down and the first check is recorded [§23.8 *Usage monitoring*].
  7. The build is promoted to production [§23.8 *Release flow*].
- **Decisions applied:** VD-03 ✔. Full wording in `docs/decisions-register.md` (✔ answered by the owner, ◐ assumed).
- **Decision-derived criteria** (added once the decisions were applied; numbered D1, D2 and so on, so the criterion numbers above stay valid):
  1. **D1** [VD-03 ✔] Release builds get an EAS-managed build number and a semantic version name, the upload keystore is EAS-managed with Play App Signing, closed testers are added through a Google Group, and the production release is a full rollout.
- **Test requirements:** This story is the test deliverable.
- **Dependencies:** REL-05 to REL-14; REL-04 (production access).
- **PRD requirement IDs:** PR-17, NFR-06, TS-06, TS-07, RK-15, AC-R2, AC-R3, AC-R4, AC-R5, AC-D19, AC-D20; §19.4.
- **SRS reference:** Testing L309–322; Launch polish L612–619; Error handling L307.

---

# A. Release epics

| Epic | Purpose | Stories |
| --- | --- | --- |
| **V1 Release pipeline and Google setup** | The repeatable build-to-Play path, and the Google consent screen published so testers can link | REL-01, REL-02 |
| **V2 Account deletion** | The deletion engine, the in-app flow, resume, the anonymous path, the web page | REL-05 to REL-09 |
| **V3 Policies, web and launch polish** | Privacy policy and terms, About & privacy, the landing page, icon and splash | REL-10 to REL-13 |
| **V4 Play** | Minimal Play setup before the first closed-test upload, the closed test and production access, the full listing and declarations | REL-03, REL-04, REL-14 |
| **V5 Verification and rollout** | The release-level checks and the production promotion | REL-15 |

**Kind of work.** Software: REL-05 to REL-09, REL-11, and the web parts of REL-10 and REL-12. Operations in external consoles: REL-01, REL-02, REL-03, REL-04, REL-14. Content and assets: REL-10 text, REL-12 content, REL-13. Verification: REL-15.

---

# B. Stories in dependency order

◆ marks a story with an open decision (`VD-nn`, or an earlier `DR-nn`, `SD-nn`) that blocks part of it; section E says which part. **Phase A** runs right after sub-project 2, in parallel with tabs 3 to 7; **Phase C** runs after all features exist.

| Wave | Phase | Story | Title | Size | Needs |
| --- | --- | --- | --- | --- | --- |
| W1 | A | REL-01 ◆ | Release pipeline: EAS Build, Play tracks, signing, no OTA | L | FND-PLT-02, FND-PLT-03 |
| W1 | A | REL-13 ◆ | App icon, adaptive icon, splash screen | S | FND-PLT-01 |
| W2 | A | REL-02 ◆ | Google consent screen and OAuth publishing (G6) | M | FND-PLT-02, REL-13; SHR-02 or VD-01 interim |
| W2 | A | REL-10 ◆ | Privacy policy and terms pages (minimal, then full) | M | SHR-02 or VD-01 interim |
| W3 | A | REL-03 ◆ | Play Console setup and minimal declarations | M | REL-01, REL-02, REL-10, REL-13 |
| W4 | A→C | REL-04 ◆ | Closed test and production access | M | REL-03 |
| W5 | C | REL-05 ◆ | Account deletion engine | XL | SHR-11, SHR-12, SHR-13, FND-VEH-04, FND-AUTH-08, FND-DAT-02 |
| W5 | C | REL-12 ◆ | Web landing page | M | SHR-02, FND-AUTH-02 |
| W6 | C | REL-06 ◆ | Delete account in the app | L | REL-05, FND-SHL-02, FND-AUTH-03, DRV-07 |
| W6 | C | REL-08 ◆ | "Delete all my data" for anonymous users | M | REL-05, FND-AUTH-03 |
| W6 | C | REL-09 ◆ | Web `/delete-account` page | M | REL-05, SHR-02, FND-AUTH-02 |
| W6 | C | REL-11 ◆ | About & privacy in the app | S | REL-10, FND-SHL-02 |
| W7 | C | REL-07 ◆ | Resume an interrupted deletion | M | REL-05, REL-06 |
| W7 | C | REL-14 ◆ | Full Play listing and declarations | M | REL-03, REL-05 to REL-10 |
| W8 | C | REL-15 ◆ | Release verification and production rollout | L | REL-05 to REL-14; REL-04 |

---

# C. Stories that can run in parallel

| Group | Stories | Why they do not collide |
| --- | --- | --- |
| Phase A start | REL-01 ∥ REL-13 | Pipeline versus visual assets |
| Google and policy | REL-02 ∥ REL-10 | Console configuration versus a web page |
| Phase C features | REL-05 ∥ REL-12 | The deletion engine and the landing page are independent |
| Deletion fronts | REL-06 ∥ REL-08 ∥ REL-09 ∥ REL-11 | In-app, anonymous, web and the About link all use the engine in different places |
| Late items | REL-07 ∥ REL-14 | Resume versus the final store content |

**Parallel with other sub-projects.** Phase A (REL-01, REL-02, REL-03, REL-10 minimal, REL-13) and REL-04 run alongside sub-projects 3 to 7. REL-05 can start as soon as sub-project 6's ownership, leave and vehicle-delete behaviors exist, even if sub-project 7 is still running.

**Not parallel:** REL-03 waits on REL-01, REL-02, REL-10 and REL-13. REL-04's 14 days start only after the first closed-test upload. REL-15 is last.

---

# D. Blocking dependencies

**D1. The closed-test clock.** The 14-day gate starts at the first closed-test upload (REL-03). Every day Phase A is delayed after sub-project 2 delays production by a day. The Phase A stories are therefore on the critical path of the whole project even though they sit in the last sub-project.

**D2. Hosting versus the minimal policy URL.** The PRD schedules the Hosting deploy at the start of sub-project 6 (OQ-57) and also requires a minimal privacy policy URL before the first closed-test upload after sub-project 2 (OQ-16), and the consent screen to be published before that upload (OQ-28). These dates conflict; see VD-01.

**D3. External inputs.** DNS control of `poovarasu.dev`; a Play developer account (US$25); Google's review of the consent screen (time not controlled by the project); 15 to 20 testers; the policy text, the landing-page content and screenshots, and the visual assets (VD-10 to VD-12). None can be produced by engineering.

**D4. Deletion depends on sharing.** The PRD says account deletion is "designed with sharing" and relies on ownership transfer. REL-05 needs `SHR-11` to `SHR-13` and the rules behind them. Its decisions VD-04 and VD-05 interact with Sharing's SD-06 and SD-07.

**D5. Production needs everything.** Production release depends on all features (PRD §23.8). REL-14 and REL-15 wait on sub-projects 1 to 7 and on REL-04.

**D6. Rules deployment.** Rules and indexes deploy on tagged releases (OQ-38). Foundation's DR-21 (how rules reach the project before the first tag) must be settled before REL-01 can claim the release path is complete.

**D7. Items outside this backlog.** A custom domain is not bought (OQ-61); iOS and over-the-air updates are not in v1.

---

# E. [DECISION REQUIRED] items

Not resolved here. **Story** = before the named story is accepted · **Input** = needs content, assets or an external answer, not an engineering choice · **Copy** = wording.

| ID | Decision needed | Why the SRS/PRD does not settle it | Stories affected, and what waits | Level |
| --- | --- | --- | --- | --- |
| **VD-01** | **Hosting and the policy URL before tab 6.** Where the minimal privacy policy lives when the first closed-test upload happens after sub-project 2 but Hosting is deployed at the start of sub-project 6; whether Hosting moves earlier or an interim address (such as `milevana.web.app`) is used; whether consent-screen domain verification and gate G6 can run before the domain is live. | OQ-16 requires a minimal policy URL "just before the first closed-test upload"; OQ-28 requires the consent screen published before it; OQ-57 deploys Hosting at the start of sub-project 6. | REL-02, REL-03, REL-10 | Story |
| **VD-02** | **Consent screen specifics.** User type; publishing status; the exact scopes at first publication; whether a Google verification review applies when `drive.file` is added; logo, support email and authorized domains. | The PRD says "the exact requirement is confirmed at the start of this sub-project" and that Google "will likely" want a verified domain. | REL-02 | Input |
| **VD-03** | **Play Console and release process.** Version numbering; Play App Signing enrollment and upload-key handling; how testers are recruited and tracked (an email list or a Google group) and what counts as a reset of the 14 days; what to answer in Google's post-test questions; production rollout (staged or full); release notes; who runs the checklists and what blocks a tag. | §23.8 fixes the tester count, the 14 days, the release flow and the checklists, not these mechanics. | REL-01, REL-03, REL-04, REL-15 | Input / Story |
| **VD-04** | **Deletion scope and order.** Exactly what is deleted and in which order: the user document and its fields, reminders and templates the user created on vehicles they leave, pending invites they created, the mute list, Drive backups (the PRD says receipts stay) and local data; whether `users/{uid}` is deleted before or after the account given that progress is stored there. | OQ-62 says progress is stored on `users/{uid}`, "data is deleted first and the Firebase account last", and that entries keep the user's name. | REL-05 | Story |
| **VD-05** | **Handoff details.** How "longest-standing member" is measured (earliest `joinedAt`, tie rule); what happens if the chosen member leaves before the handoff finishes; whether pending invites on a handed-off vehicle are cancelled; whether handed-off vehicles keep their archived state; whether members are told (there is no push). | OQ-62 fixes the default, the choices and "no acceptance". | REL-05, REL-06 | Story |
| **VD-06** | **In-app deletion flow.** The entry point (the PRD says Settings → Account, while the app has Settings and Account as separate More items); summary layout and wording; what the Drive-folder link does for a user who never granted Drive access; how "Back up / export first" returns to the flow; how DELETE is matched (exact, case, language); re-sign-in with a different Google account; error wording; the completion screen and where the user lands. | §23.8 *In-app deletion flow* names the steps only. | REL-06, REL-09 | Story / Copy |
| **VD-07** | **Resume details.** What the app shows at launch during an unfinished deletion; whether the user can cancel; the step names recorded; how a reinstalled app finds the record; behavior offline and on quota exhaustion; whether other members see partial states. | OQ-62 says progress is recorded, an interrupted deletion resumes on next launch, and resuming needs a fresh re-sign-in. | REL-07 | Story |
| **VD-08** | **Anonymous deletion.** What is deleted (data and the anonymous account); the warning text; the statement about documents orphaned by earlier merges; what the app shows afterwards (a new anonymous account and the welcome screen, or something else). | §23.8 says only that "Delete all my data" works without re-sign-in and OQ-62 that it is in-app only. | REL-08 | Story / Copy |
| **VD-09** | **Web deletion page.** Behavior for a visitor not signed in or with no account; what happens when the user has an unfinished in-app deletion; any instruction for anonymous users, who have no web route; the URL given to Play. | §23.8 says the page "runs the same flow". | REL-09 | Story |
| **VD-10** | **Policy and terms text.** The legal wording of both pages; the identity and contact details of the responsible party; retention and deletion-timing statements; jurisdiction; the 18+ statement; the exact Google "Limited Use" wording; the statement about orphaned documents. | The PRD lists what the pages must state (PRV-10, PRV-13 to PRV-15), not the text. | REL-10, REL-14 | Input |
| **VD-11** | **Landing page content.** Copy, screenshots, structure and links. | The PRD says the content and screenshots "are to be supplied". | REL-12 | Input |
| **VD-12** | **Visual assets.** The icon, adaptive icon layers, splash design, Play phone screenshots, feature graphic and listing descriptions. | §23.8 lists them as launch polish and listing items without supplying them; the design is a visual reference only. | REL-03, REL-13, REL-14 | Input |

**Decisions from earlier sub-projects that carry in:** Foundation DR-16 copy gaps · DR-17 About & privacy content · DR-20 quota threshold (for the weekly usage check) · DR-21 getting rules to the project · Sharing SD-06 and SD-07 (leave, remove and transfer write shapes and wording, which deletion reuses) · SD-08 receipt sync (what happens to a user's receipts for others) · Drive ED-10 cleanup (vehicle delete versus account deletion for receipts).

**Can start before any decision is answered:** REL-01's pipeline (apart from versioning), REL-05's plan-building, the stated parts of REL-06 (summary, DELETE confirmation), REL-11's links, and REL-13's configuration once assets exist.

---

# F. Release Definition of Done

This is the release-level criteria in PRD §25.3, plus what the stated scope adds. The product owner should confirm the additions.

**Release-level criteria (PRD §25.3)**
- [ ] **AC-R1** The Play closed test has run with 12+ testers for 14 days.
- [ ] **AC-R2** Maestro end-to-end flows and the manual release checklist pass before each release.
- [ ] **AC-R3** All v1 features (PRD §5.1) are delivered.
- [ ] **AC-R4** Web is deployed at `milevana.poovarasu.dev`.
- [ ] **AC-R5** Account deletion, privacy policy and terms, Play listing, and Google consent screen are complete.

**Scope delivered (PRD §23.8)**
- [ ] The release path is EAS Build → internal testing → closed testing → production, with updates through Play only and no over-the-air library.
- [ ] Account deletion works in the app (linked users, after Google re-sign-in and typing DELETE), for anonymous users without re-sign-in, and from `/delete-account` on web; shared owned vehicles go to a member (longest-standing pre-selected, changeable) or are deleted; memberships are left; entries keep the user's name; receipts stay in the user's Drive; an interrupted deletion resumes after a fresh re-sign-in; the Firebase account is removed last.
- [ ] `/privacy` and `/terms` are live with the required statements and disclosures, and are linked from About & privacy.
- [ ] The landing page is at the web root; the icon, adaptive icon and splash screen are in the build.
- [ ] The Play listing (category Auto & Vehicles, audience 18+, screenshots, feature graphic) and the data-safety form match the finished app.
- [ ] The consent screen is published with the app name, logo and domain, and a non-test-user account can link Google and grant Drive access.

**Evidence and quality**
- [ ] Gate G6 passed.
- [ ] The release build has no ad SDK, no location or broad media permission, and the camera permission (AC-D19, AC-D20).
- [ ] The weekly Firestore usage check is written down and the first check is recorded.
- [ ] No new product feature was added; all new text goes through i18n (AC-D17).
- [ ] Every `VD-nn` in section E is answered, or the owner has deferred it in writing.

---

# G. Traceability matrix

**G1. Story → PRD requirement → SRS requirement → Criterion.**
The SRS has no IDs, so the SRS column gives the section and line range in `docs/requirements.md`. The last column cites the release-level criterion `AC-R1` to `AC-R5` where one applies, plus the story's own criteria (`#n`).

| Story | PRD requirement | SRS requirement | Criterion |
| --- | --- | --- | --- |
| REL-01 | NFR-01, RK-05, RK-10, OQ-38; §23.8 Release flow, Updates | Launch polish L612–619; OQ-38 L659; Libraries L119–121 | #1–#4; AC-R2 |
| REL-02 | PRV-12, RK-28, OQ-28, OQ-57; G6; §14.8 | Consent screen L610; OQ-28 L707; OQ-57 L708 | #1–#4; AC-R5 |
| REL-03 | NFR-01, RK-05, RK-06, OQ-16, OQ-63; §23.8 Play listing, Data-safety form | Policies and listing L605–610; Play gate L586–591; OQ-16 L706; OQ-63 L711 | #1–#4; AC-R5 |
| REL-04 | G10, RK-06, OQ-61; §23.8 Play gate details, Timeline | Play gate and timeline L586–591; OQ-61 L709 | #1–#3; AC-R1 |
| REL-05 | PR-17, PRV-11, FR-OUT-05, FR-VEH-07, OQ-15, OQ-51, OQ-62, L3, L16 | Account deletion L593–603; OQ-15 L705; OQ-62 L710; L785; L198 | #1–#5; AC-R5 |
| REL-06 | PR-17, PRV-11, FR-OUT-05, OQ-62; §23.8 In-app deletion flow | Account deletion L593–603; OQ-62 L710 | #1–#5; AC-R5 |
| REL-07 | PR-17, PRV-11, OQ-62; §23.8 Resumable | Account deletion L593–603; OQ-62 L710 | #1–#3; AC-R5 |
| REL-08 | PR-17, PRV-11, L3, OQ-62; §23.8 Anonymous users | Account deletion L593–603; OQ-62 L710 | #1–#3; AC-R5 |
| REL-09 | PR-17, PRV-11, FR-WEB-01, OQ-62; §23.8 Web deletion | Account deletion L593–603; Web deploy L617; OQ-62 L710 | #1–#3; AC-R4, AC-R5 |
| REL-10 | PRV-10, PRV-13, PRV-14, PRV-15, OQ-15, OQ-16, OQ-36, OQ-56, OQ-58, OQ-62, L3 | Policies L605–610; OQ-16 L706; OQ-57 L708 | #1–#5; AC-R4, AC-R5 |
| REL-11 | PRV-10, FR-NAV-05; §17.2 | Navigation L259; Policies L605–610 | #1–#2; AC-R5 |
| REL-12 | FR-WEB-01, OQ-61; §23.8 Web landing page | Launch polish L612–619; OQ-61 L709 | #1–#3; AC-R4 |
| REL-13 | PR-17; §23.8 Launch polish | Launch polish L612–619 | #1–#3; AC-R5 |
| REL-14 | PRV-11, PRV-13, PRV-14, OQ-63; §23.8 Play listing, Data-safety form | Policies and listing L605–610; OQ-63 L711 | #1–#4; AC-R5 |
| REL-15 | PR-17, NFR-06, TS-06, TS-07, RK-15; §19.4; AC-D19, AC-D20 | Testing L309–322; Launch polish L612–619; Error handling L307 | #1–#7; AC-R2, AC-R3, AC-R4, AC-R5 |

**G2. §23.8 scope item → covering stories** (proves each item is covered).

| §23.8 scope item | Stories |
| --- | --- |
| Play closed test (12+ testers, 14 days) and production access | REL-03, REL-04 |
| Release flow: EAS Build → internal → closed → production; no OTA | REL-01, REL-15 |
| Account deletion: summary, handoffs, re-sign-in, typing DELETE | REL-05, REL-06 |
| Resumable deletion | REL-05, REL-07 |
| Web `/delete-account` | REL-09 |
| Anonymous "Delete all my data" | REL-08 |
| Privacy policy and terms at `/privacy` and `/terms` | REL-10 |
| Policy linked from About & privacy | REL-11 |
| Play listing and data-safety form | REL-03, REL-14 |
| Google consent screen | REL-02 |
| Web deploy of `/privacy`, `/terms`, `/delete-account`, landing page | REL-09, REL-10, REL-12 |
| Welcome screen on Android | Delivered in Foundation (`FND-SHL-01`) |
| App icon, adaptive icon, splash screen | REL-13 |
| Weekly Firestore usage check | REL-15 |

**G3. Release-level criterion → covering stories.**

| Criterion | Stories |
| --- | --- |
| AC-R1 | REL-04 |
| AC-R2 | REL-01, REL-15 |
| AC-R3 | REL-15 |
| AC-R4 | REL-09, REL-10, REL-12, REL-15 |
| AC-R5 | REL-02, REL-03, REL-05 to REL-11, REL-13, REL-14, REL-15 |
