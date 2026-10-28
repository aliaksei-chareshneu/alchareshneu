#!/usr/bin/env node
/* Synthetic tests only: no PII, network, email, production CRM or Apps Script deployment. */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('RegistrationPortal.html','utf8');
const server=fs.readFileSync('RegistrationPortal.gs','utf8');
const legacy=fs.readFileSync('Code.gs','utf8');
assert.ok(legacy.includes("if (e && e.parameter && e.parameter.view === 'register') return regpPage(e);"),'Registration router missing');
assert.ok(legacy.includes("/^WEBSITE_RSVP(?:_|$)/.test("),'Legacy cleanup must skip portal rows');
assert.equal((legacy.match(/function doPost\(e\)/g)||[]).length,1,'Preserve original webhook doPost');
for(const field of ['id="first"','id="last"','id="email"','id="phone"','id="safety"','id="photoConsent"','id="future"','name="rsvp"','id="age"']) {
 assert.ok(html.includes(field),'Missing form input '+field);
}
for(const language of ['en','cs','ru','uk']) assert.ok(html.includes("data-lang="+JSON.stringify(language)),'Missing language '+language);
assert.ok(html.includes('google.script.run'),'Private submission must use authenticated Apps Script RPC');
assert.ok(server.includes("category === 'Corporate'"),'Corporate events must not be publicly listed');
assert.ok(server.includes("String(at(row, 'Registration_Mode')).toUpperCase() !== 'OPEN'"),'Missing explicit event gate');
assert.ok(server.includes('cleanupUniversalRegistrations'),'Missing cleanup handler');
const EH=['Event_ID','Status','Community','Category','Title','Start_DateTime','End_DateTime','Location_Name',
 'Location_Address','Price_CZK','Description','Tally_Form_URL','Telegram_Post_ID','Calendar_Link','Calendar_Event_ID',
 'Last_Synced_At','Sync_Error','Image_Filename','Facebook_Post_ID','RSVP_Total_Recorded','RSVP_Confirmed_Yes',
 'RSVP_Maybe','RSVP_Not_Going','RSVP_Attended','Payment_Verified_Count','RSVP_Link_Check','RSVP_Yes_Recent_36h',
 'RSVP_Yes_Older_36h','RSVP_Needs_Decision','Registration_Mode','Data_Controller','Rules_URL'];
const RH=['Reg_ID','Event_ID','Timestamp','Full_Name','Telegram_Handle','Phone_Number','Age','Guardian_Name',
 'Guardian_Phone','Guardian_Relationship','Child_Name','Child_Age','Emergency_Contact_Name','Emergency_Contact_Phone',
 'Medical_Conditions','Equipment_Note','Photo_Consent','Waiver_Accepted','Payment_Reference','Retention_Until',
 'Submission_ID','RSVP_Status','RSVP_Status_At','Payment_Status','Last_Reminder_At','Check_In_At','Reply_Contact',
 'Source_Channel','Email','First_Name','Last_Name','Safety_Acknowledged','Rules_Version','Consent_Recorded_At',
 'Marketing_Consent','Marketing_Consent_At','Data_Controller','Registration_Locale'];
const rowOf=(header,vals)=>header.map(h=>Object.prototype.hasOwnProperty.call(vals,h)?vals[h]:'');
const evdate=new Date(Date.now()+30*86400000).toISOString().slice(0,16).replace('T',' ');
const eventRow=rowOf(EH,{Event_ID:'TEST-HIKE-20991101',Status:'Active',Community:'Brnowalkers',
 Category:'Hike',Title:'Synthetic hike',Start_DateTime:evdate,Location_Name:'Test square',Price_CZK:0,
 Registration_Mode:'OPEN',Data_Controller:'Synthetic test controller',Rules_URL:'https://aliaksei-chareshneu.github.io/alchareshneu/register/safety/'});
const holdRow=rowOf(EH,{Event_ID:'HOLD-HEMA-20991101',Status:'Active',Community:'Družina Moravy',
 Category:'HEMA Training',Title:'Unverified contact workshop',Start_DateTime:evdate,
 Registration_Mode:'HOLD',Data_Controller:'Synthetic club controller'});
const rows={Events:[EH,eventRow,holdRow],Registrations:[RH,['instruction'],['instruction']]};
function sheet(name){
 return {
  getDataRange(){return{getValues(){return rows[name].map(r=>r.slice())}};},
  getLastRow(){return rows[name].length;},
  getRange(row,col,rs,cs){return {
   getValues(){return Array.from({length:rs},(_,i)=>(rows[name][row-1+i]||[]).slice(col-1,col-1+cs))},
   setValues(block){for(let i=0;i<block.length;i++){if(!rows[name][row-1+i])rows[name][row-1+i]=[];for(let j=0;j<block[i].length;j++)rows[name][row-1+i][col-1+j]=block[i][j]}return this;}
  };}
 };
}
let uuid=0,locked=0;
const context={
 SPREADSHEET_ID:'synthetic', EVENTS_SHEET_NAME:'Events',REGISTRATIONS_SHEET_NAME:'Registrations',
 SpreadsheetApp:{openById(){return {getSheetByName:sheet}},flush(){}},
 PropertiesService:{getScriptProperties(){return {getProperty(name){return name==='UNIVERSAL_PORTAL_LIVE'?'true':''}}}},
 Utilities:{formatDate(dt){return dt.toISOString()},getUuid(){return String(++uuid).padStart(6,'0')}},
 LockService:{getScriptLock(){return {tryLock(){locked++;return true},releaseLock(){locked--}}}},
 ScriptApp:{getProjectTriggers(){return []},newTrigger(){return {timeBased(){return this},everyDays(){return this},atHour(){return this},create(){return true}}}},
 console,Date,Array,Number,String,Object,RegExp,Math
};
vm.createContext(context);
vm.runInContext(server,context,{filename:'RegistrationPortal.gs'});
const list=context.regpGetEvents();
assert.equal(list.events.length,1);
assert.equal(list.events[0].id,'TEST-HIKE-20991101');
const good={eventId:'TEST-HIKE-20991101',firstName:'Ada',lastName:'Example',
 email:'ada@example.test',phone:'+420 777 123 456',ageGroup:'adult',
 safety:true,photo:'NO',futureUpdates:true,rsvp:'YES',language:'en',website:''};
const first=context.regpSubmit(good);
assert.equal(first.ok,true);
assert.equal(first.status,'RECEIVED');
assert.equal(rows.Registrations.length,4);
const one=rows.Registrations[3];
assert.equal(one[RH.indexOf('Email')],'ada@example.test');
assert.equal(one[RH.indexOf('Photo_Consent')],'no');
assert.equal(one[RH.indexOf('Waiver_Accepted')],'');
assert.equal(one[RH.indexOf('Marketing_Consent')],'yes');
assert.equal(one[RH.indexOf('RSVP_Status')],'REGISTERED');
assert.equal(one[RH.indexOf('Payment_Status')],'NOT_REQUIRED');
assert.equal(one[RH.indexOf('Source_Channel')],'WEBSITE_RSVP');
const updated=context.regpSubmit({...good,rsvp:'NO',phone:'+420 777 123 457',photo:'YES',futureUpdates:true});
assert.equal(updated.updated,false,'No anonymous update of an existing RSVP');
assert.equal(updated.status,'RECEIVED','Duplicate and new receive same public status');
assert.equal(updated.reference,undefined,'No private submission ID exposure');
assert.equal(rows.Registrations.length,4,'No duplicate row');
assert.equal(rows.Registrations[3][RH.indexOf('Phone_Number')],good.phone);
assert.equal(rows.Registrations[3][RH.indexOf('RSVP_Status')],'REGISTERED');
assert.equal(rows.Registrations[3][RH.indexOf('Photo_Consent')],'no');
assert.equal(rows.Registrations[3][RH.indexOf('Marketing_Consent')],'yes');
const minor=context.regpSubmit({...good,email:'min@example.test',firstName:'Minor',photo:'YES',
 ageGroup:'under18',guardianName:'Example Guardian',guardianPhone:'+420 777 123 456',futureUpdates:true});
assert.equal(minor.status,'RECEIVED');
assert.equal(rows.Registrations[4][RH.indexOf('RSVP_Status')],'REGISTERED');
assert.equal(minor.needsGuardian,true);
assert.equal(rows.Registrations[4][RH.indexOf('Photo_Consent')],'no');
assert.equal(rows.Registrations[4][RH.indexOf('Marketing_Consent')],'no');
assert.throws(()=>context.regpSubmit({...good,safety:false}),/safety/i);
assert.throws(()=>context.regpSubmit({...good,email:'invalid'}),/email/i);
assert.throws(()=>context.regpSubmit({...good,email:'=SUM(1)@example.test'}),/email/i);
assert.throws(()=>context.regpSubmit({...good,phone:'xyz'}),/phone/i);
assert.equal(context.regpSubmit({...good,photo:''}).ok,true);
assert.equal(rows.Registrations[3][RH.indexOf('Photo_Consent')],'no');
assert.throws(()=>context.regpSubmit({...good,eventId:'HOLD-HEMA-20991101'}),/closed|not available/i);
assert.throws(()=>context.regpSubmit({...good,ageGroup:'under18',guardianName:'',guardianPhone:''}),/guardian/i);
assert.equal(locked,0,'Lock must always be released');
const savedEventDate=rows.Events[1][EH.indexOf('Start_DateTime')];
rows.Events[1][EH.indexOf('Start_DateTime')]=new Date(Date.now()-120*86400000).toISOString().slice(0,16).replace('T',' ');
const marketingCleanup=context.cleanupUniversalRegistrations();
assert.equal(marketingCleanup.minimized,1);
assert.equal(marketingCleanup.purged,0);
assert.equal(rows.Registrations[3][RH.indexOf('Source_Channel')],'WEBSITE_RSVP_MARKETING_ONLY');
assert.equal(rows.Registrations[3][RH.indexOf('Email')],'ada@example.test');
assert.equal(rows.Registrations[3][RH.indexOf('Phone_Number')],'');
assert.equal(rows.Registrations[3][RH.indexOf('Guardian_Phone')],'');
assert.equal(rows.Registrations[3][RH.indexOf('Photo_Consent')],'');
assert.equal(rows.Registrations[3][RH.indexOf('RSVP_Status')],'');
assert.equal(rows.Registrations[3][RH.indexOf('Marketing_Consent')],'yes');
assert.equal(rows.Registrations[3][RH.indexOf('Event_ID')],'','Marketing-only row must not reveal earlier event');
rows.Events[1][EH.indexOf('Start_DateTime')]=savedEventDate;
rows.Registrations[3][RH.indexOf('Retention_Until')]=new Date('2000-01-01');
const cleanup=context.cleanupUniversalRegistrations();
assert.equal(cleanup.purged,1);
assert.equal(rows.Registrations[3][RH.indexOf('Email')],'');
assert.equal(rows.Registrations[3][RH.indexOf('Source_Channel')],'WEBSITE_RSVP_PURGED');
assert.equal(rows.Registrations[3][RH.indexOf('Event_ID')],'','Expired row must not retain event linkage');
console.log('Universal portal: required fields, 4 locales, active-only events, private duplicate immutability, minors, separate consents, minimal retention and injection boundaries (synthetic fixtures).');
