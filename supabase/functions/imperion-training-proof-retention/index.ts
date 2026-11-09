import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.112.3";
/**
 * Private housekeeping only; no public PDF listings, paths or personal data
 * are returned. Uses the existing intake-bridge Vault token to avoid new
 * credentials. The 90-day RSVP expiry is preserved. PDF objects are deleted
 * through the Supabase Storage API, never by deleting storage.objects rows.
 */
const URL=Deno.env.get('SUPABASE_URL')||'';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const BUCKET='imperion-training-payment-proofs';
const HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(body:object,status=200)=>new Response(JSON.stringify(body),{headers:HEADERS,status});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 const token=req.headers.get('x-imperion-cleanup-key')||'';
 if(!/^[0-9a-f]{64}$/i.test(token)||!URL||!KEY)return json({error:'unauthorized'},401);
 const api=createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await api.rpc('verify_imperion_intake_bridge_token',{p_token:token});
 if(auth.error||auth.data!==true)return json({error:'forbidden'},403);
 // Keep the entire expiry day plus one-day buffer to avoid early removal.
 // Storage object names start with their event+90-day UTC expiry date.
 const cutoff=new Date(Date.now()-86400000).toISOString().slice(0,10)+'/';
 let processed=0,failed=0;
 // List only date-named Storage folders; no direct SQL deletion of storage.objects.
 const root=await api.storage.from(BUCKET).list('',{
  limit:100,offset:0,sortBy:{column:'name',order:'asc'}
 });
 if(root.error)return json({error:'cleanup_unavailable'},503);
 const oldFolders=(root.data||[]).filter(x=>x.id===null&&
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(x.name)&&x.name+'/'<cutoff).slice(0,20);
 for(const folder of oldFolders){
   for(let pass=0;pass<10;pass++){
     const listing=await api.storage.from(BUCKET).list(folder.name,{
       limit:100,offset:0,sortBy:{column:'name',order:'asc'}
     });
     if(listing.error){failed++;break;}
     const objects=(listing.data||[]).filter(x=>x.id!==null);
     if(!objects.length)break;
     const paths=objects.filter(x=>/^[0-9a-f-]{36}[.]pdf$/.test(x.name))
       .map(x=>folder.name+'/'+x.name);
     if(!paths.length||paths.length!==objects.length){failed++;break;}
     const removed=await api.storage.from(BUCKET).remove(paths);
     if(removed.error){failed+=paths.length;break;}
     processed+=paths.length;
     if(objects.length<100)break;
   }
 }
 return json({ok:failed===0,removedCount:processed,failedCount:failed,cutoffDay:cutoff.slice(0,10)},failed?503:200);
});
