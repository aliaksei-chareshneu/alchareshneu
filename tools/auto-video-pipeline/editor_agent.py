#!/usr/bin/env python3
"""Safe local editing interface for the existing IMPERION E09 ShortFactory.

No installs, external downloads, paid calls, publishing, or new queue/CRM.
The AI operator can call bounded commands; rights are checked by video_factory.render.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import shutil
import sys

import video_factory

ROOT = Path(__file__).resolve().parent
STYLE = """# IMPERION editor style - operator-editable guidance

- Format: 9:16 (1080x1920); preserve faces, safety context and full equipment.
- Open with the credible viewer outcome, an actual action or specific problem.
- Aim for one claim, one useful idea and one approved CTA per video.
- Avoid invented events, misleading before/after, loud music and seizure-risk effects.
- Keep readable captions in safe areas; review Czech/English/Russian/Ukrainian wording.
- Do not reuse recognizable people's footage, minors or copyrighted audio without consent.
- Apply this as an EDITORIAL REVIEW GUIDE; video_factory rendering does not
  automatically interpret this file or invent animation/style changes.
"""


def tool_status(project: Path) -> dict:
    remotion_bin = ROOT / 'node_modules' / '.bin' / ('remotion.cmd' if sys.platform == 'win32' else 'remotion')
    tools = {
        'ffmpeg': {'purpose': 'offline clip/overlay/caption render', 'detected': bool(shutil.which('ffmpeg'))},
        'ffprobe': {'purpose': 'local video metadata/QA', 'detected': bool(shutil.which('ffprobe'))},
        'remotion': {'purpose': 'optional code-based visual timeline', 'detected': remotion_bin.is_file(),
                     'note': 'Check Remotion license eligibility before commercial use'},
        'whisper': {'purpose': 'optional local transcription', 'detected': bool(shutil.which('whisper')),
                    'note': 'First local model use may require an authorized download'},
        'yt-dlp': {'purpose': 'optional authorized reference acquisition only', 'detected': bool(shutil.which('yt-dlp')),
                   'note': 'Not called by this editor; platform terms, consent and content rights remain mandatory'},
        'hyperframes': {'purpose': 'optional motion/animation mentioned in a tutorial', 'detected': False,
                        'note': 'Identity/license/integration not verified; NOT installed or executed'},
        'piratex-mcp': {'purpose': 'optional public trend analysis (not an editor)', 'detected': False,
                        'note': 'No authenticated connection or credit balance checked; NOT called'},
    }
    return {'schema': 'imperion.editor.toolchain.v1', 'status': 'READ_ONLY_LOCAL_TOOL_AUDIT',
            'project': str(project.resolve()), 'tools': tools,
            'existing_pipeline': str(ROOT / 'video_factory.py'),
            'existing_pipeline_present': (ROOT / 'video_factory.py').is_file(),
            'video_editor_agent': 'IMPERION_AGENT_3_E09',
            'installed_by_this_command': False, 'rendered': False, 'published': False,
            'budget_new_spend_czk': 0}


def init_project(project: Path) -> dict:
    project = project.expanduser().resolve()
    public, out = project / 'public', project / 'out'
    public.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    style = project / 'style.md'
    # Do not destroy or overwrite user taste decisions.
    created = False
    try:
        with style.open('x', encoding='utf-8') as f:
            f.write(STYLE)
        created = True
    except FileExistsError:
        pass
    return {'status': 'LOCAL_PROJECT_READY_NOT_PRODUCTION', 'project': str(project),
            'source_dir': str(public), 'output_dir': str(out),
            'style': str(style), 'style_created': created,
            'installed': False, 'rendered': False, 'published': False}


def assert_source_in_project(source: Path, project: Path) -> Path:
    source = source.expanduser().resolve(strict=True)
    allowed_root = (project.expanduser().resolve() / 'public').resolve()
    if not source.is_file() or not source.is_relative_to(allowed_root):
        raise ValueError('Source must be an existing LOCAL file inside project/public')
    if source.suffix.lower() not in video_factory.VIDEO_SUFFIXES:
        raise ValueError('Unsupported local video format')
    return source


def plan_project(project: Path, source: Path, topic: str, entity: str, cta: str,
                 srt: Path | None = None, count: int = 5, length: float = 18) -> dict:
    project = project.expanduser().resolve(strict=True)
    source = assert_source_in_project(source, project)
    if not (project / 'style.md').is_file():
        raise ValueError('Missing style.md; run init and review the style rules')
    source_digest = video_factory.sha256(source)
    plan_dir = project / 'out' / 'plans' / (video_factory.slugify(topic) + '-' + source_digest[:12])
    result = video_factory.make_plan(source, plan_dir, topic, entity, cta, srt, count, length)
    # A style guide is for a human/AI reviewer; do not pretend the renderer reads it.
    with (plan_dir / 'editorial_handoff.md').open('a', encoding='utf-8') as handoff:
        handoff.write(
            '\n## Edit style\nReview style guide at ' + str(project / 'style.md') + ' before deciding cuts. '
            'The style guide is NOT automatically applied to the rendered video.\n'
            'Revision commands support keep, remove and change via a decision JSON file.\n')
    return {**result, 'style': str(project / 'style.md'), 'style_applied_to_render': False,
            'published': False}


def revise_plan(plan_path: Path, decisions_path: Path, output_path: Path) -> dict:
    plan_path = plan_path.expanduser().resolve(strict=True)
    decisions_path = decisions_path.expanduser().resolve(strict=True)
    output_path = output_path.expanduser().resolve()
    if output_path.exists():
        raise FileExistsError('Revision output already exists; never overwrite an approved plan')
    original_bytes = plan_path.read_bytes()
    plan = json.loads(original_bytes)
    if plan.get('schema') != 'imperion.video_factory.v1':
        raise ValueError('Not an existing E09 video plan')
    clips = plan.get('clips')
    if not isinstance(clips, list) or not (1 <= len(clips) <= 5):
        raise ValueError('Invalid plan clips')
    decisions = json.loads(decisions_path.read_text(encoding='utf-8'))
    if not isinstance(decisions, dict) or set(decisions) != {'decisions'} or not isinstance(decisions['decisions'], list):
        raise ValueError('Expected {"decisions": [...]}')
    choices = {}
    for entry in decisions['decisions']:
        if not isinstance(entry, dict) or set(entry) - {'clip', 'action', 'start', 'duration', 'hook', 'title', 'caption'}:
            raise ValueError('Unknown decision keys')
        n = entry.get('clip')
        if type(n) is not int or n < 1 or n > len(clips) or n in choices:
            raise ValueError('Duplicate or unknown clip index')
        action = entry.get('action')
        if action not in {'keep', 'remove', 'change'}:
            raise ValueError('Action must be keep, remove, or change')
        if action != 'change' and set(entry) != {'clip', 'action'}:
            raise ValueError('Only change actions may edit clip fields')
        choices[n] = entry
    updated = copy.deepcopy(plan)
    revised = []
    for n, clip in enumerate(updated['clips'], 1):
        change = choices.get(n, {'action': 'keep'})
        if change['action'] == 'remove':
            continue
        if change['action'] == 'change':
            for key in ('start', 'duration', 'hook', 'title', 'caption'):
                if key in change:
                    value = change[key]
                    if key in {'start', 'duration'}:
                        if type(value) not in {int, float}:
                            raise ValueError('Cut time must be numeric')
                    elif not isinstance(value, str) or not value.strip() or len(value) > 150:
                        raise ValueError('Clip text must be nonempty and at most 150 characters')
                    clip[key] = value
            if 'start' in change or 'duration' in change:
                # Previous subtitle offsets are now wrong. Fail safe: do not carry them over.
                clip['subtitles'] = []
                clip['subtitle_retranscription_required'] = True
        start, duration = float(clip['start']), float(clip['duration'])
        src_duration = float(updated['source_info']['duration'])
        if not (0 <= start and 2 <= duration <= 59 and start + duration <= src_duration + 0.05):
            raise ValueError('Cut outside source or beyond 2..59 sec')
        revised.append(clip)
    if not revised:
        raise ValueError('Cannot remove every clip')
    updated['clips'] = revised
    updated['editorial_approved'] = False
    updated['video_published'] = False
    updated['revision_source_plan_sha256'] = hashlib.sha256(original_bytes).hexdigest()
    updated['revision_status'] = 'REVIEW_REQUIRED_UNPUBLISHED'
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open('x', encoding='utf-8') as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)
        f.write('\n')
    return {'status': 'EDIT_PLAN_REVISED_REVIEW_REQUIRED', 'output': str(output_path),
            'clips_remaining': len(revised), 'original_preserved': True,
            'rendered': False, 'published': False}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    doctor = commands.add_parser('doctor', help='Read-only inspection; no installs')
    doctor.add_argument('--project', default='.')
    init = commands.add_parser('init', help='Create local public/out/style.md without overwriting style')
    init.add_argument('--project', required=True)
    plan = commands.add_parser('plan', help='Use EXISTING E09 make_plan on local footage')
    plan.add_argument('--project', required=True)
    plan.add_argument('--source', required=True)
    plan.add_argument('--topic', required=True)
    plan.add_argument('--entity', choices=sorted(video_factory.ENTITIES), required=True)
    plan.add_argument('--cta', required=True)
    plan.add_argument('--srt')
    plan.add_argument('--count', type=int, default=5)
    plan.add_argument('--length', type=float, default=18)
    revise = commands.add_parser('revise', help='Apply bounded keep/remove/change to a NEW plan')
    revise.add_argument('--plan', required=True)
    revise.add_argument('--decisions', required=True)
    revise.add_argument('--output', required=True)
    render = commands.add_parser('render', help='Pass independent rights clearance to E09 renderer')
    render.add_argument('--plan', required=True)
    render.add_argument('--clearance', required=True)
    render.add_argument('--output', required=True)
    a = parser.parse_args(argv)
    if a.command == 'doctor':
        result = tool_status(Path(a.project))
    elif a.command == 'init':
        result = init_project(Path(a.project))
    elif a.command == 'plan':
        if not 1 <= a.count <= 5:
            raise ValueError('Clip count must be 1..5')
        result = plan_project(Path(a.project), Path(a.source), a.topic, a.entity, a.cta,
                              Path(a.srt) if a.srt else None, a.count, a.length)
    elif a.command == 'revise':
        result = revise_plan(Path(a.plan), Path(a.decisions), Path(a.output))
    else:
        result = video_factory.render(a.plan, a.clearance, a.output)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, FileNotFoundError, RuntimeError, FileExistsError) as exc:
        print(json.dumps({'status': 'BLOCKED', 'error': str(exc)[:400]}), file=sys.stderr)
        sys.exit(2)
