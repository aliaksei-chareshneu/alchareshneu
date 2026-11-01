'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.resolve(__dirname,'..','ImperionClosedLoopAudit.gs'),'utf8');
const HUB='synthetic-private-Hub';
function fixtures(){
  return {
    Druzina_Bookings: [
      ['Booking_ID','Session_ID','Payment_ID','Status','Booking_Type'],
      ['BOOK-1','S-1','PAY-1','CONFIRMED','PAID'],
      ['BOOK-2','MISSING','','PROVISIONAL_PAID','PAID'],
      ['BOOK-3','S-1','','CANCELLED','PAID'],
    ],
    Druzina_Payments: [
      ['Payment_ID','Verification_Status','Amount_CZK'],
      ['PAY-1','PARTIAL / 120 OUTSTANDING',240],
      ['PAY-2','VERIFIED',500],
    ],
    Druzina_Quotes:[['Quote_ID','Status'],['Q-1','PAID']],
    Druzina_Sessions:[['Session_ID','Status'],['S-1','PLANNED']],
    IMPERION_Agent_Jobs:[
      ['Job_ID','Status','Owner_Approval','Evidence_URI'],
      ['JOB-A','DONE','APPROVED',''],
      ['JOB-B','VERIFIED','APPROVED','https://example.org/receipt'],
      ['JOB-C','PROPOSED','PENDING',''],
    ],
    IMPERION_Execution_Receipts:[
      ['Receipt_ID','Job_ID','Status','Verified_At','Verifier','Evidence_URI'],
      ['RECEIPT-1','JOB-B','DONE','2026-11-01','GITHUB','https://example.org/receipt'],
    ],
    Druzina_Deployment_Checklist:[
      ['Task_ID','Status'],
      ...['D06','D14','D18','D21','D23','D25','D26','D31'].map(id=>[id,'DONE']),
    ],
    Druzina_Config:[['Key','Value'],['CALENDAR_SYNC_ENABLED','FALSE'],['PREZENCKY_SYNC_ENABLED','FALSE']],
    IMPERION_Exceptions:[['Exception_ID','Status'],['EX-1','OPEN'],['EX-2','RESOLVED']],
  };
}
function context(tabs=fixtures(), options={}) {
  const writes=[];
  const sheets=Object.fromEntries(Object.entries(tabs).map(([name,data])=>[name,{
    getLastRow:()=>data.length,
    getLastColumn:()=>data[0].length,
    getRange:(row,col,height,width)=>({
      getDisplayValues:()=>data.slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width).map(String)),
      getValues:()=>data.slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width)),
    }),
  }]));
  const ctx={
    ocOwner_:()=>{if(options.denied)throw Error('OWNER_ONLY');},
    ocId_:()=>HUB,
    SPREADSHEET_ID:options.wrongHub?'wrong-hub':HUB,
    SpreadsheetApp:{openById:id=>{assert.equal(id,HUB);return {
      getSpreadsheetTimeZone:()=>options.timeZone||'Europe/Prague',
      getSheetByName:name=>sheets[name]||null,
    };}},
    Date, Math,
    writes,
  };
  vm.createContext(ctx);vm.runInContext(code,ctx);
  return ctx;
}
test('requires existing owner session, verified Hub and Prague timezone',()=>{
  assert.throws(()=>context(fixtures(),{denied:true}).imperionClosedLoopAuditHealth(),/OWNER_ONLY/);
  assert.throws(()=>context(fixtures(),{wrongHub:true}).imperionClosedLoopAuditHealth(),/IMPERION_WRONG_HUB/);
  assert.throws(()=>context(fixtures(),{timeZone:'UTC'}).imperionClosedLoopAuditHealth(),/IMPERION_HUB_TIMEZONE_UNVERIFIED/);
  const c=context();delete c.ocOwner_;
  assert.throws(()=>c.imperionClosedLoopAuditHealth(),/IMPERION_OWNER_GUARD_MISSING/);
});
test('partial payment cannot confirm a booking or bank cash',()=>{
  const x=context().imperionClosedLoopAuditHealth();
  assert.equal(x.counts.bookings_total,3);
  assert.equal(x.counts.booking_confirmed_claims,1);
  assert.equal(x.counts.booking_claims_with_partial_payment,1);
  assert.equal(x.counts.booking_claims_missing_payment,1);
  assert.equal(x.counts.booking_claims_missing_session,1);
  assert.equal(x.counts.payment_partial_claims,1);
  assert.equal(x.counts.payment_verified_claims_unverified_by_provider,1);
  assert.equal(x.counts.quote_paid_claims_unverified_by_provider,1);
  assert.equal(x.bank_verified_receipts,0);
  assert.equal(x.provider_verified_bookings,0);
  assert.equal(x.bank_readback,'NOT_PERFORMED');
  assert.equal(x.booking_provider_readback,'NOT_PERFORMED');
  assert.equal(x.paid_checkout_release_allowed,false);
});
test('closed agent job with stored receipt still needs independent provider readback',()=>{
  const x=context().imperionClosedLoopAuditHealth();
  assert.equal(x.counts.agent_jobs_total,3);
  assert.equal(x.counts.agent_completed_claims,2);
  assert.equal(x.counts.completed_claims_without_stored_receipt,1);
  assert.equal(x.counts.completed_claims_with_receipt_still_needing_provider,1);
  assert.equal(x.provider_verified_agent_completion,0);
});
test('status flags do not bypass legal gates or enable calendar sync',()=>{
  const a=context().imperionClosedLoopAuditHealth();
  assert.equal(a.hard_gates_unverified.length,8);
  assert.equal(a.protected_sync_flags.CALENDAR_SYNC_ENABLED,false);
  const t=fixtures();t.Druzina_Config[1][1]='TRUE';
  const b=context(t).imperionClosedLoopAuditHealth();
  assert.equal(b.protected_sync_flags.CALENDAR_SYNC_ENABLED,true);
  assert.equal(b.paid_checkout_release_allowed,false);
  assert.equal(b.new_triggers_or_records,0);
});
test('duplicate payment ID is flagged and cannot prove clearing',()=>{
  const t=fixtures();t.Druzina_Payments.push(['PAY-1','BANK_VERIFIED',240]);
  const x=context(t).imperionClosedLoopAuditHealth();
  assert.equal(x.duplicates.payments,1);
  assert.equal(x.counts.booking_claims_missing_payment,2);
  assert.equal(x.bank_verified_receipts,0);
});
test('missing tabs and duplicate required header fail closed',()=>{
  const t=fixtures();delete t.Druzina_Bookings;
  assert.throws(()=>context(t).imperionClosedLoopAuditHealth(),/MISSING_EXISTING_TAB/);
  const tt=fixtures();tt.Druzina_Bookings[0][4]='Status';
  assert.throws(()=>context(tt).imperionClosedLoopAuditHealth(),/AUDIT_AMBIGUOUS_HEADER/);
});
test('no raw names, IDs, email, payment source or URL in returned health',()=>{
  const t=fixtures();t.Druzina_Bookings[1][0]='customer@example.test';
  const x=context(t).imperionClosedLoopAuditHealth();
  const json=JSON.stringify(x);
  assert.doesNotMatch(json,/customer@example|BOOK-1|RECEIPT-1|https:\/\/);
  assert.equal(x.mode,'READ_ONLY_PRIVATE_OWNER_AUDIT');
  assert.equal(x.published_or_sent_or_charged,0);
  assert.doesNotMatch(code,/\.setValues?\s*\(|\.appendRow\s*\(|\.create\s*\(|UrlFetchApp|ScriptApp|MailApp|GmailApp/);
});
test('empty legal but well-structured ledgers stay blocked; no false health',()=>{
  const t=fixtures();
  for(const tab of ['Druzina_Bookings','Druzina_Payments','Druzina_Quotes',
    'IMPERION_Agent_Jobs','IMPERION_Execution_Receipts','IMPERION_Exceptions'])t[tab]=t[tab].slice(0,1);
  const x=context(t).imperionClosedLoopAuditHealth();
  assert.equal(x.counts.bookings_total,0);
  assert.equal(x.counts.payments_total,0);
  assert.equal(x.bank_verified_receipts,0);
  assert.equal(x.paid_checkout_release_allowed,false);
});
