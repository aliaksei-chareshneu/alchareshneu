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

## Important boundary: automatic Google Sheet synchronization is NOT LIVE

Only the first 7 records were manually written to the existing Google Sheet by authenticated Google Drive connector, then independently verified. The current Edge function does not write Google Sheets and intentionally returns \`crm_sync: NOT_IMPLEMENTED\`. Recurrent automatic source search is installed; recurrent CRM append awaits a **separately authorized, privately installed Apps Script importer** with documented source ID, de-duplication, and ACK-after-Sheets-readback. Do not send cold mail, simulate inbound form requests, put private keys in Github, or copy any data to a new CRM.

## Readback and guardrails

- No outgoing email, no applications, no vendor payments, no AI inference, no social publication. Only public TED POST and private internal persistence.
- Reviewed owner login is required before any submission, NDA, training, money or contract.
- Keep entity \`OSVC\` separate from \`DRUZINA_MORAVY_ZS\`, grants and personal funds.
- Use the existing \`Leads\` only for qualified buyers after checking actual contact history; staged notices stay in \`IMPERION_B2B_Open_Requests\`.
- If TED is unavailable, record partial/failure status, never assert a successful search and never retry paid providers.
