const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const pages=['druzina/index.html','druzina/permanentky/index.html','druzina/novinky/index.html','druzina/cesty/index.html'];

test('Druzina 9 Nov owner-approved individual rates match across public entrypoints',()=>{
 for(const file of pages){
  const html=read(file);
  for(const price of ['240 Kč','120 Kč','800 Kč','560 Kč']){
   expect(html,file+' missing '+price).toContain(price);
  }
  expect(html,file+' still has withdrawn 7 Nov group price').not.toMatch(/1\s*000\s*Kč\s*\+\s*160|CZK\s*1,000\s*\+\s*CZK\s*160/i);
  expect(html,file+' still has withdrawn group split samples').not.toMatch(/(?:440|328)\s*Kč\s*(?:\/\s*(?:os|чел|особа)|each)/i);
 }
 const news=read('druzina/novinky/index.html');
 expect(news).not.toContain('440 Kč');
 expect(news).not.toContain('328 Kč');
 for(const lang of ['cs','en','ru','uk'])expect(news).toContain('id="'+lang+'-pricing"');
 expect(news.match(/class="price-amount"/g)).toHaveLength(12);
 expect(news).not.toContain('<strong>200 Kč</strong>');
 const homepage=read('druzina/index.html');
 expect(homepage).toContain('DM-PRICES-20261109');
 expect(homepage).not.toContain('dm-nov26-update');
});
test('Druzina pricing remains enquiry-only, preserving previous rights and workshop',()=>{
 const html=read('druzina/permanentky/index.html');
 expect(html).toContain('We preserve individually confirmed or prepaid entitlements');
 expect(html).toContain('14 November 2026 Orel Husovice beginner workshop remains free');
 expect(html).toContain('560 Kč');
 expect(html).toContain('../../register/?lang=en');
 expect(html).not.toMatch(/buy\.stripe\.com|revolut\.me|<form[^>]*action=/);
});
