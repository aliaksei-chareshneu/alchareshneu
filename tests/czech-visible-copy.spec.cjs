'use strict';
const { test, expect } = require('@playwright/test');

// Catch literal Cyrillic leaking from legacy multilingual HTML into the
// *visible* Czech page. Source-text scans are wrong here: RU and UA
// translations must remain in the DOM, but must be hidden from CZ visitors.
const czechPages = [
  '/?view=details&lang=cs',
  '/druzina/?lang=cs',
  '/walkers/?lang=cs',
  '/calendar/?lang=cs',
  '/academy/?lang=cs'
];

for (const url of czechPages) {
  test('Czech page does not display Cyrillic copy: ' + url, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('html')).toHaveAttribute('lang', 'cs');
    // innerText, unlike textContent, excludes display:none language panels.
    const leaked = await page.evaluate(() => {
      const visible = document.body.innerText;
      return (visible.match(/[^\n]{0,65}[\u0400-\u052f][^\n]{0,85}/gu) || []).slice(0, 12);
    });
    expect(leaked, 'Visible non-Czech copy: ' + JSON.stringify(leaked)).toEqual([]);
  });
}

for (const path of ['/walkers/', '/calendar/']) {
  test('Registration labels follow CZ/RU/UA choices: ' + path, async ({ page }) => {
    await page.goto(path + '?lang=cs');
    const actions = page.locator('.reg-launch .reg-actions a[data-site-language]');
    await expect(actions).toHaveCount(4);
    await expect(actions.filter({ visible: true })).toHaveCount(1);
    await expect(page.locator('.reg-launch .reg-actions a[data-site-language="cs"]')).toBeVisible();
    await expect(page.locator('.reg-launch .reg-actions a[data-site-language="ru"]')).toBeHidden();

    for (const language of ['ru', 'uk', 'cs']) {
      await page.locator('#imp-shell-top [data-imp-lang="' + language + '"]').click();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('.reg-launch .reg-actions a[data-site-language="' + language + '"]')).toBeVisible();
      await expect(actions.filter({ visible: true })).toHaveCount(1);
    }
  });
}

test('Root quick-training entry is monolingual in each selected language', async ({ page }) => {
  await page.goto('/?view=details&lang=cs');
  const links = page.locator('.dm-root-fast-entry [data-quick-lang]');
  await expect(links).toHaveCount(4);
  await expect(links.filter({ visible: true })).toHaveCount(1);
  await expect(page.locator('.dm-root-fast-entry [data-quick-lang="cs"]')).toBeVisible();
  await expect(page.locator('.dm-root-fast-entry [data-quick-lang="ru"]')).toBeHidden();
});
