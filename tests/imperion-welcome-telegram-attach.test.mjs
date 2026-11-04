import test from 'node:test';
import assert from 'node:assert/strict';
import {planWebhook,reconcileWebhook,WEBHOOK_URL} from '../scripts/imperion-welcome-telegram-attach.mjs';
const env={WELCOME_TELEGRAM_BOT_TOKEN:'123456:abcdefghijklmnopqrstuvwxyzABCDE12345',WELCOME_EXPECTED_BOT_USERNAME:'WelcomeOwnerBot',WELCOME_GROUPS_JSON:JSON.stringify({'-100123456789':{subject:'druzina'}}),WELCOME_NO_POLLING_CONFIRMED:'yes',WELCOME_ATTACH_GO:'yes',WELCOME_TELEGRAM_WEBHOOK_SECRET:'valid_secret_of_sufficient_length_123'};
function makeFetch({webhook='',canWelcome=true,username='WelcomeOwnerBot'}={}){
 const calls=[];
 let url=webhook;
 let allowed=url?['message','callback_query']:[];
 const fn=async (full,req)=>{
  const method=full.split('/').pop();
  calls.push({method,body:JSON.parse(req.body)});
  let result={};
  if(method==='getMe')result={id:987654,username};
  else if(method==='getWebhookInfo')result={url,allowed_updates:allowed,pending_update_count:0};
  else if(method==='getChatMember')result={status:'administrator',can_send_welcome_messages:canWelcome};
  else if(method==='setWebhook'){url=JSON.parse(req.body).url;allowed=JSON.parse(req.body).allowed_updates;result=true;}
  return {ok:true,async json(){return {ok:true,result};}};
 };
 return {fn,calls};
}
test('existing other webhook blocks all writes',async()=>{
 const mock=makeFetch({webhook:'https://some-existing-handler.example/webhook'});
 const r=await reconcileWebhook({env,fetchImpl:mock.fn,apply:true});
 assert.equal(r.status,'BLOCKED_OTHER_WEBHOOK');
 assert.equal(mock.calls.some(x=>x.method==='setWebhook'),false);
});
test('preview must never call setWebhook',async()=>{
 const mock=makeFetch();const r=await reconcileWebhook({env,fetchImpl:mock.fn});
 assert.equal(r.status,'PREVIEW_SAFE_TO_ATTACH');assert.equal(r.sideEffects,0);
 assert.equal(mock.calls.some(x=>x.method==='setWebhook'),false);
});
test('no attach without confirmed lack of long polling',async()=>{
 const mock=makeFetch();const r=await reconcileWebhook({env:{...env,WELCOME_NO_POLLING_CONFIRMED:''},fetchImpl:mock.fn,apply:true});
 assert.equal(r.status,'BLOCKED_POLLING_STATUS_UNVERIFIED');assert.equal(mock.calls.some(x=>x.method==='setWebhook'),false);
});
test('no attach if expected username mismatches the real bot',async()=>{
 const mock=makeFetch({username:'OtherBot'});const r=await reconcileWebhook({env,fetchImpl:mock.fn,apply:true});
 assert.equal(r.status,'BLOCKED_BOT_IDENTITY_MISMATCH');assert.equal(mock.calls.some(x=>x.method==='setWebhook'),false);
});
test('no attach without group administrator welcome privileges',async()=>{
 const mock=makeFetch({canWelcome:false});const r=await reconcileWebhook({env,fetchImpl:mock.fn,apply:true});
 assert.equal(r.status,'BLOCKED_GROUP_ADMIN_PERMISSION');assert.equal(mock.calls.some(x=>x.method==='setWebhook'),false);
});
test('attach uses secret and preserves pending updates, then independently reads back',async()=>{
 const mock=makeFetch();const r=await reconcileWebhook({env,fetchImpl:mock.fn,apply:true});
 assert.equal(r.status,'WEBHOOK_ATTACHED_DRY_RUN');
 const sends=mock.calls.filter(x=>x.method==='setWebhook');assert.equal(sends.length,1);
 const body=sends[0].body;assert.equal(body.url,WEBHOOK_URL);
 assert.equal(body.drop_pending_updates,false);assert.equal(body.max_connections,1);
 assert.deepEqual(body.allowed_updates,['message','chat_member']);
 assert.ok(!JSON.stringify(r).includes(env.WELCOME_TELEGRAM_BOT_TOKEN));
});
test('plan preserves extra allowed updates on same endpoint, refuses different endpoint',()=>{
 assert.deepEqual(planWebhook({url:WEBHOOK_URL,allowed_updates:['callback_query','message']}).allowed_updates,['callback_query','message','chat_member']);
 assert.equal(planWebhook({url:'https://other.example'}).canApply,false);
});
test('missing group or secret fails closed and sends no webhook config',async()=>{
 const a=makeFetch();const r=await reconcileWebhook({env:{...env,WELCOME_GROUPS_JSON:'{}'},fetchImpl:a.fn,apply:true});
 assert.equal(r.status,'BLOCKED_GROUP_IDS_NOT_CONFIGURED');assert.equal(a.calls.length,0);
 const b=makeFetch();const s=await reconcileWebhook({env:{...env,WELCOME_TELEGRAM_WEBHOOK_SECRET:''},fetchImpl:b.fn,apply:true});
 assert.equal(s.status,'BLOCKED_MISSING_WEBHOOK_SECRET');assert.equal(b.calls.some(x=>x.method==='setWebhook'),false);
});
