/* Informational, event-free community promotion on the EXISTING SocialPublishing sheet.
 * Owner must approve every destination. No trigger, OAuth or send happens here.
 * Never treat this virtual source as an actual Events booking or paid HEMA offer.
 */
var SP_COMMUNITY_IDS={
 BRNOWALKERS:'COMMUNITY:BRNOWALKERS',
 DRUZINA:'COMMUNITY:DRUZINA'
};
var SP_COMMUNITY_TARGETS=['telegram','facebook_page','instagram','facebook_profile','whatsapp','youtube','tiktok'];

function spCommunityKey_(eventId){
 var id=String(eventId||'');
 if(id===SP_COMMUNITY_IDS.BRNOWALKERS)return 'BRNOWALKERS';
 if(id===SP_COMMUNITY_IDS.DRUZINA)return 'DRUZINA';
 if(id.indexOf('COMMUNITY:')===0)throw Error('Unknown community ID');
 return '';
}
function spCommunitySource_(job){
 var key=spCommunityKey_(job.Event_ID);
 if(!key)throw Error('Not a community promotion');
 var community=key==='DRUZINA'?'Družina Moravy':'Brnowalkers';
 return {
  row:0,Status:'Active',Category:'Community Info',Community:community,
  Event_ID:SP_COMMUNITY_IDS[key],
  Title:key==='DRUZINA'?'Družina Moravy — community':'BrnoWalkers — community',
  Description:'Informational invitation only; no event or paid booking',
  Telegram_Post_ID:'',Facebook_Post_ID:'',Price_CZK:'',
  Start_DateTime:'',Location_Name:'',Location_Address:''
 };
}
/* Works alongside spEvent_; there is still only ONE source queue and dispatcher. */
/* Video-only ShortFactory references are NOT Events or paid booking records.
 * One canonical SocialPublishing queue, with explicit human rights/route gates.
 * The local publisher is disconnected from Apps Script until an owner reviews
 * and imports a CSV; this resolver never imports or calls social APIs.
 */
function spShortFactoryKey_(eventId){
 var id=String(eventId||''),prefix='MEDIA:SHORTFACTORY:';
 if(id.indexOf(prefix)!==0)return '';
 var key=id.slice(prefix.length);
 if(!/^[a-zA-Z0-9_-]{1,60}$/.test(key))throw Error('Invalid ShortFactory media ID');
 return key;
}
function spShortFactorySource_(job){
 var id=spShortFactoryKey_(job.Event_ID);
 if(!id)throw Error('Not a ShortFactory media source');
 var cap=String(job.Caption||'').trim();
 var entity=String(job.Entity||'');
 if(entity!=='OSVC'&&entity!=='Družina Moravy z.s.')
  throw Error('ShortFactory media legal entity unverified');
 return {
  row:0,Status:'Active',Category:'ShortFactory Media',
  Community:entity==='Družina Moravy z.s.'?'Družina Moravy':'OSVC',
  Event_ID:'MEDIA:SHORTFACTORY:'+id,
  Title:(cap.split('\n').filter(function(x){return x.trim();})[0]||'Original short video').slice(0,100),
  Description:'Owner-reviewed local media reference only; not an event, registration or payment.',
  Start_DateTime:'',Location_Name:'',Location_Address:'',
  Telegram_Post_ID:'',Facebook_Post_ID:'',Price_CZK:''
 };
}
function spShortFactoryPreflight_(event,job){
 var id=spShortFactoryKey_(job.Event_ID);
 if(!id||event.Event_ID!=='MEDIA:SHORTFACTORY:'+id||
    event.Category!=='ShortFactory Media')throw Error('ShortFactory source mismatch');
 var sourcePlatform=job.Channel==='youtube'?'youtube_shorts':
  job.Channel==='tiktok'?'tiktok':'';
 if(!sourcePlatform)throw Error('ShortFactory video adapter not supported for this channel');
 if(String(job.Job_ID)!=='SF-'+id+':'+sourcePlatform)
  throw Error('ShortFactory source/job/channel identity mismatch');
 if(['OSVC','Družina Moravy z.s.'].indexOf(String(job.Entity))<0)
  throw Error('ShortFactory legal entity invalid');
 if(!/^[a-zA-Z0-9_-]{10,200}$/.test(String(job.Video_Drive_ID||'')))
  throw Error('Owner must attach a real Google Drive video ID for media review');
 var text=String(job.Caption||'');
 var site='https://aliaksei-chareshneu.github.io/alchareshneu/';
 if(text.trim().length<20||text.length>6000||text.indexOf(site)<0)
  throw Error('ShortFactory caption requires reviewed factual copy and website CTA');
 if(job.Entity==='Družina Moravy z.s.'&&text.indexOf(site+'druzina/')<0)
  throw Error('Družina video must link to official Družina site');
 if(job.Entity==='OSVC'&&text.indexOf(site+'druzina/')>=0)
  throw Error('Do not route OSVC media to a nonprofit booking CTA');
 // A generic video draft must not claim a specific paid event or its terms.
 if(/\b\d{1,2}[.\/]\d{1,2}[.\/]20\d{2}\b|\b\d{2,6}\s*(?:Kč|CZK|EUR|€)(?=$|[\s.,;])/i.test(text))
  throw Error('ShortFactory media contains dated/priced event claims: use verified Events instead');
 return true;
}
function spSource_(job){
 if(spShortFactoryKey_(job.Event_ID))return spShortFactorySource_(job);
 return spCommunityKey_(job.Event_ID)?spCommunitySource_(job):spEvent_(job.Event_ID);
}
function spCommunityPreflight_(event,job){
 if(event.Category!=='Community Info')return true;
 var key=spCommunityKey_(job.Event_ID);
 if(!key||event.Event_ID!==SP_COMMUNITY_IDS[key])
  throw Error('Community source mismatch');
 if(String(job.Grant_Funded).toUpperCase()!=='NO')
  throw Error('Generic community promotion cannot claim a grant-funded event');
 var text=String(job.Caption||'');
 if(!text.includes('https://'))throw Error('Community invitation requires one public CTA');
 if(/Dukelsk[aá]|čtvrtek|Thursday|четверг|четвер|paid HEMA|placen[ée] sportovn[ií]/i.test(text))
  throw Error('Stale venue/day or paid sports promise in community copy');
 if(/\b\d{1,2}[.\/]\d{1,2}[.\/]20\d{2}\b|\b\d{2,6}\s*(?:Kč|CZK|EUR|€)(?=$|[\s.,;])/i.test(text))
  throw Error('Community-only promotion must not claim an event date or price');
 if(key==='DRUZINA'&&!/Družina Moravy/.test(text))
  throw Error('Družina brand missing from invitation');
 if(key==='BRNOWALKERS'&&!/BrnoWalkers/i.test(text))
  throw Error('BrnoWalkers brand missing from invitation');
 return true;
}
function spCommunityUrl_(key,channel){
 if(key==='DRUZINA'){
  var language=channel==='telegram'?'ru':'en';
  return 'https://aliaksei-chareshneu.github.io/alchareshneu/druzina/join/?lang='+language;
 }
 if(channel==='telegram')
  return 'https://aliaksei-chareshneu.github.io/alchareshneu/walkers/';
 return 'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0';
}
function spCommunityCopy_(key,lang,channel){
 if(!SP_COMMUNITY_IDS[key])throw Error('Unknown brand');
 if(['cs','en','ru','uk'].indexOf(lang)<0)throw Error('Unknown language');
 var url=spCommunityUrl_(key,channel);
 var t={
  BRNOWALKERS:{
   cs:'🥾 BrnoWalkers — výlety, příroda a noví přátelé v Brně a na Moravě. Přidejte se ke komunitě lidí, kteří rádi objevují nová místa. Termín a místo každého setkání oznámíme, až budou potvrzené.',
   en:'🥾 BrnoWalkers — find hiking buddies, explore Brno and Moravia, and meet new people. Follow our community for walks, local adventures and meetups. Exact dates and meeting points are announced once confirmed.',
   ru:'🥾 BrnoWalkers — прогулки, походы и новые знакомства в Брно и Моравии. Присоединяйтесь к сообществу любителей природы и путешествий. Даты и места встреч публикуем после подтверждения.',
   uk:'🥾 BrnoWalkers — прогулянки, походи й нові знайомства у Брно та Моравії. Долучайтеся до спільноти любителів природи та подорожей. Дати й місця зустрічей публікуємо після підтвердження.'
  },
  DRUZINA:{
   cs:'⚔️ Družina Moravy — komunita historie, LARPu a historického šermu v Brně. Zajímá vás společné učení, příběhy a týmová spolupráce? Ozvěte se nezávazně. Konkrétní účast a místo potvrzujeme individuálně; nejde o otevřený prodej sportovních lekcí.',
   en:'⚔️ Družina Moravy — a Brno community for historical fencing, LARP and living history. Meet fellow enthusiasts and ask about getting involved. Dates, venue and eligibility are confirmed individually; no paid sports booking is offered here.',
   ru:'⚔️ Družina Moravy — сообщество любителей истории, LARP и исторического фехтования в Брно. Знакомьтесь с единомышленниками и узнавайте об участии. Дату, место и условия подтверждаем индивидуально; продажи спортивных тренировок здесь нет.',
   uk:'⚔️ Družina Moravy — спільнота прихильників історії, LARP та історичного фехтування у Брно. Знайомтеся з однодумцями й дізнавайтеся про участь. Дату, місце та умови підтверджуємо індивідуально; продажу спортивних тренувань тут немає.'
  }
 };
 var lead={cs:'👉 Více informací:',en:'👉 Learn more:',ru:'👉 Подробнее:',uk:'👉 Докладніше:'};
 return t[key][lang]+'\n\n'+lead[lang]+' '+url;
}
function spCommunityCaption_(key,channel){
 if(channel==='telegram')return spCommunityCopy_(key,'ru',channel);
 if(channel==='facebook_page')return spCommunityCopy_(key,'cs',channel);
 return spCommunityCopy_(key,'en',channel);
}
/* Creates no duplicate (community, platform) row, even if an earlier one is a draft.
 * All seven destinations are DRAFT; image/video API prerequisites are intentionally unset.
 * Never include a private participant group, business phone roster or third-party FB group.
 */
function spCommunityPrepare_(key){
 if(!SP_COMMUNITY_IDS[key])throw Error('Unknown community');
 var sheet=spJobs_(),seen=spItems_(sheet),n=0,id=SP_COMMUNITY_IDS[key];
 SP_COMMUNITY_TARGETS.forEach(function(channel){
  if(seen.some(function(x){return String(x.Event_ID)===id&&String(x.Channel)===channel;}))return;
  var j={
   Duplicate_Checked:'',Job_ID:Utilities.getUuid(),Event_ID:id,
   Channel:channel,Scheduled_At:new Date(),Status:'DRAFT',
   Caption:spCommunityCaption_(key,channel),Media_URL:'',Video_Drive_ID:'',
   Post_ID:'',Post_URL:'',Attempted_At:'',
   Error:'Review existing FB/Telegram/WA posts, brand permissions and media rights before approval.',
   Entity:key==='DRUZINA'?'Družina Moravy z.s.':'BrnoWalkers — informational community (no sale)',
   Grant_Funded:'NO',Grant_Text:'',Rights_OK:'',Approved_At:'',
   Visibility:'private',Made_For_Kids:''
  };
  sheet.appendRow(SP_COLS.map(function(col){return j[col];}));
  n++;
 });
 return n;
}
function spPrepareBrnoWalkersCommunity(){
 var n=spCommunityPrepare_('BRNOWALKERS');
 SpreadsheetApp.getUi().alert('BrnoWalkers: '+n+' new DRAFT rows in existing SocialPublishing. Check duplicates and approve individually.');
}
function spPrepareDruzinaCommunity(){
 var n=spCommunityPrepare_('DRUZINA');
 SpreadsheetApp.getUi().alert('Družina Moravy: '+n+' new DRAFT rows in existing SocialPublishing. NO paid sports bookings.');
}
