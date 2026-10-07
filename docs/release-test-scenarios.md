# Milevana v1 — Sub-project 8: Release — Test Scenarios

**Source:** `docs/release-backlog.md` (15 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story. The release-level criteria `AC-R1` to `AC-R5` (PRD §25.3) are cited where a scenario proves one.
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- Many release stories are operations in external consoles, so most scenarios are **checks** (level OPS) with an observable result, not code tests. **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual · OPS Console or process check · CI Workflow check. **Priority:** C Critical · H High · M Medium · L Low.
- Account-deletion scenarios need **two or three test Google accounts**, a shared vehicle and an anonymous install.

---

### REL-01 — Release pipeline
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL01-01 | Tag to internal testing | Secrets configured | 1. Push a release tag ⇒ signed build on the internal testing track with no manual step beyond approval.<br>2. Build number auto-incremented by EAS; version name semantic ⇒ true | CI | C | #1, D2 |
| SC-REL01-02 | Rules, indexes, web | Same tag | 1. Same run deploys rules, indexes and the web build.<br>2. Before the first tag, the runbook's manual deploy of rules and indexes works for development | CI | C | #2, D1 |
| SC-REL01-03 | No OTA, release gate | Dependency tree | 1. No over-the-air update library present.<br>2. Release run blocked until Maestro and manual checklist results are recorded | CI | C | #3, #4 |

### REL-02 — Google consent screen (G6)
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL02-01 | Branding | Domain live; logo supplied | 1. Sign-in consent screen shows Milevana name, logo and domain; contact mailbox on `poovarasu.dev`; brand verification approved before the first closed-test upload | OPS | C | #1, D2 |
| SC-REL02-02 | Non-test-user link | Play-signed build; a Google account not on any test list | 1. Link Google ⇒ succeeds | MAN | C | #2 |
| SC-REL02-03 | Drive scope later | After sub-project 5 | 1. The same account grants `drive.file` ⇒ succeeds | MAN | H | #3 |
| SC-REL02-04 | Registration and timing | Console | 1. Play app-signing SHA-1 and domain registered where required.<br>2. Hosting with the minimal policy was live right after sub-project 2, before `/join` and the App Links file ⇒ true | OPS | H | #4, D1 |

### REL-03 — Play Console setup
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL03-01 | App created | Developer account | 1. App exists with package id `dev.poovarasu.milevana`; only the one-time fee paid ⇒ true | OPS | C | #1, #4 |
| SC-REL03-02 | Minimal declarations | Policy URL live | 1. Minimal privacy URL, data-safety form and listing saved and accepted.<br>2. Interim icon and screenshots from the sub-project 2 build used | OPS | C | #2, D1, D3 |
| SC-REL03-03 | Upload | EAS build | 1. Upload to internal testing and install ⇒ works; signing via Play App Signing with the EAS-managed upload key | OPS | C | #3, D2 |

### REL-04 — Closed test and production access
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL04-01 | Testers | Google Group of 15–20 testers added to the closed track | 1. Weekly check ⇒ at least 12 opted in for 14 continuous days (recorded) | OPS | C | #1, D1 |
| SC-REL04-02 | Questions and access | 14 days completed | 1. Google's post-test questions answered.<br>2. Production access granted | OPS | C | #2, #3 |

### REL-05 — Account deletion engine
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL05-01 | Plan | User owns A (shared, members M1 joined earlier than M2), B (unshared); member of C | 1. Plan ⇒ A: default new owner M1; B: delete; C: leave | E | C | #1, D2 |
| SC-REL05-02 | Execution | Same | 1. Run ⇒ B and subtree gone; A owned by M1; user not in any `members`; entries on C keep the user's name.<br>2. Pending invites on A deleted; A keeps its archived state; members not notified.<br>3. If M1 leaves mid-deletion ⇒ next longest-standing member used (ties to smallest uid) | E | C | #2, D2 |
| SC-REL05-03 | Progress and order | Failure injection | 1. Each step recorded in `completedSteps` as it finishes: `handoffs`, `vehicles`, `memberships`, `invites`, `user`, `account`.<br>2. Account deleted only after all data steps.<br>3. After the user document is deleted a local marker prevents a restart from recreating it | E | C | #3, #4, D1, D3 |
| SC-REL05-04 | Drive untouched | User with receipts and backups in Drive | 1. After deletion ⇒ receipt files and backups still in the user's Drive | MAN | C | #5, D1 |

### REL-06 — Delete account in the app
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL06-01 | Summary | Same user as REL-05 | 1. More → Account → Delete account ⇒ summary: counts of vehicles to delete, handoffs with names, memberships to leave, Drive folder link (hidden if Drive never granted) | C | C | #1, D2 |
| SC-REL06-02 | Change handoff | Summary | 1. Pick another member or delete that vehicle instead ⇒ reflected | C | H | #2, D1 |
| SC-REL06-03 | Back up first | Summary | 1. "Back up / export first" ⇒ opens Backup & export; Back returns to the summary | C | H | #3, D2 |
| SC-REL06-04 | Confirm | Summary | 1. Deletion starts only after Google re-sign-in and DELETE typed exactly in capitals ('delete' rejected).<br>2. Re-sign-in with another Google account ⇒ "Use <email>" | C | C | #4, D2 |
| SC-REL06-05 | Back out and finish | Flow | 1. Back out at any point before confirmation ⇒ nothing changes.<br>2. Completion ⇒ "Your account and data were deleted" and the app returns to first launch | MAN | C | #5, D2 |

### REL-07 — Resume an interrupted deletion
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL07-01 | Kill and relaunch | Deletion between steps | 1. Relaunch ⇒ "Finish deleting your account" with Continue; no cancel once confirmed | MAN | C | #1, D1 |
| SC-REL07-02 | Continue | Same | 1. Re-sign-in ⇒ resumes from the last completed step and completes | MAN | C | #2 |
| SC-REL07-03 | Failure, offline, reinstall | Failure injection; airplane mode | 1. Failed step ⇒ message with Retry; completed steps not repeated.<br>2. Offline ⇒ waiting state; quota ⇒ "Sync paused", resumes later.<br>3. Reinstall then sign in ⇒ record found while `users/{uid}` still exists | E | H | #3, D1 |

### REL-08 — "Delete all my data" for anonymous users
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL08-01 | Delete without sign-in | Anonymous user with data | 1. Account → Delete all my data ⇒ warning "This permanently deletes everything in this account…"; confirm ⇒ no Google sign-in asked | M | C | #1, D1 |
| SC-REL08-02 | Result | After deletion | 1. No vehicles or entries remain; the app restarts at first launch with a new anonymous account and the welcome screen | M | C | #2, D1 |
| SC-REL08-03 | No web route | Browser | 1. `/delete-account` offers anonymous users no deletion, only the instruction to delete from the app ⇒ true | MAN | M | #3 |

### REL-09 — Web `/delete-account`
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL09-01 | Page and sign-in | Signed-out browser | 1. `https://milevana.poovarasu.dev/delete-account` ⇒ asks for Google sign-in | MAN | C | #1, D2 |
| SC-REL09-02 | Same flow | Signed in as the REL-05 user | 1. Same summary and handoff choices as in the app | MAN | C | #2, D1 |
| SC-REL09-03 | Confirm and edge states | Page | 1. Typing DELETE completes and signs the user out.<br>2. Account with no user document ⇒ "No Milevana data found for this account".<br>3. Unfinished in-app deletion ⇒ resumes after sign-in | MAN | C | #3, D2 |

### REL-10 — Privacy policy and terms pages
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL10-01 | Served | Hosting deployed | 1. `/privacy` and `/terms` load over HTTPS with no sign-in; minimal version live before the first closed-test upload | MAN | C | #1, #5, D1 |
| SC-REL10-02 | Required statements | Drafts in `docs/policies/` | 1. Collected data, Drive use, no ads and no selling, how deletion works, and the Limited Use statement are present.<br>2. Disclosures present: Crashlytics installation id, member names and emails, entries keep a user's name, delayed receipt revocation | MAN | C | #2, #3 |
| SC-REL10-03 | Honesty and owner details | Drafts | 1. No promise to delete documents orphaned by account moves.<br>2. Names the individual developer, the `poovarasu.dev` mailbox and India as governing law; reviewed by the owner and a qualified person | MAN | C | #4, D2 |

### REL-11 — About & privacy in the app
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL11-01 | Links | Release build | 1. More → About & privacy shows app name, version and links to `/privacy` and `/terms`.<br>2. Both open the live pages; offline shows a clear message | C | H | #1, #2, D1 |

### REL-12 — Web landing page
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL12-01 | Landing for visitors | Signed-out browser, widths 767 and 768 px | 1. Root shows name, tagline "Free. No ads. Your data stays yours.", v1 feature list, sign-in button, privacy and terms links, Play badge placeholder, placeholder screenshots | MAN | H | #1, #2, D1 |
| SC-REL12-02 | Signed-in visitor | Signed-in browser | 1. Opening the root goes to the app | MAN | H | #3 |

### REL-13 — App icon, adaptive icon and splash
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL13-01 | Launcher | Installed build | 1. Icon shows in the launcher.<br>2. Adaptive icon renders in round and square shapes | MAN | H | #1, #2 |
| SC-REL13-02 | Splash and artwork | Fresh launch | 1. Splash appears on launch.<br>2. First closed-test build uses the interim mark; final artwork replaces it before production | MAN | M | #3, D1 |

### REL-14 — Full Play listing and declarations
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL14-01 | Listing | Feature-complete build | 1. Category Auto & Vehicles, audience 18+, phone screenshots and feature graphic present; descriptions drafted from the PRD and reviewed | OPS | C | #1, D2 |
| SC-REL14-02 | Data-safety form | Console | 1. Lists account info, app content and crash logs; encrypted in transit; deletable; not shared; no ads | OPS | C | #2 |
| SC-REL14-03 | Declarations | Console | 1. Crash logs and the Crashlytics installation id, receipts in the user's Drive, members' emails and the camera permission declared and each true of the build.<br>2. Deletion routes declared; policy text final | OPS | C | #3, #4, D1 |

### REL-15 — Release verification and production rollout
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REL15-01 | Feature-complete | Definitions of Done of sub-projects 1–7 | 1. Each met or deferred in writing by the owner (AC-R3) | OPS | C | #1 |
| SC-REL15-02 | Full checks | Release candidate | 1. Maestro flows and the whole manual checklist pass and are recorded (AC-R2) | M | C | #2 |
| SC-REL15-03 | Live routes | Production Hosting | 1. `/`, `/privacy`, `/terms`, `/delete-account` and `/join/:code` work at `milevana.poovarasu.dev` (AC-R4) | MAN | C | #3 |
| SC-REL15-04 | Build hygiene | Release build | 1. No ad SDK, no location or broad media permission; camera present | CI | C | #4 |
| SC-REL15-05 | Deletion end to end | Two accounts, anonymous install, browser | 1. Linked in app, anonymous, and web deletions each work, with handoff, leave, resume (AC-R5) | MAN | C | #5 |
| SC-REL15-06 | Usage check | Firebase console | 1. Weekly Firestore usage check procedure written; first check recorded | OPS | H | #6 |
| SC-REL15-07 | Promotion | All above passed; production access exists | 1. Promote to production as a full rollout (VD-03) ⇒ live | OPS | C | #7, D1 |
