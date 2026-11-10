'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createResultJournal } = require('../ops/imperion-public-result-journal.cjs');
const task = () => ({job_id:'IMP-AI-QUEUE-20261110-001',owner_entity:'OSVC',
 source_url:'https://aliaksei-chareshneu.github.io/alchareshneu/corporate/',
 purpose:'PUBLIC_TRANSLATION_DRAFT',language:'cs'});
const result = () => ({job_id:task().job_id,owner_entity:'OSVC',source_url:task().source_url,
 status:'DRAFT_FOR_OWNER_REVIEW',source_checked:true,owner_approval_required:true,
 provider:'ollama_local',model:'imperion-qwen35:4b',execution_mode:'LOCAL_QWEN_PUBLIC_DRAFT_ONLY',
 source_sha256:'a'.repeat(64),draft:'Public workshop for adults.',
 messages_sent:0,posts_published:0,payments_created:0,external_actions:0});
async function withDir(fn) { const d=await fs.mkdtemp(path.join(os.tmpdir(),'imperion-journal-'));
 try {return await fn(d);}finally{await fs.rm(d,{recursive:true,force:true});}}
test('completed draft is durably replayed across new journal instances',async()=>withDir(async dir=>{
 const a=createResultJournal({directory:dir});
 assert.equal(await a.read(task()),null);
 await a.commit(task(),result());
 assert.deepEqual(await createResultJournal({directory:dir}).read(task()),result());
 assert.deepEqual(await createResultJournal({directory:dir}).commit(task(),result()),result());
 const names=await fs.readdir(dir);assert.equal(names.length,1);
}));
test('same job_id with different allowed task metadata cannot replay',async()=>withDir(async dir=>{
 const j=createResultJournal({directory:dir});await j.commit(task(),result());
 await assert.rejects(j.read({...task(),language:'en'}),/JOURNAL_JOB_ID_COLLISION/);
 await assert.rejects(j.read({...task(),source_url:'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/'}),/JOURNAL_JOB_ID_COLLISION/);
}));
test('truncated or modified receipt blocks instead of returning a draft',async()=>withDir(async dir=>{
 const j=createResultJournal({directory:dir});await j.commit(task(),result());
 const file=path.join(dir,crypto.createHash('sha256').update(task().job_id).digest('hex')+'.json');
 let record=JSON.parse(await fs.readFile(file,'utf8'));
 record.result.draft='Different invented content';
 await fs.writeFile(file,JSON.stringify(record));
 await assert.rejects(j.read(task()),/JOURNAL_RESULT_INTEGRITY_FAILED/);
 await fs.writeFile(file,'not-json');
 await assert.rejects(j.read(task()),/JOURNAL_FILE_UNSAFE|JOURNAL_CORRUPT/);
}));
test('symlinked receipt is refused',async()=>withDir(async dir=>{
 const j=createResultJournal({directory:path.join(dir,'receipts')});
 await j.commit(task(),result());
 const file=path.join(dir,'receipts',crypto.createHash('sha256').update(task().job_id).digest('hex')+'.json');
 await fs.rm(file);await fs.symlink(path.join(dir,'outside.json'),file);
 await assert.rejects(j.read(task()),/JOURNAL_FILE_UNSAFE/);
}));
test('unapproved result, claimed actions and invalid ids are rejected',async()=>withDir(async dir=>{
 const j=createResultJournal({directory:dir});
 await assert.rejects(j.commit(task(),{...result(),messages_sent:1}),/JOURNAL_RESULT_NOT_APPROVED/);
 await assert.rejects(j.commit(task(),{...result(),status:'PUBLISHED'}),/JOURNAL_RESULT_NOT_APPROVED/);
 await assert.rejects(j.commit({...task(),job_id:'../etc'},result()),/JOURNAL_TASK_INVALID/);
 assert.equal((await fs.readdir(dir)).length,0);
}));
