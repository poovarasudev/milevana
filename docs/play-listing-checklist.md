# Play listing and declarations checklist

Manual checklist for the Play Console work in REL-03 (minimal setup) and
REL-14 (full listing and declarations). Console work is owner-only; this
document is the exact step list so each box can be checked against the build.

**Prerequisites**

- Play Developer account, app created with the permanent package id
  `dev.poovarasu.milevana` (RK-05 — it cannot change after the first release).
- Policy pages live at `https://milevana.poovarasu.dev/privacy` and `/terms`
  (REL-10), and `https://milevana.poovarasu.dev/delete-account` serves the
  deletion page (REL-09).
- A signed AAB from `eas build --profile production` (REL-01).

## REL-03 — Minimal setup (before the first closed-test upload)

| # | Step | Covers | Result |
|---|------|--------|--------|
| 1 | Create the app in Play Console, package `dev.poovarasu.milevana`, free app. Pay the one-time developer fee only. | SC-REL03-01 | ☐ |
| 2 | Set the privacy policy URL to `https://milevana.poovarasu.dev/privacy`. | SC-REL03-02 | ☐ |
| 3 | Fill the data-safety form minimally: collects account info (name, email), app content; encrypted in transit; data deletable (in-app + web request); nothing shared; no ads. | SC-REL03-02 | ☐ |
| 4 | Draft listing with the interim icon (`assets/images/icon.png`) and screenshots from the sub-project 2 build. | SC-REL03-02, VD-12 | ☐ |
| 5 | Enroll in Play App Signing; let EAS manage the upload key. | SC-REL03-03, VD-03 | ☐ |
| 6 | Register the app-signing SHA-1 and `milevana.poovarasu.dev` wherever Google requires them (OAuth client, Play linking). | SC-REL02-04 | ☐ |
| 7 | Upload the AAB to the **internal testing** track and install it on a device via the internal link. | SC-REL03-03 | ☐ |

## REL-14 — Full listing and declarations (with the production release)

| # | Step | Covers | Result |
|---|------|--------|--------|
| 1 | Category **Auto & Vehicles**; target audience and content: **18+** (keeps the app clear of children's-app policies). | SC-REL14-01 | ☐ |
| 2 | Phone screenshots (real, current build) and a feature graphic uploaded; short and full descriptions drafted from the PRD and reviewed. | SC-REL14-01 | ☐ |
| 3 | Replace the interim icon/adaptive icon/splash with final artwork **before production** (VD-12). | SC-REL14-01, SC-REL13-02 | ☐ |
| 4 | Data-safety form: account info (name, email — for account), app content (vehicle records, receipts), crash logs (Crashlytics); **encrypted in transit**; **deletable** (in-app + `/delete-account`); **not shared** with third parties; **no ads**. | SC-REL14-02 | ☐ |
| 5 | Declare: crash logs and the **Crashlytics installation id**; receipts live in the **user's own Google Drive** (`drive.file`); shared-vehicle **members' emails** are collected and visible to members; the **camera permission** (receipt photos). Each statement must be true of the release build. | SC-REL14-03, OQ-63 | ☐ |
| 6 | Declare the account-deletion routes Play asks for: **in-app** (More → Account → Delete account) and **web** (`https://milevana.poovarasu.dev/delete-account`). | SC-REL14-03, PRV-11 | ☐ |
| 7 | Re-read the final policy text (`public/privacy.html`, `public/terms.html`) statement-by-statement against the release build; owner + a qualified reviewer sign off. | SC-REL10-03, SC-REL14-03 | ☐ |

## Drafted descriptions (owner reviews before submitting)

**Short description (≤80 chars):**

> Track fuel, services and costs for your vehicles — free, no ads, your data stays yours.

**Full description (draft):**

> Milevana is a free, ad-free vehicle expense and maintenance tracker for
> Android, with a companion web app.
>
> • Fuel and EV charging with automatic mileage tracking
> • Expenses, services and income in one history
> • Manual trips with reimbursement tracking
> • Reminders by date or odometer
> • Reports and cost-per-km
> • Inspection checklists
> • Receipt photos stored in your own Google Drive
> • Share a vehicle with family — everyone logs to the same record
> • Works fully offline; backs up to your Google Drive and exports CSV
>
> No ads, no tracking, nothing sold. Your data lives in your account and in
> your own Drive, and you can delete all of it from the app or the website.
>
> Privacy policy: https://milevana.poovarasu.dev/privacy
