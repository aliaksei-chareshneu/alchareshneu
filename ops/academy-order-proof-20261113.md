# Academy checkout · case IMP-ACADEMY-ORDER-PROOF-20261113

## Verified deployed components

- Source: `academy/order/` (CS/EN/RU/UA), `academy/academy-service-catalog.js`, `imperion-academy-checkout` Supabase Edge v1.
- Legal seller: Aliaksei Chareshneu **OSVČ**, IČO 23041625. Never use Družina Moravy, z. s. or JRDM bank details for OSVČ.
- Data store: **existing** private `public.imperion_academy_inquiries`; no duplicate CRM. Existing `imperion-intake-bridge` v7 supports opt-in Academy import and the canonical `Leads` spreadsheet.
- Proofs: private `imperion-academy-payment-proofs` bucket, 2 MB PDF/PNG/JPG, hash and UTC receipt time. Existing `imperion-training-proof-retention` v2 scheduled daily, now handles club PDF and Academy evidence independently.
- The client cannot set `BANK_VERIFIED` or `CONFIRMED`. Every public upload returns `PROOF_RECEIVED` only.
- No compatible verified **60-minute paid Academy live availability** is connected. Calendly currently has an active 15-minute corporate brief, unsuitable for lessons. Form asks for preferred dates only, clearly unconfirmed.

## Owner-controlled transaction steps

1. New request `source='academy_checkout_20261113'` enters existing OSVČ Academy inquiries with `booking_status=REQUESTED`, `payment_quote_status=NOT_QUOTED`, `payment_evidence_status=NOT_REQUIRED` and **no account**. Existing authenticated Academy CRM importer may sync the lead; an importer ACK is not a paid order.
2. Owner reviews the student's goal, format, full hourly economics, travel, age/safety, time feasibility and legal seller. Confirm an accurate written fixed-price quote **and only the actual OSVČ recipient bank account**. Set the approved exact amount, `quote_recipient`, `quote_account`, `quote_locked_at`, `quote_expires_at`, `payment_quote_status=APPROVED`, `payment_evidence_status=AWAITING_PROOF` together in private authenticated admin context. **No public/admin UI provides this action, and no account is auto-filled.** Do not put real account numbers into GitHub source.
3. Customer uses the private reference+continuation code to review exact approved bank details and can upload a proof. Result is `PROOF_RECEIVED`; receipt timestamp and private SHA256 are stored. Owner or authorized finance operator alone checks amount, identifier, recipient and actual credited funds in bank transaction records **at the agreed due date or upon documented change**. Document readback; then and only then set `payment_evidence_status=BANK_VERIFIED` and `bank_verified_at`. Never infer bank credit from a screenshot.
4. Confirm an actual free session in the owner's calendar and all agreed venue/cancellation details separately, then `booking_status=CONFIRMED` and `booking_confirmed_at`; DB guard requires bank verification. Previous packages/agreements unaffected.
5. Log one existing Case_ID in `03 EXECUTION` / `01 CASH` with source, time spent, correct seller, confirmed bank amount and lifecycle. No repeated reminders before documentary due date.

**BLOCKED / manual prerequisite**: Owner must authorize the correct personal OSVČ receiving bank account and enable a suitable live paid-lesson availability source. Until then the new site accepts *requests* but never claims available confirmed slots or asks clients to pay an unapproved bank account.

**Data retention**: New never-quoted/never-paid requests expire after 180 days under scoped nightly cron `imperion_academy_checkout_unquoted_expiry_0350`. Private Academy PDF/PNG/JPG expire on their DB record's retention date plus safe buffer via existing daily Vault-gated cleanup. Paid invoices/tax records may have longer legal accounting retention separately; bank-verified items are not auto-deleted by the new unquoted cleanup.


## 13 November 2026 — P0 exact booking audit (PR #309, DRAFT / NOT DEPLOYED)

**Readback, not release:** A new inactive Calendly type for **60-minute online Academy** sessions was created and re-read: `https://api.calendly.com/event_types/797ae98e-84c2-4cc3-8dde-a80317ec2220`, duration 60, `active=false`, `is_paid=false`. It is NOT advertised, NOT bookable and does not replace the existing 15-minute corporate brief. It inherits an unsuitable default schedule until all known conflicts (including European College Outlook and transport) are connected and verified. No calendar invitations created.

**Bank settlement:** Stripe connection currently exposes only a `Buymeacoffee` live account; this is NOT verified as the correct OSVČ merchant. Do not use it for Academy payments, connect a different merchant, start a subscription, create charges or imply bank settlement. The public checkout remains *written quote first, manual transfer and bank readback*.

**Additional staged database controls:**
- A real bank transaction can be verified by an authorized owner **without a screenshot** if the actual OSVČ credited amount matches an approved quote, with bank verification timestamp and a private 64-character SHA-256 fingerprint of the independent bank transaction. Client proof is optional and does not establish payment.
- A unique bank fingerprint cannot be credited to two different lesson orders. This is a single-order payment model; package/batch payments require a separate documented allocation process (not automatic).
- No `CONFIRMED` session without `BANK_VERIFIED`, an approved quote, a recorded human cross-calendar check **after** bank readback, documented checked calendars/commute, and the exact future timespan. PostgreSQL GiST refuses overlapping confirmed lessons, but does NOT know about school/clients/factory commitments outside the database.
- Server guard independently fails closed on incomplete bank, calendar or confirmed-time evidence. Its `bookingConfirmed` and `bankVerified` claims are not accepted from the browser.
- The production v1 Edge Function and live database are unchanged. The full migration's statement-by-statement DDL was applied to a temporary clone of the actual production table schema, with eight synthetic cases under `BEGIN ... ROLLBACK`. Guards for overlaps, duplicate bank references, mismatched amounts and missing calendar evidence worked. This is a **SQL dry run**, not integration staging or proof of a real bank transaction.
- Scoped GitHub CI `43477477231` completed `SUCCESS` (Node assertions and four-language Playwright). Broad sitewide `npm test` has unrelated baseline failures/cancellations; do not claim global CI PASS.

**Required sequence for a real payable online lesson:**
1. Keep `booking_status=REQUESTED` while identifying the service, student, travel, existing commitments and safeguarding. Confirm exactly which legal seller and approved price apply. Current new public example: `690 Kč/60min` for online school/language/technical basics; this is **below the project personal NET/ALL-hour target of 1,000 Kč**, even before costs/taxes, so profitability must be decided before scaling.
2. Collect **owner-approved written terms** (scope, price, correct OSVČ legal/payee identity and account, deadlines, refund/cancellation, scheduling window). Never use Družina Moravy, JRDM or unrelated payment account.
3. Only a privileged operator may change `payment_quote_status` to `APPROVED` and set exact payee/account/amount, quote lock and expiry. Public users cannot approve or modify this state.
4. An independently confirmed bank credit, including full agreed amount and distinct transaction hash, may change the status to `BANK_VERIFIED` and record `bank_verified_at`. No automatic bank feed exists. No advance checks on receivables before agreed due date unless owner requests/important change occurs.
5. Check **all** actual work calendars, European College commitments, existing private students, travel and personal blocks *after* bank verification. Record `owner_calendar_checked_at` and a truthful `owner_calendar_check_note` of 15–500 characters; set exact `confirmed_session_at`, `confirmed_session_end_at`, `booking_confirmed_at` and `booking_status=CONFIRMED` only in the authenticated operator context. Database exclusion rejects conflicting confirmed Academy orders.
6. Read back exact server status; send agreed lesson details through the original customer correspondence; log correct lifecycle into existing `03 EXECUTION` and personal bank-confirmed cash only into `01 CASH`. Do not use `Leads.Paid_CZK` as bank evidence by itself.

**Remaining blocked production actions (owner / real trigger):**
- **Identity/account:** correct personally controlled OSVČ settlement identity, bank account and cancellation/quote terms not verified for this workflow. Stripe `Buymeacoffee` is not a substitute.
- **Calendars:** Google personal + club + Orders calendars are connected; European College Outlook listing returns HTTP 401 and factory/private commitments are not completely represented. Do not activate the new Calendly event until this is resolved.
- **CRM:** GitHub importer has Academy opt-in, but the connected bound Google Apps Script deployment and five-minute trigger after the newer source are NOT independently verified. No pending Academy rows exist in Supabase at latest readback (new=0, un-synced=0, approved quotes=0). Do not create dummy customer orders to make these non-zero. The legacy registration importer previously ran, but this does not prove Academy v1 importer was installed.
- **Release:** isolated end-to-end staging (actual Edge deploy, quote, bank attestation, confirmed time, CRM mirror and replay/idempotency) is not yet verified. Do not migrate live database, deploy function, merge PR or publish paid slots without separate release GO and readback.

