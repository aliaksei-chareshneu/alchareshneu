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
assert.ok(fn.includes('imperion_rsvp_allow_request'));
assert.ok(fn.includes('writeError.code!==\'23505\''));
assert.ok(fn.includes("origin!==ALLOWED_ORIGIN"));
assert.ok(front.includes('id="safety" type="checkbox" required'));
const s=front.match(/<script>\s*('use strict';[\s\S]*?)\s*<\/script>/);
assert.ok(s,'inline application script missing');new vm.Script(s[1]);
const start=fs.readFileSync('start/index.html','utf8');
for(const l of ['en','cs','ru','uk']) assert.ok(start.includes('event=PUB-HIKE-20261101&amp;lang='+l),'No registration CTA '+l);
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
const walkers=fs.readFileSync('walkers/index.html','utf8');
assert.ok(walkers.includes('a[href^="../register/"]'),'walker locale-aware signup');
assert.ok(!walkers.includes('href="https://wa.me/420702914842?text=Hello%2C%20I%27d%20like%20to%20ask%20about%20a%20BrnoWalkers%20event.'),'walker legacy CTA');
console.log('PASS: 4 indexable, canonical, hreflang and self-contained registration forms; SEO and UX checks');
