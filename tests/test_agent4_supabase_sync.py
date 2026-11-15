"""Offline tests for private Agent4 transport; no external network or personal data."""
import importlib.util
import json
import hashlib
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

FILE=Path(__file__).resolve().parents[1]/'ops'/'imperion-agent4-supabase-sync.py'
net=types.ModuleType('net')
crm=types.ModuleType('agent4_crm_handoff')
KEY='IMP4-TG-'+'a'*24
CASE='LEAD-AG4-'+'a'*24
crm.pending=lambda db,limit:db.pending
crm.receipt_key=lambda source,peer,external,entity:KEY
crm.acknowledge_after_remote_readback=lambda db,job,case,key:db.ack(job,case,key)
with patch.dict(sys.modules,{'net':net,'agent4_crm_handoff':crm}):
 spec=importlib.util.spec_from_file_location('ag4transport',FILE);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Result:
 def __init__(self,v):self.v=v
 def fetchone(self):return self.v
class DB:
 def __init__(self):
  self.settings={'agent4_tg_controller:123':'OSVC'}
  self.pending=[dict(source_key=KEY,local_job_id=7,legal_entity='OSVC',
     inbound_at='2026-11-15 07:30:00',provider_send_status='NO_CONFIRMED_SEND')]
  self.source_external_id='321'
  self.owner_selftest=False;self.acknowledged=[]
 def execute(self,sql,args=()):
  if sql.startswith('SELECT source,peer'):
   return Result(dict(source='telegram-agent4',peer='123',external_id=self.source_external_id))
  if sql.startswith('SELECT value FROM settings'):
   value=self.settings.get(args[0]);return Result((value,) if value is not None else None)
  if sql.startswith('SELECT 1 FROM events'):
   return Result((1,) if self.owner_selftest else None)
  if sql.startswith('INSERT OR REPLACE INTO settings'):
   name=sql.split("VALUES('")[1].split("'")[0];self.settings[name]=args[0]
   return Result(None)
  raise AssertionError(sql)
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def ack(self,j,c,k):
  self.acknowledged.append((j,c,k));return 'ACKNOWLEDGED_AFTER_EXTERNAL_READBACK'

def prepare_business(db):
 cid='conn_Pasha_local_only_123'
 prefix=hashlib.sha256(cid.encode()).hexdigest()[:32]
 db.source_external_id='biz:'+prefix+':321'
 db.settings={'agent4_biz_connection:'+prefix:json.dumps({
   'id':cid,'owner_id':86001,'enabled':True,'can_reply':True}),
   'agent4_owner_test_peer_sha256':hashlib.sha256(b'86001').hexdigest(),
   'agent4_biz_controller:'+prefix+':123':'OSVC',
   'agent4_biz_consent:'+prefix+':123':'AFFIRMATIVE',
   'agent4_biz_optout:'+prefix+':123':'0'}
 return prefix

class TestTransport(unittest.TestCase):
 def test_business_source_requires_owner_and_specific_chat_consent(self):
  db=DB();prepare_business(db)
  row=m.private_source(db,db.pending[0])
  self.assertEqual(row['source_key'],KEY)
  self.assertEqual(row['privacy'],'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME')
  self.assertNotIn('peer',row)
 def test_business_missing_consent_is_held_before_network(self):
  db=DB();prefix=prepare_business(db)
  db.settings.pop('agent4_biz_consent:'+prefix+':123')
  with patch.object(m,'transport') as api:
   r=m.reconcile_once(db,token='b'*64)
   self.assertEqual(r['held'],1);api.assert_not_called()
 def test_business_wrong_owner_hash_is_rejected(self):
  db=DB();prepare_business(db)
  db.settings['agent4_owner_test_peer_sha256']='f'*64
  with self.assertRaisesRegex(m.BridgeHeld,'BUSINESS_OWNER_NOT_VERIFIED'):
   m.private_source(db,db.pending[0])
 def test_business_chat_optout_is_rejected(self):
  db=DB();prefix=prepare_business(db)
  db.settings['agent4_biz_optout:'+prefix+':123']='1'
  with self.assertRaisesRegex(m.BridgeHeld,'BUSINESS_CHAT_OPTED_OUT'):
   m.private_source(db,db.pending[0])
 def test_business_disabled_connection_is_rejected(self):
  db=DB();prefix=prepare_business(db)
  db.settings['agent4_biz_connection:'+prefix]=db.settings['agent4_biz_connection:'+prefix].replace('"enabled": true','"enabled": false')
  with self.assertRaisesRegex(m.BridgeHeld,'BUSINESS_CONNECTION_NOT_ENABLED'):
   m.private_source(db,db.pending[0])
 def test_business_owner_selftest_cannot_become_buyer(self):
  db=DB();prepare_business(db);db.owner_selftest=True
  with patch.object(m,'transport') as api:
   r=m.reconcile_once(db,token='b'*64)
   self.assertEqual(r['held'],1);api.assert_not_called()
 def test_no_pending_is_idle_and_never_opens_network(self):
  db=DB();db.pending=[]
  with patch.object(m,'transport') as api:
   self.assertEqual(m.reconcile_once(db)['status'],'IDLE_NO_PENDING')
   api.assert_not_called()
   self.assertEqual(db.settings['agent4_crm_transport_status'],'IDLE_NO_PENDING')
   self.assertTrue(int(db.settings['agent4_crm_transport_heartbeat'])>0)
 def test_private_source_never_contains_personal_data(self):
  db=DB();p=m.private_source(db,db.pending[0])
  self.assertEqual(p['privacy'],'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME')
  for k in ['peer','incoming','full_name','phone','email','message']:
   self.assertNotIn(k,p)
 def test_customer_optout_blocks_before_provider_request(self):
  db=DB();db.settings['agent4_tg_optout:123']='1'
  with patch.object(m,'transport') as api:
   r=m.reconcile_once(db,token='b'*64)
   self.assertEqual(r['held'],1);api.assert_not_called()
 def test_owner_selftest_cannot_become_a_CRM_record(self):
  db=DB();db.owner_selftest=True
  with patch.object(m,'transport') as api:
   r=m.reconcile_once(db,token='b'*64)
   self.assertEqual(r['held'],1);api.assert_not_called()
 def test_cross_controller_is_held(self):
  db=DB();db.pending[0]['legal_entity']='DRUZINA_MORAVY_ZS'
  with patch.object(m,'transport') as api:
   r=m.reconcile_once(db,token='b'*64)
   self.assertEqual(r['held'],1);api.assert_not_called()
 def test_missing_source_stages_and_independently_reads_before_ack(self):
  db=DB()
  calls=[]
  def provider(*,source_key=None,body=None,token=None):
   calls.append('get' if source_key else 'post')
   if len(calls)==1:return {'ok':True,'source_key':KEY,'status':'MISSING'}
   if len(calls)==2:
    self.assertEqual(body['data']['source_key'],KEY)
    self.assertNotIn('incoming',body['data'])
    return {'ok':True,'source_key':KEY,'status':'STAGED'}
   return {'ok':True,'source_key':KEY,'status':'STAGED','legal_entity':'OSVC'}
  with patch.object(m,'transport',side_effect=provider):
   r=m.reconcile_once(db,token='b'*64)
  self.assertEqual(calls,['get','post','get'])
  self.assertEqual(r['status'],'STAGED_WAIT_GAS')
  self.assertEqual(db.acknowledged,[])
 def test_verified_google_case_is_the_only_way_to_local_crm_ack(self):
  db=DB()
  with patch.object(m,'transport',return_value={'ok':True,'source_key':KEY,
     'status':'SYNCED','legal_entity':'OSVC','case_id':CASE}):
   r=m.reconcile_once(db,token='b'*64)
  self.assertEqual(r['acked'],1)
  self.assertEqual(db.acknowledged,[(7,CASE,KEY)])
 def test_wrong_google_case_is_never_accepted(self):
  db=DB()
  with patch.object(m,'transport',return_value={'ok':True,'source_key':KEY,
    'status':'SYNCED','legal_entity':'OSVC','case_id':'LEAD-AG4-'+'f'*24}):
   r=m.reconcile_once(db,token='b'*64)
  self.assertEqual(r['held'],1);self.assertEqual(db.acknowledged,[])
 def test_wrong_remote_controller_cannot_link_source(self):
  db=DB()
  with patch.object(m,'transport',return_value={'ok':True,'source_key':KEY,
    'status':'SYNCED','legal_entity':'DRUZINA_MORAVY_ZS','case_id':'DM-123'}):
   r=m.reconcile_once(db,token='b'*64)
  self.assertEqual(r['held'],1);self.assertEqual(db.acknowledged,[])
 def test_missing_token_rejected_without_url_printing(self):
  with patch.object(m,'TOKEN_PATH',Path('/nonexistent/imperion-agent4-transport-token-qa')):
   with self.assertRaisesRegex(m.BridgeHeld,'PRIVATE_BEARER_TOKEN_MISSING'):
    m.token_from_private_file()
 def test_raw_bearer_never_in_public_exception(self):
  with patch('urllib.request.urlopen',side_effect=HTTPError('https://bad',401,'Unauthorized',None,None)):
   with self.assertRaisesRegex(m.BridgeHeld,'TRANSPORT_NETWORK_HTTPError') as c:
    m.transport(source_key=KEY,token='b'*64)
  self.assertNotIn('b'*64,str(c.exception))
 def test_case_binding(self):
  self.assertTrue(m.case_ok(KEY,'OSVC',CASE))
  self.assertFalse(m.case_ok(KEY,'OSVC','LEAD-AG4-'+'c'*24))
  self.assertTrue(m.case_ok(KEY,'DRUZINA_MORAVY_ZS','DM-200'))
if __name__=='__main__':unittest.main()
