# Event RSVP — installation / verification (18 Oct 2026)

**Status:** STAGED SOURCE ONLY. The workbook counters and status columns are live; the public RSVP Form and its submit trigger have **not** been created, connected or tested in production. No real registrations or payment receipts are inferred from empty cells.

## Existing canonical system — not a new CRM
- Workbook: `events-registrations-template`, `Events` and `Registrations` tabs; **do not** create another master list.
- Existing public calendar and GitHub Pages site stay the same.
- The new `automation/EventRsvp.gs` uses the existing Apps Script globals `SPREADSHEET_ID`, `EVENTS_SHEET_NAME`, `REGISTRATIONS_SHEET_NAME` in `Code.gs`.
- New `Registrations` columns V:AB: `RSVP_Status`, `RSVP_Status_At`, `Payment_Status`, `Last_Reminder_At`, `Check_In_At`, `Reply_Contact`, `Source_Channel`.
- Existing `Events` T:Z aggregates: total recorded, confirmed, maybe, no/cancelled, actually attended, independently verified payments, and whether L is a form link. Additional `Events` AA:AC show YES within 36h, YES older than 36h, and undecided people. Formulas are initialized through row 200.
- Event-specific links are stored in existing `Events!L` (legacy column name `Tally_Form_URL` kept for compatibility).
- `RSVP_Control` is an INTERNAL view in the same workbook (next 20 Active events, form-link diagnostic and an event-specific roster). Select an Event_ID in `N2` to inspect its participants.

## One-time account-owner steps (after review/permission)

1. Open canonical workbook → Extensions → **Apps Script** (the existing bound project; **do not** create a second backend project).
2. Verify source `Code.gs` matches the staged patch in this PR before deploying; do **not** replace the deployed script wholesale with a different branch/version.
3. Add a new Script file named `EventRsvp.gs`. Paste the reviewed contents of `automation/EventRsvp.gs` from this PR.
4. Save, select `setupEventRsvp` → **Run**, authorize Forms/Sheets/triggers. This creates one short Google Form and stores its ID in private **Script Properties** as `EVENT_RSVP_FORM_ID`. Rerunning setup is idempotent. Two daily jobs install: event-list refresh (~08:00) and RSVP privacy cleanup (~09:00), Europe/Prague.
5. Read the **Execution log** to copy the newly published Form link; keep the **edit** link private. `syncEventRsvp` updates the Form list with active future events and sets each specific prefilling link in `Events!L`. A daily 08:00 Prague trigger refreshes upcoming dates. The Form submit trigger writes responses into the existing `Registrations` tab.
6. Open the Form in an **incognito / unsigned-in** mobile browser. Verify actual permissions (no Google account requirement), translations, correct date list, minor fields, disclosure and confirmation message.
7. Perform one **synthetic test**: choose a real active future Event_ID, name `TEST RSVP REMOVE`, your own contact, answer YES. Check exactly **one new** `Registrations` row, status `CONFIRMED` and matching `Event_ID`. Resubmit same contact/name/event with NO: check **same** row changes to `DECLINED` without another record; check that the prior Google Form response is deleted and Events/RSVP_Control counts update. Check a minor YES remains `REGISTERED` pending guardian approval. Remove only synthetic test data and responses, preserving original instruction rows and real records.
8. Verify Form link on website event card, Calendar link as published, and four languages on a narrow phone viewport. If the website's old hard-coded navigation still points to the legacy mega-form, change navigation in a separate reviewed deploy after a verified active Form is ready.
9. **Only after** testing, share the event-specific link. Do not announce a tentative high-risk workshop as confirmed before the named team, venue, exact session timing and insurance/safety checks are passed.

## Day-before RSVP rule

- Up to T−48h: `REGISTERED` means interest or a minor awaiting guardian checks; `MAYBE` is not a headcount.
- At T−24h: request an **explicit YES or NO** on the **same date-specific link**, with the same contact/name; the latest answer overwrites that participant's record. Use `RSVP_Yes_Recent_36h` for a fresh T−24 estimate; older YES responses remain visible separately but require reconfirmation. Count `CONFIRMED` as intended attendance, **not** guaranteed actual attendance.
- Mark `ATTENDED` or `NO_SHOW` only after the actual event; record verification evidence for payments separately. For free events, payment status `NOT_REQUIRED`.
- Outbound participant reminders are **manual** in this v1. The script does not auto-message users, scrape chats, send promotional email, charge money or confirm insurance/waivers. For WhatsApp/Telegram contacts use their chosen channel and avoid duplicate unsolicited messages.

## Acceptance / blockers

- The logged-in Google Forms editor and Apps Script execution permission are required to activate the Form; ChatGPT's connected Drive API cannot run FormApp or create the installable trigger.
- Running any code here in source control does **not** create a production Form or activate its trigger.
- The incumbent old Google mega-form has July/September options in its old response sheet; it is not the new date-specific RSVP.
- `PUB-VUT-20261021` needs an independently confirmed go/no-go (safety, venue entrance and staff); initial RSVP is **not** admission to archery/HEMA. Minors require separate guardian approval and the event-specific waiver; RSVP does not replace them.
- A verified payment is a cleared receipt, never a response checkbox. Grant-funded attendance and OSVČ sales must remain legally separate.
- Consent: event logistics only, no mailing-list opt-in. 90 days after the event, `cleanupEventRsvp` must anonymize RSVP personal fields in the canonical sheet AND delete all associated Form responses (including older resubmissions). Inspect Apps Script execution errors; no response-deletion error may be silently called success.

## Rollback

Disable the `onEventRsvpSubmit` and `syncEventRsvp` triggers in Apps Script and stop distributing the new form URL; existing registrations/canonical workbook stay intact. Do not delete old registrations or change paid commitments.
