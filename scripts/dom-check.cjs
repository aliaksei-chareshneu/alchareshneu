const {JSDOM}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
async function load(path,language){
 const html=fs.readFileSync(path,'utf8');const dom=new JSDOM(html,{url:'https://aliaksei-chareshneu.github.io/alchareshneu/'+path.replace('index.html','')+'?lang='+language,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){},removeEventListener(){}});w.IntersectionObserver=class{observe(){}disconnect(){}unobserve(){}};w.ResizeObserver=class{observe(){}disconnect(){}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLCanvasElement.prototype.getContext=()=>null;w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=()=>{};
 const errors=[];w.addEventListener('error',e=>errors.push(e.message));
 for(const script of w.document.querySelectorAll('script:not([src])')){if(script.type==='application/ld+json'){JSON.parse(script.textContent);continue;}w.eval(script.textContent);}
 if(w.document.querySelector('#navBookBtn'))w.eval(fs.readFileSync('experience.js','utf8'));await new Promise(r=>setTimeout(r,20));return {dom,w,d:w.document,errors};
}
module.exports={load};
if(require.main===module)(async()=>{let count=0;for(const path of ['index.html','academy/index.html','druzina/index.html','druzina/start/index.html','walkers/index.html','calendar/index.html'])for(const lang of ['en','ru','cs','uk']){
 const {dom,w,d,errors}=await load(path,lang);
 try{
 assert.equal(d.documentElement.lang,lang,path);assert.equal(d.querySelectorAll('h1').length,1,path);
 const ids=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length,path+' duplicate ids');
 const bad=[...d.querySelectorAll('main a[href^="#"]')].filter(a=>a.hash.length>1&&!d.getElementById(decodeURIComponent(a.hash.slice(1)))).map(a=>a.hash);assert.deepEqual(bad,[],path+' anchors');
 assert.deepEqual(errors,[],path+' runtime errors');
 if(path.startsWith('academy')){const input=d.querySelector('#service-search');input.value='zzzzmissing';input.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.price-cat:not([hidden])').length,0);input.value='';input.dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('.price-cat:not([hidden])').length,9);assert.equal(d.querySelectorAll('.service-action').length,9);}
 if(path==='druzina/start/index.html'){
   assert.equal(d.querySelectorAll('#action').length,1,'one primary club action');
   assert.equal(d.querySelectorAll('form').length,0,'no forced form to join club');
   assert.ok(d.querySelector('[data-k="membership"]').textContent.length>45,'club participation separate from legal z.s. member status');
   assert.ok((d.querySelector('#action').href||'').startsWith(lang==='ru'?'https://t.me/druzinamoravy_news':'https://chat.whatsapp.com/'),'language-appropriate opt-in club updates');
   assert.ok((d.querySelector('#question').href||'').startsWith(lang==='ru'?'https://t.me/Chareshneu':'https://wa.me/420702914842'),'separate human enquiry');
   assert.ok(/paused|pozastaveny|приостановлены|призупинені/i.test(d.querySelector('[data-k="safety"]').textContent),'current booking pause preserved');
  }
 if(path==='druzina/index.html'){
  const essentials=d.querySelector('.dm-hero-essentials');
  assert.ok(essentials,'key facts must remain visible');
  assert.equal(essentials.querySelectorAll('.dm-hero-key').length,4,'what / where / when / registration');
  assert.ok(essentials.textContent.includes('18:00'),'usual start time');
  assert.ok(essentials.textContent.includes('48'),'advance registration 48h');
  const spoilers=[...d.querySelectorAll('.dm-accordion-shell > details.dm-disclosure')];
  assert.equal(spoilers.length,3,'three collapsed information sections');
  assert.ok(spoilers.every(x=>!x.open),'details closed by default');
  for(const id of ['start','registration-notice','schedule','onboarding','faq','ranks','roles','conduct','media','dm-team-experience','organisation']){
   assert.ok(d.getElementById(id)?.closest('details.dm-disclosure'),id+' content must remain available inside a spoiler');
  }
  const notice=d.querySelector('#registration-notice');
  if(notice){
   const paused={
    en:'New paid HEMA bookings are paused',
    ru:'Новые платные бронирования HEMA приостановлены',
    cs:'Nové placené rezervace HEMA jsou pozastaveny',
    uk:'Нові платні бронювання HEMA призупинено'
   };
   const activeNotice=notice.querySelector('[data-notice-lang="'+lang+'"]');
   assert.ok(activeNotice?.textContent.includes(paused[lang]),path+' missing '+lang+' paused-booking notice');
   assert.equal(d.querySelector('#tariff')?.getAttribute('aria-hidden'),'true','retired pricing anchor must be hidden');
   assert.equal(d.querySelector('#druzina-payment')?.getAttribute('aria-hidden'),'true','retired payment anchor must be hidden');
   const booking=d.querySelector('#navBookBtn')?.getAttribute('href')||'';
   assert.ok(booking.startsWith('prihlaska/?lang='),path+' '+lang+' primary navigation must reach the safeguarded enquiry form');
   assert.equal(new URL(d.querySelector('.dm-hero-register')?.href||'',d.location.href).pathname,'/alchareshneu/druzina/prihlaska/','hero CTA must lead to first-visit enquiry');
   assert.equal(d.querySelector('.dm-v2-announcements')?.open,false,'long club updates must be collapsed by default');
   assert.ok(d.querySelector('.dm-v2-status')?.textContent.includes('7'),'cancelled session stays visible');
   assert.ok(d.querySelector('.dm-trust-line')?.textContent.length>20,'club participation and trust statement visible');
   const retired=[...d.querySelectorAll('a[href]')].filter(a=>/docs[.]google[.]com[/]forms[/]d[/]e|revolut[.]me[/]/i.test(a.href));
   assert.equal(retired.length,0,'paused HEMA page must not link to retired payment/booking forms');
  } else {
   const text=d.body.textContent.replace(/[ ,]/g,'');
   for(const price of ['120','240','910','455','2870','1435','8235','4120'])
    assert.ok(text.includes(price+'Kč'),path+' missing active price '+price+' Kč');
  }
 }
 const languageButton=d.querySelector('[data-lang="ru"]');languageButton.click();await new Promise(r=>setTimeout(r,10));assert.equal(d.documentElement.lang,'ru');assert.equal(d.querySelectorAll('h1').length,1);assert.deepEqual(errors,[]);
 console.log('PASS',path,lang);count++;
 }finally{dom.window.close();}
 }console.log(count+' DOM/language cases passed (no layout engine; browser checks remain required)');})().catch(e=>{console.error(e);process.exit(1)});
