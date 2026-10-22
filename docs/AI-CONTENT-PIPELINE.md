# IMPERION AI content adapters (2026-10-22)

**Stage:** source adapter implemented and unit tested; external production inference and publishing NOT activated. Existing source of truth is still the Google Sheets **SocialPublishing** row (plus its owning Events record), not these files. This pipeline neither publishes nor creates a second queue. The generated JSON is only a draft for review by the same owner and current publishing process.

## Use now without cost / external calls

The input is a *manually approved PUBLIC snapshot* of one existing SocialPublishing row. The `job_id` must exactly equal its current `Job_ID` (the checked-in fixture is synthetic, not an event). The legal owner/seller must not be inferred from channel, and the user must explicitly review media rights and personal data before enabling external AI.

```powershell
node ops/ai-content-pipeline.cjs --input ops/ai-content-synthetic.json --image
node ops/ai-local-smoke.cjs                # zero network calls and no new files
node --test tests/ai-content-pipeline.test.cjs tests/ai-local-smoke.test.cjs
```

The preview returns targets CZ/EN/RU/UK and a no-text image concept, but performs zero network requests and produces zero public posts. The output's `source_fingerprint` can be compared with the actual originating row before copying any approved draft back to that same row. Never overwrite an existing result file. `--output <local-private-path>.json` is optional; no file is written without it.

## Local Hy-MT2 translation (once zmrzlina is ONLINE)

Official Windows llama.cpp model distribution: https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF ; Q4_K_M file ~1.13 GB, Apache-2.0. On a local Windows terminal:

```powershell
# Only after the authorized Windows PC is connected and the script inspected:
.\ops\hymt2-windows.ps1 -Install     # free llama.cpp package; NO model download yet
.\ops\hymt2-windows.ps1 -Serve       # starts loopback server; downloads Q4 model if absent
# In a second terminal:
.\ops\hymt2-windows.ps1 -Probe
```

Once `-Probe` reports an actual model ID, run a SINGLE local-only end-to-end check: `node ops/ai-local-smoke.cjs --local`. This runs the synthetic public fixture, requests `/v1/models` and then three localhost-only translations. Results include fact-token checks and a mandatory `HUMAN_REVIEW_REQUIRED` label. On malformed responses or missing facts it fails/blocks; no external API key, no billing, no publishing, no customer record. Plain `node ops/ai-local-smoke.cjs` makes ZERO network calls, even if the model is installed. The smoke is deliberately not a translation-quality benchmark and not a production publish trigger.

The script is opt-in and has no automatic scheduled startup. Official manual equivalent: `winget install llama.cpp`, then `llama serve -hf tencent/Hy-MT2-1.8B-GGUF:Q4_K_M --host 127.0.0.1 --port 8000`. Script execution has NOT been tested on Windows, as `zmrzlina` was offline.

Verify the actual version's CLI flags before running. The model is downloaded to the local inference cache only after this launch. Never expose the server port to the public network. Test `http://127.0.0.1:8000/v1/models`; if the installed binary uses a different model identifier set `HYMT2_MODEL` to its reported ID. No weights have been downloaded or installed on zmrzlina by this PR; the machine was offline when checked.

To create *local-only* draft translations (no paid cloud calls), run:

```powershell
node ops/ai-content-pipeline.cjs --input <approved-existing-row.json> --live --translation hy-mt2 --output <private-draft.json>
```

Validation blocks unknown rights, internal/private material, non-public source approval, already verified publication, missing owner identity and unsupported locales. Outputs are `REVIEW_REQUIRED` or `QA_BLOCKED`, never `PUBLISHED_VERIFIED`.

## Optional paid remote providers (OFF by default)

- Xiaomi MiMo V2.6: `MIMO_API_KEY`, optional `MIMO_MODEL=mimo-v2.6-flash` (or `mimo-v2.6-pro`). Public official API `https://api.xiaomimimo.com/v1/chat/completions`.
- Qwen-Image-2.1-Turbo: `DASHSCOPE_API_KEY`; official QwenCloud Singapore image-generation endpoint. A response contains an expiring HTTPS asset URL, not an image committed to the website. Download/store through the existing approved media asset process before URL expiry. Do not treat it as a published asset or an editable Photoshop PSD.
- Two explicit environment gates are required for billed calls: `IMPERION_AI_OUTBOUND_APPROVED=1` and `IMPERION_AI_PAID_APPROVED=1`; in the existing row snapshot, set `external_ai_approved=true`, and for image generation `image_rights_approved=true`. Store all keys in OS secret storage, never in Sheets/GitHub. These switches are NOT set by this change. One Qwen image maximum per approved job (n=1); MiMo outputs are limited to 1200 tokens per request. Provider billing is not capped in CZK by this software; do not switch the paid gates on without an owner-approved billing budget and provider account status.

```powershell
node ops/ai-content-pipeline.cjs --input <approved-existing-row.json> --live --translation mimo --rewrite --image --output <private-draft.json>
```

Do not upload participant, minor, lead, HR, financial, grant or private event information to these providers. `PUBLIC_APPROVED` is an attestation by the operator, not AI-based private-data detection. The pipeline deliberately makes no calls automatically from Gmail or a live CRM.

## Existing pipeline integration / acceptance

`Events` and `SocialPublishing` remain the only authoritative event and publication records. For each `Job_ID`, collect public approved facts, consent and permission from the existing owner, generate a draft, have a human review translations and artwork, and then use the existing publisher *only after* its own channel permissions, event/legal/safety, duplicate and scheduled-release gates. Store a verified provider post ID, public URL and outcome only after actual readback in the same existing row and execution receipt; never count a generated candidate or a queue entry as sent/published. If content changes after approval, compare `source_fingerprint` and regenerate or reject as stale. Do not automatically schedule repeated generation when the provider is unavailable.

**Acceptance evidence at this stage:** local Node unit tests with mocked HTTP cover four locale slots, no network in preview, no output publication, rights/privacy gates, paid API gates, MiMo/Qwen request shapes, local Hy-MT2 request, missing protected numeric/URL facts, no hidden paid fallback. These are simulation tests, not live vendor inference or conversion evidence.

**REEVALUATE:** REA/reverse-engineering tool has no link to the current outbound publication goal; do not install or run on untrusted software without a specific authorized security task.

Sources: https://mimo.mi.com/docs/quick-start/model ; https://huggingface.co/tencent/Hy-MT2-1.8B-GGUF ; https://docs.qwencloud.com/developer-guides/image-generation/text-to-image .


## Optional OFFLINE PhotoCraft media finishing stage — experimental, 2026-10-22

This is a **local finishing/conversion step for an existing SocialPublishing.Job_ID**, not another generator, publishing queue, cloud provider or CRM. It accepts the same PUBLIC_APPROVED synthetic/owner-reviewed job contract as ops/ai-content-pipeline.cjs. The image_rights_approved=true gate is required. Supported input extensions: PNG, JPG, JPEG, PSD; output: a **new PNG** inside one private staging directory. The Node wrapper makes no network requests. PhotoCraft remains early alpha and its real binary is NOT installed/tested on offline zmrzlina as of 22 Oct 2026.

Official upstream syntax: photocraft-cli convert IN OUT (confirm --help on the actual binary): https://github.com/storytold/photocraft/blob/main/book/src/automation/cli.md . Install from reviewed official releases with verified checksums: https://github.com/storytold/photocraft/blob/main/book/src/getting-started/installation.md .

**Dry preview first** on an authorized local device, with an existing approved job snapshot, rights-cleared image and a private staging directory. All paths must be absolute and remain inside the staging directory:

    node ops/ai-media-local.cjs --root PRIVATE_ABSOLUTE_STAGE --job PUBLIC_APPROVED_JOB.json --input OWNED_IMAGE.png --output NEW_DRAFT.png

After verifying a real PhotoCraft CLI (not via automatic installer), opt into exactly one conversion:

    node ops/ai-media-local.cjs --root PRIVATE_ABSOLUTE_STAGE --job PUBLIC_APPROVED_JOB.json --input OWNED_IMAGE.png --output NEW_DRAFT.png --run --cli ABSOLUTE_PATH_TO_VERIFIED_PHOTOCRAFT_CLI

The stage blocks path traversal, symlink escapes, missing public approval/media rights, previously published jobs, non-PNG final files, invalid dimensions, and overwrite of existing output. It stages a temporary file, then performs exclusive-copy finalization; reports only filename, SHA256, dimensions, bytes and MEDIA_QA_REQUIRED. It **does not** publish, send, schedule, upload or modify any CRM; human visual review and verified SocialPublishing source fingerprint are mandatory. The subprocess receives a reduced environment without cloud model/API keys, but the executable and inputs still need independent security review.

Run: node --test tests/ai-media-local.test.cjs . These tests use a **mock PhotoCraft CLI**, and cover preview, approval gates, safe paths, no clobber, mocked conversion and cleanup after failures. A passing test is NOT proof of an installed or production-capable PhotoCraft binary.

## Alook and REA scope (not activated)

Alook provides hosted rooms and messaging to reach local coding agents. It can create an additional external trust/permission boundary and persistent communications layer; it is **not** the owner of agent jobs, CRM or any business outcomes. The authorized PC is offline, so no Alook daemon, room, token or agent permission was configured. If accepted later, test only with a sandbox agent with NO access to Gmail, Drive private files, production Supabase/admin tokens or destructive commands. Always keep the existing IMPERION_Agent_Jobs and Execution_Receipts as canonical. Official source: https://github.com/alookai/alook .

REA reverse-engineering tooling is not installed or executed: no authorized bounded binary analysis task exists in this pipeline. Do not add it to marketing or publication by default. Official source: https://github.com/morluto/rea .

These gates intentionally prevent unreviewed systems; they are not a claim of installed or live inference.
