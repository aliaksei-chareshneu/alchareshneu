# Repeatable, no-metered-video-credit ShortFactory

This extends the existing MoravianHost ShortFactory, GitHub draft PR #67. It does NOT introduce another CRM, publisher, database, billing plan, or paid AI video provider.

WHAT IT DOES
- Builds TWO review-only vertical Shorts (documentary and action pacing) from the same English Kokoro speech, licensed video footage and animated photo inserts.
- Uses FFmpeg (video), Pillow (caption-safe title overlays), Kokoro-82M (speech), the existing voice script, and locally cached Commons assets.
- Each variant contains live moving video (not merely static text cards), shot reframing, top-line hooks, small factual source lines and short burned-in word-group captions.
- Writes H.264/AAC 1080x1920 MP4s, independent subtitle file, codec/duration/hash QA manifest and author/license credits.
- Fails closed on missing media, missing rights provenance, invalid input or output collision.
- Never auto-publishes, auto-uploads, purchases generation credits, or bypasses existing SocialPublishing review checks.

IMPORTANT LICENCE
The sample footage is from Wikimedia Commons, with authors and links in examples/roman_motion_free_20261025.json: CvZ, Testudo moving (CC BY-SA 4.0); ZDF/Terra X, Das römische Legionslager (CC BY-SA 4.0); MatthiasKabel, Roman Legion training with wooden weapons 01/03/04 (CC BY-SA 3.0). The adapted sample VIDEO is made available under CC BY-SA 4.0, with attribution and indication of adaptations. Include LICENSE_CREDITS.txt and link https://creativecommons.org/licenses/by-sa/4.0/ in the video description. Never mislabel edited reenactment footage as a recording of actual ancient training. If new footage has a different licence, review compatibility before mixing; do not relabel proprietary footage as CC BY-SA.

LOCAL REPEAT RECIPE
1. Install Python 3.12, FFmpeg and ffprobe, DejaVu Sans or Arial Bold, and install Python packages: python -m pip install kokoro-onnx soundfile Pillow
2. Download Kokoro-82M ONNX and voices-v1.0.bin from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1 (one-time cache).
3. Download verified Wikimedia media URLs from examples/roman_motion_free_20261025.json, keeping local names under media/ . Cache them for unlimited local reuse (subject to licensing).
4. Synthesize narration (the SAME established Kokoro voice):
   python shortfactory_voice_kokoro.py --script examples/roman_training_voice_20261025.json --model kokoro-v1.0.onnx --voices voices-v1.0.bin --output preview/voice
5. Render both:
   python cinematic_shorts.py --script examples/roman_motion_free_20261025.json --media-dir media --voice preview/voice/roman_training_narrated_preview.wav --srt preview/voice/roman_training_narrated_preview.srt --outdir preview/motion
6. Open both MP4s, inspect key frames for relevance, verify accuracy and rights, then use the EXISTING SocialPublishing review/approval gate if/when publishing.

REMOTE ONE-OFF VERIFICATION
GitHub Actions: .github/workflows/media-cinematic-shorts.yml. The workflow shows a full tested end-to-end example using an Actions runner and publishes two private-to-review artifacts (not public social posts). Cached local copies avoid future Commons downloads. Cloud Actions has compute/storage quotas depending on repository plan; it is NOT unlimited free cloud compute. Local generation requires only your hardware and electricity, without provider per-video limits.

EDITORIAL SAFETY
Source: Vegetius, Epitoma rei militaris I.11. This is one late source describing older traditions, not evidence every Roman legion drilled with double-weight weapons. The vertical testudo shows reenactors demonstrating formation, NOT a recorded Roman training scene. Never claim new live event dates, bookings, prices or user/member likeness without separate verification.
