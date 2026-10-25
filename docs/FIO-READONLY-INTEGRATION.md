# Fio banka -> existing Community Hub (Družina Moravy z.s.)

**Status: REVIEW-ONLY / NOT INSTALLED / NOT LIVE.** Staged 2026-10-16.
Public-safe implementation record. Never add real banking data, token, account number, customer exports, or private Drive URLs here.

## Official references
- Fio API Bankovnictví v1.9, dated 2025-10-16: https://www.fio.cz/docs/cz/API_Bankovnictvi.pdf
- Fio product page: https://www.fio.cz/bankovni-sluzby/api-bankovnictvi
- Export movements: HTTPS GET \`https://fioapi.fio.cz/v1/rest/periods/{token}/{yyyy-mm-dd}/{yyyy-mm-dd}/transactions.json\`
- JSON: \`accountStatement.info\` + \`transactionList.transaction[]\`. \`column22\` = unique movement ID, \`column0\` = date, \`column1\` = signed amount, \`column14\` = currency, \`column5\` = VS, \`column6\` = SS, \`column10\` = payer name, \`column16\` = message, \`column27\` = payer reference.
- Fio recommends >=30 sec per token; this design runs at most hourly. Routine history older than 90 days requires an explicit bank-side temporary unlock, available for 10 minutes. Read-only token is different from payment-capable token; choose *Sledování účtu* only.

## Current application and legal boundaries
- **Existing executor**: Community Hub bound Apps Script (\`Code.gs\`), existing spreadsheet binding \`SPREADSHEET_ID\`. Do not replace Code.gs, website, event scheduler, or n8n workflows.
- **Existing payment records**: \`Druzina_Payments\`, \`Druzina_Payment_Items\`, \`Druzina_Bookings\`, \`Druzina_Ledger\`, \`Druzina_Manual_Reconciliation\`.
- **New sheet inside the SAME private workbook**: \`Druzina_Fio_Transactions\` (created only after a successful authenticated bank fetch). Each bank movement is imported once by unique bank ID; overlapped re-queries are idempotent.
- This adapter is **only** for Družina Moravy z.s. and must validate the actual Fio account ID, bank code 2010, and CZK. OSVČ/private accounts need a separately scoped token, legal owner, access-control and ledger; do not reuse or blend data.
- Never use grants, earmarked receipts, nor association donations as the owner's personal cash. Bank cash balance is **not** free grant cofinancing and is **not** net income. Classify grant restrictions based on signed donor/grant evidence.
- Do not auto-mutate Druzina payment evidence, bookings, payment status, refunds, invoices, or outgoing bank payments. Exact matching VS+amount creates \`CANDIDATE_ONLY\`; duplicates get \`AMBIGUOUS_REVIEW\`; debit is \`DEBIT_REVIEW\`. Human Finance Ops review decides classification and treatment.

## Owner-only installation checklist

1. In Fio Internetbanking go to **Nastavení -> API** for the *association* account. Generate an access token with permission **Sledování účtu** (*read-only*), approve with your banking authorization, and wait at least five minutes. Never select the payment/import permission. Bank tokens may expire (maximum initial validity 180 days); monitor validity.
2. Confirm the existing Community Hub file remains private, with NO shared viewers/editors. The code fails closed when the sheet becomes shared. Never paste a token into ChatGPT, GitHub, Google Sheet cells, Gmail or the public web app.
3. After review, add \`FioBank.gs\` as a new file to the **current bound Apps Script project**, not a new stand-alone script and not a legacy deployment. Preserve existing Code.gs and its deployment. In **Project Settings -> Script Properties**, store (a) \`FIO_DRUZINA_READ_TOKEN\` = the Fio read-only token and (b) \`FIO_DRUZINA_EXPECTED_ACCOUNT_ID\` = the exact Fio account number without bank code. Access to the Apps Script project must be owner-only; Script Properties are accessible to other project editors.
4. As owner, manually run \`fioSyncDruzinaReadOnly\` once from the Apps Script editor. Verify the account identity passed, fresh last-success/balance, incoming/outgoing signed amounts and that no booking/payment was auto-approved. Real bank data stays in the private Hub only. Confirm the result against the actual Fio Internetbanking export.
5. Only after a live readback is verified, manually run \`fioInstallHourlyTrigger\`. It deduplicates its own triggers. Do NOT deploy or modify an anonymous Apps Script web app to support this read-only importer.
6. Rollback: delete only the \`fioSyncDruzinaReadOnly\` trigger and revoke this read-only token in Fio. Leave ledger/audit rows in place for accounting review; do not erase history to hide financial activity.

## Data model / verification
- Source of truth for **cash**: bank transaction ID + date + signed amount + bank-confirmed account identity; the finance evidence should archive monthly official statements as permitted.
- Source of truth for **orders**: separately signed/accepted purchase order or booking agreement.
- Source of truth for **reconciled paid booking**: reviewed match to a bank movement, service/legal seller, current price/policy, any refunds.
- Date window on first run: 30 days. Thereafter: from last successful day minus 7 days, through today. If a sync is more than 75 days stale, fail closed and require manual backfill; do not silently skip missed history.
- Bank requests use Fio \`periods\` endpoint (not \`last\`, which mutates Fio's download cursor). A full-window response is processed atomically before advancing the last successful checkpoint. Any duplicate bank movement ID is rejected. Pre-existing raw rows remain untouched.
- Side effects: only append new rows into \`Druzina_Fio_Transactions\` and update nonsecret script sync metadata; no transfers and no outside communications.
- Privacy risk: even a read-only token grants access to transaction data, including names and account numbers; Fio bank info must never be forwarded into external GenAI tools, telemetry, public spreadsheets or public repository.
- Current **Finance & Reserve Dashboard** is a separate existing *view/reporting* surface. Feed its balances, restricted grants and monthly financial close only after actual transactions are verified and classified; do NOT insert made-up 0 values or grant “cash available” placeholders. Avoid a second operational ledger or CRM.

## Tests / release gates

\`node tests/fio-bank-smoke.js\` (synthetic only) covers wrong account, wrong currency, duplicate IDs, null movement list, invalid amounts, VS/amount matching, ambiguity, outgoing movements and spreadsheet formula injection. It does not prove Fio token validity, Apps Script project permissions, trigger behavior, or end-to-end banking.

**Definition of DONE** (not yet met): owner-only read token configured; one real GET returns the expected association account; statement rows match Fio Internetbanking; second run produces zero duplicates; review queue correctly flags ambiguous/missing reference; hourly trigger observed working; failed tokens and shared-sheet access alert without leaking sensitive information; finance reporting separates unrestricted cash/restricted money/OSVČ.
