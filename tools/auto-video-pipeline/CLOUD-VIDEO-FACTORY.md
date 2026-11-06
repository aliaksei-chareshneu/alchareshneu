# IMPERION Video Factory — cloud runner (GitHub Actions)

The cloud worker runs on a temporary **GitHub-hosted Ubuntu runner**, **not** on the user's computer `zmrzlina`. The code is staged in the existing draft video pipeline PR; no alternate publishing CRM or scheduler has been created.

## What runs already when PR CI succeeds

- The existing Remotion workflow validates the original editor and renders a synthetic source.
- Its `Video Factory synthetic cloud render` step calls `cloud_demo.py` using `video_factory.py` from the existing IMPERION Video Factory ZIP.
- The flow actually generates a 4-second synthetic test pattern, proposes a timecoded 3-second cut, records source SHA-256, renders a H.264/AAC **1080x1920** review MP4 with a hook caption, then asserts resolution, review state and checksum.
- It publishes only a **GitHub Actions build artifact** for inspecting that synthetic test, not a social video. A GitHub artifact is not the equivalent of a post or a private media storage vault. The smoke source has no identifiable people and no outside copyrighted content.

## How it becomes unattended for OWN source footage

A public GitHub repository is not a safe place to upload private event footage or participant consent documents. The following production inputs remain intentionally disconnected until independently configured and verified:

1. Approved **private** cloud source storage (an existing private Drive/shared-drive folder or equivalent); authenticated, least-privilege read into an **authorized private job runner**, not a public Actions PR or public artifact.
2. A rights/consents ledger for the exact source SHA-256 (including recognizable persons, music, minors/guardian consent), stored privately.
3. A production queue that selects an approved source and passes it into the same `video_factory.py` **plan -> editorial check -> render** stages. No rights state is inferred from video contents or a YouTube URL.
4. Secure output back into existing private MediaMachine storage; preserve metadata and original source hash; do not publish to social networks from the render job.
5. A protected timer/webhook to call the production runner after the storage+permissions check. GitHub Actions `schedule` is only active on a default branch; nothing in this draft PR is a persistent 24/7 server. Ephemeral jobs end after each run, but do not depend on the user's PC while executing.

## 11 YouTube Skills

The installed ChatGPT skill `youtube-channel-ops` has 11 editorial workflows / 21 opening-hook patterns. They assist with hooks, narrative, titles, transcript-based cut decisions, SEO, retention and post-publication audit. They are **not** a callable GitHub Actions runtime or a self-hosted LLM, so the cloud runner implements real FFmpeg plan/render/QA only. An authenticated editorial-agent integration is a separate future step; heuristics are not verified predictions of viral reach.

## No-go protections

- No automatic scraping/download of third-party YouTube/Facebook videos, or assumed fair-use safe duration.
- No real media shipped to a public GitHub repo or artifact, no private credentials in source, no paid video-provider calls.
- No automatic Metricool retries while quotas/holds apply, no new publishing system, no unreviewed posting.
- GitHub Actions success proves **cloud synthetic render**, not the flow for a real private video, private Drive access, consent, social publication or conversion.

## Operator evidence

Inspect the `Video Factory synthetic cloud render` step of the existing GitHub Actions `Auto video pipeline` workflow and its `video-factory-synthetic-review` artifact. The artifact contains `CLOUD_RUN_RECEIPT.json`, `QA.json`, `cut_proposals.json`, and a real review-only `.mp4`.