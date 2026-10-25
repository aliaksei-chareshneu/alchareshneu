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

for (const lang of ['cs', 'en', 'ru', 'uk']) {
  test(`technical answers: copy enquiry in ${lang} without sending or storing the brief`, async ({page}) => {
    await page.setViewportSize({width:390, height:844});
    await page.addInitScript(() => {
      window.copiedEnquiries = [];
      Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{
        writeText: async text => { window.copiedEnquiries.push(text); }
      }});
    });
    await page.goto('/corporate/technical-answers/?lang=' + lang + '&utm_source=website-test&utm_campaign=copy-test');
    await expect(page.locator('#timing')).toHaveAttribute('placeholder', {cs:'např. příští měsíc',en:'e.g. next month',ru:'Например, следующий месяц',uk:'Наприклад, наступний місяць'}[lang]);
    await page.locator('#copy-brief').click();
    await expect(page.locator('#copy-fallback')).toBeHidden();
    expect(await page.evaluate(() => window.copiedEnquiries)).toEqual([]);
    await page.locator('#company').fill('Synthetic test team');
    await page.locator('#problem').fill('Synthetic documentation task\nSecond line');
    await page.locator('#budget').selectOption('14900-30000 CZK');
    await page.locator('#timing').fill('Synthetic preferred date');
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.locator('#copy-brief').click();
    await expect(page.locator('#copy-fallback')).toBeVisible();
    await expect(page.locator('#copy-status')).not.toBeEmpty();
    const copied = await page.evaluate(() => window.copiedEnquiries);
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain('To: chereshnev.biochem@gmail.com');
    expect(copied[0]).toContain('Language: ' + lang);
    expect(copied[0]).toContain('Synthetic test team');
    expect(copied[0]).toContain('Synthetic documentation task\nSecond line');
    expect(copied[0]).toContain('Budget: 14900-30000 CZK');
    expect(copied[0]).toContain('Campaign source: website-test');
    expect(copied[0]).toContain('Campaign: copy-test');
    expect(copied[0]).toContain('not an order or payment');
    await expect(page.locator('#brief-copy')).toHaveValue(copied[0]);
    expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain('Synthetic');
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

for (const clipboard of ['denied', 'unavailable']) {
  test(`technical answers: selectable manual fallback when clipboard is ${clipboard}`, async ({page}) => {
    await page.addInitScript(mode => {
      Object.defineProperty(navigator, 'clipboard', {configurable:true, value:mode === 'unavailable' ? undefined : {
        writeText: async () => { throw new DOMException('Clipboard denied', 'NotAllowedError'); }
      }});
    }, clipboard);
    await page.goto('/corporate/technical-answers/?lang=en');
    await page.locator('#company').fill('Synthetic test team');
    await page.locator('#problem').fill('Synthetic task');
    await page.locator('#copy-brief').click();
    await expect(page.locator('#copy-status')).toContainText('Copy the selected text');
    await expect(page.locator('#copy-status')).toContainText('Nothing has been sent');
    await expect(page.locator('#brief-copy')).toBeFocused();
    const selected = await page.locator('#brief-copy').evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd));
    expect(selected).toContain('Synthetic task');
    await page.locator('button[data-lang="ru"]').click();
    await expect(page.locator('#copy-status')).toContainText('Пока ничего не отправлено');
    await expect(page.locator('#company')).toHaveValue('Synthetic test team');
  });
}

test('technical answers: native email fallback remains available without JavaScript', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled:false});
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8000/corporate/technical-answers/');
  await expect(page.locator('#copy-brief')).toBeHidden();
  await expect(page.locator('#copy-fallback')).toBeHidden();
  await expect(page.locator('#fallback-email')).toBeVisible();
  await expect(page.locator('#brief-form')).toHaveAttribute('action', 'mailto:chereshnev.biochem@gmail.com');
  await context.close();
});
