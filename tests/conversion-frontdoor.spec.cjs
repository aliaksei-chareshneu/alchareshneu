
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
  {...base,event_id:'PUB-WALK-TALK-20261118',title:'Brno After Dark',community:'Brnowalkers',category:'City Walk',begins_at:'2026-11-18T17:30:00Z',price_czk:100},
  {...base,event_id:'PUB-HEMA-20261121',title:'Saturday training suspended',begins_at:'2026-11-21T17:00:00Z'},
  {...base,event_id:'PUB-HEMA-20261123',title:'Monday 23 November',begins_at:'2026-11-23T17:00:00Z'},
  {...base,event_id:'PUB-HEMA-20261128',title:'Saturday training suspended',begins_at:'2026-11-28T17:00:00Z'},
  {...base,event_id:'PUB-WALK-20261129',title:'Conditional guided walk',community:'Brnowalkers',category:'Guided Walk',begins_at:'2026-11-29T13:00:00Z',price_czk:450,registration_mode:'CONTACT',is_open:false}
];
async function prepare(page){
  await page.clock.install({time:new Date('2026-11-11T12:00:00+01:00')});
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
    await expect(page.locator('#fdBook')).toHaveAttribute('href',/event=PUB-HEMA-20261116/);
    await expect(page.locator('#fdFacts')).toContainText('240 Kč');
    await expect(page.locator('#fdFacts')).toContainText('Družina Moravy, z. s.');
    await page.locator('#impr-calendar').screenshot({path:'test-results/conversion-frontdoor-'+width+'-calendar.png'});
    await page.locator('[data-fd-filter="academy"]').click();
    await expect(page.locator('#fdEventTitle')).toContainText('Move toward your goal');
    await expect(page.locator('#fdBook')).toHaveAttribute('href','academy/');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    const layout=await page.locator('.fd-calendar-layout').evaluate(x=>getComputedStyle(x).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(layout).toBe(width===390?1:2);
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
  await page.locator('[data-fd-language="cs"]').click();
  await expect(page.locator('#fdHeroLabel')).toHaveText('Vybrat zážitek');
});
test('unavailable catalog fails closed without imaginary booking',async({page})=>{
  await page.route(ENDPOINT,r=>r.abort());
  await page.goto('/?lang=en');
  await expect(page.locator('#fdEventTitle')).toHaveText('Dates cannot be verified',{timeout:15000});
  await expect(page.locator('#fdBook')).toHaveAttribute('href','calendar/');
  await expect(page.locator('#fdBook')).toContainText('Public calendar');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
