#!/usr/bin/env python3
"""One-way creative SCRIPT_READY -> existing E09 ShortFactory editorial handoff.

Creates review-only JSON + approximate SRT, and optionally the existing video_factory.py
plan invocation. Does not render, clear rights, change CRM, spend money, or publish.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import sys
import shutil

ENTITIES = {'OSVC', 'DRUZINA_ZS'}
SCENE = re.compile(r'^\s*(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)s\s*:\s*(.+)$', re.S)
ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{2,79}$')


def load_job(path: Path, job_id: str):
    jobs = []
    seen = set()
    for n, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        key = row.get('id')
        if not isinstance(key, str) or not ID.fullmatch(key) or key in seen:
            raise ValueError(f'Invalid or duplicate ID at line {n}')
        seen.add(key)
        jobs.append(row)
    matches = [x for x in jobs if x['id'] == job_id]
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one Job_ID {job_id}')
    return matches[0]


def prepare(row: dict):
    ident = row['id']
    if row.get('entity') not in ENTITIES:
        raise ValueError('Missing or invalid legal entity')
    if row.get('status') != 'SCRIPT_READY':
        raise ValueError('Only SCRIPT_READY scripts can enter review handoff')
    if row.get('publish_allowed') is not False or row.get('live_url'):
        raise ValueError('Publishing approval or live URL cannot originate in an editorial manifest')
    if not all(isinstance(row.get(k), str) and row[k].strip() for k in ('script', 'hook', 'cta', 'topic', 'claim_check')):
        raise ValueError('Missing editorial script, hook, CTA, topic, or claim check')
    if not row['script'].casefold().startswith(row['hook'].casefold()):
        raise ValueError('Opening hook differs from full narration')
    if row.get('list_count_claimed') is not None and row['list_count_claimed'] != len(row.get('list_items', [])):
        raise ValueError('Count/list mismatch')
    duration = row.get('duration_s')
    if not isinstance(duration, (int, float)) or isinstance(duration, bool) or not 10 <= duration <= 59:
        raise ValueError('Duration must be between 10 and 59 seconds')
    raw = row.get('scene_prompts', [])
    if not isinstance(raw, list) or not 2 <= len(raw) <= 5:
        raise ValueError('Expected 2 to 5 timestamped scene prompts')
    scenes = []
    for i, prompt in enumerate(raw):
        match = SCENE.fullmatch(prompt)
        if not match:
            raise ValueError(f'Scene {i + 1} lacks start-end seconds prefix')
        start, end = float(match[1]), float(match[2])
        if abs(start - (scenes[-1]['end_s'] if scenes else 0)) > .01 or end <= start or end > duration + .01:
            raise ValueError(f'Scene {i + 1} has gap, overlap or invalid duration')
        scenes.append({'start_s': start, 'end_s': end, 'direction': match[3].strip()})
    if abs(scenes[-1]['end_s'] - duration) > .01:
        raise ValueError('Scene timeline must end at target duration')
    words = row['script'].split()
    # This is a READING-TIME ESTIMATE, NOT forced alignment to recorded audio.
    chunk_size = 6
    chunks = [' '.join(words[i:i+chunk_size]) for i in range(0, len(words), chunk_size)]
    captions = []
    current = 0
    for chunk in chunks:
        length = len(chunk.split())
        start = duration * current / len(words)
        current += length
        end = duration * current / len(words)
        captions.append((start, end, chunk))
    return {
        'schema': 'imperion.e09.creative_handoff.v1', 'job_id': ident,
        'entity': row['entity'], 'status': 'SCRIPT_READY',
        'topic': row['topic'], 'script': row['script'], 'hook': row['hook'],
        'cta': row['cta'], 'duration_s': duration,
        'source_urls': row.get('source_urls', []),
        'claim_check': row['claim_check'], 'scenes': scenes,
        'caption_timing': 'ESTIMATED_REQUIRES_AUDIO_ALIGNMENT',
        'source_media_rights': 'NOT_VERIFIED',
        'human_editorial_approved': False, 'publish_allowed': False,
        'published': False, 'live_url': None,
    }, captions


def timestamp(seconds):
    millis = int(round(seconds * 1000))
    h, millis = divmod(millis, 3600000)
    m, millis = divmod(millis, 60000)
    s, ms = divmod(millis, 1000)
    return f'{h:02}:{m:02}:{s:02},{ms:03}'


def write_handoff(row: dict, output_dir: Path, source_mp4: Path | None = None, timed_srt: Path | None = None):
    handoff, captions = prepare(row)
    output_dir = output_dir.resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError('Nonempty output; refusing overwrite or duplicate processing')
    source = None
    if source_mp4 is not None:
        source = source_mp4.expanduser().resolve(strict=True)
        if not source.is_file() or source.suffix.lower() not in {'.mp4', '.mov', '.mkv', '.webm'}:
            raise ValueError('Expected approved local video file, never a URL')
        hasher = hashlib.sha256()
        with source.open('rb') as infile:
            for chunk in iter(lambda: infile.read(1024 * 1024), b''):
                hasher.update(chunk)
        digest = hasher.hexdigest()
        handoff['local_source'] = str(source)
        handoff['local_source_sha256'] = digest
        handoff['e09_plan_status'] = 'READY_FOR_PLAN_NOT_APPROVED_TO_RENDER'
    selected_srt = None
    if timed_srt is not None:
        selected_srt = timed_srt.expanduser().resolve(strict=True)
        if selected_srt.suffix.lower() != '.srt' or not selected_srt.is_file():
            raise ValueError('Timed captions must be a local .srt file')
        if not selected_srt.read_text(encoding='utf-8-sig').strip():
            raise ValueError('Timed SRT must not be empty')
        handoff['caption_timing'] = 'PROVIDED_SRT_REQUIRES_EDITOR_QA'
        handoff['caption_source_sha256'] = hashlib.sha256(selected_srt.read_bytes()).hexdigest()
    output_dir.mkdir(parents=True, exist_ok=True)
    if selected_srt is not None:
        shutil.copyfile(selected_srt, output_dir / 'provided_captions.srt')
    (output_dir / 'creative_handoff.json').write_text(json.dumps(handoff, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (output_dir / 'approximate_captions.srt').write_text(''.join(
        f'{i}\n{timestamp(start)} --> {timestamp(end)}\n{text}\n\n'
        for i, (start, end, text) in enumerate(captions, 1)), encoding='utf-8')
    if source is not None:
        cmd = ['python3', 'video_factory.py', 'plan', str(source), '--output', str(output_dir / 'e09_cut_review'),
               '--topic', row['topic'], '--entity', row['entity'], '--cta', row['cta'],
               '--srt', str(output_dir / ('provided_captions.srt' if selected_srt else 'approximate_captions.srt')), '--count', '1',
               '--length', str(handoff['duration_s'])]
        (output_dir / 'e09_plan_command.txt').write_text(shlex.join(cmd) + '\n', encoding='utf-8')
    return handoff


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--id', required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--source', type=Path)
    parser.add_argument('--timed-srt', type=Path, help='Optional local SRT aligned to real narration')
    args = parser.parse_args(argv)
    result = write_handoff(load_job(args.manifest, args.id), args.out, args.source, args.timed_srt)
    print(json.dumps({'job_id': result['job_id'], 'status': result['status'],
                      'scene_count': len(result['scenes']), 'output': str(args.out)}, ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileExistsError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'reason': str(exc)}), file=sys.stderr)
        raise SystemExit(2)
