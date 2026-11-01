'use strict';
/**
 * Verify GitHub Pages actual public responses after the EXISTING autopilot
 * publishes to growth-experience. This does not post social media or access
 * Google Calendar, private Hub, cookies, tokens or customer records.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const BASE='https://aliaksei-chareshneu.github.io/alchareshneu/autopilot/';
const FILES=Object.freeze(['feed.json','social-drafts.json','campaigns.html','rss.xml']);
function digest(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function expectedFiles(root=path.resolve(__dirname,'..','autopilot')){
  return Object.fromEntries(FILES.map(name=>{
    const content=fs.readFileSync(path.join(root,name),'utf8');
    if(content.length>300000)throw Error('PUBLIC_SOURCE_TOO_LARGE');
    return [name,{content,sha256:digest(content)}];
  }));
}
async function verify(options={}){
  const fetchImpl=options.fetchImpl||globalThis.fetch;
  const maxAttempts=options.maxAttempts===undefined?10:options.maxAttempts;
  const waitMs=options.waitMs===undefined?18000:options.waitMs;
  const sleep=options.sleep||((ms)=>new Promise(r=>setTimeout(r,ms)));
  const expected=options.expected||expectedFiles();
  if(typeof fetchImpl!=='function'||!Number.isInteger(maxAttempts)||
      maxAttempts<1||maxAttempts>10||!Number.isInteger(waitMs)||waitMs<0||waitMs>20000)
    throw Error('INVALID_READBACK_OPTIONS');
  if(Object.keys(expected).sort().join(',')!==[...FILES].sort().join(','))
    throw Error('INVALID_READBACK_SOURCE');
  let last='NO_PROVIDER_RESULT';
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const checks=[];
    try{
      for(const name of FILES){
        const canonical=BASE+name;
        // Cache busting avoids accepting stale CDN responses as current.
        const url=canonical+'?imperion_readback='+Date.now()+'-'+attempt;
        const res=await fetchImpl(url,{
          method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
          headers:{Accept:name.endsWith('.json')?'application/json':'*/*'},
          signal:AbortSignal.timeout(15000),
        });
        if(!res||!res.ok||res.redirected)throw Error('PROVIDER_RESPONSE_UNVERIFIED:'+name);
        const body=await res.text();
        if(body.length>300000||digest(body)!==expected[name].sha256)
          throw Error('PROVIDER_SOURCE_MISMATCH:'+name);
        checks.push({url:canonical,sha256:expected[name].sha256,verified:true});
      }
      return {status:'PROVIDER_VERIFIED',provider:'PUBLIC_GITHUB_PAGES',
        checked_at:new Date().toISOString(),attempt,files:checks,
        private_data_read:false,third_party_posts:0,charges:0};
    }catch(e){last=e?.message||'PROVIDER_UNKNOWN_ERROR';}
    if(attempt<maxAttempts)await sleep(waitMs);
  }
  throw Error('PAGES_READBACK_UNVERIFIED:'+last);
}
if(require.main===module)verify().then(result=>{
  console.log(JSON.stringify(result));
}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={BASE,FILES,digest,expectedFiles,verify};
