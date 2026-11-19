import test from 'node:test';
import assert from 'node:assert/strict';
import {QUERY_GROUPS, tedRequest, parseTedResponse, normalizeNotice, moneyGate,pragueSlot,deadlineBackfillCandidates} from '../supabase/functions/imperion-deal-hunter/core.mjs';
const example={'publication-number':'760875-2026','notice-title':{ces:['Česko – Vývoj programového vybavení na zakázku – ZAJIŠTĚNÍ SERVISU A ROZVOJE MMS 2026']},'buyer-name':{ces:['ČEPS, a.s.']},'publication-date':'2026-11-03+01:00','classification-cpv':['72230000','72230000'],'notice-type':'cn-standard'};
test('3 stable official Czech tender queries; no key required',()=>{assert.equal(QUERY_GROUPS.length,3);for(const group of QUERY_GROUPS) {const q=tedRequest(group.cpv);assert.match(q.query,/buyer-country=CZE/);assert.equal(q.scope,'ACTIVE');assert.ok(!JSON.stringify(q).includes('api_key'));} assert.throws(()=>tedRequest('99999999'));});
test('parse original-type TED eForms multilingual payload; no invented budget/closing date',()=>{const p=parseTedResponse({notices:[example,example]},'IT',new Date('2026-11-03T15:00:00Z'));assert.equal(p.received,2);assert.equal(p.items.length,1);const n=p.items[0];assert.equal(n.buyer,'ČEPS, a.s.');assert.match(n.source_url,/760875-2026$/);assert.equal(n.deadline_on,null);assert.equal(n.status,'REVIEW_UNCOSTED');assert.equal(n.notice_value_raw,null);});
test('reject hostile IDs, empty titles, stale actual deadline, malformed responses',()=>{assert.equal(normalizeNotice({...example,'publication-number':'../../evil'},'IT'),null);assert.equal(normalizeNotice({...example,'notice-title':'x'},'IT'),null);assert.equal(normalizeNotice({...example,'deadline-receipt-tender-date-lot':['2026-11-01']},'IT',new Date('2026-11-03')),null);assert.throws(()=>parseTedResponse({notices:'invalid'},'IT'));});
test('economic hard gate uses actual owner quote and ALL hours, never TED contract total',()=>{assert.equal(moneyGate(undefined,10,0).gate,'REVIEW_UNCOSTED');assert.deepEqual(moneyGate(6000,4,1000),{gate:'PASS_ESTIMATE',net_czk_per_full_hour:1250});assert.equal(moneyGate(6000,7,1000).gate,'REJECT_UNDER_1000');assert.equal(moneyGate(9000,0).gate,'REVIEW_UNCOSTED');});
test('Prague DST produces exactly two local daily slots weekdays',()=>{assert.equal(pragueSlot(new Date('2026-11-03T06:20:00Z')).allowed,true);assert.equal(pragueSlot(new Date('2026-07-07T05:20:00Z')).allowed,true);assert.equal(pragueSlot(new Date('2026-07-07T06:20:00Z')).allowed,false);assert.equal(pragueSlot(new Date('2026-11-07T06:20:00Z')).allowed,false);});

test('TED request includes actual eForms lot submission dates, not generic-only deadline',()=>{
  const q=tedRequest('72000000');
  assert.ok(q.fields.includes('deadline-receipt-tender-date-lot'));
  assert.ok(q.fields.includes('deadline-receipt-request-date-lot'));
  assert.ok(q.fields.includes('deadline'));
});
test('future still-open lot survives older expired lot and is marked only as unverified review',()=>{
  const n=normalizeNotice({...example,'deadline-receipt-tender-date-lot':{
    LOT1:['2026-11-01T12:00:00+01:00'],LOT2:['2026-12-01T12:00:00+01:00']
  }},'IT',new Date('2026-11-03T15:00:00Z'));
  assert.equal(n.deadline_on,'2026-12-01');
  assert.match(n.evidence_classification,/DEADLINE_FIELD=TENDER_LOT/);
  assert.equal(n.status,'REVIEW_UNCOSTED');
});
test('do not convert generic information deadline into verified tender closing date',()=>{
  const n=normalizeNotice({...example,deadline:['2026-12-31']},'IT',new Date('2026-11-03T15:00:00Z'));
  assert.equal(n.deadline_on,null);
  assert.match(n.evidence_classification,/DEADLINE_FIELD=NOT_VERIFIED/);
});
test('reject already expired receipt request; prefer tender deadline when both exist',()=>{
  const at=new Date('2026-11-03T15:00:00Z');
  assert.equal(normalizeNotice({...example,'deadline-receipt-request-date-lot':['2026-11-01']},'IT',at),null);
  const n=normalizeNotice({...example,
    'deadline-receipt-tender-date-lot':['2026-12-05'],
    'deadline-receipt-request-date-lot':['2026-11-20']
  },'IT',at);
  assert.equal(n.deadline_on,'2026-12-05');
  assert.match(n.evidence_classification,/DEADLINE_FIELD=TENDER_LOT/);
});

test('backfill selector is idempotent and never overwrites owner-confirmed dates',()=>{
  const items=[
    {source_key:'TED:00000001-2026',deadline_on:'2026-12-20'},
    {source_key:'TED:00000002-2026',deadline_on:'2026-12-21'},
    {source_key:'TED:00000003-2026',deadline_on:null},
    {source_key:'TED:00000004-2026',deadline_on:'2026-12-25'}
  ];
  const prior=[
    {source_key:'TED:00000001-2026',deadline_on:null,owner_note:'preserve'},
    {source_key:'TED:00000002-2026',deadline_on:'2026-12-30'},
    {source_key:'TED:00000003-2026',deadline_on:null}
  ];
  assert.deepEqual(deadlineBackfillCandidates(items,prior).map(x=>x.source_key),
    ['TED:00000001-2026']);
  assert.deepEqual(deadlineBackfillCandidates(items,[{source_key:'TED:00000001-2026',deadline_on:'2026-12-20'}]),[]);
  assert.throws(()=>deadlineBackfillCandidates({},prior),/INVALID_BACKFILL_INPUT/);
});
