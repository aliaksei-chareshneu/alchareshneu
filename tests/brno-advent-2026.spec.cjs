const {test,expect}=require('@playwright/test');

const EMAIL='chereshnev.biochem@gmail.com';
const PHONE='420702914842';
const ROUTE='/walkers/brno-advent-2026.html';
const locales={
 en:{
  subject:'Brno Advent 2026 - private walking tour enquiry',
  fields:['Preferred date:','Preferred start time:','Group size','Tour language','Accessibility or mobility needs:','Customer name:','Customer email or phone:','Invoice recipient','Group interests'],
  price:'3,500 Kč / private group'
 },
 cs:{
  subject:'Brno Advent 2026 – poptávka soukromé prohlídky',
  fields:['Požadované datum:','Požadovaný čas začátku:','Velikost skupiny','Jazyk prohlídky','Požadavky na přístupnost','Jméno objednatele:','Kontaktní e-mail nebo telefon:','Fakturační údaje','Zájmy skupiny'],
  price:'3 500 Kč / soukromá skupina'
 },
 ru:{
  subject:'Брно, Адвент 2026 — частная экскурсия',
  fields:['Дата:','Время начала:','Размер группы','Язык экскурсии','Доступность / мобильность:','Имя заказчика:','Email или телефон:','Данные для счёта','Пожелания группы:'],
  price:'3 500 Kč / частная группа'
 }
};

for(const [language,config] of Object.entries(locales)){
 test('Advent private-tour contact templates: '+language, async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(ROUTE+'?lang='+language);
  await expect(page.locator('html')).toHaveAttribute('lang',language);
  const section=page.locator('section[data-locale="'+language+'"]');
  await expect(section).toBeVisible();
  for(const other of Object.keys(locales))if(other!==language)await expect(page.locator('section[data-locale="'+other+'"]')).toBeHidden();
  await expect(section.locator('.price')).toHaveText(config.price);
  const emailHrefs=await section.locator('a.cta[href^="mailto:"]').evaluateAll(elements=>elements.map(el=>el.getAttribute('href')));
  expect(emailHrefs).toHaveLength(2);
  expect(emailHrefs[0]).toBe(emailHrefs[1]);
  const emailURL=new URL(emailHrefs[0]);
  expect(emailURL.protocol).toBe('mailto:');
  expect(emailURL.pathname).toBe(EMAIL);
  expect(emailURL.searchParams.get('subject')).toBe(config.subject);
  const emailBody=emailURL.searchParams.get('body');
  expect(emailBody).toContain('\r\n');
  for(const field of config.fields)expect(emailBody).toContain(field);
  const waHref=await section.locator('a.cta[href^="https://wa.me/"]').getAttribute('href');
  const waURL=new URL(waHref);
  expect(waURL.protocol).toBe('https:');
  expect(waURL.hostname).toBe('wa.me');
  expect(waURL.pathname).toBe('/'+PHONE);
  expect(waURL.searchParams.get('text')).toBe(emailBody);
  expect(emailHrefs[0]).not.toMatch(/[^\x00-\x7f]/);
  expect(waHref).not.toMatch(/[^\x00-\x7f]/);
  await expect(page.locator('form')).toHaveCount(0);
  expect(errors).toEqual([]);
 });
 test('Advent private-tour mobile viewport and CTA reachability: '+language, async({page})=>{
  await page.goto(ROUTE+'?lang='+language);
  const section=page.locator('section[data-locale="'+language+'"]');
  for(const width of [320,360,390,650,768,1280]){
   await page.setViewportSize({width,height:844});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   expect(overflow,'horizontal overflow at '+width+'px in '+language).toBeLessThanOrEqual(1);
   for(const button of await section.locator('a.cta').all()){
    const box=await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x+box.width).toBeLessThanOrEqual(width+1);
   }
  }
 });
}
test('Advent language buttons switch the visible enquiry and document language',async({page})=>{
 await page.goto(ROUTE+'?lang=en');
 for(const language of ['cs','ru','en','cs']){
  await page.locator('[data-choice="'+language+'"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang',language);
  await expect(page.locator('section[data-locale="'+language+'"]')).toBeVisible();
  await expect(page.locator('[data-choice="'+language+'"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('section[data-locale="'+language+'"] a.cta[href^="mailto:"]')).toHaveCount(2);
 }
});
