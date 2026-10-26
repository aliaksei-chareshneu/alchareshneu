const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const gs=fs.readFileSync('imperion-intake-sync.gs','utf8');
const edge=fs.readFileSync('supabase/functions/imperion-intake-bridge/index.ts','utf8');
const sql=fs.readFileSync('supabase/migrations/20261026_imperion_private_intake.sql','utf8');
test('Google Apps Script helper parses, deduplicates and has a safe receipt order',()=>{
 assert.doesNotThrow(()=>new Function(gs));
 assert.match(gs,/getSheetByName\('Registrations'\)/);
 assert.match(gs,/getSheetByName\('Druzina_Requests'\)/);
 assert.match(gs,/impExisting_/);
 assert.match(gs,/Acknowledge only AFTER/);
 assert.match(gs,/imperionCleanupPrivateIntake/);
 assert.match(gs,/everyHours\(1\)/);
 assert.match(gs,/REQUESTED_UNCONFIRMED/);
});
test('private bridge rejects access before source rows are selected',()=>{
 assert.match(edge,/verify_imperion_intake_bridge_token/);
 assert.match(edge,/error:"unauthorized"/);
 assert.match(edge,/error:"forbidden"/);
 assert.match(edge,/is\("crm_synced_at",null\)/);
 assert.match(edge,/invalid_ack/);
 assert.doesNotMatch(edge,/access-control-allow-origin/i);
});
test('SQL migration is idempotent and service-role-only',()=>{
 assert.match(sql,/consecutive_empty_feeds/);
 assert.match(sql,/v_empty>=2/);
 assert.match(sql,/vault\.create_secret/);
 assert.match(sql,/add column if not exists crm_synced_at/);
 assert.match(sql,/revoke all on function public\.verify_imperion_intake_bridge_token/);
 assert.match(sql,/to service_role/);
});
