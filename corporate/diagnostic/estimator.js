'use strict';
// Local-only, illustrative workflow capacity calculation.
// No network, storage, customer data or offer submission.
(function(root){
  const FEE_CZK = 14900; // canonical indicative AI Knowledge Pilot, confirm quote in writing.
  function calculate(input){
    const limits={volume:100000,before:10000,after:10000,hourly:1000000};
    for(const k of Object.keys(limits)){
      if(!Number.isFinite(input[k]) || input[k]<0 || input[k]>limits[k])return {valid:false};
    }
    if(!Number.isInteger(input.volume))return {valid:false};
    const rawMinutes=input.volume*(input.before-input.after);
    const savedMinutes=Math.max(0,rawMinutes);
    const savedHours=savedMinutes/60;
    const capacityValue=savedHours*input.hourly;
    return {valid:true,savedHours,capacityValue,
      paybackMonths:capacityValue>0?FEE_CZK/capacityValue:null,
      noTimeSaving:rawMinutes<=0};
  }
  const locale={
    cs:{eyebrow:'Nezávazná diagnostika · orientační výpočet',title:'Kolik času může váš tým získat zpět?',intro:'Vyberte jeden opakující se úkol. Započítejte i ruční kontrolu výstupů AI. Hodnoty zůstanou ve vašem prohlížeči a nikam se neposílají.',inputsHead:'Vaše předpoklady',volume:'Počet opakování za měsíc',volumeHint:'Počet dokumentů, dotazů nebo reportů.',before:'Ruční práce na úkol (minut)',after:'Práce s AI včetně kontroly (minut)',afterHint:'Zahrňte dohledání zdrojů, opravy a lidské schválení.',hourly:'Interní hodnota hodiny práce (Kč)',hourHint:'Pouze váš interní předpoklad, nikoliv garantovaná úspora hotovosti.',resultsHead:'Modelový výsledek',savedHours:'hodin potenciálně uvolněných za měsíc',capacityValue:'modelová hodnota této kapacity měsíčně',disclaimer:'Nejde o cenovou nabídku, finanční zisk ani prognózu. Skutečný efekt a bezpečnost se ověřují až v placeném pilotu. Vstupní data se nikam neodesílají; výpočet běží lokálně.',cta:'Poptat jeden omezený pilot',offer:'Rozsah a ceny',pricing:'AI Knowledge Pilot: orientačně 14 900 Kč. Cena se potvrzuje až po zadání, ověření datových práv a podmínek. Odeslání formuláře není objednávka.',how:'Jak je vymezené placené ověření',step1head:'1. Vyberte jeden proces',step1:'Cíl, vlastník procesu, bezpečné příklady, stav před zavedením.',step2head:'2. Otestujte kontrolovaný postup',step2:'Práce pouze se schválenými zdroji, testy a povinné lidské schválení.',step3head:'3. Ověřte výsledek',step3:'Srovnání dohodnuté metriky, předání SOP a jasná pravidla přijímání.',footer:'Bezplatný orientační výpočet. Žádné klientské ani citlivé údaje sem nevkládejte.',breakEven:'Modelové srovnání s cenou pilotu 14 900 Kč: {months} měs. (bez implementace, licencí a dalších nákladů).',noSaving:'Za těchto předpokladů žádná úspora času nevychází. Pilot nedává smysl bez změny procesu.',invalid:'Zkontrolujte nezáporné hodnoty a rozsah vstupů.'},
    en:{eyebrow:'Nonbinding diagnostic · illustrative calculation',title:'How much team time could you recover?',intro:'Choose one repeatable task. Include human review and correction time. All numbers stay in this browser and are never submitted.',inputsHead:'Your assumptions',volume:'Tasks per month',volumeHint:'Documents, questions or reports.',before:'Manual time per task (minutes)',after:'Time with AI including review (minutes)',afterHint:'Include checking sources, corrections and human sign-off.',hourly:'Internal value of one work hour (CZK)',hourHint:'Your own assumption, not guaranteed cash savings.',resultsHead:'Illustrative outcome',savedHours:'potential work hours recovered monthly',capacityValue:'hypothetical monthly value of that capacity',disclaimer:'Not a quote, financial return or forecast. Actual results and security are evaluated in a scoped paid pilot. Inputs are never transmitted; this runs locally.',cta:'Request a bounded pilot',offer:'Scope and prices',pricing:'AI Knowledge Pilot: indicative 14,900 CZK. Final fee depends on scope, data rights and written terms. Submitting an enquiry is not an order.',how:'What a paid pilot covers',step1head:'1. Select one workflow',step1:'Goal, process owner, safe samples and current baseline.',step2head:'2. Test a controlled process',step2:'Approved source material, repeatable tests and mandatory human sign-off.',step3head:'3. Verify the result',step3:'Agreed measure, reproducible handover and acceptance rules.',footer:'Free illustrative calculation. Do not enter personal or confidential customer information.',breakEven:'Illustrative comparison with 14,900 CZK pilot price: {months} months (excludes implementation, licences and all other costs).',noSaving:'These assumptions imply no time saving. Do not commission a pilot without changing the process.',invalid:'Check that inputs are nonnegative and within the allowed limits.'},
    ru:{eyebrow:'Предварительная диагностика · расчёт без обязательств',title:'Сколько рабочего времени можно вернуть команде?',intro:'Выберите одну повторяющуюся задачу. Учитывайте время человеческой проверки и исправлений. Числа остаются только в браузере.',inputsHead:'Ваши предположения',volume:'Количество задач в месяц',volumeHint:'Документы, запросы или отчёты.',before:'Время вручную на задачу (минут)',after:'Время с ИИ, включая проверку (минут)',afterHint:'Включите поиск источников, исправления и одобрение человеком.',hourly:'Внутренняя стоимость часа работы (Kč)',hourHint:'Ваше допущение, а не гарантированная денежная экономия.',resultsHead:'Сценарный результат',savedHours:'потенциально высвобождаемых часов в месяц',capacityValue:'условная месячная стоимость высвобожденного времени',disclaimer:'Это не оферта, не прибыль и не прогноз. Фактический результат и безопасность проверяются в согласованном платном пилоте. Данные никуда не отправляются.',cta:'Запросить ограниченный пилот',offer:'Объём и цены',pricing:'AI Knowledge Pilot: ориентир 14 900 Kč. Итоговая цена после согласования задачи, прав на данные и письменных условий. Заявка не является заказом.',how:'Что включается в пилот',step1head:'1. Выбрать один процесс',step1:'Цель, ответственный, безопасные примеры и исходные измерения.',step2head:'2. Проверить управляемый сценарий',step2:'Разрешённые источники, повторяемые тесты и обязательное одобрение человеком.',step3head:'3. Подтвердить результат',step3:'Согласованная метрика, инструкция и критерии приёмки.',footer:'Бесплатный сценарный расчёт. Не вводите персональные или конфиденциальные данные клиентов.',breakEven:'Сценарное сравнение с ценой пилота 14 900 Kč: {months} мес. (без внедрения, лицензий и остальных затрат).',noSaving:'При таких вводных экономия времени отсутствует. Пилот без изменения процесса нецелесообразен.',invalid:'Проверьте диапазон и неотрицательность значений.'},
    uk:{eyebrow:'Попередня діагностика · розрахунок без зобов’язань',title:'Скільки робочого часу можна повернути команді?',intro:'Оберіть одне повторюване завдання. Врахуйте людську перевірку та виправлення. Числа залишаються лише у браузері.',inputsHead:'Ваші припущення',volume:'Кількість завдань на місяць',volumeHint:'Документи, запити або звіти.',before:'Ручна робота на завдання (хвилин)',after:'Робота з AI та перевіркою (хвилин)',afterHint:'Врахуйте перевірку джерел, виправлення та схвалення людиною.',hourly:'Внутрішня вартість години роботи (Kč)',hourHint:'Ваше припущення, а не гарантована грошова економія.',resultsHead:'Сценарний результат',savedHours:'потенційно вивільнених годин щомісяця',capacityValue:'умовна місячна вартість вивільненого часу',disclaimer:'Це не пропозиція, прибуток чи прогноз. Реальний результат і безпека перевіряються в погодженому платному пілоті. Вхідні дані нікуди не надсилаються.',cta:'Запитати обмежений пілот',offer:'Обсяг і ціни',pricing:'AI Knowledge Pilot: орієнтовно 14 900 Kč. Остаточна ціна після погодження завдання, прав на дані та письмових умов. Заявка не є замовленням.',how:'Що включає пілот',step1head:'1. Обрати один процес',step1:'Мета, відповідальний, безпечні приклади та вихідні вимірювання.',step2head:'2. Випробувати контрольований сценарій',step2:'Дозволені джерела, повторювані тести та обов’язкове схвалення людиною.',step3head:'3. Підтвердити результат',step3:'Погоджена метрика, інструкція та критерії приймання.',footer:'Безкоштовний сценарний розрахунок. Не вводьте особисті або конфіденційні дані клієнтів.',breakEven:'Сценарне порівняння з ціною пілоту 14 900 Kč: {months} міс. (без впровадження, ліцензій та інших витрат).',noSaving:'За такими припущеннями економії часу немає. Не замовляйте пілот без зміни процесу.',invalid:'Перевірте діапазон та невід’ємність значень.'}
  };
  if(typeof module!=='undefined' && module.exports)module.exports={calculate,FEE_CZK};
  if(typeof document==='undefined')return;
  const qp=new URLSearchParams(location.search);
  let lang=Object.prototype.hasOwnProperty.call(locale,qp.get('lang'))?qp.get('lang'):'cs';
  const $=id=>document.getElementById(id);
  const fmtNumber=(value,maxDecimals=1)=>Number(value).toLocaleString(lang==='en'?'en-US':lang==='ru'?'ru-RU':lang==='uk'?'uk-UA':'cs-CZ',{maximumFractionDigits:maxDecimals});
  function render(){
    const input={};
    for(const k of ['volume','before','after','hourly'])input[k]=Number($(k).value);
    const result=calculate(input),d=locale[lang];
    if(!result.valid){
      $('hoursResult').textContent='—';$('moneyResult').textContent='—';$('breakEvenText').textContent='';
      $('warningText').textContent=d.invalid;$('warningText').hidden=false;return;
    }
    $('hoursResult').textContent=fmtNumber(result.savedHours);
    $('moneyResult').textContent=fmtNumber(result.capacityValue,0)+' Kč';
    $('warningText').hidden=!result.noTimeSaving;
    $('warningText').textContent=result.noTimeSaving?d.noSaving:'';
    $('breakEvenText').textContent=result.paybackMonths?
      d.breakEven.replace('{months}',fmtNumber(result.paybackMonths,1)):'';
  }
  function setLang(next){
    lang=Object.prototype.hasOwnProperty.call(locale,next)?next:'cs';
    document.documentElement.lang=lang;
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const key=el.dataset.i18n;if(Object.prototype.hasOwnProperty.call(locale[lang],key))el.textContent=locale[lang][key];
    });
    document.querySelectorAll('[data-set-lang]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.setLang===lang)));
    const link=$('requestLink');const u=new URL(link.getAttribute('href'),location.href);u.searchParams.set('lang',lang);
    u.searchParams.set('service','DATA_PILOT');u.searchParams.set('src','ai_workflow_diagnostic');
    // Preserve only bounded non-sensitive attribution keys from this page, not arbitrary URL data.
    for(const key of ['utm_source','utm_medium','utm_campaign']){
      const value=qp.get(key)||'';
      if(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value))u.searchParams.set(key,value);
    }
    link.href=u.href;
    render();
  }
  document.querySelectorAll('[data-set-lang]').forEach(btn=>btn.addEventListener('click',()=>setLang(btn.dataset.setLang)));
  for(const id of ['volume','before','after','hourly'])$(id).addEventListener('input',render);
  setLang(lang);
})(typeof globalThis!=='undefined'?globalThis:this);
