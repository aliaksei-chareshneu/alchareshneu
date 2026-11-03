# IMPERION Deal Hunter MVP — official Czech TED notices

## State and provenance (2026-11-03)

- Supabase project **browser-bridge** \`cmrknyhnnehyjpreehcf\` is reused; no second CRM or new paid services.
- The deployed Edge Function \`imperion-deal-hunter\` is **ACTIVE v1**. It reads only public TED Search API \`https://api.ted.europa.eu/v3/notices/search\`, for three CPV families: IT \`72000000\`, research \`73000000\`, training \`80000000\`, buyer country CZE.
- Source: \`supabase/functions/imperion-deal-hunter/index.ts\` + \`core.mjs\`. Schema: \`supabase/migrations/20261103_imperion_deal_hunter_mvp.sql\`. Tests: \`node --test tests/imperion-deal-hunter.test.mjs\`.
- Independent manual invocation #1: run UUID \`71b68f41-75ba-485b-8905-9f456c17b97b\`: HTTP 200; 60 notices read, 44 screened and inserted, 44 verified persisted, 3 sources OK, no errors.
- Invocation #2: \`ebd2a225-4d51-4a7e-ae60-b411704a01c4\`: HTTP 200; 60 read, 44 screened, **0 inserted**, 44 persisted. Durable source-key dedup demonstrated.
- Actual canonical CRM: \`https://docs.google.com/spreadsheets/d/1igxEHQ7wFFCoCA9lg4kzT2OoMrVLgbBogfqTxGeUftY/edit\`; existing tab \`IMPERION_B2B_Open_Requests\`, rows **173–179**, 7 TED notice referrals safely appended manually. Full 7-row Sheets readback passed. \`crm_synced_at\` is set only for these 7 rows.
- Source staging \`public.imperion_deal_hunter_candidates\` and audit \`public.imperion_deal_hunter_runs\` have RLS enabled and no anon/authenticated grants. No personal data is sent to TED. API has a dedicated secret in Supabase Vault \`imperion_deal_hunter_cron_token\` and service-role-only verifier RPC. HTTP without the token was confirmed **401**.
- **Revenue:** No notice is a confirmed user order. All uncosted entries stay \`REVIEW_UNCOSTED\`. Database generated economics calculations use **(OSVC quote − OSVC direct costs) / ALL owner hours**. A score is only a relevance heuristic. Buyer budget ≠ OSVC payment; no invented deadline or consent. Never claim cash, contract, or eligibility without receipts.

## Schedule (installed)

- Supabase pg_cron job \`imperion_deal_hunter_weekday_prague_twice\`, job id **9**, schedule **\`20 5,6,11,12 * * 1-5\`** UTC; Edge checks weekday and exact Prague **07:20** or **13:20** to account for DST. Other two invocations fail closed as skipped.
- Actual \`cron.job\` readback: \`active = true\`. Manual end-to-end trigger→TED→insert→SELECT proof exists. First *routine scheduled* execution requires independent next-day readback in \`cron.job_run_details\` and \`imperion_deal_hunter_runs\`.
- Owner report resides in \`imperion_deal_hunter_runs.report\`; no automated owner email (user forbids messages without separate GO). Retrieval for owner via authenticated Supabase console:
  \`select started_at,status,received,screened,inserted,persisted,report from public.imperion_deal_hunter_runs order by started_at desc limit 3;\`.
- Pending private candidates:
  \`select source_key,title,buyer,source_url,fit_score,economics_gate,crm_synced_at from public.imperion_deal_hunter_candidates order by first_seen_at desc limit 40;\`.

## Protected Google Sheets importer adapter (STAGED — owner installation required)

- Deployed Supabase Edge Function `imperion-deal-hunter-crm` v1 is ACTIVE, source `supabase/functions/imperion-deal-hunter-crm/index.ts`.
- GET returns only unsynced, public TED candidates (up to 15), POST with `{action:"ack", ids:[...]}` marks source rows synced only AFTER confirmed Sheets persistence. Both require the existing private Apps Script bearer key (`IMPERION_INTAKE_BRIDGE_KEY`) verified via the already deployed server-side intake credential RPC. No extra key, PII, email, marketing, grants or payments.
- Authenticated GET HTTP 200 returned pending candidates; authenticated POST empty ACK HTTP 200 returned `acked:0`; unauthenticated ACK HTTP 401. Real Apps Script-run write→ACK is **NOT VERIFIED**.
- Prepared `imperion-deal-hunter-sync.gs` is a new Apps Script file for the EXISTING owner-controlled Community Hub script project, not a second CRM. It checks owner and exact sheet ID, verifies 15 stable headers, Source_ID and link dedup, appends `REVIEW_UNCOSTED` rows, reads back each inserted row, then ACKs.
- **One required owner installation:** in the existing bound [Apps Script project](https://script.google.com/u/0/home/projects/1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl/edit), add `imperion-deal-hunter-sync.gs` as a NEW script file without overwriting existing sources; run `imperionInstallDealHunterSync` as the script owner once and authorize its scopes. Then run `imperionDealHunterSync` and independently compare a new CRM row ID+URL and Supabase `crm_synced_at`. No further payment or external sending GO is granted.
- Committing source on GitHub DOES NOT install it into the live bound Google Apps Script project. Until this step, only the original seven connector-written rows are synced; recurring automatic Google Sheets sync is BLOCKED.

## Cron end-to-end proof on 3 Nov 2026

- Temporary `pg_cron` probe job **10** triggered at 2026-11-03 19:35:00 UTC with source `mode:"manual"` (to test off-slot). `cron.job_run_details.status=succeeded`, `pg_net` HTTP 200, and independent run receipt `SOURCE_OK`, 60 searched, 44 screened, 0 newly inserted, 44 persisted. Probe job 10 was then **unscheduled successfully**; job **9** is the only remaining Deal Hunter cron job, active.
- This proves cron→authenticated Edge→TED→DB off-slot. The **actual first routine 07:20 Prague production schedule with `mode:"cron"`** remains pending next-day evidence. Unit tests cover timezone gates.

## Important boundary: automatic Google Sheet synchronization is NOT LIVE

Only the first 7 records were manually written to the existing Google Sheet by authenticated Google Drive connector, then independently verified. The current Edge function does not write Google Sheets and intentionally returns \`crm_sync: NOT_IMPLEMENTED\`. Recurrent automatic source search is installed; recurrent CRM append awaits a **separately authorized, privately installed Apps Script importer** with documented source ID, de-duplication, and ACK-after-Sheets-readback. Do not send cold mail, simulate inbound form requests, put private keys in Github, or copy any data to a new CRM.

## Readback and guardrails

- No outgoing email, no applications, no vendor payments, no AI inference, no social publication. Only public TED POST and private internal persistence.
- Reviewed owner login is required before any submission, NDA, training, money or contract.
- Keep entity \`OSVC\` separate from \`DRUZINA_MORAVY_ZS\`, grants and personal funds.
- Use the existing \`Leads\` only for qualified buyers after checking actual contact history; staged notices stay in \`IMPERION_B2B_Open_Requests\`.
- If TED is unavailable, record partial/failure status, never assert a successful search and never retry paid providers.
