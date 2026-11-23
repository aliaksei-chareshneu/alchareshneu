import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handleCart} from '../supabase/functions/imperion-register/cart.mjs';
import {quoteStarter4} from '../supabase/functions/imperion-register/cart-packages.mjs';
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
 assert.equal(writes[0][1].p_cart.futureUpdates,false);
 assert.equal(writes[0][1].p_cart.photo,'NO');
});
test('rejects duplicates, overlong carts, missing safety, all without writes',async()=>{
 for(const b of [
  {...base,eventIds:['PUB-HEMA-20261123','PUB-HEMA-20261123']},
  {...base,eventIds:['A','B','C','D','E','F','G','H','I']},
  {...base,safety:false},
 ]){const {d,writes}=deps();const out=await handleCart(b,null,req,d);assert.equal(out.status,400);assert.equal(writes.length,0);}
});
test('one selected HEMA event uses the same atomic cart path without a second RSVP',async()=>{
 const {d,writes}=deps();const out=await handleCart({...base,eventIds:['PUB-HEMA-20261123']},null,req,d);
 assert.equal(out.status,200);assert.equal(out.body.secrets.length,1);
 assert.equal(writes.length,1);assert.equal(writes[0][0],'imperion_rsvp_cart_create');
});
function starterRows(size,{offset=0,step=5,provider='Aliaksei Chareshneu (OSVČ)'}={}){
 const first=Date.parse('2030-02-10T18:00:00Z')+offset*86400000;
 const entries=Array.from({length:size},(_,i)=>{
  const event_id='HEMA-TEST-'+i;
  const when=new Date(first+i*step*86400000).toISOString();
  return {row:{event_id,training_requested_tier:'STARTER4',created_at:new Date(first-7*86400000).toISOString()},
   event:{event_id,community:'Družina Moravy',category:'HEMA Training',data_controller:provider,begins_at:when}};
 });
 return {rows:entries.map(x=>x.row),catalog:new Map(entries.map(x=>[x.event.event_id,x.event]))};
}
test('four dates within 30 days have one 800 CZK pack, not four 800 CZK charges',()=>{
 const {rows,catalog}=starterRows(4);const x=quoteStarter4(rows,catalog);
 assert.equal(x.packCount,1);
 assert.equal([...x.prices.values()].reduce((a,p)=>a+p.totalCzk,0),800);
 assert.equal(x.prices.size,4);
});
test('eight eligible dates produce two distinct 800 CZK passes',()=>{
 const {rows,catalog}=starterRows(8,{step:3});
 const x=quoteStarter4(rows,catalog);assert.equal(x.packCount,2);
 assert.equal([...x.prices.values()].reduce((a,p)=>a+p.totalCzk,0),1600);
});
test('five selected dates: four in a pass and a separate standard remains outside pass',()=>{
 const {rows,catalog}=starterRows(5);rows[4].training_requested_tier='STANDARD';
 const x=quoteStarter4(rows,catalog);assert.equal(x.packCount,1);
 assert.equal(x.prices.size,4);assert.ok(!x.prices.has(rows[4].event_id));
});
test('invalid starter plans are rejected: partial count, time span, different legal seller',()=>{
 const fewer=starterRows(3),spaced=starterRows(4,{step:14}),mixed=starterRows(4);
 mixed.catalog.get(mixed.rows[0].event_id).data_controller='Družina Moravy, z. s.';
 assert.equal(quoteStarter4(fewer.rows,fewer.catalog).error,'package_requires_four_dates');
 assert.equal(quoteStarter4(spaced.rows,spaced.catalog).error,'package_30_day_window_invalid');
 assert.equal(quoteStarter4(mixed.rows,mixed.catalog).error,'package_seller_mismatch');
});
test('late new four-session starter quote is 1000 CZK, not BANK VERIFIED',()=>{
 const {rows,catalog}=starterRows(4);
 const first=Date.parse(catalog.get(rows[0].event_id).begins_at);
 for(const row of rows)row.created_at=new Date(first-20*3600000).toISOString();
 const x=quoteStarter4(rows,catalog);assert.equal(x.packCount,1);
 assert.equal([...x.prices.values()].reduce((a,p)=>a+p.totalCzk,0),1000);
});
test('adult explicit photo/update opt-ins are carried only as private cart input',async()=>{
 const {d,writes}=deps();
 const out=await handleCart({...base,photo:'YES',futureUpdates:true},null,req,d);
 assert.equal(out.status,200);
 assert.equal(writes[0][1].p_cart.photo,'YES');
 assert.equal(writes[0][1].p_cart.futureUpdates,true);
 assert.equal(out.body.bankVerified,false);
});
test('minor photo/update opt-ins are suppressed even when requested',async()=>{
 const {d,writes}=deps();
 const out=await handleCart({...base,ageGroup:'under18',
  guardianName:'Parent Guardian',guardianPhone:'+420123456789',photo:'YES',futureUpdates:true},null,req,d);
 assert.equal(out.status,200);
 assert.equal(writes[0][1].p_cart.photo,'NO');
 assert.equal(writes[0][1].p_cart.futureUpdates,false);
});
