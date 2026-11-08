"""Make a review-only original vertical video from user-provided text.

Part of existing MoravianHost ShortFactory, not a separate publisher or CRM.
Uses Pillow and FFmpeg; downloads nothing, handles no outside footage.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    Image = ImageDraw = ImageFont = None

ROOT = Path.home() / 'MoravianHost' / 'MediaMachine'
FONT_CHOICES = (
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
)
SLUG = re.compile(r'^[a-z0-9][a-z0-9_-]{2,48}$')
WIDTH, HEIGHT = 1080, 1920


def validate(data):
    if not isinstance(data, dict):
        raise ValueError('JSON object required')
    slug, brand, slides = data.get('slug'), data.get('brand'), data.get('slides')
    if not isinstance(slug, str) or not SLUG.fullmatch(slug):
        raise ValueError('Safe unique lowercase slug required')
    if not isinstance(brand, str) or not 2 <= len(brand.strip()) <= 60:
        raise ValueError('Brand name required')
    if not isinstance(slides, list) or not 2 <= len(slides) <= 6:
        raise ValueError('Two to six panels required')
    total = 0
    for p in slides:
        if not isinstance(p, dict) or not isinstance(p.get('headline'), str) or not isinstance(p.get('body'), str):
            raise ValueError('Each panel requires headline and body')
        if not 3 <= len(p['headline'].strip()) <= 95 or len(p['body'].strip()) > 240:
            raise ValueError('Panel text outside limits')
        seconds = p.get('seconds')
        if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not 2 <= seconds <= 12:
            raise ValueError('Panel duration must be 2-12 seconds')
        total += seconds
    if total > 60:
        raise ValueError('At most 60 seconds')
    return total


def font_file():
    for item in FONT_CHOICES:
        if Path(item).is_file():
            return item
    raise RuntimeError('Install a Unicode TTF font for video text')


def wrap(draw, text, font, max_width, max_lines):
    lines = []
    for paragraph in text.split('\n'):
        words = paragraph.split()
        if not words:
            if lines:
                lines.append('')
            continue
        current = ''
        for word in words:
            new = (current + ' ' + word).strip()
            if draw.textbbox((0, 0), new, font=font)[2] <= max_width:
                current = new
                continue
            if not current:
                raise ValueError('One word is too long for safe-area')
            lines.append(current)
            current = word
            if draw.textbbox((0, 0), current, font=font)[2] > max_width:
                raise ValueError('One word is too long for safe-area')
        if current:
            lines.append(current)
    if len(lines) > max_lines:
        raise ValueError('Too much text for safe-area')
    return lines


def draw_slide(brand, slide, ix, count, output):
    if Image is None:
        raise RuntimeError('Pillow required: python -m pip install Pillow')
    file = font_file()
    image = Image.new('RGB', (WIDTH, HEIGHT), (14, 27, 43))
    d = ImageDraw.Draw(image)
    accent = [(87, 216, 184), (122, 176, 245), (242, 196, 118)][ix % 3]
    d.rounded_rectangle((72, 107, 1008, 1810), radius=52, fill=(23, 42, 59))
    d.rounded_rectangle((110, 205, 970, 218), radius=6, fill=accent)
    d.ellipse((730, 300, 1045, 615), fill=(35, 58, 76))
    d.ellipse((810, 380, 1030, 600), outline=accent, width=7)
    brand_font = ImageFont.truetype(file, 48)
    head_font = ImageFont.truetype(file, 85)
    body_font = ImageFont.truetype(file, 57)
    small_font = ImageFont.truetype(file, 41)
    label = wrap(d, brand.strip(), brand_font, 820, 2)
    for j, line in enumerate(label):
        d.text((110, 295 + 57 * j), line, font=brand_font, fill=accent)
    head_lines = wrap(d, slide['headline'].strip(), head_font, 820, 5)
    y = 660
    for line in head_lines:
        d.text((110, y), line, font=head_font, fill=(252, 252, 252))
        y += 115
    body_lines = wrap(d, slide['body'].strip(), body_font, 830, 8)
    y = max(1120, y + 60)
    if y + 85 * len(body_lines) > 1580:
        raise ValueError('Headline plus body too tall for 9:16 safe area')
    for line in body_lines:
        d.text((110, y), line, font=body_font, fill=(218, 231, 239))
        y += 85
    d.rounded_rectangle((110, 1660, 970, 1668), radius=4, fill=(68, 88, 104))
    d.rounded_rectangle((110, 1660, 110 + 860 * (ix + 1) // count, 1668), radius=4, fill=accent)
    d.text((110, 1715), 'ORIGINAL  ·  REVIEW REQUIRED', font=small_font, fill=(184, 206, 217))
    d.text((867, 1715), f'{ix + 1}/{count}', font=small_font, fill=accent)
    image.save(output, format='PNG')


def ffmpeg_executable():
    exe = shutil.which('ffmpeg')
    if exe:
        return exe
    wins = Path.home() / 'AppData' / 'Local' / 'Microsoft' / 'WinGet' / 'Packages'
    if wins.exists():
        found = sorted(wins.glob('Gyan.FFmpeg_*/*/bin/ffmpeg.exe'))
        if found:
            return str(found[-1])
    raise RuntimeError('FFmpeg not installed or not on PATH')


def render(data, output, *, execute=True, runner=subprocess.run):
    total = validate(data)
    output = Path(output).expanduser().resolve()
    sidecar = Path(str(output) + '.json')
    if output.exists() or sidecar.exists():
        raise FileExistsError('Existing video or metadata must not be overwritten')
    if not execute:
        return {'status': 'PREVIEW_ONLY', 'duration': total, 'panels': len(data['slides']), 'rendered': False}
    output.parent.mkdir(parents=True, exist_ok=True)
    tool = ffmpeg_executable()
    with tempfile.TemporaryDirectory(prefix='original-reel-', dir=str(output.parent)) as temp:
        tmp = Path(temp)
        manifest = tmp / 'frames.ffconcat'
        frames = []
        for ix, slide in enumerate(data['slides']):
            png = tmp / f'frame-{ix:02d}.png'
            draw_slide(data['brand'], slide, ix, len(data['slides']), png)
            frames.append(png)
        with manifest.open('w', encoding='utf-8') as f:
            f.write('ffconcat version 1.0\n')
            for png, slide in zip(frames, data['slides']):
                file = png.resolve().as_posix().replace("'", "'\\''")
                f.write("file '" + file + "'\n")
                f.write('duration ' + str(slide['seconds']) + '\n')
            f.write("file '" + frames[-1].resolve().as_posix().replace("'", "'\\''") + "'\n")
        pending = tmp / 'rendered.mp4'
        args = [tool, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                '-safe', '0', '-f', 'concat', '-i', str(manifest),
                '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264',
                '-preset', 'veryfast', '-crf', '23', '-movflags', '+faststart',
                '-t', str(total), str(pending)]
        proc = runner(args, capture_output=True, timeout=240)
        if proc.returncode != 0 or not pending.is_file() or pending.stat().st_size < 5000:
            raise RuntimeError('FFmpeg original draft render failed; no video published')
        if output.exists() or sidecar.exists():
            raise FileExistsError('Concurrent output exists; refusing replacement')
        digest = hashlib.sha256(pending.read_bytes()).hexdigest()
        payload = {
            'status': 'LOCAL_DRAFT_REQUIRES_HUMAN_REVIEW',
            'media_sha256': digest,
            'script_sha256': hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest(),
            'source_kind': 'original_text_graphics',
            'third_party_media': False,
            'duration_requested_sec': total,
            'resolution': '1080x1920',
            'created_utc': datetime.now(timezone.utc).isoformat(),
            'publish_status': 'NOT_PUBLISHED',
        }
        os.replace(str(pending), str(output))
        sidecar.write_text(json.dumps(payload, indent=2), encoding='utf-8')
    return {'status': payload['status'], 'rendered': True, 'media_sha256': digest,
            'duration': total, 'panels': len(data['slides']), 'output': str(output)}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--script', type=Path, required=True)
    ap.add_argument('--output', type=Path)
    ap.add_argument('--preview', action='store_true')
    args = ap.parse_args()
    data = json.loads(args.script.read_text(encoding='utf-8'))
    target = args.output or ROOT / 'Drafts' / datetime.now().strftime('%Y-%m-%d') / (data.get('slug', 'draft') + '.mp4')
    result = render(data, target, execute=not args.preview)
    print(json.dumps(result))


if __name__ == '__main__':
    main()
