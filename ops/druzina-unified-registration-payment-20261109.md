# Družina Moravy — unified training registration, pricing and PDF evidence
Reviewed: 2026-11-09 Europe/Prague. Scope: existing /register/, Supabase browser-bridge, existing Community Hub Registrations sheet (NOT a new CRM).

## Authoritative commercial terms (owner, 9 November 2026)
- Standard/first two-hour training: 240 Kč.
- Individually verified Senior: 120 Kč per two-hour training.
- Starter 4: 800 Kč, four two-hour visits within 30 days.
- If the first session was actually paid and attended, a confirmed upgrade within the following 48 hours credits 240 Kč; the verified balance is 560 Kč. This is NOT an automatically chargeable event-booking price until proof of attendance and prior payment exists.
- New applications made/payments evidenced less than 48 hours before their training: +25% of the selected base tariff, rounded UP to whole Kč. Examples: standard 300 Kč; eligible Senior 150 Kč; new Starter 4 1000 Kč. The specific session price remains locked only when verified by the server. Earlier written commitments and payments remain unchanged.
- Free workshop PUB-OREL-20261114 12:00–14:30 is always free, with no PDF requirement or late fee.
- The 7 November 1000+160 group formula is retired.

## Customer journey (one form only)
1. Website /register/ on CS/EN/RU/UK; select event and tier, enter contact, guardian/safety fields when relevant, submit a preliminary RSVP. A 43-character one-time continuation code is returned only for a newly received paid-training YES RSVP; store it securely.
2. Organizer reviews real date/location, capacity/safety, authorized seller (Družina Moravy z. s. vs OSVČ), instructor and insurance applicability, terms, bank account OF THE SELLER, current legal rules, and verifies applicant's category and guardian requirements. Not authorized by mere RSVP or an email reply.
3. Organizer records approved event in existing Supabase event row: training_payment_open TRUE only with training_quote_locked_at, training_operational_go_at, training_payment_recipient and training_payment_account. For each verified applicant, set training_authorized_at; for approved Senior/Starter4 set training_authorized_tier to requested tier; standard requires approved timestamp only. Never grant Senior from self-report, rank, or membership alone. These changes need an owner readback and corresponding CRM audit note.
4. Applicant returns to the **same** form, selects SAME event and tier, enters SAME identity + code, clicks 'Check approved total and bank account'. Only then does the server provide their approved bank details and the exact rate. No bank account is exposed in the public GET catalog.
5. After making the bank transfer, applicant uploads a PDF up to 2MB in the same form. Server checks PDF magic bytes, tier, code, quote snapshot, event gate and T-48 cutoff, then stores PDF privately, clears one-time token and updates the **same** RSVP. Result = PROOF_RECEIVED / bankVerified=false / confirmed=false.
6. Privileged owner verifies transfer against the correct legal recipient BANK statement before moving to BANK_VERIFIED, then separately confirms any reserved seat/attendance. PDF is not a bank payment.

## Privacy, dedup, retention
- Bucket imperion-training-payment-proofs is private, PDF MIME only and max 2MB; service-role Edge Function is the only uploader. PDF path/hash not exported to CRM; Google Sheets gets tier, quote and review status only.
- Existing intake bridge accepts protocol payment-v2 opt-in only from upgraded bound Google Apps Script; legacy pulls continue safely but do NOT acknowledge a proof update as synced.
- Existing CRM tab Registrations is the source of consolidated RSVP display; Submission_ID remains unique. Add columns on upgrade, never new CRM tabs.
- Daily scheduled private cleanup job imperion_training_payment_proof_retention_daily 04:15 UTC removes expired event+90-day PDF objects only through Supabase Storage API; manual test 2026-11-09: HTTP 200, removedCount 0, failedCount 0.
- Never link this sensitive PDF as a public signed URL; statutory accounting evidence retention is separate and must be checked.

## LIVE vs BLOCKED on 2026-11-09
- CONFIRMED: Supabase Edge API deployed with current individual prices; public GET 200, Orel free, private bank account hidden; bridge private protocol deployed; Storage bucket private; scheduled cleanup tested.
- NOT YET VERIFIED: live bound Apps Script contains the new proof-sync code, full submission + PDF + bank-reconciliation end-to-end tests, page's GitHub Pages deployment. Do not label as LIVE until tested.
- BLOCKED for collection: future session-level venue, permissions, safe capacity, insurance, provider and bank account must be individually established before setting training_payment_open TRUE. No immediate public checkout; do not invite transfers prematurely.
- No payment, no subscription, no live message/notice is sent by this work.

## Smoke/rollout test
- node --test tests/druzina-unified-payment.test.cjs
- existing site-quality and Druzina Playwright tests (the PR updates sole-form routing).
- public GET /imperion-register must show STANDARD/SENIOR/STARTER4 240/120/800 and Orel without payment.
- Unauthorized POST quote -> error, no bank details; authorized test uses an isolated approved non-production record only with owner's authorization, then receipt document in private bucket, CRM ACK, bank-only confirmation and deletion test.
- A merged GitHub PR is NOT proof of live Google Apps Script or paid attendance.
