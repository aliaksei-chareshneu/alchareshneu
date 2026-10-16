import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import types
import unittest

spec=importlib.util.spec_from_file_location('worker',Path(__file__).parents[1]/'shortfactory_autopilot.py')
w=importlib.util.module_from_spec(spec); spec.loader.exec_module(w)

class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.base=Path(self.temp.name); (self.base/'ShortFactory').mkdir()
        (self.base/'ShortFactory'/'short_factory.py').write_text('# fixture')
        self.source=self.base/'source'; self.source.write_bytes(b'owned fixture')
        self.db=self.base/'media_index.sqlite'
        with sqlite3.connect(self.db) as c:
            c.execute('CREATE TABLE short_jobs(job_id,status,rights_status,source_path,source_sha256,created_at,output_path)')
            c.execute('INSERT INTO short_jobs VALUES(?,?,?,?,?,?,?)',('test','QUEUED_SAFE_SOURCE','owned',str(self.source),w.digest(self.source),'2026',''))
    def test_preview_never_executes(self):
        def forbidden(*a,**k): raise AssertionError('must not execute')
        r=w.run_once(self.base,runner=forbidden); self.assertEqual(r['selected'],1); self.assertEqual(r['rendered'],0)
    def test_changed_source_blocks_render(self):
        self.source.write_bytes(b'changed'); r=w.run_once(self.base,execute=True)
        self.assertEqual(r['failed'],1); self.assertEqual(r['rendered'],0)
    def test_exit_zero_without_db_receipt_is_failure(self):
        r=w.run_once(self.base,execute=True,runner=lambda *a,**k:types.SimpleNamespace(returncode=0))
        self.assertEqual(r['failed'],1)
    def test_success_requires_output_and_db_state(self):
        def render(*a,**k):
            output=self.base/'result.mp4'; output.write_bytes(b'fixture')
            with sqlite3.connect(self.db) as c: c.execute("UPDATE short_jobs SET status='READY_FOR_REVIEW',output_path=?",(str(output),))
            return types.SimpleNamespace(returncode=0)
        r=w.run_once(self.base,execute=True,runner=render)
        self.assertEqual(r['rendered'],1); self.assertEqual(r['published'],0)
        self.assertEqual(w.run_once(self.base)['selected'],0)
    def test_transformative_source_never_auto_selected(self):
        with sqlite3.connect(self.db) as c: c.execute("UPDATE short_jobs SET rights_status='transformative_review'")
        self.assertEqual(w.run_once(self.base)['selected'],0)
    def test_existing_lock_not_removed_or_bypassed(self):
        lock=self.base/'ShortFactory'/'autopilot.lock'; lock.write_text('123')
        with self.assertRaises(FileExistsError): w.run_once(self.base)
        self.assertEqual(lock.read_text(),'123')

if __name__=='__main__': unittest.main()
