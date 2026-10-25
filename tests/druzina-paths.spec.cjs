const {test,expect}=require('@playwright/test');

const languages=['cs','en','ru','uk'];
for(const lang of languages){
 test('skill tree: '+lang+' shows three tiers and switches five infantry specialisations',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:850});
  await page.goto('/druzina/cesty/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('button[data-track="line"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#tierOneName')).not.toBeEmpty();
  await expect(page.locator('#tierChoice')).toBeVisible();
  await expect(page.locator('button[data-spec]')).toHaveCount(5);
  for(const spec of ['shield','spear','twohand','dual','skirmish']){
   const btn=page.locator('button[data-spec="'+spec+'"]');
   await btn.click();
   await expect(btn).toHaveAttribute('aria-pressed','true');
   await expect(page.locator('#tierTwoName')).toHaveText(await btn.textContent());
   await expect(page.locator('#tierThreeName')).not.toBeEmpty();
   await expect(page.locator('#tierThreeDescription')).not.toBeEmpty();
  }
  await page.locator('button[data-track="archer"]').click();
  await expect(page.locator('#tierChoice')).toBeHidden();
  await expect(page.locator('#tierOneName')).not.toBeEmpty();
  await expect(page.locator('#tierTwoName')).not.toBeEmpty();
  await expect(page.locator('#tierThreeName')).not.toBeEmpty();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
 });
 test('public board: '+lang+' month/all-time counts stay empty without verified consent',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:390,height:850});
  await page.goto('/druzina/leaderboard/?lang='+lang);
  await expect(page.locator('html')).toHaveAttribute('lang',lang);
  await expect(page.locator('#syncStatus')).toContainText('2026-10-19');
  await expect(page.locator('article[data-category]')).toHaveCount(7);
  await expect(page.locator('.category .list li.wait')).toHaveCount(7);
  const toggle=page.locator('button[data-period="all"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.category .list li.wait')).toHaveCount(7);
  await expect(page.locator('button[data-period="month"]')).toHaveAttribute('aria-pressed','false');
  await page.locator('button[data-period="month"]').click();
  await expect(page.locator('#syncStatus')).toContainText('2026-10');
  expect(errors).toEqual([]);
 });
}

for(const lang of languages){
 test('three-week rotation fairly covers all formats on Mon/Sat in '+lang,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [360,390,768]){
   await page.setViewportSize({width,height:850});
   await page.goto('/druzina/cesty/?lang='+lang);
   const cards=page.locator('.rotation-week');
   await expect(cards).toHaveCount(3);
   const formatsByDay=[[],[]];
   for(let i=1;i<=3;i++){
    const week=page.locator('.rotation-week[data-week="'+i+'"]');
    await expect(week.locator('.rotation-slot')).toHaveCount(2);
    const weekdayKeys=await week.locator('[data-rotday]').evaluateAll(nodes=>nodes.map(node=>node.dataset.rotday));
    expect(weekdayKeys).toEqual(['mon','sat']); // Thursday is permanently discontinued.
    const formats=(await week.locator('[data-rotcell]').allTextContents()).map(text=>text.trim());
    expect(new Set(formats).size).toBe(2);
    expect(formats.every(text=>text.length>=4)).toBe(true);
    formatsByDay.forEach((values,day)=>values.push(formats[day]));
   }
   // Someone attending only Monday or only Saturday still sees all three formats.
   for(const formats of formatsByDay)expect(new Set(formats).size).toBe(3);
   const dayLabels=await page.locator('.rotation-week:first-child [data-rotday]').allTextContents();
   for(const day of dayLabels){expect(day.trim().length).toBeGreaterThan(2);}
   const ranks=page.locator('#officialRanks');
   await expect(ranks).toHaveAttribute('href','../ranks.html?lang='+lang);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  expect(errors).toEqual([]);
 });
}

 
// November public-copy gates: enrolment stays non-binding and referrals
// cannot be substituted for actually attended training or rank evidence.
for(const lang of languages){
 test('November public-copy gates: '+lang,async({page})=>{
  await page.setViewportSize({width:390,height:850});
  await page.goto('/?lang='+lang+'#ambassador');
  const referral=page.locator('[data-i18n="ambassador.druzinaText"]');
  await expect(referral).toBeVisible();
  await expect(referral).not.toContainText(/\+5(?:-session)?/);
  const scope=page.locator('[data-i18n="ui.druzinaLegalScope"]');
  await expect(scope).toBeVisible();
  const scopeText=await scope.innerText();
  expect(scopeText.length).toBeGreaterThan(100);
  expect(scopeText).toMatch(/HEMA/);
  await page.goto('/druzina/cesty/?lang='+lang);
  await expect(page.locator('[data-t="commandType"]')).toContainText('VII');
  await expect(page.locator('[data-t="s1"]')).not.toContainText(/90 (?:minutes|minut|минут|хвилин)/i);
  await expect(page.locator('#officialRanks')).toHaveAttribute('href','../ranks.html?lang='+lang);
 });
}
