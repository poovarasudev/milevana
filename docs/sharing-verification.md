# SHR-16 — Sharing verification checklist

Manual run record for the checks Jest/component/emulator tests cannot drive:
the SHR-01 `drive.file` spike, verified App Links on a device, real
two-account share sync, and the multi-account membership flows. Fill the
Result column per run; link a bug or notes for anything that fails.

**Prerequisites**

- Android release/dev build installed (`dev.poovarasu.milevana`); web build
  deployed to `milevana.poovarasu.dev` (or served locally).
- Two test Google accounts (A = owner/uploader, B = member), each signed in
  on a separate device or browser profile.
- Release signing certificate SHA-256 published in
  `/.well-known/assetlinks.json` (see Owner-only items in
  `docs/implementation-status.md`).

## SHR-01 spike result — members' access to each other's receipts under `drive.file`

The implementation assumed **Open in Drive only** (SD-09): other members'
receipts never render in-app; the member gets an "Open in Drive" action once
the uploader's app has granted them Drive read access. This section is where
the two-account spike run records whether that assumption holds; if in-app
viewing turns out to work under `drive.file`, SHR-15's Open-in-Drive rows are
the fallback that is already built.

| # | Check | Covers | Result |
|---|-------|--------|--------|
| S1 | Account A's app creates a Drive permission granting B read access on a receipt file; removing it also succeeds | SC-SHR01-01, PRV-09 | ☐ |
| S2 | Record whether Drive sends B a notification email when the permission is added (expect none — `sendNotificationEmail=false`) | SC-SHR01-01, OQ-56 | ☐ |
| S3 | B's app tries to list/open/download the shared file in-app under `drive.file` ⇒ record what works | SC-SHR01-02 | ☐ |
| S4 | B taps the `https://drive.google.com/file/d/<id>/view` link ⇒ opens in Drive | SC-SHR01-02 | ☐ |
| S5 | Conclusion written here: in-app viewing possible? (implementation assumes **no → Open in Drive only**) | SC-SHR01-02, SD-09 | ☐ |

## Manual checklist

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | `https://milevana.poovarasu.dev` serves the web app over HTTPS; `/.well-known/assetlinks.json` returns the file with `application/json`; Android reports the `/join/*` link verified for `dev.poovarasu.milevana` | SC-SHR02-01/02 | ☐ |
| 2 | Verified invite link on a device with the app → join screen opens with the code | SC-SHR09-01 | ☐ |
| 3 | Same link on a desktop browser → web join page → Google sign-in → vehicle + owner names → Join → vehicle opens; "Get the Android app" shown after joining | SC-SHR09-02, D3 | ☐ |
| 4 | Anonymous owner taps Invite → link flow first; once linked, invite shows `XXXX-XXXX` code + `…/join/<code>` link; share sheet sends both | SC-SHR07-01/02 | ☐ |
| 5 | Typed-code path: More → Join a vehicle → `k7qx m2pa` / `K7QX-M2PA` / plain code all resolve the same invite; preview shows vehicle + owner names | SC-SHR08-01, D1 | ☐ |
| 6 | Anonymous joiner taps Join → link flow (incl. conflict → Move and switch / Switch without moving) → join completes with the Google uid; invite still valid up to the write | SC-SHR08-02, D2 | ☐ |
| 7 | After joining: vehicle in switcher, entries visible, member record has role `member` + Google name + email | SC-SHR08-03 | ☐ |
| 8 | Two devices race one code → only one join succeeds; loser sees "This invite was already used" | SC-SHR04-07 | ☐ |
| 9 | Member logs entries on both devices → History shows "Logged by \<name\>" for each author; a new member appears when the other app next opens | SC-SHR10-03 | ☐ |
| 10 | Member leaves (SD-07 confirmation) → vehicle leaves their switcher, another selected; own member record gone incl. email; name stays on their entries; others unchanged | SC-SHR11-01/03 | ☐ |
| 11 | Owner removes a member (confirmation states the delayed Drive-access behaviour) → member's record gone; on their device: "You no longer have access to this vehicle" and their queued write surfaces in Sync issues | SC-SHR12-01/02, SC-SHR16-02 | ☐ |
| 12 | Owner transfers ownership ("Make \<name\> the owner? You'll become a member.") → `ownerId` and both roles swap in one write; former owner now sees member actions, new owner can invite/remove/archive | SC-SHR13-01 | ☐ |
| 13 | A's receipts auto-share to B when A's app opens/foregrounds — B's Drive gains read access with no notification email; removing B revokes it at A's next run | SC-SHR14-01/02/03 | ☐ |
| 14 | B sees "Shared once \<A\> opens the app" before A's next run, "Open in Drive" after; receipt never renders in-app for B | SC-SHR15-01/02, SD-09 | ☐ |
| 15 | Member L leaves; new member N sees "No longer available" for L's receipts; members who already had access can still open them | SC-SHR15-03 | ☐ |
| 16 | Archive the shared vehicle → hidden for all members; only the owner can unarchive; delete warns with the member count and members' own Drive files stay | SC-SHR16-03 | ☐ |
| 17 | Backup of a shared vehicle lists members by name with no email | SC-SHR16-04 | ☐ |
| 18 | Crash report check: invite codes never appear in reports (`invites/<code>` paths are redacted) | SC-SHR09-03, PRV-13 | ☐ |

## Automated coverage

| Area | Suite | Covers |
|------|-------|--------|
| Invite/membership rules | `firebase/tests/rules.sharing.test.js` (+ `rules.matrix.test.js`) — emulator | SC-SHR04-01..07, SC-SHR05-01..05, SC-SHR16-01 |
| Invite repo + membership ops | `src/data/repos/__tests__/invites.emulator.test.ts` — emulator | SC-SHR06-02, SC-SHR05-01..03 |
| Code module + member sort | `src/domain/__tests__/invites.test.ts` | SC-SHR06-01/03, D1 |
| Feature layer (create/lookup/join/leave/remove/transfer/share) | `src/features/__tests__/invites.test.ts` | SC-SHR06-03, SC-SHR07-01/03/04, SC-SHR08-01/04, D2 |
| Share sync (grants, revoke, throttle, 200-cap, no-email skip, write-gap non-fatal, web-skip, indicator flag) | `src/features/__tests__/receiptShare.test.ts` | SC-SHR14-04/05, D1/D2 |
| Sharing UI (owner block, leave, members list, join screens, member-receipt states) | `src/ui/__tests__/sharing.test.tsx` | SC-SHR07-03/04, SC-SHR08-01/04, SC-SHR10-01/02, SC-SHR11-02/03, SC-SHR12-03, SC-SHR13-02, SC-SHR14-04, SC-SHR15-02 |
| Removed-member notice + reselection | `handleVehicleList` (session.ts) + `accessLost` banner — covered by foundation session tests | SC-SHR12-02, SC-SHR16-02 |
| Report redaction of `invites/<code>` | `reporting.ts` path redaction tests | SC-SHR09-03 |

## Last run

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
|      |       |        |        |       |
