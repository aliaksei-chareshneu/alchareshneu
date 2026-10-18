"use strict";
// Synthetic, offline tests. NEVER contact Google or send participant messages.
// Run: node scripts/test-event-rsvp.cjs
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");

const now = Date.now();
const future = new Date(now + 3 * 86400000);
const expired = new Date(now - 3 * 86400000);
const eventHeaders = [
  "Event_ID", "Status", "Community", "Category", "Title", "Start_DateTime",
  "End_DateTime", "Price_CZK", "Tally_Form_URL"
];
const events = [
  eventHeaders,
  ["EVT-YES", "Active", "Brnowalkers", "Hike", "Test Hike", future, future, 0, ""],
  ["EVT-SYNC", "Trigger_Sync", "Družina Moravy", "HEMA Training", "Fencing Trial", future, future, 120, ""],
  ["EVT-DRAFT", "Draft", "Brnowalkers", "Board Games", "Hidden", future, future, 0, ""],
  ["EVT-CORP", "Active", "Shared", "Corporate", "Internal", future, future, 0, ""],
  ["EVT-PAST", "Active", "Brnowalkers", "Hike", "Past", expired, expired, 0, ""]
];
const regHeaders = [
  "Reg_ID","Event_ID","Timestamp","Full_Name","Telegram_Handle","Phone_Number",
  "Age","Guardian_Name","Guardian_Phone","Guardian_Relationship",
  "Child_Name","Child_Age","Emergency_Contact_Name","Emergency_Contact_Phone",
  "Medical_Conditions","Equipment_Note","Photo_Consent","Waiver_Accepted",
  "Payment_Reference","Retention_Until","Submission_ID","RSVP_Status",
  "RSVP_Status_At","Payment_Status","Last_Reminder_At","Check_In_At",
  "Reply_Contact","Source_Channel"
];
const registrations = [regHeaders, ["INSTRUCTION"], ["INSTRUCTION"]];
function sheet(table) {
  return {
    getDataRange() { return {getValues: () => table.map(r => r.slice())}; },
    getLastRow() { return table.length; },
    getLastColumn() { return table[0].length; },
    getRange(r,c,height=1,width=1) {
      return {
        getValues: () => Array.from({length:height}, (_,i) =>
          Array.from({length:width}, (_,j) => (table[r+i-1]||[])[c+j-1]||"")),
        getValue: () => (table[r-1] || [])[c-1],
        setValue(value) {
          if (!table[r-1]) table[r-1] = [];
          table[r-1][c-1] = value;
        },
        setValues(values) {
          values.forEach((line,i) => {
            if (!table[r+i-1]) table[r+i-1] = [];
            line.forEach((value,j) => { table[r+i-1][c+j-1] = value; });
          });
        }
      };
    }
  };
}
const sheets = {Events:sheet(events),Registrations:sheet(registrations)};
const choices = {values:[],updateCount:0};
const labelItem = {
  getTitle: () => "Event",
  asListItem() {return this;},
  setChoiceValues(v) { choices.values = v; choices.updateCount++; return this; },
  createResponse(v) {
    assert(choices.values.includes(v), "prefill choice must be installed first");
    return {value:v};
  }
};
const responses = new Set();
const form = {
  getItems:()=>[labelItem],
  setAcceptingResponses() {},
  createResponse() { return {withItemResponse(r) {
    return {toPrefilledUrl:()=> "https://docs.google.com/forms/test?event=" + encodeURIComponent(r.value)};
  }};},
  deleteResponse(id) {responses.delete(id);},
  getResponses() {return [...responses].map(id=>({getId:()=>id}));}
};
const properties = {EVENT_RSVP_FORM_ID:"form-test"};
const ctx = {
  Date, console,
  SPREADSHEET_ID:"synthetic", EVENTS_SHEET_NAME:"Events",
  REGISTRATIONS_SHEET_NAME:"Registrations",
  SpreadsheetApp:{openById:()=>({getSheetByName:name=>sheets[name]})},
  FormApp:{openById:()=>form},
  PropertiesService:{getScriptProperties:()=>({
    getProperty:k=>properties[k]||"",
    setProperty:(k,v)=>{properties[k]=v;}
  })},
  LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  Utilities:{formatDate:()=> "30.10.2026 10:00",getUuid:()=> "synthetic-" + (registrations.length-2)}
};
vm.createContext(ctx);
const filename=path.resolve(__dirname,"..","automation","EventRsvp.gs");
vm.runInContext(fs.readFileSync(filename,"utf8"),ctx,{filename});
assert.equal(ctx.eventRsvpNorm_("'+420 700 100"),"+420700100");
assert.equal(ctx.eventRsvpClean_("+420 700")[0],"'");
const offered = ctx.eventRsvpItems_();
assert.equal(offered.length,2);
assert(offered.some(x=>x.id==="EVT-SYNC"));
assert(!offered.some(x=>x.id==="EVT-CORP"||x.id==="EVT-DRAFT"||x.id==="EVT-PAST"));

const url=ctx.eventRsvpPrefilledUrl("EVT-SYNC");
assert.match(url,/EVT-SYNC/);
assert(choices.updateCount>0);

function submit(id,eventId,name,contact,answer,minor=false,guardian=false) {
  const data={
    Event:ctx.eventRsvpLabel_(offered.find(x=>x.id===eventId)),
    Full_Name:name,
    Reply_Contact:contact,
    RSVP_Answer:answer,
    Age_Group:minor?"Under 18":"18+",
    Privacy_Ack:["agreed"],
    Guardian_Name:guardian?"Parent Example":"",
    Guardian_Contact:guardian?"+420 777 123 456":""
  };
  const response={
    getId:()=>id,
    getItemResponses:()=>Object.entries(data).map(([key,val])=>({
      getItem:()=>({getTitle:()=>key}),getResponse:()=>val
    }))
  };
  responses.add(id);
  ctx.onEventRsvpSubmit({response});
}
submit("resp-1","EVT-SYNC","Adult Test","+420 777 100 100","YES - I plan to come");
assert.equal(registrations.length,4,"one new canonical row");
let rec=registrations[3];
assert.equal(rec[regHeaders.indexOf("RSVP_Status")],"CONFIRMED");
assert.equal(rec[regHeaders.indexOf("Payment_Status")],"PENDING");
assert.equal(rec[regHeaders.indexOf("Waiver_Accepted")],"");
assert.equal(rec[regHeaders.indexOf("Source_Channel")],"RSVP_FORM");

submit("resp-2","EVT-SYNC","Adult Test","+420 777 100 100","NO - cannot come");
assert.equal(registrations.length,4,"resubmission updates same row");
rec=registrations[3];
assert.equal(rec[regHeaders.indexOf("RSVP_Status")],"DECLINED");
assert.equal(rec[regHeaders.indexOf("Submission_ID")],"resp-2");

submit("resp-2","EVT-SYNC","Adult Test","+420 777 100 100","YES - I plan to come");
assert.equal(registrations[3][regHeaders.indexOf("RSVP_Status")],"DECLINED","replay does not change status");

submit("minor-1","EVT-YES","Minor Test","minor@example.test","YES - I plan to come",true,true);
assert.equal(registrations.length,5);
assert.equal(registrations[4][regHeaders.indexOf("RSVP_Status")],"REGISTERED",
  "minor may not self-confirm even with guardian text");
assert.equal(registrations[4][regHeaders.indexOf("Payment_Status")],"NOT_REQUIRED");

registrations[3][regHeaders.indexOf("RSVP_Status")]="ATTENDED";
submit("resp-3","EVT-SYNC","Adult Test","+420 777 100 100","NO - cannot come");
assert.equal(registrations[3][regHeaders.indexOf("RSVP_Status")],"ATTENDED","real attendance remains authoritative");
registrations[3][regHeaders.indexOf("Retention_Until")] = new Date(now-86400000);
const cleaned=ctx.cleanupEventRsvp();
assert.equal(cleaned,"PURGED=1");
assert.equal(registrations[3][regHeaders.indexOf("Full_Name")],"—");
assert.equal(registrations[3][regHeaders.indexOf("Reply_Contact")],"—");
assert.equal(registrations[3][regHeaders.indexOf("Event_ID")],"EVT-SYNC");
assert(!responses.has("resp-2"),"Form response deleted");

console.log("Event RSVP synthetic tests passed");
