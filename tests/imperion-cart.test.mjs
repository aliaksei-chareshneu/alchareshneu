import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleCart} from '../supabase/functions/imperion-register/cart.mjs';
const ID='12345678-1234-4234-8234-123456789abc';
const CODE='A'.repeat(43);
const base={action:'cart_submit',eventIds:['PUB-HEMA-20261123','PUB-HEMA-20261130'],
 firstName:'Test',lastName:'Buyer',email:'test@example.test',phone:'+420123456789',
 ageGroup:'adult',rsvp:'YES',safety:true,language:'en'};
function deps(overrides={}){let writes=[];const d={
 api:{rpc:async(name,body)=>{writes.push([name,body]);return {data:{cartId:ID,controller:'Aliaksei Chareshneu (OSVČ)',references:[]},error:null};},
 from:()=>({select:()=>({eq:()=>({eq:()=>({eq:()=>({eq:()=>({gt:()=>({maybeSingle:async()=>({data:null,error:null})})})})})})})})},
 reply:(x,status)=>({body:x,status}),safeName:x=>{if(!x||x.length<2)throw Error('name');return x;},
 safeEmail:x=>x.toLowerCase(),safePhone:x=>x,safeEnum:(x,values)=>{if(!values.includes(x))throw Error('enum');return x;},
 text:(x,n)=>String(x).slice(0,n),campaignCode:()=>null,discoveryCode:()=>null,
 allow:async()=>true,tokenHash:async()=> 'a'.repeat(64),generateResumeToken:()=>CODE,
 generateVariableSymbol:()=> '1234567890',osvcQuote:()=>null,
 verifiedBankIban:()=>null,createTrainingSpd:()=>null,
 pdfInfo:()=>null,inspectPaymentPdf:()=>null,OSVC_PROOF_BUCKET:'private',EVENT_COLS:'*',...overrides};
 return {d,writes};}
const req={headers:new Headers({origin:'https://aliaksei-chareshneu.github.io'})};
test('multi-event request is one atomic RPC, no bank status',async()=>{
 const {d,writes}=deps();const out=await handleCart(base,null,req,d);
 assert.equal(out.status,200);assert.equal(out.body.confirmed,false);
 assert.equal(out.body.bankVerified,false);assert.equal(out.body.secrets.length,2);
 assert.equal(writes.length,1);assert.equal(writes[0][0],'imperion_rsvp_cart_create');
 assert.deepEqual(writes[0][1].p_items.map(x=>x.eventId),base.eventIds);
 assert.equal(writes[0][1].p_cart.futureUpdates,undefined);
});
test('rejects duplicates, overlong carts, missing safety, all without writes',async()=>{
 for(const b of [
  {...base,eventIds:['PUB-HEMA-20261123','PUB-HEMA-20261123']},
  {...base,eventIds:['A','B','C','D','E','F','G','H','I']},
  {...base,safety:false},
 ]){const {d,writes}=deps();const out=await handleCart(b,null,req,d);assert.equal(out.status,400);assert.equal(writes.length,0);}
});
test('one event does not use cart branch',async()=>{
 const {d,writes}=deps();const out=await handleCart({...base,eventIds:['PUB-HEMA-20261123']},null,req,d);
 assert.equal(out.status,400);assert.equal(writes.length,0);
});