"""Unit tests for the new no-fee ShortFactory queue & YouTube safety boundary."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from shortfactory_youtube_private import validate_manifest, private_upload, digest
from shortfactory_autopilot import load_episode, publish_description, loop
from shortfactory_idea_worker import candidate, read_trends


class YoutubePrivateTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.video=self.root/"reviewed.mp4"
        self.video.write_bytes(b"\x00"*100101)
        self.channel="UC"+"1"*22
        self.meta={
            "job_id":"roman-training-reviewed-001","title":"Did Romans Really Train With Heavier Weapons?",
            "description":"An original educational review. Source: https://example.org/history. "
                          "License: CC BY-SA 4.0 with contributor credits.",
            "upload_visibility":"private","rights_verified":True,"editorial_approved":True,
            "synthetic_media":True,"made_for_kids":False,"entity":"DRUZINA_ZS",
            "external_publication_approved":False,"channel_id":self.channel,
            "video_sha256":digest(self.video)
        }

    def tearDown(self):
        self.tmp.cleanup()

    def test_no_credentials_needed_for_dry_run(self):
        result=private_upload(self.video,self.meta,self.root/"state",self.root/"oauth",
                              self.channel,True)
        self.assertEqual(result["status"],"DRY_RUN_VALIDATED")
        self.assertFalse((self.root/"state").exists())

    def test_wrong_channel_blocked(self):
        with self.assertRaisesRegex(ValueError,"channel"):
            validate_manifest(self.meta,self.video,"UC"+"2"*22)

    def test_no_public_upload(self):
        self.meta["upload_visibility"]="public"
        with self.assertRaises(ValueError):
            validate_manifest(self.meta,self.video,self.channel)

    def test_no_unreviewed_or_hash_changed_upload(self):
        self.meta["editorial_approved"]=False
        with self.assertRaises(ValueError):
            validate_manifest(self.meta,self.video,self.channel)
        self.meta["editorial_approved"]=True
        self.video.write_bytes(b"x"*100101)
        with self.assertRaisesRegex(ValueError,"hash"):
            validate_manifest(self.meta,self.video,self.channel)


class AutopilotTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        (self.root/"examples").mkdir()
        (self.root/"examples"/"s.json").write_text("{}",encoding="utf-8")
        (self.root/"examples"/"v.json").write_text("{}",encoding="utf-8")
        self.queue=self.root/"queue"/"ready";self.queue.mkdir(parents=True)
        self.spec={
            "episode_id":"episode-001","voice_spec":"examples/s.json",
            "visual_spec":"examples/v.json","licensed_material_verified":True,
            "entity":"DRUZINA_ZS","upload_visibility":"private","made_for_kids":False,
            "synthetic_media":True,"preferred_variant":"action","editorial_approved":False,
            "title":"The Strange Roman Training Claim",
            "summary":"A late ancient source describes an unusual training method.",
            "cta_url":"https://example.org/join"
        }
        (self.queue/"episode-001.json").write_text(json.dumps(self.spec),encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_unsafe_reference_rejected(self):
        self.spec["visual_spec"]="../outside.json"
        (self.queue/"episode-001.json").write_text(json.dumps(self.spec),encoding="utf-8")
        with self.assertRaises((ValueError,FileNotFoundError)):
            load_episode(self.queue/"episode-001.json",self.root)

    def test_unverified_rights_rejected(self):
        self.spec["licensed_material_verified"]=False
        (self.queue/"episode-001.json").write_text(json.dumps(self.spec),encoding="utf-8")
        with self.assertRaises(ValueError):
            load_episode(self.queue/"episode-001.json",self.root)

    def test_dry_run_does_not_render_or_upload(self):
        out=loop(self.root,self.queue,self.root/"drafts",self.root/"cache",
                 self.root/"state","",True,True)
        self.assertEqual(out["status"],"DRY_RUN_READY")
        self.assertFalse((self.root/"drafts").exists())

    def test_empty_queue_idles(self):
        (self.queue/"episode-001.json").unlink()
        out=loop(self.root,self.queue,self.root/"drafts",self.root/"cache",
                 self.root/"state","",True,False)
        self.assertEqual(out["status"],"IDLE_NO_VETTED_EPISODES")

    def test_previously_rendered_unapproved_draft_is_skipped(self):
        drafts = self.root/"drafts"
        (drafts/"episode-001").mkdir(parents=True)
        (drafts/"episode-001"/"QA.json").write_text('{"status":"DRAFT_REVIEW_ONLY"}', encoding="utf-8")
        result=loop(self.root,self.queue,drafts,self.root/"cache",
                    self.root/"state","",True,False)
        self.assertEqual(result["status"],"IDLE_WAITING_FOR_NEW_OR_APPROVED_EPISODES")

    def test_description_attribution(self):
        result=publish_description(self.spec,"License CC BY-SA 4.0 Author: Example")
        self.assertIn("License",result)
        self.assertIn("https://example.org/join",result)


class IdeasTests(unittest.TestCase):
    def test_dedup_and_source_required(self):
        self.assertIsNone(candidate({"title":"Interesting Roman Fact","source_url":"not-valid"}))
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/"trends.csv"
            path.write_text(
                "title,source_url\nInteresting Roman Fact,https://example.org/source\n"
                "Interesting Roman Fact,https://example.org/source\n",encoding="utf-8")
            found=read_trends(path)
            self.assertEqual(len(found),1)
            self.assertIn("UNVERIFIED",found[0]["status"])


if __name__=="__main__":
    unittest.main()
