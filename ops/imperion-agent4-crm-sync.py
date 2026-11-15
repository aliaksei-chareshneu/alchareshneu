"""Owner-only bridge: existing local Agent4 -> owner-bound existing Google CRM.

No Telegram consumer, no new queue/CRM, no messages or public posting.
Only metadata for genuine /start-scoped inbound source IDs crosses to Google.
Remote writes are performed by the EXISTING bound Apps Script with owner OAuth.
Reconcile remote source independently before local CRM readback acknowledgement.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

APP_DIR = Path(os.environ.get('AGENT4_APP_DIR', Path(__file__).resolve().parent))
if str(APP_DIR) not in sys.path:
    sys.path.insert(0, str(APP_DIR))
import net
import agent4_crm_handoff as crm

KEY_PATTERN = re.compile(r'^IMP4-TG-[0-9a-f]{24}$')
CASE_PATTERN = re.compile(r'^(?:LEAD-AG4-[0-9a-f]{24}|DM-\d{3,6})$')
PROOF = re.compile(r'IMPAG4_(?:PING|VERIFY|IMPORT)_[A-Za-z0-9_:-]+')
OWNED_FOLDER = Path(os.environ.get('AGENT4_CLASP_DIR',
    Path(os.environ.get('LOCALAPPDATA', str(Path.home())))/'ImperionAgents'/'agent4-clasp-owner'))
MAX_BATCH = 8

class BridgeBlocked(RuntimeError):
    """No blind retry of an uncertain remote write."""


def status(db, value, error=''):
    with db:
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_bridge_status',?)", (value,))
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_bridge_heartbeat',?)", (str(int(time.time())),))
        db.execute("INSERT OR REPLACE INTO settings(key,value) VALUES('agent4_crm_bridge_last_error',?)", (error[:90],))


def source_scope(db, record):
    """Do NOT trust a CRM metadata record without rereading local Telegram scope."""
    key=record['source_key']; ctrl=record['legal_entity']; job=record['local_job_id']
    if not KEY_PATTERN.fullmatch(key) or ctrl not in ('OSVC','DRUZINA_MORAVY_ZS'):
        raise BridgeBlocked('BAD_SOURCE_OR_CONTROLLER')
    row=db.execute("SELECT source,peer,external_id,created FROM jobs WHERE id=?", (job,)).fetchone()
    if not row or row['source']!='telegram-agent4':
        raise BridgeBlocked('NOT_AUTHENTIC_TELEGRAM_SOURCE')
    peer=row['peer']
    setting=lambda k: db.execute("SELECT value FROM settings WHERE key=?",(k,)).fetchone()
    opt=setting('agent4_tg_optout:'+peer)
    stopped=setting('agent4_tg_stopped:'+peer)
    user_scope=setting('agent4_tg_controller:'+peer)
    if (opt and opt[0]=='1') or (stopped and stopped[0]=='1'):
        raise BridgeBlocked('RECIPIENT_OPTED_OUT')
    if not user_scope or user_scope[0]!=ctrl:
        raise BridgeBlocked('USER_CONTROLLER_SCOPE_NOT_VERIFIED')
    if db.execute("SELECT 1 FROM events WHERE job=? AND state='OWNER_SELFTEST_ONLY' LIMIT 1",(job,)).fetchone():
        raise BridgeBlocked('OWNER_SELFTEST_NOT_A_BUYER')
    if crm.receipt_key(row['source'],str(peer),str(row['external_id']),ctrl)!=key:
        raise BridgeBlocked('SOURCE_KEY_MISMATCH')
    return {'source_key':key,'source':'telegram-agent4','legal_entity':ctrl,'local_job_id':int(job),
      'inbound_at':record['inbound_at'],'stage':'INBOUND_UNQUALIFIED',
      'identity_match':'NOT_VERIFIED','crm_person_id':None,
      'provider_send_status':record['provider_send_status'],
      'privacy':'NO_MESSAGE_TEXT_NO_PHONE_NO_NAME','owner_selftest':False}


class ClaspOwner:
    def __init__(self, directory=OWNED_FOLDER, executable=None, invoke=None):
        self.directory=Path(directory)
        self.executable=executable or shutil.which('clasp.cmd') or shutil.which('clasp')
        self.invoke=invoke or subprocess.run
        if not self.executable or not (self.directory/'.clasp.json').is_file():
            raise BridgeBlocked('CLASP_OWNER_CONTEXT_MISSING')
    def run(self, function, params):
        if function not in ('impAgent4CrmPingToken','impAgent4CrmVerifyToken','impAgent4CrmImportToken'):
            raise BridgeBlocked('UNREVIEWED_FUNCTION')
        args=[self.executable,'run',function,'-p',json.dumps(params,ensure_ascii=True,separators=(',',':'))]
        try:
            out=self.invoke(args,cwd=str(self.directory),capture_output=True,text=True,
                            encoding='utf-8',errors='replace',timeout=70,check=False)
        except (OSError,subprocess.TimeoutExpired) as exc:
            raise BridgeBlocked('OWNER_SCRIPT_API_'+type(exc).__name__) from None
        if out.returncode!=0:
            raise BridgeBlocked('OWNER_SCRIPT_API_FAILED')
        matches=PROOF.findall(out.stdout)
        if not matches:
            raise BridgeBlocked('NO_MACHINE_VERIFIABLE_SCRIPT_RESPONSE')
        return matches[-1]
    def verify(self,key,controller):
        x=self.run('impAgent4CrmVerifyToken',[key,controller]); pre='IMPAG4_VERIFY_'
        if not x.startswith(pre):raise BridgeBlocked('VERIFY_RESPONSE_INVALID')
        if x==pre+'MISSING_'+key+'_NONE':return None
        prefix=pre+'FOUND_'+key+'_'
        if not x.startswith(prefix):raise BridgeBlocked('VERIFY_SOURCE_MISMATCH')
        case=x[len(prefix):]
        if not CASE_PATTERN.fullmatch(case):raise BridgeBlocked('VERIFY_CASE_ID_INVALID')
        return case
    def import_one(self, payload):
        x=self.run('impAgent4CrmImportToken',[payload]);key=payload['source_key']
        pat=re.compile(r'^IMPAG4_IMPORT_(?:CREATED_REMOTE_READBACK_VERIFIED|EXISTING_SOURCE_VERIFIED)_'+re.escape(key)+r'_(LEAD-AG4-[0-9a-f]{24}|DM-\d{3,6})$')
        m=pat.fullmatch(x)
        if not m:raise BridgeBlocked('IMPORT_RECEIPT_UNVERIFIED')
        return m.group(1)


def sync_once(db, owner=None):
    rows=crm.pending(db,MAX_BATCH)
    if not rows:
        status(db,'IDLE_NO_PENDING');return {'status':'IDLE_NO_PENDING','pending':0,'acked':0}
    try:
        owner=owner or ClaspOwner()
        proof=owner.run('impAgent4CrmPingToken',[])
        if proof!='IMPAG4_PING_ENABLED_READY_V1':
            raise BridgeBlocked('OWNER_CRM_IMPORT_NOT_READY')
    except BridgeBlocked as exc:
        status(db,'BLOCKED',str(exc));return {'status':'BLOCKED','reason':str(exc),'pending':len(rows),'acked':0}
    acked=0; held=0; failures=[]
    for rec in rows:
        try:
            payload=source_scope(db,rec)
            key=payload['source_key']; entity=payload['legal_entity']
            verified=owner.verify(key,entity) # readback FIRST, even after prior uncertain failure
            if verified is None:
                proposal=owner.import_one(payload)
                verified=owner.verify(key,entity) # independent readback after write
                if verified!=proposal:raise BridgeBlocked('REMOTE_ACK_READBACK_MISMATCH')
            if not CASE_PATTERN.fullmatch(verified):raise BridgeBlocked('BAD_REMOTE_CASE')
            reply=crm.acknowledge_after_remote_readback(db,rec['local_job_id'],verified,key)
            if reply not in ('ACKNOWLEDGED_AFTER_EXTERNAL_READBACK','ALREADY_ACKNOWLEDGED'):
                raise BridgeBlocked('LOCAL_ACK_NOT_VERIFIED')
            acked+=1
        except (BridgeBlocked,ValueError) as exc:
            held+=1;failures.append(type(exc).__name__+':'+str(exc)[:80])
            # No retry without a verified absence readback. No real sends at any time.
    result={'status':'SYNCED' if not held else 'PARTIAL_HELD',
            'pending':len(rows),'acked':acked,'held':held}
    status(db,result['status'],failures[0] if failures else '')
    return result


def main():
    db,_=net.connect()
    try:
        out=sync_once(db)
        # Only source counts and status, never peers or customer text.
        print(json.dumps(out,ensure_ascii=True),flush=True)
        return 0 if out['status'] in ('IDLE_NO_PENDING','SYNCED') else 2
    finally:db.close()

if __name__=='__main__':
    raise SystemExit(main())
