'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const child=require('node:child_process');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const COMMAND='/imperion-dev autonomous\nscope: ops/imperion-dev-cloud-fixture\ntest: tests/imperion-dev-cloud-multi-fixture.test.cjs\ngoal: Clarify the public pricing helper comment while preserving the existing outputs.';
const event={action:'created',repository:{full_name:W.REPO},
 issue:{number:293,state:'open',user:{login:'aliaksei-chareshneu'}},
 sender:{login:'aliaksei-chareshneu'},
 comment:{id:123456,body:COMMAND,author_association:'OWNER',
  user:{login:'aliaksei-chareshneu'}}};
function workspace(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'imperion-auto-unit-'));
 fs.mkdirSync(path.join(root,'ops/imperion-dev-cloud-fixture'),{recursive:true});
 fs.mkdirSync(path.join(root,'tests'),{recursive:true});
 for(const f of ['multi-price.cjs','multi-shipping.cjs','normalize.cjs']){
  fs.copyFileSync(path.join(__dirname,'../ops/imperion-dev-cloud-fixture',f),
    path.join(root,'ops/imperion-dev-cloud-fixture',f));
 }
 fs.copyFileSync(path.join(__dirname,'imperion-dev-cloud-multi-fixture.test.cjs'),
  path.join(root,'tests/imperion-dev-cloud-multi-fixture.test.cjs'));
 return root;
}
const price='ops/imperion-dev-cloud-fixture/multi-price.cjs';
const shipping='ops/imperion-dev-cloud-fixture/multi-shipping.cjs';
function mockFetch(){
 const calls=[];
 const fetchImpl=async(_url,opts)=>{
  const input=JSON.parse(opts.body);
  calls.push(input.prompt);
  let response;
  if(input.prompt.includes('Select one or two existing PUBLIC modules')){
   response=JSON.stringify({files:[price]});
  }else if(input.prompt.includes('You are a careful coding assistant editing ONE PUBLIC')){
   response=JSON.stringify({
    old:'// Public synthetic fixture, not application pricing logic.',
    new:'// Public synthetic arithmetic helper, not actual pricing logic.'
   });
  }else if(input.prompt.includes('Suggest ONLY JSON data for a human-review advisory Node test')){
   response=JSON.stringify({file:price,export:'netPrice',
    cases:[{name:'example_one',args:[13,3],expected:39},
           {name:'example_zero',args:[5,0],expected:0}]});
  }else throw Error('UNEXPECTED_MODEL_PROMPT');
  return {ok:true,redirected:false,json:async()=>({
   done:true,model:W.MODEL,response
  })};
 };
 return {calls,fetchImpl};
}
test('strict owner-created issue gate rejects all unauthorized actors',()=>{
 assert.equal(A.taskFromEvent(event).issue,293);
 assert.equal(A.taskFromEvent(event).mode,'AUTO_OWNER_ISSUE');
 for(const change of [
  {sender:{login:'attacker'}},{comment:{...event.comment,user:{login:'attacker'}}},
  {comment:{...event.comment,author_association:'CONTRIBUTOR'}},
  {issue:{...event.issue,user:{login:'other'}}},
  {issue:{...event.issue,state:'closed'}},
  {issue:{...event.issue,pull_request:{}}},
  {repository:{full_name:'other/repo'}},
  {action:'edited'}
 ])assert.throws(()=>A.taskFromEvent({...event,...change}),/AUTO_UNTRUSTED_TRIGGER_REJECTED/);
});
test('scope is public, bounded, no traversal and trusted test is mandatory',()=>{
 const t=A.parseCommand(COMMAND);
 assert.equal(t.scope,'ops/imperion-dev-cloud-fixture');
 for(const body of [
  COMMAND.replace('ops/imperion-dev-cloud-fixture','../.github/workflows'),
  COMMAND.replace('ops/imperion-dev-cloud-fixture','ops/../../other'),
  COMMAND.replace('ops/imperion-dev-cloud-fixture','ops/secrets'),
  COMMAND.replace('tests/imperion-dev-cloud-multi-fixture.test.cjs','ops/test.cjs'),
  COMMAND.replace('goal:','command:'),
  COMMAND+'\nrun anything'
 ])assert.throws(()=>A.parseCommand(body),/AUTO_/);
 const root=workspace();
 try{
  const options=A.candidateSources(t,root);
  assert.deepEqual(options.files.map(x=>x.file),[price,shipping]);
  assert.throws(()=>A.validateSelection({files:[price,'scripts/not-listed.cjs']},options.files),/AUTO_FILE_SELECTION_REJECTED/);
  assert.throws(()=>A.validateSelection({files:[price,price]},options.files),/AUTO_FILE_SELECTION_REJECTED/);
  assert.throws(()=>A.validateSelection({files:[price,shipping,price]},options.files),/AUTO_FILE_SELECTION_REJECTED/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('new advisory test is generated from data-only JSON and cannot inject code',()=>{
 const task={...A.taskFromEvent(event)};
 const draft={file:price,export:'netPrice',cases:[
  {name:'one_case',args:[13,3],expected:39},
  {name:'zero_case',args:[0,3],expected:0}
 ]};
 assert.deepEqual(A.validateTestDraft(draft,[price]),draft);
 const src=A.renderTest(task,draft);
 assert.match(src,/AUTO-GENERATED ADVISORY TEST/);
 assert.match(src,/node:assert\/strict/);
 assert.doesNotMatch(src,/execSync|eval\(|process\.env|GITHUB_TOKEN/);
 assert.equal(A.generatedPath(task),'tests/generated/imperion-dev-auto-293-123456.test.cjs');
 for(const bad of [
  {...draft,export:'constructor'},
  {...draft,file:'scripts/other.cjs'},
  {...draft,cases:[{name:'../escape',args:[],expected:0}]},
  {...draft,cases:[{name:'evil_code',args:[{__proto__:null,command:'delete'}],expected:0}]},
  {...draft,cases:[{name:'evil_case',args:[13],expected:{constructor:'polluted'}}]},
  {...draft,cases:[{name:'evil_case',args:[Infinity],expected:0}]},
  {...draft,cases:Array.from({length:4},(_,i)=>({name:'case_'+i,args:[1],expected:1}))}
 ])assert.throws(()=>A.validateTestDraft(bad,[price]),/AUTO_/);
});
test('model chooses one relevant file, changes it, writes advisory test, and independent test runs',async()=>{
 const root=workspace(),task=A.taskFromEvent(event),m=mockFetch();
 const original=fs.readFileSync(path.join(root,price),'utf8');
 const envfile=path.join(root,'owner-event.json');
 fs.writeFileSync(envfile,JSON.stringify(event));
 const oldenv=process.env.GITHUB_EVENT_PATH;
 process.env.GITHUB_EVENT_PATH=envfile;
 try{
  const p=await A.propose(task,root,m.fetchImpl);
  assert.equal(p.status,'AUTO_MODEL_PROPOSAL_ONLY');
  assert.deepEqual(p.selected,[price]);
  assert.equal(p.sources.length,1);
  assert.equal(p.model,W.MODEL);
  assert.equal(m.calls.length,3);
  assert.equal(fs.readFileSync(path.join(root,price),'utf8'),original,'proposing must not change source');
  const r=A.apply(p,root);
  assert.equal(r.status,'AUTO_STAGED_PENDING_INDEPENDENT_TESTS');
  assert.equal(r.files.length,2);
  assert.match(fs.readFileSync(path.join(root,price),'utf8'),/arithmetic helper/);
  const generated=fs.readFileSync(path.join(root,r.test),'utf8');
  assert.match(generated,/example_one/);
  assert.equal(fs.statSync(path.join(root,r.test)).mode&0o004,0o004);
  const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
  const c=child.spawnSync(process.execPath,['--test',task.test,r.test],{
   cwd:root,encoding:'utf8',env:childEnv,timeout:10000
  });
  assert.equal(c.status,0,c.stderr+'\n'+c.stdout);
  assert.match(c.stdout,/# fail 0/);
  assert.throws(()=>A.apply(p,root),/AUTO_SOURCE_SHA_MISMATCH|AUTO_NEW_TEST_DEST_REJECTED/);
  fs.writeFileSync(path.join(root,price),original);
  assert.throws(()=>A.apply({...p,generated_sha256:'0'.repeat(64)},root),/AUTO_TEST_SHA_MISMATCH/);
  assert.throws(()=>A.apply({...p,selected:[shipping]},root),/AUTO_MANIFEST_SOURCE_ORDER_REJECTED/);
 }finally{
  if(oldenv===undefined)delete process.env.GITHUB_EVENT_PATH;else process.env.GITHUB_EVENT_PATH=oldenv;
  fs.rmSync(root,{recursive:true,force:true});
 }
});
test('tampered source, trusted test or GitHub event never applies',async()=>{
 const root=workspace(),task=A.taskFromEvent(event),m=mockFetch();
 const f=path.join(root,'owner-event.json');
 fs.writeFileSync(f,JSON.stringify(event));
 const prev=process.env.GITHUB_EVENT_PATH;process.env.GITHUB_EVENT_PATH=f;
 try{
  const p=await A.propose(task,root,m.fetchImpl);
  fs.appendFileSync(path.join(root,task.test),'\n// changed after review\n');
  assert.throws(()=>A.verifyManifest(p,root),/AUTO_TRUSTED_TEST_CHANGED/);
  fs.writeFileSync(path.join(root,task.test),
   fs.readFileSync(path.join(__dirname,task.test.split('/').pop()),'utf8'));
  fs.writeFileSync(f,JSON.stringify({...event,issue:{...event.issue,state:'closed'}}));
  assert.throws(()=>A.verifyManifest(p,root),/AUTO_UNTRUSTED_TRIGGER_REJECTED/);
 }finally{
  if(prev===undefined)delete process.env.GITHUB_EVENT_PATH;else process.env.GITHUB_EVENT_PATH=prev;
  fs.rmSync(root,{recursive:true,force:true});
 }
});

test('comment-only owner tasks fail closed on changed function or export bytes',()=>{
 const original=fs.readFileSync(path.join(__dirname,'../'+shipping),'utf8');
 const task={mode:'AUTO_OWNER_ISSUE',goal:'Clarify existing comments without changing exports'};
 assert.equal(W.enforceCommentOnly(task,original,original.replace(
  '// Public synthetic fixture, not an actual shipping offer.',
  '// Public example of subtotal plus delivery costs.')).includes('totalWithDelivery'),true);
 for(const changed of [
  original.replace('module.exports = {totalWithDelivery};','module.exports = {};'),
  original.replace('return subtotal + delivery;','return subtotal;'),
  original.replace('function totalWithDelivery','function wrongFunction')
 ])assert.throws(()=>W.enforceCommentOnly(task,original,changed),/AUTO_COMMENT_SCOPE_CODE_CHANGED/);
 assert.equal(W.enforceCommentOnly({...task,goal:'Correct a functional calculation'},original,
  original.replace('return subtotal + delivery;','return subtotal;')).includes('return subtotal;'),true);
});

test('model receives the trusted JS contract and retries only one destructive edit',async()=>{
 const root=workspace(),task=A.taskFromEvent(event),f=path.join(root,'owner-event.json');
 fs.writeFileSync(f,JSON.stringify(event));
 const original=fs.readFileSync(path.join(root,price),'utf8');
 let patches=0,modeled=0;
 const fetchImpl=async(_u,opts)=>{
  const x=JSON.parse(opts.body),prompt=x.prompt;modeled++;
  let reply;
  if(prompt.includes('Select one or two existing PUBLIC modules')){
   reply=JSON.stringify({files:[price]});
  }else if(prompt.includes('You are a careful coding assistant editing ONE PUBLIC')){
   patches++;
   assert.match(prompt,/trusted_test_excerpt/);
   assert.match(prompt,/netPrice/);
   assert.match(prompt,/Preserve all existing public function names/);
   if(patches===1)reply=JSON.stringify({
    old:'module.exports = {netPrice};',
    new:'module.exports = {};'
   });
   else reply=JSON.stringify({
    old:'// Public synthetic fixture, not application pricing logic.',
    new:'// Public synthetic arithmetic helper, not actual pricing logic.'
   });
  }else if(prompt.includes('Suggest ONLY JSON data for a human-review advisory Node test')){
   reply=JSON.stringify({file:price,export:'netPrice',cases:[
    {name:'item_thirteen',args:[13,3],expected:39}
   ]});
  }else throw Error('UNEXPECTED_MODELED_PROMPT');
  return {ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,response:reply})};
 };
 const before=process.env.GITHUB_EVENT_PATH;process.env.GITHUB_EVENT_PATH=f;
 try{
  const proof=await A.propose(task,root,fetchImpl);
  assert.equal(patches,2);
  assert.equal(modeled,4);
  assert.equal(proof.status,'AUTO_MODEL_PROPOSAL_ONLY');
  assert.equal(proof.sources.length,1);
  assert.equal(fs.readFileSync(path.join(root,price),'utf8'),original,
    'model proposal must never modify worktree');
  const forged={...proof,sources:[{...proof.sources[0],patch:{
   old:'module.exports = {netPrice};',new:'module.exports = {};'
  }}]};
  assert.throws(()=>A.verifyManifest(forged,root),/AUTO_COMMENT_SCOPE_CODE_CHANGED/);
  assert.equal(fs.readFileSync(path.join(root,price),'utf8'),original);
  assert.equal(A.verifyManifest(proof,root).test.file,
    'tests/generated/imperion-dev-auto-293-123456.test.cjs');
 }finally{
  if(before===undefined)delete process.env.GITHUB_EVENT_PATH;
  else process.env.GITHUB_EVENT_PATH=before;
  fs.rmSync(root,{recursive:true,force:true});
 }
});
