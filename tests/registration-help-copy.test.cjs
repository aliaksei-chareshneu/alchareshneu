const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pages = ['register/index.html','register/en/index.html','register/ru/index.html','register/uk/index.html'];

test('all four registration pages distinguish receipt from approved seat and explain privacy-safe error screenshots', () => {
 for (const path of pages) {
  const html = fs.readFileSync(path,'utf8');
  const cases = [
   ['cs','Přihlášku jsme přijali.','místo ještě není rezervováno','snímek obrazovky se skrytými osobními údaji'],
   ['en','Your registration was received.','no place is reserved yet','screenshot with personal details hidden'],
   ['ru','Заявка получена.','место пока не забронировано','скриншот со скрытыми личными данными'],
   ['uk','Заявку отримано.','місце ще не заброньоване','скриншот із прихованими особистими даними']
  ];
  for (const [locale,received,pending,screenshot] of cases) {
   assert.ok(html.includes(received),path+'/'+locale+' receipt');
   assert.ok(html.includes(pending),path+'/'+locale+' pending');
   assert.ok(html.includes(screenshot),path+'/'+locale+' screenshot');
  }
  assert.doesNotMatch(html,/Repeating the same details does not create another entry/);
 }
});
