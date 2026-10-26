# Imperion Auto Video Pipeline — local-first, Remotion-ready

Practical pipeline for OSVČ / Družina / BrnoWalkers video production. This **does not publish** and never calls a cloud transcription service or searches/downloads unlicensed stock clips. It reads a locally authorized source file.

## Supported workflow

`VIDEO -> ffprobe / silence detection -> reviewable EDL -> FFmpeg MP4 + captions.srt -> optional Remotion project -> human QA -> platform-specific publication via the existing CRM`

- Finds pauses using FFmpeg `silencedetect`, preserving configurable speech padding.
- Imports `.srt` (timed cues), Whisper JSON `segments[].words`, or generic word/cue JSON. Optional `--local-whisper` runs a separately installed **local** Whisper CLI (first use may download a model).
- Flags filler words and adjacent repeated short phrases. Cuts these **only** when the operator sets the explicit flags, since machine transcription and context can be wrong.
- Re-times subtitles through cuts. Exports a sidecar `.srt` and optionally burns subtitles into MP4.
- Supports optional owned/licensed/permission-granted *local* image inserts with written rights evidence (file manifest).
- Makes an editable Remotion timeline (sequences, clip trims, captions, overlays) when Node dependencies are installed.
- Is idempotent at the planning level: preserves input SHA-256; refuses to render if footage changes unexpectedly.
- Outputs no personal data or video to cloud storage. Existing CRM controls publishing, with human approval and final URL readback.

## Requirements

Python 3.9+, FFmpeg + FFprobe (with libx264; `subtitles` filter for burned subtitles). Node 20+ only for the Remotion option. The project does not require credentials for local FFmpeg mode.

## Run locally

```bash
python3 pipeline.py plan /path/to/your-footage.mp4 --transcript /path/to/words.json --out out/clip-001
# OR, if OpenAI Whisper CLI is already installed: python3 pipeline.py plan footage.mp4 --out out/clip-001 --local-whisper --model small --language ru
python3 pipeline.py render out/clip-001/plan.json
python3 pipeline.py prepare-remotion out/clip-001/plan.json
npm install
npm run studio
npm run render
python3 -m unittest discover -s tests -v
```

For source video without a transcript, omit `--transcript`: silence cuts still work, but no auto-generated captions are claimed. To transcribe **locally**, install a compatible Whisper CLI or use the Remotion Studio/Recorder transcription, export timed `.srt` or word-level JSON, then rerun `plan`. Non-English transcripts require a multilingual speech model; proofread. Do **not** paste API keys into Git.

Optional explicit filler/duplicate edits:

```bash
python3 pipeline.py plan footage.mp4 --transcript whisper-words.json --out out/review --apply-fillers --apply-duplicates
```

Optional B-roll JSON `broll.json` (timings refer to the **edited** video, in seconds):

```json
[
  {"file":"images/my-own-photo.jpg","start":2.0,"end":4.5,"rights":"owned","evidence":"original camera file and participant consent checked"}
]
```

`python3 pipeline.py plan footage.mp4 --out out/review --broll broll.json` will fail closed if a photo or documented permission is missing. The project never searches the internet for arbitrary footage or assumes internet media is reusable. Captions and overlays remain editable in Remotion Studio.

## Batch throughput and QA

Process large local queues with `python3 pipeline.py batch /path/to/footage --out-root out/batch --render`. Same-basename `.json` or `.srt` files are automatically picked up, and SHA-256 job IDs prevent duplicate processing; every job has an isolated `--out` folder (avoid overwriting); do not put private footage or consent records into a public repository. When scaling to hundreds of clips use content hashes and existing CRM Job_IDs for deduplication; don't invent an alternative CRM. No automatic uploads, scheduled tasks, or paid API requests. For each rendered file: watch the cuts, inspect speakers, transcription accuracy, music rights, safety/child consent, 9:16 crop, CTA, audio peak/volume and live destination before marking `VERIFIED` in the existing publishing table. Machine `RENDERED_REVIEW_REQUIRED` is *not* `PUBLISHED`.

## Codex / Remotion plugin

Official installation is in the **ChatGPT desktop app → Plugins → Remotion** (availability depends on account/workspace). In Codex open a project and invoke `$remotion`. The Remotion project here is standard TypeScript and doesn't require the plugin to exist before planning. Remotion dependencies were not installed in the delivery environment; run `npm install` and verify Studio/render on your computer before release.

Remotion: https://www.remotion.dev/docs/ai/codex-plugin | https://www.remotion.dev/docs/videos/ | https://www.remotion.dev/docs/render

## Limitations / gates

- Duplicate-removal heuristics are conservative, not a semantic editor. Phrase deletions beyond consecutive short cues need a reviewer.
- Auto narration identification, stock discovery, audio dubbing and multichannel publishing are **not implemented**. Licensed external asset search requires separate connected sources and rights validation.
- Don't use third-party tutorial footage or personal information as a public demo without explicit rights.
- The FFmpeg fallback has no face tracking, smart reframing, or creative transitions.
