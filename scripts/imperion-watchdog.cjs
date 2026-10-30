'use strict';
/** Public-only, permission-safe watchdog. Never reads customer PII or secret values. */
const {eligible}=require('./imperion-autopilot.cjs');
const ROOT='https://aliaksei-chareshneu.github.io/alchareshneu';
const SUPA='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1';
const ORIGIN='https://aliaksei-chareshneu.github.io';
const TITLE='[IMPERION OPS] Autonomous production health incident';
const ENDPOINTS=Object.freeze({
 home:ROOT+'/autopilot/',campaigns:ROOT+'/autopilot/campaigns.html',
 rss:ROOT+'/autopilot/rss.xml',feed:ROOT+'/autopilot/feed.json',
 drafts:ROOT+'/autopilot/social-drafts.json',
 registration:ROOT+'/register/',b2b_form:ROOT+'/corporate/request/',
 rsvp_api:SUPA+'/imperion-register',b2b_api:SUPA+'/imperion-b2b-intake',
 private_bridge:SUPA+'/imperion-intake-bridge'
});
const json=x=>{try{return JSON.parse(x?.body||'')}catch{return null}};
function assess(v,now=Date.now()){
 const errors=[],expected={home:200,campaigns:200,rss:200,feed:200,drafts:200,
  registration:200,b2b_form:200,rsvp_api:200,b2b_api:200,private_bridge:401};
 for(const [k,code] of Object.entries(expected))
  if(v[k]?.status!==code)errors.push(k+': HTTP '+(v[k]?.status??'NONE')+' expected '+code);
 const has=(k,phrase,reason)=>{
  if(v[k]?.status===200 && !v[k].body.includes(phrase))errors.push(k+': '+reason);
 };
 has('home','Vyrazíme spolu?','home marker missing');
 has('campaigns','data-autopilot="owned-campaigns-v1"','static marketing missing');
 has('rss','<rss version="2.0">','RSS missing');
 has('registration','id="rsvpForm"','form missing');
 has('b2b_form','id="request"','form missing');
 const source=json(v.rsvp_api),feed=json(v.feed),social=json(v.drafts),b2b=json(v.b2b_api);
 if(!source||source.bookingConfirmed!==false||!Array.isArray(source.events)||source.events.length>120)
  errors.push('rsvp_api: unsafe or unavailable schema');
 if(v.rsvp_api?.status===200 && v.rsvp_api.headers?.['access-control-allow-origin']!==ORIGIN)
  errors.push('rsvp_api: invalid CORS');
 if(!feed||feed.schema!=='imperion-public-campaigns-v1'||feed.booking_confirmed!==false||
  !Array.isArray(feed.events)||feed.events.length>120)errors.push('feed: invalid public snapshot');
 if(!social||social.schema!=='imperion-social-drafts-v1'||social.auto_posting!==false||
  social.review_required!==true||!Array.isArray(social.drafts)||
  social.drafts.some(d=>d.posted!==false||d.published_url!==null||
  d.status!=='HOLD_FOR_MANUAL_APPROVAL'||/https?:\/\//i.test(d.text_cs||'')))
  errors.push('drafts: manual approval gate failed');
 if(!b2b||b2b.ok!==true||b2b.service!=='osvc_b2b_intake_v1'||
   b2b.accepting!==true||b2b.bookingConfirmed!==false||b2b.paymentCollected!==false)
  errors.push('b2b_api: unexpected contract');
 if(v.private_bridge?.status===401&&json(v.private_bridge)?.error!=='unauthorized')
  errors.push('private_bridge: anonymous rejection missing');
 if(feed&&Array.isArray(feed.events)&&source&&Array.isArray(source.events)){
  const byId=new Map(source.events.map(e=>[e.event_id,e])),seen=new Set();
  for(const ev of feed.events){
    if(!ev.event_id||seen.has(ev.event_id))errors.push('feed: duplicate event');
    seen.add(ev.event_id);
    if(!eligible(byId.get(ev.event_id),now))errors.push('feed: unapproved or expired '+String(ev.event_id).slice(0,100));
  }
  if(social&&Array.isArray(social.drafts) &&
    (social.drafts.length!==seen.size||social.drafts.some(x=>!seen.has(x.event_id))))
    errors.push('drafts: event identity mismatch');
  if(v.campaigns?.status===200&&Array.from(seen).some(id=>!v.campaigns.body.includes('id="'+id+'"')))
    errors.push('campaigns: event card missing');
  if(v.rss?.status===200&&(v.rss.body.match(/<item>/g)||[]).length!==seen.size)
    errors.push('rss: event identity mismatch');
 }
 return {ok:errors.length===0,status:errors.length?'INCIDENT':'HEALTHY',
  endpoints_checked:Object.keys(ENDPOINTS).length,events:feed?.events?.length??null,
  draft_count:social?.drafts?.length??null,errors,third_party_posts:0};
}
async function check(name,url){
 const headers={Accept:'application/json, text/html, application/rss+xml'};
 if(['rsvp_api','b2b_api'].includes(name))headers.Origin=ORIGIN;
 for(let a=0;a<2;a++){
  try{
   const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(14000)});
   const body=await r.text();
   if(body.length>500000)throw Error('oversized response');
   return {status:r.status,body,headers:{
    'access-control-allow-origin':r.headers.get('access-control-allow-origin')}};
  }catch(e){if(a===0)await new Promise(done=>setTimeout(done,900));}
 }
 return {status:0,body:'',headers:{}};
}
async function github(path,method='GET',body=null){
 const token=process.env.GITHUB_TOKEN;
 if(!token||process.env.GITHUB_REPOSITORY!=='aliaksei-chareshneu/alchareshneu')return null;
 const res=await fetch('https://api.github.com/repos/'+process.env.GITHUB_REPOSITORY+path,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('GitHub API HTTP '+res.status);
 return res.status===204?{}:res.json();
}
async function incidents(result){
 const open=await github('/issues?state=open&per_page=100');
 if(!open)return 'NO_TOKEN';
 const issue=open.find(x=>x.title===TITLE&&!x.pull_request);
 if(result.ok){
  if(issue){await github('/issues/'+issue.number,'PATCH',{state:'closed'});return 'AUTO_CLOSED_'+issue.number;}
  return 'NONE';
 }
 if(issue)return 'EXISTING_'+issue.number;
 const body=['Automatic production check failed. No customer data included.',
  'Failures:',...result.errors.map(x=>'- '+x),'',
  'Owned site: '+ROOT+'/autopilot/','See latest GitHub Actions watchdog logs.'].join('\n');
 const created=await github('/issues','POST',{title:TITLE,body});
 return 'OPENED_'+created.number;
}
async function autoRepair(result){
 if(result.ok||!result.errors.some(x=>/^(feed|campaigns|drafts|rss):/.test(x)))return 'NOT_NEEDED';
 const runs=await github('/actions/workflows/imperion-autopilot.yml/runs?per_page=1');
 const latest=runs?.workflow_runs?.[0];
 if(!latest||Date.now()-Date.parse(latest.created_at)<75*60*1000)return 'COOLDOWN';
 await github('/actions/workflows/imperion-autopilot.yml/dispatches','POST',{ref:'main'});
 return 'REBUILD_DISPATCHED';
}
async function main(){
 const rows=await Promise.all(Object.entries(ENDPOINTS).map(async ([n,u])=>[n,await check(n,u)]));
 const result=assess(Object.fromEntries(rows));
 try{result.incident=await incidents(result)}catch(e){result.incident='ISSUE_ERROR_'+String(e.message).slice(0,60)}
 try{result.recovery=await autoRepair(result)}catch(e){result.recovery='RECOVERY_ERROR_'+String(e.message).slice(0,60)}
 console.log(JSON.stringify(result,null,2));
 if(process.env.GITHUB_STEP_SUMMARY){
  require('node:fs').appendFileSync(process.env.GITHUB_STEP_SUMMARY,
   '## IMPERION autonomous watchdog\nStatus: **'+result.status+'**. '+
   'Checked '+result.endpoints_checked+' endpoints. Problems: '+
   result.errors.join('; ')+'. Incident: '+result.incident+'. Recovery: '+result.recovery+'.\n');
 }
 if(!result.ok)process.exitCode=1;
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={assess,ENDPOINTS};
