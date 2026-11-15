# IMPERION Agent4 — private CRM transport

**Case:** IMP-SOCIAL-SALES-20261115. **Cost:** 0 new Kč.
**Owner/controller:** OSVČ or Družina Moravy z.s. — separate lead tabs.
**Transport is NOT a second CRM or Telegram consumer.** Only immutable
source receipts pass through the existing Supabase project.

## Actual production path

Existing sole OCI Telegram DRAFT_ONLY listener -> existing local Windows
SQLite mirror -> ONE Windows scheduled task
**Imperion-AgentNetwork-Agent4CRMTransport** every 5 minutes ->
existing private Supabase project (new RLS-only metadata transport) ->
existing owner-bound Community Hub GAS importer
**imperionSyncPrivateIntake** with an EARLY nonblocking pull hook ->
canonical **Leads** (OSVČ) or **Druzina_Enrollment_Pipeline** (NGO) ->
independent Google source-key row readback -> Supabase ACK ->
next Windows run records existing local CRM_READBACK_CONFIRMED.

No new bot, no new CRM, no second getUpdates, no customer text to
Supabase, no client sends, no public posts, no bank-cash claims.

## Security

- Windows bearer generated locally with 256-bit cryptographic randomness;
  saved only in user-private AppData file with restricted NTFS permissions.
  Only its SHA-256 hash is stored in private Supabase auth table.
- Edge function **imperion-agent4-transport** is live with its own
  bearer validation. Anonymous GET returns HTTP 401; owner-key GET of
  absent source returns MISSING. No public unauthenticated CRM API.
- Existing private GAS token validates via pre-existing
  verify_imperion_intake_bridge_token RPC; no new Google Cloud
  project or additional public execution permissions. Script Execution
  API was not enabled; the failed local clasp-run approach was retired.
- Supabase tables **imperion_agent4_transport** and
  **imperion_agent4_transport_auth** are RLS-protected, deny anon
  SELECT and authenticated INSERT. Edge-only service role.
- Payload is SHA-derived source key, legal entity, local job ID, time,
  provider-send uncertainty and fixed unqualified markers. No email,
  handle, phone, personal name, message body, price, marketing consent,
  attendance, contract, payment or sensitive health information.
- Existing local controller/opt-out/self-test checks execute BEFORE
  any submit. GAS rejects unknown fields, collision, stale time,
  invalid controller or duplicate source key. Independent CRM readback
  before ACK; Windows GET before POST and again before local ACK.
- GAS pull uses its existing ScriptLock and existing five-minute
  private import trigger. Exceptions are isolated from RSVP imports.
  No new GAS timer, credentials or outreach authorization.
- Optional owner-only Script Properties IMP_AGENT4_CRM_KILL_SWITCH=true
  or IMP_AGENT4_PULL_DISABLED=true blocks pulls. Windows helper can be
  disabled independently, preserving the sole OCI Telegram listener.

## Deployment proof (15 November 2026)

1. Existing bound Apps Script received private owner-only CRM metadata
   helper, retaining all 24 existing cloud files; independent fresh
   clasp clone and hashes verified.
2. Added one private pull module and one existing importer hook,
   preserving 24 unrelated modules. Later moved that hook EARLY after
   legacy importer logs showed old Supabase requests but no new pull;
   independent fresh clone confirmed all other 25 files unchanged.
3. Existing Supabase project browser-bridge: migration applied, Edge
   imperion-agent4-transport v1 ACTIVE. Anonymous HTTP 401, local
   owner-authenticated source GET returned MISSING.
4. Windows zmrzlina local agent: Python metadata-only helper installed;
   dedicated five-minute task LastTaskResult=0, one-shot IDLE_NO_PENDING.
   Owner panel readback shows CRM transport heartbeat_recent=true,
   Qwen 3.5 4B local CPU, OCI Telegram DRAFT_ONLY and WhatsApp watcher.
5. Local Agent4 Python suite 114/114 PASS. Bridge-only Node/Python
   adversarial tests and deployment QA are separately recorded in
   GitHub Actions. No genuine source was inserted for testing.

## Truthful status and next readback

The local transport is operational. At last SQL readback there are
0 staged source records, 0 GAS ACKs and 0 fake buyers. This is
NOT evidence of a genuine customer E2E; the first actual opt-in
Telegram lead still needs independent Google Sheets row and local
CRM_READBACK_CONFIRMED verification. A new genuine incoming message
is required for that last acceptance criterion.

Publishing is separate: existing SocialPublisher modules are installed
but disabled without scoped per-job owner GO, provider rights/quota,
media rights, verified terms and post/first-comment URL readback.
No new standing publish timer or marketing sends authorized.

For rollback: disable only the Windows Agent4CRMTransport task and
owner-private GAS pull flag, preserve all prior CRM rows and the
sole OCI Telegram listener, reconcile ambiguous source keys before
any repeated attempt.
