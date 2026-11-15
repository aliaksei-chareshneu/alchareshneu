"""Zero network, zero user PII. Existing local queue and mocked owner-bound GAS."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/'ops'/'imperion-agent4-crm-sync.py'
mod_net=types.ModuleType('net')
mod_crm=types.ModuleType('agent4_crm_handoff')
mod_crm.pending=lambda db,limit:db.pending
mod_crm.receipt_key=lambda source,peer,msg,ctrl:'IMP4-TG-'+'a'*24
mod_crm.acknowledge_after_remote_readback=lambda db,job,case,key:db.ack(job,case,key)
with patch.dict(sys.modules,{'net':mod_net,'agent4_crm_handoff':mod_crm}):
 spec=importlib.util.spec_from_file_location('agent4_sync',APP);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

KEY='IMP4-TG-'+'a'*24
class FakeDb:
 def __init__(self):
  self.pending=[dict(source_key=KEY,local_job_id=7,legal_entity='OSVC',
                     inbound_at='2026-11-15 06:15:00',provider_send_status='NO_CONFIRMED_SEND')]
  self.settings={'agent4_tg_controller:123':'OSVC'}
  self.events=[];self.acked=[]
 def execute(self,sql,values=()):
  class R:
   def __init__(self,rows):self.rows=rows
   def fetchone(self):return self.rows[0] if self.rows else None
  if sql.startswith('SELECT source,peer'):
   return R([dict(source='telegram-agent4',peer='123',external_id='321',created='2026-11-15 06:15:00')])
  if sql.startswith('SELECT value FROM settings'):
   return R([(self.settings[values[0]],)] if values[0] in self.settings else [])
  if sql.startswith('SELECT 1 FROM events'):
   return R([(1,)] if self.events else [])
  if sql.startswith('INSERT OR REPLACE INTO settings'):
   key=sql.split("VALUES('")[1].split("'")[0];self.settings[key]=values[0];return R([])
  raise AssertionError(sql)
 def __enter__(self):return self
 def __exit__(self,*args):return False
 def ack(self,job,case,key):
  self.acked.append((job,case,key));return 'ACKNOWLEDGED_AFTER_EXTERNAL_READBACK'

class Owner:
 def __init__(self):self.keys=set();self.verify_calls=0;self.import_calls=0
 def run(self,fn,params):return 'IMPAG4_PING_ENABLED_READY_V1'
 def verify(self,key,ctrl):
  self.verify_calls+=1
  return ('LEAD-AG4-'+'a'*24) if key in self.keys else None
 def import_one(self,p):
  assert 'incoming' not in p and 'peer' not in p and 'email' not in p
  self.import_calls+=1;self.keys.add(p['source_key']);return 'LEAD-AG4-'+'a'*24

class BridgeTests(unittest.TestCase):
 def test_real_local_source_double_readback_and_ack(self):
  db=FakeDb();o=Owner();v=mod.sync_once(db,o)
  self.assertEqual(v['status'],'SYNCED');self.assertEqual(o.verify_calls,2)
  self.assertEqual(o.import_calls,1);self.assertEqual(db.acked[0][0],7)
 def test_second_run_idempotent(self):
  db=FakeDb();o=Owner();mod.sync_once(db,o);mod.sync_once(db,o)
  self.assertEqual(o.import_calls,1)
 def test_no_pending_means_no_network_or_fake_lead(self):
  db=FakeDb();db.pending=[];self.assertEqual(mod.sync_once(db)['status'],'IDLE_NO_PENDING')
 def test_owner_selftest_excluded_even_if_metadata_leaks(self):
  db=FakeDb();db.events=[1];o=Owner();v=mod.sync_once(db,o)
  self.assertEqual(v['status'],'PARTIAL_HELD');self.assertEqual(o.import_calls,0)
 def test_opt_out_prevents_remote_call(self):
  db=FakeDb();db.settings['agent4_tg_optout:123']='1';o=Owner();v=mod.sync_once(db,o)
  self.assertEqual(v['held'],1);self.assertEqual(o.verify_calls,0)
 def test_missing_user_scope_fails_closed(self):
  db=FakeDb();db.settings.pop('agent4_tg_controller:123');o=Owner();v=mod.sync_once(db,o)
  self.assertEqual(v['held'],1);self.assertEqual(o.import_calls,0)
 def test_ambiguous_remote_verification_cannot_ack(self):
  db=FakeDb();o=Owner();o.verify=lambda k,c:'OTHER-CASE';v=mod.sync_once(db,o)
  self.assertEqual(v['acked'],0)
 def test_unready_owner_flag_is_blocked(self):
  db=FakeDb();o=Owner();o.run=lambda fn,params:'IMPAG4_PING_DISABLED_READY_V1'
  v=mod.sync_once(db,o);self.assertEqual(v['status'],'BLOCKED');self.assertEqual(db.acked,[])
 def test_clasp_client_rejects_unknown_executable_or_context(self):
  with tempfile.TemporaryDirectory() as t:
   with self.assertRaises(mod.BridgeBlocked):mod.ClaspOwner(t,'clasp')
 def test_clasp_client_response_token_parsing_and_no_payload_exposure(self):
  with tempfile.TemporaryDirectory() as t:
   (Path(t)/'.clasp.json').write_text('{}')
   def client(args,**kw):
    self.assertIn('impAgent4CrmVerifyToken',args)
    return types.SimpleNamespace(returncode=0,stdout='Result: IMPAG4_VERIFY_MISSING_'+KEY+'_NONE',stderr='')
   c=mod.ClaspOwner(t,'clasp',client)
   self.assertIsNone(c.verify(KEY,'OSVC'))

if __name__=='__main__':unittest.main()
