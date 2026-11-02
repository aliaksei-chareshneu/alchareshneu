// Public email verification. Script cache entries are short-lived and token values
// are never written to sheets, URLs, browser storage or logs.
function bookingHash_(value){
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8)
    .map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');
}
function bookingEmail_(v){
  const email=normalizeEmail_(v);
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid email required');
  return email;
}
function bookingOtpKey_(email){return 'DR_OTP_'+bookingHash_(email).slice(0,48);}
function bookingSessionKey_(token){return 'DR_SESSION_'+bookingHash_(String(token)).slice(0,48);}
function bookingVerifiedRequired_(){
  return configMap_().REQUIRE_BOOKING_VERIFICATION!==false;
}
function requestBookingCode(payload){
  return withLock_(()=>{
  const email=bookingEmail_(payload&&payload.email);
  const cache=CacheService.getScriptCache();
  const key=bookingOtpKey_(email);
  const existing=cache.get(key);
  const now=Date.now();
  if(existing){
    const old=JSON.parse(existing);
    if(now-Number(old.sentAt||0)<120000)
      return {ok:true,message:'If mail delivery is available, a verification code has been sent. Check your inbox.'};
  }
  const code=Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase();
  const obj={hash:bookingHash_(email+'|'+code),sentAt:now,attempts:0};
  cache.put(key,JSON.stringify(obj),600);
  try{
    MailApp.sendEmail({
      to:email,subject:'Družina Moravy — Verification code',
      body:'Your booking verification code: '+code+'\n\nValid for 10 minutes. If you did not request this, ignore this message.'
    });
  }catch(error){
    cache.remove(key);
    throw new Error('Could not send verification email. Try again later.');
  }
  return {ok:true,message:'If mail delivery is available, a verification code has been sent. Check your inbox.'};
  });
}
function verifyBookingCode(payload){
  return withLock_(()=>{
  const email=bookingEmail_(payload&&payload.email);
  const code=String(payload&&payload.code||'').trim().toUpperCase();
  const cache=CacheService.getScriptCache(),key=bookingOtpKey_(email);
  const raw=cache.get(key);
  if(!raw||! /^[A-F0-9]{10}$/.test(code)) throw new Error('Invalid or expired verification code');
  const obj=JSON.parse(raw);
  if(Number(obj.attempts||0)>=5){cache.remove(key);throw new Error('Invalid or expired verification code');}
  if(String(obj.hash)!==bookingHash_(email+'|'+code)){
    obj.attempts=Number(obj.attempts||0)+1;
    if(obj.attempts>=5) cache.remove(key);
    else cache.put(key,JSON.stringify(obj),Math.max(1,Math.ceil((600000-(Date.now()-obj.sentAt))/1000)));
    throw new Error('Invalid or expired verification code');
  }
  cache.remove(key); // one-time code cannot be replayed
    // Never use an unverified phone number as a matching criterion for an old account.
    let member=findMember_(email,'');
    if(!member){
      const name=String(payload&&payload.name||'').trim();
      if(name.length<2||name.length>100) throw new Error('Name required');
      member=ensureMember_({name,email,phone:''});
      const phone=normalizePhone_(payload&&payload.phone);
      if(phone && phone.length<=25 && !findMember_('',phone)){
        patchRow_(SHEETS.MEMBERS,member._row,{Phone:phone});
        member.Phone=phone;
      }
    }
    const token='BKS-'+Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    cache.put(bookingSessionKey_(token),JSON.stringify({memberId:String(member.Member_ID),email}),7200);
    return {ok:true,bookingToken:token,expiresInSeconds:7200};
  });
}
function authorizeBookingMember_(payload){
  if(!bookingVerifiedRequired_()) return ensureMember_(payload&&payload.member||{});
  const token=String(payload&&payload.bookingToken||'');
  if(!/^BKS-[A-Fa-f0-9]{64}$/.test(token)) throw new Error('Email verification required');
  const raw=CacheService.getScriptCache().get(bookingSessionKey_(token));
  if(!raw) throw new Error('Email verification expired. Request a new code.');
  const data=JSON.parse(raw);
  const member=findOne_(SHEETS.MEMBERS,r=>String(r.Member_ID)===String(data.memberId));
  if(!member||normalizeEmail_(member.Email)!==normalizeEmail_(data.email))
    throw new Error('Email verification required');
  return member;
}
