'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const front=fs.readFileSync('register/index.html','utf8');
const privacy=fs.readFileSync('register/privacy/index.html','utf8');
const safety=fs.readFileSync('register/safety/index.html','utf8');
const fn=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
for(const id of ['eventId','firstName','lastName','email','phone','safety','photo','future','submit'])
 assert.ok(front.includes('id="'+id+'"'),'missing '+id);
for(const loc of ['cs','en','ru','uk']){
 assert.ok(front.includes('data-lang="'+loc+'"'),'lang missing '+loc);
 assert.ok(privacy.includes('id="'+loc+'"')&&safety.includes('id="'+loc+'"'),'policy missing '+loc);
}
assert.ok(!front.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(front.includes("cache:'no-store'"));
assert.ok(fn.includes('imperion_rsvp_allow_request'));
assert.ok(fn.includes('writeError.code!==\'23505\''));
assert.ok(fn.includes("origin!==ALLOWED_ORIGIN"));
assert.ok(front.includes('id="safety" type="checkbox" required'));
const s=front.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
assert.ok(s);new vm.Script(s[1]);
const start=fs.readFileSync('start/index.html','utf8');
for(const l of ['en','cs','ru','uk']) assert.ok(start.includes('event=PUB-HIKE-20261101&amp;lang='+l),'No registration CTA '+l);
console.log('PASS: event form language, legal links, identity safety, no privileged keys in browser');
