"""Build or verify the additive console source package from an explicit Git commit.

Uses only local Git objects and the standard library. Never deploys or executes
Apps Script; the live manifest, bindings and recovery handlers are excluded.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import zipfile


BASE_SOURCES = (
    'OperatorConsole.html', 'OperatorConsoleServer.gs', 'FioOSVC.gs',
    'FioDruzinaConsole.gs', 'PaymentReconciliation.gs',
    'prepare-console-bank-release.cjs', 'CONSOLE-BANK-RELEASE.md',
)
PARSER_SOURCES = ('console-release-acorn.cjs', 'console-release-acorn-LICENSE.txt')
SOURCES = (*BASE_SOURCES, *PARSER_SOURCES)
PACKAGE_NAMES = (*SOURCES, 'SOURCE_COMMIT', 'SHA256SUMS')
MAX_FILE_BYTES = 2 * 1024 * 1024


def _git(repo, *args):
    result = subprocess.run(['git', '-C', str(repo), *args],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    if result.returncode:
        raise ValueError('Cannot read the requested committed release sources')
    return result.stdout


def committed_package(repo, commit):
    if not re.fullmatch(r'(?:[0-9a-f]{40}|[0-9a-f]{64})', commit):
        raise ValueError('An explicit full lowercase commit SHA is required')
    resolved = _git(repo, 'rev-parse', '--verify', commit + '^{commit}').decode().strip()
    if resolved != commit:
        raise ValueError('The requested object must be a commit')
    tree = _git(repo, 'ls-tree', '-z', commit, '--', *SOURCES)
    regular = set()
    for entry in tree.split(b'\0'):
        if not entry:
            continue
        metadata, name = entry.split(b'\t', 1)
        mode, kind, _ = metadata.split()
        if mode not in (b'100644', b'100755') or kind != b'blob':
            raise ValueError('Release sources must be committed regular files')
        regular.add(name.decode())
    helper = _git(repo, 'cat-file', 'blob', commit + ':prepare-console-bank-release.cjs')
    uses_parser = b'console-release-acorn.cjs' in helper
    # Old releases contain nine files; select their original allowlist by commit.
    sources = SOURCES if uses_parser or regular.intersection(PARSER_SOURCES) else BASE_SOURCES
    if regular != set(sources):
        raise ValueError('A required release source is missing from the commit')
    entries = {name: _git(repo, 'cat-file', 'blob', commit + ':' + name) for name in sources}
    if any(len(data) > MAX_FILE_BYTES for data in entries.values()):
        raise ValueError('A release source exceeds the file size limit')
    entries['SOURCE_COMMIT'] = (commit + '\n').encode()
    entries['SHA256SUMS'] = ''.join(
        hashlib.sha256(entries[name]).hexdigest() + '  ' + name + '\n'
        for name in ('SOURCE_COMMIT', *sources)).encode()
    return entries


def _read_package(source, expected_names):
    source = Path(source)
    names = set(expected_names)
    if source.is_symlink():
        raise ValueError('The package must not be a symbolic link')
    if source.is_dir():
        if {item.name for item in source.iterdir()} != names:
            raise ValueError('The package must contain exactly the approved files')
        for name in names:
            item = source / name
            if item.is_symlink() or not item.is_file() or item.stat().st_size > MAX_FILE_BYTES:
                raise ValueError('Package entries must be bounded regular files')
        return {name: (source / name).read_bytes() for name in names}
    if not stat.S_ISREG(source.stat().st_mode):
        raise ValueError('Expected a package directory or ZIP file')
    with zipfile.ZipFile(source) as bundle:
        members = bundle.infolist()
        if len(members) != len(names) or {m.filename for m in members} != names:
            raise ValueError('The ZIP must contain exactly the approved files once')
        for member in members:
            kind = stat.S_IFMT(member.external_attr >> 16)
            if member.is_dir() or kind not in (0, stat.S_IFREG) or member.file_size > MAX_FILE_BYTES:
                raise ValueError('ZIP entries must be bounded regular files')
        # No extraction: untrusted names can never write paths on disk.
        return {name: bundle.read(name) for name in names}


def _compare(actual, expected):
    if actual != expected:
        raise ValueError('Package contents do not match the expected Git commit')


def verify_release(repo, commit, source):
    expected = committed_package(repo, commit)
    _compare(_read_package(source, expected), expected)
    return {'commit': commit, 'files': len(expected), 'verified': True}


def build_release(repo, commit, output, archive=None):
    entries = committed_package(repo, commit)
    output = Path(os.path.abspath(output))
    archive = Path(os.path.abspath(archive)) if archive is not None else None
    for target in (output, archive):
        if target is not None and (target.exists() or target.is_symlink()):
            raise ValueError('Output already exists; choose a new destination')
    if archive is not None and archive.is_relative_to(output):
        raise ValueError('The ZIP destination must be outside the package directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.mkdir()
    for name, data in entries.items():
        with (output / name).open('xb') as stream:
            stream.write(data)
    _compare(_read_package(output, entries), entries)
    if archive is not None:
        archive.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_STORED) as bundle:
            for name, data in entries.items():
                # Fixed metadata and uncompressed bytes make identical commits
                # independent of wall clock, host permissions and zlib versions.
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                bundle.writestr(info, data)
        _compare(_read_package(archive, entries), entries)
    return {'commit': commit, 'files': len(entries), 'verified': True,
            'output': str(output), 'archive': str(archive) if archive else None,
            'uploaded': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ('build', 'verify'):
        command = commands.add_parser(name)
        command.add_argument('--repo', type=Path, default=Path(__file__).resolve().parent)
        command.add_argument('--commit', required=True)
        if name == 'build':
            command.add_argument('--output-dir', type=Path, required=True)
            command.add_argument('--zip', type=Path)
        else:
            command.add_argument('package', type=Path)
    args = parser.parse_args()
    try:
        result = (build_release(args.repo, args.commit, args.output_dir, args.zip)
                  if args.command == 'build' else verify_release(args.repo, args.commit, args.package))
    except (ValueError, OSError, zipfile.BadZipFile, RuntimeError) as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
