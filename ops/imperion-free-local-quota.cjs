'use strict';
/**
 * Optional on-device reservation for public DRAFT-only free model jobs.
 * Not cloud-connected, not a scheduler and not a spending cap on providers.
 * A worker must explicitly inject reserveQuota into draftPublicTask().
 * Receipt files are persisted before any model call. A stale mutex blocks,
 * never evicts automatically. Use a trusted local disk, not a network mount.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

function validId(id){return typeof id==='string'&&/^[A-Za-z0-9._-]{6,120}$/.test(id);}
function key(s){return crypto.createHash('sha256').update(s,'utf8').digest('hex');}
function isPlainDate(d){return d instanceof Date&&!Number.isNaN(d.valueOf());}
function createLocalQuota({directory,clock=()=>new Date()}={}){
  if(typeof directory!=='string'||!path.isAbsolute(directory))
    throw new TypeError('ABSOLUTE_TRUSTED_DIRECTORY_REQUIRED');
  return async function reserveQuota({provider,model,job_id,daily_ceiling}={}){
    if(!validId(job_id)||!/^[a-z][a-z0-9_]{1,40}$/.test(provider||'')||
       typeof model!=='string'||model.length<3||model.length>120||
       !Number.isSafeInteger(daily_ceiling)||daily_ceiling<1||daily_ceiling>600)
      return false;
    let now;
    try{now=clock();}catch{return false;}
    if(!isPlainDate(now))return false;
    const day=now.toISOString().slice(0,10);
    const group=key(provider+'\0'+model).slice(0,20);
    const taskKey=key(provider+'\0'+model+'\0'+job_id);
    const root=path.resolve(directory);
    const lock=path.join(root,'.quota.lock');
    const usage=path.join(root,'daily',day,group);
    const byJob=path.join(root,'jobs');
    let locked=false;
    try{
      await fs.promises.mkdir(root,{recursive:true,mode:0o700});
      // This mutex is intentionally never bypassed after a crash.
      await fs.promises.mkdir(lock,{mode:0o700});
      locked=true;
      await fs.promises.mkdir(usage,{recursive:true,mode:0o700});
      await fs.promises.mkdir(byJob,{recursive:true,mode:0o700});
      const receipt=path.join(usage,taskKey+'.json');
      const globalReceipt=path.join(byJob,taskKey+'.json');
      const [prior,used]=await Promise.all([
        fs.promises.stat(globalReceipt).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),
        fs.promises.readdir(usage,{withFileTypes:true})
      ]);
      if(prior||used.some(e=>!e.isFile()||!e.name.endsWith('.json'))||
         used.length>=daily_ceiling||used.some(e=>e.name===taskKey+'.json'))
        return false;
      const proof=JSON.stringify({status:'RESERVED',provider,model,day,
        job_sha256:key(job_id),created_at_utc:now.toISOString()})+'\n';
      // Create a counted receipt first so interrupted writes consume, not evade, quota.
      for(const file of [receipt,globalReceipt]){
        const fd=await fs.promises.open(file,'wx',0o600);
        try{await fd.writeFile(proof,'utf8');await fd.sync();}
        finally{await fd.close();}
      }
      return true;
    }catch{
      // Fail closed on lock contention, filesystem errors, duplicates and permissions.
      return false;
    }finally{
      if(locked){try{await fs.promises.rmdir(lock);}catch{/* orphan lock blocks future use */}}
    }
  };
}
module.exports={createLocalQuota};
