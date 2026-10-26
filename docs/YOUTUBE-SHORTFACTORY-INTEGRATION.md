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


## Owned video → Shorts: timecodes from Claude / Everygen (2026-10-22)

**Implemented in the same draft PR #67:** \`owned_video_shorts.py\` and \`tests/test_owned_video_shorts.py\`. A local **owned/cleared file**, plus an editor-reviewed JSON of timecoded cut ideas, becomes up to five **1080×1920 MP4 drafts**; optional SRT subtitle sidecars, exact SHA-256 provenance and an immutable per-clip manifest. The default is PREVIEW ONLY. No cloud calls, Everygen credits, YouTube download, CRM write, publishing or approval. A source clip generated by a paid external tool is still treated as an untrusted input and must pass the same provenance/rightsholder/review gates.

**Safe operator handoff:**
1. Supply your OWN local source file (MP4/MOV/MKV/WEBM). Verify rights, music, recognizable people and guardian consents before marking rights flags true. No anonymous faces or recording permissions should be guessed by AI.
2. Give Claude the timecoded transcript / actual shot notes (NOT just a URL) and the following prompt. Its JSON is a **proposal, not consent evidence**.
3. Keep the \`rights_status\` and clearance booleans UNKNOWN/FALSE until a human actually verifies them; validate source length and clip windows before rendering.
4. Preview: \`python owned_video_shorts.py --source "C:\Users\chere\Videos\OWNED.mp4" --spec cuts.json\`
5. Render explicitly: \`python owned_video_shorts.py --source "C:\Users\chere\Videos\OWNED.mp4" --spec cuts.json --render\`
6. On Windows if FFmpeg is installed only under WinGet, supply \`--ffmpeg "FULL_PATH_TO_ffmpeg.exe" --ffprobe "FULL_PATH_TO_ffprobe.exe"\`. The output folder defaults to existing \`MoravianHost\MediaMachine\Drafts\<slug>\`; never put credentials or private consent documents in the JSON.
7. Review actual audio, cropping/letterboxing, any subtitles (exported as an SRT, **not burned into the MP4**), names, offers and claims. Then re-ingest into the original MediaMachine workflow and follow the existing SQLite approval gate and canonical SocialPublishing dedup. This cutter's JSON is **NOT** an approved publish_manifest for the existing bridge.

**Claude prompt (EN; useful with uploaded media or a trustworthy timed transcript):**

> You are the editor for MY rights-cleared footage. Based ONLY on the supplied timecoded transcript and visual shot notes, propose 1–5 self-contained Shorts with a concrete opening hook, one meaningful original insight, and one truthful CTA for the stated OSVČ/NGO audience. Return valid JSON: slug (safe lowercase), rights_status (use "unknown"), rights_basis (use "UNVERIFIED"), people_consents_checked (false), music_rights_checked (false), contains_minors (true if unknown, otherwise accurately indicate), clips (array of objects: start seconds, duration seconds 2–59, title, caption, cta, optional subtitles as relative start/end/text). Never invent timestamps, consent, dates, prices, buyers, or events; do not reuse third-party clips. If footage or timed transcript is not actually supplied, explain the missing input rather than guessing clip timings. **Do not mark any approval or published status.**

**Human authorisation:** Only after genuine evidence of ownership/license, music rights, privacy/consent, truth of dates/prices/CTA, and matching legal entity can the fields be changed to a passing input. Claude or Everygen cannot certify those rights. The code deliberately rejects \`rights_status=unknown\`, missing/false clearances, out-of-range/overlapping subtitle timings, untrusted command strings as timestamps and duplicate windows. Outputs always have \`DRAFT_NEEDS_EDITORIAL_REVIEW\`, \`approved=false\`, \`published=false\`.

**Money/measurement:** prioritize genuine Academy/B2B or club opt-ins; view count is not CASH. ShortFactory export → human review → existing publisher receipt → qualified inquiry → booked/paid. YouTube may refuse Shorts monetization for reused/mass-template content even with rights; see https://support.google.com/youtube/answer/1311392 . Everygen's optional remote MCP (https://everygen.ai/api/mcp) can be connected later by the account owner if the incremental gain exceeds credit and rights-review costs. **It is NOT installed or authenticated by this patch.**


## 2026-10-26: canonical intake repaired — paid enquiry lens, draft-only

**Problem fixed:** `shortfactory_idea_worker.py` previously searched for generic CSV keys `title` and `source_url`, but the EXISTING scored trend feed uses `title_or_topic` and `source_reference`. The daily worker could therefore produce zero ideas even with a populated trend feed. The worker now accepts both schemas, deduplicates by source URL even when a headline changes, and carries an explicit content lane and CTA review gate.

**Do not add a second scheduler.** The existing `run_shortfactory_daily.ps1` ALREADY invokes `shortfactory_idea_worker.py --trends ... --ideas ...` before `shortfactory_autopilot.py`. The separate `trend_refresh_runner.py` only refreshes and scores trend metadata; do not also invoke the idea worker there.

**Practical production path:**
1. Trend discovery and metadata scoring produce the existing `trend_candidates.auto.csv`. Optional external research can be supplied *manually* as a CSV with `title,source_url,lane`, but only after verifying export rights and provenance; no TrendSee API key, account access, scraping integration or license is assumed.
2. Existing daily run reads the scored file and writes local `ideas/<stable-source-id>.json` records. Each idea is **UNVERIFIED**, has `rights_verified=false`, `fact_checked=false`, `approved_for_render=false`, `approved_for_publication=false`. Metadata is untrusted input and cannot automatically grant approval.
3. `SCIENCE_EXPERT` ideas carry `QUALIFY_OSVC_PAID_EXPERT_OR_TRAINING_INQUIRY`; `HEMA_HISTORY` is interest-only until a real safe product/event is verified; `URBAN_WALK` requires current event+signup verification; other topics stay editorial only. These are internal intentions, **not publishable CTAs**.
4. A human verifies claims, exact service, seller legal entity, available buyer budget and original footage/media rights before preparing a script. For source-owned original text-only videos use `original_reel_builder.py --preview`, then a review-only render. Do not take reference video clips from trend sources.
5. Existing reviewed SQLite job + `shortfactory_social_stage.py` provides only private draft handoff, never bypasses channel permissions or monthly Metricool quota. A real platform post ID and URL are required before `PUBLISHED_VERIFIED`, and an actual paid order/bank receipt must be read back before `CONTRACTED`/`CASH`.

**Verification:** `python -m unittest discover -s tests -p 'test_shortfactory_idea_worker_integration.py' -v`. The CI workflow now runs this suite and compiles the updated worker. GitHub CI passing establishes source/test validity, **not installation on zmrzlina or public video production**. Desktop Commander monthly command quota currently prevents live PC readback/activation; no retry or alternative account bypass is authorized.
