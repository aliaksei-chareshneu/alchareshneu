# Publicity failover — Meta Instagram (DRAFT, DISABLED)

**Status 16 Oct 2026: Built as a reviewable PR; it is NOT deployed, connected or publishing anything.**

## Why this exists
Metricool brand `chareshneu` (brand 7304621) returned
`You have reached your Metricool account limit.`
for Instagram post **392634955** (Mariánské údolí 18 Oct) and
**392634965** (HEMA + archery 21 Oct).
Other Facebook reminders are *PENDING* in Metricool; this worker must NOT duplicate them.
The two image-based Instagram drafts are listed in `queue.json` with approved/safety flags **false**.

## Mechanism (once deliberately enabled)
1. GitHub Actions checks the queue twice daily, or runs manually.
2. Each item must be **explicitly approved** and **safety-cleared**, and the event must not have expired.
3. HEMA/archery also requires operator verification of insurance via a protected GitHub variable.
4. Publisher checks Instagram's recent media for a unique campaign hashtag marker.
5. If no duplicate appears, it creates an IG image media container, waits until it is FINISHED, publishes via official Meta Graph API, and prints the returned IG media ID.
6. Errors make the workflow fail visibly. **Do not count scheduled/dry-run/created media as published.**

## Activation checklist — requires owner approval
- [ ] Confirm organisation insurance cover and safety/capacity for advertised events. Do NOT enable posts that cannot be safely delivered.
- [ ] Review imagery, facts, date/time, exact public venue, grants-publicity copy and each `caption` in `queue.json`; set `approved`: true and `safety_cleared`: true ONLY after actual approval.
- [ ] Verify @chareshneu is an **Instagram professional account** eligible for Graph API content publishing, with Meta permissions/app setup. There may be an additional Meta app review requirement.
- [ ] Add GitHub repository **secrets** `IG_BUSINESS_ID` and `IG_GRAPH_TOKEN` (Instagram user ID and permitted long-lived access token). Never commit a token or send it in email/chat. Follow Meta token expiry/rotation.
- [ ] Set repository **variable** `PUBLICITY_ENABLED=true`; for HEMA only after real document verification set `PUBLICITY_INSURANCE_VERIFIED=true`. There is no default activation.
- [ ] Manually test on a **different explicitly approved low-risk test post** first, using Actions -> Publicity failover -> Run workflow. Check live IG post and unique marker, no duplicate.
- [ ] After approval merge PR to main; scheduled GitHub Actions only run from the default branch. Main is **NOT** the public Pages production branch; this workflow does not deploy the website.

## Contents and limits
- `publish.py`: Python 3.11 standard-library worker; only Instagram **image** posts. It cannot create new tokens, connect Meta, perform sign-in, or bypass quotas. It does not replace Facebook/GBP/scheduled Stories publishing.
- `queue.json`: two **not approved** posts only, with source images already used in Metricool. Existing future Facebook reminders must remain on their original schedule and have their status checked separately.
- `.github/workflows/publicity-failover.yml`: schedule and manual trigger, fail-closed.
- `--self-test`: local unit checks for disabled/approved/insurance/expiration logic.

## Operational rule
Verify *actual* publication by retrieving a media ID/live profile post.
If Meta or Metricool fails, do not silently mark an event as promoted. Keep the manual fallback in the existing Calendar and use the separately connected social-media app only after it is connected and authorized. No personal private Google Drive data, customer records, contracts, or keys belong in this public repository.
