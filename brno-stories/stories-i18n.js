/* The editorial homepage keeps one shared header and all four language variants. */
(function(){
'use strict';
var text={
cs:{
 main:'Hlavní web',kicker:'BRNO · SKUTEČNÉ PŘÍBĚHY · REAL STORIES',
 title1:'Brno má víc příběhů, ',title2:'než si myslíš.',
 lead:'Jsem Alex. S kamerou objevuji nečekaná místa, lidi, akce a dobrodružství v Brně. Žádné vymyšlené zážitky — skutečné reportáže z vlastních výprav.',
 weeklyKicker:'NOVINKA · ANGLICKÉ VYDÁNÍ · PILOT',
 weeklyTitle:'Brno Weekly: co se hodí vědět o životě v Brně',
 weeklyBody:'Anglický přehled užitečných zdrojů, místních akcí a původních reportáží z Brna. Pro firmy připravujeme transparentní, jasně označená reklamní partnerství. Žádný garantovaný dosah zatím neslibujeme.',
 weeklyCta:'Prohlédnout Brno Weekly →',episode:'DÍL 01 · 17. 10. 2026 · BRNO-KOHOUTOVICE',firstTitle:'Tohle není film. Tohle se stalo v Brně.',
 firstBody:'Kohoutovice se na jeden den proměnily ve fantasy bojiště. Krátký reportážní sestřih z LARP bitvy <em>Tanec draků 2026</em>, kterou pořádali Marek Navrátil a jeho tým. Družina Moravy se zúčastnila jako hráči, nikoli organizátoři.',
 play:'Přehrát reportáž (26 s)',next:'Další témata: městská dobrodružství, výlety, kulturní akce, lidé z Brna a zážitky, které by ti jinak unikly.',
 footer1:'Osobní autorský projekt Aliakseie Chareshneua.',footer2:'Družina Moravy z. s. je samostatný spolek.'
},
en:{
 main:'Main website',kicker:'BRNO · REAL PEOPLE · REAL STORIES',
 title1:'Brno has more stories ',title2:'than you might think.',
 lead:"I'm Alex. I explore unexpected places, people, events and adventures around Brno with my camera. No invented experiences — original reporting from actual outings.",
 weeklyKicker:'NEW · ENGLISH EDITION · PILOT',
 weeklyTitle:'Brno Weekly: useful things to know about life in Brno',
 weeklyBody:'An English-language roundup of useful resources, local events and original reporting from Brno. We are exploring clearly labeled, transparent advertising partnerships with companies. Reach is not guaranteed.',
 weeklyCta:'Explore Brno Weekly →',episode:'EPISODE 01 · 17 OCT 2026 · BRNO-KOHOUTOVICE',firstTitle:'This is not a movie. It happened in Brno.',
 firstBody:'Kohoutovice became a fantasy battlefield for a day. A short original report from the <em>Tanec draků 2026</em> LARP battle, organised by Marek Navrátil and his team. Družina Moravy took part as players, not organisers.',
 play:'Watch the report (26 s)',next:'More stories: urban adventures, hikes, cultural events, Brno residents and experiences you might otherwise miss.',
 footer1:'An independent author project by Aliaksei Chareshneu.',footer2:'Družina Moravy z. s. is a separate nonprofit association.'
},
ru:{
 main:'Главный сайт',kicker:'БРНО · НАСТОЯЩИЕ ЛЮДИ · ИСТОРИИ',
 title1:'В Брно больше историй, ',title2:'чем кажется.',
 lead:'Я Алекс. С камерой открываю неожиданные места, людей, события и приключения в Брно. Никаких вымышленных историй — авторские репортажи из настоящих поездок.',
 weeklyKicker:'НОВИНКА · АНГЛОЯЗЫЧНЫЙ ВЫПУСК · ПИЛОТ',
 weeklyTitle:'Brno Weekly: что полезно знать о жизни в Брно',
 weeklyBody:'Англоязычная подборка полезных ресурсов, местных событий и собственных репортажей. Для компаний рассматриваем прозрачные рекламные партнёрства с маркировкой. Гарантированного охвата не обещаем.',
 weeklyCta:'Открыть Brno Weekly →',episode:'ВЫПУСК 01 · 17.10.2026 · БРНО-КОГОУТОВИЦЕ',firstTitle:'Это не кино. Это случилось в Брно.',
 firstBody:'На один день Когоутовице превратились в фэнтезийное поле битвы. Короткий репортаж с LARP-сражения <em>Tanec draků 2026</em>, организованного Мареком Навратилом и его командой. Družina Moravy участвовала как игроки, а не организаторы.',
 play:'Смотреть репортаж (26 с)',next:'Другие темы: городские приключения, походы, культура, жители Брно и впечатления, которые иначе можно пропустить.',
 footer1:'Личный авторский проект Aliaksei Chareshneu.',footer2:'Družina Moravy z. s. — отдельная некоммерческая организация.'
},
uk:{
 main:'Головний сайт',kicker:'БРНО · СПРАВЖНІ ЛЮДИ · ІСТОРІЇ',
 title1:'У Брно більше історій, ',title2:'ніж здається.',
 lead:'Я Алекс. Із камерою відкриваю несподівані місця, людей, події та пригоди у Брно. Жодних вигаданих вражень — авторські репортажі зі справжніх мандрівок.',
 weeklyKicker:'НОВИНКА · АНГЛОМОВНИЙ ВИПУСК · ПІЛОТ',
 weeklyTitle:'Brno Weekly: що корисно знати про життя у Брно',
 weeklyBody:'Англомовна добірка корисних ресурсів, місцевих подій і власних репортажів. Для компаній розглядаємо прозорі рекламні партнерства з чітким маркуванням. Гарантованого охоплення не обіцяємо.',
 weeklyCta:'Переглянути Brno Weekly →',episode:'ВИПУСК 01 · 17.10.2026 · БРНО-КОГОУТОВИЦЕ',firstTitle:'Це не кіно. Це сталося у Брно.',
 firstBody:'На один день Когоутовице перетворилися на фентезійне поле битви. Короткий репортаж із LARP-битви <em>Tanec draků 2026</em>, яку організували Марек Навратіл та його команда. Družina Moravy брала участь як гравці, а не організатори.',
 play:'Дивитися репортаж (26 с)',next:'Інші теми: міські пригоди, походи, культура, мешканці Брно та враження, які інакше можна пропустити.',
 footer1:'Особистий авторський проєкт Aliaksei Chareshneu.',footer2:'Družina Moravy z. s. — окрема неприбуткова організація.'
}};
var q=new URLSearchParams(location.search),code=q.get('lang'),lang=text[code]?code:'cs',d=text[lang];
document.documentElement.lang=lang;
document.querySelectorAll('[data-story]').forEach(function(el){var key=el.dataset.story;if(!Object.prototype.hasOwnProperty.call(d,key))return;if(key==='firstBody')el.innerHTML=d[key];else el.textContent=d[key];});
})();