'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const B=require('../scripts/imperion-dev-bootstrap.cjs');
const W=require('../scripts/imperion-dev-cloud-issue.cjs');
const F=B.FIXTURE_FILE,T=B.FIXTURE_TEST;
const code="'use strict';\n// Synthetic pure module, not user pricing.\nfunction bonusPoints(base,extra){return base+extra;}\nmodule.exports={bonusPoints};\n";
function root(){
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'dev-new-module-'));
 const testPath=path.join(work,T);
 fs.mkdirSync(path.dirname(testPath),{recursive:true});
 fs.mkdirSync(path.join(work,path.dirname(F)),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'..',T),testPath);
 return work;
}
const evt={action:'created',repository:{full_name:W.REPO},
 issue:{number:245,state:'open',user:{login:'aliaksei-chareshneu'}},
 sender:{login:'aliaksei-chareshneu'},
 comment:{id:87123321,author_association:'OWNER',user:{login:'aliaksei-chareshneu'},
  body:'/imperion-dev bootstrap\nfile: '+F+'\ntest: '+T+'\ngoal: '+B.FIXTURE_GOAL}};
function mocked(){
 let calls=0;
 const fetchImpl=async(url,request)=>{
  assert.equal(url,'http://127.0.0.1:11434/api/generate');
  const input=JSON.parse(request.body);calls++;
  let answer;
  if(input.prompt.includes('Create exactly one NEW PUBLIC CommonJS module'))
   answer={source:code};
  else if(input.prompt.includes('Suggest ONLY JSON data for a fixed trusted advisory test'))
   answer={file:F,export:'bonusPoints',
    cases:[{name:'positive_sum',args:[7,3],expected:10},
           {name:'negative_delta',args:[8,-3],expected:5}]};
  else throw Error('UNKNOWN_BOOTSTRAP_PROMPT');
  return {ok:true,redirected:false,json:async()=>({done:true,model:W.MODEL,response:JSON.stringify(answer)})};
 };
 return {fetchImpl,get calls(){return calls}};
}
test('new public module created from existing independent failing oracle, with advisory after patch',async()=>{
 const home=root();
 const before=process.env.GITHUB_EVENT_PATH;
 process.env.GITHUB_EVENT_PATH=path.join(home,'event.json');
 fs.writeFileSync(process.env.GITHUB_EVENT_PATH,JSON.stringify(evt));
 try{
  const task=B.taskFromEvent(evt);
  assert.equal(task.file,F);
  B.trustedContext(task,home);
  const env={...process.env,IMPERION_DEV_BOOTSTRAP_ACCEPTANCE:'1'};
  delete env.NODE_TEST_CONTEXT;
  const baseline=cp.spawnSync(process.execPath,['--test',T],{cwd:home,env,encoding:'utf8',timeout:12000});
  assert.notEqual(baseline.status,0,baseline.stdout);
  assert.match(baseline.stderr+baseline.stdout,/Cannot find module/);
  const model=mocked();
  const proposal=await B.propose(task,home,model.fetchImpl);
  assert.equal(model.calls,2);
  assert.equal(proposal.model,W.MODEL);
  assert.equal(proposal.task.file,F);
  assert.equal(proposal.generated_test_not_independent,true);
  assert.equal(proposal.auto_merge,false);
  assert.equal(B.verifyManifest(proposal,home).source,code);
  assert.equal(fs.existsSync(path.join(home,F)),false);
  const result=B.apply(proposal,home);
  assert.equal(result.status,'BOOTSTRAP_STAGED_PENDING_DOCKER');
  assert.equal(fs.existsSync(path.join(home,F)),true);
  const checked=cp.spawnSync(process.execPath,['--check',F],{cwd:home,env,encoding:'utf8',timeout:10000});
  assert.equal(checked.status,0,checked.stderr);
  const testRun=cp.spawnSync(process.execPath,['--test',T,proposal.generated_file],
   {cwd:home,env,encoding:'utf8',timeout:12000});
  assert.equal(testRun.status,0,testRun.stderr+'\n'+testRun.stdout);
  assert.match(testRun.stdout,/# fail 0/);
 }finally{
  if(before===undefined)delete process.env.GITHUB_EVENT_PATH;
  else process.env.GITHUB_EVENT_PATH=before;
  fs.rmSync(home,{recursive:true,force:true});
 }
});
test('rejects unauthorized issue, tampered proof and non-independent or absent tests',async()=>{
 const home=root();
 const before=process.env.GITHUB_EVENT_PATH;
 process.env.GITHUB_EVENT_PATH=path.join(home,'event.json');
 fs.writeFileSync(process.env.GITHUB_EVENT_PATH,JSON.stringify(evt));
 try{
  for(const mutated of [
   {...evt,sender:{login:'someoneelse'}},
   {...evt,comment:{...evt.comment,user:{login:'attacker'}}},
   {...evt,comment:{...evt.comment,author_association:'COLLABORATOR'}},
   {...evt,issue:{...evt.issue,pull_request:{}}},
   {...evt,action:'edited'}
  ])assert.throws(()=>B.taskFromEvent(mutated),/BOOTSTRAP_UNTRUSTED_EVENT_REJECTED/);
  const p=await B.propose(B.taskFromEvent(evt),home,mocked().fetchImpl);
  assert.throws(()=>B.verifyManifest({...p,source:p.source+'// tampered\n'},home),
   /BOOTSTRAP_SOURCE_HASH_CHANGED/);
  assert.throws(()=>B.verifyManifest({...p,generated_sha256:'wrong'},home),
   /BOOTSTRAP_ADVISORY_HASH_CHANGED/);
  assert.throws(()=>B.verifyManifest({...p,task:{...p.task,file:'ops/other.cjs'}},home),
   /BOOTSTRAP_TASK_EVENT_MISMATCH/);
  fs.appendFileSync(path.join(home,T),'// source of truth modified\n');
  assert.throws(()=>B.verifyManifest(p,home),/BOOTSTRAP_TRUSTED_TEST_CHANGED/);
 }finally{
  if(before===undefined)delete process.env.GITHUB_EVENT_PATH;
  else process.env.GITHUB_EVENT_PATH=before;
  fs.rmSync(home,{recursive:true,force:true});
 }
});
test('rejects malicious generated code, side effects, privileged code and missing owner test',()=>{
 for(const raw of [
  "const fs=require('node:fs');\nmodule.exports={f(){return fs.readFileSync('x');}};",
  "'use strict';\nasync function nope(){return fetch('https://bad.example');}\nmodule.exports={nope};",
  "'use strict';\nfunction nope(){while(true){}}\nmodule.exports={nope};",
  "'use strict';\nconst token=process.env.GITHUB_TOKEN;\nfunction f(){return token;}\nmodule.exports={f};",
  "'use strict';\nfunction f(x){return x.constructor;}\nmodule.exports={f};",
  "'use strict';\nfunction f(x){return x;}\nmodule.exports={f};\n<END>",
  'NOT JSON',
 ]){
  assert.throws(()=>B.validateSource({source:raw}),/BOOTSTRAP_UNSAFE_SOURCE_REJECTED/);
 }
 assert.throws(()=>B.parseCommand(evt.comment.body.replace('multi-bonus.cjs','.env.cjs')),
  /BOOTSTRAP_PATH_SCOPE_REJECTED|BOOTSTRAP_COMMAND_FORMAT_REJECTED/);
 const home=root();
 try{
  const task=B.parseCommand(evt.comment.body);
  fs.writeFileSync(path.join(home,F),'not a new module');
  assert.throws(()=>B.trustedContext(task,home),/BOOTSTRAP_TARGET_EXISTS_OR_ESCAPE/);
 }finally{fs.rmSync(home,{recursive:true,force:true})}
});
test('bootstrap artifact/publisher remains PR review-only and uses verified model/provider',()=>{
 const y=fs.readFileSync(path.join(__dirname,'../.github/workflows/imperion-dev-cloud-issue.yml'),'utf8');
 assert.match(y,/imperion-dev-bootstrap\.cjs --check-event/);
 assert.match(y,/imperion-dev-bootstrap\.cjs --event/);
 assert.match(y,/imperion-dev-bootstrap-qa\.sh/);
 assert.match(y,/imperion-dev-bootstrap-publish\.sh/);
 const qa=fs.readFileSync(path.join(__dirname,'../scripts/imperion-dev-bootstrap-qa.sh'),'utf8');
 const publish=fs.readFileSync(path.join(__dirname,'../scripts/imperion-dev-bootstrap-publish.sh'),'utf8');
 assert.match(qa,/BOOTSTRAP_TRUSTED_AND_ADVISORY_TESTS_PASS/);
 assert.match(qa,/IMPERION_DEV_BOOTSTRAP_ACCEPTANCE=1/);
 assert.match(qa,/--network none --read-only --cap-drop ALL/);
 assert.match(publish,/gh pr create --draft/);
 assert.match(publish,/B\.verifyManifest/);
 assert.doesNotMatch(y+qa+publish,/gh pr merge|git push origin main/);
});
