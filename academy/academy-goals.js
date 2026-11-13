/* Outcome-first Academy. Existing tariffs and intake services stay authoritative. */
(function(){
'use strict';
var hero=document.querySelector('main .hero#academy');
if(!hero||document.getElementById('academy-choose'))return;
var root=document.createElement('section');root.id='academy-choose';root.setAttribute('aria-label','Academy — choose a goal');
hero.insertAdjacentElement('afterend',root);
var keys=['languages','movement','subjects','czech-life'],icons=['🗣','💪','🔬','🧭'];
var all={
cs:{
 kicker:'ETERNAL LEARNING ACADEMY',question:'S čím vám můžeme pomoci?',intro:'Nejdřív vyberte svůj problém a požadovaný výsledek. Pak si prohlédněte tři konkrétní možnosti; rozsah, termín a cenu potvrdíme písemně před objednávkou.',
 jump:'Vybrat řešení ↓',ask:'Popsat svůj cíl →',more:'Podrobnosti a ceny →',hero:'Vybrat svůj cíl →',note:'Osobní placené služby poskytuje OSVČ Aliaksei Chareshneu. Úvodní komunikace probíhá písemně; odeslání zprávy není rezervace ani platba. Lékařskou diagnózu, léčbu či právní poradenství neposkytujeme. Tréninky Družina Moravy z. s. jsou oddělené.',
 cats:[
 {title:'Jazyky pro život, školu a práci',sub:'Čeština nebo angličtina. Zvládněte situaci, která je pro vás důležitá.',desc:'Vyberte konkrétní jazykový výsledek — ne anonymní kurz.',
 opts:[['Čeština pro práci a každodenní život','Komunikace v zaměstnání, s úřady i v běžných situacích.'],['Čeština ke zkoušce nebo studiu','A2 k pobytu, CERMAT, maturita, přijímací řízení a vysokoškolská čeština.'],['Angličtina pro práci a studium','Mluvení, odborná komunikace, prezentace a cílená příprava.']]},
 {title:'Pohyb, kondice a koordinace',sub:'Získejte jistotu v pohybu — individuálně a bezpečně.',desc:'Zátěž a přístup přizpůsobujeme možnostem; léčba ani zdravotní rehabilitace nejsou součástí služby.',
 opts:[['Osobní fitness a kalistenika','Síla, mobilita a technika podle vaší úrovně.'],['Koordinace a zdravé pohybové návyky','Stabilita, držení těla a postupný návrat k bezpečné aktivitě dle doporučení lékaře, pokud je potřeba.'],['Individuální šerm a lukostřelba','Osobní lekce OSVČ pouze po ověření místa, vybavení, věku, bezpečnostních a právních podmínek.']]},
 {title:'Škola, univerzita a IT',sub:'Zlepšete výsledky nebo zvládněte náročný předmět.',desc:'Zaměření na váš aktuální problém a konkrétní cíl včetně zkoušek.',
 opts:[['Matematika a fyzika','Pochopení látky, příprava na písemky, maturitu a přijímačky.'],['Chemie, biologie a přírodní vědy','Školní, přijímací i univerzitní učivo; cílená odborná pomoc.'],['Programování, data a IT','Python, databáze, výzkumná data a praktické digitální dovednosti.']]},
 {title:'Orientace a podpora v Česku',sub:'Porozumějte systému, dokumentům a jednáním.',desc:'Praktická jazyková a organizační asistence, nikoliv regulované odborné rady.',
 opts:[['U lékaře nebo v nemocnici','Tlumočení a příprava otázek či uspořádání dokumentů; bez diagnózy a léčebných doporučení.'],['Úřady, studium a dokumenty','Vysvětlení procesu, překlad komunikace, doprovod a organizace termínů.'],['Právní otázky a vyhledání specialisty','Pomoc s jazykem a nalezením kvalifikovaného odborníka; ne právní zastoupení ani právní rady.']]}
 ]},
en:{
 kicker:'ETERNAL LEARNING ACADEMY',question:'What problem can we help you solve?',intro:'Start with the outcome you need, not a huge course list. Pick a direction, explore three practical options and agree on scope, time and price in writing before booking.',
 jump:'Explore solutions ↓',ask:'Describe your goal →',more:'Details and prices →',hero:'Choose your goal →',note:'Paid personal services are provided by Aliaksei Chareshneu as self-employed OSVČ. Enquiries start in writing and do not confirm a booking or payment. We do not provide medical diagnosis, treatment or legal advice. Družina Moravy z. s. club activities are separate.',
 cats:[
 {title:'Languages for life, work and study',sub:'Czech or English, for a result that matters to you.',desc:'Tell us what you need to be able to do, rather than selecting a generic course.',
 opts:[['Czech for work and daily life','Speak with employers, public offices and people around you.'],['Czech for exams or education','A2 residence exam, CERMAT, graduation, admissions and university.'],['English for work and learning','Conversation, specialist communication, presentations and tailored preparation.']]},
 {title:'Movement, fitness and coordination',sub:'Build strength and move with more confidence.',desc:'Activity adapted to your abilities; this is not medical treatment or clinical rehabilitation.',
 opts:[['Personal fitness and calisthenics','Strength, mobility and technique at your level.'],['Coordination and healthy movement','Balance, posture and gradual return to appropriate activity with medical guidance where needed.'],['Individual fencing and archery','Separate OSVČ sessions only after venue, equipment, age, safety and legal conditions are checked.']]},
 {title:'School, university and IT',sub:'Understand a subject or prepare for a key exam.',desc:'Target the exact topic and outcome that is blocking your progress.',
 opts:[['Mathematics and physics','School support, tests, graduation exams and admissions.'],['Chemistry, biology and sciences','School, entrance and university topics with relevant scientific expertise.'],['Programming, data and IT','Python, SQL, research data and practical digital skills.']]},
 {title:'Adapting to life in Czechia',sub:'Navigate appointments, paperwork and institutions.',desc:'Practical language and administrative help, not regulated professional advice.',
 opts:[['Doctor and hospital visits','Interpreting, preparing questions and organising records; no diagnosis or treatment recommendations.'],['Public offices, education and paperwork','Understand the process, translate communications and arrange accompaniment.'],['Legal issues and specialist search','Language support and finding an appropriately qualified professional; no legal representation or advice.']]}
 ]},
ru:{
 kicker:'ETERNAL LEARNING ACADEMY',question:'Какую проблему мы можем помочь вам решить?',intro:'Не нужно выбирать из десятков курсов. Укажите цель, откройте одно из четырёх направлений и выберите один из трёх понятных вариантов. Объём, срок и цену согласуем письменно до заказа.',
 jump:'Выбрать решение ↓',ask:'Описать свою задачу →',more:'Подробности и цены →',hero:'Выбрать свою цель →',note:'Платные индивидуальные услуги предоставляет OSVČ Aliaksei Chareshneu. Сначала письменное обращение; сообщение не означает бронирование или оплату. Мы не ставим диагнозы, не назначаем лечение и не даём юридические консультации. Клуб Družina Moravy z. s. — отдельная организация.',
 cats:[
 {title:'Языки для жизни, работы и учёбы',sub:'Чешский или английский — под вашу реальную задачу.',desc:'Освоить язык для конкретной ситуации, а не пройти абстрактный курс.',
 opts:[['Чешский для работы и повседневной жизни','Общение на работе, в учреждениях и в обычных ситуациях.'],['Чешский для экзамена или учёбы','A2 для ПМЖ, CERMAT, выпускные, вступительные и университет.'],['Английский для работы и образования','Разговорная практика, профессиональное общение и презентации.']]},
 {title:'Физические навыки и здоровье',sub:'Сила, координация и уверенное движение.',desc:'Нагрузки подбираются с учётом возможностей; медицинское лечение и реабилитацию мы не проводим.',
 opts:[['Фитнес и калистеника','Индивидуальная работа над силой, подвижностью и техникой.'],['Координация и двигательные привычки','Баланс, осанка и постепенное возвращение к посильной активности с рекомендацией врача при необходимости.'],['Индивидуальное фехтование и стрельба из лука','Отдельные занятия OSVČ только после проверки места, снаряжения, возраста и требований безопасности.']]},
 {title:'Школа, университет и IT',sub:'Подтянуть знания, поступить или сдать экзамен.',desc:'Помощь с конкретной темой и подготовкой к проверке знаний.',
 opts:[['Математика и физика','Разбор сложных тем, контрольные, выпускные и вступительные экзамены.'],['Химия, биология и естественные науки','Школьная, вступительная и университетская подготовка.'],['Программирование, данные и IT','Python, SQL, исследовательские данные и прикладные цифровые навыки.']]},
 {title:'Адаптация и сопровождение в Чехии',sub:'Разобраться с больницами, учреждениями и документами.',desc:'Помощь с языком и организацией; медицинские и юридические решения принимают профильные специалисты.',
 opts:[['Сопровождение к врачу или в больницу','Перевод, подготовка вопросов и организация документов — не диагноз и не лечение.'],['Учреждения, учёба и документы','Перевод переписки, понимание процедур и сопровождение на встречи.'],['Юридическая проблема и поиск специалиста','Языковая поддержка и помощь в поиске юриста; без юридического представительства и консультации.']]}
 ]},
uk:{
 kicker:'ETERNAL LEARNING ACADEMY',question:'Яку проблему ми можемо допомогти вам вирішити?',intro:'Не потрібно обирати з десятків курсів. Вкажіть мету, відкрийте один із чотирьох напрямів і оберіть один із трьох зрозумілих варіантів. Обсяг, строки та ціну узгодимо письмово до замовлення.',
 jump:'Обрати рішення ↓',ask:'Описати свою мету →',more:'Подробиці та ціни →',hero:'Обрати свою мету →',note:'Платні індивідуальні послуги надає OSVČ Aliaksei Chareshneu. Спочатку письмове звернення; повідомлення не є бронюванням чи оплатою. Ми не встановлюємо діагнозів, не призначаємо лікування та не надаємо юридичних консультацій. Клуб Družina Moravy z. s. — окрема організація.',
 cats:[
 {title:'Мови для життя, роботи й навчання',sub:'Чеська або англійська — для вашої конкретної мети.',desc:'Опанувати мову для реальної ситуації, а не пройти абстрактний курс.',
 opts:[['Чеська для роботи й повсякденного життя','Спілкування на роботі, в установах та у звичайних ситуаціях.'],['Чеська для іспиту або навчання','A2 для ПМП, CERMAT, випускні, вступні іспити та університет.'],['Англійська для роботи й освіти','Розмовна практика, професійне спілкування та презентації.']]},
 {title:'Фізичні навички та здоровий рух',sub:'Сила, координація й упевнені рухи.',desc:'Навантаження враховують ваші можливості; медичного лікування чи реабілітації не проводимо.',
 opts:[['Фітнес і калістеніка','Індивідуальна робота над силою, рухливістю та технікою.'],['Координація й рухові звички','Рівновага, постава та поступове повернення до посильної активності з порадою лікаря за потреби.'],['Індивідуальне фехтування та стрільба з лука','Окремі заняття OSVČ лише після перевірки місця, спорядження, віку й вимог безпеки.']]},
 {title:'Школа, університет та IT',sub:'Поліпшити знання, вступити або скласти іспит.',desc:'Допомога з конкретною темою та підготовкою до перевірки знань.',
 opts:[['Математика та фізика','Складні теми, контрольні, випускні та вступні іспити.'],['Хімія, біологія та природничі науки','Підготовка для школи, вступу та університету.'],['Програмування, дані та IT','Python, SQL, дослідницькі дані й практичні цифрові навички.']]},
 {title:'Адаптація та супровід у Чехії',sub:'Розібратися з лікарнями, установами та документами.',desc:'Мовна й організаційна підтримка; медичні та юридичні рішення ухвалюють відповідні фахівці.',
 opts:[['Супровід до лікаря або лікарні','Усний переклад, підготовка запитань та впорядкування документів — без діагнозів і лікування.'],['Установи, навчання та документи','Переклад листування, розуміння процедур і супровід на зустрічах.'],['Юридичне питання та пошук фахівця','Мовна допомога та пошук юриста; без юридичного представництва й консультацій.']]}
 ]}
};
var priceLinks=['#price-edu','#price-fit','courses/?lang=LANG#catalog','#price-supp'];
function escapeText(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function current(){var lang=document.documentElement.lang;return all[lang]?lang:'cs';}
function enquiry(lang,topic){
 var t={cs:'Dobrý den, prosím o nabídku služby Academy: ',en:'Hello, I would like to enquire about an Academy service: ',ru:'Здравствуйте! Хочу обсудить услугу Академии: ',uk:'Вітаю! Хочу обговорити послугу Академії: '}[lang];
 var end={cs:'. Můj cíl, úroveň, termín a případné podklady: ',en:'. My goal, current level, timing and relevant materials: ',ru:'. Моя цель, уровень, сроки и материалы: ',uk:'. Моя мета, рівень, строки та матеріали: '}[lang];
 return 'https://wa.me/420702914842?text='+encodeURIComponent(t+topic+end);
}
function render(){
 var lang=current(),t=all[lang];
 var markup='<div class="goal-kicker">'+escapeText(t.kicker)+'</div><h2>'+escapeText(t.question)+'</h2><p class="goal-intro">'+escapeText(t.intro)+'</p>';
 markup+='<nav class="goal-choices" aria-label="'+escapeText(t.question)+'">';
 t.cats.forEach(function(cat,i){markup+='<a class="goal-jump" href="#goal-'+keys[i]+'"><span class="goal-icon" aria-hidden="true">'+icons[i]+'</span><strong>'+escapeText(cat.title)+'</strong><small>'+escapeText(cat.sub)+'</small><span class="goal-jump-action">'+escapeText(t.jump)+'</span></a>';});
 markup+='</nav>';
 t.cats.forEach(function(cat,i){
  markup+='<section class="goal-detail" id="goal-'+keys[i]+'"><div class="goal-detail-head"><div><h3>'+escapeText(cat.title)+'</h3><p class="goal-detail-desc">'+escapeText(cat.desc)+'</p></div></div><div class="goal-options">';
  cat.opts.forEach(function(opt){markup+='<article class="goal-option"><h4>'+escapeText(opt[0])+'</h4><p>'+escapeText(opt[1])+'</p><a rel="noopener noreferrer" target="_blank" href="'+enquiry(lang,opt[0])+'">'+escapeText(t.ask)+'</a></article>';});
  var more=priceLinks[i].replace('LANG',lang);
  markup+='</div><a class="goal-more" href="'+more+'">'+escapeText(t.more)+'</a></section>';
 });
 markup+='<p class="goal-note">'+escapeText(t.note)+'</p>';
 root.innerHTML=markup;root.setAttribute('lang',lang);
 document.querySelectorAll('#navBookBtn, #mobileCta .mobile-cta-btn, .hero-ctas a[data-i18n="academy.ctaRegister"]').forEach(function(a){a.href='#academy-choose';a.textContent=t.hero;a.removeAttribute('target');a.removeAttribute('rel');});
 var secondary=document.querySelector('.hero .hero-ctas a[data-i18n="academy.ctaContact"]');
 if(secondary)secondary.href='#academy-pricing';
}
document.addEventListener('site:language',render);
render();
})();