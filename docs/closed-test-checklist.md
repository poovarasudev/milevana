# Closed test and production access checklist

REL-04: the closed-test run that unlocks production access, and the weekly
tester-count record. All steps are owner-only Play Console operations.

**Prerequisites**

- Internal-testing upload installs cleanly (REL-03 done).
- Google consent screen published and brand-verified (REL-02 done).
- A Google Group of 15–20 invited testers exists (VD-03).

## One-time setup

| # | Step | Covers | Result |
|---|------|--------|--------|
| 1 | Create a **closed track** in Play Console and add the testers Google Group to it. | SC-REL04-01, VD-03 | ☐ |
| 2 | Submit the closed-track release for review and wait for approval. | SC-REL04-01 | ☐ |
| 3 | Send the opt-in link to the testers; keep the join instructions (device + Google account requirements) with the invite. | SC-REL04-01 | ☐ |

## Weekly record — run every week until the gate is met

The gate is **at least 12 opted-in testers for 14 continuous days**
(Google's requirement for production access). Record the console's opted-in
count each week here or in the release log; the console enforces the
14-day window itself.

| Week (date) | Opted-in testers | ≥12? | 14-day window running? | Notes |
|-------------|------------------|------|------------------------|-------|
|             |                  | ☐    | ☐                      |       |
|             |                  | ☐    | ☐                      |       |
|             |                  | ☐    | ☐                      |       |

## After the gate

| # | Step | Covers | Result |
|---|------|--------|--------|
| 1 | Answer Google's post-test questions in the console when they appear. | SC-REL04-02 | ☐ |
| 2 | Apply for **production access**; record the grant date. | SC-REL04-02 | ☐ |
| 3 | Production release is a **full rollout** — no staged percentage (VD-03). Done as part of REL-15 only after every check there passes. | SC-REL15-07 | ☐ |
