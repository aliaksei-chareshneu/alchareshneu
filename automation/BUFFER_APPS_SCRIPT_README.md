# Buffer Free failover using existing Apps Script (safer than external service account)

Status 2026-10-18: **LOCAL QA PASSED, NOT LIVE**. The existing community CRM and owner-bound Google Apps Script are reused. No new credential has been generated, no social channel authorized, no post queued, and no scheduler activated.

## Verified conditions
- Buffer Free supports 3 connected channels, 10 concurrent queued posts/channel, 1 personal API key and 3,000 API requests/30 days (https://buffer.com/pricing).
- API endpoint and GraphQL mutations confirmed against https://developers.buffer.com/guides/your-first-post.html.
- Existing source is the private CRM `SocialPublishing` tab; this module uses the already-bound Apps Script's native Google authorization, **not** the Python bridge's Google service account which would require sharing the entire private CRM.
- `automation/BufferPublisher.gs` is additive code. Current local stage location (authorized Windows PC) is `C:\Users\chere\ChatGPT-Workspace\80-Digital-Platform-Automation\buffer-appsscript-stage-20261018\src\BufferPublisher.js`.
- `node --check` and `node --test automation/test_buffer_publisher.cjs` locally gave **10/10 pass**. Tests are synthetic only, never call real Google or Buffer endpoints.

## One-time owner authorization (must occur in Buffer browser and Apps Script private settings)
1. Create/sign in to Buffer at https://publish.buffer.com/ and connect only eligible owned social identities. Suggested Free initial channels: Družina Moravy Facebook Page, `@druzina_moravy` Instagram, and BrnoWalkers Facebook Page; adjust before authorizing each exact identity. No paid upgrades.
2. In https://publish.buffer.com/settings/api create a *personal API key* with minimal scopes allowing account/channel read and posts write; verify email if required. Set expiration and rotation reminder, no password/token in chat, source code, CI logs or public repo.
3. In the **existing owner-bound Google Apps Script project**, Project Settings -> Script properties, set `BUFFER_API_KEY` privately. Do not paste keys in Google Sheet or send in chat.
4. From the authenticated Apps Script editor run `p80BufferListConnectedChannels()` (read-only); obtain Buffer channel ids and verify exact names + services. Enter property `P80_BUFFER_CHANNELS_JSON` as a JSON object with explicit routes, for example:
   `{"facebook_page|Družina Moravy z.s.":{"id":"BUFFER_CHANNEL_ID","service":"facebook","entity":"Družina Moravy z.s."}}`
   Never substitute another Page or organization. For Instagram use `instagram|Družina Moravy z.s.` and service `instagram`.
5. Keep `P80_BUFFER_ENABLED=false` while reviewing. Call `p80BufferOverview()` and `p80BufferPreview()` to verify connection and candidate eligibility without any post.
6. Add exactly one new owner-reviewed source record (not legacy Metricool ERROR/PENDING or Windsor DELIVERY_UNVERIFIED), with `Status=BUFFER_APPROVED`, `Duplicate_Checked=YES`, `Rights_OK=YES`, `Made_For_Kids=NO`, `Visibility=public`, nonblank `Approved_At`, exact legal Entity+Channel, valid safe Media_URL/Caption, source `Events` Active free future event or approved evergreen `CAMPAIGN-...`, and `Scheduled_At` between now+10m and now+30d, Prague timezone. Read campaign/legal/privacy source facts and verify platform history first.
7. Only after reviewing that record, set `P80_BUFFER_ENABLED=true`, run **one** `p80BufferTick()`; verify `BUFFER_QUEUED` and returned Buffer post ID, then at the scheduled time read the **real public FB/IG permalink** and update `Post_URL` and `PUBLISHED_VERIFIED` once independently confirmed. Queue acceptance is not publishing proof.
8. After a successful pilot and webhook/permalink reconciliation, `p80BufferInstallTrigger()` installs one 15-minute Apps Script trigger. To stop future sends immediately run `p80BufferDisable()`. Trigger installation is NOT done by this staging change.

## Hard idempotency and safety
- The publisher writes `BUFFER_SUBMITTING` + timestamp **before** calling Buffer; ambiguous outcomes go to `DELIVERY_UNVERIFIED` with no replay. After positive API reply, store Buffer post ID and `BUFFER_QUEUED`; public permalink remains empty until verified.
- Same event/entity/channel previously planned, failed, published or delivery-uncertain via other providers blocks a new automatic attempt. This intentionally favors owner review over duplicates.
- New regular *paid* OSVČ HEMA bookings remain suspended pending legal compliance. First rollout denies paid Events automatically. Sponsor grant credit must appear verbatim in caption.
- Existing Telegram publisher and its approved jobs are unaffected. No standalone Google service account or duplicated CRM is authorized.
- Script executes within an Apps Script project whose public web app endpoint exists, but this module provides **no HTTP handler**. Do not add its functions to anonymous `doGet/doPost` dispatch. Treat the project Script Properties and editor access as sensitive.

## Deployment status
As of 18 Oct, this file is committed to the existing **DRAFT PR #32**. Python bridge in the same PR is a **legacy alternative, not the recommended architecture**. Source in the Windows isolated stage can be installed into existing Apps Script only after fresh `clasp pull` and complete file reconciliation to avoid overwriting concurrent changes; read the current HEAD back after any push. Do not merge whole PR to default branch, set GitHub Action secrets or enable any remote cloud schedule merely because these tests pass. If cloud stage is installed while disabled, that is not a live publisher.
