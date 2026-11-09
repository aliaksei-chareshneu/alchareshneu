"""No-network, no-model unit tests of owner-only GitHub task dispatch."""
from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

SRC = Path(__file__).with_name("owner_comment_poller.py")
if not SRC.is_file():
    SRC = Path(__file__).resolve().parents[1] / "scripts" / "imperion-owner-comment-poller.py"
spec = importlib.util.spec_from_file_location("imperion_owner_poller", SRC)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def comment(num, body, login=mod.OWNER, assoc="OWNER", kind="User"):
    return {"id": num, "body": body,
            "user": {"login": login, "type": kind},
            "author_association": assoc}

class PollerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="imperion-dev-agent-test-")
        self.addCleanup(self.tmp.cleanup)
        self.state = Path(self.tmp.name)
        self.old = mod.STATE
        self.addCleanup(lambda: setattr(mod, "STATE", self.old))
    def tick(self, comments, executor=None):
        with redirect_stdout(io.StringIO()):
            return mod.poll(comments, self.state, executor)
    def cursor(self):
        return json.loads((self.state/"cursor.json").read_text())["last_seen_comment_id"]
    def events(self):
        return [json.loads(x) for x in (self.state/"events.jsonl").read_text().splitlines()]

    def test_authentic_owner_allowlist_only(self):
        self.assertEqual(mod.owner_command(comment(1,"/imperion-dev ping")),"ping")
        self.assertEqual(mod.owner_command(comment(2,"/imperion-dev smoke\n")),"smoke")
        for c in [
            comment(3, "/imperion-dev ping",login="imposter"),
            comment(4, "/imperion-dev ping",assoc="CONTRIBUTOR"),
            comment(5, "/imperion-dev ping",kind="Bot"),
            comment(6, "/imperion-dev ping ; rm -rf ~"),
            comment(7, "/imperion-dev run arbitrary"),
            comment(8, "/imperion-dev smoke\nimport os"),
            comment(9, "ping")
        ]:
            self.assertIsNone(mod.owner_command(c))

    def test_first_poll_never_executes_historical_comments(self):
        fn=mock.Mock(return_value={"ok":True})
        a=self.tick([comment(60,"/imperion-dev smoke")],fn)
        self.assertEqual(a["status"],"INITIALIZED_OLD_COMMENTS_NOT_REPLAYED")
        self.assertEqual(self.cursor(),60)
        fn.assert_not_called()

    def test_auth_owner_new_comment_triggers_once(self):
        self.tick([comment(60,"/imperion-dev ping")])
        fn=mock.Mock(return_value={"model":"dummy","available":True})
        result=self.tick([comment(60,"/imperion-dev ping"),comment(61,"/imperion-dev ping")],fn)
        self.assertEqual(result["status"],"PASS")
        fn.assert_called_once_with("ping",61)
        self.assertEqual(result["comment_id"],61)
        self.assertEqual(self.cursor(),61)
        self.assertEqual(self.tick([comment(61,"/imperion-dev ping")],fn)["status"],
                         "IDLE_NO_NEW_OWNER_COMMAND")
        fn.assert_called_once()

    def test_idle_preserves_last_job_readback(self):
        self.tick([comment(10,"old")])
        result=self.tick([comment(11,"/imperion-dev ping")],
                         lambda *_: {"loopback_model_available":True})
        self.assertEqual(result["status"],"PASS")
        self.tick([comment(11,"/imperion-dev ping")])
        last=json.loads((self.state/"last_job.json").read_text())
        self.assertEqual(last["status"],"PASS")
        self.assertEqual(last["comment_id"],11)

    def test_nonowner_or_wrong_command_never_executes(self):
        self.tick([comment(9,"older")])
        fn=mock.Mock(side_effect=RuntimeError("should never run"))
        self.tick([
            comment(10,"/imperion-dev smoke",login="attacker"),
            comment(11,"/imperion-dev smoke",assoc="COLLABORATOR"),
            comment(12,"/imperion-dev smoke && dangerous"),
            comment(13,"/imperion-dev deploy"),
        ],fn)
        fn.assert_not_called()
        self.assertEqual(self.cursor(),13)

    def test_failure_is_blocked_without_automatic_replay(self):
        self.tick([comment(99,"irrelevant")])
        fn=mock.Mock(side_effect=RuntimeError("no model"))
        result=self.tick([comment(100,"/imperion-dev smoke")],fn)
        self.assertEqual(result["status"],"BLOCKED")
        self.assertEqual(result["reason"],"no model")
        self.assertFalse(result["retry_automatic"])
        self.assertEqual(self.cursor(),100)
        self.tick([comment(100,"/imperion-dev smoke")],fn)
        fn.assert_called_once()

    def test_two_owner_tasks_max_per_tick(self):
        self.tick([comment(100,"old")])
        fn=mock.Mock(return_value={"available":True})
        self.tick([comment(i,"/imperion-dev ping") for i in range(101,105)],fn)
        self.assertEqual(fn.call_count,2)
        self.assertEqual(self.cursor(),102)
        self.tick([comment(i,"/imperion-dev ping") for i in range(101,105)],fn)
        self.assertEqual(fn.call_count,4)
        self.assertEqual(self.cursor(),104)

    def test_lock_is_fail_closed(self):
        self.state.joinpath("poll.lock").write_text("session")
        result=self.tick([comment(20,"/imperion-dev ping")])
        self.assertEqual(result["status"],"BLOCKED_ALREADY_RUNNING")
        self.assertTrue(self.state.joinpath("poll.lock").exists())

    def test_ping_never_calls_model_inference(self):
        payload=b'{"models":[{"name":"imperion-qwen35:4b"}]}'
        class Response:
            status=200
            def __enter__(self):return self
            def __exit__(self,*args):return False
            def read(self,*args):return payload
        with mock.patch.object(mod,"urlopen",return_value=Response()) as url:
            result=mod.check_local_model()
        self.assertTrue(result["loopback_model_available"])
        self.assertEqual(result["model"],"imperion-qwen35:4b")
        self.assertEqual(url.call_count,1)

    def test_owner_build_code_command_exact_scope(self):
        cmd = comment(170, "/imperion-dev build roi-brand")
        self.assertEqual(mod.owner_command(cmd), "build roi-brand")
        self.assertIsNone(mod.owner_command(comment(171, "/imperion-dev build other")))
        self.assertIsNone(mod.owner_command(comment(172, "/imperion-dev build roi-brand && dangerous")))
        self.assertIsNone(mod.owner_command(comment(173, "/imperion-dev build roi-brand", login="stranger")))
        expected={"review_branch":"agent/imperion-dev-roi-brand-20261109",
                  "review_commit":"e9021ef8d68021dfb00f31048daf266d7d9b3b80"}
        with mock.patch.object(mod,"run_public_source_job",return_value=expected) as run:
            self.assertEqual(mod.execute("build roi-brand", 170),expected)
            run.assert_called_once_with()
        with self.assertRaisesRegex(ValueError,"COMMAND_NOT_ALLOWLISTED"):
            mod.execute("build other", 170)

    def test_exact_owner_cloud_profile_build_allowlisted(self):
        self.assertEqual(mod.owner_command(comment(201, "/imperion-dev build cloud-profile")),
                         "build cloud-profile")
        for c in [
            comment(202,"/imperion-dev build cloud-profile; rm -rf ~"),
            comment(203,"/imperion-dev build cloud-profile",login="not-owner"),
            comment(204,"/imperion-dev build cloud-profile",assoc="CONTRIBUTOR"),
            comment(205,"/imperion-dev build cloud-profile extra")
        ]:
            self.assertIsNone(mod.owner_command(c))
        with mock.patch.object(mod,"run_cloud_profile_job",
               return_value={"review_pr":"https://github.com/aliaksei-chareshneu/alchareshneu/pull/246"}) as worker:
            result=mod.execute("build cloud-profile",201)
            self.assertIn("review_pr",result)
            worker.assert_called_once_with()

    def test_invalid_github_schema_fails_closed(self):
        with mock.patch.object(mod,"_api_get",return_value=([{"id":"broken"}],"")):
            with self.assertRaisesRegex(ValueError,"INVALID_COMMENT_IDS"):
                mod.get_comments()

if __name__=="__main__":
    unittest.main(verbosity=2)
