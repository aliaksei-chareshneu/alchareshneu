function ensureQuotesSheet_() {
  if (ss_().getSheetByName(SHEETS.QUOTES)) return;
  const sh=ss_().insertSheet(SHEETS.QUOTES);
  sh.appendRow(['Quote_ID','Member_ID','Created_At','Expires_At','Status','Cart_JSON','Expected_Amount_CZK','Payment_Reference','Policy_Version','Notes']);
  sh.setFrozenRows(1);
}

function cleanupExpiredHolds_() {
  const now=new Date();
  rows_(SHEETS.HOLDS).forEach(r=>{
    if(String(r.Status)==='ACTIVE' && new Date(r.Expires_At)<=now) patchRow_(SHEETS.HOLDS,r._row,{Status:'EXPIRED'});
  });
  if (ss_().getSheetByName(SHEETS.QUOTES)) rows_(SHEETS.QUOTES).forEach(r=>{
    if(String(r.Status)==='OPEN' && new Date(r.Expires_At)<=now) patchRow_(SHEETS.QUOTES,r._row,{Status:'EXPIRED'});
  });
}

function createQuote(payload) {
  drusRequirePaid_(); // No holds, member mutations or payment promises when closed.
  return withLock_(()=>{
    const member=authorizeBookingMember_(payload);
    drusRequireMemberConsent_(member); // auth gate before any new holds or sheet writes
    ensureQuotesSheet_(); cleanupExpiredHolds_(); ensureSessions_();
    refreshMemberAccount_(member);
    assertMemberCanBook_(member);
    const items=Array.isArray(payload.items)?payload.items:[];
    if(!items.length) throw new Error('Your cart is empty');
    if(items.filter(it=>['DRU-TRIAL','DRU-FIRSTVISIT-202611'].includes(String(it.productCode))).length>1) throw new Error('Only one Trial may be booked');
    if(items.filter(it=>it.trialUpgradeBookingId).length>1) throw new Error('Trial credit may only be used once');
    const normalized=[]; let total=0; const cartSessionSeen={};
    let packageFirst=null, packageLast=null;

    items.forEach(item=>{
      const code=String(item.productCode||'');
      const pkg=packageInfo_(code);
      const listed=productMap_()[code];
      if(!listed||String(listed.Active).toUpperCase()!=='TRUE')
        throw new Error('Product has not been released for sale');
      if(pkg){
        if(code!=='DRU-STARTER4-202611')
          throw new Error('This package is staged, not released');
        const upgradeId=String(item.trialUpgradeBookingId||'');
        let upgrade=null, required=pkg.sessions, packageStart=null, dueNow=pkg.price;
        if(code==='DRU-STARTER4-202611' && upgradeId){
          upgrade=starterUpgradeEligibility_(member);
          if(!upgrade || upgrade.bookingId!==upgradeId) throw new Error('Trial-to-Starter upgrade is no longer eligible');
          required=pkg.sessions-1; dueNow=pkg.price-upgrade.credit; packageStart=new Date(upgrade.start);
        }
        const ids=Array.isArray(item.sessionIds)?item.sessionIds.map(String):[];
        if(ids.length!==required) throw new Error(pkg.name+' requires exactly '+required+' future dates'+(upgrade?' after the credited Trial':''));
        const seen={}; const dates=[];
        ids.forEach(sid=>{
          if(seen[sid] || cartSessionSeen[sid]) throw new Error('Duplicate session selected');
          seen[sid]=true; cartSessionSeen[sid]=true;
          const ses=sessionById_(sid); validateSessionProduct_(member,code,ses);
          if(availableCapacity_(ses)<1) throw new Error('A selected session is full');
          dates.push(new Date(ses.Start_DateTime));
        });
        dates.sort((a,b)=>a-b);
        if(!packageStart) packageStart=dates[0];
        if((dates[dates.length-1]-packageStart)>30*86400000) throw new Error('All package dates must fit inside 30 days from the package first session');
        const rate=drubQuoteItem({nowISO:new Date().toISOString(),
          sessionStartsAt:dates[0].toISOString(),type:upgrade?'STARTER4_UPGRADE':'STARTER4',
          tier:'JUNIOR',selectedSessions:dates.map(d=>d.toISOString()),
          verifiedFirstAttendance:upgrade?{verified:true,paymentVerified:true,
            creditAlreadyUsed:false,sessionId:upgrade.sessionId,
            amountReceivedCZK:240,attendedAt:upgrade.end}:undefined});
        if(!rate.ok||rate.amountCZK!==dueNow)
          throw new Error('Server package price/cutoff mismatch: '+(rate.code||'INVALID'));
        packageFirst=packageStart; packageLast=dates[dates.length-1];
        normalized.push({kind:upgrade?'PACKAGE_UPGRADE':'PACKAGE',productCode:code,sessionIds:ids,qty:1,unitAmount:dueNow,lineTotal:dueNow,name:upgrade?(pkg.name+' — Trial credit'):pkg.name,packagePrice:pkg.price,trialCredit:upgrade?upgrade.credit:0,trialUpgradeBookingId:upgrade?upgrade.bookingId:'',policyVersion:policyVersionForDate_(packageStart)});
        total+=dueNow;
      } else {
        const sid=String(item.sessionId||'');
        if(cartSessionSeen[sid]) throw new Error('Duplicate session selected');
        cartSessionSeen[sid]=true;
        const ses=sessionById_(sid);
        const win=validateSessionProduct_(member,code,ses);
        if(availableCapacity_(ses)<1) throw new Error('This session is full');
        const price=effectivePrice_(code);
        if(isNovEffectiveFor_(ses.Start_DateTime)){
          const type=code==='DRU-FIRSTVISIT-202611'?'FIRST_VISIT':'FLEX';
          const rate=drubQuoteItem({nowISO:new Date().toISOString(),
            sessionStartsAt:new Date(ses.Start_DateTime).toISOString(),type,
            tier:String(member.Tier).toUpperCase()==='SENIOR'?'SENIOR':'JUNIOR',
            existingMemberVerified:true,firstVisitEligible:type==='FIRST_VISIT'});
          if(!rate.ok||rate.amountCZK!==price)
            throw new Error('Server price/cutoff mismatch: '+(rate.code||'INVALID'));
        }
        normalized.push({kind:'SESSION',productCode:code,sessionId:sid,qty:1,unitAmount:price,lineTotal:price,name:String(productMap_()[code].Offer||code),cutoff:win,policyVersion:policyVersionForDate_(ses.Start_DateTime)});
        total+=price;
      }
    });

    const qid=id_('Q'); const expires=new Date(Date.now()+APP.HOLD_MINUTES*60000); const pref='DRU'+Utilities.formatDate(new Date(),APP.TIMEZONE,'MMdd')+qid.slice(-6);
    normalized.forEach(it=>{
      const ids=(it.kind==='PACKAGE'||it.kind==='PACKAGE_UPGRADE')?it.sessionIds:[it.sessionId];
      ids.forEach(sid=>appendObj_(SHEETS.HOLDS,{Hold_ID:id_('HLD'),Session_ID:sid,Member_ID:member.Member_ID,Request_ID:qid,Product_Code:it.productCode,Created_At:nowIso_(),Expires_At:expires.toISOString(),Status:'ACTIVE',Qty:1,Notes:'Checkout capacity hold; cutoff not frozen'}));
    });
    const policies=[...new Set(normalized.map(x=>x.policyVersion).filter(Boolean))].join('+');
    appendObj_(SHEETS.QUOTES,{Quote_ID:qid,Member_ID:member.Member_ID,Created_At:nowIso_(),Expires_At:expires.toISOString(),Status:'OPEN',Cart_JSON:JSON.stringify(normalized),Expected_Amount_CZK:total,Payment_Reference:pref,Policy_Version:policies,Notes:packageFirst?('Package window '+packageFirst.toISOString()+' .. '+packageLast.toISOString()):''});
    return {quoteId:qid,expiresAt:expires.toISOString(),amount:total,paymentReference:pref,items:normalized,member:publicMemberState_(member),paymentUrl:paymentUrl_()};
  });
}

function paymentUrl_(){
  // No generic Revolut URL; destination must match the authorized seller and
  // quote-specific bank reference, verified independently before release.
  return '';
}
function quoteById_(qid){
  ensureQuotesSheet_(); return findOne_(SHEETS.QUOTES,r=>String(r.Quote_ID)===String(qid));
}

function revalidateQuote_(quote,member){
  drusRequirePaid_();
  drusRequireMemberConsent_(member);
  if(!quote || String(quote.Status)!=='OPEN') throw new Error('Quote is no longer open');
  if(new Date(quote.Expires_At)<=new Date()) throw new Error('Quote expired; please refresh prices and dates');
  assertMemberCanBook_(member);
  const items=JSON.parse(String(quote.Cart_JSON||'[]'));
  items.forEach(it=>{
    if(it.kind==='PACKAGE' || it.kind==='PACKAGE_UPGRADE'){
      if(it.kind==='PACKAGE_UPGRADE'){
        const up=starterUpgradeEligibility_(member);
        if(!up || up.bookingId!==String(it.trialUpgradeBookingId)) throw new Error('Trial-to-Starter upgrade expired; please refresh');
      }
      it.sessionIds.forEach(sid=>{ const ses=sessionById_(sid); validateSessionProduct_(member,it.productCode,ses); if(availableCapacity_(ses,quote.Quote_ID)<1) throw new Error('A selected session is full'); });
      const dates=it.sessionIds.map(sid=>new Date(sessionById_(sid).Start_DateTime)).sort((a,b)=>a-b);
      const start=it.kind==='PACKAGE_UPGRADE'?new Date(starterUpgradeEligibility_(member).start):dates[0];
      if(dates[dates.length-1]-start>30*86400000) throw new Error('All package dates must fit inside 30 days');
      if(it.lineTotal!==packageInfo_(it.productCode).price-(it.kind==='PACKAGE_UPGRADE'?240:0)) throw new Error('Package price changed; refresh checkout');
    } else { const ses=sessionById_(it.sessionId); validateSessionProduct_(member,it.productCode,ses); if(availableCapacity_(ses,quote.Quote_ID)<1) throw new Error('This session is full'); }
    if(it.kind==='SESSION'&&it.lineTotal!==effectivePrice_(it.productCode)) throw new Error('Price changed; refresh checkout');
  });
  return items;
}
