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
