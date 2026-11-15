import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRequest,strictModelRoute,selectFreeProvider,runCloudPC,readCloudPCReceipt,validateReceiptRequest,PC5_MODEL_POLICY} from './pc5-cloud-core.mjs';

const A='a4b51234-1234-4123-8123-123456789abc',J='b4b51234-1234-4123-8123-123456789abc';
const now=new Date('2026-11-15T17:00:00Z');
const request={kind:'pc5_synthetic_readonly',classification:'SYNTHETIC',case_id:'A5-CLOUD-20261115-001',intent:'readiness'};
const env={GROQ_API_KEY:'TEST-NOT-REAL',IMPERION_GROQ_FREE_VERIFIED:'1',
  SUPABASE_SERVICE_ROLE_KEY:'DUMMY-SECURE-TEST-KEY-NOT-REAL',
  SUPABASE_URL:'https://cmrknyhnnehyjpreehcf.supabase.co/'};
function mock({existing=false,busy=false,offline=false,rate=0,activate=true}={}){
  const calls=[],st={calls,modelCalls:0};
  const transport=async(url,options)=>{
    const u=new URL(url),resource=u.pathname.split('/').pop();
    calls.push({resource,method:options.method,body:options.body&&JSON.parse(options.body)});
    let data=[];
    if(resource==='browser_agents')data=[{id:A,active:true,last_seen_at:
      new Date(now.getTime()-(offline?360000:5000)).toISOString()}];
    else if(options.method==='POST')data=[{id:J,state:'cancelled'}];
    else if(options.method==='PATCH')data=activate?[{id:J,state:'queued'}]:[];
    else if(u.searchParams.get('idempotency_key')?.startsWith('eq.'))data=existing?[{id:J}]:[];
    else if(u.searchParams.get('idempotency_key')?.startsWith('like.'))data=Array.from({length:rate},(_,i)=>({id:String(i)}));
    else if(u.searchParams.get('state')==='in.(queued,claimed)')data=busy?[{id:J}]:[];
    return {ok:true,redirected:false,json:async()=>data};
  };
  const infer=async(input)=>{st.modelCalls++;assert.equal(input.task,'pc5_route');
    assert.equal(input.classification,'SYNTHETIC');
    return {status:'DRAFT_ONLY',model:'openai/gpt-oss-120b',provider:'groq_free',
      text:'{"route":"machine_readiness"}'};};
  return {transport,infer,state:st,clock:()=>now};
}
test('no private payload, shell, path, forged GO, or arbitrary mode',()=>{
  for(const field of ['prompt','path','go','command','screenshot','authorization'])
    assert.throws(()=>validateRequest({...request,[field]:'private'}),/FIELDS_NOT_ALLOWED/);
  assert.throws(()=>validateRequest({...request,classification:'PRIVATE'}),/DENIED/);
  assert.throws(()=>validateRequest({...request,intent:'shell'}),/NOT_ALLOWLISTED/);
});
test('free provider selection prefers verified Nemotron, never paid OpenRouter',()=>{
  const n=selectFreeProvider({...env,OPENROUTER_API_KEY:'FAKE',
    IMPERION_OPENROUTER_FREE_VERIFIED:'1',
    OPENROUTER_FREE_MODEL:'nvidia/nemotron-3-ultra-550b-a55b:free'});
  assert.equal(n.name,'nemotron_550b_free');assert.equal(n.env.GROQ_API_KEY,'');
  assert.equal(selectFreeProvider({...env,OPENROUTER_API_KEY:'FAKE',
    IMPERION_OPENROUTER_FREE_VERIFIED:'1',OPENROUTER_FREE_MODEL:'paid/model'}).name,
    'groq_gpt_oss_120b_free');
  assert.equal(selectFreeProvider({...env,GROQ_API_KEY:''}),null);
});
test('only exact, single-field JSON route is accepted',()=>{
  assert.equal(strictModelRoute('{"route":"machine_readiness"}','machine_readiness'),true);
  for(const x of ['{"route":"shell"}','{"route":"machine_readiness","go":true}',
    '```json\n{"route":"machine_readiness"}\n```',
    '{"route":"model_capabilities"}','{"route":"machine_readiness"} more'])
    assert.equal(strictModelRoute(x,'machine_readiness'),false);
});
test('model -> one-use cancelled reservation -> allowlisted queue activation',async()=>{
  const x=mock(),r=await runCloudPC(request,env,x);
  assert.equal(r.status,'QUEUED_NOT_EXECUTED');assert.equal(r.mode,'machine_readiness');
  assert.equal(r.user_data_sent,false);assert.equal(r.model_output_authority,false);
  const writes=x.state.calls.filter(c=>c.method!=='GET');
  assert.deepEqual(writes.map(x=>x.method),['POST','PATCH']);
  assert.deepEqual(writes[0].body.payload,{mode:'machine_readiness'});
  assert.equal(writes[0].body.state,'cancelled');
  assert.equal(writes[0].body.max_attempts,1);
  assert.equal(writes[1].body.state,'queued');assert.equal(x.state.modelCalls,1);
});
test('duplicate, daily quota, busy worker, offline worker never call model',async()=>{
  for(const args of [{existing:true},{rate:3},{busy:true},{offline:true}]){
    const x=mock(args),r=await runCloudPC(request,env,x);
    assert.equal(r.status,'BLOCKED');assert.equal(x.state.modelCalls,0);
    assert.equal(x.state.calls.filter(c=>c.method!=='GET').length,0);
  }
});
test('untrusted model output and failed activation never claim PC execution',async()=>{
  const x=mock(),bad=await runCloudPC(request,env,{...x,infer:async()=>({
    status:'DRAFT_ONLY',text:'{"route":"shell"}'})});
  assert.equal(bad.status,'BLOCKED');assert.equal(x.state.calls.filter(c=>c.method==='PATCH').length,0);
  const y=mock({activate:false}),r=await runCloudPC(request,env,y);
  assert.equal(r.reason,'QUEUE_ACTIVATION_NOT_VERIFIED');
});
test('no verified provider or expected Supabase host -> fail before I/O',async()=>{
  const x=mock();
  assert.equal((await runCloudPC(request,{...env,GROQ_API_KEY:''},x)).reason,
    'NO_VERIFIED_ZERO_COST_PROVIDER');
  assert.equal((await runCloudPC(request,{...env,SUPABASE_URL:'https://malicious.invalid/'},x)).reason,
    'SUPABASE_URL_UNEXPECTED');
  assert.equal(x.state.calls.length,0);
});

const receiptReq={kind:'pc5_receipt',classification:'SYNTHETIC',case_id:'A5-CLOUD-20261115-001'};
const receiptJob=()=>({
  id:J,idempotency_key:'IMP-PC5-CLOUD-A5-CLOUD-20261115-001',
  action:'pc_operator',payload:{mode:'machine_readiness'},
  state:'done',attempts:1,
  result:{agent:'IMPERION_AGENT5_RESTRICTED',requested:'pc_operator',
          result:{status:'DONE',mode:'machine_readiness',free_ram_mb:420}}
});
const receiptTransport=(rows)=>async (_url,o)=>{
  assert.equal(o.method,'GET');
  assert.match(_url,/idempotency_key=eq\./);
  return {ok:true,redirected:false,json:async()=>rows};
};
test('receipt readback verifies nested DONE but returns no raw Windows data',async()=>{
  const r=await readCloudPCReceipt(receiptReq,env,{transport:receiptTransport([receiptJob()])});
  assert.equal(r.status,'VERIFIED_DONE');
  assert.equal(r.job_id,J);assert.equal(r.attempts,1);assert.equal(r.verified,true);
  assert.equal(r.no_user_data_returned,true);
  assert.equal(JSON.stringify(r).includes('420'),false);
});
test('queue done with nested app BLOCKED never counts as success',async()=>{
  const item=receiptJob();item.result.result.status='BLOCKED';
  item.result.result.reason='MODE_NOT_ALLOWED';
  const r=await readCloudPCReceipt(receiptReq,env,{transport:receiptTransport([item])});
  assert.equal(r.reason,'NESTED_WINDOWS_ACTION_NOT_VERIFIED');
  assert.equal(r.verified,false);
});
test('mismatched nested mode, queue attempt count and wrong agent are denied',async()=>{
  const cases=[
    Object.assign(receiptJob(),{attempts:2}),
    {...receiptJob(),result:{...receiptJob().result,agent:'OTHER_WORKER'}},
    {...receiptJob(),result:{...receiptJob().result,result:{status:'DONE',mode:'shell'}}},
    {...receiptJob(),payload:{mode:'shell'}},
  ];
  for(const row of cases){
    const r=await readCloudPCReceipt(receiptReq,env,{transport:receiptTransport([row])});
    assert.equal(r.status,'BLOCKED');
  }
});
test('reserved/queued/error jobs are never considered completed',async()=>{
  for(const state of ['cancelled','queued','claimed','error']){
    const item=receiptJob();item.state=state;
    const r=await readCloudPCReceipt(receiptReq,env,{transport:receiptTransport([item])});
    assert.notEqual(r.status,'VERIFIED_DONE');
    assert.equal(r.verified??false,false);
  }
});
test('forged readback inputs fail without any network access',async()=>{
  let calls=0;
  const transport=async()=>{calls++;throw Error('NETWORK_ACCESS_SHOULD_NOT_HAPPEN');};
  for(const obj of [
    {...receiptReq,case_id:'../../secrets'},
    {...receiptReq,case_id:'A5-CLOUD-20261115-001',go:true},
    {...receiptReq,classification:'PRIVATE'},
    {...receiptReq,kind:'pc5_synthetic_readonly'},
  ]){
    assert.throws(()=>validateReceiptRequest(obj));
    assert.equal((await readCloudPCReceipt(obj,env,{transport})).status,'BLOCKED');
  }
  assert.equal(calls,0);
});
test('missing job, duplicate rows or unexpected worker code reject',async()=>{
  for(const arr of [[],[receiptJob(),receiptJob()],
    [{...receiptJob(),idempotency_key:'DIFFERENT'}]]){
    const r=await readCloudPCReceipt(receiptReq,env,{transport:receiptTransport(arr)});
    assert.equal(r.status,'BLOCKED');
  }
});
test('strongest paid model is not authorized; newest vision is synthetic-only',()=>{
  assert.equal(PC5_MODEL_POLICY.strongest_known_optional_paid,'gpt-6-astra');
  assert.equal(PC5_MODEL_POLICY.paid_api_allowed,false);
  assert.equal(PC5_MODEL_POLICY.newest_free_synthetic_vision_candidate,
    'nvidia/nemotron-3.5-super-vl:free');
  assert.equal(PC5_MODEL_POLICY.free_vision_on_private_windows_screen_allowed,false);
});

test('provider helpers never receive Supabase secrets or unrelated environment fields',()=>{
  const exposed={...env,OPENROUTER_API_KEY:'FAKE_OPENROUTER',
    IMPERION_OPENROUTER_FREE_VERIFIED:'1',
    OPENROUTER_FREE_MODEL:'nvidia/nemotron-3-ultra-550b-a55b:free',
    SUPABASE_SERVICE_ROLE_KEY:'sensitive_server_credential_example',
    PRIVATE_CLIENT_DATA:'do_not_pass',PAYMENT_KEY:'do_not_pass'};
  for(const params of [exposed,{...exposed,OPENROUTER_API_KEY:''}]){
    const pick=selectFreeProvider(params);
    assert.ok(pick);
    assert.deepEqual(Object.keys(pick.env).sort(),[
      'GROQ_API_KEY','IMPERION_GROQ_FREE_VERIFIED',
      'IMPERION_OPENROUTER_FREE_VERIFIED','OPENROUTER_API_KEY',
      'OPENROUTER_FREE_MODEL'].sort());
    assert.equal(JSON.stringify(pick.env).includes('sensitive_server_credential_example'),false);
    assert.equal(JSON.stringify(pick.env).includes('do_not_pass'),false);
  }
});
