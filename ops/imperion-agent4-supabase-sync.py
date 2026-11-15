"""Existing Windows Agent4 -> private Supabase transport -> existing GAS CRM.

Reuses existing Agent4 local SQLite events and Google CRM acknowledgement.
Never receives Telegram updates, sends messages, writes customer text to cloud,
generates invoices, contacts anyone or records bank money. No new CRM/queue.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import net
import agent4_crm_handoff as crm

HOST='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-agent4-transport'
KEY_PATTERN=re.compile(r'^IMP4-TG-[0-9a-f]{24}$')
CASE_OS=re.compile(r'^LEAD-AG4-[0-9a-f]{24}$')
CASE_NGO=re.compile(r'^DM-[0-9]{3,6}$')
LOCAL_ROOT=Path(os.environ.get('LOCALAPPDATA',str(Path.home()/'AppData'/'Local')))
TOKEN_PATH=Path(os.environ.get('AGENT4_TRANSPORT_TOKEN_FILE',
    str(LOCAL_ROOT/'ImperionAgents'/'private'/'agent4_transport_token.txt')))

class BridgeHeld(RuntimeError):pass

def token_from_private_file():
    try:
        t=TOKEN_PATH.read_text(encoding='ascii').strip()
    except OSError:
        raise BridgeHeld('PRIVATE_BEARER_TOKEN_MISSING') from None
    if not re.fullmatch(r'[a-f0-9]{64}',t):
        raise BridgeHeld('INVALID_PRIVATE_BEARER_TOKEN')
    return t

def transport(body=None,source_key=None,token=None):
    """No PII; bounded request to the SINGLE canonical Supabase endpoint."""
    t=token or token_from_private_file()
    if not re.fullmatch(r'[a-f0-9]{64}',t):raise BridgeHeld('BAD_BEARER_TOKEN')
    if source_key is not None:
        if not KEY_PATTERN.fullmatch(source_key):raise BridgeHeld('INVALID_SOURCE_KEY')
        if body is not None:raise BridgeHeld('INVALID_TRANSPORT_SHAPE')
        url=HOST+'?'+urllib.parse.urlencode({'source_key':source_key})
        data=None
    else:
        if not isinstance(body,dict) or body.get('action')!='submit':
            raise BridgeHeld('INVALID_TRANSPORT_ACTION')
        url=HOST
        data=json.dumps(body,ensure_ascii=True,separators=(',',':')).encode('utf-8')
        if len(data)>4096:raise BridgeHeld('TRANSPORT_BODY_OVER_LIMIT')
    req=urllib.request.Request(url,data=data,method='POST' if data else 'GET',
        headers={'Authorization':'Bearer '+t,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=25) as res:
            if res.status!=200:raise BridgeHeld('TRANSPORT_HTTP_STATUS_UNVERIFIED')
            raw=res.read(4097)
    except (urllib.error.URLError,TimeoutError,OSError) as e:
        raise BridgeHeld('TRANSPORT_NETWORK_'+type(e).__name__) from None
    if len(raw)>4096:raise BridgeHeld('TRANSPORT_RESPONSE_LIMIT')
    try:
        result=json.loads(raw)
        if not isinstance(result,dict) or result.get('ok') is not True:
            raise ValueError('bad')
    except (ValueError,UnicodeError):
        raise BridgeHeld('TRANSPORT_RESPONSE_NOT_VERIFIED') from None
    return result

def business_source_scope(db, peer, external_id, entity, read):
    """Additional verifiable permission checks for Chat Automation jobs.

    Reuse the existing CRM source identity and transport; no second CRM.
    Only post-verified, non-test, consented business-origin messages qualify.
    """
    match=re.fullmatch(r'biz:([0-9a-f]{32}):([1-9][0-9]*)',str(external_id))
    if not match:raise BridgeHeld('INVALID_BUSINESS_SOURCE_ID')
    prefix=match.group(1)
    raw=read('agent4_biz_connection:'+prefix)
    try:
        c=json.loads(raw[0]) if raw else None
    except (ValueError,TypeError):
        c=None
    if not isinstance(c,dict) or not isinstance(c.get('id'),str):
        raise BridgeHeld('BUSINESS_CONNECTION_NOT_VERIFIED')
    if hashlib.sha256(c['id'].encode('utf-8')).hexdigest()[:32]!=prefix:
        raise BridgeHeld('BUSINESS_CONNECTION_SHA_MISMATCH')
    if c.get('enabled') is not True or c.get('can_reply') is not True:
        raise BridgeHeld('BUSINESS_CONNECTION_NOT_ENABLED')
    owner=read('agent4_owner_test_peer_sha256')
    if not (owner and isinstance(c.get('owner_id'),int)
            and hashlib.sha256(str(c['owner_id']).encode()).hexdigest()==owner[0]):
        raise BridgeHeld('BUSINESS_OWNER_NOT_VERIFIED')
    key=prefix+':'+str(peer)
    scope=read('agent4_biz_controller:'+key)
    consent=read('agent4_biz_consent:'+key)
    opted=read('agent4_biz_optout:'+key)
    if not scope or scope[0]!=entity:
        raise BridgeHeld('BUSINESS_SCOPE_NOT_VERIFIED')
    if not consent or consent[0]!='AFFIRMATIVE':
        raise BridgeHeld('BUSINESS_COUNTERPARTY_CONSENT_MISSING')
    if opted and opted[0]=='1':
        raise BridgeHeld('BUSINESS_CHAT_OPTED_OUT')
    return entity

def private_source(db,entry):
    """Existing owner-specific scope and opt-out are always revalidated."""
    source_key=entry['source_key']; entity=entry['legal_entity']; job_id=entry['local_job_id']
    if not isinstance(source_key,str) or not KEY_PATTERN.fullmatch(source_key) or (
        entity not in ('OSVC','DRUZINA_MORAVY_ZS')):
        raise BridgeHeld('UNKNOWN_SOURCE_CONTROLLER')
    job=db.execute("SELECT source,peer,external_id FROM jobs WHERE id=?",(job_id,)).fetchone()
    if not job or job['source']!='telegram-agent4':raise BridgeHeld('NOT_PROVIDER_TELEGRAM')
    peer=job['peer']
    read=lambda key:db.execute("SELECT value FROM settings WHERE key=?",(key,)).fetchone()
    if str(job['external_id']).startswith('biz:'):
        business_source_scope(db,peer,job['external_id'],entity,read)
    else:
        scope=read('agent4_tg_controller:'+peer)
        stopped=read('agent4_tg_stopped:'+peer)
        opted=read('agent4_tg_optout:'+peer)
        if not scope or scope[0]!=entity:raise BridgeHeld('EXPLICIT_SCOPE_NOT_VERIFIED')
        if (stopped and stopped[0]=='1') or (opted and opted[0]=='1'):
            raise BridgeHeld('OPT_OUT_SUPPRESSES_SOURCE')
    if db.execute("SELECT 1 FROM events WHERE job=? AND state='OWNER_SELFTEST_ONLY'",(job_id,)).fetchone():
        raise BridgeHeld('OWNER_TEST_NOT_BUYER')
    expected=crm.receipt_key(job['source'],str(peer),str(job['external_id']),entity)
    if expected!=source_key:raise BridgeHeld('SOURCE_DIGEST_MISMATCH')
    return {'source_key':source_key,'source':'telegram-agent4','legal_entity':entity,
      'local_job_id':job_id,'inbound_at':entry['inbound_at'],
      'stage':'INBOUND_UNQUALIFIED','identity_match':'NOT_VERIFIED',
      'crm_person_id':None,'provider_send_status':entry['provider_send_status'],
      'privacy':'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME','owner_selftest':False}

def case_ok(source,entity,case):
    if not isinstance(case,str):return False
    if entity=='OSVC':
        return bool(CASE_OS.fullmatch(case)) and (
            case.removeprefix('LEAD-AG4-')==source.removeprefix('IMP4-TG-'))
    return entity=='DRUZINA_MORAVY_ZS' and bool(CASE_NGO.fullmatch(case))

def reconcile_once(db,token=None):
    pending=crm.pending(db,limit=8)
    if not pending:
        with db:
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_transport_status',?)",
                       ('IDLE_NO_PENDING',))
            db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_transport_heartbeat',?)",
                       (str(int(time.time())),))
        return {'status':'IDLE_NO_PENDING','pending':0,'staged':0,'acked':0,'held':0}
    token=token or token_from_private_file()
    staged=0; acked=0; held=0
    for entry in pending:
        try:
            row=private_source(db,entry)
            remote=transport(source_key=row['source_key'],token=token)
            if remote.get('source_key')!=row['source_key']:
                raise BridgeHeld('REMOTE_SOURCE_MISMATCH')
            if remote.get('status')=='MISSING':
                out=transport(body={'action':'submit','data':row},token=token)
                if out.get('source_key')!=row['source_key'] or out.get('status') not in (
                    'STAGED','ALREADY_STAGED','SYNCED'):
                    raise BridgeHeld('STAGE_PROVIDER_READBACK_MISSING')
                # Never assert staged on mere POST acceptance; independently read GET.
                remote=transport(source_key=row['source_key'],token=token)
            if remote.get('status') not in ('STAGED','SYNCED'):
                raise BridgeHeld('REMOTE_STATE_UNEXPECTED')
            if remote.get('source_key')!=row['source_key'] or (
                    remote.get('legal_entity')!=row['legal_entity']):
                raise BridgeHeld('REMOTE_CONTROLLER_CONFLICT')
            if remote['status']=='STAGED':
                staged+=1
                continue
            case=remote.get('case_id')
            if not case_ok(row['source_key'],row['legal_entity'],case):
                raise BridgeHeld('GOOGLE_CRM_CASE_RECEIPT_MISMATCH')
            local=crm.acknowledge_after_remote_readback(db,entry['local_job_id'],
                case,row['source_key'])
            if local not in ('ACKNOWLEDGED_AFTER_EXTERNAL_READBACK','ALREADY_ACKNOWLEDGED'):
                raise BridgeHeld('LOCAL_CRM_RECEIPT_UNVERIFIED')
            acked+=1
        except (BridgeHeld,KeyError,TypeError,ValueError):
            held+=1
            # No customer data, tokens or query strings logged.
            # Uncertain remote state will be GET-read before future retry.
    st='STAGED_WAIT_GAS' if staged and not held else (
      'PARTIAL_HELD' if held else 'SYNCED' if acked else 'IDLE_NO_PENDING')
    with db:
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_transport_status',?)",(st,))
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_transport_heartbeat',?)",(str(int(time.time())),))
    return {'status':st,'pending':len(pending),'staged':staged,'acked':acked,'held':held}

def main():
    db,_=net.connect()
    try:
        result=reconcile_once(db)
        print(json.dumps(result,ensure_ascii=True),flush=True)
        return 2 if result['held'] else 0
    except BridgeHeld as exc:
        print(json.dumps({'status':'BLOCKED','reason':str(exc),'external_sends':0}),flush=True)
        return 2
    finally:db.close()

if __name__=='__main__':raise SystemExit(main())
