const {test,expect}=require('@playwright/test');

const languages=['cs','en','ru','uk'];
const widths=[360,390,768,1440];

for(const lang of languages){
  test('Druzina November dashboard: '+lang+' responsive visuals and safety gates',async({page})=>{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));

    for(const width of widths){
      await page.setViewportSize({width,height:900});
      await page.goto('/druzina/novinky/?lang='+lang);
      await expect(page.locator('html')).toHaveAttribute('lang',lang);
      await expect(page.locator('article.locale:visible')).toHaveCount(1);

      const article=page.locator('article[data-locale="'+lang+'"]');
      await expect(article).toBeVisible();
      await expect(article.locator('h1')).toHaveCount(1);
      await expect(article.locator('.fact')).toHaveCount(4);
      await expect(article.locator('.data-table')).toHaveCount(3);
      await expect(article.locator('.data-table thead th')).toHaveCount(8);
      await expect(article.locator('.fold')).toHaveCount(8);
      await expect(article.locator('.fold[open]')).toHaveCount(0);
      await expect(article.locator('.progress-step')).toHaveCount(3);
      await expect(article.locator('.alert-strip')).toBeVisible();
      await expect(article.locator('.primary[href^="https://wa.me/420702914842"]')).toHaveCount(1);
      await expect(article.locator('form, input[type="submit"], a[href*="revolut.me"]')).toHaveCount(0);

      await expect(article.locator('.resource[href="../ranks.html?lang='+lang+'"]')).toHaveCount(1);
      await expect(article.locator('.resource[href="../cesty/?lang='+lang+'"]')).toHaveCount(1);
      await expect(article.locator('.resource[href="../rules/#'+lang+'"]')).toHaveCount(1);

      const quality=await page.evaluate(()=>{
        const ids=Array.from(document.querySelectorAll('[id]')).map(x=>x.id);
        const repeats=ids.filter((x,i)=>ids.indexOf(x)!==i);
        const targets=Array.from(document.querySelectorAll('main a[href^="#"]'))
          .map(x=>x.hash.slice(1)).filter(x=>x && !document.getElementById(decodeURIComponent(x)));
        const overflow=document.documentElement.scrollWidth-innerWidth;
        const tables=Array.from(document.querySelectorAll('article:not([hidden]) table')).map(t=>({
          rows:t.tBodies[0].rows.length,
          heads:t.tHead.rows[0].cells.length
        }));
        return {repeats,targets,overflow,tables};
      });
      expect(quality.repeats).toEqual([]);
      expect(quality.targets).toEqual([]);
      expect(quality.overflow).toBeLessThanOrEqual(1);
      expect(quality.tables).toEqual([{rows:8,heads:3},{rows:5,heads:3},{rows:4,heads:2}]);

      const first=article.locator('.fold').first();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open','');
      await expect(first.locator('.fold-content')).toBeVisible();
      await first.locator('summary').click();
      await expect(first).not.toHaveAttribute('open','');

      if(width===360||width===1440){
        await page.screenshot({path:'test-results/druzina-novinky-'+lang+'-'+width+'.png',fullPage:false});
      }
    }
    expect(errors).toEqual([]);
  });
}

test('November dashboard language switch preserves section anchor and source params',async({page})=>{
  await page.goto('/druzina/novinky/?lang=ru&utm_source=telegram#ru-pricing');
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await page.locator('.language button[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page).toHaveURL(/lang=en&utm_source=telegram#en-pricing$/);
  await expect(page.locator('article.locale:visible')).toHaveCount(1);
  await expect(page.locator('article[data-locale="ru"]')).toBeHidden();
  await expect(page.locator('article[data-locale="en"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await page.locator('.language button[data-lang="uk"]').click();
  await expect(page).toHaveURL(/lang=uk&utm_source=telegram#uk-pricing$/);
  await expect(page.locator('article[data-locale="uk"] .data-table')).toHaveCount(3);
});