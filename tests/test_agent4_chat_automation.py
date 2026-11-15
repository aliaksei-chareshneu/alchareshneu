import hashlib
import json
import sqlite3
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "ops"))
from agent4_business_connection import handle_update, approved_send, key, digest
from install_agent4_chat_automation import patch, SIGNATURE

CID="conn_Pasha_test_123"
OWNER=86001
PASHA=71002
NOW=1794760000

class Harness:
    def __init__(self):
        self.db=sqlite3.connect(":memory:")
        self.db.row_factory=sqlite3.Row
        self.db.executescript("""
          CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT);
          CREATE TABLE jobs(id INTEGER PRIMARY KEY,source TEXT,peer TEXT,
            external_id TEXT,text TEXT,draft TEXT,state TEXT DEFAULT 'draft',
            UNIQUE(source,peer,external_id));
          CREATE TABLE events(job INTEGER,state TEXT);
        """)
        self.put(self.db, "agent4_owner_test_peer_sha256", digest(OWNER))
    def get(self,db,k,default=""):
        x=db.execute("SELECT value FROM settings WHERE key=?",(k,)).fetchone()
        return x[0] if x else default
    def put(self,db,k,v):
        with db: db.execute("INSERT OR REPLACE INTO settings VALUES(?,?)",(k,str(v)))
    def enqueue(self,db,source,peer,external_id,text):
        with db:
            db.execute("INSERT OR IGNORE INTO jobs(source,peer,external_id,text,draft) VALUES(?,?,?,?,?)",
                       (source,peer,external_id,text,"Draft only"))
        return db.execute("SELECT id FROM jobs WHERE source=? AND peer=? AND external_id=?",
                          (source,peer,external_id)).fetchone()[0]
    def event(self,db,job,state):
        with db: db.execute("INSERT INTO events(job,state) VALUES(?,?)",(job,state))
    def apply(self,update):
        return handle_update(self.db,update,self.get,self.put,self.enqueue,self.event,now=NOW)
    def connect(self,owner=OWNER,active=True,reply=True):
        return self.apply({"business_connection":{"id":CID,"user":{"id":owner},
                           "rights":{"can_reply":reply},"is_enabled":active}})
    def allow(self,consent=True,scope="OSVC"):
        self.put(self.db,key("controller",CID,PASHA),scope)
        if consent:self.put(self.db,key("consent",CID,PASHA),"AFFIRMATIVE")
    def inbound(self,text="Is Czech practice available?",id=1,peer=PASHA,from_id=PASHA):
        return self.apply({"business_message":{"business_connection_id":CID,
          "chat":{"id":peer,"type":"private"},"from":{"id":from_id},
          "date":NOW,"message_id":id,"text":text}})

class Tests(unittest.TestCase):
    def setUp(self):self.h=Harness()
    def test_no_connection(self):
        self.assertEqual(self.h.inbound()["status"],"BLOCKED_CONNECTION_NOT_VERIFIED")
    def test_bad_connection_owner(self):
        self.assertEqual(self.h.connect(owner=OWNER+1)["status"],"BLOCKED_BUSINESS_OWNER_UNVERIFIED")
    def test_connection_is_owner_bound(self):
        self.assertEqual(self.h.connect()["status"],"BUSINESS_CONNECTION_RECORDED")
        self.assertNotIn("Pasha",self.h.get(self.h.db,key("connection",CID)))
    def test_unconsented_chat_is_not_saved(self):
        self.h.connect(); self.assertEqual(self.h.inbound()["status"],"BLOCKED_CHAT_SCOPE_OR_CONSENT")
        self.assertEqual(self.h.db.execute("SELECT count(*) FROM jobs").fetchone()[0],0)
    def test_chat_scope_is_explicit(self):
        self.h.connect();self.h.allow(scope="OTHER")
        self.assertEqual(self.h.inbound()["status"],"BLOCKED_CHAT_SCOPE_OR_CONSENT")
    def test_valid_chat_is_draft_only(self):
        self.h.connect();self.h.allow()
        r=self.h.inbound()
        self.assertEqual(r["status"],"BUSINESS_MESSAGE_QUEUED_DRAFT_ONLY")
        self.assertFalse(r["external_send"])
        self.assertEqual(self.h.db.execute("SELECT source FROM jobs").fetchone()[0],"telegram-agent4")
    def test_repeat_is_idempotent(self):
        self.h.connect();self.h.allow();a=self.h.inbound();b=self.h.inbound()
        self.assertEqual(a["job_id"],b["job_id"])
        self.assertEqual(self.h.db.execute("SELECT count(*) FROM events").fetchone()[0],2)
    def test_optout_blocks_later(self):
        self.h.connect();self.h.allow()
        self.assertEqual(self.h.inbound(text="/stop")["status"],"CHAT_OPTED_OUT")
        self.assertEqual(self.h.inbound(id=2)["status"],"BLOCKED_CHAT_SCOPE_OR_CONSENT")
    def test_reply_permission_denied(self):
        self.h.connect(reply=False);self.h.allow()
        self.assertEqual(self.h.inbound()["status"],"BLOCKED_CHAT_SCOPE_OR_CONSENT")
    def test_owner_outgoing_not_ingested(self):
        self.h.connect();self.h.allow()
        self.assertEqual(self.h.inbound(from_id=OWNER)["status"],"IGNORED_NOT_INCOMING_DM")
    def test_pilot_is_not_buyer(self):
        self.h.connect();self.h.allow()
        self.h.put(self.h.db,"agent4_biz_test_peer_sha256",digest(PASHA))
        j=self.h.inbound()["job_id"]
        self.assertTrue(self.h.db.execute("SELECT 1 FROM events WHERE job=? "
                        "AND state='OWNER_SELFTEST_ONLY'",(j,)).fetchone())
    def test_edit_redacts_original(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        status=self.h.apply({"edited_business_message":{"business_connection_id":CID,
                            "chat":{"id":PASHA},"message_id":1}})["status"]
        self.assertEqual(status,"BUSINESS_REDACTED")
        self.assertEqual(self.h.db.execute("SELECT text FROM jobs WHERE id=?",(j,)).fetchone()[0],"")
    def test_delete_redacts_original(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        status=self.h.apply({"deleted_business_messages":{"business_connection_id":CID,
                "chat":{"id":PASHA},"message_ids":[1]}})["status"]
        self.assertEqual(status,"BUSINESS_REDACTED")
        self.assertIsNone(self.h.db.execute("SELECT draft FROM jobs WHERE id=?",(j,)).fetchone()[0])
    def test_disconnect_redacts_original(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        self.assertEqual(self.h.connect(active=False)["status"],"BUSINESS_CONNECTION_DISABLED")
        self.assertEqual(self.h.db.execute("SELECT text FROM jobs WHERE id=?",(j,)).fetchone()[0],"")
    def test_invalid_delete_does_not_modify_anything(self):
        self.assertEqual(self.h.apply({"deleted_business_messages":{"business_connection_id":CID,
            "chat":{"id":PASHA},"message_ids":["1"]}})["status"],"BLOCKED_REDACTION_BAD_INPUT")
    def test_pilot_send_requires_second_go(self):
        self.h.connect();self.h.allow()
        self.h.put(self.h.db,"agent4_biz_test_peer_sha256",digest(PASHA))
        j=self.h.inbound()["job_id"]
        self.h.db.execute("UPDATE jobs SET state='approved' WHERE id=?",(j,))
        with self.assertRaisesRegex(ValueError,"separate GO"):
            approved_send(self.h.db,j,f"SEND:{j}:{str(PASHA)[-4:]}",
                          self.h.get,None,None,now=NOW)
    def test_send_exact_and_business_connection_id(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        self.h.db.execute("UPDATE jobs SET state='approved' WHERE id=?",(j,))
        calls=[]
        def api(method,payload):
            calls.append((method,payload))
            return {"message_id":99,"text":payload["text"],"chat":{"id":PASHA}}
        def sender(db,job_id,allowed,send_fn):
            r=db.execute("SELECT peer,draft FROM jobs WHERE id=?",(job_id,)).fetchone()
            ack=send_fn("sendMessage",{"chat_id":int(r[0]),"text":r[1]})
            return {"status":"API_ACCEPTED","provider_message_id":ack["message_id"]}
        r=approved_send(self.h.db,j,f"SEND:{j}:{str(PASHA)[-4:]}",
                        self.h.get,api,sender,now=NOW+12)
        self.assertEqual(r["provider_message_id"],99)
        self.assertEqual(calls[0][1]["business_connection_id"],CID)
    def test_send_without_go(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        self.h.db.execute("UPDATE jobs SET state='approved' WHERE id=?",(j,))
        with self.assertRaisesRegex(ValueError,"GO"):
            approved_send(self.h.db,j,"NO",self.h.get,None,None,now=NOW)
    def test_send_after_expiry(self):
        self.h.connect();self.h.allow();j=self.h.inbound()["job_id"]
        self.h.db.execute("UPDATE jobs SET state='approved' WHERE id=?",(j,))
        with self.assertRaisesRegex(ValueError,"window closed"):
            approved_send(self.h.db,j,f"SEND:{j}:{str(PASHA)[-4:]}",
                          self.h.get,None,None,now=NOW+86402)
    def test_install_exact_anchors(self):
        old='''import net

def handle_update(db, update):
    m = update.get("message", {})

def approved_send(db, job_id, exact_go, api):
    if exact_go != "SEND:" + str(job_id) + ":" + row["peer"][-4:]:
        pass

def main():
    updates = api("getUpdates", {"offset": offset, "timeout": 10,
                                              "allowed_updates": ["message"], "limit": 60})
'''
        new=patch(old)
        self.assertIn(SIGNATURE,new)
        self.assertIn('"business_message"',new)
        self.assertEqual(patch(new),new)
    def test_patch_rejects_unsupported_code(self):
        with self.assertRaisesRegex(ValueError,"Refused"):
            patch("import net\n")
if __name__=="__main__":unittest.main()
