# Customer lifecycle planner — isolated implementation slice

Scope: \`ops/customer-lifecycle-planner.cjs\` generates **dry-run** proposed next actions from **existing verified CRM** event, booking, payment, and attendance records. It cannot send messages, collect money, create a second database, schedule tasks, update live records, or deploy endpoints. Tests use synthetic, non-personal data.

## Verified gap in current repository

The \`register/index.html\` front end opens WhatsApp/email; it explicitly tells customers that the webpage does **not** save a booking in the backend. It is not currently an autonomous booking service. The repository contains an Apps Script \`Code.gs\` webhook, but source code is not evidence of a deployed, authenticated ingress or readback to canonical CRM.

## Intended adapter (NOT YET IMPLEMENTED)

1. Read authoritative event, registration, pricing, attendance and payment rows from the **existing** Hub. Map current event state into \`ACTIVE_CONFIRMED\` only after verifying venue, organizer, insurance/safety gates and rights. Do not trust public-browser payment or check-in flags.
2. Call \`planCustomerLifecycle\` and atomically claim its stable \`idempotency_key\` inside the existing SocialPublishing or owner-approved equivalent queue. Do not build a parallel CRM. The returned \`DRY_RUN_REVIEW_REQUIRED\` does not authorize sending.
3. Verify recipient consent, identity, unsubscribe, channel availability, language, quiet hours, and outgoing message history. Promotional upgrades require separate opt-in; auto-reply ONLY to published FAQ facts; legal, urgent, sensitive, refund or disputed requests go to a human.
4. For paid events, create checkout only for the verified **OSVČ or z.s.** payee. Do not confirm payment from a success redirect: verify signed webhooks (including asynchronous methods) or independent bank readback, with provider receipt and account match. Keep tax/fiscal invoices distinct.
5. \`ATTENDED\` requires verified organizer check-in. Only propose a 48-hour SKU discount if approved price/terms, consent, active link and deadline are valid. A late-booking surcharge must be published prospectively, lawful and displayed before checkout, never a retroactive penalty.
6. Run E2E acceptance: event eligible → form submission → canonical CRM readback → capacity reserve → checkout → payment proof → confirmation → reminder → attendance → thank-you → (consented) offer → refund/cancel/unsubscribe. Verify receipts and zero duplicate sends.

## Hard production gates

- All current event details verified (including public price, date, location, safety, payee, terms, booking capacity, privacy notice, children's guardian requirements).
- Verified SMS / WhatsApp Business / email platform entitlements, credentials, delivery receipts and costs. Quo account **currently has no inboxes**; do not advertise SMS as live.
- Consent and GDPR data minimization; do not place private customer records, tokens or authenticated Script URLs in GitHub Pages JS.
- Exactly one canonical CRM, no conflicting booking IDs or financial ledgers; no additional ChatGPT Task (10-slot cap).
- Verify the real GitHub Pages publishing source branch, then separately obtain owner permission before editing production and perform independent readback.
- Apply rate limits, retry caps and escalation for ambiguous intents before any unattended sending or payment/invoicing.

**Current status:** isolated planner and synthetic tests only. No dispatching, Stripe products, bank reconciliation changes, form submission endpoint, billing, SMS automation or production deployment.
