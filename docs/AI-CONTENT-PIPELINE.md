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

## Local Ollama CPU models and conservative language QA (22 October 2026)

Verified on authorised Windows `zmrzlina`: Ollama 0.40.6, local `qwen3:0.6b`, and a true CPU-only native request that replied `PIPELINE_CPU_OK`. The CUDA auto-selected runner had failed (`device kernel image is invalid`), so this adapter **always** sends `options.num_gpu=0` and `think=false`. An optional local CPU alias `imperion-qwen3-cpu:0.6b` also exists, but the adapter uses only the explicit Ollama model allowlist, not that alias.

**Independent real language QA found a serious limitation:** the 0.6B model produced outputs containing the original date, price and URL but almost no Czech/Russian/Ukrainian translation. Fact-token preservation alone is NOT language acceptance. The new `translationScriptIssues` checks only for this Ollama fallback: substantive Russian/Ukrainian output must include Cyrillic; Czech output must contain some Czech diacritic evidence. These conservative heuristics can fail valid short texts; a human must verify EVERY approved draft and cannot treat a token/script pass as publishable. `QA_BLOCKED` prevents promoting weak drafts.

Model preference: the existing `node ops/ai-local-smoke.cjs --ollama` checks `/api/tags` only on `127.0.0.1:11434`, prefers installed **`qwen3:4b`** (Apache-2.0, ~2.5 GB) for improved multilingual drafting, and falls back to installed `qwen3:0.6b` only when 4B is unavailable. The backend defaults to 4B for explicit `--translation ollama` calls; only the two local names are allowed through `OLLAMA_MODEL` (no `:cloud` or custom external identifiers). If not installed, it fails rather than automatically pulling model weights. A new model must pass a real synthetic inference and independent language QA before being described as useful; an install/pull attempt is NOT proof.

Official release and licence: https://ollama.com/library/qwen3:4b . This implementation is CPU-only to avoid observed CUDA failure and remains offline/local: 1 GET `http://127.0.0.1:11434/api/tags` plus 3 POST `http://127.0.0.1:11434/api/generate` on the synthetic-only smoke. It never accesses CRM, posts to social channels, sends email, enables model cloud use, or pays an API.

```powershell
ollama list
node ops/ai-local-smoke.cjs                 # zero network/no inference
node ops/ai-local-smoke.cjs --ollama         # real SYNTHETIC local translations only
node ops/ai-content-pipeline.cjs --input ops/ai-content-synthetic.json --live --translation ollama
# For an explicitly chosen lower-quality fallback, optionally set OLLAMA_MODEL=qwen3:0.6b
```

Acceptance: factual tokens AND script checks, human review of CS/RU/UK grammar/meaning, unchanged source fingerprint and existing SocialPublishing.Job_ID. Never auto-publish or equate model inference to sales. Hy-MT2 on port 8000 and billed MiMo/Qwen remain independent opt-in routes; nothing here starts these services, changes legal authority or approves content.

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