function doGet(e){
  const params=(e&&e.parameter)||{};
  const mode=['manage','trainer','hub'].includes(params.mode)?params.mode:'book';
  // Render HTML without holding a Sheets lock on a guest page request.
  // Session generation happens in getBootstrap/getTrainerSessions and maintenance.
  // The private hub never loads private data until its admin-key check.
  const t=HtmlService.createTemplateFromFile(mode==='hub'?'Hub':'Index');
  t.mode=mode;
  const token=String(params.token||'');
  t.token=t.mode==='manage'&&/^MNG-[A-F0-9]{16}$/.test(token)?token:'';
  return t.evaluate().setTitle(mode==='hub'?'Družina Moravy — Operations':'Družina Moravy — Training Booking').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(name){ return HtmlService.createHtmlOutputFromFile(name).getContent(); }

function getBootstrap(){
  const release=drusPaidRelease_();
  const sessions=release.ok?listSessionsPublic_():[];
  const active=release.ok&&drusApprovedProductActive_();
  const available=active&&sessions.some(s=>Number(s.available)>0);
  return {version:APP.VERSION,now:new Date().toISOString(),
    sessions:available?sessions:[],
    policy:policyVersion_(),tariff:currentTariff_(),
    location:'Confirmed venue supplied for approved session only',
    bookingEnabled:available,bookingStatus:available?'AVAILABLE':'PAUSED',
    enquiryUrl:DRUS_ENQUIRY_URL};
}
function identifyMember(payload){
  // A guessed email or phone never proves ownership. No existence or profile oracle.
  return {ok:true,message:'Use the private management link sent to your registered email.'};
}

function getEligibleProducts(payload){
  drusRequirePaid_();
  const m=authorizeBookingMember_(payload);
  drusRequireMemberConsent_(m); refreshMemberAccount_(m);
  // Unverified contact input must never disclose a member ID, name, rank or debt.
  if(memberBlocked_(m)) return {member:{status:'HOLD'},products:[],blocked:true};

  const products=[];
  if(isTrialEligible_(m)) products.push({code:isNovEffectiveFor_(new Date())?'DRU-FIRSTVISIT-202611':'DRU-TRIAL',name:'First training',price:isNovEffectiveFor_(new Date())?240:120,type:'TRIAL',sessions:1});

  const current=tariffForDate_(new Date());
  if(String(m.Tier)==='Senior') products.push({code:isNovEffectiveFor_(new Date())?'DRU-SENIOR-FLEX-202611':'DRU-SENIOR-DROPIN',name:'Senior Flex / single',price:current.seniorFlex,type:'FLEX',sessions:1});
  else products.push({code:isNovEffectiveFor_(new Date())?'DRU-JUNIOR-FLEX-202611':'DRU-JUNIOR-DROPIN',name:'Junior Flex / single',price:current.juniorFlex,type:'FLEX',sessions:1});

  if(novPackageSalesOpen_()){
    if(String(m.Tier)!=='Senior'){
      const up=starterUpgradeEligibility_(m);
      if(up) products.push({code:'DRU-STARTER4-202611',name:'Starter 4 — Trial credited',price:560,packagePrice:800,type:'PACKAGE_UPGRADE',sessions:3,trialUpgradeBookingId:up.bookingId,trialCredit:240});
      else products.push({code:'DRU-STARTER4-202611',name:'Starter 4',price:800,type:'PACKAGE',sessions:4});
    }
  }
  const sale=productMap_();
  const eligible=products.filter(p=>sale[p.code]&&String(sale[p.code].Active).toUpperCase()==='TRUE');
  return {member:{status:'ACTIVE'},products:eligible,blocked:false};
}

function getSessionOffer(payload){
  drusRequirePaid_();
  const m=authorizeBookingMember_(payload);
  drusRequireMemberConsent_(m); refreshMemberAccount_(m); assertMemberCanBook_(m);
  const s=sessionById_(payload.sessionId); if(!s) throw new Error('Session not found');
  drusRequireSession_(s);
  const w=windowFor_(s.Start_DateTime); const code=productForWindow_(m.Tier,s.Start_DateTime);
  return {window:w,productCode:code,price:code?effectivePrice_(code):null,available:availableCapacity_(s),policy:policyVersionForDate_(s.Start_DateTime)};
}
