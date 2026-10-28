#!/usr/bin/env python3
"""GitHub Actions cloud smoke: synthetic-only source -> proposed cuts -> review MP4.

This script must NEVER fetch private Drive footage or publish a video. Its output
is safe as a public-repo CI artifact because the source is a generated test pattern.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import subprocess
from video_factory import make_plan, render, sha256, media_probe


def create_demo(output_root: Path) -> dict:
    root = Path(output_root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    source = root / 'synthetic_source.mp4'
    if source.exists():
        raise FileExistsError('Cloud demo output exists; refusing overwrite')
    # Pure generated visual+tone. No private source files, human faces, brands,
    # stock/music licenses, user-linked links or account credentials.
    subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin', '-n',
        '-f', 'lavfi', '-i', 'testsrc2=size=480x270:rate=15:duration=4',
        '-f', 'lavfi', '-i', 'sine=frequency=392:sample_rate=16000:duration=4',
        '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-shortest', str(source)], check=True, timeout=90)
    plan_result = make_plan(
        source=source, output_dir=root / 'plan',
        topic='Original synthetic cloud rendering test',
        entity='OSVC', cta='Internal test: do not publish', count=1, window=3)
    approval = {
        'source_sha256': sha256(source),
        'rights_status': 'owned',
        'rights_basis': 'FFmpeg-generated original synthetic lavfi test pattern and tone, not a third-party clip',
        'people_consents_checked': True,  # no people appear in generated test pattern
        'music_rights_checked': True,  # sine wave generated in this test, no music
        'contains_minors': False,
    }
    clearance = root / 'synthetic_clearance.json'
    clearance.write_text(json.dumps(approval, indent=2) + '\n', encoding='utf-8')
    draft = render(plan_result['plan'], clearance, root / 'drafts')
    report = json.loads(Path(draft['qa']).read_text(encoding='utf-8'))
    if (report['status'] != 'MEDIA_RENDERED_REVIEW_REQUIRED'
            or report['editorial_approved'] or report['published']
            or len(report['videos']) != 1):
        raise RuntimeError('Cloud smoke did not yield one review-only MP4')
    video = Path(report['videos'][0]['file'])
    props = media_probe(video)
    if (props['width'], props['height']) != (1080, 1920):
        raise RuntimeError('Cloud smoke produced wrong MP4 dimensions')
    result = {
        'status': 'CLOUD_DEMO_RENDERED_REVIEW_ONLY',
        'execution': 'GITHUB_ACTIONS_EPHEMERAL_RUNNER',
        'source': 'SYNTHETIC_TEST_PATTERN_NO_REAL_FOOTAGE',
        'mp4': str(video.relative_to(root)),
        'video_sha256': sha256(video),
        'codec': 'h264', 'width': props['width'], 'height': props['height'],
        'published': False,
        'next': 'Connect approved private media storage in private runner; editorial review required',
    }
    (root / 'CLOUD_RUN_RECEIPT.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    create_demo(args.output)