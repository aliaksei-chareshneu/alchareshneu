'use strict';
const { test, expect } = require('@playwright/test');

// Only a synthetic in-memory form: NO external employer domain, CV or email.
test('cloud browser fills synthetic application and verifies local-only receipt', async ({ page }) => {
  const network = [];
  page.on('request', request => {
    if (!request.url().startsWith('about:') && !request.url().startsWith('data:')) {
      network.push(request.url());
    }
  });
  await page.setContent([
    '<!doctype html><html><body>',
    '<form id="synthetic" action="#" method="post">',
    '<label>Name <input name="name" required></label>',
    '<label>Email <input name="email" type="email" required></label>',
    '<label>CV <input name="cv" type="file" required></label>',
    '<button type="submit">Submit synthetic</button>',
    '</form><output id="receipt"></output>',
    '<script>',
    'document.querySelector("#synthetic").addEventListener("submit", function(event) {',
    'event.preventDefault();',
    'var form = event.currentTarget;',
    'if (form.elements.name.value === "QA_SYNTHETIC_ONLY" &&',
    'form.elements.email.value === "qa@example.invalid" &&',
    'form.elements.cv.files.length === 1 &&',
    'form.elements.cv.files[0].name === "qa-synthetic-cv.txt") {',
    'document.querySelector("#receipt").textContent = "QA_RECEIPT_LOCAL_ONLY";',
    '}',
    '});',
    '</script></body></html>',
  ].join(''));
  await page.getByLabel('Name').fill('QA_SYNTHETIC_ONLY');
  await page.getByLabel('Email').fill('qa@example.invalid');
  await page.getByLabel('CV').setInputFiles({
    name: 'qa-synthetic-cv.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('SYNTHETIC_TEST_ONLY\n'),
  });
  await page.getByRole('button', { name: 'Submit synthetic' }).click();
  await expect(page.locator('#receipt')).toHaveText('QA_RECEIPT_LOCAL_ONLY');
  expect(network).toEqual([]);
  await expect(page.locator('form')).toHaveAttribute('action', '#');
});
