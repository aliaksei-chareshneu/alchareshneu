'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {calculate,FEE_CZK}=require('../corporate/diagnostic/estimator.js');
const html=fs.readFileSync(path.join(__dirname,'../corporate/diagnostic/index.html'),'utf8');
const script=fs.readFileSync(path.join(__dirname,'../corporate/diagnostic/estimator.js'),'utf8');
test('default scenario includes human review and yields 12 hours, not fabricated cash',()=>{
 const a=calculate({volume:80,before:20,after:11,hourly:450});
 assert.equal(a.valid,true);
 assert.equal(a.savedHours,12);
 assert.equal(a.capacityValue,5400);
 assert.equal(FEE_CZK,14900);
 assert.equal(a.noTimeSaving,false);
});
test('no saving when AI+review costs as much or more time',()=>{
 const a=calculate({volume:100,before:10,after:15,hourly:200});
 assert.equal(a.savedHours,0);
 assert.equal(a.capacityValue,0);
 assert.equal(a.paybackMonths,null);
 assert.equal(a.noTimeSaving,true);
});
test('zero tasks and no internal value produce no payback',()=>{
 for(const i of [{volume:0,before:30,after:2,hourly:200},{volume:30,before:30,after:2,hourly:0}])
 assert.equal(calculate(i).paybackMonths,null);
});
test('invalid numbers and extreme inputs are rejected, not NaN revenue',()=>{
 for(const i of [
  {volume:-1,before:10,after:1,hourly:250},
  {volume:1.5,before:10,after:1,hourly:250},
  {volume:200000,before:10,after:1,hourly:250},
  {volume:100,before:Infinity,after:1,hourly:250},
  {volume:100,before:10,after:NaN,hourly:250},
  {volume:100,before:10,after:1,hourly:-1}
 ])assert.equal(calculate(i).valid,false);
});
test('page is staging-only and reuses approved existing CRM intake',()=>{
 assert.match(html,/robots" content="noindex,nofollow"/);
 assert.match(html,/service=DATA_PILOT/);
 assert.match(html,/src=ai_workflow_diagnostic/);
 assert.match(html,/\.\.\/request\//);
 assert.match(html,/estimator\.js/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/Imperion/);
});
test('client calculator has four languages but no API, cookie or storage calls',()=>{
 for(const l of ['cs:','en:','ru:','uk:'])assert.ok(script.includes(l));
 assert.doesNotMatch(script,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|sendBeacon|document\.cookie/);
});
