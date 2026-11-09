const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const root=process.cwd();
const read=path=>fs.readFileSync(require('node:path').join(root,path),'utf8');
const examples=[{people:3,total:1320,each:440},{people:5,total:1640,each:328},{people:10,total:2440,each:244},{people:15,total:3240,each:216},{people:20,total:4040,each:202}];
const paths=['druzina/index.html','druzina/permanentky/index.html','druzina/novinky/index.html','druzina/cesty/index.html'];

test('Druzina Nov 7 group tariff stays synchronized across public entrypoints',()=>{
 for(const p of paths){
  const html=read(p);
  expect(html,p+' missing group fixed amount').toContain('1 000 Kč');
  expect(html,p+' missing additional participant amount').toContain('160 Kč');
  for(const rate of [440,328,244]){
   expect(html,p+' missing group per-person sample '+rate).toContain(rate+' Kč');
  }
 }
 for(const {people,total,each} of examples){
  expect(1000+(people-1)*160).toBe(total);
  expect(total/people).toBe(each);
 }
 expect(read('druzina/permanentky/index.html')).not.toMatch(/Junior Flex 260 Kč|Senior Flex 220 Kč|Starter 4 800 Kč|Unlimited · 30 dní/);
 const dashboard=read('druzina/novinky/index.html');
 for(const lang of ['cs','en','ru','uk']){
  expect(dashboard).toContain('id="'+lang+'-pricing"');
 }
 expect(dashboard.match(/class="price-amount"/g)).toHaveLength(20);
 expect(dashboard).toContain('НЕ ПЛАТИТЬ без личного письменного подтверждения условий');
 const homepage=read('druzina/index.html');
 expect(homepage).toContain('Актуальные групповые цены');
 expect(homepage).toContain('Current group prices');
});
test('Druzina live pricing pages remain enquiry-only, preserving prepaid rights',()=>{
 const prices=read('druzina/permanentky/index.html');
 expect(prices).toContain('We preserve individually confirmed or prepaid entitlements');
 expect(prices).toContain('14 November 2026 Orel Husovice beginner workshop remains free');
 expect(prices).not.toMatch(/buy\\.stripe\\.com|revolut\\.me|<form[^>]*action=/);
 expect(prices).toContain('../../register/?lang=en');
});
