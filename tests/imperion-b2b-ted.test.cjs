'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const m=require('../scripts/imperion-b2b-ted.cjs');
const NOW=new Date('2026-11-03T15:00:00Z');
const LANE=m.DEFAULT_LANES[0];
const sample={
  'publication-number':'00012345-2026',
  'publication-date':'2026-11-02',
  'notice-title':{eng:['Python process automation and data analysis service']},
  'buyer-name':{eng:['EXAMPLE PUBLIC BUYER - SYNTHETIC']},
  'buyer-country':'CZE','classification-cpv':['72000000'],
  'deadline-receipt-tender-date-lot':['2026-11-19T12:00:00Z']
};
test('official TED query is bounded and explicit public competition',()=>{
  const q=m.payloads(NOW);
  assert.equal(q.length,4);
  for(const p of q){assert.match(p.request.query,/publication-date>=20261013/);assert.match(p.request.query,/form-type=competition/);
    assert.equal(p.request.limit,40);assert.equal(p.request.scope,'ACTIVE');}
});
test('parses multilingual titles, preserves leading zeros and official links',()=>{
  const r=m.normalize(sample,LANE,NOW);
  assert.equal(r.id,'TED:00012345-2026');
  assert.equal(r.source_url,'https://ted.europa.eu/en/notice/-/detail/00012345-2026');
  assert.equal(r.deadline,'2026-11-19');
  assert.equal(r.budget_verified,'NOT_VERIFIED');assert.equal(r.sent,false);assert.ok(r.fit_score>=42);
});
test('rejects expired, malformed or old notices and missing buyer',()=>{
  assert.equal(m.normalize({...sample,'publication-number':'javascript:alert(1)'},LANE,NOW),null);
  assert.equal(m.normalize({...sample,'deadline-receipt-tender-date-lot':['2026-11-01']},LANE,NOW),null);
  assert.equal(m.normalize({...sample,'publication-date':'2026-01-01'},LANE,NOW),null);
  assert.equal(m.normalize({...sample,'buyer-name':null},LANE,NOW),null);
});
test('idempotency dedupes across query lanes and prior scans',()=>{
  const groups=[{lane:LANE,notices:[sample,sample]},{lane:m.DEFAULT_LANES[1],notices:[sample]}];
  const a=m.uniqueAndNew(groups,{},NOW);
  assert.equal(a.all.length,1);assert.equal(a.fresh.length,1);
  const b=m.uniqueAndNew(groups,a.state,NOW);
  assert.equal(b.all.length,1);assert.equal(b.fresh.length,0);
});
test('CSV sanitizes formula injection from untrusted titles',()=>{
  assert.equal(m.csvCell('=IMPORTXML("https://bad.example")'),'"\'=IMPORTXML(""https://bad.example"")"');
  const r=m.normalize({...sample,'notice-title':{eng:['=1+1 Python automation']}},LANE,NOW);
  const f=m.buildFiles({all:[r],fresh:[r],seen_before:0},NOW,true);
  assert.match(f.csv,/"'=1\+1 Python automation"/);
  assert.match(f.summary.execution_status,/SIMULATED/);
  assert.equal(f.summary.crm_deduplicated,false);
});
test('API parse fails closed rather than claiming leads from an error',async()=>{
  await assert.rejects(()=>m.requestOne({},async()=>({ok:false,status:429,headers:new Headers(),text:async()=>''})),/TED_HTTP_429/);
  await assert.rejects(()=>m.requestOne({},async()=>({ok:true,headers:new Headers(),text:async()=>'{"bad":true}'})),/TED_SCHEMA_MISMATCH/);
});
test('fixture runs without network and never writes live persistent ID cache',async()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'imperion-b2b-'));
  try{
    const fixture=path.join(base,'fixture.json'),out=path.join(base,'out'),state=path.join(base,'state.json');
    fs.writeFileSync(fixture,JSON.stringify({groups:[{lane:LANE,notices:[sample]}]}));
    const result=await m.main(['--fixture',fixture,'--out',out,'--state',state,'--now',NOW.toISOString()]);
    assert.equal(result.execution_status,'SIMULATED_TEST_FIXTURE');
    assert.equal(result.new_to_public_id_cache,1);
    assert.equal(fs.existsSync(state),false);
    assert.equal(fs.existsSync(path.join(out,'crm_review_import.csv')),true);
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'candidates.json'),'utf8')).applications_sent,0);
  }finally{fs.rmSync(base,{recursive:true,force:true});}
});
test('rejects broad category matches that are irrelevant to solo consulting',()=>{
  const training=m.DEFAULT_LANES.find(x=>x.focus==='CORPORATE_TRAINING');
  const hardware=m.DEFAULT_LANES.find(x=>x.focus==='AI_DATA_PYTHON');
  assert.equal(m.normalize({...sample,'notice-title':'Czechia – Education and training services – Legal and accounting courses without digital skills'},training,NOW),null);
  assert.equal(m.normalize({...sample,'notice-title':'Czechia – IT services – Cisco security network equipment maintenance'},hardware,NOW),null);
  assert.equal(m.normalize({...sample,'notice-title':'Czechia – Air-conditioning appliances – Installation of air conditioning in tram vehicles'},training,NOW),null);
  assert.ok(m.normalize({...sample,'notice-title':'Poland – Software services – Build an Open Data portal for a municipality'},hardware,NOW));
});
