"""Synthetic GUI security regression: no actual desktop, network or accounts."""
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pc5_gui_pilot as gui
import pc5_gui_readback as independent
from browser_bridge_adapter import dispatch

class FakeNotepad:
    def __init__(self, fail=False):
        self.actions=0
        self.fail=fail
    def preflight(self):
        return None
    def append_save(self, path, task_id):
        self.actions+=1
        if self.fail:
            raise gui.Denied("FOCUS_LOST_BEFORE_ACTION")
        path.write_bytes(gui.expected_text(task_id).encode("utf-8"))
        return {"window_verified":True,"input_sent":True,"save_sent":True}

class GUIBoundaries(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)/"work"
        self.approvals=Path(self.temp.name)/"trusted"
        for p in [self.root/"inbox",self.root/"receipts",self.approvals]:p.mkdir(parents=True)
        self.task_id="A5-GUI-CI-20261115-0001"
        self.clock=datetime(2026,11,15,6,0,tzinfo=timezone.utc)
        (self.root/"inbox"/(self.task_id+".txt")).write_bytes(gui.FIXTURE)
        self.driver=FakeNotepad()
    def tearDown(self):
        self.temp.cleanup()
    def payload(self,step="execute",**kw):
        return dict(mode="gui_pilot",step=step,task_id=self.task_id,app="notepad",**kw)
    def approve(self):
        body={"task_id":self.task_id,"app":"notepad","action":gui.ACTION,
              "source_sha256":gui.sha(gui.FIXTURE),
              "expires_at":(self.clock+timedelta(minutes=5)).isoformat(),
              "approval_ref":"GO-CI-20261115-0001"}
        (self.approvals/(self.task_id+".json")).write_text(json.dumps(body),encoding="utf-8")
    def invoke(self,step="execute",driver=None,free=2048,**extras):
        return gui.operate(self.payload(step,**extras),root=self.root,approvals=self.approvals,
                           driver=self.driver if driver is None else driver,clock=self.clock,
                           platform="win32",free_ram_mb=free)
    def test_capabilities_without_windows(self):
        self.assertEqual(dispatch("pc_operator",{"mode":"gui_pilot","step":"capabilities"})["result"]["status"],"DONE")
    def test_remote_go_never_grants(self):
        self.assertEqual(self.invoke(go=True)["reason"],"FIELDS_NOT_ALLOWED")
        self.assertEqual(self.driver.actions,0)
    def test_foreign_app_rejected(self):
        self.assertEqual(gui.operate(dict(mode="gui_pilot",step="plan",task_id=self.task_id,app="calculator"),root=self.root,approvals=self.approvals)["reason"],"APP_NOT_ALLOWLISTED")
    def test_no_approval_denied(self):
        self.assertEqual(self.invoke()["status"],"BLOCKED")
        self.assertEqual(self.driver.actions,0)
    def test_plan_without_write(self):
        self.assertEqual(self.invoke("plan")["status"],"READY")
        self.assertFalse((self.root/"gui_work").exists())
    def test_memory_guard_before_claim(self):
        self.approve()
        self.assertEqual(self.invoke(free=10)["reason"],"GUI_LOW_MEMORY_NO_EXECUTION")
        self.assertFalse((self.approvals/(self.task_id+".claimed")).exists())
    def test_synthetic_complete_and_independent_check(self):
        self.approve()
        result=self.invoke()
        self.assertEqual(result["status"],"DONE")
        evidence=independent.verify_task(self.task_id,root=self.root,approvals=self.approvals)
        self.assertEqual(evidence["status"],"DONE")
        self.assertEqual(result["output_sha256"],evidence["output_sha256"])
    def test_duplicate_is_replay_not_retype(self):
        self.approve()
        self.assertEqual(self.invoke()["status"],"DONE")
        second=self.invoke()
        self.assertEqual(second["status"],"DONE")
        self.assertTrue(second["replay"])
        self.assertEqual(self.driver.actions,1)
    def test_tampered_output_rejected(self):
        self.approve()
        self.assertEqual(self.invoke()["status"],"DONE")
        (self.root/"gui_work"/(self.task_id+".txt")).write_bytes(b"tampered")
        self.assertEqual(independent.verify_task(self.task_id,root=self.root,approvals=self.approvals)["status"],"BLOCKED")
    def test_interrupted_gui_requires_human_review(self):
        self.approve()
        bad=FakeNotepad(fail=True)
        result=self.invoke(driver=bad)
        self.assertEqual(result["reason"],"FOCUS_LOST_BEFORE_ACTION")
        self.assertEqual(self.invoke("status")["reason"],"INCOMPLETE_ATTEMPT_MANUAL_REVIEW")
        self.assertEqual(self.invoke()["reason"],"APPROVAL_ALREADY_CONSUMED")
    def test_shell_and_path_denied(self):
        self.assertEqual(self.invoke(command="whoami")["reason"],"FIELDS_NOT_ALLOWED")
        self.assertEqual(self.invoke(path="C:/private")["reason"],"FIELDS_NOT_ALLOWED")
    def test_cloud_adapter_no_self_approval(self):
        self.assertEqual(dispatch("pc_operator",{"mode":"gui_pilot","step":"execute",
          "task_id":self.task_id,"app":"notepad","approved":True})["result"]["reason"],"FIELDS_NOT_ALLOWED")
    def test_no_arbitrary_worker_actions(self):
        self.assertEqual(dispatch("pc_operator",{"mode":"app_launch","app":"chrome"})["result"]["status"],"BLOCKED")

if __name__=="__main__":
    unittest.main()
