const {test, expect} = require('@playwright/test');

const names = {
  en: 'Important next step?',
  cs: 'Důležitý krok před vámi?',
  ru: 'Важный шаг в жизни?',
  uk: 'Важливий крок у житті?'
};
const codes = ['UNI','MED','A2','CER','CAREER','DEFENSE','EXEC','LIFE'];

for (const [language, heading] of Object.entries(names)) {
  test('Academy milestone programmes: accessible, localized and scroll-safe — ' + language, async ({page}) => {
    const failed = [];
    page.on('pageerror', error => failed.push(error.message));
    await page.setViewportSize({width:375, height:812});
    await page.goto('/academy/programmes/?lang=' + language + '&utm_source=test&utm_medium=smoke&utm_campaign=academy20261105');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('h1:visible')).toContainText(heading);
    await expect(page.locator('.locale:visible')).toHaveCount(1);
    await expect(page.locator('.offer:visible')).toHaveCount(8);
    await expect(page.locator('.conditions:visible')).toContainText('690 Kč');
    await expect(page.locator('a.choose:visible')).toHaveCount(8);
    await expect(page.locator('#programme option')).toHaveCount(8);
    await expect(page.locator('link[href="../../site-design.css?v=20261027"]')).toHaveCount(1);
    for(const width of [360,375,768,1280]) {
      await page.setViewportSize({width,height:812});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      expect(overflow,'No horizontal overflow at '+width+'px in '+language).toBeLessThanOrEqual(1);
    }
    const code='A2';
    await page.locator('.locale:visible [data-choose="' + code + '"]').click();
    await expect(page.locator('#programme')).toHaveValue(code);
    await expect(page).toHaveURL(/#enquire$/);
    expect(failed).toEqual([]);
  });
}

test('Academy milestone enquiries preselect A2 from the free quiz and keep verified scope', async ({page}) => {
  await page.goto('/academy/programmes/?lang=cs&programme=A2&utm_source=a2_quiz&utm_medium=site&utm_campaign=life_milestones_20261105#enquire');
  await expect(page.locator('#programme')).toHaveValue('A2');
  await expect(page.locator('.locale:visible')).toContainText('trvalý pobyt');
  await expect(page.locator('.locale:visible')).toContainText('nikoli zkoušku B1 k občanství');
  await expect(page.locator('.offer:visible')).toHaveCount(8);
  await expect(page.locator('#interest-form')).toHaveCount(1);
  expect((await page.locator('#interest-form').getAttribute('action'))).toBeNull();
});

test('Academy legacy paths link to the new page without replacing the existing course catalogue', async ({page}) => {
  for(const route of ['/academy/','/academy/courses/','/academy/a2/']) {
    await page.goto(route);
    const link=page.locator('a[href*="programmes/"]').first();
    await expect(link).toHaveCount(1);
    const href=await link.getAttribute('href');
    expect(href).toContain('utm_campaign=life_milestones_20261105');
  }
});
