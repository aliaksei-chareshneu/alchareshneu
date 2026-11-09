const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const pricePages=['druzina/index.html','druzina/permanentky/index.html','druzina/novinky/index.html'];

test('Published 7 November two-hour shared-group formula is consistent across entrypoints',()=>{
 for(const file of pricePages){
  const html=read(file);
  expect(html,file+' missing shared group pricing').toMatch(/1\s*000\s*Kč|CZK\s*1,000/);
  expect(html,file+' missing incremental participant cost').toMatch(/160\s*Kč|CZK\s*160/);
  expect(html,file+' missing 3-person example').toContain('440 Kč');
  expect(html,file+' missing 5-person example').toContain('328 Kč');
 }
 const news=read('druzina/novinky/index.html');
 for(const lang of ['cs','en','ru','uk'])expect(news).toContain('id="'+lang+'-pricing"');
 const homepage=read('druzina/index.html');
 expect(homepage).toContain('dm-relaunch-20261107');
});
test('Druzina prices preserve written entitlements and the free 14 November workshop',()=>{
 const html=read('druzina/permanentky/index.html');
 expect(html).toContain('We preserve individually confirmed or prepaid entitlements');
 expect(html).toContain('14 November 2026 Orel Husovice beginner workshop remains free');
 expect(html).toContain('560 Kč');
 expect(html).toContain('25%');
 expect(html).toContain('../../register/?lang=en');
 expect(html).not.toMatch(/buy\.stripe\.com|revolut\.me|<form[^>]*action=/);
 const legacy=read('druzina/prihlaska/index.html');
 expect(legacy).toContain('window.location.replace(target.href)');
 expect(legacy).not.toContain('<form ');
});