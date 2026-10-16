"""Bounded local draft worker for the existing ShortFactory database.
No downloads, external API, automatic approval, publishing, or new CRM.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone

SAFE_RIGHTS = {'owned', 'licensed', 'public_domain'}

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def eligible(row):
    return row['status'] == 'QUEUED_SAFE_SOURCE' and row['rights_status'] in SAFE_RIGHTS

def check_source(row):
    path = Path(row['source_path'])
    if not path.is_file() or not row['source_sha256']:
        raise ValueError('Source file or recorded hash missing')
    if digest(path) != row['source_sha256']:
        raise ValueError('Source changed since queue approval')

def run_once(base, limit=2, execute=False, runner=subprocess.run):
    base = Path(base).resolve()
    root, db = base / 'ShortFactory', base / 'media_index.sqlite'
    if not db.is_file() or not (root / 'short_factory.py').is_file():
        raise ValueError('Existing ShortFactory installation required')
    lock = root / 'autopilot.lock'
    # Never steal a possibly active/stale lock: operator inspects interrupted jobs.
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.write(fd, str(os.getpid()).encode())
    os.close(fd)
    result = {'mode': 'DRAFT_RENDER' if execute else 'PREVIEW', 'selected': 0,
              'rendered': 0, 'failed': 0, 'published': 0, 'errors': [],
              'checked_at': datetime.now(timezone.utc).isoformat()}
    try:
        with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as con:
            con.row_factory = sqlite3.Row
            rows = con.execute("SELECT * FROM short_jobs WHERE status='QUEUED_SAFE_SOURCE' ORDER BY created_at,job_id").fetchall()
        rows = [dict(r) for r in rows if eligible(r)][:limit]
        result['selected'] = len(rows)
        for row in rows:
            try:
                check_source(row)
                if not execute:
                    continue
                # Reuse reviewed renderer. It may report exit 0 after an internal
                # job failure, so verify actual DB state AND nonempty output.
                proc = runner([sys.executable, str(root / 'short_factory.py'), 'render', '--job', row['job_id']],
                              cwd=root, capture_output=True, timeout=360)
                with sqlite3.connect(db.as_uri() + '?mode=ro', uri=True) as con:
                    state = con.execute('SELECT status,output_path FROM short_jobs WHERE job_id=?', (row['job_id'],)).fetchone()
                if proc.returncode != 0 or not state or state[0] != 'READY_FOR_REVIEW':
                    raise ValueError('Renderer failed or output state not verified')
                output = Path(state[1])
                if not output.is_file() or output.stat().st_size == 0:
                    raise ValueError('Rendered file missing or empty')
                result['rendered'] += 1
            except Exception as exc:
                result['failed'] += 1
                # No source paths, captions, subprocess output or secrets in report.
                result['errors'].append({'job_id': row['job_id'], 'kind': type(exc).__name__})
        report = root / 'autopilot_status.json'
        temp = root / 'autopilot_status.json.tmp'
        temp.write_text(json.dumps(result, indent=2), encoding='utf-8')
        os.replace(temp, report)
        return result
    finally:
        lock.unlink()

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--base', type=Path, default=Path.home()/'MoravianHost'/'MediaMachine')
    ap.add_argument('--limit', type=int, choices=range(1, 4), default=2)
    ap.add_argument('--execute', action='store_true')
    args = ap.parse_args()
    result = run_once(args.base, args.limit, args.execute)
    print(json.dumps(result))
    return 1 if result['failed'] else 0

if __name__ == '__main__':
    sys.exit(main())
