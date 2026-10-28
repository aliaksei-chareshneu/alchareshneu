'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','ImperionAgentSnapshot.gs'),'utf8');
function build(tabs, zone='Europe/Prague') {
  const cells=Object.fromEntries(Object.entries(tabs).map(([name,body])=>[name,{
    getLastRow:()=>body.length,
    getLastColumn:()=>body[0].length,
    getRange:(r,c,count,w)=>({getValues:()=>body.slice(r-1,r-1+count).map(x=>x.slice(c-1,c-1+w))})
  }]));
  const ctx={
    SpreadsheetApp:{getActiveSpreadsheet:()=>({
      getSpreadsheetTimeZone:()=>zone,getSheetByName:n=>cells[n]||null
    })},
    Utilities:{getUuid:()=> 'synthetic-uuid'},Date
  };
  vm.createContext(ctx);vm.runInContext(src,ctx);
  return ctx.imperionAgentBuildSnapshot_();
}
function fixture(){
  return {
    Leads:[['Lead_ID','Email','Stage','Action_Status','Expected_Value_CZK','Next_Action_At','Last_Contact_At','Notes'],['LEAD-1','fictional@example.org','Warm','WAIT_REPLY',3000,new Date('2026-10-28T09:00:00Z'),'','secret notes']],
    Revenue_Actions:[['Lead_ID','Stage','Action_Status','Expected_CZK','Next_Action_At','Notes'],['LEAD-1','Warm','WAIT_REPLY',3000,'','','']],
    SocialPublishing:[['Job_ID','Event_ID','Channel','Status','Rights_OK','Approved_At','Caption'],['PUB-1','EV-1','telegram','SCHEDULED_PENDING','','','private caption']],
    Events:[['Event_ID','Status','Start_DateTime'],['EV-1','Confirmed',new Date('2026-10-28T10:00:00Z')]],
    IMPERION_Agent_Jobs:[['Job_ID','Status','Priority','Deadline_At','Owner_Approval','Evidence_URI'],['JOB-1','PROPOSED','P1','','PENDING','']]
  };
}
test('owner-only snapshot reuses existing tabs and exposes no Notes, Captions or fields beyond allowlist',()=>{
  const x=build(fixture());
  assert.equal(x.source_system,'EXISTING_IMPERION_HUB');
  assert.equal(x.data.Leads[0].Email,'fictional@example.org');
  assert.equal(x.data.Leads[0].Next_Action_At,'2026-10-28T09:00:00.000Z');
  assert.equal(x.data.Events[0].Start_DateTime,'2026-10-28T10:00:00.000Z');
  assert.equal(x.data.ShortFactory.length,0);
  assert.equal(x.data.Leads[0].Notes,undefined);
  assert.equal(x.data.SocialPublishing[0].Caption,undefined);
});
test('wrong timezone, missing tabs or required identity header fail closed',()=>{
  assert.throws(()=>build(fixture(),'UTC'),/IMPERION_HUB_TIMEZONE/);
  const noTab=fixture();delete noTab.Events;
  assert.throws(()=>build(noTab),/IMPERION_REQUIRED_SHEET_MISSING/);
  const bad=fixture();bad.Leads[0][0]='Other_ID';
  assert.throws(()=>build(bad),/IMPERION_SOURCE_KEY_MISSING_OR_DUPLICATE/);
});
