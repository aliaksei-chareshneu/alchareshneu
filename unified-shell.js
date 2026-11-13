/* IMPERION shared site shell. One navigation, no extra menu trees, no network/PII writes.
   Source of truth for destinations is the canonical site root inferred from this file. */
(function(){
  'use strict';
  var script=document.querySelector('script[src*="unified-shell.js"]');
  if(!script||!document.body||document.getElementById('imp-shell-top'))return;
  var root=new URL('./',script.src);
  var path=location.pathname.slice(root.pathname.length);
  if(!location.pathname.startsWith(root.pathname)||!path||path==='index.html')return;
  var section=path.split('/')[0];
  var active=({academy:'academy',druzina:'club','druzina-moravy':'club',
    walkers:'walkers',calendar:'events',events:'events',about:'about',partners:'partners'})[section]||'';
  var copy={
    cs:{home:'Úvod',events:'Akce',academy:'Akademie',club:'Družina',walkers:'BrnoWalkers',about:'O mně',partners:'Partneři',skip:'Přejít k obsahu',nav:'Hlavní navigace'},
    en:{home:'Home',events:'Events',academy:'Academy',club:'Družina',walkers:'BrnoWalkers',about:'About',partners:'Partners',skip:'Skip to content',nav:'Main navigation'},
    ru:{home:'Главная',events:'События',academy:'Академия',club:'Дружина',walkers:'BrnoWalkers',about:'Обо мне',partners:'Партнёры',skip:'К содержанию',nav:'Главная навигация'},
    uk:{home:'Головна',events:'Події',academy:'Академія',club:'Дружина',walkers:'BrnoWalkers',about:'Про мене',partners:'Партнери',skip:'До вмісту',nav:'Головна навігація'}
  };
  var supported=Array.from(new Set(
    Array.from(document.querySelectorAll('button[data-lang], a[data-lang], button[data-switch]'))
      .map(function(x){return x.getAttribute('data-lang')||x.getAttribute('data-switch');})
      .filter(function(x){return ['cs','en','ru','uk'].indexOf(x)>=0;})
  ));
  var registerIndex=/^register\/(?:(?:en|ru|uk)\/)?(?:index\.html)?$/.test(path);
  if(['about','partners'].includes(section)||registerIndex||path==='druzina/cesty/'||path==='druzina/cesty/index.html')supported=['cs','en','ru','uk'];
  // Some informational pages have four dedicated language sections rather than buttons.
  if(!supported.length&&document.querySelector('[data-locale="cs"], [data-dm-hero-all-lang="cs"]'))
    supported=['cs','en','ru','uk'];
  var q=new URLSearchParams(location.search),request=q.get('lang');
  var routeLang=registerIndex?(path.match(/^register\/(en|ru|uk)\//)||[])[1]:null;
  var lang=copy[routeLang]?routeLang:copy[request]&&(!supported.length||supported.indexOf(request)>=0)?request:
           (copy[document.documentElement.lang]?document.documentElement.lang:'cs');
  if(supported.length&&supported.indexOf(lang)<0)lang=supported[0];
  var main=document.querySelector('main');
  if(main&&!main.id)main.id='imp-page-content';
  var mainId=main?'#'+main.id:'#imp-shell-top';
  var skip=document.createElement('a');
  skip.className='imp-shell-skip';skip.href=mainId;skip.textContent=copy[lang].skip;
  var header=document.createElement('header');
  header.id='imp-shell-top';header.setAttribute('role','banner');
  var inside=document.createElement('div');inside.className='imp-shell-inner';
  var brand=document.createElement('a');brand.className='imp-shell-logo';
  var shield=document.createElement('span');shield.className='imp-shell-logo-mark';shield.setAttribute('aria-hidden','true');shield.textContent='⚔';
  var brandCopy=document.createElement('span');brandCopy.className='imp-shell-logo-copy';
  var brandTop=document.createElement('strong');brandTop.textContent='IMPERION';
  var brandSub=document.createElement('small');brandSub.textContent='HISTORIE · ZÁŽITKY · ROZVOJ';
  brandCopy.appendChild(brandTop);brandCopy.appendChild(brandSub);
  brand.appendChild(shield);brand.appendChild(brandCopy);inside.appendChild(brand);
  var nav=document.createElement('nav');nav.className='imp-shell-links';nav.id='imp-shell-links';nav.setAttribute('aria-label',copy[lang].nav);
  var keys=['home','events','academy','club','walkers','about','partners'],links={};
  keys.forEach(function(k){
    var a=document.createElement('a');a.dataset.impLink=k;a.textContent=copy[lang][k];
    if(k===active)a.setAttribute('aria-current','page');
    nav.appendChild(a);links[k]=a;
  });inside.appendChild(nav);
  var language=document.createElement('div');language.className='imp-shell-lang';language.setAttribute('role','group');language.setAttribute('aria-label','Language / Jazyk');
  ['cs','en','ru','uk'].forEach(function(l){
    if(supported.length===0||supported.indexOf(l)<0)return;
    var a=document.createElement('a');a.dataset.impLang=l;a.lang=l;a.hreflang=l;a.textContent=l==='cs'?'CZ':l==='uk'?'UA':l.toUpperCase();
    if(lang===l)a.setAttribute('aria-current','true');
    language.appendChild(a);
  });
  if(language.children.length>0)inside.appendChild(language);
  header.appendChild(inside);
  function urlFor(route,code){var u=new URL(route,root);u.searchParams.set('lang',code);return u.href;}
  function bindTargets(code){
    brand.href=urlFor('',code);
    links.home.href=urlFor('',code);
    links.events.href=urlFor('',code)+'#impr-calendar';
    links.academy.href=urlFor('academy/',code);
    links.club.href=urlFor('druzina/',code);
    links.walkers.href=urlFor('walkers/',code);
    links.about.href=urlFor('about/',code);
    links.partners.href=urlFor('partners/',code);
    Array.from(language.children).forEach(function(a){
      var u=registerIndex?new URL('register/'+(a.dataset.impLang==='cs'?'':a.dataset.impLang+'/'),root):new URL(location.href);
      // Keep a selected event and allowed source when changing registration language.
      if(registerIndex){['event','src','utm_source','utm_medium','utm_campaign'].forEach(function(key){
        var val=q.get(key);if(val&&val.length<150)u.searchParams.set(key,val);
      });}
      u.searchParams.set('lang',a.dataset.impLang);
      a.href=u.href;
    });
  }
  bindTargets(lang);
  if(section==='partners')document.documentElement.lang=lang;
  // Keep the historical global menus in the DOM for script compatibility and no-JS fallback,
  // but retire their *visual* duplication only after the new header is mounted.
  var retired=[];
  Array.from(document.body.children).forEach(function(node){
    if(node===header||node===skip)return;
    if(node.classList&&node.classList.contains('tabs-bar')){retired.push(node);return;}
    if(node.tagName==='NAV'){retired.push(node);return;}
    if(node.tagName==='HEADER'&&!node.querySelector('h1'))retired.push(node);
  });
  Array.from(document.querySelectorAll('body > main > nav.top,body > main > nav.nav')).forEach(function(node){retired.push(node);});
  retired.forEach(function(node){node.setAttribute('data-imp-retired-nav','1');});
  document.body.insertBefore(header,document.body.firstChild);
  document.body.insertBefore(skip,header);
  document.body.setAttribute('data-imp-nav-ready','yes');
  document.body.setAttribute('data-imp-active-section',active);
  // Atomic first render: old navigation is retired before the page becomes visible.
  document.documentElement.setAttribute('data-imp-shell-complete','yes');
  // Wait for remaining deferred locale and goal scripts before the first paint.
  var show=function(){document.documentElement.removeAttribute('data-imp-boot');};
  if(document.readyState==='complete')show();
  else document.addEventListener('DOMContentLoaded',show,{once:true});
  // Supplemental social feeds are still reachable, but do not form a second navigation row.
  if(path==='walkers/'||path==='walkers/index.html'){
    var extras=document.querySelector('.hero-ctas-secondary');
    var home=document.querySelector('#event-types .wrap');
    if(extras&&home){extras.classList.add('imp-section-extras');home.appendChild(extras);}
  }
  if(path==='calendar/'||path==='calendar/index.html'){
    var e=document.querySelector('.hero-ctas-secondary');
    var container=document.querySelector('#calendar-events .wrap');
    if(e&&container){e.classList.add('imp-section-extras');container.appendChild(e);}
  }

  // IMPERION VALUE-FIRST / 2026-11-13. Editorial only; no duplicate CRM, pricing engine or tracking.
  // Problem -> actual opportunity cost -> realistic change -> published conditions.
  (function mountValueStory(){
    if(!main || !['druzina','walkers','academy','corporate'].includes(section) ||
       document.getElementById('imp-value-story'))return;
    var stories={
      cs:{
        druzina:['Schází vám pohyb, přátelé nebo výzva?','Po práci se snadno opakuje stejný program. Možná chcete něco aktivního, ale nevíte, kde začít.','Další volné večery mohou uběhnout bez nové zkušenosti, zkoušení dovedností či setkání s lidmi.','Zkuste bezpečně vedený historický šerm, společné výzvy a postupné učení v Družině Moravy. Každý se zapojuje svým tempem.','První dotaz je nezávazný. Místo, věk, bezpečnostní podmínky a případnou cenu konkrétní akce potvrdí pořadatel. Klub a členství z. s. nejsou osobní placenou službou.','Zeptat se na první návštěvu','register/'],
        walkers:['Nechcete trávit další víkend pořád stejně?','Rádi byste poznali okolí Brna a potkali lidi, ale nemáte s kým nebo kam vyrazit.','Bez naplánovaného společného programu mohou příležitosti poznávat nová místa i nové lidi zůstávat nevyužité.','S BrnoWalkers můžete vyzkoušet výlety, procházky, hry nebo prohlídky podle skutečně vypsané akce.','V kalendáři jsou konkrétní termíny a aktuální podmínky. Cena může být nulová nebo placená dle akce; přihláška není potvrzení účasti.','Najít skutečnou akci','?category=walkers#impr-calendar'],
        academy:['Brzdí vás jazyk, škola nebo nová dovednost?','Chybí vám čeština pro běžný život, příprava ke zkoušce nebo jistota v odborném tématu.','Bez cíleného procvičování se mohou opakovat stejné obtíže a odkládat další studijní nebo pracovní kroky.','Domluvte si konkrétní cíl, látku a formu individuální výuky. Pokrok závisí na výchozí úrovni a vlastní práci; není garantovaný.','Výuka je komerční služba OSVČ. Aktuálně zveřejněné sazby, délku a podmínky najdete v Academy; objednávka vzniká až po písemném potvrzení.','Vybrat cíl a zobrazit ceny','academy/#academy-choose'],
        corporate:['Ztrácí tým hodiny opakovanými odbornými dotazy?','Technické odpovědi se hledají v dokumentech, kontrolují a připravují opakovaně.','Vlastní náklad si spočítejte: měsíční hodiny na procesu × plné hodinové náklady pracovníků. Bez vašich dat úsporu netvrdíme.','Ověřte pilot, v němž AI připravuje návrhy ze schválených podkladů a člověk je před odesláním kontroluje.','Konkrétní zákaznický AI pilot je na stránce uveden za 19 900 Kč; samostatný technický pilot má jiné podmínky. Rozsah, návratnost a platba se potvrzují písemně.','Poptat konkrétní pilot','corporate/#ai-pilot']
      },
      en:{
        druzina:['Looking for movement, friends or a challenge?','Your free evenings feel repetitive. You want an active hobby but may not know where to begin.','Another season can pass without trying something new, developing a skill or meeting people.','Explore supervised historical fencing, team challenges and gradual skill-building with Družina Moravy at your own pace.','An enquiry is non-binding. The organiser confirms each session’s venue, age and safety conditions and any fee. Association membership is not a personal paid service.','Ask about a first visit','register/'],
        walkers:['Tired of the same weekends?','You want to explore around Brno and meet people but need a plan and company.','Without a plan, opportunities to discover places and connect with others can slip past.','Try a listed BrnoWalkers hike, walk, board-game gathering or city experience, depending on the real event.','Check each verified event’s date and terms in the calendar. Some activities are free, some paid; an enquiry is not a confirmed place.','Explore upcoming events','?category=walkers#impr-calendar'],
        academy:['Is language, an exam or a new skill holding you back?','You need Czech for daily life, exam preparation or help with a challenging subject.','Without targeted practice, the same obstacles may delay your next study or career step.','Set a clear learning goal and choose focused individual instruction. Progress depends on your starting point and practice, not a guarantee.','Academy lessons are an OSVČ commercial service. Published rates and duration are available on its page; the final booking terms are agreed in writing.','Choose a goal and see prices','academy/#academy-choose'],
        corporate:['Are repeated technical enquiries consuming team hours?','Staff repeatedly search documents, check facts and draft similar technical responses.','Calculate your present cost using your own data: monthly staff hours × fully loaded hourly cost. We do not invent a savings estimate.','Trial a scoped, human-reviewed AI response workflow based on approved documentation. Your team keeps control of every outgoing response.','The published customer-enquiry pilot is 19,900 CZK; the separate technical pilot has different terms. Scope and payment require written agreement.','Request a scoped pilot','corporate/#ai-pilot']
      },
      ru:{
        druzina:['Хочется движения, друзей и настоящего вызова?','После работы вечера проходят одинаково, а интересное активное хобби всё откладывается.','Могут пройти ещё месяцы без новых навыков, совместных приключений и знакомств. Это не денежный счёт, а упущенные возможности.','Попробуйте историческое фехтование, командные задачи и постепенное освоение навыков в Družina Moravy — в подходящем темпе и с вниманием к безопасности.','Обращение не обязывает платить. Место, возрастные и безопасностные условия и цену конкретного занятия подтверждает организатор. Членство НКО — отдельный вопрос.','Узнать о первом занятии','register/'],
        walkers:['Опять одинаковые выходные?','Хочется открывать Моравию и знакомиться, но не всегда есть компания или идея маршрута.','Без совместных планов можно упускать новые места, впечатления и возможности общаться.','В BrnoWalkers есть походы, прогулки, городские экскурсии и игры — участвуйте в реально объявленных событиях.','У каждого события свои проверенные дата, цена и условия. Некоторые бесплатны, другие платные; заявка ещё не бронь.','Выбрать ближайшее событие','?category=walkers#impr-calendar'],
        academy:['Язык, экзамен или навык мешают двигаться дальше?','Нужен чешский для жизни, помощь с экзаменом, учебным предметом или IT-задачей.','Если постоянно откладывать практику, те же трудности могут снова мешать учёбе и работе.','Выберите конкретную цель и индивидуальный формат обучения. Мы работаем над навыками, но не гарантируем экзамен, профессию или доход.','Занятия Academy — коммерческая услуга OSVČ. Актуальные опубликованные ставки и длительность — на странице; условия подтверждаются письменно.','Выбрать цель и посмотреть цены','academy/#academy-choose'],
        corporate:['Команда теряет часы на однотипных технических вопросах?','Специалисты каждый раз ищут сведения, проверяют документацию и готовят похожие ответы.','Рассчитайте свою текущую цену проблемы: часы сотрудников за месяц × полная стоимость их часа. Без данных экономию не обещаем.','Проверьте ограниченный AI-пилот: ответы готовятся по согласованным источникам, отправка — только после проверки человеком.','Пилот клиентских запросов на сайте стоит 19 900 Kč. Другой технический пилот имеет отдельные условия; предмет, оплата и результат согласуются письменно.','Запросить пилот','corporate/#ai-pilot']
      },
      uk:{
        druzina:['Хочеться руху, друзів і справжнього виклику?','Вільні вечори повторюються, а цікаве активне хобі весь час відкладається.','Можуть минути місяці без нових навичок, спільних пригод і знайомств. Це втрачені можливості, не вигадані грошові збитки.','Спробуйте історичне фехтування, командні завдання й поступове вдосконалення у Družina Moravy з увагою до безпеки.','Звернення не зобов’язує платити. Організатор підтверджує місце, вікові та безпекові умови й ціну конкретного заняття. Членство ГО — окреме питання.','Дізнатись про перше заняття','register/'],
        walkers:['Знову однакові вихідні?','Хочеться пізнати Моравію та нових людей, але бракує компанії чи маршруту.','Без спільних планів легко втрачати нагоди побачити нові місця та познайомитися.','BrnoWalkers пропонує походи, прогулянки, екскурсії й ігри — обирайте реально оголошені події.','Кожна подія має перевірену дату, ціну й умови. Деякі безкоштовні, інші платні; заявка ще не бронювання.','Обрати подію','?category=walkers#impr-calendar'],
        academy:['Мова, іспит або навичка заважають рухатися далі?','Потрібна чеська для життя, підготовка до іспиту чи допомога з навчальним предметом.','Без цілеспрямованої практики ті самі труднощі можуть затримувати подальше навчання чи роботу.','Оберіть конкретну мету й індивідуальне навчання. Результат залежить від підготовки та практики, без гарантій іспиту чи заробітку.','Academy — комерційна послуга OSVČ. Чинні опубліковані ціни й тривалість доступні на сторінці; умови підтверджуються письмово.','Обрати мету та переглянути ціни','academy/#academy-choose'],
        corporate:['Команда витрачає години на повторювані технічні запити?','Фахівці знову шукають інформацію, перевіряють документи та готують схожі відповіді.','Обчисліть власну вартість проблеми: місячні години працівників × повна погодинна вартість. Не обіцяємо економію без ваших даних.','Спробуйте обмежений AI-пілот: чернетки з погоджених джерел, кожну відповідь затверджує людина.','Окремий пілот клієнтських запитів коштує 19 900 Kč за опублікованою пропозицією; інші послуги оцінюються окремо. Умови погоджують письмово.','Запросити пілот','corporate/#ai-pilot']
      }
    };
    var headings={
      cs:['PRO VÁŠ KONKRÉTNÍ CÍL','Co vás dnes stojí odkládání','Co se může změnit','Cena a další krok'],
      en:['START WITH YOUR GOAL','What waiting costs you today','What could change','Investment and next step'],
      ru:['НАЧНИТЕ СО СВОЕЙ ЦЕЛИ','Что стоит откладывание','Что может измениться','Стоимость и следующий шаг'],
      uk:['ПОЧНІТЬ ЗІ СВОЄЇ МЕТИ','Чого коштує відкладання','Що може змінитися','Вартість і наступний крок']
    };
    var anchor=section==='corporate'?main.querySelector('.revenue-head'):main.querySelector('.hero');
    if(!anchor)return;
    var sectionEl=document.createElement('section');
    sectionEl.id='imp-value-story';sectionEl.className='imp-value-story';
    sectionEl.setAttribute('aria-label','Problem, outcome and investment');
    sectionEl.innerHTML='<div class="imp-value-wrap"><p class="imp-value-kicker"></p>'+
      '<h2 class="imp-value-headline"></h2><p class="imp-value-intro"></p>'+
      '<div class="imp-value-steps"><article><h3></h3><p></p></article><article><h3></h3><p></p></article></div>'+
      '<div class="imp-value-offer"><div><h3></h3><p></p></div><a class="imp-value-cta"></a></div></div>';
    anchor.insertAdjacentElement('afterend',sectionEl);
    function renderValue(){
      var l=['cs','en','ru','uk'].includes(document.documentElement.lang)?document.documentElement.lang:'cs';
      var d=stories[l][section],h=headings[l],box=sectionEl;
      box.querySelector('.imp-value-kicker').textContent=h[0];
      box.querySelector('.imp-value-headline').textContent=d[0];
      box.querySelector('.imp-value-intro').textContent=d[1];
      var cards=box.querySelectorAll('.imp-value-steps article');
      cards[0].querySelector('h3').textContent=h[1];cards[0].querySelector('p').textContent=d[2];
      cards[1].querySelector('h3').textContent=h[2];cards[1].querySelector('p').textContent=d[3];
      box.querySelector('.imp-value-offer h3').textContent=h[3];
      box.querySelector('.imp-value-offer p').textContent=d[4];
      var cta=box.querySelector('.imp-value-cta'),link=new URL(d[6],root);
      link.searchParams.set('lang',l);
      if(section==='corporate')link.searchParams.set('src','video_value_first');
      cta.textContent=d[5];cta.href=link.href;
    }
    new MutationObserver(renderValue).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    renderValue();
  })();

  // Existing form, language, event and payment scripts remain authoritative.
})();