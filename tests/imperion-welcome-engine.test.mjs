import assert from 'node:assert/strict';
import test from 'node:test';
import {routePlatformEvent,parseTelegramUpdate,processTelegramUpdate,digestKey} from '../supabase/functions/imperion-welcome-engine/core.mjs';
import {validWebhookSecret,decodeAllowlist} from '../supabase/functions/imperion-welcome-engine/security.mjs';
const text='Welcome, see https://aliaksei-chareshneu.github.io/alchareshneu/druzina/';
const conf={groups:{'-100567':{subject:'druzina',language:'ru',text}},privateStarts:{default:{subject:'druzina',language:'ru',text}}};
const join=(i=123,user=45)=>({update_id:i,chat_member:{chat:{id:-100567,type:'supergroup'},old_chat_member:{status:'left',user:{id:user}},new_chat_member:{status:'member',user:{id:user}}}});
const start=(i=124,user=45)=>({update_id:i,message:{chat:{id:user,type:'private'},from:{id:user},text:'/start'}});
test('new group membership routes only to group, never private DM',()=>{
 const r=parseTelegramUpdate(join(),conf.groups,conf.privateStarts);
 assert.equal(r.action,'GROUP_GREETING');assert.equal(r.chatId,-100567);
});
test('existing member status changes and unknown groups are blocked',()=>{
 const x=join();x.chat_member.old_chat_member.status='member';assert.equal(parseTelegramUpdate(x,conf.groups).status,'NOT_A_NEW_MEMBER');
 const y=join();y.chat_member.chat.id=-100123;assert.equal(parseTelegramUpdate(y,conf.groups).status,'GROUP_NOT_APPROVED');
});
test('private messages need an explicit /start by the recipient',()=>{
 assert.equal(parseTelegramUpdate(start(),conf.groups,conf.privateStarts).action,'USER_INITIATED_REPLY');
 const x=start();x.message.text='hello';assert.equal(parseTelegramUpdate(x,conf.groups,conf.privateStarts).status,'NOT_AN_ELIGIBLE_EVENT');
});
test('platform matrix never authorizes cold follower/friend messaging',()=>{
 for(const [p,k] of [['whatsapp','ordinary_group_join'],['instagram','follow'],['facebook','friend'],['facebook','follow'],['youtube','subscribe'],['tiktok','follow']]) {
  assert.equal(routePlatformEvent(p,k).send,false,p+'/'+k);
 }
 assert.equal(routePlatformEvent('telegram','private_start',{optedOut:true}).send,false);
});
test('by default engine is dry run, no writes or messages',async()=>{
 let calls=0;const r=await processTelegramUpdate(join(),{...conf,mode:'dry-run',sender:{send:()=>{calls++;}}});
 assert.equal(r.status,'DRY_RUN');assert.equal(calls,0);
});
test('live mode requires strong pepper, store and sender',async()=>{
 const r=await processTelegramUpdate(join(),{...conf,mode:'live'});assert.equal(r.status,'BLOCKED_CONFIG');
 await assert.rejects(()=>digestKey('short',parseTelegramUpdate(join(),conf.groups)),/missing_pepper/);
});
test('live acceptance with atomic dedupe, no duplicate provider messages',async()=>{
 const memory=new Set();let sends=0;
 const store={async reserve(r){if(memory.has(r.dedupe_key))return 'duplicate';memory.add(r.dedupe_key);return 'reserved';},async complete(){}};
 const sender={async send(){sends++;return {message_id:2026};}};
 const opts={...conf,mode:'live',pepper:'test-pepper-not-for-production-123456',store,sender};
 const first=await processTelegramUpdate(join(),opts);const second=await processTelegramUpdate(join(125),opts);
 assert.equal(first.status,'API_ACCEPTED');assert.equal(second.status,'DUPLICATE');assert.equal(sends,1);
});
test('provider failure is not silently retried and does not claim SENT',async()=>{
 const updates=[];let sends=0;
 const store={async reserve(){return 'reserved';},async complete(...p){updates.push(p);}};
 const sender={async send(){sends++;throw Error('offline');}};
 const r=await processTelegramUpdate(join(),{...conf,mode:'live',pepper:'test-pepper-not-for-production-123456',store,sender});
 assert.equal(r.status,'FAILED_REVIEW_REQUIRED');assert.equal(r.externalSend,false);assert.equal(sends,1);assert.equal(updates[0][1],'FAILED');
});
test('bad group config cannot send; no cross-subject substitution',()=>{
 const x={groups:{'-100567':{subject:'osvc',language:'ru',text:'Hello unrelated'}}};
 assert.equal(parseTelegramUpdate(join(),x.groups).status,'GROUP_NOT_APPROVED');
});
test('webhook only accepts a configured secret; no empty-bypass',()=>{
 const good='a1B2_cdefghiJKLmnoPQRstuVWXYZ3';
 assert.equal(validWebhookSecret(good,good),true);
 assert.equal(validWebhookSecret(good+'x',good),false);
 assert.equal(validWebhookSecret('',good),false);
 assert.equal(validWebhookSecret('',''),false);
});
test('bad allowlists fail closed',()=>{
 assert.deepEqual(decodeAllowlist('{bad'),{});
 assert.deepEqual(decodeAllowlist('[]'),{});
 assert.deepEqual(decodeAllowlist('{"x":2}'),{x:2});
});
test('provider API acceptance is preserved if receipt write fails',async()=>{
 let sends=0;
 const store={async reserve(){return 'reserved';},async complete(){throw Error('db unavailable');}};
 const sender={async send(){sends++;return {message_id:777};}};
 const r=await processTelegramUpdate(join(),{...conf,mode:'live',pepper:'test-pepper-not-for-production-123456',store,sender});
 assert.equal(r.status,'API_ACCEPTED_RECEIPT_UNVERIFIED');assert.equal(r.externalSend,true);assert.equal(sends,1);
});
test('Telegram community requires approved RU/UA language configuration',()=>{
 const config={groups:{'-100567':{subject:'druzina',language:'en',text}}};
 assert.equal(parseTelegramUpdate(join(),config.groups).status,'GROUP_NOT_APPROVED');
});
