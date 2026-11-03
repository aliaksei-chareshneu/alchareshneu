/* Decorative media layer for the 31-card catalogue. No user data or network APIs. */
(function(){
'use strict';
const root='../../images/';
const photos={
 data:'hero-scholar.webp', ai:'main_hero.webp', science:'portrait_cave.webp',
 languages:'walkers_group.webp', exams:'boardgames.webp', skills:'druzina_larp.webp'
};
const glyphs={
 PY01:'🐍',PY02:'📊',PY03:'📈',PY04:'🔬',PY05:'🧮',PY06:'🗃️',PY07:'⚙️',
 AI01:'🤖',AI02:'✨',AI03:'🧠',AI04:'🛠️',AI05:'🎯',AI06:'🚀',
 SC01:'🧬',SC02:'🧪',SC03:'🦠',SC04:'🔭',
 CZ01:'🇨🇿',CZ02:'💬',CZ03:'🗣️',CZ04:'📚',EN01:'🇬🇧',EN02:'🌐',
 EX01:'📝',EX02:'🎓',EX03:'📐',EX04:'🏆',
 SK01:'🎤',SK02:'🧭',SK03:'💡',SK04:'🏰'
};
const courseNames={
 en:['Python & data','AI & workflows','Science','Languages','History & community'],
 cs:['Python a data','AI a procesy','Přírodní vědy','Jazyky','Historie a komunita'],
 ru:['Python и данные','ИИ и процессы','Науки','Языки','История и сообщество']
};
const galleryPhotos=['hero-scholar.webp','main_hero.webp','portrait_cave.webp','walkers_group.webp','druzina_larp.webp'];
const hero=document.querySelector('section.hero');
const facts=hero?.querySelector('.facts');
if(hero&&facts){
 const gallery=document.createElement('div');gallery.className='course-gallery';
 gallery.setAttribute('aria-label','Course themes');
 galleryPhotos.forEach((filename,i)=>{
  const figure=document.createElement('figure');
  const image=document.createElement('img');
  image.src=root+filename;image.alt='';image.loading=i===0?'eager':'lazy';image.decoding='async';
  const caption=document.createElement('figcaption');caption.dataset.galleryCaption=String(i);
  figure.append(image,caption);gallery.append(figure);
 });
 facts.before(gallery);
}
const language=()=>['en','cs','ru'].includes(document.documentElement.lang)?document.documentElement.lang:'en';
function relabel(){
 const locale=language();
 document.querySelectorAll('[data-gallery-caption]').forEach(c=>{
  c.textContent=courseNames[locale][Number(c.dataset.galleryCaption)]||'Courses';
 });
 document.querySelectorAll('.course-extra summary').forEach(s=>{
  s.textContent=({en:'See syllabus',cs:'Zobrazit osnovu',ru:'Посмотреть программу'})[locale];
 });
}
document.querySelectorAll('#catalog article.course').forEach(card=>{
 const group=card.dataset.group||'science';
 const art=document.createElement('div');art.className='course-visual';art.setAttribute('aria-hidden','true');
 const img=document.createElement('img');img.src=root+(photos[group]||photos.science);img.alt='';img.loading='lazy';img.decoding='async';
 const num=document.createElement('span');num.className='visual-index';num.textContent=card.id;
 const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=glyphs[card.id]||'📚';
 art.append(img,num,glyph);card.prepend(art);
 const steps=card.querySelector(':scope > .steps');
 if(steps){
  const extra=document.createElement('details');extra.className='course-extra';
  const summary=document.createElement('summary');summary.textContent='See syllabus';
  extra.append(summary,steps);card.append(extra);
 }
});
relabel();
document.querySelectorAll('[data-lang]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(relabel)));
})();