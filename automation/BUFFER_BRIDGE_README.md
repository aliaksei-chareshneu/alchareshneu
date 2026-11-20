# IMPERION Buffer bridge (staging; not deployed)

**Do not use Metricool for new posts.** This integration reads the existing
Google Sheets tab `SocialPublishing` within the canonical private CRM workbook;
it creates **no second publishing queue**.

## State on 2026-10-17
Source staged on GitHub only. No Buffer account/API key/channel IDs connected.
No live publish, login, scheduler execution or verified published permalink.
A GitHub Action exists, but the job stays disabled until a repository owner sets
`IMPERION_BUFFER_ENABLED=true`. The PR must also be deliberately merged into
GitHub's default branch if scheduled runs are desired; a merge into a separate
Pages branch alone will not activate GitHub schedule.

## Actual activation gates
1. The owner signs up for Buffer (Free: up to 3 social channels, 10 scheduled
   posts per channel), connects **owned** eligible Facebook/Instagram/
   LinkedIn or other supported channels, creates personal API key, determines
   IDs through official GraphQL API. No paid upgrade.
2. The owner explicitly approves what should access the private CRM.
   The GitHub Actions variant requires a dedicated minimally privileged
   Google service account **shared with the whole existing workbook**;
   Google Sheets generally cannot grant tab-only API read permissions. This is
   a meaningful privacy/access tradeoff; prefer a trusted local executor instead
   when feasible. Keep any key/service account out of the repository.
3. If cloud runs are authorized: put secrets in GitHub Actions:
   `IMPERION_SPREADSHEET_ID`,
   `GOOGLE_SERVICE_ACCOUNT_JSON`,
   `BUFFER_API_KEY`,
   `BUFFER_CHANNEL_MAP_JSON` (for example
   `{"facebook_page":{"id":"buffer-profile-id","entity":"Družina Moravy z.s."}}`).
   Create variable `IMPERION_BUFFER_ENABLED=true` **only after approval**.
4. Never blanket-autoapprove posts. Individual row must have:
   `Status=BUFFER_APPROVED`, `Duplicate_Checked=YES` after checking real
   channel/Metricool history, `Rights_OK=YES`, explicit `Approved_At`,
   `Visibility=public`, exact `Entity` match. Source scheduled time is
   interpreted in `Europe/Prague`, 10min-30days ahead. No kids' assets
   or videos in this text/image-only first rollout.
5. Execute dry run manually first: `python automation/social_buffer_bridge.py`
   using local approved credentials. Then authorise one deliberate live test with
   `--publish` and verify **Buffer Post_ID** in original row and actual
   Facebook/Instagram permalink separately. Queue success != publication.

## Idempotency and failure
- Never requeue `Post_ID` present, Metricool PENDING/ERROR, DRAFT, or
  `BUFFER_SUBMITTING`. At most one fully approved row per run.
- Before the Buffer network call, original sheet Status becomes
  `BUFFER_SUBMITTING`; if the network result is ambiguous, STOP and reconcile
  provider manually. Do not retry as the provider may already have queued it.
- On confirmed Buffer success Status becomes `BUFFER_QUEUED`, Post_ID saved in
  column J, but **Post_URL remains empty** until public sent link is confirmed.
- Does **not** migrate/disable existing Metricool queued posts. Check them
  separately in original provider to prevent duplicates; do not upgrade plan.

Official sources:
- https://buffer.com/pricing
- https://developers.buffer.com/guides/your-first-post.html
- https://developers.buffer.com/examples/create-image-post.html
