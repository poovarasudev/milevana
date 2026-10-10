# CHK-10 — Checklists verification checklist

Manual run record for the checks the Jest, component, rules and emulator
suites cannot drive end to end: two-account permissions, the real offline
run on Android, Drive round-trip of item-tagged photos, and the merge,
backup and delete seams on a live project. Fill the Result column per run;
link a bug or notes for anything that fails.

**Prerequisites**

- Android dev build installed (`dev.poovarasu.milevana`), Firebase project
  configured via `EXPO_PUBLIC_FIREBASE_*` (or the local emulator).
- A second test account added as a member of the test vehicle (for the
  creator-vs-member delete and edit checks).
- Google Drive connected on one device (for the tagged-photo round trip).

## What is already proven by automation

| Behaviour | Covering suite |
|---|---|
| Snapshot `templateName`, item ids/labels/groups/results/notes, `issueCount`, immutability after template edit/delete | `src/domain/__tests__/checklists.test.ts` (19 tests), `src/ui/__tests__/checklists.test.tsx` |
| Starters per vehicle type (car/truck/bus/other → Car pre-trip + Long trip; bike/scooter → Two-wheeler + Long trip), four document items under 'Documents' | `checklists.test.ts` domain + `checklists.test.tsx` (empty-state offers) |
| 20-template cap, copy naming ` (copy)`/` (copy 2)`, fresh item ids, copier as creator, destination-at-20 message | `checklists.test.ts` (domain) + `src/features/__tests__/checklists.test.ts` |
| 50-item cap and 1–60 char labels/groups on write; malformed docs skipped on read | `templateRepo` zod schema via `repos.emulator.test.ts`, `schemas.test.ts` |
| Rules: members read/create/update, creator-or-owner delete, 51st item denied, 50 accepted | `rules.matrix.test.js`, `rules.spike.test.js` (emulator) |
| Unanswered items stored `na` after confirm; answer toggle clears; note >500 rejected | `checklists.test.ts`, `checklists.test.tsx` |
| Saved inspection renders from snapshot; editing recomputes `issueCount` on fixed items | `checklists.test.tsx` |
| Failed-item summary + Create reminder (`?title` → custom subject, no trigger) + Log service (`?notes`) | `checklists.test.tsx`, `ReminderForm` prefill |
| History row: template name, "No issues"/"N issues" badge, odometer; search matches templateName + entry notes, not item notes | `checklists.test.tsx`, `src/domain/__tests__/entries.test.ts` |
| Attachment `itemId` tag write/read, tag edit, per-item photo display | `checklists.test.tsx`, `AttachmentsSection` props in `entry/[type].tsx` |
| Vehicle delete removes `checklistTemplates` (batched cascade) | `repos.emulator.test.ts` (delete removes all children) |
| Merge copies templates; backup/restore round-trips them | `serializer.test.ts`, `backupFile.test.ts`, `restore.test.ts` (emulator + unit) |

**Rules note:** per-item shape validation was intentionally *not* added to
`validTemplate` — validating all 50 slots exceeds Firestore's
1000-expression-per-request budget (the emulator denies legitimate 50-item
writes). Item shape is enforced by the validated `templateRepo` zod schema
on every app write and skipped on read; the rules keep the security
boundary (members only, `createdBy` on create, immutable `createdBy` on
update, creator-or-owner delete, ≤50 items).

## Manual checks

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Save an inspection from a template → edit the template (rename, remove an item) → the saved inspection still shows the original snapshot → delete the template → inspection still renders unchanged | SC-CHK10-01 | ☐ |
| 2 | Vehicle at 20 templates → New checklist shows the limit message; 51st item in the editor is refused; Copy to a vehicle that already has 20 shows 'That vehicle already has 20 checklists.' | SC-CHK10-02 | ☐ |
| 3 | Second member's device: can create, edit and run templates but cannot delete the creator's template ("Only the creator or the owner can delete"); owner's device can delete | SC-CHK10-03 | ☐ |
| 4 | Anonymous account with templates → Google sign-in "Move and switch" → templates appear under the linked account; backup to Drive → delete app data → restore → templates back; delete a vehicle → its templates are gone (server, not just the UI) | SC-CHK10-04 | ☐ |
| 5 | Inspection with photos tagged to items → uploads reach Drive → open the entry on a second device (or after cache clear) → photos come back and each renders under its tagged item; untagged photos show in the Photos row | SC-CHK10-05 | ☐ |
| 6 | Airplane mode: run an inspection start to finish → saves with the sync icon; reconnect → server holds the entry with the full snapshot | SC-CHK06-05 | ☐ |
| 7 | Archived vehicle → Checklists shows the read-only banner; no add/run/copy affordances; picking Inspection in Add shows the archived notice | SC-CHK02-03, SC-CHK06-05 | ☐ |
| 8 | Leave a started run mid-way (back/gesture) → discard confirmation appears; Discard leaves, Keep running stays | SC-CHK06-04 | ☐ |
| 9 | Web build: Checklists list, template editor, inspection run and History badge all work online; offline web banner blocks saves per the existing web behaviour | CHK-02/06/09 web rows | ☐ |

**Notes**

- The 20-per-vehicle cap is app-side only (accepted in the backlog, L17) —
  rules cannot count sibling docs without per-read cost.
- `itemId` is only ever offered on inspection entries; other entry types
  never see the tag picker.
- Em-dashes in accessibility labels are intentional (`Pass — Brakes`).

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
|      |       |        |        |       |
