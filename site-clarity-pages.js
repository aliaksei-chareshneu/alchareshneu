/* Editorial consolidation for Družina & BrnoWalkers. The live public event
   catalogue remains the only source for real bookable events. No new CRM. */
(function(){
'use strict';
const club=location.pathname.includes('/druzina/'),walkers=location.pathname.includes('/walkers/');
if(!club&&!walkers)return;
const main=document.querySelector('main#page-content');
const hero=document.querySelector(club?'#druzina.hero':'#walkers.hero');
if(!main||!hero)return;
const root='../',api='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-register';
const C={
cs:{next:'NEJBLIŽŠÍ AKTIVITA',clubTitle:'Vaše cesta do Družiny začíná tady',walkTitle:'Příští společná výprava',calendar:'Všechny akce v kalendáři',register:'Poslat přihlášku',first:'První návštěva',schedule:'Pondělní tréninky',safety:'Bezpečnost',clubAbout:'Co vás čeká a jak přijít',walkAbout:'Co plánujeme a jak se přidat',archive:'Další informace, pravidla a archiv',confirm:'Účast je platná až po osobním potvrzení. Termíny a poplatky ověřte před cestou.',ongoing:'Pravidelný čas · zatím bez potvrzeného místa',free:'Vstup zdarma · 14. listopadu 2026',check:'Ověřit účast',walkNote:'Výlet se koná pouze po potvrzení konkrétního termínu, trasy a podmínek.',visiting:'První návštěva',when:'Kdy',where:'Kde',bring:'Co s sebou',visitBody:'Nejdřív vyberte aktuální akci a pošlete nezávaznou přihlášku. Počkejte na osobní potvrzení.',whenBody:'Pondělí 18:00–19:30 je pravidelně plánovaný slot. Soboty jsou do odvolání pozastaveny; čtvrtky zrušeny.',whereBody:'Přesné místo, výstroj, věk a bezpečnostní podmínky se potvrzují pro konkrétní trénink.'},
en:{next:'NEXT ACTIVITY',clubTitle:'Your way into the Družina',walkTitle:'Our next shared adventure',calendar:'All dates in one calendar',register:'Send an enquiry',first:'First visit',schedule:'Monday training',safety:'Safety',clubAbout:'What to expect and how to come',walkAbout:'What comes next and how to join',archive:'Extra details, rules and archive',confirm:'Attendance requires direct organiser confirmation. Check time, venue and fees before travelling.',ongoing:'Recurring slot · no confirmed place',free:'Free admission · 14 November 2026',check:'Ask for confirmation',walkNote:'Each walk needs a confirmed date, route and conditions.',visiting:'First visit',when:'When',where:'Where',bring:'What to bring',visitBody:'Choose a real event and send a non-binding request. Wait for the organiser to confirm it.',whenBody:'Monday 18:00–19:30 is the recurring planned slot. Saturdays are suspended; Thursdays discontinued.',whereBody:'Exact venue, equipment, age and safety conditions are checked per session.'},
ru:{next:'БЛИЖАЙШЕЕ СОБЫТИЕ',clubTitle:'Твой путь в Дружину начинается здесь',walkTitle:'Ближайшее приключение',calendar:'Все мероприятия в одном календаре',register:'Отправить заявку',first:'Первый визит',schedule:'Тренировки по понедельникам',safety:'Безопасность',clubAbout:'Что будет и как присоединиться',walkAbout:'Что дальше и как записаться',archive:'Дополнительно: правила, история и архив',confirm:'Участие только после личного подтверждения организатора. Место, цену и условия уточняйте до поездки.',ongoing:'Регулярный плановый слот · место не подтверждено',free:'Бесплатно · 14 ноября 2026',check:'Уточнить участие',walkNote:'Каждая прогулка требует подтверждения даты, маршрута и условий.',visiting:'Первый визит',when:'Когда',where:'Где',bring:'Что взять',visitBody:'Выберите реальное событие и отправьте заявку без обязательств. Дождитесь личного подтверждения.',whenBody:'Понедельник 18:00–19:30 — регулярный плановый слот. Субботние тренировки приостановлены, четверги отменены.',whereBody:'Точное место, снаряжение, возраст и условия безопасности уточняются для каждого занятия.'},
uk:{next:'НАЙБЛИЖЧА ПОДІЯ',clubTitle:'Твій шлях до Дружини',walkTitle:'Наступна спільна пригода',calendar:'Усі події в одному календарі',register:'Надіслати заявку',first:'Перший візит',schedule:'Тренування щопонеділка',safety:'Безпека',clubAbout:'Що очікувати і як долучитися',walkAbout:'Що далі і як записатися',archive:'Додатково: правила, історія й архів',confirm:'Участь потребує особистого підтвердження організатора. Уточніть місце, ціну та умови до поїздки.',ongoing:'Регулярний запланований час · місце не підтверджено',free:'Безкоштовно · 14 листопада 2026',check:'Уточнити участь',walkNote:'Кожна прогулянка потребує підтвердження дати, маршруту й умов.',visiting:'Перший візит',when:'Коли',where:'Де',bring:'Що взяти',visitBody:'Оберіть справжню подію та надішліть заявку без зобов’язань. Дочекайтеся особистого підтвердження.',whenBody:'Понеділок 18:00–19:30 — регулярний запланований час. Суботи призупинені, четверги скасовані.',whereBody:'Точне місце, спорядження, вік і безпекові умови уточнюються для кожного заняття.'}
};
function lang(){return C[document.documentElement.lang]?document.documentElement.lang:'cs'}
function t(){return C[lang()]}
function calURL(){return root+'?lang='+lang()+'&category='+(club?'club':'walkers')+'#impr-calendar'}
function formURL(id){return root+'register/?lang='+lang()+(id?'&event='+encodeURIComponent(id):'')+'&src='+(club?'druzina':'walkers')+'_hero'}
function readable(iso){return new Intl.DateTimeFormat(({cs:'cs-CZ',en:'en-GB',ru:'ru-RU',uk:'uk-UA'})[lang()],{timeZone:'Europe/Prague',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}
function isRelevant(e){
 const v=[e.title,e.category,e.community,e.event_id].join(' ').toLowerCase();
 return club?/hema|družin|druzin|šerm|serm|fenc|larp|orel/.test(v):/brnowalkers|hike|walk|vycház|procház|výlet|vylet|trek|after dark|morav/.test(v);
}
function valid(e){
 if(!e||!/^PUB-[A-Z0-9-]{4,90}$/.test(e.event_id||'')||Date.parse(e.begins_at)<=Date.now())return false;
 if(club&&e.category==='HEMA Training'&&new Date(e.begins_at).getUTCDay()===6&&e.event_id!=='PUB-OREL-20261114')return false;
 return isRelevant(e);
}
const eventsUrlPromise=fetch(api,{method:'GET',cache:'no-store'}).then(r=>r.ok?r.json():null).then(payload=>{
 return Array.isArray(payload?.events)?payload.events.filter(valid).sort((a,b)=>Date.parse(a.begins_at)-Date.parse(b.begins_at)):[];
}).catch(()=>[]);
if(walkers)main.prepend(hero);
const currentCard=document.createElement('aside');currentCard.id=club?'imp-club-next':'imp-walkers-next';currentCard.className=club?'imp-next-card':'imp-walkers-next';
const inner=hero.querySelector(':scope > .wrap');if(club&&inner)inner.insertBefore(currentCard,inner.querySelector('.hero-ctas'));
else hero.insertAdjacentElement('afterend',currentCard);
function nextMonday(){
 const m=new Date(),policy=window.ImperionCalendarPolicy; if(!policy)return null;
 var list=policy.forMonth(m.getFullYear(),m.getMonth(),[]),next=new Date(m.getFullYear(),m.getMonth()+1,1);
 list=list.concat(policy.forMonth(next.getFullYear(),next.getMonth(),[]));
 return list[0]||null;
}
let current=null;
function render(){
 const d=t(),e=current||(!club?null:nextMonday());
 const free=e?.event_id==='PUB-OREL-20261114';
 const tentative=e?.provisional===true;
 const title=e?.provisional?window.ImperionCalendarPolicy.langData(lang()).title:e?.title||(club?d.clubTitle:d.walkTitle);
 const time=e?.begins_at?readable(e.begins_at):'';
 const href=e&&!tentative?formURL(e.event_id):club?(e?.local_day?window.ImperionCalendarPolicy.enquire(lang(),e.local_day):formURL()):calURL();
 currentCard.innerHTML='';
 function node(tag,cls,txt){let x=document.createElement(tag);if(cls)x.className=cls;x.textContent=txt;return x}
 currentCard.append(node('p','imp-kicker',d.next));
 currentCard.append(node('h2','',title));
 if(time)currentCard.append(node('p','', '📅 '+time));
 currentCard.append(node('p','',free?d.free:tentative?d.ongoing:d.confirm));
 if(walkers)currentCard.append(node('p','',d.walkNote));
 const links=node('div','imp-quick-links','');
 function link(label,url,secondary){let a=node('a',secondary?'secondary':'',label);a.href=url;if(url.startsWith('https://wa.me/')){a.target='_blank';a.rel='noopener noreferrer';}links.append(a)}
 link(tentative?d.check:d.register,href,false);link(d.calendar,calURL(),true);currentCard.append(links);
}
render();
eventsUrlPromise.then(function(events){
 if(events.length){current=events[0];}
 else if(club&&Date.now()<Date.parse('2026-11-14T12:00:00+01:00')){
   // The separately approved free workshop remains free until its actual start.
   current={event_id:'PUB-OREL-20261114',title:({cs:'14. listopadu · úvodní šerm ZDARMA',en:'14 Nov · free beginner fencing',ru:'14 ноября · бесплатный мастер-класс по фехтованию',uk:'14 листопада · безкоштовний майстер-клас із фехтування'})[lang()],begins_at:'2026-11-14T12:00:00+01:00'};
 }
 render();
});
if(club){
 const original=hero.querySelector('#dm-nov14-fast-rsvp');
 if(original)original.hidden=true;
 const info=document.createElement('section');info.id='imp-club-essentials';info.className='imp-essentials';
 info.innerHTML='<p class="imp-kicker"></p><h2></h2><div class="imp-facts"></div><div class="imp-quick-links"></div>';
 hero.insertAdjacentElement('afterend',info);
 function renderInfo(){
  const d=t();info.querySelector('.imp-kicker').textContent=d.clubAbout;info.querySelector('h2').textContent=d.visiting;
  info.querySelector('.imp-facts').replaceChildren();
  [[d.first,d.visitBody],[d.when,d.whenBody],[d.where,d.whereBody]].forEach(function(v){
    let card=document.createElement('div'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=v[0];p.textContent=v[1];card.append(h,p);info.querySelector('.imp-facts').append(card);
  });
  const links=info.querySelector('.imp-quick-links');links.replaceChildren();
  [[d.first,formURL()],[d.schedule,calURL()],[d.safety,'safety/?lang='+lang()]].forEach(function(v,i){
    let a=document.createElement('a');a.className=i?'secondary':'';a.href=v[1];a.textContent=v[0];links.append(a);
  });
 }
 renderInfo();
 const extras=document.createElement('details');extras.className='imp-secondary-info';extras.id='imp-club-archives';
 extras.innerHTML='<summary></summary><div class="imp-secondary-body"></div>';main.append(extras);
 const archive=extras.querySelector('.imp-secondary-body');
 ['november-events-hub','dm-all-generations','new-training-enquiry'].forEach(function(id){
   let el=document.getElementById(id);if(el&&!el.contains(extras))archive.append(el);
 });
 function onLang(){render();renderInfo();extras.querySelector('summary').textContent=t().archive}
 new MutationObserver(onLang).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});onLang();
}else{
 const essentials=document.createElement('section');essentials.id='imp-walkers-essentials';essentials.className='imp-essentials';
 essentials.innerHTML='<p class="imp-kicker"></p><h2></h2><p></p><div class="imp-quick-links"></div>';
 hero.insertAdjacentElement('afterend',essentials);
 const archives=document.createElement('details');archives.id='imp-walkers-archives';archives.className='imp-secondary-info';
 archives.innerHTML='<summary></summary><div class="imp-secondary-body"></div>';main.append(archives);
 const archive=archives.querySelector('.imp-secondary-body');
 ['november-events-hub','bw-walktalk-nov-2026','new-website-registration','bw-cancel-20261028','walkers-rules','canoe-safety','faq','medals','boardgames'].forEach(function(id){
    var item=document.getElementById(id);
    // Never move a parent that contains the hero or essential sections.
    if(item&&!item.contains(hero)&&!item.contains(essentials)&&!item.contains(archives))archive.append(item);
 });
 function onLang(){
  const d=t();render();essentials.querySelector('.imp-kicker').textContent=d.walkAbout;essentials.querySelector('h2').textContent=d.walkTitle;
  essentials.querySelector('p:not(.imp-kicker)').textContent=d.walkNote;
  archives.querySelector('summary').textContent=d.archive;
  const links=essentials.querySelector('.imp-quick-links');links.replaceChildren();
  [[d.calendar,calURL()],[d.register,formURL()]].forEach(function(v,i){var a=document.createElement('a');a.className=i?'secondary':'';a.href=v[1];a.textContent=v[0];links.append(a);});
 }
 new MutationObserver(onLang).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});onLang();
}
})();
