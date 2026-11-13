/* Localized public shop copy only. Payment verification and checkout remain owned by shop.js. */
(function(){
'use strict';
var dict={
en:{
  hero:['Independent, original, self-service toolkits','Useful tools. No subscription. No mystery promises.','Practical downloadable materials created for scientists and small teams: automate routine checks without handing over your data. Browse the exact contents before purchasing.'],
  card1:['Offline · One-time purchase','Turn messy experimental CSV files into traceable cleaning reports on your own computer.',['Python 3.10+; no paid dependencies or cloud access','Cleaned CSV and JSON quality report','Synthetic sample and ten regression tests','Flags missing values, exact duplicates, IQR outliers'],'See exact contents'],
  card2:['Offline · One-time purchase','Estimate automation payback and governance risk before hiring a developer or paying for another AI platform.',['Offline HTML calculator; no upload or account','CZK costs, savings, payback and 12-month view','Downloadable decision brief and paid-pilot template','Privacy, outbound messaging and buyer-demand risk gates'],'See exact contents'],
  extra:['Try something useful first','We publish free, original guides rather than asking you to trust a sales pitch. Learn how to recognize misleading CSV cleaning and how to calculate conservative automation ROI.','Research CSV checklist','Automation payback guide','Why these tools?','Made for reproducible analysis, realistic cost accounting and decisions you can check. No live AI assistant, no hidden upsell, no invented customer case studies.'],
  checkout:['Before checkout','Delivery is a ZIP download. By requesting immediate access you do not waive your statutory 14-day withdrawal right; refund requests are handled under the published terms. Paid training, consulting and custom support are not included.','I have read the','seller information, terms, privacy and withdrawal policy','and agree to the order conditions.','I request the digital ZIP to be made available immediately after payment and understand that the package is a self-service product.'],
  footer:['Czech Republic','Terms, privacy & cancellation','Digital goods are separate from Družina Moravy z. s. No customer data is transmitted until you choose to start checkout.'],
  status:{
  'Checkout not active':'Checkout not active','Checking payment availability...':'Checking payment availability...',
  'Checkout is temporarily closed pending business/tax verification. No payment can be taken.':'Checkout is temporarily closed pending business/tax verification. No payment can be taken.',
  'Secure digital checkout is available. The file is released after confirmed payment.':'Secure digital checkout is available. The file is released after confirmed payment.',
  'Checkout is currently unavailable. No payment can be taken.':'Checkout is currently unavailable. No payment can be taken.',
  'Please actively agree to the terms and request immediate digital delivery first.':'Please actively agree to the terms and request immediate digital delivery first.',
  'Connecting to secure checkout...':'Connecting to secure checkout...','Checkout remains closed. You have not been charged.':'Checkout remains closed. You have not been charged.',
  'Checkout is unavailable. You have not been charged.':'Checkout is unavailable. You have not been charged.','Try secure checkout again':'Try secure checkout again','Pay securely and download':'Pay securely and download'}
},
cs:{
  hero:['Nezávislé původní nástroje k samostatnému použití','Užitečné nástroje. Bez předplatného a planých slibů.','Praktické materiály ke stažení pro výzkumníky a malé týmy: automatizujte opakované kontroly, aniž byste předávali svá data. Před nákupem si prohlédněte přesný obsah.'],
  card1:['Offline · Jednorázový nákup','Proměňte neuspořádané experimentální CSV soubory na dohledatelné zprávy o čištění dat přímo ve svém počítači.',['Python 3.10+; bez placených závislostí a cloudu','Vyčištěné CSV a zpráva o kvalitě v JSON','Syntetický příklad a deset regresních testů','Označení chybějících hodnot, přesných duplicit a IQR odlehlých hodnot'],'Zobrazit přesný obsah'],
  card2:['Offline · Jednorázový nákup','Odhadněte návratnost automatizace a rizika správy ještě před najmutím vývojáře nebo nákupem další AI platformy.',['Offline HTML kalkulačka; žádné nahrávání ani účet','Náklady a úspory v Kč, návratnost a výhled na 12 měsíců','Rozhodovací podklad ke stažení a šablona placeného pilotu','Kontroly soukromí, komunikace a skutečné poptávky'],'Zobrazit přesný obsah'],
  extra:['Nejdřív vyzkoušejte něco užitečného','Zveřejňujeme bezplatné původní návody. Naučte se rozpoznat zavádějící čištění CSV a vypočítat konzervativní návratnost automatizace.','Kontrolní seznam pro CSV','Návod k návratnosti automatizace','Proč tyto nástroje?','Pro reprodukovatelnou analýzu, poctivé kalkulace nákladů a ověřitelná rozhodnutí. Nejde o živého AI asistenta; neslibujeme vymyšlené reference ani skryté bonusy.'],
  checkout:['Před objednávkou','Produktem je ZIP ke stažení. Žádostí o okamžitý přístup se nevzdáváte zákonného 14denního práva na odstoupení; vrácení peněz se řídí zveřejněnými podmínkami. Placená výuka, poradenství ani individuální podpora nejsou zahrnuty.','Přečetl/a jsem si','údaje o prodejci, obchodní podmínky, ochranu osobních údajů a podmínky odstoupení','a souhlasím s podmínkami objednávky.','Žádám o zpřístupnění digitálního ZIP ihned po zaplacení a rozumím tomu, že jde o produkt k samostatnému použití.'],
  footer:['Česká republika','Podmínky, soukromí a odstoupení (EN)','Digitální produkty jsou oddělené od Družina Moravy z. s. Dokud se nerozhodnete zahájit platbu, žádné zákaznické údaje neodesíláme.'],
  status:{
  'Checkout not active':'Platba zatím není aktivní','Checking payment availability...':'Ověřujeme dostupnost plateb...',
  'Checkout is temporarily closed pending business/tax verification. No payment can be taken.':'Platby jsou dočasně uzavřeny do ověření obchodních a daňových podmínek. Nelze zaplatit.',
  'Secure digital checkout is available. The file is released after confirmed payment.':'Zabezpečená platba je dostupná. Soubor uvolníme po potvrzené platbě.',
  'Checkout is currently unavailable. No payment can be taken.':'Platba nyní není dostupná. Nelze zaplatit.',
  'Please actively agree to the terms and request immediate digital delivery first.':'Nejprve výslovně potvrďte podmínky a požádejte o okamžité digitální dodání.',
  'Connecting to secure checkout...':'Připojujeme zabezpečenou platbu...','Checkout remains closed. You have not been charged.':'Platba je stále uzavřená. Nebylo vám nic naúčtováno.',
  'Checkout is unavailable. You have not been charged.':'Platba není dostupná. Nebylo vám nic naúčtováno.','Try secure checkout again':'Zkusit platbu znovu','Pay securely and download':'Bezpečně zaplatit a stáhnout'}
},
ru:{
  hero:['Оригинальные инструменты для самостоятельной работы','Полезные инструменты. Без подписок и пустых обещаний.','Скачиваемые материалы для учёных и небольших команд: автоматизируйте рутинные проверки, не передавая свои данные в облако. Точный состав доступен до покупки.'],
  card1:['Офлайн · Разовая покупка','Превратите сложные экспериментальные CSV-файлы в проверяемые отчёты об очистке данных на своём компьютере.',['Python 3.10+; без платных зависимостей и облака','Очищенный CSV и JSON-отчёт о качестве','Синтетический пример и десять регрессионных тестов','Поиск пропусков, точных дублей и выбросов IQR'],'Посмотреть состав'],
  card2:['Офлайн · Разовая покупка','Оцените окупаемость автоматизации и риски до заказа у разработчика или оплаты ещё одной платформы ИИ.',['Офлайн HTML-калькулятор, без загрузки данных и аккаунта','Затраты и экономия в Kč, окупаемость и прогноз на 12 месяцев','Скачиваемое обоснование решения и шаблон платного пилота','Проверки приватности, коммуникаций и спроса покупателей'],'Посмотреть состав'],
  extra:['Сначала попробуйте полезное бесплатно','Публикуем собственные бесплатные руководства: как распознать некачественную очистку CSV и консервативно оценить окупаемость автоматизации.','Чек-лист качества CSV','Руководство по окупаемости автоматизации','Зачем эти инструменты?','Для воспроизводимой аналитики, реалистичного учёта затрат и проверяемых решений. Это не онлайн-ИИ; без скрытых допродаж и вымышленных историй клиентов.'],
  checkout:['Перед оформлением','Вы получите ZIP-файл. Запрос на немедленный доступ сам по себе не лишает законного 14-дневного права на отказ; возвраты регулируются опубликованными условиями. Платное обучение, консультации и персональная поддержка не включены.','Я прочитал(а)','сведения о продавце, условия, политику приватности и порядок отказа','и согласен(на) с условиями заказа.','Я прошу предоставить цифровой ZIP сразу после оплаты и понимаю, что это продукт для самостоятельного использования.'],
  footer:['Чехия','Условия, приватность и отказ (EN)','Цифровые продукты не связаны с Družina Moravy z. s. Данные клиента не передаются, пока он сам не начнёт оформление оплаты.'],
  status:{
  'Checkout not active':'Оплата пока неактивна','Checking payment availability...':'Проверяем доступность оплаты...',
  'Checkout is temporarily closed pending business/tax verification. No payment can be taken.':'Оплата временно закрыта до проверки налоговых и деловых условий. Принять платёж нельзя.',
  'Secure digital checkout is available. The file is released after confirmed payment.':'Безопасная оплата доступна. Файл предоставляется после подтверждения платежа.',
  'Checkout is currently unavailable. No payment can be taken.':'Сейчас оплата недоступна. Принять платёж нельзя.',
  'Please actively agree to the terms and request immediate digital delivery first.':'Сначала явно согласитесь с условиями и запросите немедленную выдачу цифрового файла.',
  'Connecting to secure checkout...':'Подключаем безопасную оплату...','Checkout remains closed. You have not been charged.':'Оплата остаётся закрытой. С вас ничего не списано.',
  'Checkout is unavailable. You have not been charged.':'Оплата недоступна. С вас ничего не списано.','Try secure checkout again':'Повторить попытку оплаты','Pay securely and download':'Безопасно оплатить и скачать'}
},
uk:{
  hero:['Оригінальні інструменти для самостійної роботи','Корисні інструменти. Без підписок і порожніх обіцянок.','Матеріали для завантаження для науковців і невеликих команд: автоматизуйте рутинні перевірки, не передаючи дані в хмару. Точний склад доступний до придбання.'],
  card1:['Офлайн · Разова покупка','Перетворіть складні експериментальні CSV-файли на перевірювані звіти про очищення даних на власному комп’ютері.',['Python 3.10+; без платних залежностей і хмари','Очищений CSV та JSON-звіт про якість','Синтетичний приклад і десять регресійних тестів','Пошук пропусків, точних дублікатів і викидів IQR'],'Переглянути склад'],
  card2:['Офлайн · Разова покупка','Оцініть окупність автоматизації та ризики до замовлення у розробника або оплати ще однієї платформи ШІ.',['Офлайн HTML-калькулятор, без завантаження даних та облікового запису','Витрати й економія в Kč, окупність і прогноз на 12 місяців','Завантажуване обґрунтування рішення та шаблон платного пілоту','Перевірки приватності, комунікацій і попиту покупців'],'Переглянути склад'],
  extra:['Спочатку спробуйте корисне безкоштовно','Публікуємо власні безкоштовні посібники: як помітити неякісне очищення CSV і консервативно оцінити окупність автоматизації.','Контрольний список якості CSV','Посібник з окупності автоматизації','Навіщо ці інструменти?','Для відтворюваної аналітики, реалістичного обліку витрат і перевірюваних рішень. Це не онлайн-ШІ; без прихованих допродажів та вигаданих історій клієнтів.'],
  checkout:['Перед оформленням','Ви отримаєте ZIP-файл. Запит на негайний доступ сам собою не позбавляє законного 14-денного права на відмову; повернення коштів регулюються опублікованими умовами. Платне навчання, консультації та персональна підтримка не включені.','Я прочитав(ла)','відомості про продавця, умови, політику приватності та порядок відмови','і погоджуюся з умовами замовлення.','Прошу надати цифровий ZIP одразу після оплати та розумію, що це продукт для самостійного використання.'],
  footer:['Чехія','Умови, приватність і відмова (EN)','Цифрові продукти не пов’язані з Družina Moravy z. s. Дані клієнта не передаються, доки він сам не почне оформлення оплати.'],
  status:{
  'Checkout not active':'Оплата поки неактивна','Checking payment availability...':'Перевіряємо доступність оплати...',
  'Checkout is temporarily closed pending business/tax verification. No payment can be taken.':'Оплату тимчасово закрито до перевірки податкових та ділових умов. Прийняти платіж не можна.',
  'Secure digital checkout is available. The file is released after confirmed payment.':'Безпечна оплата доступна. Файл надається після підтвердження платежу.',
  'Checkout is currently unavailable. No payment can be taken.':'Зараз оплата недоступна. Прийняти платіж не можна.',
  'Please actively agree to the terms and request immediate digital delivery first.':'Спочатку явно погодьтеся з умовами й попросіть негайно надати цифровий файл.',
  'Connecting to secure checkout...':'Підключаємо безпечну оплату...','Checkout remains closed. You have not been charged.':'Оплата залишається закритою. З вас нічого не списано.',
  'Checkout is unavailable. You have not been charged.':'Оплата недоступна. З вас нічого не списано.','Try secure checkout again':'Повторити спробу оплати','Pay securely and download':'Безпечно сплатити й завантажити'}
}};
var query=new URLSearchParams(location.search),lang=dict[query.get('lang')]?query.get('lang'):'en',t=dict[lang];
document.documentElement.lang=lang;
function set(s,v){var el=document.querySelector(s);if(el)el.textContent=v;}
var hero=['.hero .eyebrow','.hero h1','.hero .wrap>p'];hero.forEach(function(sel,i){set(sel,t.hero[i]);});
Array.from(document.querySelectorAll('.cards article.card')).slice(0,2).forEach(function(card,i){
 var data=i===0?t.card1:t.card2;var tag=card.querySelector('.tag'),p=card.querySelector('p:not(.price)'),lis=card.querySelectorAll('li'),link=card.querySelector('.actions a');
 if(tag)tag.textContent=data[0];if(p)p.textContent=data[1];lis.forEach(function(li,j){if(data[2][j])li.textContent=data[2][j];});if(link)link.textContent=data[3];
});
[
 '.columns>div:first-child h2','.columns>div:first-child .lead','.columns>div:first-child .actions a:first-child',
 '.columns>div:first-child .actions a:nth-child(2)','.columns .panel h2','.columns .panel>p:first-of-type'
].forEach(function(sel,i){set(sel,t.extra[i]);});
set('#checkout-consent h2',t.checkout[0]);set('#checkout-consent .fineprint',t.checkout[1]);
var checks=document.querySelectorAll('#checkout-consent .check label');
if(checks[0]){checks[0].textContent=t.checkout[2]+' ';var a=document.createElement('a');a.href='./legal/';a.textContent=t.checkout[3];checks[0].appendChild(a);checks[0].appendChild(document.createTextNode(' '+t.checkout[4]));}
if(checks[1])checks[1].textContent=t.checkout[5];
document.querySelectorAll('[data-shop-footer]').forEach(function(el){var k={country:0,terms:1,notice:2}[el.dataset.shopFooter];if(k!==undefined)el.textContent=t.footer[k];});
// Translate shop.js status labels after their owner updates. No payment, request or consent state changes.
var targets=Array.from(document.querySelectorAll('#shop-status,#shop-error,[data-digital-product]'));
function translateStatus(el){var before=el.textContent;var after=t.status[before];if(after&&after!==before)el.textContent=after;}
targets.forEach(function(el){translateStatus(el);new MutationObserver(function(){translateStatus(el);}).observe(el,{childList:true,characterData:true,subtree:true});});
})();