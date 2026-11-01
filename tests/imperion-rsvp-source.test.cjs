'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const front=fs.readFileSync('register/index.html','utf8');
const privacy=fs.readFileSync('register/privacy/index.html','utf8');
const safety=fs.readFileSync('register/safety/index.html','utf8');
const fn=fs.readFileSync('supabase/functions/imperion-register/index.ts','utf8');
for(const id of ['eventId','firstName','lastName','email','phone','safety','photo','future','submit'])
 assert.ok(front.includes('id="'+id+'"'),'missing '+id);
for(const loc of ['cs','en','ru','uk']){
 assert.ok(front.includes('data-lang="'+loc+'"'),'lang missing '+loc);
 assert.ok(privacy.includes('id="'+loc+'"')&&safety.includes('id="'+loc+'"'),'policy missing '+loc);
}
assert.ok(!front.includes('SUPABASE_SERVICE_ROLE_KEY'));
assert.ok(front.includes("cache:'no-store'"));
for(const contact of ['function receiptContacts(', 'https://t.me/Chareshneu','https://wa.me/420702914842','mailto:chereshnev.biochem@gmail.com']) assert.ok(front.includes(contact),'RSVP confirmation contact missing: '+contact);
const communityInvites=require('../register/community-invites.js');
const channels={
 'Družina Moravy':{
  cs:'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu',
  en:'https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu',
  ru:'https://t.me/druzinamoravy_news',
  uk:'https://t.me/druzinamoravy_news'
 },
 Brnowalkers:{
  cs:'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0',
  en:'https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0',
  ru:'https://t.me/pochody_brno_news',
  uk:'https://t.me/pochody_brno_news'
 }
};
for(const [community,links] of Object.entries(channels)){
 for(const [locale,url] of Object.entries(links)){
  const route=communityInvites.resolve(community,locale,'adult','YES');
  assert.equal(route.url,url,'Wrong channel for '+community+' '+locale);
  assert.equal(route.platform,(locale==='ru'||locale==='uk')?'Telegram':'WhatsApp');
  assert.equal(route.chatAfterVisits,community==='Družina Moravy'?2:1);
  assert.ok(route.chatInfo.includes(String(route.chatAfterVisits)));
  assert.equal(communityInvites.resolve(community,locale,'adult','MAYBE').url,url);
  assert.equal(communityInvites.resolve(community,locale,'under18','YES'),null,'Minors must never be auto-invited');
  assert.equal(communityInvites.resolve(community,locale,'adult','NO'),null,'Declined RSVP must not be invited');
 }
}
const publicRouter=fs.readFileSync('register/community-invites.js','utf8');
for(const secretInvite of [
 'https://t.me/druzinamoravy',
 'https://t.me/pochody_brno',
 'https://chat.whatsapp.com/JzeXAQF8I2XE3zQ2OqWsPz',
 'https://chat.whatsapp.com/JCyEJNm746nBXNll3VzzX3'
]){
 assert.ok(!publicRouter.includes(secretInvite),'Participant chat invite leaked to public router: '+secretInvite);
 for(const locale of ['cs','en','ru','uk']){
  const page=fs.readFileSync(locale==='cs'?'register/index.html':'register/'+locale+'/index.html','utf8');
  assert.ok(!page.includes(secretInvite),'Participant chat invite leaked to public registration '+locale);
 }
}

assert.equal(communityInvites.resolve('Unknown','ru','adult','YES'),null);
assert.equal(communityInvites.resolve('BrnoWalkers Družina Moravy','ru','adult','YES'),null);
assert.equal(communityInvites.resolve('Družina Moravy','de','adult','YES'),null);
assert.equal(communityInvites.resolve('Družina Moravy','ru','adult','NO'),null);
assert.ok(!Object.values(channels).some(byLang=>Object.values(byLang).some(url=>url.includes('JCyEJNm746nBXNll3VzzX3'))),'Private chat must not be invited on registration');
assert.ok(front.includes('receiptContacts(el,eventData,body,payload);'),'Only a successful RSVP should show event-specific follow-up channels');
for(const loc of ['cs','en','ru','uk']){
 const path=loc==='cs'?'register/index.html':'register/'+loc+'/index.html';
 const html=fs.readFileSync(path,'utf8');
 const scriptTag=loc==='cs'?'<script src="./community-invites.js"></script>':'<script src="../community-invites.js"></script>';
 assert.ok(html.includes(scriptTag),'Shared community router missing in '+loc);
 assert.ok(html.includes('IMPERION_COMMUNITY_INVITES?.resolve('),'Post-success invitation render missing in '+loc);
 assert.ok(html.includes('communityInvite.chatInfo'),'Chat access guidance missing in '+loc);
 assert.ok(!html.includes('JCyEJNm746nBXNll3VzzX3'),'Private BrnoWalkers chat must not be shown on registration '+loc);
}

assert.ok(fn.includes(".select(EVENT_COLS+',updates_group_url').eq('event_id',v.eventId)"),
 'POST must selectively fetch the event logistics group link');
assert.ok(fn.includes("const EVENT_COLS='") &&
 !fn.split('const EVENT_COLS=')[1].split(';')[0].includes('updates_group_url'),
 'anonymous GET catalog must not expose WhatsApp invite');
assert.ok(fn.includes("v.age==='adult' && v.rsvp!=='NO'"),
 'no group invite for minors or declined RSVPs');
// Duplicate submissions are intentionally idempotent: a public request cannot
// disclose whether someone else's name/email already appears in the database.
// The receipt therefore says "processed" rather than falsely claiming a new row.
for (const phrase of [
 'nový záznam nevznikne',
 'no second entry was created',
 'новая запись не создаётся',
 'нового запису не буде',
 'Další zprávu posílat nemusíte',
 'no extra message is needed',
 'писать дополнительно не нужно',
 'додатково писати не потрібно',
]) assert.ok(front.includes(phrase), 'privacy-safe duplicate acknowledgement missing: '+phrase);
for (const stale of [
 'please send the organiser a short message',
 'pošlete prosím pořadateli krátkou zprávu',
 'напишите организатору короткое сообщение',
 'напишіть організатору коротке повідомлення',
]) assert.ok(!front.includes(stale), 'duplicate second-contact requirement remains: '+stale);
assert.ok(fn.includes('imperion_rsvp_allow_request'));
assert.ok(fn.includes('writeError.code!==\'23505\''));
assert.ok(fn.includes("origin!==ALLOWED_ORIGIN"));
assert.ok(front.includes('id="safety" type="checkbox" required'));
const s=front.match(/<script>\s*('use strict';[\s\S]*?)\s*<\/script>/);
assert.ok(s,'inline application script missing');new vm.Script(s[1]);
const start=fs.readFileSync('start/index.html','utf8');
for(const l of ['en','cs','ru','uk']) assert.ok(start.includes('href="../register/'+(l==='cs'?'':l+'/')+'?event=PUB-HIKE-20261101"'),'No localized hike CTA '+l);
const root='https://aliaksei-chareshneu.github.io/alchareshneu/register/';
const pages={cs:['register/index.html',root,'Registrace na akce v Brně'],en:['register/en/index.html',root+'en/','Register for Brno hikes'],ru:['register/ru/index.html',root+'ru/','Регистрация на походы'],uk:['register/uk/index.html',root+'uk/','Реєстрація на походи']};
const locales=Object.keys(pages),scriptSource=s[1];
for(const locale of locales){
  const [path,url,heading]=pages[locale],page=fs.readFileSync(path,'utf8');
  assert.ok(page.startsWith('<!doctype html>'),'doctype '+locale);
  assert.ok(page.includes('<html lang="'+locale+'">'),'html lang '+locale);
  assert.ok(page.includes('<meta name="robots" content="index,follow,max-image-preview:large">'),'indexable '+locale);
  assert.ok(page.includes('<link rel="canonical" href="'+url+'">'),'canonical '+locale);
  assert.ok(page.includes('og:image')&&page.includes('og:description')&&page.includes('twitter:card'),'social metadata '+locale);
  assert.ok(page.includes(heading),'visible localized text '+locale);
  assert.ok(page.includes('id="eventId" required')&&page.includes('id="retry"'),'form and retry '+locale);
  assert.ok(page.includes('id="result" class="state" role="status" aria-live="polite" tabindex="-1"'),'accessible feedback '+locale);
  assert.ok(!page.includes('"@type":"Event"'),'listing page must not masquerade as event leaf '+locale);
  assert.ok(page.includes('<link rel="alternate" hreflang="x-default"'),'fallback hreflang '+locale);
  for(const other of locales)assert.ok(page.includes('<link rel="alternate" hreflang="'+other+'" href="'+pages[other][1]+'">'),'reciprocal hreflang '+locale+'/'+other);
  const scripts=page.match(/<script>\s*('use strict';[\s\S]*?)\s*<\/script>/);
  assert.ok(scripts&&scripts[1]===scriptSource,'application script drift '+locale);
  new vm.Script(scripts[1]);
}
const sitemap=fs.readFileSync('sitemap.xml','utf8');
for(const [path,url] of Object.values(pages))assert.ok(sitemap.includes('<loc>'+url+'</loc>'),'sitemap '+url);
for(const path of ['register/privacy/index.html','register/safety/index.html']) assert.ok(fs.readFileSync(path,'utf8').includes('content="noindex,follow"'),'legal noindex '+path);
// Every PUB event gets a canonical localized deep link; the backend alone decides if its registration is open.
const calendar=fs.readFileSync('calendar/index.html','utf8');
assert.ok(/id="navBookBtn"[^>]+href="\.\.\/register\/"/.test(calendar),'calendar header does not link to live registration');
assert.ok(/class="mobile-cta-btn"[^>]+href="\.\.\/register\/"/.test(calendar),'calendar mobile CTA does not link to live registration');
assert.ok(calendar.includes("/^PUB-[A-Z0-9-]{4,90}$/.test(String(ev.id || ''))"),'public event ID gate missing');
assert.ok(calendar.includes("'?event=' + encodeURIComponent(ev.id) + '&lang='"),'localized per-event deep link missing');
assert.ok(calendar.includes("safeHttpsUrl(ev.registerUrl, document.querySelector('#navBookBtn').getAttribute('href'))"),'fallback non-public event links not retained');
const walkers=fs.readFileSync('walkers/index.html','utf8');
assert.ok(walkers.includes('a[href^="../register/"]'),'walker locale-aware signup');
assert.ok(!walkers.includes('href="https://wa.me/420702914842?text=Hello%2C%20I%27d%20like%20to%20ask%20about%20a%20BrnoWalkers%20event.'),'walker legacy CTA');
console.log('PASS: 4 indexable, canonical, hreflang and self-contained registration forms; SEO and UX checks');


// The same site lists a free event, so every language must explain both paid/free
// sessions and must not invite people to paused Tuesday board game sessions.
for(const t of ['Some events are free and others are paid','Есть бесплатные и платные мероприятия','Pořádáme bezplatné i placené akce','Є безкоштовні й платні заходи']) assert.ok(walkers.includes(t),'price disclosure missing '+t);
for(const outdated of ['Activities are paid.','Мероприятия платные.','Akce jsou placené.','Заходи платні.','настольные игры по вторникам','úterní herní večer','настільні ігри по вівторках','Payment confirms your spot — without payment your place is not reserved.'])assert.ok(!walkers.includes(outdated),'contradictory FAQ copy '+outdated);

for(const locale of locales){const page=fs.readFileSync(pages[locale][0],'utf8');assert.ok(page.includes("e.price_verified===false?t('payment')"),'unknown price incorrectly shown as free '+locale)}
assert.ok(fn.includes(".eq('source_active',true)"),'withdrawn feed entries must reject POST');
assert.ok(fn.includes(".eq('price_verified',true)"),'unverified price must reject POST');

assert.ok(front.includes("e.registration_mode!=='FORM'")&&front.includes("e.end_time_verified!==true"),'RSVP must fail closed on incomplete event verification');

// The client cannot be the authority for event approval. A forged POST must
// not bypass withdrawn-source or unverified-end-time gates in production.
assert.ok(fn.includes(".eq('end_time_verified',true)"),
  'server POST must reject events whose end time is not verified');
assert.ok(fn.includes(".eq('public_listing',true).eq('source_active',true)"),
  'server GET must not advertise withdrawn source events');
assert.ok(fn.includes(".eq('source_active',true)"),
  'server POST must reject withdrawn source events');

// Event-specific invitation may appear only after a successful POST response.
// The static pages and anonymous GET must never disclose the invite itself.
for(const loc of ['cs','en','ru','uk']){
 const source=fs.readFileSync(loc==='cs'?'register/index.html':'register/'+loc+'/index.html','utf8');
 assert.ok(source.includes("payload?.updatesGroupUrl"),'POST-only invitation missing '+loc);
 assert.ok(source.includes('eventInvite'),'event invitation gate missing '+loc);
 assert.ok(!source.includes('ECVnqiJJUuI8MJvDLXkS6s'),'event invitation leaked to public JS '+loc);
}
