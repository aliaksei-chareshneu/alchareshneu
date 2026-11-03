import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
import {QUERY_GROUPS,tedRequest,parseTedResponse,pragueSlot} from './core.mjs';

/**
 * Read-only external TED search -> private Supabase candidate staging.
 * CRON only, owner review required. No Gmail, CRM direct write, payment, or outbound messaging.
 * verify_jwt=false is intentional: the function authenticates a dedicated Vault-backed
 * 64-hex token by service-role-only RPC before performing any search or persistence.
 */
const S_URL=Deno.env.get('SUPABASE_URL')||'';
const S_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
function reply(value,status=200){return new Response(JSON.stringify(value),{status,headers:HEADERS});}
async function searchTed(group){
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),17000);
  try{
    const response=await fetch('https://api.ted.europa.eu/v3/notices/search',{
      method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(tedRequest(group.cpv)),signal:abort.signal,redirect:'error'});
    if(!response.ok||response.redirected)throw Error('TED_HTTP_'+response.status);
    const raw=await response.text();
    if(raw.length>1800000)throw Error('TED_OVERSIZE');
    return parseTedResponse(JSON.parse(raw),group.id);
  }finally{clearTimeout(timeout);}
}
Deno.serve(async (req)=>{
  if(req.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  if(!S_URL||!S_KEY)return reply({ok:false,error:'backend_unavailable'},503);
  const token=req.headers.get('x-deal-hunter-token')||'';
  if(!/^[a-f0-9]{64}$/i.test(token))return reply({ok:false,error:'unauthorized'},401);
  const api=createClient(S_URL,S_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await api.rpc('imperion_deal_hunter_verify_token',{p_token:token});
  if(auth.error||auth.data!==true)return reply({ok:false,error:'forbidden'},403);
  const request=await req.json().catch(()=>({}));
  if(request && Object.keys(request).some(k=>!['mode'].includes(k)))return reply({ok:false,error:'unknown_request_fields'},400);
  const mode=request?.mode==='manual'?'manual':request?.mode===undefined?'cron':null;
  if(!mode)return reply({ok:false,error:'invalid_mode'},400);
  const now=new Date();
  const slot=pragueSlot(now);
  if(mode==='cron'&&!slot.allowed)return reply({ok:true,status:'SKIPPED_OUTSIDE_PRAGUE_SLOTS',slot:slot.id,external_messages:0,charges:0});
  const runSlot=mode==='manual'?'MANUAL:'+now.toISOString()+':'+crypto.randomUUID():slot.id;
  const started=await api.from('imperion_deal_hunter_runs').insert({run_slot:runSlot,source:'TED_OFFICIAL',status:'RUNNING',mode}).select('id').single();
  if(started.error){
    if(started.error.code==='23505')return reply({ok:true,status:'ALREADY_RAN',slot:runSlot,external_messages:0,charges:0});
    return reply({ok:false,error:'run_receipt_unavailable'},503);
  }
  const runId=started.data.id;
  const fetched=await Promise.allSettled(QUERY_GROUPS.map(x=>searchTed(x)));
  const errors=[];const all=new Map();let received=0,sourcesOk=0;
  fetched.forEach((result,i)=>{
    if(result.status==='rejected'){
      const code=String(result.reason?.message||'SOURCE_UNAVAILABLE');
      errors.push(QUERY_GROUPS[i].id+':'+(/TED_HTTP_\d{3}/.test(code)?code:'SOURCE_UNAVAILABLE'));
      return;
    }
    sourcesOk++;received+=result.value.received;
    for(const item of result.value.items){
      const prev=all.get(item.source_key);
      if(!prev || prev.fit_score<item.fit_score)all.set(item.source_key,item);
    }
  });
  const items=[...all.values()].sort((a,b)=>b.fit_score-a.fit_score).slice(0,60);
  let inserted=0,persisted=0;
  let status=sourcesOk===0?'SOURCE_FAILED':errors.length?'SOURCE_PARTIAL':'SOURCE_OK';
  try{
    if(sourcesOk&&items.length){
      const keys=items.map(x=>x.source_key);
      const existing=await api.from('imperion_deal_hunter_candidates').select('source_key').in('source_key',keys);
      if(existing.error)throw Error('CANDIDATE_READ_FAILED');
      const known=new Set((existing.data||[]).map(x=>x.source_key));
      const fresh=items.filter(x=>!known.has(x.source_key));
      if(fresh.length){
        const result=await api.from('imperion_deal_hunter_candidates').insert(fresh).select('source_key');
        if(result.error)throw Error('CANDIDATE_INSERT_FAILED');
        inserted=result.data?.length||0;
        if(inserted!==fresh.length)throw Error('CANDIDATE_INSERT_READBACK_MISMATCH');
      }
      const verified=await api.from('imperion_deal_hunter_candidates').select('source_key').in('source_key',keys);
      if(verified.error || (verified.data||[]).length!==items.length)throw Error('PERSISTED_READBACK_FAILED');
      persisted=verified.data.length;
    }
  }catch(e){status='PERSISTENCE_FAILED';errors.push(String(e.message||'DB_FAILED').slice(0,60));}
  const report=items.slice(0,8).map(x=>({source_key:x.source_key,title:x.title,buyer:x.buyer,url:x.source_url,fit_score:x.fit_score,economics:'REVIEW_UNCOSTED'}));
  const finished=await api.from('imperion_deal_hunter_runs').update({finished_at:new Date().toISOString(),status,received,screened:items.length,inserted,persisted,source_successes:sourcesOk,source_errors:errors,report}).eq('id',runId).select('id,status,received,screened,inserted,persisted').single();
  if(finished.error)return reply({ok:false,error:'run_receipt_writeback_failed',run_id:runId},503);
  return reply({ok:status==='SOURCE_OK',run_id:runId,status:finished.data.status,received:finished.data.received,
    screened:finished.data.screened,inserted:finished.data.inserted,persisted:finished.data.persisted,
    sources_ok:sourcesOk,errors,owner_report:report,crm_sync:'NOT_IMPLEMENTED',
    external_messages:0,submissions:0,charges:0,owner_approval_required:true},status==='SOURCE_OK'?200:207);
});
