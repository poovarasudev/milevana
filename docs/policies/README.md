# Milevana policy drafts

**Status: drafts for owner review.** These are written from the statements the PRD requires (PRV-10, PRV-13, PRV-14, PRV-15, OQ-15, OQ-16, OQ-36, OQ-56, OQ-58, OQ-62, L3, L16) and the decisions in `docs/decisions-register.md`. They are **not legal advice**. Have a qualified person review them, in particular the governing-law and liability wording, before publishing.

| File | Use | When |
| --- | --- | --- |
| `privacy-policy-minimal.md` | The minimal policy for the Play listing, the data-safety form and the Google consent screen | Before the first closed-test upload (`REL-10` stage 1) |
| `privacy-policy-full.md` | The complete policy | Before production (`REL-10` stage 2) |
| `terms.md` | Short terms of use | Before production |

## Before publishing

1. Fill every `[bracketed]` item: effective date, Firestore location (DR-22 is still owed by the owner), and confirm the contact mailbox (`support@poovarasu.dev` is an assumed placeholder; the mailbox must exist, VD-02).
2. Delete the draft banner at the top of each file.
3. Check each statement against the shipped build. A statement that is not true of the build at that time must be removed or reworded (the minimal policy covers only what exists after sub-project 2).
4. Publish as `/privacy` and `/terms` on Firebase Hosting at `milevana.poovarasu.dev` (VD-01 moves the first deploy to right after sub-project 2).
5. Make the Play data-safety form and the consent screen say the same thing as the policy.

## Where each required statement appears

| Required statement | Source | Full policy section |
| --- | --- | --- |
| What is collected: Google name and email, vehicle data, crash diagnostics | PRD §23.8 *Policies*, PRV-10 | 2 |
| How Drive access is used; receipts live in the user's own Drive | PRD §23.8, OQ-63 | 4 |
| Google API "Limited Use" statement | PRD §23.8 | 4 |
| No ads, no selling | PRD §23.8, PRV-01 | 3 |
| Crashlytics installation id; uid not set as the user id; invite paths redacted | PRV-13, OQ-36 | 2 and 6 |
| Members see each other's names and emails; a leaver's name stays on entries | PRV-14, OQ-15, OQ-58 | 5 |
| Entries logged on others' vehicles keep the user's name after deletion | PRV-14, OQ-62, L16 | 7 |
| A removed member keeps Drive access to a receipt until its uploader's app next opens or returns to the foreground | PRV-15, OQ-56, L14 | 5 |
| Camera permission | OQ-63, OQ-54 | 2 |
| How deletion works (in app, web page, anonymous) | PRD §23.8 | 7 |
| Documents orphaned by earlier account moves cannot be deleted; no promise of full deletion for them | OQ-62, L3 | 7 |
| 18+ audience | PRD §23.8 *Play listing* | 9 |
