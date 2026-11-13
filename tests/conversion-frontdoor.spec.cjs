
const {test,expect} = require('@playwright/test');
const ENDPOINT='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const base={
  category:'HEMA Training',community:'Družina Moravy',price_czk:240,price_verified:true,
  end_time_verified:true,source_active:true,is_open:true,registration_mode:'FORM',
  venue:'Brno · venue to confirm',data_controller:'Družina Moravy, z. s.',
  title:'Club training (plan)',public_note:'Safe venue and attendance need organiser confirmation.'
};
const fixture=[
  {...base,event_id:'PUB-OREL-20261114',title:'Free beginner workshop',begins_at:'2026-11-14T11:00:00Z',price_czk:0,venue:'Orlovna Husovice'},
  {...base,event_id:'PUB-HEMA-20261114-PM',title:'Unconfirmed Saturday',begins_at:'2026-11-14T17:00:00Z'},
  {...base,event_id:'PUB-WALK-20261115',title:'15 Nov owner HOLD',community:'Brnowalkers',category:'Hike',begins_at:'2026-11-15T13:00:00Z'},
  {...base,event_id:'PUB-HEMA-20261116',title:'Monday training',begins_at:'2026-11-16T17:00:00Z'},
  {...base,event_id:'PUB-WALK-20261117',title:'17 Nov owner HOLD',community:'Brnowalkers',category:'Hike',begins_at:'2026-11-17T08:00:00Z'},
  {...base,event_id:'PUB-WALK-TALK-20261118',title:'Brno After Dark',community:'Brnowalkers',category:'City Walk',begins_at:'2026-11-18T17:30:00Z',price_czk:100,data_controller:'Aliaksei Chareshneu (OSVČ, IČO 23041625)'},
  {...base,event_id:'PUB-HEMA-20261121',title:'Saturday training suspended',begins_at:'2026-11-21T17:00:00Z'},
  {...base,event_id:'PUB-HEMA-20261123',title:'Monday 23 November',begins_at:'2026-11-23T17:00:00Z'},
  {...base,event_id:'PUB-HEMA-20261128',title:'Saturday training suspended',begins_at:'2026-11-28T17:00:00Z'},
  {...base,event_id:'PUB-WALK-20261129',title:'Conditional guided walk',community:'Brnowalkers',category:'Guided Walk',begins_at:'2026-11-29T13:00:00Z',price_czk:450,registration_mode:'CONTACT',is_open:false}
];
async function prepare(page,at='2026-11-11T12:00:00+01:00'){
  await page.clock.install({time:new Date(at)});
  let posts=0;
  await page.route(ENDPOINT,route=>{
    if(route.request().method()!=='GET'){posts++;return route.fulfill({status:405,body:'{}'});}
    return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({events:fixture})});
  });
  await page.route('https://script.google.com/**',r=>r.fulfill({contentType:'application/javascript',body:'/* no updates */'}));
  return ()=>posts;
}
for(const width of [390,1440]){
  test('conversion homepage '+width+' is one-step and keeps exclusions',async({page})=>{
    await page.setViewportSize({width,height:900});
    const posts=await prepare(page);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/?lang=en');
    await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
    await expect(page.locator('#fdHeroCta')).toBeVisible();
    await expect(page.locator('#fdHeroCta')).toHaveAttribute('href','#impr-calendar');
    await expect(page.locator('body > .nav')).toBeHidden();
    await page.locator('.fd-hero').screenshot({path:'test-results/conversion-frontdoor-'+width+'-hero.png'});
    await expect(page.locator('#fdDetails #fdEventTitle')).toContainText('Try historical fencing');
    await expect(page.locator('#fdBook')).toHaveAttribute('href',/event=PUB-OREL-20261114/);
    await expect(page.locator('#fdBook')).toContainText('Request a place');
    const dayLabels=await page.locator('#fdDays button').evaluateAll(btns=>btns.map(b=>b.getAttribute('aria-label')));
    expect(dayLabels.some(x=>x.startsWith('2026-11-14'))).toBe(true);
    for(const hold of ['2026-11-15','2026-11-17','2026-11-21','2026-11-28'])
      expect(dayLabels.some(x=>x.startsWith(hold)),hold+' must not be visible').toBe(false);
    await page.locator('#fdDays button[aria-label^="2026-11-16"]').click();
    await expect(page.locator('#fdDetails')).toBeVisible();
    await expect(page.locator('#fdOverlay')).toBeVisible();
    await expect(page.locator('#fdClose')).toBeFocused();
    await expect(page.locator('#fdBook')).toHaveAttribute('href',/event=PUB-HEMA-20261116/);
    await expect(page.locator('#fdFacts')).toContainText('240 Kč');
    await expect(page.locator('#fdPaymentTerms')).toBeVisible();
    await expect(page.locator('#fdPaymentTerms')).not.toHaveAttribute('open','');
    await expect(page.locator('#fdPaymentTiming')).toBeHidden();
    await page.locator('#fdPaymentSummary').click();
    await expect(page.locator('#fdPaymentTiming')).toContainText('+25%');
    await expect(page.locator('#fdPaymentCancellation')).toContainText('48 hours');
    await expect(page.locator('#fdPaymentEmail')).toHaveAttribute('href',/^mailto:chereshnev\.biochem@gmail\.com\?/);
    await expect(page.locator('#fdPaymentWhatsApp')).toHaveAttribute('href',/wa\.me\/420702914842\?text=/);
    await expect(page.locator('#fdPaymentTelegram')).toHaveAttribute('href','https://t.me/Chareshneu');
    await expect(page.locator('#fdPaymentEventRef')).toContainText('PUB-HEMA-20261116');
    await expect(page.locator('#fdFacts')).toContainText('Družina Moravy, z. s.');
    await page.locator('#impr-calendar').screenshot({path:'test-results/conversion-frontdoor-'+width+'-calendar.png'});
    await page.locator('#fdClose').click();
    await expect(page.locator('#fdDetails')).toBeHidden();
    await page.locator('[data-fd-filter="academy"]').click();
    await expect(page.locator('#fdEventTitle')).toContainText('Move toward your goal');
    await expect(page.locator('#fdBook')).toHaveAttribute('href','academy/');
    await expect(page.locator('#fdFallback')).toBeVisible();
    await expect(page.locator('#fdFallbackLink')).toHaveAttribute('href','academy/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    const layout=await page.locator('.fd-calendar-layout').evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(layout).toBe(1);
    expect(posts()).toBe(0);
    expect(errors).toEqual([]);
  });
}
test('language and manual-contact actions are localized and nonbinding',async({page})=>{
  await prepare(page);
  await page.goto('/?lang=ru');
  await expect(page.locator('#fdHeroLabel')).toHaveText('Выбрать событие');
  await page.locator('#fdDays button[aria-label^="2026-11-29"]').click();
  await expect(page.locator('#fdBook')).toContainText('Уточнить участие');
  await expect(page.locator('#fdBook')).toHaveAttribute('href',/event=PUB-WALK-20261129/);
  await expect(page.locator('#fdStatus')).toContainText('согласованию');
  await page.locator('#fdClose').click();
  await page.locator('[data-fd-language="cs"]').click();
  await expect(page.locator('#fdHeroLabel')).toHaveText('Vybrat akci');
});
test('unavailable catalog fails closed without imaginary booking',async({page})=>{
  await page.route(ENDPOINT,r=>r.abort());
  await page.goto('/?lang=en');
  await expect(page.locator('#fdEventTitle')).toHaveText('Dates cannot be verified',{timeout:15000});
  await expect(page.locator('#fdBook')).toHaveAttribute('href','calendar/');
  await expect(page.locator('#fdBook')).toContainText('Public calendar');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

for(const width of [390,1440]){
  test('event popup closes by Escape and restores focus '+width,async({page})=>{
    await page.setViewportSize({width,height:840});
    await prepare(page);
    await page.goto('/?lang=en');
    const dateButton=page.locator('#fdDays button[aria-label^="2026-11-16"]');
    await dateButton.click();
    await expect(page.locator('#fdDetails')).toBeVisible();
    await expect(page.locator('#fdDetails')).toHaveAttribute('aria-modal','true');
    await expect(page.locator('body')).toHaveClass(/fd-modal-open/);
    await expect(page.locator('#fdEventTitle')).toContainText('Historical fencing');
    await expect(page.locator('#fdBook')).toHaveAttribute('href',/event=PUB-HEMA-20261116/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fdDetails')).toBeHidden();
    await expect(page.locator('#fdOverlay')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/fd-modal-open/);
    await expect(dateButton).toBeFocused();
    await dateButton.click();
    await page.mouse.click(5,5);
    await expect(page.locator('#fdDetails')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  });
}


test('free Orel does not solicit payment or show cancellation conditions',async({page})=>{
  const posts=await prepare(page);
  await page.goto('/?lang=cs');
  await page.locator('#fdDays button[aria-label^="2026-11-14"]').click();
  await expect(page.locator('#fdDetails')).toBeVisible();
  await expect(page.locator('#fdFacts')).toContainText('Zdarma');
  await expect(page.locator('#fdPaymentTerms')).toBeHidden();
  expect(posts()).toBe(0);
});

for(const locale of ['cs','en','ru','uk']){
 test('paid BrnoWalkers terms and contact links are localized '+locale,async({page})=>{
  const posts=await prepare(page);
  await page.goto('/?lang='+locale);
  await page.locator('#fdDays button[aria-label^="2026-11-18"]').click();
  await expect(page.locator('#fdFacts')).toContainText('100 Kč');
  await expect(page.locator('#fdPaymentTerms')).toBeVisible();
  await expect(page.locator('#fdPaymentTiming')).toBeHidden();
  await page.locator('#fdPaymentSummary').click();
  await expect(page.locator('#fdPaymentTiming')).toContainText('48');
  await expect(page.locator('#fdPaymentTiming')).toContainText('25');
  await expect(page.locator('#fdPaymentCancellation')).toContainText('48');
  await expect(page.locator('#fdPaymentException')).toBeVisible();
  await expect(page.locator('#fdPaymentPayee')).toContainText('Aliaksei Chareshneu (OSVČ, IČO 23041625)'); // payee follows source-controller, not category
  const email=await page.locator('#fdPaymentEmail').getAttribute('href');
  const whatsapp=await page.locator('#fdPaymentWhatsApp').getAttribute('href');
  expect(email).toMatch(/^mailto:chereshnev\.biochem@gmail\.com\?/);
  expect(decodeURIComponent(email)).toContain('PUB-WALK-TALK-20261118');
  expect(whatsapp).toMatch(/^https:\/\/wa\.me\/420702914842\?text=/);
  expect(decodeURIComponent(whatsapp)).toContain('PUB-WALK-TALK-20261118');
  await expect(page.locator('#fdPaymentTelegram')).toHaveAttribute('href','https://t.me/Chareshneu');
  expect(posts()).toBe(0);
 });
}

test('48h boundary rounds only a new request, not already booked participants',async({page})=>{
  const posts=await prepare(page,'2026-11-16T17:30:00.000Z');
  await page.goto('/?lang=ru');
  // page.clock.install advances with elapsed real test time; freeze exactly at threshold.
  await page.clock.setFixedTime(new Date('2026-11-16T17:30:00.000Z'));
  await page.locator('#fdDays button[aria-label^="2026-11-18"]').click();
  await expect(page.locator('#fdFacts')).toContainText('100 Kč');
  await expect(page.locator('#fdFacts')).not.toContainText('125 Kč');
  await page.clock.setFixedTime(new Date('2026-11-16T17:30:00.001Z'));
  await page.locator('#fdClose').click();
  await page.locator('#fdDays button[aria-label^="2026-11-18"]').click();
  await expect(page.locator('#fdFacts')).toContainText('125 Kč');
  await expect(page.locator('#fdFacts')).toContainText('100 Kč');
  await expect(page.locator('#fdFacts')).toContainText('+25 %');
  await page.locator('#fdPaymentSummary').click();
  await expect(page.locator('#fdPaymentException')).toContainText('Ранее письменно согласованные условия');
  expect(posts()).toBe(0);
});
