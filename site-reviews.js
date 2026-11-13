/* First-party customer trust module. Only already-public, pre-existing screenshots.
   The live Google count is NOT verified; never invent rating, count or quotes. */
(function(){
'use strict';
var mount=document.getElementById('imperion-frontdoor');
if(!mount)return;
var href='https://maps.app.goo.gl/fEbnJHxiVoAx1v498';
var imgs=['ekaterina','elmusso','nejc','olga','samsung','viktoria'];
var copy={
cs:{badge:'★ Recenze na Googlu',badgeSub:'Otevřít skutečné recenze',eyebrow:'ZKUŠENOSTI LIDÍ',title:'Co říkají lidé',lead:'Ukázky dříve zveřejněných hodnocení. Úplné a aktuální znění, hodnocení a počet recenzí ověřte přímo na Googlu.',cta:'Všechny recenze na Googlu',alt:'Snímek dříve zveřejněné recenze'},
en:{badge:'★ Google reviews',badgeSub:'Read genuine reviews',eyebrow:'PEOPLE’S EXPERIENCES',title:'What people say',lead:'Selections of previously published testimonials. Read current reviews, ratings and counts directly on Google.',cta:'Read all Google reviews',alt:'Screenshot of a previously published review'},
ru:{badge:'★ Отзывы Google',badgeSub:'Читать реальные отзывы',eyebrow:'ОПЫТ УЧАСТНИКОВ',title:'Что говорят люди',lead:'Подборка ранее опубликованных отзывов. Актуальное количество, рейтинг и полные тексты проверяйте непосредственно в Google.',cta:'Читать все отзывы в Google',alt:'Снимок ранее опубликованного отзыва'},
uk:{badge:'★ Відгуки Google',badgeSub:'Читати справжні відгуки',eyebrow:'ДОСВІД УЧАСНИКІВ',title:'Що говорять люди',lead:'Добірка раніше опублікованих відгуків. Актуальну кількість, рейтинг і повні тексти перевіряйте безпосередньо в Google.',cta:'Читати всі відгуки в Google',alt:'Знімок раніше опублікованого відгуку'}
};
var badge=document.createElement('a');badge.id='imp-google-review-badge';badge.href=href;badge.target='_blank';badge.rel='noopener noreferrer';badge.innerHTML='<span class="imp-review-stars" aria-hidden="true">★★★★★</span><strong></strong><small></small>';
var hero=mount.querySelector('.fd-hero');
if(hero)hero.append(badge);
var section=document.createElement('section');section.id='imp-home-reviews';section.setAttribute('aria-label','Google reviews');
section.innerHTML='<div class="fd-shell"><div class="imp-reviews-head"><p class="imp-reviews-eyebrow"></p><h2></h2><p class="imp-reviews-lead"></p></div><div class="imp-review-grid"></div><a class="imp-review-read-all" target="_blank" rel="noopener noreferrer"></a></div>';
var grid=section.querySelector('.imp-review-grid');
imgs.forEach(function(id,i){var a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.className='imp-review-item';var img=document.createElement('img');img.src='images/reviews/review_'+id+'.png';img.loading='lazy';img.decoding='async';img.alt='';img.width=370;img.height=280;a.append(img);grid.append(a);});
var calendar=mount.querySelector('#impr-calendar');
if(calendar)calendar.insertAdjacentElement('afterend',section);
function update(){
 var lang=document.documentElement.lang,d=copy[lang]||copy.cs;
 badge.querySelector('strong').textContent=d.badge;badge.querySelector('small').textContent=d.badgeSub;
 section.querySelector('.imp-reviews-eyebrow').textContent=d.eyebrow;
 section.querySelector('h2').textContent=d.title;
 section.querySelector('.imp-reviews-lead').textContent=d.lead;
 section.querySelector('.imp-review-read-all').href=href;section.querySelector('.imp-review-read-all').textContent=d.cta+' ↗';
 section.querySelectorAll('img').forEach(function(img,i){img.alt=d.alt+' '+(i+1);});
}
new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
update();
})();
