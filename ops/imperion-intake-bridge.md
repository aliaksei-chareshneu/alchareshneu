# Imperion private form → existing Community CRM

## Applicant confirmation upgrade (prepared, NOT YET LIVE)

- Browser receipts now show the request details and a copy button on event RSVP, Družina training enquiry and corporate enquiry forms (CZ/EN/RU/UA). No messenger is required after a successful form submission.
- The existing `imperion-intake-sync.gs` source additionally queues **transactional acknowledgements** on the **existing CRM rows** and uses the owner's authorized Google `MailApp` to send them in the recorded language. It requires the one-time installation/authorization below: **editing the GitHub file does not activate the Google script**.
- Intake runs approximately **every five minutes** after the owner runs the updated installer (not instantaneous). It attempts up to five deliveries and records `Receipt_Status`, `Receipt_Attempts`, `Receipt_Sent_At` and `Receipt_Locale` inside existing relevant tabs; no parallel contact database. `SENT_TO_PROVIDER` means accepted by MailApp, NOT verified inbox delivery, opening or booked participation.
- A phone-only Družina enquiry is recorded with `ONSCREEN_ONLY`, not emailed. To guarantee an email copy in future, collect a valid address; SMS requires a separately contracted provider. Resend currently has **no verified sending domain**, so it is NOT an active attendee-mail channel.
- A failed MailApp call stays `RETRY` until the next import; after five failures the row becomes `FAILED_REVIEW` for manual intervention. A crash after MailApp accepted a send but before CRM status write may produce a duplicate: exactly-once email delivery is not provable with MailApp.
- Outgoing email is strictly about the specific submitted request: **no advertising, no acceptance, no payment, no guarantee of the event taking place**. For event details the mailer uses the approved public catalog and explicitly warns that time/meeting place need final personal confirmation.
- Google Apps Script [MailApp quota](https://developers.google.com/apps-script/guides/services/quotas) may limit high-volume delivery (e.g. consumer 100 recipients/day). Use a verified transactional domain/provider before scaling beyond its verified quota, and measure actual delivery/bounces separately.

## Current status, 27 Oct 2026 (verified after live CRM/API audit)

- **LIVE:** Private Supabase `imperion-intake-bridge` version 2 reads three streams, authorized ONLY by 64-character high-entropy bearer token verified against Supabase Vault: event RSVPs, NGO Družina enquiries, and **OSVČ B2B corporate inquiries**.
- **LIVE:** Private B2B source table `imperion_b2b_inquiries` (RLS ON, no anon/authenticated access) stores unconfirmed requests from [corporate quote form](../corporate/request/).
- **SOURCE CORRECTED, GOOGLE INSTALL UNVERIFIED:** The enhanced Google Apps Script importer in [imperion-intake-sync.gs](../imperion-intake-sync.gs) is committed on `growth-experience`, but source code in GitHub is NOT evidence that it is installed or running in the bound Google Apps Script project. It handles all three streams; B2B leads route only to `Leads`, NGO enquiries to `Druzina_Requests`, public event RSVPs to `Registrations`.
- **OWNER GATE:** Install and authorize the importer in the existing bound Community Hub Apps Script project, then verify the trigger and an end-to-end receipt. Google Drive cannot deploy or authorize Apps Script; Desktop Commander usage is exhausted and connected browser automation is out of credits. Until owner-authorized installation is evidenced, no five-minute Google Sheet import or owner/attendee notification is guaranteed.
- **OBSERVED ON 27 OCT:** Supabase contained exactly 1 RSVP (for event `PUB-HIKE-20261101`), 0 Družina enquiries and 0 B2B enquiries; that RSVP had a matching UUID in existing `Registrations` and `crm_synced_at` set. It is a manually reconciled/self-submitted record, not evidence of a working automatic trigger. Its `Source_Channel` was normalized to `WEBSITE_RSVP_SUPABASE_UNCONFIRMED` so the existing retention helper can see it. No remaining pending source records during the check.
- **FAILSAFE:** Existing ChatGPT automation `07 · B2B Deal Engine: CASH-FIRST` may perform a connector-based sync on scheduled runs. This is an **attempted secondary route**, not proof of continuous sync. Do not falsely claim the native Apps Script trigger runs until independently verified.
- No new CRM, no payment capture, no auto-accepted order, no public personal-data export, no cold marketing email from forms.

## One-time owner action

1. Open the existing [Community Hub CRM](https://docs.google.com/spreadsheets/d/1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY/edit) → Extensions → Apps Script. Add **one new script file** named `imperion-intake-sync`. Copy the complete content of [imperion-intake-sync.gs](../imperion-intake-sync.gs). **Do not overwrite** the existing Code.gs/web app/calendar script.
2. Apps Script Project Settings → Script Properties. Set:
   - `IMPERION_INTAKE_BRIDGE_KEY`: copy privately from Supabase Vault with this query in the Supabase SQL editor:
     `select decrypted_secret from vault.decrypted_secrets where name='imperion_intake_bridge_key';`
     **Never paste or commit this credential to the website, a Google Sheet cell, GitHub, email or this chat.**
   - `IMPERION_NOTIFY_EMAIL`: `chereshnev.biochem@gmail.com` (verify this owner-controlled address is the desired internal digest mailbox; never send participant PII in digest).
   - Optional `IMPERION_CRM_SHEET_ID`: `1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY`. The existing `Code.gs` defines `SPREADSHEET_ID`, so this is normally unnecessary.
3. In Apps Script, manually Run `imperionSyncPrivateIntake`; grant Google the requested UrlFetch, Sheets and Mail permissions in the owner account. Check the execution transcript (there may be zero new records). Confirm B2B records, if any, appear only in existing `Leads` tab and are not marked paid. Then Run `imperionInstallPrivateIntake` once. This adds a five-minute import/receipt mailer and daily retention cleanup triggers, preserving unrelated existing triggers.

## Automated flow after the above

Supabase `imperion_rsvp_submissions` → private GET → existing tab `Registrations`. Supabase `imperion_rsvp_enquiries` → existing `Druzina_Requests`. Supabase `imperion_b2b_inquiries` → same private GET → existing `Leads` (OSVČ, not NGO). The original source UUID is preserved in the target row. The script holds a lock, reads existing UUIDs to avoid duplicates and only ACKs Supabase after writing rows. Retried requests recognize the UUID, skip duplicate writes and retry ACK. It emails the **owner** one count-only digest. The newly staged transactional receipt mailer sends applicants their own request summary after import; it is not an attendance confirmation, marketing or payment. It does not send guardian contacts to third parties.

**Reliability (staged until Apps Script installation):** The importer checks the stored source UUID immediately after every CRM insert, refuses duplicate headers and requires a configured owner digest address before pulling data. New-application counts are queued in private Script Properties **before** Supabase ACK. If Gmail/MailApp fails, the next five-minute import run retries the count-only owner digest even if no fresh registrations arrive. Mail is at-least-once (a crash immediately after delivery can repeat the same count); do not interpret message counts as unique registrations. No participant details are emailed.

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
- The `growth-experience` source commit is `7d15e1985ef693f77f6355d4c35dd9163b8c4bdf`. **No Google Apps Script production push or triggered execution was performed by that commit.**

## Verification once activated

Use synthetic `.invalid` contact data to test all three types. Check exactly one new row in each appropriate existing tab, `crm_synced_at` on source, and one owner digest. Re-run; it must add zero new rows and send no new digest. Do not announce completion until verified against both Google Sheets and the Edge receipts.
