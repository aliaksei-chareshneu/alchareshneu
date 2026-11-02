# IMPERION ShortFactory: local safe media pipeline

Status: tested on zmrzlina (Windows), 2026-11-02. This is a versioned
copy of additions to the EXISTING MoravianHost ShortFactory.
It is not a separate CRM, scheduler or publishing service.

## Pipeline

1. drive_b64_ingest.ps1: import explicit, authenticated Drive file bytes
   into Documents/ImperionMedia/IncomingApproved, with byte-size and SHA256
   verification. Record provenance, publish_allowed=false. Does not itself
   authenticate to Google Drive.
2. shortfactory_edit_suggestions.py: produce FFmpeg scene/silence candidate
   cuts from stable local files only. It is not semantic AI.
3. shortfactory_private_montage.py: create muted watermarked LOCAL MP4
   previews; all reuse, music, participant and minor permissions remain
   unverified. Never adds private footage to public GitHub.
4. youtube_reference_intake.py: store third-party YouTube videos as
   research LINKS, never as streams or licensed footage. Do not rip clips.
5. run_shortfactory_private_preproduction.ps1: execute the above plus
   the existing idea worker. Existing Windows scheduled task 09:45 daily.
6. render_csv_validation_20261102.py: one ORIGINAL educational Python
   short with synthetic data and local Windows TTS; published separately.

## Operating evidence

- Source: ~/Documents/ImperionMedia/IncomingApproved/
- Scripts: ~/MoravianHost/MediaMachine/ShortFactory/
- Suggestions: ShortFactory/edit_suggestions/
- Private previews: ~/MoravianHost/MediaMachine/Drafts/ShortFactory/private-drive-preview/
- Logs: ShortFactory/logs/private-preproduction-YYYY-MM-DD.log
- Existing SQLite shortfactory_autopilot.py and Draft Worker PRESERVED.
- Existing owner review UI: http://127.0.0.1:8765/ on localhost only.
- On 2026-11-02: 20/20 local Python tests PASS; two distinct Drive
  MP4s imported, two private muted previews and verified rerun.
- Google Drive Desktop sync is NOT installed. Cross-cloud import still
  requires authenticated connector transfer; the daily task autonomously
  processes files ALREADY placed in the local inbound folder.
- No paid credits, public auto-post for unclear media, or fake revenue.

## Tests

From ~/MoravianHost/MediaMachine/ShortFactory/ run:

    python -m unittest discover -s tests -p test_*.py -v
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File run_shortfactory_private_preproduction.ps1

Local tests validate vertical resolution, no sound, SHA256, no duplicates,
no path traversal, no automatic permission changes and no unsanctioned
publication. Public permission cannot be inferred from file naming.

## Publication gates

Always distinguish private preview, QC, scheduled, platform PUBLISHED,
actual URL, enquiry, invoiced and paid. Only explicitly cleared original
footage (including people/music rights) can leave the private inbox.
Account and legal entity must match, website CTA must function.
Research clips from third-party YouTube: critique/analysis using originally
created footage or separately licensed media; no blanket reuse rights.
Avoid interchangeable AI mass-produced videos; apply human editorial QC.

YouTube CSV educational Short confirmed PUBLISHED:
https://www.youtube.com/shorts/GVgCa4CKeeM
Facebook and Instagram copies were SCHEDULED at latest readback, not live.
