'use strict';
// GitHub Actions model-free review/publish gate. This module NEVER merges or deploys.
const fs=require('node:fs');
const path=require('node:path');
const P=require('./imperion-dev-project-control.cjs');
const R=require('./imperion-dev-project-runner.cjs');
const D=require('./imperion-dev-department.cjs');
const A=require('./imperion-dev-autonomous.cjs');
function block(s){throw Error(s)}
function fileJson(dir,name,maxBytes=35000){
 const full=path.resolve(dir,name),base=path.resolve(dir);
 if(!full.startsWith(base+path.sep))block('PROJECT_PUBLISH_PATH_REJECTED');
 const st=fs.lstatSync(full);
 if(!st.isFile()||st.isSymbolicLink()||st.size>maxBytes)
  block('PROJECT_PUBLISH_FILE_REJECTED');
 return JSON.parse(fs.readFileSync(full,'utf8'));
}
function stageArtifact(dir){
 const proof=fileJson(dir,'imperion-dev-project-stage-proof.json');
 const plan=fileJson(dir,'imperion-dev-project-plan.json');
 if(proof.plan?.plan_sha256!==plan.plan_sha256||
    JSON.stringify(proof.plan)!==JSON.stringify(plan))
  block('PROJECT_PUBLISH_PLAN_RECEIPT_MISMATCH');
 return {proof,plan};
}
function expectedPaths(plan,proposal){
 if(!Array.isArray(proposal?.selected)||proposal.selected.length<1||
    proposal.selected.length>3||!proposal.selected.every(f=>typeof f==='string'))
  block('PROJECT_PUBLISH_SOURCE_SCOPE_REJECTED');
 const stage=proposal.task?.project_stage;
 const arr=[...proposal.selected,proposal.generated_file];
 if(stage===1)arr.push(R.planPath(plan.project_id));
 if(new Set(arr).size!==arr.length)block('PROJECT_PUBLISH_DUPLICATE_PATH');
 return arr.slice().sort();
}
function validateDiff(actual,expected){
 if(!Array.isArray(actual)||actual.some(x=>typeof x!=='string'||
    x.includes('\n')||x.includes('\0')))
  block('PROJECT_PUBLISH_DIFF_INVALID');
 if(JSON.stringify(actual.slice().sort())!==JSON.stringify(expected.slice().sort()))
  block('PROJECT_PUBLISH_UNEXPECTED_DIFF');
 return true;
}
async function verifyPublish(dir,root,live,token,fetcher=globalThis.fetch){
 const {proof,plan}=stageArtifact(dir);
 const task=P.taskFromEvent(proof.owner_event);
 const spec=P.stageSpec(plan,proof.stage);
 const original=await R.originalOwnerEvent(task.issue,task.comment,token,fetcher);
 const actual=P.taskFromEvent(original);
 for(const key of ['issue','comment','scope','test','goal','project_id'])
  if(task[key]!==actual[key])block('PROJECT_PUBLISH_ORIGIN_CHANGED');
 if(proof.stage===1){
  if(live.action!=='created')block('PROJECT_PUBLISH_STAGE1_EVENT_REJECTED');
  const direct=P.taskFromEvent(live);
  if(direct.project_id!==actual.project_id||direct.goal!==actual.goal)
   block('PROJECT_PUBLISH_OWNER_EVENT_REJECTED');
 }else{
  const r=await R.resolveResume(live,token,fetcher);
  if(r.blocked||r.stage!==proof.stage||r.base_sha!==proof.readback.at(-1)?.sha||
     r.plan.plan_sha256!==plan.plan_sha256||
     JSON.stringify(r.records)!==JSON.stringify(proof.readback))
   block('PROJECT_PUBLISH_RESUME_STATE_CHANGED');
 }
 const stageTask=P.authorizeStage(proof,live,root);
 if(stageTask.project_stage!==spec.stage||
    JSON.stringify(stageTask.project_files)!==JSON.stringify(spec.files))
  block('PROJECT_PUBLISH_MILESTONE_SCOPE_DRIFT');
 const reviewer=D.verifyDirectory(dir,root);
 const proposal=fileJson(dir,D.PROPOSAL_FILE);
 if(reviewer.issue!==task.issue||reviewer.comment!==task.comment||
    proposal.task.project_id!==plan.project_id||
    proposal.task.project_stage!==spec.stage||
    proposal.selected.join('\n')!==spec.files.join('\n'))
  block('PROJECT_PUBLISH_REVIEW_PROOF_MISMATCH');
 const target={...spec,expected_paths:expectedPaths(plan,proposal),
  review_status:'DEPARTMENT_REVIEW_PASS',publisher:'GITHUB_ACTIONS_DRAFT_ONLY',
  model:plan.model,issue:task.issue,comment:task.comment,auto_merge:false};
 return target;
}
function writePlan(dir,root,stage){
 if(stage!==1)return null;
 const {plan}=stageArtifact(dir);
 const relative=R.planPath(plan.project_id),dest=path.resolve(root,relative);
 const base=fs.realpathSync(root);
 if(!dest.startsWith(base+path.sep)||fs.existsSync(dest))
  block('PROJECT_PUBLISH_PLAN_DEST_REJECTED');
 const parent=path.dirname(dest);
 fs.mkdirSync(parent,{recursive:true});
 if(!fs.realpathSync(parent).startsWith(base+path.sep))
  block('PROJECT_PUBLISH_PLAN_PATH_ESCAPE');
 fs.writeFileSync(dest,JSON.stringify(plan,null,2)+'\n',{flag:'wx',mode:0o644});
 return relative;
}
async function cli(){
 const mode=process.argv[2],root=process.cwd();
 const env=R.requireEnv(process.env);
 const dir=path.resolve(process.argv[3]||'');
 if(!dir.startsWith(path.resolve(env.RUNNER_TEMP)+path.sep))
  block('PROJECT_PUBLISH_ARTIFACT_DIR_REJECTED');
 const evt=R.readEvent(env);
 if(mode==='--verify'){
  const target=await verifyPublish(dir,root,evt,env.GITHUB_TOKEN);
  const out=path.resolve(env.RUNNER_TEMP,'imperion-dev-project-publish-target.json');
  fs.writeFileSync(out,JSON.stringify(target,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({status:'PROJECT_PUBLISH_VERIFIED_REVIEW_ONLY',
   stage:target.stage,branch:target.head,base:target.base}));
 }else if(mode==='--plan-file'){
  const stage=Number(process.argv[4]);
  console.log(JSON.stringify({plan_path:writePlan(dir,root,stage)}));
 }else if(mode==='--check-diff'){
  const target=fileJson(env.RUNNER_TEMP,'imperion-dev-project-publish-target.json');
  const actual=process.argv.slice(4);
  validateDiff(actual,target.expected_paths);
  console.log('PROJECT_PUBLISH_EXPECTED_PATHS_VERIFIED');
 }else block('PROJECT_PUBLISH_MODE_REJECTED');
}
if(require.main===module)cli().catch(e=>{
 console.error(/^[A-Z0-9_]+$/.test(e.message)?e.message:'PROJECT_PUBLISH_FAIL_CLOSED');
 process.exitCode=9;
});
module.exports={stageArtifact,expectedPaths,validateDiff,verifyPublish,writePlan};
