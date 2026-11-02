'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const file=p=>fs.readFileSync(p,'utf8');
const join=file('druzina/join/index.html');
const start=file('druzina/start/index.html');
const form=file('druzina/prihlaska/index.html');
const edge=file('supabase/functions/imperion-register/index.ts');
test('Recruitment join page uses first-visit form rather than news detour',()=>{
  assert.match(join,/id="startNow"[^>]*href="\.\.\/prihlaska\/\?lang=cs&amp;src=JOIN"/);
  assert.match(join,/getElementById\('startNow'\)\.href='\.\.\/prihlaska\/\?lang='/);
  assert.match(join,/encodeURIComponent\(accepted\?source:'JOIN'\)/);
});
test('First-meeting page gives all languages a real form CTA and retains public optional news link',()=>{
  assert.match(start,/id="enquiryCta"[^>]*href="\.\.\/prihlaska\/\?lang=en&amp;src=START"/);
  assert.match(start,/getElementById\('enquiryCta'\)\.href='\.\.\/prihlaska\/\?lang='/);
  assert.equal((start.match(/enquiryCta:'[^']+'/g)||[]).length,4);
  assert.match(start,/id="action" href="https:\/\/chat\.whatsapp\.com\//);
  assert.match(start,/id="introCta"/);
});
test('Actual first visit form forwards bounded non-sensitive campaign tags',()=>{
  assert.match(form,/acquisitionTag=\/\^\[A-Za-z0-9_-\]\{1,32\}\$\//);
  assert.match(form,/intent:'DRUZINA_ENQUIRY'/);
  assert.match(form,/acquisitionSource:acquisitionTag/);
  assert.match(form,/adultConfirmed:/);
  assert.match(form,/safety:/);
});
test('Existing first-visit intake stores bounded source in existing private enquiry row; no booking',()=>{
  assert.match(edge,/const rawAcquisition=String\(body\.acquisitionSource\|\|'DIRECT'\)/);
  assert.match(edge,/const source=\/\^\[A-Za-z0-9_-\]\{1,32\}\$\//);
  assert.match(edge,/source:entry\.source==='DIRECT'\?'site-druzina-first-visit'/);
  assert.match(edge,/status:'RECEIVED_UNCONFIRMED'/);
  assert.match(edge,/confirmed:false/);
});
