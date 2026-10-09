# REM-12 — Reminders verification checklist

Manual run record for the checks unit/component/emulator tests cannot drive:
real notification delivery, the Android 13+ permission prompt, mute across
two devices, offline queueing of completion writes. Fill the Result column
per run; link a bug or notes for anything that fails.

**Prerequisites**

- Android dev build installed (`dev.poovarasu.milevana`), Firebase emulator or
  dev project configured via `EXPO_PUBLIC_FIREBASE_*`. Local notifications do
  not need the network; seed reminders ahead of the checks that need data.
- A second test account + second device (or emulator) for the two-user mute
  and propagation checks; add it as a member of the test vehicle via the
  emulator UI (sharing UI lands in tab 6).
- An Android ≤12 device or emulator image for the no-prompt check.

| # | Check | Covers | Result |
|---|-------|--------|--------|
| 1 | Date reminder due in 8 days → lead notification fires at ~9:00 seven days ahead, a second on the due date, one more the day after (inexact — allow a few minutes) | SC-REM12-01, REM-03 #2 | ☐ |
| 2 | Reboot the device, then change the time zone → next app open rebuilds the schedule (verify via a near-term reminder or `adb shell dumpsys notification`) | SC-REM12-01 | ☐ |
| 3 | Fresh install on Android 13+ → no permission prompt at first launch; first reminder save → system prompt appears exactly once | SC-REM08-01 | ☐ |
| 4 | Deny the prompt → reminder still saves and lists; Reminders shows "Notifications are off" with Open settings; dismissing the notice never shows it again; nothing is scheduled | SC-REM08-02, REM-03 edge | ☐ |
| 5 | Android ≤12 → no runtime prompt and no "notifications are off" notice; reminders still scheduled | SC-REM08-02 | ☐ |
| 6 | User A mutes the vehicle on device A → A's phone goes silent for it; user B's device still notifies; A's in-app list and Dashboard card are unaffected | SC-REM12-02, SC-REM09-01/02 | ☐ |
| 7 | Sign out → every scheduled and presented reminder notification is gone (check the notification shade + `dumpsys`) | SC-REM12-03, FR-OUT-05 | ☐ |
| 8 | User B edits a reminder while A's app is closed → A's phone updates the schedule only on next open (L5) | SC-REM12-04 | ☐ |
| 9 | Airplane mode: create/edit/delete a reminder and log a matching entry → writes queue, reminder completes, sync icon shows; after reconnect the server holds them and no Sync issues banner shows | SC-REM05-05, SC-REM06-04 | ☐ |
| 10 | Second member edits and deletes a shared reminder → allowed; non-member cannot read or write (emulator suite covers the rules side) | SC-REM05-05 | ☐ |
| 11 | Snooze on device A → B's devices keep alerting (snooze is device-local); the row shows "Snoozed until <date>" | SC-REM07-02/03 | ☐ |
| 12 | Monthly EMI reminder with an amount → tap the notification → Expense form opens for the reminder's vehicle (even if another was selected), category "Loan EMI", amount pre-filled; dismissing creates nothing; saving logs exactly one expense and rolls the reminder | SC-REM11-01/02 | ☐ |
| 13 | Release build merged manifest has no `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (`npm run check:manifest` re-verifies post-build) | SC-REM03-05, REM-03 #4 | ☐ |
| 14 | Web build: reminders view/edit works, nothing is scheduled, no errors in the console | SC-REM03-05 #5, REM-04 #4 | ☐ |

**Notes**

- The scheduling engine was verified against the fake `NotificationClient`
  (`src/features/__tests__/reminders.test.ts`): lead/due/overdue at 9:00,
  mute + snooze exclusion, the 60/60-day cap, odometer dedupe, sign-out
  clearing and tap routing. The manual rows above cover the OS-level half.
- Notification delivery is intentionally inexact — no exact-alarm permission
  is requested (§23.3).

**Last run**

| Date | Build | Runner | Result | Notes |
|------|-------|--------|--------|-------|
|      |       |        |        |       |
