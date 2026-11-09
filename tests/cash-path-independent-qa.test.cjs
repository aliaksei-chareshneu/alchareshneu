const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const read = file => fs.readFileSync(file, 'utf8');

test('Academy hero is an honest enquiry CTA in every locale', () => {
  const html = read('academy/index.html');
  assert.match(html, /data-i18n="academy\.ctaRegister"[^>]*>Request a session</);
  assert.match(html, /data-i18n="academy\.ctaDisclaimer"/);
  for (const label of [
    'Request a session',
    'Отправить запрос на занятие',
    'Poptat lekci',
    'Надіслати запит на заняття'
  ]) assert.match(html, new RegExp(`ctaRegister: "${label}"`));
  for (const caveat of [
    'Sending the form is an enquiry, not a booking or payment.',
    'Отправка формы — это заявка, а не бронь или оплата.',
    'Odeslání formuláře je poptávka, nikoli rezervace nebo platba.',
    'Надсилання форми — це запит, а не бронювання чи оплата.'
  ]) assert.ok(html.includes(caveat), `missing honest Academy caveat: ${caveat}`);
});

test('Walkers current private-tour enquiry reaches owner with neutral year and source', () => {
  const html = read('walkers/index.html');
  const links = [...html.matchAll(/href="(mailto:[^"]*BrnoWalkers%20private%20Brno%20tour[^"]*)"/g)]
    .map(match => match[1]);
  assert.equal(links.length, 5, 'initial HTML plus four locale templates');
  for (const href of links) {
    assert.match(href, /subject=BrnoWalkers%20private%20Brno%20tour%20enquiry/);
    assert.match(href, /body=Source%3Dwalkers_private_tour/);
    assert.doesNotMatch(href, /subject=[^&]*2027/);
  }
  assert.match(html, /3,500 Kč/);
  assert.match(html, /3 500 Kč/);
});

function button(product) {
  return {
    dataset: {digitalProduct: product}, disabled: true, textContent: '',
    addEventListener(type, handler) { if (type === 'click') this.clickHandler = handler; }
  };
}

test('Shop activates only approved prices and requires consent before Stripe redirect', async () => {
  const buttons = [button('csv_rescue'), button('ai_roi')];
  const status = {textContent: ''};
  const error = {textContent: ''};
  const terms = {checked: false, focus() { this.focused = true; }};
  const immediate = {checked: false, focus() { this.focused = true; }};
  const elements = {'shop-status': status, 'shop-error': error, 'agree-terms': terms, 'agree-immediate': immediate};
  const calls = [];
  let redirect = '';
  const fetch = async (url, options = {}) => {
    calls.push({url, options});
    if (url.endsWith('/health')) return {ok: true, json: async () => ({products: [
      {product_key: 'csv_rescue', price_czk: 490, checkout_active: true},
      {product_key: 'ai_roi', price_czk: 690, checkout_active: true}
    ]})};
    return {ok: true, json: async () => ({checkout_url: 'https://buy.stripe.com/synthetic-safe-test'})};
  };
  const context = {
    document: {
      getElementById: id => elements[id] || null,
      querySelectorAll: selector => selector === '[data-digital-product]' ? buttons : []
    },
    window: {location: {assign: url => { redirect = url; }}},
    fetch, Array, JSON, Error
  };
  vm.runInNewContext(read('shop/shop.js'), context, {filename: 'shop/shop.js'});
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(buttons.map(item => item.disabled), [false, false]);
  assert.equal(status.textContent, 'Secure digital checkout is available. The file is released after confirmed payment.');

  await buttons[0].clickHandler();
  assert.equal(calls.length, 1, 'no checkout POST before both consents');
  assert.match(error.textContent, /actively agree/);
  assert.equal(redirect, '');

  terms.checked = true;
  immediate.checked = true;
  await buttons[0].clickHandler();
  assert.equal(calls.length, 2);
  const payload = JSON.parse(calls[1].options.body);
  assert.deepEqual(payload, {
    product_key: 'csv_rescue', accepted_terms: true,
    immediate_delivery_requested: true, policy_version: 'digital-v1-20261108'
  });
  assert.equal(redirect, 'https://buy.stripe.com/synthetic-safe-test');
});

test('Shop fails closed on a price mismatch and never claims payment', async () => {
  const buttons = [button('csv_rescue')];
  const status = {textContent: ''};
  const context = {
    document: {
      getElementById: id => id === 'shop-status' ? status : null,
      querySelectorAll: () => buttons
    },
    window: {location: {assign() { throw new Error('must not redirect'); }}},
    fetch: async () => ({ok: true, json: async () => ({products: [
      {product_key: 'csv_rescue', price_czk: 491, checkout_active: true}
    ]})}),
    Array, JSON, Error
  };
  vm.runInNewContext(read('shop/shop.js'), context, {filename: 'shop/shop.js'});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(buttons[0].disabled, true);
  assert.equal(status.textContent, 'Checkout is temporarily closed pending business/tax verification. No payment can be taken.');
});
