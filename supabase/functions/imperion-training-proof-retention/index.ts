import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";
/** Private recurring housekeeping for two legally separate sellers.
 * Reuse existing scheduled function and Vault-based authorization. Never expose file paths.
 * Folder names encode EXPIRY dates, so eligible cleanup is safely past expiry.
 */
const URL=Deno.env.get("SUPABASE_URL")||"";
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const SOURCES=[
 {name:"imperion-training-payment-proofs",pattern:/^[0-9a-f-]{36}[.]pdf$/},
 {name:"imperion-academy-payment-proofs",pattern:/^[0-9a-f-]{36}[.](pdf|png|jpg)$/}
];
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
function json(body:object,status=200){return new Response(JSON.stringify(body),{status,headers});}
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 const token=req.headers.get("x-imperion-cleanup-key")||"";
 if(!/^[0-9a-f]{64}$/i.test(token)||!URL||!KEY)return json({error:"unauthorized"},401);
 const api=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await api.rpc("verify_imperion_intake_bridge_token",{p_token:token});
 if(auth.error||auth.data!==true)return json({error:"forbidden"},403);
 const cutoff=new Date(Date.now()-86400000).toISOString().slice(0,10)+"/";
 let processed=0,failed=0;
 const summary=[];
 for(const item of SOURCES){
  let removed=0,errors=0;
  const root=await api.storage.from(item.name).list("",{limit:100,offset:0,sortBy:{column:"name",order:"asc"}});
  if(root.error){failed++;summary.push({bucket:item.name,removed:0,failed:1});continue;}
  const folders=(root.data||[]).filter(x=>x.id===null&&/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x.name)&&x.name+"/"<cutoff).slice(0,20);
  for(const folder of folders){
   for(let pass=0;pass<10;pass++){
    const listing=await api.storage.from(item.name).list(folder.name,{limit:100,offset:0,sortBy:{column:"name",order:"asc"}});
    if(listing.error){failed++;errors++;break;}
    const objects=(listing.data||[]).filter(x=>x.id!==null);
    if(!objects.length)break;
    const paths=objects.filter(x=>item.pattern.test(x.name)).map(x=>folder.name+"/"+x.name);
    if(!paths.length||paths.length!==objects.length){failed++;errors++;break;}
    const result=await api.storage.from(item.name).remove(paths);
    if(result.error){failed+=paths.length;errors+=paths.length;break;}
    removed+=paths.length;processed+=paths.length;
    if(objects.length<100)break;
   }
  }
  summary.push({bucket:item.name,removed,failed:errors});
 }
 return json({ok:failed===0,removedCount:processed,failedCount:failed,cutoffDay:cutoff.slice(0,10),buckets:summary},failed?503:200);
});