'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const cp=require('node:child_process');
const A=require('../scripts/imperion-dev-autonomous.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const dir='ops/imperion-dev-cloud-fixture';
const files=[
 dir+'/multi-price.cjs',
 dir+'/multi-shipping.cjs',
 dir+'/multi-discount.cjs'
];
const trusted='tests/imperion-dev-cloud-three-fixture.test.cjs';
const goal='Clarify only the full-line helper comments while preserving exports and all existing results.';
const COMMAND='/imperion-dev autonomous\nscope: '+dir+'\ntest: '+trusted+'\ngoal: '+goal;
const evt={action:'created',repository:{full_name:W.REPO},sender:{login:'aliaksei-chareshneu'},
 issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
 comment:{id:713131,body:COMMAND,author_association:'OWNER',user:{login:'aliaksei-chareshneu'}}};
function fixtureRoot(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'dev-three-'));
 for(const f of [...files,trusted]){
  const dest=path.join(root,f);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(path.join(__dirname,'..',f),dest);
 }
 fs.writeFileSync(path.join(root,'owner-event.json'),JSON.stringify(evt),'utf8');
 return root;
}
function mock(){
 const seen=[];
 const comments=new Map([
  [files[0],'// Public synthetic fixture, not application pricing logic.'],
  [files[1],'// Public synthetic fixture, not an actual shipping offer.'],
  [files[2],'// Public synthetic arithmetic fixture; not a real discount or payment offer.']
 ]);
 const fetchImpl=async(url,request)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/generate');
  const input=JSON.parse(request.body);
  seen.push(input.prompt);
  let answer;
  if(input.prompt.includes('Select one, two, or three existing PUBLIC modules')){
   answer={files};
  }else if(input.prompt.includes('You are a careful coding assistant editing ONE PUBLIC')){
   const payload=JSON.parse(input.prompt.split('SOURCE_JSON:').pop());
   assert.ok(comments.has(payload.file));
   assert.equal(payload.related_public_sources.length,2);
   assert.equal(payload.trusted_test_excerpt.includes('assert.equal'),true);
   answer={old:comments.get(payload.file),
    new:'// Public synthetic math fixture with unchanged behavior and tests.'};
  }else if(input.prompt.includes('Suggest ONLY JSON data for a human-review advisory')){
   answer={file:files[0],export:'netPrice',cases:[
    {name:'three_file_green',args:[13,3],expected:39}]};
  }else throw Error('MOCK_UNEXPECTED_MODEL_PROMPT');
  return {ok:true,redirected:false,json:async()=>({
   done:true,model:W.MODEL,response:JSON.stringify(answer)
  })};
 };
 return {fetchImpl,seen};
}
test('owner contract can select THREE existing test-linked public source files with exact hashes',async()=>{
 const root=fixtureRoot();
 const old=process.env.GITHUB_EVENT_PATH;
 process.env.GITHUB_EVENT_PATH=path.join(root,'owner-event.json');
 try{
  const task=A.taskFromEvent(evt);
  const c=A.candidateSources(task,root);
  assert.deepEqual(c.files.map(x=>x.file).sort(),files.slice().sort());
  const m=mock();
  const p=await A.propose(task,root,m.fetchImpl);
  assert.equal(m.seen.length,5,'one selection, three patches, one advisory');
  assert.equal(p.sources.length,3);
  assert.deepEqual(p.selected,files);
  assert.equal(A.requiresBehaviorWitness(p,root),false);
  const v=A.verifyManifest(p,root);
  assert.equal(v.updates.length,3);
  assert.equal(v.test.file,A.generatedPath(task));
  assert.ok(!fs.existsSync(path.join(root,p.generated_file)));
  const staged=A.apply(p,root);
  assert.deepEqual(staged.files,[...files,p.generated_file]);
  for(const f of files)assert.match(fs.readFileSync(path.join(root,f),'utf8'),/unchanged behavior/);
  const env={...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result=cp.spawnSync(process.execPath,['--test',trusted,p.generated_file],
    {cwd:root,encoding:'utf8',env,timeout:15000});
  assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
  assert.match(result.stdout,/# fail 0/);
 }finally{
  if(old===undefined)delete process.env.GITHUB_EVENT_PATH;else process.env.GITHUB_EVENT_PATH=old;
  fs.rmSync(root,{recursive:true,force:true});
 }
});
test('bad scope, duplicate third path, legacy file3 and fourth file fail before model access',async()=>{
 const root=fixtureRoot();
 try{
  const task=A.parseCommand(COMMAND);
  const candidates=A.candidateSources(task,root);
  for(const selection of [
   {files:[...files,files[0]]},{files:[files[0],files[0],files[1]]},
   {files:[files[0],files[1],trusted]},{files:[files[0],files[1],'/etc/passwd']}
  ])assert.throws(()=>A.validateSelection(selection,candidates.files),
    /AUTO_FILE_SELECTION_REJECTED/);
  await assert.rejects(()=>W.propose({file:files[0],file2:files[1],
   file3:files[2],test:trusted,goal,mode:'OWNER_ISSUE'},root,
   async()=>{throw Error('MUST_NOT_CALL')}),/MULTI_SOURCE_PATH_REJECTED/);
  await assert.rejects(()=>W.propose({file:files[0],file2:files[0],
   file3:files[2],test:trusted,goal,mode:'AUTO_OWNER_ISSUE'},root,
   async()=>{throw Error('MUST_NOT_CALL')}),/MULTI_SOURCE_PATH_REJECTED/);
  await assert.rejects(()=>W.propose({file:files[0],file2:files[1],
   file3:files[2],file4:'scripts/private.cjs',test:trusted,goal,
   mode:'AUTO_OWNER_ISSUE'},root,async()=>{throw Error('MUST_NOT_CALL')}),
   /MULTI_SOURCE_PATH_REJECTED/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('three-file publisher preserves all selected independent tested paths',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 assert.match(s,/p\.selected\.length>3/);
 assert.match(s,/p\.selected\.every\(x=>W\.safeSourceFile\(x\)\)/);
 assert.match(s,/\.sort\(\)\.join\("\\n"\)/);
 assert.match(s,/gh pr create --draft/);
 assert.doesNotMatch(s,/gh pr merge|git push origin main/);
});
