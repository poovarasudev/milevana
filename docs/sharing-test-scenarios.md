# Milevana v1 — Sub-project 6: Sharing — Test Scenarios

**Source:** `docs/sharing-backlog.md` (16 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story; the criteria are the derived ones the backlog proposed.
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- **Level:** U Unit · C Component · E Emulator (rules tests with `@firebase/rules-unit-testing`, or repository tests) · M Maestro · MAN Manual with two or three test Google accounts. **Priority:** C Critical · H High · M Medium · L Low.
- **Identities in rules scenarios:** *Owner*, *Member* (non-owner), *Non-member*, *Anonymous*, *Unauthenticated*. Rules scenarios run on every push; a recorded production run is also required (SHR-04, SHR-05).
- Rules tests need a multi-member vehicle, created with security rules disabled in test setup.

---

### SHR-01 — Spike: members' access to receipts under `drive.file`
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR01-01 | Grant and revoke | Two test accounts, a file created by the app | 1. Uploader's app adds read permission for account B ⇒ succeeds; removes it ⇒ succeeds; Drive's notification-email behavior recorded | MAN | C | #1, #3 |
| SC-SHR01-02 | Member's app access | Account B's app | 1. Try to list, open, download the shared file in-app ⇒ result recorded.<br>2. Open in Drive link works for B ⇒ recorded.<br>3. Conclusion: in-app viewing or Open in Drive only | MAN | C | #2 |

### SHR-02 — Hosting, domain and Android App Links
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR02-01 | Domain and route | DNS records added | 1. `https://milevana.poovarasu.dev` ⇒ serves the web sign-in over HTTPS.<br>2. `/join/ABCD1234` ⇒ loads the join route.<br>3. `milevana.web.app` also works | MAN | C | #1, #2 |
| SC-SHR02-02 | App Links and sign-in | Android device with the app | 1. Verification file served ⇒ Android reports the link verified for `dev.poovarasu.milevana`.<br>2. Web Google sign-in works on the domain ⇒ true | MAN | C | #3, #4 |

### SHR-03 — Spike: quota budget for sharing
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR03-01 | Count and project | Emulator logging; a user in 10 shared vehicles with many receipts | 1. Measure the app-open share check, invite create/read/cancel, join, membership changes ⇒ table.<br>2. Project at 100 and 500 users against 25,000 reads and 10,000 writes ⇒ pass or fail.<br>3. Check the share check runs at most once per 15 minutes per vehicle and handles 200 receipts per run ⇒ bounded.<br>4. Web does not run the share check ⇒ true.<br>5. `SHR-14` accepted before pass ⇒ not allowed | MAN | H | #1, #2, #3, D1, D2 |

### SHR-04 — Rules: invites and self-join
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR04-01 | Create and cancel | Owner, member, non-member | 1. Owner creates an invite with Appendix E fields and `expiresAt` 7 days after `createdAt` ⇒ allowed.<br>2. Member or non-member creates ⇒ denied.<br>3. Overwriting an existing code ⇒ denied; owner deletes (cancel) ⇒ allowed | E | C | #1, D2 |
| SC-SHR04-02 | Read rules | Invite exists | 1. Signed-in user, anonymous included, `get` by exact code ⇒ allowed.<br>2. List all invites ⇒ denied; owner's query by `ownerId` ⇒ allowed | E | C | D1 |
| SC-SHR04-03 | Valid join | Valid unused invite; vehicle with 3 members | 1. Non-anonymous user adds themselves with role `member`, name, email, `joinedAt`, `inviteCode` and the same write sets `usedBy`, `usedAt` ⇒ allowed.<br>2. Same write without marking the invite ⇒ denied | E | C | #2, D3 |
| SC-SHR04-04 | Invalid joins | Used, expired, other-vehicle, cancelled invites; anonymous joiner; archived vehicle | 1. Each ⇒ denied.<br>2. A join that also changes another vehicle field ⇒ denied.<br>3. Joining as another uid ⇒ denied | E | C | #3, #5, D3 |
| SC-SHR04-05 | Member limit | Vehicle with 9, then 10 members | 1. 10th member ⇒ allowed; 11th ⇒ denied | E | C | #4 |
| SC-SHR04-06 | Replace Foundation tests | Foundation default-deny suite | 1. The "denied" tests for invites and self-join are replaced by conditional ones; each path has adversarial tests; production run recorded | CI | C | #6 |
| SC-SHR04-07 | Race | Two users, one code | 1. Both try at once ⇒ only one succeeds | E | H | #3 |

### SHR-05 — Rules: leave, remove, transfer, receipt-sharing
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR05-01 | Leave | Owner + 2 members | 1. Member removes only own uid from `memberIds` and `members` ⇒ allowed.<br>2. Member removes another uid ⇒ denied; removes self and adds someone ⇒ denied | E | C | #1, D2 |
| SC-SHR05-02 | Remove | Owner + 2 members | 1. Owner removes another member ⇒ allowed; non-owner ⇒ denied.<br>2. Owner removes self ⇒ denied | E | C | #2, #4, D2 |
| SC-SHR05-03 | Transfer | Owner + member | 1. Set `ownerId` to the member and swap roles in the same write ⇒ allowed.<br>2. To a non-member, or without the role swap ⇒ denied | E | C | #3, D2 |
| SC-SHR05-04 | Receipt sharing | Entry created by member A | 1. `sharedWithUids` update by A or the owner ⇒ allowed.<br>2. By a member who is neither ⇒ denied | E | C | #5 |
| SC-SHR05-05 | Replace Foundation tests | Foundation suite | 1. The denied tests for leave and transfer become conditional; owner changes to the three fields were denied in Foundation and are now allowed only on these paths ⇒ true | CI | C | #6, D1 |
| SC-SHR05-06 | Copy and wording | Confirmation screens | 1. Leave, remove, transfer confirmations show the stated texts; remove includes the delayed receipt-access statement; re-invited member regains edit rights on own entries; leaver's reminders and templates stay | C | M | D3 |

### SHR-06 — Invite and membership repositories
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR06-01 | Code module | Pure module | 1. Generated code has 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, displays XXXX-XXXX.<br>2. 'k7qx m2pa', 'K7QX-M2PA' and 'K7QXM2PA' resolve the same invite.<br>3. Forced collision ⇒ regenerated up to 5 times | U | C | #1, #2, D1 |
| SC-SHR06-02 | Join and membership ops | Emulator with rules | 1. `joinVehicle` succeeds once and fails the second time.<br>2. Leave, remove, transfer succeed for allowed roles and fail otherwise | E | C | #3, #4, D2 |
| SC-SHR06-03 | Validity helper and limits | Invites of every state | 1. Helper returns valid, used, expired or full correctly.<br>2. A sixth pending invite for a vehicle is refused | U | H | #5, D3 |

### SHR-07 — Invite a member
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR07-01 | Anonymous owner | Anonymous user with a vehicle | 1. Tap Invite ⇒ linking flow first | M | H | #1 |
| SC-SHR07-02 | Create and share | Linked owner | 1. Invite on the vehicle's row in More → Vehicles ⇒ shows a code like K7QX-M2PA and a link `…/join/K7QXM2PA`.<br>2. Share sheet sends both | MAN | C | #2, #3, D1 |
| SC-SHR07-03 | Pending list | Owner with 5 pending, an expired one, and a vehicle at 10 members | 1. Pending list shows expiry; cancel deletes the invite.<br>2. A sixth pending ⇒ refused; at 10 members Invite disabled with a message.<br>3. Expired shows 'Expired' and can be deleted | C | H | #4, D2 |
| SC-SHR07-04 | Non-owner and web | A member; web owner | 1. A non-owner ⇒ no Invite action.<br>2. Web ⇒ copy-link button plus browser share | C | H | #5, D3 |

### SHR-08 — Join a vehicle by code
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR08-01 | Entry and preview | Valid code | 1. More → Join a vehicle ⇒ code field (not "Coming soon").<br>2. Enter the code ⇒ vehicle name and owner name shown, readable even by an anonymous user | C | C | #1, #2, D1 |
| SC-SHR08-02 | Anonymous joiner | Anonymous user; Google account that already has data | 1. Join ⇒ linking first.<br>2. Conflict resolved by Move and switch or Switch without moving ⇒ the pending join completes with the Google uid and the invite is still valid | M | C | #3, D3 |
| SC-SHR08-03 | After joining | Linked user | 1. Join ⇒ vehicle in the switcher and entries visible; member record has role `member`, Google name and email | MAN | C | #4, D2 |
| SC-SHR08-04 | Error states | Expired, used, invalid, full invites; archived vehicle; deleted vehicle; offline | 1. Each shows a distinct message and joins nothing; deleted vehicle ⇒ "This vehicle no longer exists".<br>2. Offline ⇒ Join disabled | C | H | #5, D2 |

### SHR-09 — Invite links and the web join page
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR09-01 | App installed | Verified link | 1. Tap the link ⇒ app opens on the join screen with the code (plain uppercase) filled in | MAN | C | #1, D1 |
| SC-SHR09-02 | No app, web | Desktop browser | 1. Open the link ⇒ web join page; sign in with Google first ⇒ vehicle and owner names and Join.<br>2. Join ⇒ vehicle opens in the web app with a "Get the Android app" link | MAN | C | #2, #3, D3 |
| SC-SHR09-03 | Conflict and privacy | Phone opened from a web link with an account that has data; crash report | 1. The code survives the link flow and the join completes.<br>2. The code never appears in crash reports | MAN | H | #4, D2 |

### SHR-10 — Shared-vehicle visibility and members list
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR10-01 | Icon and count | Vehicle with 3 members; one with 1 | 1. People icon and count 3 in the switcher and the Vehicles row; none for 1 member | C | H | #1, D1 |
| SC-SHR10-02 | Members list | Vehicle with owner and 2 members | 1. Owner first, then by join date; name, email, role, join date; owner marked | C | H | #2, D1 |
| SC-SHR10-03 | Logged by, propagation | Two devices | 1. History rows show who logged each entry.<br>2. A new member appears on the other device when its app next opens or while its listener runs | MAN | H | #3, #4 |

### SHR-11 — Leave a vehicle
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR11-01 | Leave | Member of a shared vehicle | 1. Leave and confirm ⇒ vehicle leaves the switcher, another selected.<br>2. Own record removed incl. email; name stays on entries "Logged by <name>"; other members unchanged | MAN | C | #1, #2, #4, D1 |
| SC-SHR11-02 | Owner | Owner opens the menu | 1. No Leave; told to transfer ownership or delete ⇒ true | C | H | #3 |
| SC-SHR11-03 | Wording and rejoin | Confirmation; re-invited member | 1. Text "Leave <vehicle>? You'll lose access. Your past entries stay, labelled with your name."<br>2. Re-invited member edits entries whose `createdBy` is theirs | C | M | D2 |

### SHR-12 — Remove a member
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR12-01 | Remove | Owner + member | 1. Owner removes the member ⇒ record gone; confirmation states the removed member keeps Drive access to receipts until the uploader's app next opens or returns to the foreground | MAN | C | #1, #2, D1, D2 |
| SC-SHR12-02 | Removed member's device | Removed member's phone | 1. Next sync ⇒ "You no longer have access to this vehicle" and the app switches vehicle.<br>2. Their queued write ⇒ Sync issues | MAN | C | #3 |
| SC-SHR12-03 | Non-owner | A member | 1. No Remove action ⇒ true | C | H | #4 |

### SHR-13 — Transfer ownership
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR13-01 | Transfer | Owner + member | 1. Owner chooses the member, confirms "Make <name> the owner? You'll become a member." ⇒ `ownerId` and roles swapped in one write.<br>2. Former owner has member rights; new owner can invite, remove, archive, delete | MAN | C | #1, #2, D1, D2 |
| SC-SHR13-02 | Non-member and no acceptance | Vehicle with no other member | 1. No transfer possible; no acceptance step for the new owner ⇒ true | C | H | #3, D1 |

### SHR-14 — Receipt sharing sync
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR14-01 | Grant | Shared vehicle, uploader A, member B | 1. A's app opens ⇒ B gets reader access to A's receipts; no notification email; `sharedWithUids` lists B | MAN | C | #1, #4, D1 |
| SC-SHR14-02 | New member | B joins after A uploaded | 1. At A's next open ⇒ B gains access | MAN | C | #2 |
| SC-SHR14-03 | Revocation | B removed | 1. At A's next open or foreground return ⇒ B's access removed (found from the file's permission list) | MAN | C | #3 |
| SC-SHR14-04 | Pending state | Before A opens the app | 1. B sees "Shared once <A> opens the app" per attachment ⇒ true | C | H | #5 |
| SC-SHR14-05 | Limits | Fake Drive and clock | 1. At most once per 15 minutes per vehicle; 200 receipts per run, rest next run.<br>2. Member with no email skipped.<br>3. Uploader who is neither creator nor owner ⇒ Drive access changes but one non-fatal logged and `sharedWithUids` not updated.<br>4. Drive failure ⇒ retried next run; indicator "Sharing receipts…" shown.<br>5. Web ⇒ does not run the sync | U | H | D1, D2 |

### SHR-15 — View other members' receipts
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR15-01 | Open a shared receipt | Receipt shared with B | 1. B taps ⇒ "Open in Drive" opens it (or in-app viewing if SHR-01 proved it) | MAN | C | #1, D1 |
| SC-SHR15-02 | Unshared | Not yet shared | 1. Shows "Shared once <name> opens the app" per attachment | C | H | #2, D1 |
| SC-SHR15-03 | From someone who left | Member L left; member N joined later | 1. N sees "No longer available" for L's receipts; members who had access still open them | MAN | H | #3, D1 |

### SHR-16 — Sharing verification
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-SHR16-01 | Adversarial suite | Rules suite | 1. Invites, join, leave, remove, transfer and `sharedWithUids` each have their own adversarial tests and all pass; production run recorded | E | C | #1 |
| SC-SHR16-02 | Removal experience | Two devices | 1. Removed member sees "You no longer have access to this vehicle"; queued write shows in Sync issues | MAN | C | #2 |
| SC-SHR16-03 | Archive and delete | Shared vehicle | 1. Owner archives ⇒ hidden for all, only the owner can unarchive.<br>2. Delete ⇒ warns with the member count; members' own Drive files stay | MAN | C | #3, #4 |
| SC-SHR16-04 | Backup | Shared owned vehicle | 1. Backup lists members by name, no email ⇒ true | MAN | H | #5 |
