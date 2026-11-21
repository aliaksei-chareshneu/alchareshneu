const assert=require('node:assert/strict');
const fs=require('node:fs');

const read=p=>fs.readFileSync(p,'utf8');
const VERSION='2026-11-15-property-v1';
const rsvp=read('register/index.html');
const quote=read('register/training-payment.js');
const backend=read('supabase/functions/imperion-register/index.ts');
const policy=read('register/property/index.html');
const rules=read('druzina/rules/index.html');
const safety=read('druzina/safety/index.html');

assert.match(rsvp, /<input id="propertyCare" type="checkbox" required>/, 'separate mandatory property checkbox');
assert.match(rsvp, /<a href="\.\/property\/"/, 'readable policy linked beside checkbox');
assert.equal((rsvp.match(/propertyHead:'/g)||[]).length,4, 'four translated labels');
assert.equal((rsvp.match(/propertyNote:'/g)||[]).length,4, 'four translated descriptions');
assert.equal((rsvp.match(/propertyLink:'/g)||[]).length,4, 'four translated policy links');
assert.match(rsvp, /propertyCare:\$\('propertyCare'\)\.checked,propertyRulesVersion:'2026-11-15-property-v1'/, 'RSVP sends independent acknowledgment');
assert.match(quote, /propertyCare:\$\('propertyCare'\)\.checked,propertyRulesVersion:'2026-11-15-property-v1'/, 'private quote sends terms even when resuming payment');
assert.match(backend,/body\.propertyCare!==true \|\| body\.propertyRulesVersion!==PROPERTY_RULES_VERSION/, 'enquiry required acknowledgment');
assert.match(backend,/if \(body\.safety!==true \|\| body\.propertyCare!==true \|\|/, 'RSVP rejects missing acknowledgment');
assert.equal((backend.match(/safety_version:PROPERTY_RULES_VERSION/g)||[]).length,2,'both independent intake paths persist version in existing records');
assert.ok(backend.includes("const PROPERTY_RULES_VERSION = '"+VERSION+"'"));
for(const lang of ['cs','en','ru','uk']){
 assert.ok(policy.includes('lang="'+lang+'" id="'+lang+'"'),'public rule has '+lang);
 assert.ok(rules.includes('id="'+lang+'"'),'club rules have '+lang);
 assert.ok(safety.includes('id="'+lang+'"'),'safety guide has '+lang);
}
assert.match(policy, /does not automatically transfer another person's liability/, 'no illegal blanket waiver');
assert.match(policy, /For minors/, 'minors are addressed');
assert.match(policy, /after publication/, 'no retroactive application');
assert.doesNotMatch(policy,/<input.*marketing.*required/, 'not a bundled GDPR consent');
console.log('PASS: property care checkbox, 4 languages, versioned server evidence, no blanket waiver');
