function getManageState(token){
  const m=memberByToken_(token); if(!m) throw new Error('Invalid management link');
  refreshMemberAccount_(m);
  const bookings=findAll_(SHEETS.BOOKINGS,r=>String(r.Member_ID)===String(m.Member_ID)&&new Date(sessionById_(r.Session_ID)?.Start_DateTime||0)>new Date()&&['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED'].includes(String(r.Status))).map(r=>{
    const s=sessionById_(r.Session_ID); return {bookingId:String(r.Booking_ID),sessionId:String(r.Session_ID),start:new Date(s.Start_DateTime).toISOString(),theme:String(s.Theme||''),status:String(r.Status),canMove:windowFor_(s.Start_DateTime)==='STANDARD' && !memberBlocked_(m)};
  }).sort((a,b)=>new Date(a.start)-new Date(b.start));
  return {member:publicMemberState_(m),bookings,sessions:listSessionsPublic_()};
}

function rescheduleBooking(payload){
  return withLock_(()=>{
    const m=memberByToken_(payload.token); if(!m) throw new Error('Invalid management link'); refreshMemberAccount_(m);
    assertMemberCanBook_(m);
    const b=findOne_(SHEETS.BOOKINGS,r=>String(r.Booking_ID)===String(payload.bookingId)&&String(r.Member_ID)===String(m.Member_ID)); if(!b) throw new Error('Booking not found');
    if(!['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED'].includes(String(b.Status))) throw new Error('This booking cannot be moved');
    const source=sessionById_(b.Session_ID);
    if(!source||windowFor_(source.Start_DateTime)!=='STANDARD') throw new Error('This booking is inside the 48-hour lock window');
    const dest=sessionById_(payload.newSessionId); if(!dest) throw new Error('Destination session not found');
    if(String(dest.Status||'OPEN')!=='OPEN') throw new Error('Destination session is not open');
    if(windowFor_(dest.Start_DateTime)!=='STANDARD') throw new Error('Destination must be at least 48 hours away');
    if(String(dest.Session_ID)===String(b.Session_ID)) return {ok:true,state:getManageState(payload.token)};
    if(findOne_(SHEETS.BOOKINGS,r=>String(r.Member_ID)===String(m.Member_ID)&&String(r.Session_ID)===String(dest.Session_ID)&&['PROVISIONAL_CONFIRMED','VERIFIED','CONFIRMED','ATTENDED','NO_SHOW'].includes(String(r.Status)))) throw new Error('You already have a booking for this session');
    if(b.Plan_ID){
      const plan=findOne_(SHEETS.PLANS,r=>String(r.Plan_ID)===String(b.Plan_ID));
      if(!plan||String(plan.Status)!=='ACTIVE') throw new Error('Package is not active');
      if(new Date(dest.Start_DateTime)<new Date(plan.Start_Date)||new Date(dest.Start_DateTime)>new Date(plan.End_Date)) throw new Error('Destination must be inside package validity');
    }else if(normalFlexPriceFor_(m,source.Start_DateTime)!==normalFlexPriceFor_(m,dest.Start_DateTime)) throw new Error('Destination has a different tariff; contact the organizer');
    if(availableCapacity_(dest)<1) throw new Error('Destination session is full');
    const oldSession=b.Session_ID;
    patchRow_(SHEETS.BOOKINGS,b._row,{Session_ID:dest.Session_ID,Reschedule_Deadline:new Date(new Date(dest.Start_DateTime).getTime()-48*3600000).toISOString(),Rescheduled_From:oldSession});
    refreshSessionCounts_(oldSession); refreshSessionCounts_(dest.Session_ID);
    audit_('member','Booking',b.Booking_ID,'RESCHEDULE',oldSession,dest.Session_ID,'Self-service');
    return {ok:true,state:getManageState(payload.token)};
  });
}

function requestManagementLink(payload){
  // Explicit member request: send only to the stored address, never reflect a token.
  const response={ok:true,message:'If this email is registered, a management link will be sent. Check your inbox.'};
  const email=normalizeEmail_(payload&&payload.email);
  if(!email) return response;
  return withLock_(()=>{
    const m=findOne_(SHEETS.MEMBERS,r=>normalizeEmail_(r.Email)===email);
    if(!m) return response;
    const portal=String(configMap_().PORTAL_URL||'');
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(portal)) throw new Error('Management email is not available yet');
    const props=PropertiesService.getScriptProperties(), key='MANAGE_LINK_SENT_'+String(m.Member_ID);
    const last=Number(props.getProperty(key)||0);
    if(last&&Date.now()-last<5*60000) return response;
    let token=String(m.Manage_Token||'');
    if(!token){ token=id_('MNG'); patchRow_(SHEETS.MEMBERS,m._row,{Manage_Token:token}); }
    MailApp.sendEmail({to:email,subject:'Družina Moravy — Manage your trainings',body:'Your private management link:\n'+portal+'?mode=manage&token='+encodeURIComponent(token)+'\n\nKeep this link private. If you did not request it, you can ignore this email.'});
    props.setProperty(key,String(Date.now()));
    return response;
  });
}
