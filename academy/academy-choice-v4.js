/* Academy service picker v4. Enhances the existing four-direction Academy; keeps tariff source,
   four languages and optional free-form WhatsApp enquiry. Does not alter prices or booking. */
(function(){
 'use strict';
 var root=document.getElementById('academy-choose');if(!root)return;
 var serviceMap=[
  ['czech','languages',{cs:'Čeština',en:'Czech',ru:'Чешский язык',uk:'Чеська мова'}],
  ['english','languages',{cs:'Angličtina',en:'English',ru:'Английский язык',uk:'Англійська мова'}],
  ['math','school',{cs:'Matematika',en:'Mathematics',ru:'Математика',uk:'Математика'}],
  ['physics','school',{cs:'Fyzika',en:'Physics',ru:'Физика',uk:'Фізика'}],
  ['chemistry','school',{cs:'Chemie',en:'Chemistry',ru:'Химия',uk:'Хімія'}],
  ['biology','school',{cs:'Biologie',en:'Biology',ru:'Биология',uk:'Біологія'}],
  ['biochemistry','school',{cs:'Biochemie',en:'Biochemistry',ru:'Биохимия',uk:'Біохімія'}],
  ['natural-sciences','school',{cs:'Přírodní vědy',en:'Natural Sciences',ru:'Естественные науки',uk:'Природничі науки'}],
  ['python','technical',{cs:'Programování · Python',en:'Programming · Python',ru:'Программирование · Python',uk:'Програмування · Python'}],
  ['data','technical',{cs:'Data · SQL · AI',en:'Data · SQL · AI',ru:'Данные · SQL · AI',uk:'Дані · SQL · AI'}],
  ['fitness','movement',{cs:'Osobní fitness',en:'Personal fitness',ru:'Индивидуальный фитнес',uk:'Особистий фітнес'}],
  ['calisthenics','movement',{cs:'Kalistenika',en:'Calisthenics',ru:'Калистеника',uk:'Калістеніка'}],
  ['fencing','movement',{cs:'Individuální šerm',en:'Private fencing',ru:'Индивидуальное фехтование',uk:'Індивідуальне фехтування'}],
  ['archery','movement',{cs:'Individuální lukostřelba',en:'Private archery',ru:'Индивидуальная стрельба из лука',uk:'Індивідуальна стрільба з лука'}],
  ['medical','support',{cs:'Tlumočení u lékaře',en:'Medical interpreting',ru:'Перевод у врача',uk:'Переклад у лікаря'}],
  ['offices','support',{cs:'Úřady a dokumenty',en:'Offices and documents',ru:'Учреждения и документы',uk:'Установи та документи'}],
  ['legal','support',{cs:'Hledání odborníka',en:'Finding a specialist',ru:'Поиск специалиста',uk:'Пошук фахівця'}]
 ];
 var dictionary={
 cs:{find:'Vyhledejte předmět nebo službu',placeholder:'Začněte psát: chemie, A2, fitness, Python…',found:'Vyberte možnost ze seznamu',choose:'Vybrat variantu →',custom:'Nic z toho? Popište svůj vlastní cíl →',allPrices:'Zobrazit úplný ceník a všechna zaměření',priceTitle:'Ceny na první pohled',priceLead:'Předběžné sazby pro nové poptávky; konkrétní rozsah, podmínky a termín potvrdíme písemně.',priceStudy:'Individuální výuka online',priceGroup:'Online mini-skupina · od 6 platících osob',priceMove:'Fitness online / osobně',priceConsult:'Pomoc s výběrem služby',priceNotes:'Skupina: 350 Kč/os./60 min do 31.12.2026, 400 Kč od 1.1.2027. Ostatní individuální odborné služby dle písemné nabídky. Dřívější dohody platí.',full:'Úplný původní ceník · otevřít 9 kategorií',extras:'Další informace, balíčky a placená konzultace',product:'Vyberte konkrétní formát',sub:'Tři srozumitelné možnosti pro váš cíl. Poptávka není rezervace.',school:['Škola a průběžné učivo','Přijímačky a maturita','Univerzita a náročné předměty'],technical:['Začít od základu','Praktický projekt nebo data','Univerzita a pokročilá práce'],languages:['Komunikace v životě a práci','Zkouška nebo certifikát','Studium a profesní situace'],movement:['Úvodní individuální lekce','Pravidelný osobní plán','Technika, koordinace a bezpečný postup'],support:['Příprava a porozumění','Tlumočení nebo doprovod','Praktické navazující kroky'],safe:'Výuka pohybu není lékařská péče. Šerm a lukostřelba vyžadují ověřené místo, výstroj a bezpečnostní podmínky.',legal:'Pouze jazyková a organizační podpora, nikoliv právní rady nebo léčení.'},
 en:{find:'Search for a subject or service',placeholder:'Try chemistry, A2, fitness, Python…',found:'Choose a matching option',choose:'Choose this option →',custom:'Not a fit? Describe your own goal →',allPrices:'See full prices and every activity',priceTitle:'Prices at a glance',priceLead:'Published rates for new enquiries; actual scope, availability and terms are agreed in writing.',priceStudy:'Individual tutoring online',priceGroup:'Online mini-group · 6+ paid participants',priceMove:'Fitness online / in person',priceConsult:'Help choosing a service',priceNotes:'Group: 350 Kč/person/60 min until 31 Dec 2026; 400 Kč from 1 Jan 2027. Specialist services quoted in writing. Existing agreements unchanged.',full:'Full original price list · 9 categories',extras:'More details, packages and paid advice',product:'Choose a concrete format',sub:'Three clear ways to reach your goal. Enquiring is not booking.',school:['School and coursework','Entrance and graduation exams','University-level subjects'],technical:['Start from zero','Practical project or data','University and advanced skills'],languages:['Everyday and workplace conversation','Exams and certification','Study and professional situations'],movement:['First private session','Regular personal plan','Technique, coordination and safe progress'],support:['Prepare and understand','Interpreting or accompaniment','Practical follow-up'],safe:'Fitness is not medical care; fencing and archery require venue, equipment and safety verification.',legal:'Language and organisational help only, not legal or medical advice.'},
 ru:{find:'Найдите предмет или услугу',placeholder:'Например: химия, A2, фитнес, Python…',found:'Выберите вариант из списка',choose:'Выбрать этот вариант →',custom:'Не нашли подходящее? Описать свою задачу →',allPrices:'Все цены и направления деятельности',priceTitle:'Цены с первого взгляда',priceLead:'Публичные ставки для новых запросов. Состав, доступность и условия согласуются письменно.',priceStudy:'Индивидуальный урок онлайн',priceGroup:'Онлайн-минигруппа · от 6 оплативших',priceMove:'Фитнес онлайн / очно',priceConsult:'Помощь с выбором услуги',priceNotes:'Группа: 350 Kč/чел./60 мин до 31.12.2026; 400 Kč с 01.01.2027. Специализированные услуги — по письменному предложению. Старые договорённости действуют.',full:'Полный оригинальный прайс · 9 категорий',extras:'Дополнительные программы, пакеты и консультация',product:'Выберите конкретный формат',sub:'Три понятных решения под вашу цель. Запрос — ещё не запись.',school:['Школьная программа и контрольные','Вступительные экзамены и выпускные','Предмет в университете'],technical:['Начать с нуля','Практический проект и данные','Университет и продвинутый уровень'],languages:['Для жизни и работы','Для экзамена или сертификата','Для учёбы и профессии'],movement:['Первая индивидуальная тренировка','План регулярных занятий','Техника, координация и безопасность'],support:['Подготовить вопросы и документы','Перевод или сопровождение','Следующие организационные шаги'],safe:'Это не медицинская услуга. Фехтование и стрельба из лука — только после проверки места, снаряжения и безопасности.',legal:'Только языковая и организационная помощь, без медицинских и юридических консультаций.'},
 uk:{find:'Знайдіть предмет або послугу',placeholder:'Наприклад: хімія, A2, фітнес, Python…',found:'Оберіть варіант зі списку',choose:'Обрати цей варіант →',custom:'Не знайшли свого? Опишіть власну мету →',allPrices:'Усі ціни та напрями діяльності',priceTitle:'Ціни з першого погляду',priceLead:'Публічні ставки для нових звернень. Обсяг, доступність та умови погоджуються письмово.',priceStudy:'Індивідуальне заняття онлайн',priceGroup:'Онлайн-мінігрупа · від 6 оплативших',priceMove:'Фітнес онлайн / очно',priceConsult:'Допомога з вибором послуги',priceNotes:'Група: 350 Kč/особу/60 хв до 31.12.2026; 400 Kč з 01.01.2027. Спеціальні послуги за письмовою пропозицією. Раніше погоджені умови зберігаються.',full:'Повний оригінальний прайс · 9 категорій',extras:'Додаткові програми, пакети та консультація',product:'Оберіть конкретний формат',sub:'Три зрозумілі рішення для вашої мети. Звернення не дорівнює бронюванню.',school:['Шкільний курс і контрольні','Вступні та випускні іспити','Університетський предмет'],technical:['Почати з основ','Практичний проєкт і дані','Університет і поглиблений рівень'],languages:['Для життя й роботи','Для іспиту або сертифіката','Для навчання та професії'],movement:['Перше індивідуальне заняття','План регулярних тренувань','Техніка, координація та безпека'],support:['Підготувати запитання й документи','Переклад або супровід','Наступні організаційні кроки'],safe:'Це не медична допомога. Фехтування та стрільба з лука — після перевірки місця, спорядження і безпеки.',legal:'Лише мовна та організаційна допомога, без медичних чи юридичних консультацій.'}
 };
 var chosen='',initialized=false;
 function lc(){var c=document.documentElement.lang;return dictionary[c]?c:'cs'}
 function t(){return dictionary[lc()]}
 function safeText(s){return String(s||'').replace(/[&<>"']/g,function(v){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&#39;':'&#39;',"'":'&#39;'}[v]})}
 function sById(id){return serviceMap.find(function(x){return x[0]===id})||serviceMap[0]}
 function msg(subject,variant){
  var tag={cs:'Dobrý den! Zajímá mě služba Academy: ',en:'Hello! I am interested in an Academy service: ',ru:'Здравствуйте! Интересует услуга Академии: ',uk:'Вітаю! Цікавить послуга Академії: '}[lc()];
  var p={cs:'Poptávám konkrétní rozsah, termín a cenu: ',en:'Please confirm scope, dates and price: ',ru:'Прошу согласовать объём, время и цену: ',uk:'Прошу узгодити обсяг, час і ціну: '}[lc()];
  return 'https://wa.me/420702914842?text='+encodeURIComponent(tag+subject+'. '+(variant||'')+'. '+p);
 }
 function setup(){
   var root=document.getElementById('academy-choose');if(!root)return;
   var lang=lc(),d=t();
   var picker=document.getElementById('academy-service-picker');
   if(!picker){
     picker=document.createElement('section');picker.id='academy-service-picker';
     picker.innerHTML='<label id="academy-search-label" for="academy-service-search"></label><div class="academy-combo"><input id="academy-service-search" type="search" role="combobox" aria-autocomplete="list" aria-controls="academy-service-options" aria-expanded="false" autocomplete="off"><div id="academy-service-options" role="listbox" hidden></div></div><div id="academy-selected-service" aria-live="polite"></div>';
     var hero=document.querySelector('main .hero#academy .wrap');
     var review=hero&&hero.querySelector('.reviews-badge');
     if(hero)hero.insertBefore(picker,review||null);
     else root.prepend(picker);
     var input=picker.querySelector('input'),menu=picker.querySelector('#academy-service-options');
     function list(){
       var q=input.value.trim().toLocaleLowerCase(),found=serviceMap.filter(function(s){return Object.values(s[2]).some(function(v){return v.toLocaleLowerCase().includes(q)})}).slice(0,16);
       menu.replaceChildren();found.forEach(function(s){
         var btn=document.createElement('button');btn.type='button';btn.setAttribute('role','option');btn.textContent=s[2][lc()];btn.addEventListener('click',function(){chosen=s[0];input.value=s[2][lc()];menu.hidden=true;input.setAttribute('aria-expanded','false');draw();});
         menu.append(btn);
       });
       menu.hidden=!found.length;input.setAttribute('aria-expanded',String(found.length>0));
     }
     input.addEventListener('focus',list);input.addEventListener('input',list);
     input.addEventListener('keydown',function(e){
       if(e.key==='Escape'){menu.hidden=true;input.setAttribute('aria-expanded','false');}
       if(e.key==='Enter'&&!menu.hidden&&menu.firstChild){e.preventDefault();menu.firstChild.click();}
     });
     document.addEventListener('click',function(e){if(!picker.contains(e.target)){menu.hidden=true;input.setAttribute('aria-expanded','false')}});
   }
   picker.querySelector('#academy-search-label').textContent=d.find;
   picker.querySelector('input').placeholder=d.placeholder;
   picker.querySelector('input').setAttribute('aria-label',d.find);
   if(!picker.querySelector('input').matches(':focus'))picker.querySelector('input').value=chosen?sById(chosen)[2][lang]:'';
   var arr=[['czech','czech','english'],['fitness','calisthenics','fencing'],['math','chemistry','python'],['medical','offices','legal']];
   root.querySelectorAll('.goal-detail').forEach(function(section,i){
      section.querySelectorAll('.goal-option a').forEach(function(a,j){
        var service=arr[i]&&arr[i][j];if(!service)return;
        a.href='#academy-service-picker';a.textContent=d.choose;a.removeAttribute('target');a.removeAttribute('rel');
        a.onclick=function(e){e.preventDefault();chosen=service;draw();document.getElementById('academy-service-picker').scrollIntoView({block:'start'});};
      });
      var c=section.querySelector('.academy-custom');if(!c){c=document.createElement('a');c.className='academy-custom';section.append(c);}
      c.textContent=d.custom;c.href=msg(section.querySelector('h3')?.textContent||'',d.custom);c.target='_blank';c.rel='noopener noreferrer';
   });
   draw();
   initPrices();
 }
 function draw(){
   var target=document.getElementById('academy-selected-service');if(!target)return;
   if(!chosen){target.replaceChildren();return;}
   var lang=lc(),d=t(),sv=sById(chosen),name=sv[2][lang],options=d[sv[1]]||d.school;
   var html='<h3>'+safeText(name)+'</h3><p>'+safeText(d.sub)+'</p><div class="academy-service-three">';
   options.forEach(function(title,i){
     var spec=sv[0]==='fencing'||sv[0]==='archery'?d.safe:sv[0]==='legal'||sv[0]==='medical'?d.legal:'';
     var product=window.ImperionAcademyCatalog&&window.ImperionAcademyCatalog.info(sv[0],'v'+(i+1),lang);
     var price=product&&product.label||({cs:'Cena dle nabídky',en:'Quoted price',ru:'Цена по запросу',uk:'Ціна за пропозицією'})[lang];
     var destination='order/?lang='+encodeURIComponent(lang)+'&service='+encodeURIComponent(sv[0])+'&variant=v'+(i+1);
     var orderText=({cs:'Objednat →',en:'Order →',ru:'Заказать →',uk:'Замовити →'})[lang];
     html+='<article class="academy-service-option"><h4>'+safeText(title)+'</h4><p>'+safeText(name)+' · '+safeText(title)+(spec?'. '+safeText(spec):'')+'</p><strong class="academy-option-price">'+safeText(price)+'</strong><a href="'+destination+'">'+safeText(orderText)+'</a></article>';
   });
   target.innerHTML=html+'</div><a class="academy-custom" target="_blank" rel="noopener noreferrer" href="'+msg(name,d.custom)+'">'+safeText(d.custom)+'</a>';
 }
 function initPrices(){
   var target=document.getElementById('academy-pricing'),d=t();
   if(!target)return;
   var overview=document.getElementById('academy-prices-brief');
   if(!overview){overview=document.createElement('section');overview.id='academy-prices-brief';target.prepend(overview);}
   var categories=target.querySelector('.price-cats'),jumps=target.querySelector('.price-jump-list');
   var details=document.getElementById('academy-full-prices');
   if(!details){details=document.createElement('details');details.id='academy-full-prices';details.innerHTML='<summary></summary><div id="academy-full-prices-body"></div>';target.append(details);}
   details.querySelector('summary').textContent=d.full;
   var body=details.querySelector('#academy-full-prices-body');
   if(jumps){var oldJump=body.querySelector('.price-jump-list');if(oldJump&&oldJump!==jumps)oldJump.remove();body.append(jumps);}
   if(categories){var oldCats=body.querySelector('.price-cats');if(oldCats&&oldCats!==categories)oldCats.remove();body.append(categories);}
   overview.innerHTML='<div class="eyebrow-sm">ACADEMY · OSVČ</div><h2>'+safeText(d.priceTitle)+'</h2><p>'+safeText(d.priceLead)+'</p><div class="academy-price-four">'+
      [[d.priceStudy,'690 Kč / 60 min'],[d.priceGroup,'350 Kč / osoba / 60 min'],[d.priceMove,'400 / 600 Kč / 60 min'],[d.priceConsult,'200 Kč / 10 min']].map(function(x){return '<div class="academy-price-tile"><span>'+safeText(x[0])+'</span><strong>'+safeText(x[1])+'</strong></div>';}).join('')+'</div><p class="academy-price-explainer">'+safeText(d.priceNotes)+'</p><a class="academy-prices-open" href="#academy-full-prices">'+safeText(d.allPrices)+'</a>';
   overview.querySelector('.academy-prices-open').addEventListener('click',function(e){e.preventDefault();details.open=true;details.scrollIntoView({block:'start'});});
   function onHash(){if(/^#price-(edu|fit|nutr|supp|hous|itsec|coach|web|trek)$/.test(location.hash))details.open=true;}
   if(!initialized){window.addEventListener('hashchange',onHash);}
   onHash();
   if(!initialized){
     var main=document.querySelector('main#page-content'),milestone=document.getElementById('academy-milestones'),consult=document.getElementById('service-choice-consultation');
     if(main&&milestone&&consult){
       var more=document.createElement('details');more.id='academy-more-services';more.innerHTML='<summary></summary><div class="academy-more-services-body"></div>';
       main.append(more);more.querySelector('.academy-more-services-body').append(milestone,consult);
     }
   }
   var extra=document.getElementById('academy-more-services');if(extra)extra.querySelector('summary').textContent=d.extras;
   initialized=true;
 }
 function update(){window.setTimeout(setup,0)}
 document.addEventListener('site:language',update);
 setup();
})();
