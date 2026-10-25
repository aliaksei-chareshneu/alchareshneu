const { test, expect } = require('@playwright/test');

const langs = {
  cs: /Méně hledání v dokumentech/,
  en: /Stop hunting through documents/,
  ru: /Меньше поиска по документам/,
  uk: /Менше пошуку в документах/
};

for (const [lang, headline] of Object.entries(langs)) {
  for (const width of [360, 390, 768, 1440]) {
    test('technical answers '+lang+' '+width+'px: offer, locale, overflow and links', async ({page}) => {
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.setViewportSize({width, height:820});
      await page.goto('/corporate/technical-answers/?lang='+lang);
      await expect(page.locator('html')).toHaveAttribute('lang',lang);
      await expect(page.locator('h1')).toHaveText(headline);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('.price')).toContainText('14 900 Kč');
      await expect(page.locator('a[href="#brief"]')).toHaveCount(2);
      await expect(page.locator('#fallback-email')).toHaveAttribute('href',/^mailto:chereshnev\.biochem@gmail\.com/);
      await expect(page.locator('.sampleBadge')).toHaveCount(0); // No decorative fake social proof widget
      const state = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
        const broken = [...document.querySelectorAll('main a[href^="#"]')]
          .filter(e => !document.getElementById(e.getAttribute('href').slice(1))).map(e => e.href);
        return {
          noOverflow: document.documentElement.scrollWidth <= innerWidth+1,
          duplicateIds: ids.filter((v,i) => ids.indexOf(v) !== i),
          broken,
          visibleLanguageButtons: [...document.querySelectorAll('.languages button')]
            .filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.dataset.lang)
        };
      });
      expect(state.noOverflow).toBe(true);
      expect(state.duplicateIds).toEqual([]);
      expect(state.broken).toEqual([]);
      expect(state.visibleLanguageButtons).toEqual([lang]);
      expect(errors).toEqual([]);
    });
  }
}

test('technical answers: calculator only estimates current workload and changes live', async({page})=>{
  await page.goto('/corporate/technical-answers/?lang=en');
  await expect(page.locator('#monthly-hours')).toHaveText('10 h');
  await page.locator('#volume').fill('60');
  await page.locator('#minutes').fill('20');
  await expect(page.locator('#monthly-hours')).toHaveText('20 h');
  await expect(page.locator('[data-t="calcResult"]')).toContainText('not guaranteed savings');
  await page.locator('#volume').fill('100001');
  await expect(page.locator('#monthly-hours')).toHaveText('0 h');
});

test('technical answers: validation does not trigger an email on empty fields', async({page})=>{
  await page.goto('/corporate/technical-answers/?lang=cs');
  await expect(page.locator('#company')).toHaveAttribute('required','');
  await expect(page.locator('#problem')).toHaveAttribute('required','');
  await page.locator('.brief-form button[type="submit"]').click();
  expect(await page.locator('#company').evaluate(e=>e.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/technical-answers/);
  await page.locator('#company').fill('Test company (synthetic)');
  await page.locator('.brief-form button[type="submit"]').click();
  expect(await page.locator('#problem').evaluate(e=>e.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/technical-answers/);
});

test('technical answers: language switching and corporate referral are usable',async({page})=>{
  await page.goto('/corporate/?lang=cs');
  await expect(page.locator('#technical-answers-preview')).toBeVisible();
  await page.locator('#technical-answers-preview a[href="technical-answers/?lang=cs"]').click();
  await expect(page).toHaveURL(/technical-answers\/\?lang=cs/);
  await page.locator('button[data-lang="uk"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','uk');
  await expect(page.locator('h1')).toContainText('Менше');
  await page.locator('button[data-lang="ru"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ru');
  await expect(page.locator('h1')).toContainText('Меньше');
  await page.locator('button[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('h1')).toContainText('Stop hunting');
});

test('homepage prioritizes B2B pilot and preserves separate community choice',async({page})=>{
  for(const lang of ['cs','en','ru','uk']){
    await page.goto('/?lang='+lang);
    await expect(page.locator('#heroCta')).toHaveAttribute('href','corporate/technical-answers/?lang='+lang);
    await expect(page.locator('#heroCorporateCta')).toHaveAttribute('href','start/?lang='+lang);
    await expect(page.locator('#heroCta')).toContainText(lang==='en'?'14,900':'14 900');
  }
});
