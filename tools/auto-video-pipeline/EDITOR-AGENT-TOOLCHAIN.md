# IMPERION Agent #3 / E09 - canonical video-editing toolchain

**Updated 2026-11-22.** Owner-directed, zero new expense. This is durable guidance for the **existing** MediaMachine / ShortFactory / Agent #3, not a new agent, CRM, scheduled task, publisher or production deployment.

## Verified existing baseline

- [E09 Video Factory / local-first pipeline, merged PR #138](https://github.com/aliaksei-chareshneu/alchareshneu/pull/138): existing video_factory.py and pipeline.py already support local cut proposals, FFmpeg rendering, captions, timed edits, review QA, optional Remotion, and SHA-bound rights clearance. Merged CI is **not** live processing of real private video.
- [Growth Agent #3, merged PR #234](https://github.com/aliaksei-chareshneu/alchareshneu/pull/234) and ops/imperion-agent-team.cjs already have the video function. Do **not** duplicate Agent #3 or the ShortFactory / SocialPublishing queue.
- [Agent Team PR #154](https://github.com/aliaksei-chareshneu/alchareshneu/pull/154) is a draft, not a live deployment.

## Inventory recovered from the owner's attached 56.875-second tutorial

| Tool | Role | Checked status and restriction |
| --- | --- | --- |
| FFmpeg + ffprobe | offline editing, encode, verification | core engine; inspect host with doctor |
| Remotion | editable timeline, React motion/captions | already used by repository pipeline; commercial license eligibility must be checked |
| Whisper or faster-whisper | local speech-to-text/captions | optional; model installation may download files |
| yt-dlp | retrieval of permitted reference footage | optional; no third-party copying or bypass of platform restrictions |
| HyperFrames | motion animation mentioned in tutorial | **identity, license and compatibility NOT VERIFIED**; do not assume free/install |
| Claude Code | tutorial's coding-agent frontend | can be paid; not needed for this local-zero-cost stack |
| Piratex MCP | trend analysis of public videos | **not a video editor**; free credit tier subject to limits; no account connected or credits checked |

Other previously considered candidate tools: PySceneDetect, MoviePy, Kokoro local TTS, Ollama/Qwen local inference; installed YouTube Channel Ops editorial skill. Their installation on the owner's computer is NOT VERIFIED. Do not add packages unless a real workload and test justify it.

## Canonical tool actions (no new subscriptions)

1. READ-ONLY: python editor_agent.py doctor --project /private/video-project
   - Reports detected FFmpeg/ffprobe, Remotion, local Whisper, yt-dlp; HyperFrames and Piratex remain unverified.
   - Does not install, download, render, send or publish.
2. LOCAL PROJECT: python editor_agent.py init --project /private/video-project
   - Creates only project/public, project/out and an editable style.md if missing; never replaces an existing style.md.
   - Place legally cleared local source video under public/; this folder is LOCAL, not a public hosted website.
3. PLAN: python editor_agent.py plan --project /private/video-project --source /private/video-project/public/take.mp4 --topic HEMA --entity DRUZINA_ZS --cta APPROVED_URL
   - The existing E09 Video Factory makes reviewable cut proposals, not an approved creative result. Optional --srt points at an existing transcript.
   - OSVC and DRUZINA_ZS represent different legal controllers; use the correct entity, claims, consent and CTA.
4. EDIT BY FEEDBACK: python editor_agent.py revise --plan /private/video-project/out/plans/PLAN/cut_proposals.json --decisions /private/decisions.json --output /private/video-project/out/plans/revision-001.json
   - Example JSON: {"decisions":[{"clip":1,"action":"keep"},{"clip":2,"action":"change","start":12,"duration":8,"hook":"Verifiable payoff"},{"clip":3,"action":"remove"}]}
   - Outputs a separate plan; does not overwrite the original. Changing timing invalidates and clears old subtitles; redo or review captions.
5. RENDER ONLY WITH INDEPENDENT CLEARANCE: python editor_agent.py render --plan /private/video-project/out/plans/revision-001.json --clearance /private/rights-clearance.json --output /private/video-project/out/renders
   - Delegates to existing video_factory.render with source-hash-bound rights checks (licence, identifiable people, music, minors and guardians).
   - Produces review-only MP4 and QA receipt. **Not posted.**
6. HUMAN/OWNER QA: check image/audio, original factual claim, subtitles, copyright, minors, venue, safety, legal owner, exact CTA and approved URL before passing anything to existing ShortFactory / SocialPublishing.
7. Only after **separate explicit GO** for publication, platform permission and actual provider permalink readback may the operation be recorded as PUBLISHED/VERIFIED. Do not auto-retry a provider operation with unknown result.

## Three repeatable prompts for any coding/editorial agent

A. TOOLING: "Use the existing IMPERION Agent #3/E09. Read this toolchain, inspect doctor and the existing repo tests. Show installed vs missing tools. No paid APIs, installs, scraping, publishing, new queue or CRM."

B. STYLE: "Read my local style.md and two or three permitted reference edits for editorial taste only. Draft a precise shot list with truthful payoff in the first seconds, readable captions and one approved CTA. Do not copy others' footage or assume participant consent."

C. ITERATION: "Apply my keep / change / remove instructions only to the existing E09 cut plan, preserve the original, re-evaluate subtitle timing, render only after rights clearance and return an auditable private preview for review."

## Gate and acceptance

IDEA -> CUT_PROPOSAL -> EDIT_PLAN_REVISED -> MEDIA_RENDERED_REVIEW_REQUIRED -> QC_PASSED -> OWNER_APPROVED -> SCHEDULED -> PUBLISHED -> VERIFIED.

A skill, prompt, merged PR, passing CI, ready MP4, draft, scheduled claim, or platform upload request alone is **not** proof of live video or revenue. This toolchain is intended to minimize owner time and costs, not replace a real viewer/offer/checkout funnel. Zero new external cost is authorized.

Engineering instructions live here; business bookkeeping stays in existing IMPERION 00/01/02/03, never a new duplicate registry. Personal OSVC and nonprofit Druzina Moravy z.s. must remain separate.

## Official sources and legal notes

- Remotion license and pricing: https://www.remotion.dev/docs/license/pricing (free eligibility has conditions; verify correct legal entity)
- yt-dlp upstream license / bundled distribution differences: https://github.com/yt-dlp/yt-dlp/blob/master/README.md
- Piratex MCP free credit limits and account setup: https://piratex.ai/mcp-server
- Current source: user-provided 2026-11-22 tutorial, not independently verified claims about HyperFrames.
