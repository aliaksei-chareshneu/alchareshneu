"""Agent5 low-memory diagnostic safety tests; no real Windows calls."""
import unittest
from pathlib import Path
from types import SimpleNamespace
from browser_bridge_adapter import dispatch
import pc5_low_ram_audit as m

GB=1024**3
class LightweightAudit(unittest.TestCase):
    def probe(self, **kw):
        defaults=dict(platform="win32",memory_reader=lambda:(450,16384),
                      disk_reader=lambda path:SimpleNamespace(free=18*GB,total=120*GB),
                      uptime_reader=lambda:12345,
                      names_reader=lambda:["chrome.exe","chrome.exe","python.exe","notepad.exe"],
                      env={"SystemDrive":"C:"})
        defaults.update(kw)
        return m.operate({"mode":"audit_light"},**defaults)
    def test_low_ram_returns_coarse_readback(self):
        v=self.probe()
        self.assertEqual(v["status"],"DONE")
        self.assertEqual(v["ram_free_mb"],450)
        self.assertFalse(v["ram_gui_ready"])
        self.assertEqual(v["allowlisted_process_counts"]["chrome"],2)
        self.assertEqual(v["changes_applied"],0)
        self.assertEqual(v["apps_terminated"],0)
        self.assertFalse(v["worker_restarted"])
    def test_above_ram_thresholds(self):
        v=self.probe(memory_reader=lambda:(5200,16384))
        self.assertTrue(v["ram_gui_ready"])
        self.assertTrue(v["ram_local_4b_ready"])
    def test_input_is_mode_only(self):
        for x in ({"mode":"audit_light","path":"C:/private"},
                  {"mode":"audit_light","go":True},
                  {"mode":"audit_light","command":"powershell"},
                  {"mode":"audit_light","app":"chrome"}):
            with self.subTest(x=x):
                self.assertEqual(m.operate(x,platform="win32")["reason"],"FIELDS_NOT_ALLOWED")
    def test_foreign_platform_denied(self):
        self.assertEqual(m.operate({"mode":"audit_light"},platform="linux")["reason"],"WINDOWS_REQUIRED")
    def test_untrusted_os_drive_denied(self):
        self.assertEqual(self.probe(env={"SystemDrive":"\\\\host\\data"})["reason"],"SYSTEM_DRIVE_UNAVAILABLE")
    def test_bogus_data_rejected(self):
        for reader in [lambda:(True,16384),lambda:(-10,16384),
                       lambda:(20000,16384),lambda:("x",16384)]:
            self.assertEqual(self.probe(memory_reader=reader)["status"],"BLOCKED")
    def test_subprocess_not_invoked(self):
        self.assertNotIn("subprocess",m.operate.__code__.co_names)
        self.assertNotIn("system",m.operate.__code__.co_names)
    def test_no_os_paths_in_response(self):
        v=self.probe()
        self.assertNotIn("C:\\Users",str(v))
        self.assertEqual(v["scope"],"COARSE_READ_ONLY_NO_PATHS")
    def test_adapter_light_mode(self):
        r=dispatch("pc_operator",{"mode":"audit_light"})
        self.assertIn(r["result"]["status"],("DONE","BLOCKED"))
        self.assertNotEqual(r["result"].get("reason"),"MODE_NOT_ALLOWED")

if __name__=="__main__":unittest.main()
