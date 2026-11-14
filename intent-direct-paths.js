/* IMPERION direct-intent routes · 14 Nov 2026.
   Progressive enhancement of the existing conversion homepage. No customer
   data collection, new CRM, payment processor, or booking side effects. */
(function () {
  'use strict';
  var root = document.getElementById('imperion-frontdoor');
  if (!root || document.getElementById('fd-goal-paths')) return;

  var COPY = {
    cs: {
      heading: 'Co potřebujete vyřešit?',
      intro: 'Vyberte konkrétní výsledek a přejděte rovnou k odpovídající přihlášce nebo zadání. Cenu a podmínky zjistíte před závazkem.',
      shortcutProblem: 'Ztrácí vaše firma čas opakující se prací?',
      shortcutAction: 'Poslat stručné zadání AI/data →',
      note: 'Odeslání dotazu neznamená rezervaci, přijetí zakázky ani platbu. Pořadatel, cena a podmínky se potvrzují pro konkrétní službu.',
      cards: [
        ['Pro firmy · OSVČ','Zdržují vás opakující se procesy?','Popište jeden konkrétní proces a požadovaný výsledek. Dostanete návrh rozsahu a termínu podle zadání.','AI/data pilot od 14 900 Kč; konečná cena písemně.','Popsat firemní problém'],
        ['Výuka · OSVČ','Potřebujete zvládnout češtinu nebo zkoušku?','Napište předmět, cíl a preferovaný termín. Vybereme relevantní formát místo obecné úvodní schůzky.','Nové individuální online lekce: 690 Kč / 60 min.','Požádat o lekci'],
        ['BrnoWalkers','Chcete se vydat ven a poznat další lidi?','Vyberte reálně zveřejněný termín výletu či hry a před přihláškou ověřte trasu, cenu a podmínky.','Jen zveřejněné termíny; účast až po potvrzení.','Vybrat výlet nebo hru'],
        ['Družina Moravy z. s.','Chcete zkusit historický šerm?','Požádejte o první návštěvu. Termín, bezpečné místo, vybavení a případnou cenu potvrdí pořadatel.','Dotaz není rezervace ani členství ve spolku.','Zeptat se na první trénink']
      ]
    },
    en: {
      heading: 'What would you like to solve?',
      intro: 'Choose one outcome and go straight to the right enquiry or event. See the real price and terms before committing.',
      shortcutProblem: 'Repetitive work costing your company time?',
      shortcutAction: 'Send a short AI/data brief →',
      note: 'An enquiry is not a booking, an accepted contract or a payment. The responsible organiser, price and terms are confirmed per service.',
      cards: [
        ['For companies · OSVČ','Are repetitive processes wasting your time?','Describe one workflow and the result you need. Receive a scope and timeline proposal tailored to your brief.','AI/data pilot from 14,900 Kč; final quote in writing.','Describe a business problem'],
        ['Lessons · OSVČ','Need to improve Czech or pass an exam?','State the subject, goal and preferred times. Start with a relevant lesson rather than a vague discovery call.','New individual online lessons: 690 Kč / 60 min.','Enquire about a lesson'],
        ['BrnoWalkers','Want to explore and meet people?','Choose a genuinely published hike or games date. Check route, price and conditions before requesting a place.','Only published dates; attendance needs confirmation.','Choose a hike or game'],
        ['Družina Moravy z. s.','Want to try historical fencing?','Ask about your first visit. The organiser confirms the session, safe location, equipment and any fee.','An enquiry is neither a booking nor club membership.','Ask about a first training']
      ]
    },
    ru: {
      heading: 'Какую задачу хотите решить?',
      intro: 'Выберите нужный результат и сразу перейдите к подходящей заявке или событию. Стоимость и условия — до обязательств.',
      shortcutProblem: 'Рутинные процессы отнимают время компании?',
      shortcutAction: 'Отправить задачу по AI/data →',
      note: 'Заявка — не бронь, не принятый заказ и не платёж. Организатор, цена и условия подтверждаются отдельно для каждой услуги.',
      cards: [
        ['Для компаний · OSVČ','Слишком много времени уходит на рутину?','Опишите один процесс и нужный результат. Получите предметное предложение по объёму и срокам после оценки задачи.','AI/data-пилот от 14 900 Kč; окончательная цена письменно.','Описать бизнес-задачу'],
        ['Обучение · OSVČ','Нужно сдать экзамен или освоить чешский?','Укажите предмет, цель и удобное время. Сразу обсуждаем подходящий урок, а не бесцельный созвон.','Новый индивидуальный онлайн-урок: 690 Kč / 60 мин.','Запросить урок'],
        ['BrnoWalkers','Хочется походов, игр и новых встреч?','Выберите опубликованную дату. Маршрут, цену и условия можно уточнить до запроса места.','Только опубликованные даты; участие после подтверждения.','Выбрать поход или игру'],
        ['Družina Moravy z. s.','Хотите попробовать историческое фехтование?','Запросите первый визит. Дату, безопасную площадку, снаряжение и стоимость подтвердит организатор.','Запрос не является бронью или членством в НКО.','Запросить первую тренировку']
      ]
    },
    uk: {
      heading: 'Яке завдання хочете вирішити?',
      intro: 'Оберіть потрібний результат і одразу перейдіть до відповідної заявки чи події. Ціна й умови — до зобов’язань.',
      shortcutProblem: 'Рутинні процеси забирають час компанії?',
      shortcutAction: 'Надіслати завдання щодо AI/data →',
      note: 'Запит — не бронювання, не прийняте замовлення і не платіж. Організатора, ціну й умови підтверджують для кожної послуги.',
      cards: [
        ['Для компаній · OSVČ','Забагато часу витрачається на рутину?','Опишіть один процес і бажаний результат. Отримайте предметну пропозицію щодо обсягу та строків після оцінки.','AI/data-пілот від 14 900 Kč; остаточна ціна письмово.','Описати бізнес-завдання'],
        ['Навчання · OSVČ','Потрібно скласти іспит або опанувати чеську?','Вкажіть предмет, мету й зручний час. Почнімо з відповідного уроку замість невизначеного дзвінка.','Новий індивідуальний онлайн-урок: 690 Kč / 60 хв.','Запитати про урок'],
        ['BrnoWalkers','Хочете походів, ігор і нових знайомств?','Оберіть опубліковану дату. Маршрут, ціну й умови можна з’ясувати до запиту місця.','Лише опубліковані дати; участь після підтвердження.','Обрати похід чи гру'],
        ['Družina Moravy z. s.','Хочете спробувати історичне фехтування?','Запитайте про перший візит. Дату, безпечне місце, спорядження й ціну підтвердить організатор.','Запит не означає бронювання чи членства в об’єднанні.','Запитати про перше тренування']
      ]
    }
  };
  var KEYS = ['business','lesson','walkers','club'];
  var ROUTES = {
    business: 'corporate/request/',
    lesson: 'academy/programmes/',
    walkers: './',
    club: 'register/'
  };
  function language() {
    var current = document.documentElement.lang;
    return Object.prototype.hasOwnProperty.call(COPY, current) ? current : 'cs';
  }
  function destination(kind, lang) {
    var url = new URL(ROUTES[kind], window.location.href);
    url.searchParams.set('lang', lang);
    if (kind === 'business') {
      url.searchParams.set('service', 'DATA_PILOT');
      url.searchParams.set('src', 'frontdoor_fast_business');
    } else if (kind === 'lesson') {
      url.searchParams.set('programme', 'LESSON');
      url.searchParams.set('src', 'frontdoor_fast_lesson');
      url.hash = '#enquire';
    } else if (kind === 'walkers') {
      url.searchParams.set('category', 'walkers');
      url.searchParams.set('src', 'frontdoor_fast_walkers');
      url.hash = '#impr-calendar';
    } else {
      url.searchParams.set('src', 'frontdoor_fast_club');
    }
    ['utm_source','utm_medium','utm_campaign'].forEach(function (key) {
      var value = new URLSearchParams(window.location.search).get(key);
      if (value && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) url.searchParams.set(key, value);
    });
    return url.pathname + url.search + url.hash;
  }
  function node(tag, className) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  }
  var calendar = document.getElementById('impr-calendar');
  var heroActions = root.querySelector('.fd-hero-actions');
  if (!calendar || !heroActions) return;

  var shortcut = node('p','fd-business-shortcut');
  var shortcutLead = node('span');
  var shortcutLink = node('a');
  shortcut.appendChild(shortcutLead);
  shortcut.appendChild(shortcutLink);
  heroActions.insertAdjacentElement('afterend', shortcut);

  var section = node('section','fd-goal-paths');
  section.id = 'fd-goal-paths';
  section.setAttribute('aria-labelledby','fdGoalHeading');
  var shell = node('div','fd-shell');
  var heading = node('h2');
  heading.id = 'fdGoalHeading';
  var intro = node('p','fd-goal-intro');
  var grid = node('div','fd-goal-grid');
  var cards = [];
  KEYS.forEach(function(kind) {
    var card = node('article','fd-goal-card fd-goal-' + kind);
    var tag = node('p','fd-goal-tag');
    var title = node('h3');
    var result = node('p','fd-goal-result');
    var terms = node('p','fd-goal-terms');
    var link = node('a','fd-goal-action');
    link.dataset.intent = kind;
    card.appendChild(tag); card.appendChild(title); card.appendChild(result);
    card.appendChild(terms); card.appendChild(link);
    grid.appendChild(card);
    cards.push({tag:tag,title:title,result:result,terms:terms,link:link});
  });
  var note = node('p','fd-goal-note');
  shell.appendChild(heading); shell.appendChild(intro); shell.appendChild(grid); shell.appendChild(note);
  section.appendChild(shell);
  calendar.parentNode.insertBefore(section, calendar);

  var nav = document.getElementById('fdNav');
  var navLink = node('a','fd-nav-business');
  if (nav) nav.insertBefore(navLink, document.getElementById('fdNavAbout'));
  function render() {
    var lang = language(), text = COPY[lang];
    heading.textContent = text.heading;
    intro.textContent = text.intro;
    shortcutLead.textContent = text.shortcutProblem + ' ';
    shortcutLink.textContent = text.shortcutAction;
    shortcutLink.href = destination('business', lang);
    note.textContent = text.note;
    if (nav) {
      navLink.textContent = text.cards[0][0];
      navLink.href = destination('business', lang);
    }
    cards.forEach(function(card,i){
      var c = text.cards[i];
      card.tag.textContent = c[0];
      card.title.textContent = c[1];
      card.result.textContent = c[2];
      card.terms.textContent = c[3];
      card.link.textContent = c[4] + ' →';
      card.link.href = destination(KEYS[i], lang);
    });
  }
  document.documentElement.addEventListener('click', function(event){
    var anchor = event.target.closest && event.target.closest('#fd-goal-paths a[data-intent],.fd-business-shortcut a,.fd-nav-business');
    if (!anchor) return;
    var kind = anchor.dataset.intent || 'business';
    document.dispatchEvent(new CustomEvent('ecosystem:conversion',{
      detail:{name:'goal_selected_' + kind,page:'home',language:language(),placement:'direct_path'}
    }));
  });
  render();
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();