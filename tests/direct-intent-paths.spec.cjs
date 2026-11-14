const {test,expect}=require('@playwright/test');
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';

async function stubCatalog(page){
  await page.route(API,route=>{
    if(route.request().method()!=='GET') return route.fulfill({status:405,body:'{}'});
    return route.fulfill({status:200,contentType:'application/json',
      headers:{'Access-Control-Allow-Origin':'*'},
      body:JSON.stringify({events:[{
        event_id:'PUB-WALK-20261118',title:'Brno evening walk',begins_at:'2026-11-18T17:30:00+01:00',
        category:'City Walk',community:'BrnoWalkers',venue:'Brno',registration_mode:'FORM',
        is_open:true,price_czk:100,price_verified:true,end_time_verified:true,
        data_controller:'Aliaksei Chareshneu (OSVČ)'
      }]})
    });
  });
}
for(const lang of ['cs','en','ru','uk']){
  test('direct customer routes in '+lang+' are localized, source-aware and nonbinding',async({page})=>{
    await page.clock.install({time:new Date('2026-11-14T07:30:00+01:00')});
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.setViewportSize({width:390,height:850});
    await stubCatalog(page);
    await page.goto('/?lang='+lang+'&utm_source=telegram&utm_campaign=nov2026');
    await expect(page.locator('html')).toHaveAttribute('data-imperion-frontdoor','ready');
    await expect(page.locator('#fdHeroCta')).toHaveAttribute('href','#impr-calendar');
    await expect(page.locator('#fd-goal-paths .fd-goal-card')).toHaveCount(4);
    await expect(page.locator('#fd-goal-paths h2')).toBeVisible();
    const cards=page.locator('#fd-goal-paths .fd-goal-action');
    const urls=await cards.evaluateAll(links=>links.map(a=>new URL(a.href).toString()));
    const paths=urls.map(x=>new URL(x).pathname);
    expect(paths[0]).toMatch(/\/corporate\/request\/$/);
    expect(paths[1]).toMatch(/\/academy\/programmes\/$/);
    expect(paths[2]).toMatch(/\/alchareshneu\/$/);
    expect(paths[3]).toMatch(/\/register\/$/);
    for(const [i,src] of ['frontdoor_fast_business','frontdoor_fast_lesson','frontdoor_fast_walkers','frontdoor_fast_club'].entries()){
      const u=new URL(urls[i]);
      expect(u.searchParams.get('lang')).toBe(lang);
      expect(u.searchParams.get('src')).toBe(src);
      expect(u.searchParams.get('utm_source')).toBe('telegram');
      expect(u.searchParams.get('utm_campaign')).toBe('nov2026');
    }
    expect(new URL(urls[0]).searchParams.get('service')).toBe('DATA_PILOT');
    expect(new URL(urls[1]).searchParams.get('programme')).toBe('LESSON');
    expect(new URL(urls[1]).hash).toBe('#enquire');
    expect(new URL(urls[2]).hash).toBe('#impr-calendar');
    await expect(page.locator('.fd-business-shortcut a')).toHaveAttribute('href',/frontdoor_fast_business/);
    await expect(page.locator('.fd-nav-business')).toHaveAttribute('href',/frontdoor_fast_business/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}
test('language switch updates all direct-intent links without changing service recipient',async({page})=>{
  await stubCatalog(page);
  await page.goto('/?lang=en');
  await page.locator('[data-fd-language="ru"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.locator('#fdGoalHeading')).toHaveText('Какую задачу хотите решить?');
  await expect(page.locator('.fd-goal-business .fd-goal-action')).toHaveAttribute('href',/lang=ru/);
  await expect(page.locator('.fd-goal-club .fd-goal-action')).toHaveAttribute('href',/src=frontdoor_fast_club/);
});
test('selected walk preserves allowlisted source to the existing registration form',async({page})=>{
  await page.clock.install({time:new Date('2026-11-14T07:30:00+01:00')});
  await stubCatalog(page);
  await page.goto('/?lang=en&category=walkers&src=frontdoor_fast_walkers&utm_source=telegram#impr-calendar');
  await page.locator('#fdDays button[aria-label^="2026-11-18"]').click();
  const href=await page.locator('#fdBook').getAttribute('href');
  const u=new URL(href,page.url());
  expect(u.pathname).toMatch(/\/register\/$/);
  expect(u.searchParams.get('event')).toBe('PUB-WALK-20261118');
  expect(u.searchParams.get('src')).toBe('frontdoor_fast_walkers');
  expect(u.searchParams.get('utm_source')).toBe('telegram');
});
test('free 14 Nov HEMA workshop remains listed before completion and expires afterward',async({page})=>{
  await page.clock.install({time:new Date('2026-11-14T07:30:00+01:00')});
  await page.goto('/start/?lang=cs');
  const old=page.locator('.locale:visible a[data-event-expires]');
  await expect(old).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-14T15:00:00+01:00'));
  await page.reload();
  await expect(page.locator('.locale:visible a[data-event-expires]')).toBeHidden();
  await expect(page.locator('.locale:visible .card').nth(4).locator('a.primary')).toBeVisible();
});