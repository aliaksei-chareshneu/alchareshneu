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
assert.ok(front.includes('receiptContacts(el,eventData,body,payload);'),'Only a successful RSVP should show follow-up channels');
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

const druzinaGateway=fs.readFileSync('druzina/registrace/index.html','utf8');
for(const phrase of [
  'Po odeslání žádosti může přijít automatické e-mailové potvrzení přijetí',
  'A transactional email acknowledgement may arrive',
  'может прийти автоматическое письмо о получении заявки',
  'може надійти автоматичний лист про отримання заявки',
  'Není to potvrzení rezervace',
  'not a booking',
  'НЕ подтверждает бронирование',
  'НЕ підтверджує бронювання',
]) assert.ok(druzinaGateway.includes(phrase),'Druzina public receipt notice must reflect live transactional email, not booking: '+phrase);
for(const obsolete of [
  'Automated attendee emails, WhatsApp messages and a secure personal account are NOT live',
  'Автоматические письма участникам, WhatsApp-сообщения',
]) assert.ok(!druzinaGateway.includes(obsolete),'outdated Druzina notice: '+obsolete);

for(const [locale,path] of Object.entries({cs:'register/index.html',en:'register/en/index.html',ru:'register/ru/index.html',uk:'register/uk/index.html'})){
 const html=fs.readFileSync(path,'utf8');
 assert.ok(html.includes("mode==='FORM'&&Number(e.price_czk)>0"),'paid interest-only warning missing: '+locale);
 assert.ok(html.includes("const publicNote=String(e.public_note||'').trim().slice(0,1600)"),'authoritative event public_note must be shown: '+locale);
 assert.ok(html.includes('details.textContent=publicNote'), 'public_note must be rendered as textContent: '+locale);
 for(const notice of [
 'Pouze nezávazný zájem, ne rezervace ani platba',
 'Interest only: not a booking or payment',
 'Только предварительная заявка, не бронь и не оплата',
 'Лише попередня заявка, не бронювання й не оплата'
 ]) assert.ok(html.includes(notice),'all locale translations required on every synchronized script: '+locale);
}

for(const locale of locales){
 const html=fs.readFileSync(pages[locale][0],'utf8');
 assert.ok(html.includes("if(mode==='FORM'&&Number(e.price_czk)>0)"),
   'priced RSVP must not be described as a confirmed booking: '+locale);
 for(const label of ['Nezávazný zájem','Interest only','Предварительная заявка','Попередня заявка'])
   assert.ok(html.includes(label),'paid-interest label missing: '+label+' on '+locale);
}

// Community routing must be brand-specific, age-gated, and only displayed after
// an accepted POST. Discussion chat links remain in private CRM config only.
const inviteHelper=require('../register/community-invites.js');
for(const [brand,community,count,telegram,whatsapp] of [
 ['DM','Družina Moravy',2,'https://t.me/druzinamoravy_news','https://chat.whatsapp.com/DuTpgF22mxMFy6L1Cfrcvu'],
 ['BW','BrnoWalkers',1,'https://t.me/pochody_brno_news','https://chat.whatsapp.com/BSlQetCjMoL8IO45c6VnH0']
]){
 for(const [locale,platform,url] of [
  ['cs','WhatsApp',whatsapp],['en','WhatsApp',whatsapp],
  ['ru','Telegram',telegram],['uk','Telegram',telegram]
 ]){
  const info=inviteHelper.resolve(community,locale,'adult','YES');
  assert.ok(info,brand+' '+locale);
  assert.equal(info.platform,platform);
  assert.equal(info.url,url);
  assert.equal(info.chatAfterVisits,count);
  assert.ok(info.chatInfo.includes(String(count)));
 }
 assert.equal(inviteHelper.resolve(community,'ru','under18','YES'),null);
 assert.equal(inviteHelper.resolve(community,'ru','adult','NO'),null);
 assert.equal(inviteHelper.resolve(community,'ru','adult','DECLINED'),null);
}
assert.equal(inviteHelper.resolve('Unknown','ru','adult','YES'),null);
assert.equal(inviteHelper.resolve('Družina Moravy BrnoWalkers','en','adult','YES'),null);
const privateChats=['druzinamoravy','pochody_brno','JzeXAQF8I2XE3zQ2OqWsPz','JCyEJNm746nBXNll3VzzX3'];
for(const loc of ['cs','en','ru','uk']){
 const html=fs.readFileSync(loc==='cs'?'register/index.html':'register/'+loc+'/index.html','utf8');
 const src=loc==='cs'?'./community-invites.js':'../community-invites.js';
 assert.ok(html.includes('<script src="'+src+'"></script>'),'Community helper missing '+loc);
 assert.ok(html.includes('communityInvite.chatInfo'),'Participant chat eligibility note missing '+loc);
 assert.ok(html.includes('IMPERION_COMMUNITY_INVITES?.resolve('),'Routing missing '+loc);
 assert.ok(html.includes('payload?.updatesGroupUrl'),'Event-specific invitations missing '+loc);
 for(const invite of privateChats.filter(x=>x.includes('Jze')||x.includes('JCy')))
  assert.ok(!html.includes(invite),'Private chat invite leaked into public HTML '+loc);
}
const helperSource=fs.readFileSync('register/community-invites.js','utf8');
for(const token of ['JzeXAQF8I2XE3zQ2OqWsPz','JCyEJNm746nBXNll3VzzX3'])
 assert.ok(!helperSource.includes(token),'Private chat invite leaked into browser JS');
