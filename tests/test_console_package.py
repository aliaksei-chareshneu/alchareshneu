"""Local source-package fixtures; no cloud, deployment or private source data."""
import hashlib
import json
from pathlib import Path
import stat
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile

import package_console_release as release


SCRIPT = Path(release.__file__).resolve()


class ConsolePackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='console-package-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        self.git('init', '-q')
        for name in release.SOURCES:
            (self.repo / name).write_text('TEST-ONLY committed source: ' + name + '\n')
        for name in ('.clasp.json', 'appsscript.json', 'Code.gs', 'PlatformRecovery.gs', '.env'):
            (self.repo / name).write_text('TEST-ONLY-PRIVATE-FIXTURE')
        self.commit = self.commit_all()

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.repo), *args], stderr=subprocess.DEVNULL).decode().strip()

    def commit_all(self):
        self.git('add', '--all')
        self.git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
                 'commit', '-q', '--no-gpg-sign', '-m', 'Synthetic package fixture')
        return self.git('rev-parse', 'HEAD')

    def build(self, suffix=''):
        output, archive = self.root / ('output' + suffix), self.root / ('release' + suffix + '.zip')
        result = release.build_release(self.repo, self.commit, output, archive)
        return output, archive, result

    def test_build_preserves_nine_file_allowlist_and_checksums_without_private_configuration(self):
        output, archive, result = self.build()
        self.assertTrue(result['verified'])
        self.assertFalse(result['uploaded'])
        self.assertEqual(result['files'], 9)
        self.assertEqual(set(p.name for p in output.iterdir()), set(release.PACKAGE_NAMES))
        self.assertEqual((output / 'SOURCE_COMMIT').read_text(), self.commit + '\n')
        for line in (output / 'SHA256SUMS').read_text().splitlines():
            digest, name = line.split('  ')
            self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), digest)
        with zipfile.ZipFile(archive) as bundle:
            self.assertEqual(set(bundle.namelist()), set(release.PACKAGE_NAMES))
            self.assertTrue(all(b'TEST-ONLY-PRIVATE-FIXTURE' not in bundle.read(name) for name in bundle.namelist()))
        self.assertTrue(release.verify_release(self.repo, self.commit, output)['verified'])
        self.assertTrue(release.verify_release(self.repo, self.commit, archive)['verified'])

    def test_selected_commit_ignores_dirty_untracked_and_newer_worktree_contents(self):
        original = (self.repo / release.SOURCES[0]).read_bytes()
        (self.repo / release.SOURCES[0]).write_text('TEST-ONLY later commit')
        self.commit_all()
        (self.repo / release.SOURCES[0]).write_text('TEST-ONLY dirty edit')
        (self.repo / 'PRIVATE-NOTES.txt').write_text('TEST-ONLY untracked note')
        output, archive, _ = self.build()
        self.assertEqual((output / release.SOURCES[0]).read_bytes(), original)
        self.assertEqual((self.repo / release.SOURCES[0]).read_text(), 'TEST-ONLY dirty edit')
        self.assertTrue(release.verify_release(self.repo, self.commit, archive)['verified'])

    def test_same_commit_produces_identical_zip_bytes_with_fixed_metadata(self):
        _, first, _ = self.build('-one')
        (self.repo / release.SOURCES[0]).chmod(0o600)
        _, second, _ = self.build('-two')
        self.assertEqual(first.read_bytes(), second.read_bytes())
        with zipfile.ZipFile(first) as bundle:
            for item in bundle.infolist():
                self.assertEqual(item.date_time, (1980, 1, 1, 0, 0, 0))
                self.assertEqual(item.compress_type, zipfile.ZIP_STORED)
                self.assertEqual(stat.S_IMODE(item.external_attr >> 16), 0o644)

    def test_missing_or_symlinked_committed_source_fails_before_creating_outputs(self):
        target = self.repo / release.SOURCES[0]
        for kind in ('missing', 'symlink'):
            with self.subTest(kind=kind):
                target.unlink(missing_ok=True)
                if kind == 'symlink':
                    target.symlink_to('.env')
                commit = self.commit_all()
                output = self.root / ('invalid-' + kind)
                with self.assertRaisesRegex(ValueError, 'missing|regular files'):
                    release.build_release(self.repo, commit, output)
                self.assertFalse(output.exists())

    def test_ref_abbreviated_missing_and_noncommit_objects_are_rejected_before_output(self):
        blob = self.git('rev-parse', self.commit + ':' + release.SOURCES[0])
        for commit in ('HEAD', self.commit[:7], '--help', 'f' * 40, blob):
            with self.subTest(commit=commit):
                with self.assertRaises(ValueError):
                    release.build_release(self.repo, commit, self.root / 'invalid')
                self.assertFalse((self.root / 'invalid').exists())

    def test_existing_or_nested_outputs_are_rejected_without_overwriting(self):
        output, archive, _ = self.build()
        previous = archive.read_bytes()
        (output / 'owner-note').write_text('TEST-ONLY keep')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            release.build_release(self.repo, self.commit, output, self.root / 'new.zip')
        with self.assertRaisesRegex(ValueError, 'already exists'):
            release.build_release(self.repo, self.commit, self.root / 'new-output', archive)
        self.assertFalse((self.root / 'new-output').exists())
        self.assertEqual(archive.read_bytes(), previous)
        self.assertEqual((output / 'owner-note').read_text(), 'TEST-ONLY keep')
        nested = self.root / 'nested'
        with self.assertRaisesRegex(ValueError, 'outside'):
            release.build_release(self.repo, self.commit, nested, nested / 'release.zip')
        self.assertFalse(nested.exists())

    def test_tampered_sources_fail_even_when_the_attacker_recomputes_checksums(self):
        output, _, _ = self.build()
        target = output / release.SOURCES[0]
        target.write_text('TEST-ONLY tampered contents')
        with self.assertRaisesRegex(ValueError, 'do not match'):
            release.verify_release(self.repo, self.commit, output)
        entries = {name: (output / name).read_bytes() for name in ('SOURCE_COMMIT', *release.SOURCES)}
        (output / 'SHA256SUMS').write_text(''.join(hashlib.sha256(data).hexdigest() + '  ' + name + '\n' for name, data in entries.items()))
        with self.assertRaisesRegex(ValueError, 'do not match'):
            release.verify_release(self.repo, self.commit, output)

    def test_extra_missing_and_symlinked_directory_entries_are_rejected(self):
        for kind in ('extra', 'missing', 'symlink'):
            with self.subTest(kind=kind):
                output, _, _ = self.build('-' + kind)
                if kind == 'extra':
                    (output / '.clasp.json').write_text('TEST-ONLY unexpected')
                else:
                    (output / release.SOURCES[0]).unlink()
                    if kind == 'symlink':
                        (output / release.SOURCES[0]).symlink_to(self.repo / release.SOURCES[0])
                with self.assertRaisesRegex(ValueError, 'approved files|regular files'):
                    release.verify_release(self.repo, self.commit, output)

    def test_zip_duplicates_traversal_symlinks_and_oversized_entries_are_rejected_without_extraction(self):
        entries = release.committed_package(self.repo, self.commit)
        for kind in ('duplicate', 'traversal', 'symlink', 'oversized'):
            with self.subTest(kind=kind):
                archive = self.root / (kind + '.zip')
                with warnings.catch_warnings(), zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
                    warnings.simplefilter('ignore', UserWarning)
                    for name, data in entries.items():
                        if name == release.SOURCES[0] and kind == 'symlink':
                            info = zipfile.ZipInfo(name)
                            info.create_system = 3
                            info.external_attr = (stat.S_IFLNK | 0o777) << 16
                            bundle.writestr(info, '.env')
                        elif name == release.SOURCES[0] and kind == 'oversized':
                            bundle.writestr(name, b'x' * (release.MAX_FILE_BYTES + 1))
                        else:
                            bundle.writestr(name, data)
                    if kind in ('duplicate', 'traversal'):
                        bundle.writestr(release.SOURCES[0] if kind == 'duplicate' else '../extracted.txt', 'TEST-ONLY extra')
                with self.assertRaisesRegex(ValueError, 'approved files|regular files'):
                    release.verify_release(self.repo, self.commit, archive)
                self.assertFalse((self.root / 'extracted.txt').exists())

    def test_expected_commit_is_checked_even_when_source_files_did_not_change(self):
        _, archive, _ = self.build()
        (self.repo / 'Code.gs').write_text('TEST-ONLY new unrelated commit')
        newer = self.commit_all()
        with self.assertRaisesRegex(ValueError, 'do not match'):
            release.verify_release(self.repo, newer, archive)
        self.assertTrue(release.verify_release(self.repo, self.commit, archive)['verified'])

    def test_verifier_accepts_deflated_download_archives_with_platform_neutral_permissions(self):
        archive = self.root / 'download.zip'
        with zipfile.ZipFile(archive, 'w') as bundle:
            for name, data in release.committed_package(self.repo, self.commit).items():
                info = zipfile.ZipInfo(name)
                info.create_system = 0
                info.compress_type = zipfile.ZIP_DEFLATED
                bundle.writestr(info, data)
        self.assertTrue(release.verify_release(self.repo, self.commit, archive)['verified'])

    def test_cli_builds_and_verifies_with_compact_receipts_and_clear_failures(self):
        output, archive = self.root / 'cli-output', self.root / 'cli.zip'
        common = ['--repo', str(self.repo), '--commit', self.commit]
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), 'build', *common,
                                 '--output-dir', str(output), '--zip', str(archive)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['verified'])
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), 'verify', *common, str(archive)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)['commit'], self.commit)
        (output / 'SOURCE_COMMIT').write_text('TEST-ONLY invalid')
        result = subprocess.run([sys.executable, '-B', str(SCRIPT), 'verify', *common, str(output)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('do not match', result.stderr)
        self.assertNotIn('TEST-ONLY invalid', result.stderr)
        self.assertEqual(result.stdout, '')

    def test_real_committed_package_prepares_a_synthetic_bound_project_without_deployment(self):
        repo = SCRIPT.parent
        commit = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
        package = self.root / 'real-package'
        release.build_release(repo, commit, package)
        cloud = self.root / 'synthetic-pull'
        cloud.mkdir()
        original = {'.clasp.json': '{"scriptId":"TEST-ONLY-bound-project","rootDir":"."}',
                    'appsscript.json': '{"timeZone":"Europe/Prague"}',
                    'Code.js': 'function onOpen() {}\n',
                    'RevenuePipeline.js': 'function rpOnLeadFormSubmit() {}\n'}
        for name, text in original.items():
            (cloud / name).write_text(text)
        prepared = self.root / 'prepared'
        code = 'process.stdout.write(JSON.stringify(require(process.argv[1]).prepare(...process.argv.slice(2))))'
        result = subprocess.run(['node', '-e', code, str(package / 'prepare-console-bank-release.cjs'),
                                 str(cloud), str(prepared), 'TEST-ONLY-bound-project'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(json.loads(result.stdout)['uploaded'])
        for name, text in original.items():
            self.assertEqual((cloud / name).read_text(), text)
            self.assertEqual((prepared / name).read_text(), text)
        for name in ('OperatorConsoleServer.js', 'OperatorConsole.html', 'FioOSVC.js',
                     'FioDruzinaConsole.js', 'PaymentReconciliation.js'):
            self.assertTrue((prepared / name).is_file())
        self.assertFalse((prepared / 'PlatformRecovery.js').exists())


if __name__ == '__main__':
    unittest.main()
