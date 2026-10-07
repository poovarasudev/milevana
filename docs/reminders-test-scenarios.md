# Milevana v1 — Sub-project 3: Reminders — Test Scenarios

**Source:** `docs/reminders-backlog.md` (12 stories) with the decisions applied from `docs/decisions-register.md` · **Date:** 2026-10-07

## How to read this document

- **Nothing new is specified.** Each scenario restates an acceptance criterion (`#n`) or a decision-derived criterion (`Dn`) of a story. The criteria are the derived ones the backlog proposed (the PRD has none for this sub-project).
- **Decisions are applied** from the register (✔ answered by the owner, ◐ assumed).
- **Level:** U Unit · C Component · E Emulator · M Maestro · MAN Manual on a real device. **Priority:** C Critical · H High · M Medium · L Low.
- Times are device local. "Today" in date examples is 7 October 2026. Notifications are inexact, so device checks allow a few minutes' tolerance.

---

### REM-01 — Domain: reminder logic
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM01-01 | Matching | Reminders: service "engine oil", expense category "Insurance", custom "Wash" | 1. Service entry with an engine oil line ⇒ matches the first.<br>2. Insurance expense ⇒ matches the second.<br>3. Other entries and the custom reminder ⇒ no match | U | C | #1 |
| SC-REM01-02 | Matching window and edits | Insurance reminder created 1 Oct | 1. Expense dated 30 Sep ⇒ no match.<br>2. Expense dated 2 Oct ⇒ completes every active Insurance reminder.<br>3. A service entry whose own category is engine oil but with no such line ⇒ no match.<br>4. Edit or delete the completing entry later ⇒ reminder not reopened | U | H | D4 |
| SC-REM01-03 | Roll-forward | Repeating 12 months and 10,000 distance, completing entry 1 Mar at 52,000 | 1. Roll ⇒ due 1 Mar next year and 62,000.<br>2. Add 1 month to 31 Jan ⇒ 28 Feb (29 in a leap year).<br>3. Entry without odometer ⇒ odometer rolls from `lastOdometer`.<br>4. One-off ⇒ done; repeating ⇒ stays active with latest `completedAt` and `completedByEntryId` | U | C | #2, D5 |
| SC-REM01-04 | Prediction | Today 7 Oct; readings 1 Aug 40,000 and 30 Sep 41,800; due odometer 42,500 | 1. Average = 1,800 km ÷ 60 days = 30 km/day ⇒ predicted due date ≈ 23 Oct (700 km ÷ 30 ≈ 23.3 days after 30 Sep).<br>2. Only 5 days between the two readings ⇒ no prediction, shows "due in 700 km".<br>3. A single reading ⇒ "due in N km".<br>4. An `hours` vehicle ⇒ odometer trigger not offered | U | C | #3, #6, D2 |
| SC-REM01-05 | Notification times | Due 20 Nov, lead 7 days, lead distance 500 | 1. Schedule ⇒ lead notification 13 Nov 9:00, due-date 20 Nov 9:00, overdue 21 Nov 9:00, nothing else.<br>2. Odometer reminder predicted within 500 ⇒ 9:00 on that predicted date; with no prediction ⇒ fires when a reading is within 500 | U | C | #4, D3 |
| SC-REM01-06 | Status and ordering | Mixed reminders | 1. Due today ⇒ Due today; due yesterday ⇒ Overdue; odometer at/past due ⇒ Overdue; inside the lead window ⇒ Due soon.<br>2. Order ⇒ overdue first, then soonest due, odometer without prediction after dated | U | H | #5, D1 |

### REM-02 — Spike: quota cost of scheduling
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM02-01 | Count and project | Emulator logging; user with 5 vehicles, 20 reminders each | 1. Measure reads for app-open scheduling, prediction readings, reminder change, entry logged and the Dashboard card ⇒ table.<br>2. Project at 100 and 500 users against 25,000 reads and 10,000 writes ⇒ pass or fail recorded.<br>3. `REM-03` marked accepted before pass ⇒ not allowed | MAN | H | #1, #2, #3, D1 |

### REM-03 — Local notification scheduling service
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM03-01 | Rebuild triggers | Fake scheduler | 1. Open the app ⇒ schedule rebuilt.<br>2. Edit a reminder ⇒ rebuilt.<br>3. Log a matching entry ⇒ rebuilt | U | C | #1 |
| SC-REM03-02 | Mute and snooze | Muted vehicle; snoozed reminder | 1. Scheduled set contains nothing for the muted vehicle or the snoozed reminder until the snooze ends ⇒ true | U | C | #2, D1, D2 |
| SC-REM03-03 | Scope and limits | 80 reminders over archived and active vehicles | 1. Archived vehicles' reminders ⇒ not scheduled.<br>2. Result ⇒ the soonest 60 within the next 60 days | U | H | D4 |
| SC-REM03-04 | Content | Reminder "Insurance renewal" with amount | 1. Notification shows the title and "<vehicle> — Due 12 Nov"; no amount or plate ⇒ true | U | H | D3 |
| SC-REM03-05 | Sign-out, manifest, web | Linked Android user; web build | 1. Sign out ⇒ no scheduled notifications.<br>2. Release manifest ⇒ no exact-alarm permission.<br>3. Web ⇒ nothing scheduled, no error | M | C | #3, #4, #5 |

### REM-05 — Create, edit and delete a reminder
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM05-01 | Subjects and title | Form open | 1. Subject service type "Engine oil" ⇒ title pre-filled; expense category ⇒ pre-filled; custom ⇒ own title.<br>2. Service type "Other" ⇒ typed label becomes the title | C | H | #1, D4 |
| SC-REM05-02 | Triggers | Form open | 1. Save with neither trigger ⇒ blocked.<br>2. Both triggers, each one-off or repeating ⇒ saved.<br>3. Lead days default 7 and lead distance 500, adjustable ⇒ true | C | C | #2, #3, #4 |
| SC-REM05-03 | Validation | Form open | 1. Title 61 chars, 51st reminder, repeat months 121, repeat distance 1,000,000, lead days 366, lead distance 100,000 ⇒ each rejected; boundary values accepted.<br>2. Past due date ⇒ accepted (shows Overdue); due odometer below current ⇒ accepted with a warning.<br>3. Amount on any reminder ⇒ accepted | C | H | D7, D5 |
| SC-REM05-04 | Odometer on `hours`, archived | `hours` vehicle; archived vehicle | 1. `hours` vehicle ⇒ odometer trigger hidden.<br>2. Archived vehicle ⇒ cannot create or edit | C | H | D5, D2, D8 |
| SC-REM05-05 | Members and offline | Two members; airplane mode | 1. Second member edits and deletes ⇒ allowed.<br>2. Create, edit, delete offline on Android ⇒ saved with the sync icon | M | C | #5, #6 |
| SC-REM05-06 | Stored shape and roll fields | Emulator | 1. Reminder document holds Appendix E fields with lowercase ids, `schemaVersion` 1; `subject.category` holds the category name text ⇒ true.<br>2. `reminderRepo` supports create, update and delete here ⇒ true | E | H | D1, D3, D4, D6 |

### REM-04 — Reminders screen
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM04-01 | Entry and list | Seeded reminders | 1. More → Reminders ⇒ list (not "Coming soon").<br>2. Rows show title, due text, status chip, repeat icon in urgency order | C | H | #1, D2, D3 |
| SC-REM04-02 | Quick-add chips | Empty list | 1. Tap "Insurance renewal", "PUC expiry", "Service every 10,000 km / 12 months" ⇒ form pre-filled each time.<br>2. Close without saving ⇒ nothing created | C | H | #2 |
| SC-REM04-03 | No prediction and web | Odometer reminder, no prediction; web ≥768 px | 1. Row shows "Due in 1,200 km".<br>2. Open and edit on web ⇒ works.<br>3. Malformed reminder ⇒ skipped with a "1 reminder couldn't be shown" message | C | H | #3, #4, D1 |

### REM-07 — Mark done and Snooze
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM07-01 | Mark done | One-off and repeating reminders; two members | 1. Mark done on the one-off ⇒ done for every member.<br>2. Mark done on the repeating one ⇒ rolls forward from today and `lastOdometer`, stays active | E | C | #1, D1 |
| SC-REM07-02 | Snooze | Overdue reminder | 1. Options ⇒ tomorrow, in 3 days, next week.<br>2. Choose tomorrow ⇒ ends 9:00 next day; absent from the Dashboard card, silent, listed as "Snoozed until <date>".<br>3. Cancel the snooze ⇒ returns.<br>4. Change the due date during a snooze ⇒ snooze cleared | C | H | #2, #4, D2 |
| SC-REM07-03 | Per user | Two users, same vehicle | 1. User A snoozes ⇒ user B unaffected ⇒ true | MAN | H | #3 |

### REM-06 — Auto-complete and roll-forward
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM06-01 | Service line match | Active "Engine oil" reminder | 1. Save a service entry with an engine oil line ⇒ reminder completes (done, or rolled forward if repeating) | E | C | #1 |
| SC-REM06-02 | Expense match | Active "Insurance" reminder, created 1 Oct | 1. Save an Insurance expense dated 5 Oct ⇒ completes.<br>2. One dated 29 Sep ⇒ does not | E | C | #2, D1 |
| SC-REM06-03 | Repeating, both triggers | 12 months and 10,000 km reminder | 1. Complete with an entry on 1 Mar at 52,000 ⇒ due date and odometer both roll forward; reminder stays active; latest completion recorded; 31 Jan + 1 month clamps to 28 Feb | E | C | #3, D2 |
| SC-REM06-04 | Custom and offline | Custom-title reminder; airplane mode | 1. Any entry ⇒ custom reminder never auto-completes.<br>2. Matching entry saved offline ⇒ reminder update queued with the entry | M | H | #4, #5 |

### REM-08 — Notification permission
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM08-01 | Ask timing | Android 13+ fresh install | 1. Install and open ⇒ no prompt.<br>2. Create the first reminder ⇒ system prompt | MAN | C | #1, #2 |
| SC-REM08-02 | Denied and older Android | Permission denied; Android 12 | 1. Denied ⇒ reminder saved and shown; nothing scheduled; Reminders shows one-time notice "Notifications are off…" with Open settings.<br>2. Android 12 ⇒ no prompt and no notice | MAN | H | #3, D1 |

### REM-09 — Per-vehicle mute
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM09-01 | Toggle | Two members of one vehicle | 1. Both see the mute switch on the vehicle settings sheet (default off).<br>2. Member A turns it on ⇒ vehicle id added to A's own `mutedReminderVehicleIds`; B's notifications unchanged | E | C | #1, #2, D1 |
| SC-REM09-02 | In-app unaffected | Muted vehicle with overdue reminder | 1. List and Dashboard card still show the reminder ⇒ true | C | H | #3 |

### REM-11 — Recurring payment opens a pre-filled expense
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM11-01 | Notification tap | Monthly EMI reminder with amount 12,500 | 1. Tap the notification (even with another vehicle selected) ⇒ Expense form for the reminder's vehicle: category "Loan EMI", amount 12,500, date now.<br>2. No entry exists yet ⇒ true | C | C | #1, D1 |
| SC-REM11-02 | Save and dismiss | Form from the notification | 1. Save ⇒ one expense created and the reminder rolls forward.<br>2. Dismiss ⇒ nothing created | E | C | #2, #3 |

### REM-10 — Dashboard "Upcoming & overdue" card
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM10-01 | Ordering and limit | 5 reminders: 1 overdue, 2 dated, 1 odometer with no prediction, 1 snoozed | 1. Card shows at most 3, overdue first, then soonest due, unpredicted odometer after dated.<br>2. "See all" opens Reminders ⇒ true | C | H | #1, D4 |
| SC-REM10-02 | Stays and states | Overdue reminder; muted vehicle | 1. Overdue stays until done or snoozed; snoozed disappears from the card.<br>2. Muted vehicle ⇒ still shows.<br>3. No reminders ⇒ "No upcoming reminders" and Add reminder shortcut.<br>4. Overdue/Due soon wording matches the status states | C | H | #2, #3, D1, D2, D3 |

### REM-12 — Device verification of notifications
| ID | Scenario | Pre | Steps ⇒ Expected | Level | Pri | Covers |
| --- | --- | --- | --- | --- | --- | --- |
| SC-REM12-01 | Delivery on a real device | Android device, date reminder due in 8 days | 1. Wait ⇒ lead notification at about 9:00 seven days before and another on the due date (inexact).<br>2. Reboot and change time zone ⇒ schedule rebuilt on next open | MAN | C | #1 |
| SC-REM12-02 | Mute across two users | Two devices | 1. A mutes ⇒ A silent; B still notified | MAN | C | #2 |
| SC-REM12-03 | Sign-out and denied permission | Linked user | 1. Sign out ⇒ nothing fires.<br>2. Permission denied ⇒ reminders show in the app, nothing scheduled | MAN | C | #3, #4 |
| SC-REM12-04 | Propagation limit | Two devices | 1. B edits a reminder with A's app closed ⇒ A's phone updates only on next open | MAN | H | #5 |
