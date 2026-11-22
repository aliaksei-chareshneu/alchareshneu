// IMPERION Agent #5 cloud planner -> existing BrowserBridge queue, v1.
// The provider sees only a fixed, synthetic string; the queue may contain only
// allowlisted, read-only actions. No private screen, shell, secrets or chat.
const PROJECT_REF='cmrknyhnnehyjpreehcf';
const NEMOTRON='nvidia/nemotron-3-ultra-550b-a55b:free';
const INTENTS=Object.freeze({readiness:'machine_readiness',models:'model_capabilities'});
const PREFIX='IMP-PC5-CLOUD-';
const ALLOWED_KEYS=['kind','classification','case_id','intent'];
const DAILY_LIMIT=3;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateRequest(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     Object.keys(raw).length!==ALLOWED_KEYS.length||
     Object.keys(raw).some(key=>!ALLOWED_KEYS.includes(key))) throw Error('FIELDS_NOT_ALLOWED');
  if(raw.kind!=='pc5_synthetic_readonly'||raw.classification!=='SYNTHETIC')
    throw Error('CLASSIFICATION_OR_KIND_DENIED');
  if(typeof raw.case_id!=='string'||!/^A5-CLOUD-20[0-9]{6}-[0-9]{3}$/.test(raw.case_id))
    throw Error('CASE_ID_INVALID');
  if(typeof raw.intent!=='string'||!Object.hasOwn(INTENTS,raw.intent))
    throw Error('INTENT_NOT_ALLOWLISTED');
  return {caseId:raw.case_id,intent:raw.intent,expected:INTENTS[raw.intent],
          idempotencyKey:PREFIX+raw.case_id};
}

export function strictModelRoute(text,expected){
  if(typeof text!=='string'||text.length>160||text.length<12)return false;
  try {
    const parsed=JSON.parse(text);
    return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&
      Object.keys(parsed).length===1&&parsed.route===expected;
  }catch{return false;}
}

export function selectFreeProvider(env){
  // Personal prompts are never sent to trial providers. The :free suffix is
  // mandatory for OpenRouter, and verified key/plan flags are server-side.
  if(env.OPENROUTER_API_KEY && env.IMPERION_OPENROUTER_FREE_VERIFIED==='1' &&
     env.OPENROUTER_FREE_MODEL===NEMOTRON)
    return {name:'nemotron_550b_free',env:{...env,GROQ_API_KEY:''}};
  if(env.GROQ_API_KEY && env.IMPERION_GROQ_FREE_VERIFIED==='1')
    return {name:'groq_gpt_oss_120b_free',env:{...env,OPENROUTER_API_KEY:''}};
  return null;
}

function block(code){return {status:'BLOCKED',reason:code,queued:false,provider_calls:0};}
function approvedRoutePrompt(intent){
  // No user-controlled text ever enters this prompt.
  return `Synthetic QA only. An existing Windows agent is allowed two READ-ONLY tools: `+
    `machine_readiness (RAM), model_capabilities (installed model names). `+
    `The verified fixed task is ${intent==='readiness'?'readiness (RAM)':'models (names)'}. `+
    `Choose the one matching route. Return ONLY JSON `+
    `{"route":"${INTENTS[intent]}"}. No prose, files, shell, screen, or network commands.`;
}

function restrictedREST(base,key,transport){
  let url;
  try{url=new URL(base)}catch{throw Error('SUPABASE_URL_INVALID');}
  if(url.protocol!=='https:'||url.hostname!==PROJECT_REF+'.supabase.co'||
     url.username||url.password||url.search||url.hash||url.pathname!=='/')
    throw Error('SUPABASE_URL_UNEXPECTED');
  if(typeof key!=='string'||key.length<20)throw Error('SERVICE_AUTH_UNAVAILABLE');
  return async (resource,query,method='GET',body=undefined)=>{
    if(!['browser_jobs','browser_agents'].includes(resource)||
        !['GET','POST','PATCH'].includes(method))throw Error('REST_ACTION_DENIED');
    const endpoint=url.origin+'/rest/v1/'+resource+'?'+query;
    const res=await transport(endpoint,{method,redirect:'error',headers:{
      'apikey':key,'Authorization':'Bearer '+key,
      'content-type':'application/json',
      'Prefer':method==='GET'?'return=representation':'return=representation',
    },...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)});
    if(!res||!res.ok||res.redirected)throw Error('SUPABASE_REST_UNAVAILABLE');
    const data=await res.json();
    if(!Array.isArray(data)||data.length>10)throw Error('SUPABASE_RESPONSE_INVALID');
    return data;
  };
}

export async function runCloudPC(raw,env,options={}){
  let req;
  try{req=validateRequest(raw);}catch(e){return block(e.message||'INVALID_REQUEST');}
  const chosen=selectFreeProvider(env);
  if(!chosen)return block('NO_VERIFIED_ZERO_COST_PROVIDER');
  const clock=options.clock||(()=>new Date());
  const now=clock();
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))return block('CLOCK_INVALID');
  let rest;
  try{rest=restrictedREST(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,
                          options.transport||fetch);}catch(e){return block(e.message);}
  let agent;
  try {
    // Idempotency check must precede ANY model call, including failed calls.
    const previous=await rest('browser_jobs','select=id&limit=1&idempotency_key=eq.'+
      encodeURIComponent(req.idempotencyKey));
    if(previous.length)return block('CASE_ALREADY_USED_NO_RETRY');
    const midnight=new Date(now.getTime()-86400000).toISOString();
    const prior=await rest('browser_jobs','select=id&limit=4&created_at=gte.'+
      encodeURIComponent(midnight)+'&idempotency_key=like.'+
      encodeURIComponent(PREFIX+'%'));
    if(prior.length>=DAILY_LIMIT)return block('DAILY_PROVIDER_CALL_LIMIT');
    const agents=await rest('browser_agents',
      'select=id,last_seen_at,active&name=eq.zmrzlina&active=eq.true&limit=2');
    if(agents.length!==1||!UUID.test(agents[0].id||'')||
       !Number.isFinite(Date.parse(agents[0].last_seen_at))||
       Math.abs(now-Date.parse(agents[0].last_seen_at))>120000)
      return block('WINDOWS_AGENT_NOT_RECENTLY_ONLINE');
    agent=agents[0];
    const busy=await rest('browser_jobs','select=id&limit=1&state=in.(queued,claimed)');
    if(busy.length)return block('SHARED_QUEUE_BUSY');
  }catch{return block('QUEUE_PREFLIGHT_UNAVAILABLE');}
  // Durable one-time reservation in the EXISTING queue, not an additional CRM
  // or background worker. Cancelled jobs are never claimed by BrowserBridge.
  let reservation;
  try {
    const rows=await rest('browser_jobs','select=id,state,idempotency_key','POST',{
      action:'pc_operator',payload:{mode:req.expected},state:'cancelled',
      target_agent_id:agent.id,priority:100,max_attempts:1,
      deadline_at:new Date(now.getTime()+120000).toISOString(),
      cancelled_at:now.toISOString(),idempotency_key:req.idempotencyKey,
    });
    if(rows.length!==1||!UUID.test(rows[0].id||'')||rows[0].state!=='cancelled')
      return block('RESERVATION_NOT_VERIFIED');
    reservation=rows[0];
  }catch{return block('RESERVATION_FAILED_OR_DUPLICATE');}
  const model=options.infer;
  let draft;
  try {
    const fn=model||options.generateFreeDraft;
    if(typeof fn!=='function')return block('MODEL_FUNCTION_MISSING');
    draft=await fn({classification:'SYNTHETIC',task:'pc5_route',
                    prompt:approvedRoutePrompt(req.intent)},chosen.env);
  }catch{return block('CLOUD_PROVIDER_UNAVAILABLE');}
  if(!draft||draft.status!=='DRAFT_ONLY'||
     !strictModelRoute(draft.text,req.expected))
    return block('MODEL_DID_NOT_APPROVE_FIXED_READONLY_ROUTE');
  try{
    const changed=await rest('browser_jobs','select=id,state&state=eq.cancelled&id=eq.'+
      encodeURIComponent(reservation.id),'PATCH',
      {state:'queued',cancelled_at:null,deadline_at:new Date(clock().getTime()+120000).toISOString()});
    if(changed.length!==1||changed[0].id!==reservation.id||changed[0].state!=='queued')
      return block('QUEUE_ACTIVATION_NOT_VERIFIED');
  }catch{return block('QUEUE_ACTIVATION_FAILED');}
  return {status:'QUEUED_NOT_EXECUTED',queued:true,
          case_id:req.caseId,job_id:reservation.id,mode:req.expected,
          model:draft.model,provider:draft.provider,
          model_output_authority:false,requires_independent_queue_readback:true,
          user_data_sent:false,external_text:'FIXED_SYNTHETIC_ONLY',
          possible_cost:'ZERO_ONLY_IF_VERIFIED_PROVIDER_FLAGS_ACCURATE'};
}

/**
 * Headless closed-loop receipt reader for ONE pre-approved synthetic case.
 * It reads the EXISTING queue through the same server-only Supabase credential.
 * Never returns a raw worker result, file data, process title or external text.
 */
export function validateReceiptRequest(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
     Object.keys(raw).length!==3 ||
     Object.keys(raw).some(key=>!['kind','classification','case_id'].includes(key)) ||
     raw.kind!=='pc5_receipt'||raw.classification!=='SYNTHETIC' ||
     typeof raw.case_id!=='string'||!/^A5-CLOUD-20[0-9]{6}-[0-9]{3}$/.test(raw.case_id))
    throw Error('RECEIPT_REQUEST_NOT_ALLOWED');
  return PREFIX+raw.case_id;
}

export async function readCloudPCReceipt(raw,env,options={}){
  let key;
  try{key=validateReceiptRequest(raw);}catch{return block('RECEIPT_REQUEST_NOT_ALLOWED');}
  let rest;
  try{rest=restrictedREST(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,
                          options.transport||fetch);}catch{return block('RECEIPT_BACKEND_UNAVAILABLE');}
  let rows;
  try{
    rows=await rest('browser_jobs','select=id,idempotency_key,action,payload,state,attempts,result&limit=2&idempotency_key=eq.'+
      encodeURIComponent(key));
  }catch{return block('RECEIPT_READBACK_UNAVAILABLE');}
  if(rows.length!==1)return block(rows.length?'RECEIPT_DUPLICATE_DENIED':'CASE_NOT_FOUND');
  const job=rows[0],mode=job?.payload?.mode;
  if(job?.idempotency_key!==key || job?.action!=='pc_operator' ||
     !Object.values(INTENTS).includes(mode)||
     !UUID.test(job.id||'')||
     !Number.isInteger(job.attempts)||job.attempts<0||job.attempts>1)
    return block('RECEIPT_EVIDENCE_INVALID');
  if(job.state==='cancelled')return block('CASE_RESERVED_OR_CANCELLED_NO_RETRY');
  if(job.state==='queued'||job.state==='claimed')return {
    status:'PENDING',case_id:raw.case_id,job_id:job.id,mode,
    queued:true,verified:false,readback_only:true,provider_calls:0
  };
  if(job.state==='error')return block('WINDOWS_JOB_ERROR');
  if(job.state!=='done')return block('RECEIPT_STATE_INVALID');
  // The transport succeeded only if the nested application receipt also
  // reports DONE for the EXACT allowed mode, with exactly one attempt.
  const outer=job.result,inner=outer?.result;
  if(job.attempts!==1||outer?.agent!=='IMPERION_AGENT5_RESTRICTED'||
     outer?.requested!=='pc_operator'||
     inner?.status!=='DONE'||inner?.mode!==mode)
    return {
      status:'BLOCKED',reason:'NESTED_WINDOWS_ACTION_NOT_VERIFIED',
      case_id:raw.case_id,job_id:job.id,verified:false,readback_only:true,
      provider_calls:0,queued:false
    };
  return {
    status:'VERIFIED_DONE',case_id:raw.case_id,job_id:job.id,
    mode,attempts:1,nested_status:'DONE',readback_only:true,
    no_user_data_returned:true,model_did_not_authorize_privileges:true,
    provider_calls:0,verified:true
  };
}

export const PC5_MODEL_POLICY=Object.freeze({
  strongest_known_optional_paid:'gpt-6-astra',
  paid_api_allowed:false,
  strongest_free_text_candidate:NEMOTRON,
  newest_free_synthetic_vision_candidate:'nvidia/nemotron-3.5-super-vl:free',
  free_vision_on_private_windows_screen_allowed:false,
  local_qwen_role:'OPTIONAL_MEMORY_GATED_FALLBACK',
});
