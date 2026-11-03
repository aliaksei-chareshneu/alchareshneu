/**
 * Payment proof intake for paid events. Anonymous public POST with strict
 * browser origin, quotas and file signature checks. NOT bank verification.
 * Private Supabase Storage bucket; only privileged server can read it.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

const ORIGIN='https://aliaksei-chareshneu.github.io';
const SERVICE_URL=Deno.env.get('SUPABASE_URL')||'';
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const api=SERVICE_URL&&SERVICE_KEY?createClient(SERVICE_URL,SERVICE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
}):null;
const BUCKET='imperion-payment-private';
const MIME:{[key:string]:{extension:string;check:(x:Uint8Array)=>boolean}}={
 'application/pdf':{extension:'pdf',check:b=>b.length>4&&[37,80,68,70,45].every((n,i)=>b[i]===n)},
 'image/png':{extension:'png',check:b=>b.length>8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n)},
 'image/jpeg':{extension:'jpg',check:b=>b.length>3&&b[0]===255&&b[1]===216&&b[2]===255},
 'image/webp':{extension:'webp',check:b=>b.length>12&&
   String.fromCharCode(...b.slice(0,4))==='RIFF'&&
   String.fromCharCode(...b.slice(8,12))==='WEBP'}
};
function headers(origin:string|null):HeadersInit {
 const h:Record<string,string>={'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin===ORIGIN){
  h['Access-Control-Allow-Origin']=ORIGIN;
  h['Access-Control-Allow-Methods']='POST, OPTIONS';
  h['Access-Control-Allow-Headers']='content-type';
 }
 return h;
}
function response(data:object,status:number,origin:string|null):Response {
 return new Response(JSON.stringify(data),{status,headers:headers(origin)});
}
function normalized(value:FormDataEntryValue|null,max:number):string {
 return typeof value==='string'?value.normalize('NFKC').trim().slice(0,max):'';
}
function emailOk(value:string):boolean {
 return value.length>=5&&value.length<=254&&/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(value);
}
async function throttle(key:string,value:string,max:number):Promise<boolean>{
 if(!api)return false;
 const raw=new TextEncoder().encode(new Date().toISOString().slice(0,10)+'|'+key+'|'+value);
 const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(SERVICE_KEY),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const hash=await crypto.subtle.sign('HMAC',hmac,raw);
 const bucket=Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('');
 const {data,error}=await api.rpc('imperion_rsvp_allow_request',{p_key:bucket,p_limit:max});
 return !error&&data===true;
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(req.method==='OPTIONS')return origin===ORIGIN
  ?new Response(null,{status:204,headers:headers(origin)})
  :response({error:'forbidden_origin'},403,null);
 if(origin!==ORIGIN)return response({error:'forbidden_origin'},403,null);
 if(req.method!=='POST')return response({error:'method_not_allowed'},405,origin);
 if(!api)return response({error:'service_not_configured'},503,origin);
 const declaredLength=Number(req.headers.get('content-length')||'0');
 if(declaredLength>4_350_000||!req.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data'))
  return response({error:'invalid_upload'},413,origin);
 let body:FormData;
 try{body=await req.formData();}catch{return response({error:'invalid_upload'},400,origin);}
 const eventId=normalized(body.get('eventId'),100);
 const email=normalized(body.get('email'),254).toLowerCase();
 const declaredAmount=Number(normalized(body.get('declaredAmountCzk'),12));
 const reference=normalized(body.get('paymentReference'),80);
 const date=normalized(body.get('transactionDate'),10);
 const file=body.get('proof');
 if(!/^[A-Za-z0-9-]{2,100}$/.test(eventId)||!emailOk(email)||
  !Number.isSafeInteger(declaredAmount)||declaredAmount<1||
  (reference&&!/^[\\p{L}\\p{N}\\s.\\/-]{1,80}$/u.test(reference))||
  (date&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))||
  !(file instanceof File)||file.size<1024||file.size>4194304||
  !MIME[file.type])return response({error:'invalid_upload'},400,origin);
 if(date){
  const actual=new Date(date+'T12:00:00.000Z');
  if(!Number.isFinite(actual.getTime())||actual.toISOString().slice(0,10)!==date)
    return response({error:'invalid_upload'},400,origin);
 }
 const {data:event,error:lookupError}=await api.from('imperion_rsvp_events')
  .select('event_id,price_czk,data_controller,ends_at')
  .eq('event_id',eventId).eq('public_listing',true).eq('is_open',true)
  .eq('source_active',true).eq('registration_mode','FORM')
  .eq('price_verified',true).eq('end_time_verified',true)
  .gt('begins_at',new Date().toISOString()).maybeSingle();
 if(lookupError)return response({error:'temporarily_unavailable'},503,origin);
 if(!event||event.price_czk<1)return response({error:'event_not_available'},400,origin);
 if(declaredAmount!==event.price_czk)
  return response({error:'amount_does_not_match_event_price'},422,origin);
 const ip=String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
  req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,100);
 if((ip&&!(await throttle('payment_proof_ip',ip,8)))||
  !(await throttle('payment_proof_email',email,5)))
  return response({error:'too_many_requests'},429,origin);
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(!MIME[file.type].check(bytes))return response({error:'invalid_file_signature'},415,origin);
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
  .map(n=>n.toString(16).padStart(2,'0')).join('');
 // Reusing one proof cannot grant access to multiple tickets or identities.
 const {data:existing,error:dupError}=await api.from('imperion_payment_evidence')
  .select('id,event_id,attendee_email,review_status')
  .eq('data_controller',event.data_controller).eq('file_sha256',sha)
  .maybeSingle();
 if(dupError)return response({error:'temporarily_unavailable'},503,origin);
 if(existing){
  if(existing.event_id!==eventId||existing.attendee_email!==email||
    existing.review_status!=='PENDING_BANK_REVIEW')
    return response({error:'proof_already_used'},409,origin);
  const {data:linked}=await api.from('imperion_rsvp_submissions')
   .select('id').eq('payment_evidence_id',existing.id).limit(1);
  if(linked?.length)return response({error:'proof_already_used'},409,origin);
  return response({ok:true,evidenceId:existing.id,status:'PENDING_BANK_REVIEW',
   message:'Proof was stored previously; bank confirmation is still required.'},200,origin);
 }
 const path=eventId+'/'+crypto.randomUUID()+'.'+MIME[file.type].extension;
 const {error:uploadError}=await api.storage.from(BUCKET).upload(path,bytes,{
  contentType:file.type,upsert:false,cacheControl:'0'
 });
 if(uploadError)return response({error:'temporarily_unavailable'},503,origin);
 const retention=new Date(new Date(event.ends_at).getTime()+90*86400000);
 const {data:receipt,error:dbError}=await api.from('imperion_payment_evidence').insert({
  event_id:eventId,attendee_email:email,data_controller:event.data_controller,
  expected_amount_czk:event.price_czk,declared_amount_czk:declaredAmount,
  declared_reference:reference||null,declared_paid_on:date||null,
  storage_path:path,file_sha256:sha,media_type:file.type,file_bytes:file.size,
  precheck:{file_signature:true,declared_amount_matches:true,event_price_verified:true,
   bank_transaction_matched:false,automatically_approved:false},
  retention_until:retention.toISOString(),review_status:'PENDING_BANK_REVIEW'
 }).select('id').single();
 if(dbError||!receipt?.id){
  await api.storage.from(BUCKET).remove([path]);
  return response({error:'temporarily_unavailable'},503,origin);
 }
 return response({ok:true,evidenceId:receipt.id,status:'PENDING_BANK_REVIEW',
  message:'File accepted for review. Payment has NOT been verified.'},200,origin);
});
