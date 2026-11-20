"""Offline-only model route tests: never call Ollama or the network."""
import unittest

from pc5_model_router import (
    ALLOWED_GOALS, HISTORICAL_LOCAL_MODEL, MIN_FREE_RAM_MB,
    PREFERRED_LOCAL_MODEL, operate,
)

class ModelRouterSafetyTests(unittest.TestCase):
    def call(self, payload, proposal=None, available=6100, platform="win32"):
        visits=[]
        def simulate(goal):
            visits.append(goal)
            return proposal if proposal is not None else {"route":ALLOWED_GOALS[goal]}
        result=operate(payload, system=platform,
                       memory_reader=lambda:(available,16384), infer=simulate)
        return result,visits

    def test_switched_to_installed_4b(self):
        self.assertEqual(PREFERRED_LOCAL_MODEL,"imperion-qwen35:4b")
        self.assertNotEqual(PREFERRED_LOCAL_MODEL,HISTORICAL_LOCAL_MODEL)
        self.assertGreaterEqual(MIN_FREE_RAM_MB,5120)

    def test_capabilities_without_call(self):
        r,called=self.call({"mode":"model_capabilities"})
        self.assertEqual(r["status"],"DONE")
        self.assertEqual(called,[])
        self.assertEqual(r["trusted_cloud_gateway_access"],"NOT_EXPOSED_TO_WINDOWS_WORKER")
        self.assertFalse(r["model_is_authority"])

    def test_valid_synthetic_notepad_advisory(self):
        r,called=self.call({"mode":"model_plan","goal":"synthetic_notepad_gui","data_class":"SYNTHETIC"})
        self.assertEqual(r["status"],"READY")
        self.assertEqual(r["route"],"notepad_gui_pilot")
        self.assertEqual(called,["synthetic_notepad_gui"])
        self.assertTrue(r["no_action_executed"])

    def test_valid_synthetic_csv_advisory(self):
        r,called=self.call({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"})
        self.assertEqual((r["status"],r["route"]),("READY","csv_report"))

    def test_no_inference_with_low_ram(self):
        for available in (0,400,1024,4096,5119):
            r,called=self.call({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"},available=available)
            self.assertEqual(r["reason"],"MODEL_LOW_MEMORY_NO_INFERENCE")
            self.assertEqual(called,[])

    def test_untrusted_model_extra_fields_denied(self):
        for extra in ({"go":True}, {"shell":"whoami"}, {"path":"C:\\Windows"}):
            r,_=self.call({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"},
                           proposal={"route":"csv_report",**extra})
            self.assertEqual(r["reason"],"UNTRUSTED_MODEL_FIELDS")

    def test_remote_permission_and_path_denied(self):
        for field in ("go","approved","path","text","command","prompt","model"):
            payload={"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC",field:"forbidden"}
            r,called=self.call(payload)
            self.assertEqual(r["reason"],"FIELDS_NOT_ALLOWED")
            self.assertEqual(called,[])

    def test_mismatched_model_action_denied(self):
        r,_=self.call({"mode":"model_plan","goal":"synthetic_notepad_gui","data_class":"SYNTHETIC"},
                      proposal={"route":"csv_report"})
        self.assertEqual(r["reason"],"MODEL_ROUTE_NOT_MATCHED")

    def test_private_and_external_classes_denied(self):
        for classification in ("PRIVATE","CLIENT","PUBLIC",None):
            r,called=self.call({"mode":"model_plan","goal":"synthetic_csv_report","data_class":classification})
            self.assertEqual(r["reason"],"GOAL_OR_CLASS_DENIED")
            self.assertEqual(called,[])

    def test_arbitrary_goal_and_wrong_platform_denied(self):
        r,_=self.call({"mode":"model_plan","goal":"powershell","data_class":"SYNTHETIC"})
        self.assertEqual(r["reason"],"GOAL_OR_CLASS_DENIED")
        r,_=self.call({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"},platform="linux")
        self.assertEqual(r["reason"],"WINDOWS_REQUIRED")

    def test_bad_memory_and_remote_model_failure(self):
        r=operate({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"},
                  system="win32",memory_reader=lambda:(30000,16384),infer=lambda _:{"route":"csv_report"})
        self.assertEqual(r["reason"],"MEMORY_READBACK_INVALID")
        r=operate({"mode":"model_plan","goal":"synthetic_csv_report","data_class":"SYNTHETIC"},
                  system="win32",memory_reader=lambda:(6100,16384),
                  infer=lambda _:(_ for _ in ()).throw(TimeoutError()))
        self.assertTrue(r["reason"].startswith("MODEL_UNAVAILABLE"))
if __name__=="__main__":
    unittest.main()
