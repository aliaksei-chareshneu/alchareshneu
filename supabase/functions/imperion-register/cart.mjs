import { quoteStarter4 } from './cart-packages.mjs';
/* Multi-event RSVP / same-legal-seller bank quote for the existing register endpoint.
 * Private token + service-role-only DB; one transfer is NEVER offered across controllers.
 * Bank proof is not bank settlement or a seat reservation. */
function sameLines(saved,current){
  if(!Array.isArray(saved)||saved.length!==current.length)return false;
  return current.every((row,i)=>['eventId','reference','tier','baseCzk','surchargeCzk','totalCzk','late48h','quoteLockedAt']
    .every(key=>saved[i]?.[key]===row[key]));
}
export async function handleCart(body, proof, req, d) {
  const {api, reply, safeName, safeEmail, safePhone, safeEnum, text, campaignCode,
    discoveryCode, allow, tokenHash, generateResumeToken, generateVariableSymbol,
    osvcQuote, verifiedBankIban, createTrainingSpd, pdfInfo, inspectPaymentPdf,
    OSVC_PROOF_BUCKET} = d;
  const action = String(body.action || '');
  const answer = (data, status=200) => reply(data, status, req.headers.get('origin'));
  const originIp = String(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||
    req.headers.get('x-forwarded-for')||'').split(',')[0].trim().slice(0,100);
  const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  if (action === 'cart_submit') {
    let buyer, entries;
    try {
      if (!Array.isArray(body.eventIds) || body.eventIds.length<1 || body.eventIds.length>8 ||
          new Set(body.eventIds).size!==body.eventIds.length || body.safety!==true)
        throw Error('invalid_cart');
      if (!body.eventIds.every(id=>typeof id==='string'&&/^[A-Za-z0-9-]{2,100}$/.test(id)))
        throw Error('invalid_event');
      const age = safeEnum(body.ageGroup,['adult','under18']);
      const first = safeName(body.firstName), last = safeName(body.lastName);
      buyer = {
        first,last,email:safeEmail(body.email),phone:safePhone(body.phone),age,
        guardianName:age==='under18'?safeName(body.guardianName):'',
        guardianPhone:age==='under18'?safePhone(body.guardianPhone):'',
        rsvp:safeEnum(body.rsvp,['YES','MAYBE','NO']),
        language:safeEnum(body.language||'cs',['cs','en','ru','uk']),
        discoverySource:discoveryCode(body.discoverySource)||'',
        utmSource:campaignCode(body.utmSource,48)||'',
        utmMedium:campaignCode(body.utmMedium,24)||'',
        utmCampaign:campaignCode(body.utmCampaign,64)||''
      };
      // No automatically duplicated media or marketing permission between data controllers.
      const tiers = body.tiers && typeof body.tiers==='object'&&!Array.isArray(body.tiers)?body.tiers:{};
      entries = body.eventIds.map(eventId=>({
        eventId,tier:safeEnum(tiers[eventId]||'STANDARD',['STANDARD','SENIOR','STARTER4'])
      }));
    } catch {return answer({error:'please_check_required_fields'},400);}
    if (originIp && !(await allow('cart_ip',originIp,10)))
      return answer({error:'too_many_requests'},429);
    if (!(await allow('cart_email',buyer.email,5)))
      return answer({error:'too_many_requests'},429);
    const cartToken = generateResumeToken();
    buyer.cartTokenHash = await tokenHash(cartToken);
    buyer.paymentVariableSymbol = generateVariableSymbol();
    const secrets = [];
    for(const row of entries){
      const token=generateResumeToken();
      secrets.push({eventId:row.eventId,resumeToken:token});
      row.resumeTokenHash=await tokenHash(token);
      row.statusTokenHash=row.resumeTokenHash; // same private code can check a member's payment status
      row.variableSymbol=generateVariableSymbol();
    }
    const result = await api.rpc('imperion_rsvp_cart_create',{p_cart:buyer,p_items:entries});
    if (result.error) {
      const code=String(result.error.message||'').match(/(already_registered|event_not_available|package_requires_authorization|invalid_cart_size)/)?.[1]||'cart_unavailable';
      return answer({error:code},code==='already_registered'||code==='event_not_available'?409:503);
    }
    return answer({ok:true,status:'RECEIVED_UNCONFIRMED',confirmed:false,
      cartId:result.data.cartId,cartToken,controller:result.data.controller,
      references:result.data.references,secrets,bankVerified:false,
      message:'Multiple requests received. No places or payments are confirmed.'});
  }
  let cartId, key, first, last, email;
  try {
    cartId=String(body.cartId||'');key=String(body.cartToken||'');
    first=safeName(body.firstName);last=safeName(body.lastName);email=safeEmail(body.email);
    if(!uuid.test(cartId)||!/^[A-Za-z0-9_-]{43}$/.test(key))throw Error('invalid_token');
  } catch {return answer({error:'invalid_cart_code'},400);}
  if(!(await allow('cart_access',cartId+'|'+email,12)))
    return answer({error:'too_many_requests'},429);
  const secretHash=await tokenHash(key);
  const lookup=await api.from('imperion_rsvp_carts').select('*')
    .eq('id',cartId).eq('first_name',first).eq('last_name',last)
    .eq('email',email).eq('resume_token_hash',secretHash)
    .gt('retention_until',new Date().toISOString()).maybeSingle();
  if(lookup.error)return answer({error:'temporarily_unavailable'},503);
  const cart=lookup.data;
  if(!cart)return answer({error:'invalid_cart_code'},400);
  if(action==='cart_status')return answer({ok:true,confirmed:false,
    paymentEvidenceStatus:cart.payment_evidence_status,
    bankVerified:!!cart.bank_verified_at,bookingConfirmed:false});
  if(action==='cart_quote'){
    if(proof)return answer({error:'invalid_request'},400);
    if(cart.payment_evidence_status!=='NOT_REQUIRED')return answer({error:'cart_already_processed'},409);
    // Do not accidentally sell nonprofit membership, volunteer activities or grant-funded events.
    if(cart.controller!=='Aliaksei Chareshneu (OSVČ)')
      return answer({error:'separate_payees_or_payment_closed'},409);
    const members=await api.from('imperion_rsvp_submissions')
      .select('id,event_id,created_at,training_requested_tier,osvc_authorized_at,training_authorized_at,training_authorized_tier,rsvp_status,payment_evidence_status')
      .eq('cart_id',cartId).order('event_id');
    if(members.error||!Array.isArray(members.data)||members.data.length<1||members.data.length>8)
      return answer({error:'temporarily_unavailable'},503);
    const eventIds=members.data.map(row=>row.event_id);
    const catalog=await api.from('imperion_rsvp_events').select(d.EVENT_COLS)
      .in('event_id',eventIds);
    if(catalog.error||catalog.data?.length!==eventIds.length)
      return answer({error:'temporarily_unavailable'},503);
    const byId=new Map(catalog.data.map(e=>[e.event_id,e]));
    const packages=quoteStarter4(members.data,byId);
    if(packages.error)return answer({error:packages.error},409);
    const lines=[];let sum=0;let payee=null, iban=null;
    for(const row of members.data){
      const e=byId.get(row.event_id);
      if(!e||e.data_controller!=='Aliaksei Chareshneu (OSVČ)'||
          !e.is_open||!e.source_active||!e.price_verified||!e.end_time_verified||
          e.registration_mode!=='FORM'||Date.parse(e.begins_at)<=Date.now()||
          row.rsvp_status!=='YES'||row.payment_evidence_status!=='NOT_REQUIRED')
        return answer({error:'session_or_attendance_not_approved'},409);
      // Free activities remain RSVPs, never counted as paid transfers.
      if(Number(e.price_czk)===0)continue;
      const hema=e.category==='HEMA Training'&&e.community==='Družina Moravy';
      if(hema && body.osvcSellerConsent!==true)
        return answer({error:'personal_seller_consent_required'},409);
      const tier=row.training_requested_tier||'STANDARD';
      // A selected price tier is never its own authorization.
      const approvedTier=!!row.training_authorized_at&&row.training_authorized_tier===tier;
      if(tier==='STARTER4'&&!approvedTier)
        return answer({error:'package_requires_individual_authorization'},409);
      if(tier==='SENIOR'&&!approvedTier)
        return answer({error:'senior_status_not_verified'},409);
      if(tier==='STANDARD'&&!(row.osvc_authorized_at||approvedTier))
        return answer({error:'personal_confirmation_pending'},409);
      if(!hema&&!row.osvc_authorized_at)
        return answer({error:'personal_confirmation_pending'},409);
      // Do not accidentally apply the earlier 190 Kč tour price after its hard deadline.
      if(e.event_id==='PUB-WALK-20261129'&&Date.now()>Date.parse('2026-11-27T15:30:00+01:00'))
        return answer({error:'event_price_requires_manual_quote'},409);
      const original=Date.parse(row.created_at);
      if(!Number.isFinite(original)||original>Date.now())
        return answer({error:'invalid_registration_timestamp'},409);
      const q=osvcQuote(e,original,true,tier==='STARTER4'?'STANDARD':tier);
      if(!q?.sessionPaymentOpen||!q.account||!q.recipient||!q.quoteLockedAt)
        return answer({error:'personal_confirmation_pending'},409);
      const verified=verifiedBankIban(q.account,q.recipient,
        Deno.env.get('OSVC_APPROVED_IBAN')||'CZ9755000000007804336003',
        Deno.env.get('OSVC_APPROVED_PAYEE')||'Aliaksei Chareshneu');
      if(!verified || (iban&&iban!==verified) || (payee&&payee!==q.recipient))
        return answer({error:'approved_bank_not_configured'},409);
      iban=verified;payee=q.recipient;
      const pack=packages.prices.get(e.event_id);
      const amount=pack||q;
      sum+=amount.totalCzk;
      lines.push({reference:row.id,eventId:e.event_id,tier,
        baseCzk:amount.baseCzk,surchargeCzk:amount.surchargeCzk,totalCzk:amount.totalCzk,
        late48h:amount.late48h,quoteLockedAt:q.quoteLockedAt});
    }
    if(!lines.length||!Number.isSafeInteger(sum)||sum>9999999)
      return answer({error:'no_combined_paid_items'},409);
    // Lock the quote on first release. Never replace prices silently after a transfer.
    if(cart.quote_total_czk!==null){
      if(cart.quote_total_czk!==sum||!sameLines(cart.quote_lines,lines)||
          cart.quote_iban!==iban||cart.quote_recipient!==payee)
        return answer({error:'quote_changed'},409);
    }else{
      const updated=await api.from('imperion_rsvp_carts').update({
        quote_total_czk:sum,quote_lines:lines,quote_locked_at:new Date().toISOString(),
        quote_recipient:payee,quote_iban:iban,
        osvc_personal_consent_at:lines.some(line=>byId.get(line.eventId)?.category==='HEMA Training')
          ?new Date().toISOString():null
      }).eq('id',cartId).is('quote_total_czk',null)
        .eq('payment_evidence_status','NOT_REQUIRED').select('id').maybeSingle();
      if(updated.error||!updated.data)return answer({error:'quote_changed_retry'},409);
    }
    const spd=createTrainingSpd(iban,sum,cartId,cart.payment_variable_symbol,'IM');
    if(!spd)return answer({error:'approved_bank_not_configured'},409);
    return answer({ok:true,confirmed:false,bankVerified:false,
      cartPayment:{totalCzk:sum,currency:'CZK',recipient:payee,iban,
        paymentReference:cartId,variableSymbol:cart.payment_variable_symbol,
        spd,lines,proofRequired:true}});
  }
  if(action==='cart_proof'){
    if(!proof || cart.payment_evidence_status!=='NOT_REQUIRED'||
       !Number.isSafeInteger(cart.quote_total_czk)||cart.quote_total_czk<1||
       !cart.quote_iban||!cart.quote_recipient||!Array.isArray(cart.quote_lines))
      return answer({error:'approved_cart_quote_required'},409);
    if(body.quotedTotalCzk!==cart.quote_total_czk)
      return answer({error:'quote_changed'},409);
    let data;
    try{data=await pdfInfo(proof);}catch{return answer({error:'invalid_payment_pdf'},400);}
    const already=await Promise.all([
      api.from('imperion_rsvp_carts').select('id').eq('payment_pdf_sha256',data.hash).limit(1),
      api.from('imperion_rsvp_submissions').select('id').eq('payment_pdf_sha256',data.hash).limit(1)
    ]);
    if(already.some(x=>x.error))return answer({error:'temporarily_unavailable'},503);
    if(already.some(x=>x.data?.length))return answer({error:'duplicate_payment_pdf'},409);
    let review;
    try{review=await inspectPaymentPdf(data.bytes,{
      amountCzk:cart.quote_total_czk,iban:cart.quote_iban,recipient:cart.quote_recipient,
      reference:cart.id,variableSymbol:cart.payment_variable_symbol
    });}catch{return answer({error:'invalid_payment_pdf'},400);}
    const path=cart.retention_until.slice(0,10)+'/'+crypto.randomUUID()+'.pdf';
    const uploaded=await api.storage.from(OSVC_PROOF_BUCKET).upload(path,data.bytes,{
      contentType:'application/pdf',upsert:false,cacheControl:'0'});
    if(uploaded.error)return answer({error:'proof_storage_unavailable'},503);
    const saved=await api.rpc('imperion_rsvp_cart_record_proof',{
      p_cart_id:cart.id,p_pdf_path:path,p_pdf_sha256:data.hash,
      p_review_status:review.status,p_review_flags:review.flags
    });
    if(saved.error||saved.data!==true){
      await api.storage.from(OSVC_PROOF_BUCKET).remove([path]);
      return answer({error:'proof_record_unavailable'},503);
    }
    return answer({ok:true,status:'PROOF_RECEIVED',confirmed:false,
      paymentEvidenceStatus:'PROOF_RECEIVED',bankVerified:false,bookingConfirmed:false});
  }
  return answer({error:'invalid_action'},400);
}