'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../scripts/imperion-market-signals.cjs');

const HTML=(body)=>'<html><head><title>Research</title></head><body><main><p>'+
 body+'</p><p>Official industry research with operational examples and survey results for enterprise leaders.</p>'+
 '<p>Researchers discuss how organisations evaluate changing financial conditions and employee needs.</p>'+
 '</main></body></html>';
const fakeFetch=(html,status=200)=>(url,options)=>{
 assert.equal(options.method,'GET');
 assert.equal(options.redirect,'error');
 return Promise.resolve({status,url,headers:{get:()=> 'text/html; charset=utf-8'},text:async()=>html});
};
test('only exact public research URLs are accepted; redirect and non-HTML fail closed',async()=>{
 assert.equal(m.SOURCES.length,4);
 for(const s of m.SOURCES)assert.equal(m.allowedSource(s),true);
 assert.equal(m.allowedSource({...m.SOURCES[0],url:'https://evil.example/steal'}),false);
 await assert.rejects(m.readSource({...m.SOURCES[0],url:'https://evil.example/steal'},fakeFetch('x')),/SOURCE_NOT_ALLOWLISTED/);
 await assert.rejects(m.readSource(m.SOURCES[0],fakeFetch('x',302)),/SOURCE_HTTP_302/);
});
test('text is extracted without scripts/navigation; independent sentences do not prove linked pain',()=>{
 const html=HTML('AI is an emerging topic. Spending controls can be important.')+
 '<script>AI ROI costs profits governance</script>';
 const body=m.visibleText(html);
 assert.equal(body.includes('AI ROI costs profits governance'),false);
 assert.deepEqual(m.scanText(body),{});
 assert.throws(()=>m.visibleText('<title>no body</title>'),/HTML_BODY_MISSING/);
 assert.throws(()=>m.visibleText('x'.repeat(2500001)),/HTML_INVALID_OR_OVERSIZE/);
});
test('real evidence phrase yields a *hypothesis*, never a qualified lead or revenue',async()=>{
 const html=HTML('CEOs found AI investment ROI and cost benefits difficult to measure. '+
 'Operational AI governance risks are becoming harder to manage. '+
 'AI workforce skills and employee training remain important.');
 const s=await m.readSource(m.SOURCES[0],fakeFetch(html));
 assert.equal(s.status,'SOURCE_OK');
 assert.ok(s.themes.AI_VALUE);
 assert.ok(s.themes.AI_GOVERNANCE);
 assert.ok(s.themes.WORKFORCE_SKILLS);
 const r=m.aggregate([s]);
 assert.equal(r.status,'SOURCE_OK');
 assert.ok(r.hypotheses.length>=3);
 for(const h of r.hypotheses){
  assert.equal(h.buyer_demand,'NOT_VERIFIED');
  assert.equal(h.willingness_to_pay,'NOT_VERIFIED');
  assert.equal(h.market_size,'NOT_VERIFIED');
  assert.equal(h.economic_gate,'REVIEW_UNCOSTED');
  assert.equal(h.minimum_net_czk_per_all_owner_hour,1000);
  assert.equal(h.outreach_authorized,false);
  assert.ok(h.sources.every(x=>x.url.startsWith('https://')));
 }
});
test('dedup across reruns by evidence set, without a new CRM',()=>{
 const sample={...m.SOURCES[0],status:'SOURCE_OK',themes:{AI_VALUE:{sentences:2}}};
 const once=m.aggregate([sample]);
 assert.equal(once.new_evidence_sets,1);
 const twice=m.aggregate([sample],once.state);
 assert.equal(twice.new_evidence_sets,0);
 assert.equal(twice.hypotheses.length,1);
 assert.equal(twice.hypotheses[0].new_evidence_set,false);
});
test('unavailable sources become SOURCE_FAILED; never fabricate evidence',async()=>{
 const r=await m.run({fetcher:async()=>({status:503,headers:{get:()=> 'text/html'},text:async()=>''})});
 assert.equal(r.status,'SOURCE_FAILED');
 assert.equal(r.source_success,0);
 assert.equal(r.hypotheses.length,0);
 assert.equal(r.crm_writes,0);
 assert.equal(r.paid_api_requests,0);
 assert.equal(r.communications_sent,0);
 assert.match(m.markdown(r),/SOURCE_FAILED/);
});
test('partial availability is explicit; no invented publication dates',async()=>{
 const html=HTML('Many CEOs say AI has not delivered measurable revenue returns or cost savings.');
 const r=await m.run({fetcher:async(url,opts)=>
  url===m.SOURCES[0].url?fakeFetch(html)(url,opts):
  ({status:403,url,headers:{get:()=> 'text/html'},text:async()=>''})});
 assert.equal(r.status,'SOURCE_PARTIAL');
 assert.equal(r.source_success,1);
 assert.equal(r.source_failures.length,3);
 assert.equal(r.hypotheses[0].sources[0].publication_date,null);
 assert.match(m.markdown(r),/publication date not verified/);
});
