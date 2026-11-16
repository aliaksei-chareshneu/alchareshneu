/* Private Družina-only Fio account-watch worker.
 * Reuses the existing /register/ RSVP/quote/proof and private CRM bridge.
 * No card/transfer orders, no Fio POST, no buyer PII in logs.
 * Bank token is owner-configured in Supabase Secrets, NEVER in GitHub/Vault SQL.
 * Cron secret is kept only in Supabase Vault and compared by service-role RPC.
 */
import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
import {parseFioStatement,planExactCredits} from './fio-matcher.mjs';

const S_URL=Deno.env.get('SUPABASE_URL')||'';
const S_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const api=S_URL&&S_KEY?createClient(S_URL,S_KEY,{
 auth:{persistSession:false,autoRefreshToken:false}}):null;
const reply=(value:object,status=200)=>new Response(JSON.stringify(value),{
 status,headers:{'content-type':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff'}});
const day=d=>new Date(d).toISOString().slice(0,10);

Deno.serve(async(req:Request):Promise<Response>=>{
 if(req.method!=='POST'||req.headers.has('origin'))return reply({error:'method_not_allowed'},405);
 if(!api)return reply({error:'service_unavailable'},503);
 const key=req.headers.get('x-imperion-fio-cron-token')||'';
 if(!/^[0-9a-f]{64}$/i.test(key))return reply({error:'unauthorized'},401);
 const verified=await api.rpc('verify_imperion_druzina_fio_cron_token',{p_token:key});
 if(verified.error||verified.data!==true)return reply({error:'unauthorized'},401);

 // This gate is intentionally independent of the per-session payment release.
 // Only the verified owner can assert token scope and legal receiving entity.
 if(Deno.env.get('DRUZINA_FIO_AUTOMATION_ENABLED')!=='YES')
   return reply({ok:true,status:'DISABLED',bankCalls:0,applied:0});

 const now=new Date().toISOString();
 const pending=await api.from('imperion_rsvp_submissions')
  .select('id,event_id,created_at,payment_variable_symbol,quoted_total_czk,payment_evidence_received_at,payment_bank_check_after,fio_bank_review_code,fio_bank_check_attempts')
  .eq('payment_evidence_status','PROOF_RECEIVED')
  .eq('data_controller','Družina Moravy, z. s.')
  .is('bank_verified_at',null)
  .not('payment_variable_symbol','is',null)
  .not('payment_pdf_path','is',null)
  .lte('payment_bank_check_after',now)
  .order('payment_bank_check_after',{ascending:true}).limit(80);
 if(pending.error)return reply({error:'rsvp_unavailable'},503);
 if(!pending.data?.length)return reply({ok:true,status:'IDLE',bankCalls:0,applied:0});

 const token=Deno.env.get('DRUZINA_FIO_READONLY_TOKEN')||'';
 const iban=(Deno.env.get('DRUZINA_APPROVED_IBAN')||'').replace(/\s/g,'').toUpperCase();
 const payee=Deno.env.get('DRUZINA_APPROVED_PAYEE')||'';
 const bankId=Deno.env.get('DRUZINA_FIO_BANK_ID')||'';
 const accountId=Deno.env.get('DRUZINA_FIO_ACCOUNT_ID')||'';
 if(Deno.env.get('DRUZINA_FIO_READONLY_CONFIRMED')!=='YES'||
    Deno.env.get('DRUZINA_FIO_SELLER_CONFIRMED')!=='YES'||
    !/^[A-Za-z0-9]{64}$/.test(token)||!/^CZ\d{22}$/.test(iban)||
    !/^\d{4}$/.test(bankId)||!/^\d{1,16}$/.test(accountId)||
    payee.trim()!=='Družina Moravy, z. s.')
   return reply({error:'bank_source_not_authorized',bankCalls:0,applied:0},503);

 // Read-only /periods/ avoids the bank-side cursor mutation of Fio /last/.
 // Never poll before the documented due moment. Fio token is one-account only.
 const startMs=Math.min(...pending.data.map(x=>Date.parse(x.created_at)));
 const from=day(Math.max(Date.now()-85*86400000,startMs-2*86400000));
 const to=day(Date.now());
 const url='https://fioapi.fio.cz/v1/rest/periods/'+encodeURIComponent(token)+
   '/'+from+'/'+to+'/transactions.json';
 let statement;
 try{
  const response=await fetch(url,{method:'GET',headers:{Accept:'application/json'},
   cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return reply({error:'fio_unavailable',bankCalls:1,applied:0},503);
  const body=await response.text();
  if(body.length>2_000_000)return reply({error:'fio_response_oversize',bankCalls:1,applied:0},503);
  statement=JSON.parse(body);
 }catch{return reply({error:'fio_unavailable',bankCalls:1,applied:0},503);}

 let plan;
 try{
  const movements=parseFioStatement(statement,{iban,bankId,accountId});
  plan=planExactCredits(movements,pending.data);
 }catch{
  // Never log Fio JSON, URLs, account holder, counterparty or access token.
  return reply({error:'fio_account_or_format_check_failed',bankCalls:1,applied:0},503);
 }
 let applied=0,conflicts=0;
 for(const row of plan.matches){
  const result=await api.rpc('druzina_apply_fio_bank_credit',{
   p_submission_id:row.id,p_variable_symbol:row.variableSymbol,
   p_movement_id:row.movementId,p_amount_czk:row.amountCzk,
   p_movement_at:row.movementAt});
  if(result.error){conflicts++;continue;} // Unique movement index and RPC enforce atomic replay protection.
  if(result.data===true)applied++;else conflicts++;
 }
 const reasons=new Map(plan.manual.map(x=>[x.id,x.reason]));
 for(const row of pending.data){
  if(plan.matches.some(m=>m.id===row.id))continue;
  // Stop indefinite checks after 14 days beyond session and put it into owner review.
  const previous=Number(row.fio_bank_check_attempts||0);
  const timeout=previous>=32; // ~8 days at 6-hour cadence.
  const reason=reasons.get(row.id)||(timeout?'NOT_CLEARED_AFTER_RETRIES':'BANK_CREDIT_PENDING');
  const next=timeout?null:new Date(Date.now()+6*3600000).toISOString();
  const update:any={
   fio_bank_check_attempts:previous+1,
   fio_bank_last_checked_at:now,
   payment_bank_check_after:next,
   fio_bank_review_code:reason,
   ...(row.fio_bank_review_code!==reason?{payment_crm_synced_at:null}:{})
  };
  const saved=await api.from('imperion_rsvp_submissions').update(update)
    .eq('id',row.id).eq('payment_evidence_status','PROOF_RECEIVED')
    .is('bank_verified_at',null);
  if(saved.error)conflicts++;
 }
 console.log('druzina_fio_reconcile bankCalls=1 applied='+applied+
  ' review='+plan.manual.length+' conflicts='+conflicts);
 return reply({ok:true,status:'BANK_READBACK_COMPLETED',bankCalls:1,
  bankVerified:applied,needsReview:plan.manual.length,conflicts,
  unmatchedBankCredits:plan.unmatched,bookingConfirmed:false});
});
