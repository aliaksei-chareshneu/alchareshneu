# ShortFactory: YouTube trends adapter (2026-10-22)

This patch extends the EXISTING MoravianHost/ShortFactory pipeline. It does not create a new CRM, public website, publisher, cloud account, agent task queue or scheduler.

## Installation and workflow

- Installed in the existing PC ShortFactory folder next to trend_discover.py, trend_score.py, distribution_bridge.py and trend_refresh_runner.py.
- Existing MoravianHost ShortFactory Trends Windows task runs trend_refresh_runner.py; the Wikimedia feed and feedback scorer continue unchanged even without YouTube.
- Without an authorized YOUTUBE_API_KEY environment variable, YouTube lookup is skipped (SKIPPED_NO_API_KEY). No credentials in source, logs, or GitHub.
- Once a YouTube Data API credential is supplied securely to the existing scheduled process, the adapter uses the official videos.list chart=mostPopular metadata API for CZ and US; region and result limit are configurable. This does NOT download video.
- Metadata joins the existing trend_candidates.auto.csv. Existing non-YouTube candidates are preserved, with atomic CSV write after API responses and schema validation. De-duplicate YouTube video IDs.
- Every YouTube idea is tagged rights_status=unknown and status=IDEA_NEEDS_ANGLE_AND_RIGHTS, even when API claims a Creative Commons license. Do not send watch page URLs to the video renderer as input files.
- Use the established local SHA-256 ingest, rights-reviewed job queue, 1080x1920 renderer, batch review, approved-only distribution manifest, publisher receipt and 24h/72h metrics.

## Verification

On authorized Windows PC from the existing ShortFactory directory:

    python -m unittest test_youtube_trend_intake -v
    python youtube_trend_intake.py --dry-run

On GitHub CI:

    python -m unittest discover -s tests -p 'test_*.py' -v

No license/consent or cross-platform publication can be inferred from an API chart entry or clip duration. Third-party reuse requires case-specific license or legal rights review, music and people clearances, permitted official platform API and explicit editorial review. Genuine commentary is not automatically legal fair use.

## Integration boundaries

- Public website: existing GitHub Pages website and existing four audience routes. No new domain or public rebranding.
- CRM: existing Google Sheets/Apps Script Community Hub (leads, source, event and attendance). No separate contact database.
- Distribution: existing channel-permission register, approved SocialPublishing queue, opt-out and dedup rules. Manifest = queue request, NOT a published post.
- Astra: existing canonical AUTOMATION CONTROL agent executable queue, no duplicate issue/task tracker.
- Accounts: NGO and OSVC funds, bank accounts, consents and legal membership records remain separate.
- Publication: existing Buffer/Metricoool/Windsor integrations must be verified with per-account access, current limits, rights and public permalink proof before marking PUBLISHED_VERIFIED. Current Metricool free limit must not be bypassed via auto retries.
- No HEMA paid-booking or ad launch until seller licensing, insurance, capacity, price and legal GO are proven.

## Remaining activation gates

1. Verified YouTube Data API key and allowed quota; the code is intentionally dormant without it.
2. Video sources with independent license, music/people consent and SHA-256 evidence.
3. Tested approved platform channel credentials + duplicate checks + received public post URLs.
4. Approved advertising budgets and conversion tracking to the canonical CRM.
5. Verified bank receipts for CASH; an ad click or view is not a paid client.

Official references: https://developers.google.com/youtube/v3/docs/videos/list and https://www.youtube.com/t/terms


## Approved ShortFactory -> canonical SocialPublishing handoff

1. From existing ShortFactory folder run: python distribution_bridge.py manifest
2. Choose the **real** legal entity for the asset and campaign, separately for OSVC or DRUZINA_ZS.
3. Run: python shortfactory_social_stage.py --manifest publish_manifest.json --entity DRUZINA_ZS --output SocialPublishing-review.csv
4. A local CSV with the **exact existing 20 SocialPublishing column names** is staged, never pushed to the cloud automatically. No new spreadsheet/CRM is created.
5. The mapping is fail-closed. Every row is DRAFT/private. Channel is only an alias, not an authenticated recipient. Blank fields include Rights_OK, Duplicate_Checked, Approved_At, Media_URL, Video_Drive_ID, Scheduled_At, Made_For_Kids, Post_ID and Post_URL.
6. Operator must use the existing Community Hub SocialPublishing sheet to verify whether Job_ID already exists, check channel permissions (canonical distribution register), map the actual publisher account, secure file hosting, audience and consent, explicit grant/sponsor terms, campaign date/budget, then obtain explicit release approval. Never bulk-import a staging CSV as approved/scheduled content.
7. Only after a permitted sender reports live public permalink can a post be marked PUBLISHED_VERIFIED and recorded in the existing ShortFactory distribution_bridge.py record-post flow; client conversions remain with the same Community Hub CRM.

No real SocialPublishing rows or public posts were created in this work. The staged CSV contains only reviewed caption and route metadata; no private local source paths, secrets, person/customer records, or content exports are sent to GitHub or Google by the adapter.

Offline tests: python -m unittest test_youtube_trend_intake test_shortfactory_social_stage -v ; 11/11 pass on zmrzlina 2026-10-22.

## Original scripts to vertical video (rights-safe input producer)

This component is an INPUT to existing ShortFactory, not a substitute queue/editor/publisher.

1. Place `original_reel_builder.py` next to the existing ShortFactory tools; install the free Pillow Python package in the existing environment and use the existing WinGet FFmpeg.
2. Start with `examples/original_reel_demo.json`. Write 2–6 original editorial panels; no third-party images, audio, logo or copied video.
3. Preview the script with `python original_reel_builder.py --script examples/original_reel_demo.json --preview`. This neither renders nor publishes.
4. Render a review-only draft with `python original_reel_builder.py --script examples/original_reel_demo.json --output C:/Users/chere/MoravianHost/MediaMachine/Drafts/original-demo.mp4`.
5. The PNG/FFmpeg renderer creates 1080x1920 MP4 and a same-path .mp4.json sidecar with video+script SHA256, creation timestamp and explicit NOT_PUBLISHED status; no overwrite. Review claims, actual seller, organizational media rights and audience suitability.
6. If approved for ShortFactory source intake, queue the draft using the EXISTING `short_factory.py queue --source ... --start ... --duration ... --rights owned --hook ...` interface only after real editorial review. Continue to the existing batch review, approved-only publisher manifest, SQLite-gated SocialPublishing draft and provider receipt.
7. **2026-10-22 status:** a real 9-second 1080x1920 example MP4 was rendered and ffprobe-verified in the ChatGPT execution container; `original_reel_builder.py` and its tests are committed in this DRAFT PR. The updated original text renderer and upgraded SQLite-gated social adapter are **NOT YET INSTALLED on zmrzlina** after the PC went offline; do not mistake GitHub source tests for live Windows deployment or scheduled content creation.

The original-video demo contains a generic AI/data workflow concept, no client testimonial and no claim of measured savings. It is not an actual advertisement or published video. No video upload, real contact, payment, or ad budget has occurred.

## Canonical source verification added

The `shortfactory_social_stage.py` runner now requires the **existing** `media_index.sqlite` in read-only mode. It validates stored job status, actual review timestamp, exact approved media path, rights state, approved destination, reviewed caption, and no prior same-platform entry in `short_posts`. A modified manifest with `approved=true` alone cannot authorize a draft. An additional review against the live `SocialPublishing.Job_ID` source is required before importing even draft rows; local database and cloud are not identical duplicate sets.

`python shortfactory_social_stage.py --manifest publish_manifest.json --entity OSVC --db ../media_index.sqlite --output SocialPublishing-review.csv`

Only the file-creation/gating logic is covered by this patch. It does not write the live CRM or call publisher APIs.


## First two REAL campaign drafts and correction to event gate (2026-10-22)

**NO scheduled or published video.** Both scripts use the existing `original_reel_builder.py`, are 12-second original text-only 1080×1920 H.264 review drafts with SHA256 sidecars and a visible `ORIGINAL · REVIEW REQUIRED` lower third. No third-party footage, audio or participant images are used. A human must approve each before any ShortFactory distribution manifest.

- **BrnoWalkers, verified Active/free event:** `examples/brnowalkers_hady_20261101.json`, canonical Event_ID `PUB-HIKE-20261101`. Sunday 2026-11-01 meet 12:45 Velká Klajdovka; Hády → Růženin lom → Obřany, ~7–9 km, finish ~16:15, free. BUT this event has multiple existing `SocialPublishing` records including previously verified published Facebook/Telegram posts, scheduled Facebook+Instagram, and manually prepared WhatsApp; check dedup before approving an additional video. Current sources disagree on join CTA (WhatsApp in CRM Events, Telegram in planned Metricool); select the actual approved CTA before release.
- **Družina Moravy, safe INTEREST-ONLY lead creative:** `examples/druzina_join_interest_20261022.json`. No event date, promise of a session, reservation, grant credit, or payment. Only asks for a **non-binding enquiry** via the existing `/druzina/join/?lang=cs` form. Existing Metricool Nov 7 safe club-interest Facebook post is already scheduled; avoid duplicating its audience/time unless separately approved.

**Important correction:** Earlier source and local MP4 for `PUB-OREL-20261114` were based on a stale `Events.Status=Active` row. The owner's 2026-10-22 emails explicitly say **the 14 Nov HEMA workshop is NOT finally confirmed** and ask partners to retract dated flyers pending instructors, insurance, safe capacity, and relevant grant approval. Live Community Hub `Events!B20` was changed to `Draft` (the existing validated option), and `Events!K20` prefixed with the hold notice. Canonical `SocialPublishing` rows 35/40/41 already show `HOLD_GRANT_SAFETY`. Metricool event-specific posts are currently `draft=true`, while the Nov 7 Facebook post is rewritten as safe club interest only. The previously created dated `druzina_orel_20261114.mp4` remains only an **internal HOLD/DO NOT PUBLISH** preview; its JSON script was REMOVED from the PR branch and replaced with the interest-only script. Never revive the dated ad solely because a date appears on the calendar. This is not a cancellation of the event, only a publication block until the owner verifies the gates.

The drafts were generated/visually inspected in the chat execution container, NOT installed to offline `zmrzlina`, NOT added to real SocialPublishing queue, NOT uploaded to Drive/Metricool/YouTube, and NOT booked with anyone. `ShortFactory integration tests` CI on the PR validates all scripts in preview mode, plus actual MP4 codec/resolution on synthetic fixtures. Website `Site quality` failures are inherited from `growth-experience` and unrelated to these source scripts. Source confidentiality and separate NGO/OSVC roles preserved.
