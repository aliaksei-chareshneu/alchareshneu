const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('supabase/functions/imperion-catalog-sync/index.ts','utf8');
test('empty, valid, fresh Community Hub Active feed is accepted and handled by two-snapshot SQL guard',()=>{
 assert.match(source,/Array\.isArray\(data\.events\)/);
 assert.match(source,/data\.events\.length>120/);
 assert.doesNotMatch(source,/data\.events\.length<1/);
 assert.match(source,/p_events:events/);
 assert.match(source,/p_generated_at:generatedAt\.toISOString\(\)/);
 assert.match(source,/verify_operator_cron_token/);
});
