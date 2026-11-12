'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd(),base='/alchareshneu/';
function allHtml(folder=''){
 const dir=path.join(root,folder);
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const name=path.posix.join(folder,entry.name);
  if(entry.isDirectory()){
   if(['node_modules','.git','.github','test-results','playwright-report'].includes(entry.name))return [];
   return allHtml(name);
  }
  return entry.isFile()&&entry.name.endsWith('.html')?[name]:[];
 });
}
function resolveTarget(page,href){
 let h=href.replace(/&amp;/g,'&').trim();
 if(!h||/^(?:#|mailto:|tel:|sms:|data:|javascript:|\/\/)/i.test(h))return null;
 if(/^[a-z][a-z0-9+.-]*:\/\//i.test(h)){
  const u=new URL(h);
  if(u.hostname!=='aliaksei-chareshneu.github.io')return null;
  h=u.pathname;
 }
 h=h.split(/[?#]/,1)[0]||'';
 if(!h)return null;
 if(h.startsWith(base))h=h.slice(base.length);
 else if(h.startsWith('/'))return 'out-of-base:'+h;
 else h=path.posix.join(path.posix.dirname(page),h);
 h=path.posix.normalize(h);
 if(h==='.'||h.endsWith('/'))h=path.posix.join(h,'index.html');
 if(h!=='.'&&!path.posix.extname(h))h=path.posix.join(h,'index.html');
 if(h.startsWith('../'))return 'out-of-repository:'+h;
 return h;
}
test('all public HTML pages have valid same-site static navigation targets',()=>{
 const pages=allHtml();
 expect(pages.length).toBeGreaterThanOrEqual(50);
 const bad=[];let count=0;
 for(const page of pages){
  const html=fs.readFileSync(path.join(root,page),'utf8')
   .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
  for(const match of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)){
   count++;
   const target=resolveTarget(page,match[1]);
   if(!target)continue;
   if(target.startsWith('out-of-')||!fs.existsSync(path.join(root,target)))
    bad.push(page+' -> '+match[1]+' => '+target);
  }
 }
 expect(bad,'invalid same-site links:\n'+bad.slice(0,30).join('\n')).toEqual([]);
 expect(count).toBeGreaterThan(400);
});
test('sitemap only advertises existing public HTML and pages, not 404 inventory',()=>{
 const map=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 const broken=[];
 for(const m of map.matchAll(/<loc>([^<]+)<\/loc>/g)){
  const u=new URL(m[1]);
  if(u.origin!=='https://aliaksei-chareshneu.github.io'||!u.pathname.startsWith(base))continue;
  const p=u.pathname.slice(base.length);
  const name=!p||p.endsWith('/')?p+'index.html':p;
  if(!fs.existsSync(path.join(root,name)))broken.push(name);
 }
 expect(broken).toEqual([]);
});
test('evergreen service entrypoints use current event catalogue and honest HEMA booking state',()=>{
 const get=p=>fs.readFileSync(path.join(root,p),'utf8');
 const start=get('start/index.html'),calendar=get('calendar/index.html'),
  home=get('conversion-frontdoor.js'),safety=get('druzina/safety/index.html'),paths=get('druzina/cesty/index.html');
 expect(start).not.toContain('PUB-HIKE-20261101');
 expect(start).not.toContain('New paid HEMA bookings are paused');
 for(const lang of ['cs','en','ru','uk'])expect(start).toContain('href="../?lang='+lang+'#impr-calendar"');
 expect(calendar).toContain('functions/v1/imperion-register');
 expect(calendar).not.toContain('const EVENTS_API_URL');
 expect(calendar).not.toContain('script.google.com/macros/s/');
 expect(calendar).toContain('connect-src');
 expect(calendar).not.toContain('calendar-embed-card');
 expect(home).toContain("academy/courses/?lang=");
 expect(safety).not.toContain('New paid HEMA bookings are paused');
 expect(paths).not.toContain('New paid HEMA bookings are not open yet');
});

test('Start discovery keeps locale and lands in the JS-mounted events calendar',async({page})=>{
 await page.route('https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register',r=>r.fulfill({
  status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:'{"events":[]}'
 }));
 await page.goto('/start/?lang=ru');
 const link=page.locator('a[href="../?lang=ru#impr-calendar"]').first();
 await expect(link).toBeVisible();
 await link.click();
 await expect(page).toHaveURL(/\?lang=ru#impr-calendar$/);
 await expect(page.locator('#impr-calendar')).toBeInViewport();
 await expect(page.locator('html')).toHaveAttribute('lang','ru');
});
