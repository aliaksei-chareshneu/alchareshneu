# Imperion private form → existing Community CRM

## VERIFIED LIVE — 28 Oct 2026

Owner-authorized installation, actual five-minute trigger execution, all three public-form E2E flows, Supabase/CRM UUID matching and ACK, actual owner/applicant inbox delivery, idempotent re-import, and QA-only cleanup passed. [Full evidence and UUIDs: issue #137](https://github.com/aliaksei-chareshneu/alchareshneu/issues/137#issuecomment-6463532153).

[Bound Apps Script project](https://script.google.com/u/0/home/projects/1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl/edit) · [Triggers](https://script.google.com/u/0/home/projects/1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl/triggers) · [Executions](https://script.google.com/u/0/home/projects/1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl/executions).

## Applicant confirmation (installed and verified)

- Browser receipts now show the request details and a copy button on event RSVP, Družina training enquiry and corporate enquiry forms (CZ/EN/RU/UA). No messenger is required after a successful form submission.
- The existing `imperion-intake-sync.gs` source additionally queues **transactional acknowledgements** on the **existing CRM rows** and uses the owner's authorized Google `MailApp` to send them in the recorded language. It is installed and authorized in the existing bound project. **Future edits to the GitHub file do not automatically update the Google script**.
- Intake runs approximately **every five minutes** after the owner runs the updated installer (not instantaneous). It attempts up to five deliveries and records `Receipt_Status`, `Receipt_Attempts`, `Receipt_Sent_At` and `Receipt_Locale` inside existing relevant tabs; no parallel contact database. `SENT_TO_PROVIDER` means accepted by MailApp, NOT verified inbox delivery, opening or booked participation.
- A phone-only Družina enquiry is recorded with `ONSCREEN_ONLY`, not emailed. To guarantee an email copy in future, collect a valid address; SMS requires a separately contracted provider. Resend currently has **no verified sending domain**, so it is NOT an active attendee-mail channel.
- A failed MailApp call stays `RETRY` until the next import; after five failures the row becomes `FAILED_REVIEW` for manual intervention. A crash after MailApp accepted a send but before CRM status write may produce a duplicate: exactly-once email delivery is not provable with MailApp.
- Outgoing email is strictly about the specific submitted request: **no advertising, no acceptance, no payment, no guarantee of the event taking place**. For event details the mailer uses the approved public catalog and explicitly warns that time/meeting place need final personal confirmation.
- Google Apps Script [MailApp quota](https://developers.google.com/apps-script/guides/services/quotas) may limit high-volume delivery (e.g. consumer 100 recipients/day). Use a verified transactional domain/provider before scaling beyond its verified quota, and measure actual delivery/bounces separately.

## Current production status, 28 Oct 2026

- Private Supabase bridge reads RSVPs, Družina enquiries and corporate inquiries with Vault-backed bearer authorization. RLS and private source tables remain in place.
- Importer installed as one added file; original scripts, web handlers and automations preserved. Installed source blob: `20d132925edec244577f16ea17dcf3046b4733a8`.
- Script Properties contain the private bridge key, existing CRM ID and confirmed owner digest address.
- Exactly one importer trigger runs every **5 minutes**; actual automatic execution at 08:34:12 Europe/Prague completed successfully. Exactly one daily retention trigger runs **04:00–05:00 Europe/Prague**. The two pre-existing unrelated owner triggers remain.
- Public-form tests created one RSVP in `Registrations`, one training enquiry in `Druzina_Requests`, and one corporate enquiry in `Leads` only. All source UUIDs and ACK timestamps matched. Actual Gmail inbox readback verified the owner digest and all three applicant receipts.
- Repeated import produced zero new rows and zero new notifications. Verified QA records were removed from source and CRM; original non-QA RSVP preserved. No source pending rows at final readback.
- Daily retention helper was also manually run successfully: zero expired rows anonymized.
- No new CRM, payments, auto-accepted orders, public personal-data export, cold marketing mail or ChatGPT tasks.

## Installation / recovery reference (already completed)

1. Open the existing [Community Hub CRM](https://docs.google.com/spreadsheets/d/1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY/edit) → Extensions → Apps Script. Add **one new script file** named `imperion-intake-sync`. Copy the complete content of [imperion-intake-sync.gs](../imperion-intake-sync.gs). **Do not overwrite** the existing Code.gs/web app/calendar script.
2. Apps Script Project Settings → Script Properties. Set:
   - `IMPERION_INTAKE_BRIDGE_KEY`: copy privately from Supabase Vault with this query in the Supabase SQL editor:
     `select decrypted_secret from vault.decrypted_secrets where name='imperion_intake_bridge_key';`
     **Never paste or commit this credential to the website, a Google Sheet cell, GitHub, email or this chat.**
   - `IMPERION_NOTIFY_EMAIL`: `chereshnev.biochem@gmail.com` (verify this owner-controlled address is the desired internal digest mailbox; never send participant PII in digest).
   - Optional `IMPERION_CRM_SHEET_ID`: `1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY`. The existing `Code.gs` defines `SPREADSHEET_ID`, so this is normally unnecessary.
3. In Apps Script, manually Run `imperionSyncPrivateIntake`; grant Google the requested UrlFetch, Sheets and Mail permissions in the owner account. Check the execution transcript (there may be zero new records). Confirm B2B records, if any, appear only in existing `Leads` tab and are not marked paid. Then Run `imperionInstallPrivateIntake` once. This adds a five-minute import/receipt mailer and daily retention cleanup triggers, preserving unrelated existing triggers.

## Automated flow after the above

Supabase `imperion_rsvp_submissions` → private GET → existing tab `Registrations`. Supabase `imperion_rsvp_enquiries` → existing `Druzina_Requests`. Supabase `imperion_b2b_inquiries` → same private GET → existing `Leads` (OSVČ, not NGO). The original source UUID is preserved in the target row. The script holds a lock, reads existing UUIDs to avoid duplicates and only ACKs Supabase after writing rows. Retried requests recognize the UUID, skip duplicate writes and retry ACK. It emails the **owner** one count-only digest. The installed transactional receipt mailer sends applicants their own request summary after import; it is not an attendance confirmation, marketing or payment. It does not send guardian contacts to third parties.

**Reliability:** The importer checks the stored source UUID immediately after every CRM insert, refuses duplicate headers and requires a configured owner digest address before pulling data. New-application counts are queued in private Script Properties **before** Supabase ACK. If Gmail/MailApp fails, the next five-minute import run retries the count-only owner digest even if no fresh registrations arrive. Mail is at-least-once (a crash immediately after delivery can repeat the same count); do not interpret message counts as unique registrations. No participant details are emailed.

## Privacy and safety

- A participant's RSVP status `YES` is a stated intention, **not** a confirmed booking. `Source_Channel` and operational email explicitly say unconfirmed.
- Optional `marketing_requested` maps to `REQUESTED_UNCONFIRMED`, not consent for marketing.
- `crm_synced_at` is an operational receipt in the existing private Supabase submission table; no new person registry is created.
- The Apps Script retention helper anonymizes identifying fields at each RSVP's `retention_until`, and HEMA enquiries 90 days after submission. It preserves anonymous event totals.
- The private Edge Function has no public PII-export route. RLS remains enabled; anon/authenticated have no grants.
- Rotate the Vault secret and Script Property together if it is ever exposed.

## Canonical CRM validation and installer safety (fixed 27 Oct 2026)

- The existing `Registrations.RSVP_Status` dropdown allows `REGISTERED, CONFIRMED, MAYBE, DECLINED, CANCELLED, NO_RESPONSE, ATTENDED, NO_SHOW`; it **does not accept raw browser `YES` or `NO`**. The importer now maps `YES → REGISTERED`, `MAYBE → MAYBE`, `NO → DECLINED`. Only the organizer can promote attendance to `CONFIRMED` or `ATTENDED` on evidence.
- The existing `Payment_Status` dropdown allows `NOT_REQUIRED, PENDING, DECLARED, VERIFIED, REFUNDED`; it **does not accept `NOT_COLLECTED`**. The importer now writes `NOT_REQUIRED` only for a declined RSVP or a publicly verified zero-price event, otherwise `PENDING` for manual payment review. `PENDING` is not a payment demand, and no checkout was enabled.
- Receipt text now uses the event's approved public rules link; the sentence about fencing equipment is only used for HEMA/fencing events, not BrnoWalkers walks.
- `imperionInstallPrivateIntake` now leaves an existing owner trigger intact instead of deleting it first. Before running it, inspect existing project triggers and other potential owners: Google may not display triggers created by a different account. If the importer trigger already exists, check its **actual interval** manually; the installer will not silently replace it.
- The `growth-experience` source commit is `7d15e1985ef693f77f6355d4c35dd9163b8c4bdf`. The matching script was installed and authorized in the bound project on 28 Oct 2026; actual triggered execution and inbox delivery are evidenced in issue #137.

## Future verification

Use adult synthetic QA and an owner-controlled Gmail plus-alias for actual email delivery checks; use `.invalid` contacts only when delivery is not being tested. Check exactly one new row in the appropriate existing tab, matching source UUID and `crm_synced_at`, owner digest and applicant receipt in the actual mailbox. Re-run: zero new rows and zero repeated notifications. Before removing QA records, verify their exact IDs and identities in both systems. Do not infer deployment or inbox delivery from GitHub source or `SENT_TO_PROVIDER` alone.
