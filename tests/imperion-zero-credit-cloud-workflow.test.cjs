'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const y=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/imperion-zero-credit-cloud-review.yml'),'utf8');
test('public repository uses no paid model, Work credits or customer credentials',()=>{
 assert.match(y,/permissions:\s*\n\s*contents: read/);
 assert.match(y,/persist-credentials: false/);
 assert.doesNotMatch(y,/GROQ_API_KEY|OPENROUTER_API_KEY|SUPABASE_SERVICE_ROLE|STRIPE_SECRET|secrets\./);
 assert.match(y,/ollama pull qwen3:4b-instruct/);
 assert.match(y,/node scripts\/imperion-zero-credit-cloud-review\.cjs/);
 assert.doesNotMatch(y,/curl.+api\.groq\.com|curl.+openrouter\.ai/);
});
test('public model pin and cache exclude generated private identity key',()=>{
 assert.match(y,/ollama\/ollama@sha256:[a-f0-9]{64}/);
 assert.match(y,/path: \.ollama-models\/models/);
 assert.doesNotMatch(y,/path: \.ollama-models\s*\n/);
 assert.match(y,/sudo chown -R/);
 assert.match(y,/chmod -R u\+rwX/);
});
test('ephemeral CPU model never exposes listening port outside loopback',()=>{
 assert.match(y,/-p 127\.0\.0\.1:11434:11434/);
 assert.match(y,/--cpus=2/);
 assert.match(y,/docker rm -f imperion-qwen \|\| true/);
 assert.match(y,/if: always\(\)/);
 assert.match(y,/retention-days: 3/);
});
