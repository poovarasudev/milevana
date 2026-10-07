<!-- DRAFT for owner review. Not legal advice. Fill the [bracketed] items, then delete this comment and the banner below. -->
> **Draft banner (delete before publishing):** full privacy policy. Check every statement against the shipped build and have it reviewed by a qualified person.

# Milevana Privacy Policy

**Effective date:** [date]

## 1. Who we are

Milevana is a free, ad-free vehicle expense and maintenance tracker, available as an Android app and a companion web app at `milevana.poovarasu.dev`. It is provided by **Poovarasu Sekar**, an individual developer. Contact: **support@poovarasu.dev**.

## 2. What we collect

**Account information.** On Android the app creates an anonymous account the first time you open it. If you link a Google account, or sign in with Google on the web, we receive your **Google account name and email address** and the identifier Google provides for sign-in.

**Your vehicle data.** Everything you enter: vehicles (name, type, colour, make, model, year, plate, fuel types, odometer, currency and units), fuel and charging entries, expenses, services with line items, income, trips, inspections and checklist templates, reminders, amounts, dates, odometer readings, categories and notes, and your settings (currency, units, formats, theme, language, backup frequency).

**Member information on shared vehicles.** If you share a vehicle, the vehicle record holds each member's name and Google email, role and join date, and each entry shows the name of the member who logged it.

**Photos and documents (receipts).** If you add a receipt, the app can use your camera or let you pick a photo or PDF with the system picker. The app requests the **camera permission** for this. Receipt files are stored in **your own Google Drive**, not on our servers (see section 4).

**Crash diagnostics.** We use Firebase Crashlytics to receive crash reports and non-fatal error reports. They contain **document ids, error codes and app state only, and never amounts, plates, names or notes**. Invite codes are removed from crash reports and your account id is not set as the Crashlytics user id. Crashlytics assigns an **installation id** to each installation of the app so reports can be grouped. Crash reporting is not available on the web app.

**On your device.** The Android app keeps a local copy of your data so it works offline, and keeps a few local items such as your selected vehicle and snoozed reminders. Signing out of a linked account clears them.

## 3. What we do not do

- **No ads.** The app contains no advertising and no ad SDK.
- **We do not sell your data** and we do not share it for advertising.
- **No analytics.** We do not use an analytics service.
- **No location.** The app does not ask for or use your location.
- **No broad media access.** The app uses the system photo picker and does not request access to your whole photo library.

## 4. Google Drive and Google user data

Backups, receipt photos and PDFs are stored in a folder named "Milevana" that the app creates in **your own Google Drive**. The app uses the `drive.file` permission, which lets it see only the files it creates. It cannot see your other files. You are asked for this access the first time you use a Drive feature, with a short explanation first, and you can decline: everything else keeps working. You can remove the access at any time in your Google account settings. Files in your Drive stay there, under your control, until you delete them (the app deletes a receipt file when you delete the attachment, the entry or the vehicle it belongs to, if you uploaded it).

**Limited Use.** Milevana's use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements. We use Google user data only to provide the app's backup, receipt and sharing features, we do not transfer it to others except as needed to provide those features or as required by law, and we do not use it for advertising.

## 5. Sharing a vehicle with other people

- **Members see each other's names and Google email addresses.** A member can also see every entry on the vehicle and who logged it.
- **When someone leaves or is removed,** their email is removed from the vehicle's member list, **their name stays on the entries they logged** ("Logged by …"), and the entries stay on the vehicle.
- **Receipts are shared with members through Google Drive permissions.** When a member is removed, **their access to a receipt file is removed the next time the uploader's app opens or returns to the foreground. Until then the removed member can still open receipts that were shared with them.** Receipts uploaded by a member who has left remain visible to the members who already had access.
- Invite codes are single-use and expire after 7 days. Anyone with a valid code can join while it is valid, so share it only with the person you mean.

## 6. How we use your data, where it is stored, and security

We use your data to run the app: to show your records, sync them between your devices, back them up to your Drive, share vehicles you choose to share, and fix crashes. Data is stored in Google Cloud Firestore (Firebase) in [location] and in the on-device cache on Android. It is encrypted in transit. Access is controlled by security rules: you can read your own account record, and only members of a vehicle can read that vehicle's data. No system is perfectly secure, and we cannot guarantee absolute security. Google acts as our service provider for Firebase, Google Sign-In and Google Drive and handles that data under its own terms and policies.

## 7. Deleting your data and your choices

- **In the app.** Go to **More → Account → Delete account**. You see a summary first: what will be deleted, which vehicles you own that are shared will go to another member (by default the longest-standing member, and you can choose another member or delete that vehicle), and which memberships you will leave. You can back up or export first. You then sign in with Google again and type DELETE. An interrupted deletion resumes the next time you open the app.
- **On the web.** The same flow is at `milevana.poovarasu.dev/delete-account`.
- **If you never linked Google.** Open **More → Account → Delete all my data** in the app. Anonymous accounts can be deleted in the app only.
- **What is deleted.** Vehicles you chose to delete with their entries, reminders and checklist templates, the invites you created, your account record and settings, and your sign-in account.
- **What stays.** **Entries you logged on other people's vehicles stay, with your name on them.** Receipts and backups in your own Google Drive stay in your Drive; delete them there if you want them gone.
- **What we cannot delete.** If you moved data from an anonymous account into a Google account, the old anonymous account's documents remain in our database with no owner able to delete them. They contain the data you had before the move. We cannot promise that data is deleted.
- **Other choices.** You can edit or delete any of your own entries, export your data as a CSV without a Google account, and back up to and restore from your own Drive.

## 8. Retention, export and backups

We keep your data while your account exists and delete it as described in section 7. Crash reports are kept by Firebase under its standard retention. You can export your data as a CSV at any time and back it up to your own Drive. Backups, export and restore are free.

## 9. Children

Milevana is intended for people aged **18 and over**. We do not knowingly collect data from children.

## 10. Changes to this policy

We will post changes here and update the effective date. If a change is significant we will tell you in the app. Questions or requests: **support@poovarasu.dev**.
