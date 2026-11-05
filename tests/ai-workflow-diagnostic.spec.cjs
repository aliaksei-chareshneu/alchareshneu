const {test,expect}=require('@playwright/test');

for(const lang of ['cs','en','ru','uk']){
  for(const width of [360,768]){
    test('AI workflow diagnostic '+lang+' '+width+'px: usable, local-only and links to existing intake',async({page})=>{
      const errors=[],requests=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>requests.push(r.url()));
      await page.setViewportSize({width,height:820});
      await page.goto('/corporate/diagnostic/?lang='+lang);
      await expect(page.locator('html')).toHaveAttribute('lang',lang);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('link[href="../../brand-theme.css?v=20261025"]')).toHaveCount(1);
      await expect(page.locator('link[href="../../site-design.css?v=20261027"]')).toHaveCount(1);
      await expect(page.locator('body')).toHaveAttribute('data-imperion-scope','tech');
      await expect(page.locator('#hoursResult')).not.toHaveText('—');
      await expect(page.locator('button[data-set-lang="'+lang+'"]')).toHaveAttribute('aria-pressed','true');
      const href=await page.locator('#requestLink').getAttribute('href');
      expect(href).toContain('service=DATA_PILOT');
      expect(href).toContain('src=ai_workflow_diagnostic');
      expect(href).toContain('lang='+lang);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      expect(errors).toEqual([]);
      expect(requests.every(u=>u.startsWith('http://127.0.0.1:8000/'))).toBe(true);
    });
  }
}

test('diagnostic: live changes include human review and warning for zero savings',async({page})=>{
  await page.goto('/corporate/diagnostic/?lang=en');
  await expect(page.locator('#hoursResult')).toHaveText('12');
  await expect(page.locator('#moneyResult')).toContainText('5,400');
  await page.locator('#volume').fill('100');
  await page.locator('#before').fill('10');
  await page.locator('#after').fill('16');
  await expect(page.locator('#hoursResult')).toHaveText('0');
  await expect(page.locator('#warningText')).toBeVisible();
  await page.locator('#after').fill('5');
  await expect(page.locator('#hoursResult')).toHaveText('8.3');
  await expect(page.locator('#warningText')).toBeHidden();
  await page.locator('#volume').fill('100001');
  await expect(page.locator('#hoursResult')).toHaveText('—');
  await expect(page.locator('#warningText')).toBeVisible();
});

test('diagnostic: corporate CTA flows to existing lead form without submitting',async({page})=>{
  await page.goto('/corporate/?lang=en');
  await page.locator('#ai-diagnostic-cta a[data-locale="en"]').click();
  await expect(page).toHaveURL(/\/corporate\/diagnostic\/\?lang=en/);
  await page.locator('#requestLink').click();
  await expect(page).toHaveURL(/\/corporate\/request\/\?/);
  await expect(page.locator('select#offer')).toHaveValue('DATA_PILOT');
  await expect(page.locator('form#request')).toHaveCount(1);
  await expect(page.locator('input#privacyAck')).not.toBeChecked();
});

test('diagnostic: locale controls persist and no data is sent by interacting',async({page})=>{
  const posts=[];
  page.on('request',r=>{if(r.method()!=='GET')posts.push(r.url())});
  await page.goto('/corporate/diagnostic/');
  await page.locator('#volume').fill('24');
  await page.locator('button[data-set-lang="ru"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.locator('#volume')).toHaveValue('24');
  await expect(page.locator('h1')).toContainText('Сколько');
  await page.locator('button[data-set-lang="uk"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','uk');
  await expect(page.locator('h1')).toContainText('Скільки');
  await expect(page.locator('#requestLink')).toHaveAttribute('href',/lang=uk/);
  expect(posts).toEqual([]);
});
