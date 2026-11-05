/* Existing Druzina_Notifications queue and existing hourly maintenance only.
 * Both queue and delivery are separately OFF unless explicitly approved.
 * No marketing, new trigger or participant contact is enabled by installation. */
function drunLocaleForPayment_(payment){
  var locale='';
  rows_(SHEETS.REQUESTS).forEach(function(r){
    if(String(r.Status)!=='COMPLETED')return;
    try{var n=JSON.parse(String(r.Notes||''));if(String(n.quoteId)===String(payment.Source_Request_ID))locale=String(n.locale||'');}catch(_){}
  });
  return ['cs','en','ru','uk'].includes(locale)?locale:'';
}
function drunQueueBookingNotifications(){requireOwner_();return drunQueueBookingNotifications_();}
function drunQueueBookingNotifications_(){
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('DRU_NOTIFICATION_QUEUE_ENABLED')!=='YES'||!drusPaidRelease_().ok)
    return {ok:true,queued:0,disabled:true};
  return withLock_(function(){
    var added=0,seen={};rows_(SHEETS.NOTIFICATIONS).forEach(function(n){seen[String(n.Notification_ID)]=true;});
    rows_(SHEETS.BOOKINGS).forEach(function(b){
      if(String(b.Status)!=='VERIFIED')return;
      var session=sessionById_(b.Session_ID),member=findOne_(SHEETS.MEMBERS,function(m){return String(m.Member_ID)===String(b.Member_ID);}),
        payment=findOne_(SHEETS.PAYMENTS,function(p){return String(p.Payment_ID)===String(b.Payment_ID);});
      if(!session||!member||!payment||!druaBankVerified_(payment)||new Date(session.Start_DateTime).getTime()<=Date.now())return;
      var locale=drunLocaleForPayment_(payment),reason='';
      try{drusRequireMemberConsent_(member);drusRequireSession_(session);}catch(_){reason='CONSENT_OR_SESSION_REVIEW';}
      var consent=consentMap_()[String(member.Member_ID)];
      if(consent&&consent.Guardian_Required==='YES')reason='GUARDIAN_CONTACT_REQUIRES_PRIVATE_REVIEW';
      if(!locale)reason='LOCALE_NOT_RECORDED';
      [['BOOKING_CONFIRMED',Date.now()],['SESSION_REMINDER',new Date(session.Start_DateTime).getTime()-48*3600000]].forEach(function(entry){
        // Do not invent a retroactive reminder after its decision window.
        if(entry[0]==='SESSION_REMINDER'&&entry[1]<Date.now())return;
        var key='NTF-'+bookingHash_(String(b.Booking_ID)+'|'+String(b.Session_ID)+'|'+String(session.Start_DateTime)+'|'+entry[0]);
        if(seen[key])return;seen[key]=true;
        appendObj_(SHEETS.NOTIFICATIONS,{Notification_ID:key,Member_ID:b.Member_ID,Type:entry[0],Channel:'EMAIL',
          Scheduled_At:new Date(entry[1]).toISOString(),Status:reason?'MANUAL_REVIEW':'QUEUED',Related_ID:b.Booking_ID,
          Sent_At:'',Message_Key:entry[0]+'_V1',Notes:JSON.stringify({sessionId:String(b.Session_ID),starts:String(session.Start_DateTime),locale:locale,reason:reason})});
        added++;
      });
    });
    return {ok:true,queued:added};
  });
}
function drunMessage_(locale,type,session){
  var t={cs:['Družina Moravy — rezervace','Vaše rezervace je potvrzena po ověření bankovní platby.','Připomínka potvrzeného tréninku.','Datum a čas','Místo','Před cestou zkontrolujte aktuální pokyny organizátora.'],
    en:['Družina Moravy — booking','Your booking is confirmed after bank verification.','Reminder of your confirmed training.','Date and time','Location','Check the organiser’s current instructions before travelling.'],
    ru:['Družina Moravy — бронь','Бронь подтверждена после банковской проверки.','Напоминание о подтверждённом занятии.','Дата и время','Место','Перед поездкой проверьте актуальные инструкции организатора.'],
    uk:['Družina Moravy — бронювання','Бронювання підтверджено після банківської перевірки.','Нагадування про підтверджене заняття.','Дата й час','Місце','Перед поїздкою перевірте актуальні інструкції організатора.']}[locale];
  if(!t)throw Error('Locale unavailable');
  return {subject:t[0],body:(type==='BOOKING_CONFIRMED'?t[1]:t[2])+'\n'+t[3]+': '+
    Utilities.formatDate(new Date(session.Start_DateTime),'Europe/Prague',"yyyy-MM-dd'T'HH:mm:ss")+' (Europe/Prague)\n'+
    t[4]+': '+String(session.Location||'')+'\n\n'+t[5]};
}
function drunDeliverNotifications(){requireOwner_();return drunDeliverNotifications_();}
function drunDeliverNotifications_(){
  var props=PropertiesService.getScriptProperties();
  if(props.getProperty('DRU_NOTIFICATION_DELIVERY_ENABLED')!=='YES'||!drusPaidRelease_().ok)
    return {ok:true,sent:0,disabled:true};
  var due=rows_(SHEETS.NOTIFICATIONS).filter(function(n){return String(n.Status)==='QUEUED'&&
    String(n.Channel)==='EMAIL'&&['BOOKING_CONFIRMED','SESSION_REMINDER'].includes(String(n.Type))&&
    String(n.Message_Key)===String(n.Type)+'_V1'&&
    Number.isFinite(new Date(n.Scheduled_At).getTime())&&new Date(n.Scheduled_At).getTime()<=Date.now();}).slice(0,10),sent=0;
  due.forEach(function(n){
    var claim=withLock_(function(){
      var current=findOne_(SHEETS.NOTIFICATIONS,function(r){return String(r.Notification_ID)===String(n.Notification_ID);});
      if(!current||String(current.Status)!=='QUEUED')return null;
      try{
        var meta=JSON.parse(String(current.Notes||'')),b=findOne_(SHEETS.BOOKINGS,function(r){return String(r.Booking_ID)===String(current.Related_ID);}),
          m=findOne_(SHEETS.MEMBERS,function(r){return String(r.Member_ID)===String(current.Member_ID);}),s=b?sessionById_(b.Session_ID):null,
          p=b?findOne_(SHEETS.PAYMENTS,function(r){return String(r.Payment_ID)===String(b.Payment_ID);}):null;
        if(!b||String(b.Member_ID)!==String(current.Member_ID)||String(b.Status)!=='VERIFIED'||!s||
            String(b.Session_ID)!==meta.sessionId||String(s.Start_DateTime)!==meta.starts||!p||!druaBankVerified_(p))throw Error('STALE_BOOKING');
        drusRequireMemberConsent_(m);drusRequireSession_(s);
        var consent=consentMap_()[String(m.Member_ID)];
        if(!consent||consent.Guardian_Required!=='NO')throw Error('GUARDIAN_CONTACT_REVIEW');
        if(String(current.Type)==='SESSION_REMINDER'&&bookedCount_(b.Session_ID)<2)throw Error('GROUP_REVIEW_REQUIRED');
        if(new Date(s.Start_DateTime).getTime()<=Date.now())throw Error('SESSION_ALREADY_STARTED');
        var email=bookingEmail_(m.Email),message=drunMessage_(meta.locale,String(current.Type),s);
        patchRow_(SHEETS.NOTIFICATIONS,current._row,{Status:'CLAIMED'});
        return {row:current._row,email:email,message:message};
      }catch(_){patchRow_(SHEETS.NOTIFICATIONS,current._row,{Status:'MANUAL_REVIEW'});return null;}
    });
    if(!claim)return;
    // Claim is durable before SMTP. An interrupted/uncertain send must never
    // be retried automatically, because MailApp has no idempotency guarantee.
    try{
      MailApp.sendEmail({to:claim.email,subject:claim.message.subject,body:claim.message.body});
      withLock_(function(){patchRow_(SHEETS.NOTIFICATIONS,claim.row,{Status:'SENT',Sent_At:nowIso_()});});sent++;
    }catch(_){withLock_(function(){patchRow_(SHEETS.NOTIFICATIONS,claim.row,{Status:'MANUAL_REVIEW'});});}
  });
  return {ok:true,sent:sent};
}
