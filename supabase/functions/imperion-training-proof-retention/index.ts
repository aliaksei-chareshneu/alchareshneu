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
 const deleted:string[]=[];let processed=0,failed=0;
 for(let pass=0;pass<10;pass++){
  const rows=await api.schema('storage').from('objects').select('name')
   .eq('bucket_id',BUCKET).gte('name','2000-01-01/')
   .lt('name',cutoff).order('name',{ascending:true}).limit(100);
  if(rows.error){console.error('payment_proof_expiry_listing_failed');return json({error:'cleanup_unavailable'},503);}
  const paths=(rows.data||[]).map(x=>x.name).filter(name=>
   /^[0-9]{4}-[0-9]{2}-[0-9]{2}\/[0-9a-f-]{36}\.pdf$/.test(name));
  if(!rows.data?.length)break;
  if(!paths.length){console.error('unexpected_object_name');return json({error:'manual_storage_review_required'},503);}
  const removed=await api.storage.from(BUCKET).remove(paths);
  if(removed.error){failed+=paths.length;console.error('payment_proof_cleanup_remove_failed');break;}
  processed+=paths.length;
  if(paths.length<100)break;
 }
 return json({ok:failed===0,removedCount:processed,failedCount:failed,cutoffDay:cutoff.slice(0,10)},failed?503:200);
});
