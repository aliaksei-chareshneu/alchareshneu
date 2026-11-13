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
    walkers:'walkers',calendar:'events',events:'events',about:'about',
    'brno-stories':'walkers'})[section]||'home';
  var copy={
    cs:{home:'Úvod',events:'Akce',academy:'Akademie',club:'Družina',walkers:'BrnoWalkers',about:'O mně',skip:'Přejít k obsahu',nav:'Hlavní navigace'},
    en:{home:'Home',events:'Events',academy:'Academy',club:'Družina',walkers:'BrnoWalkers',about:'About',skip:'Skip to content',nav:'Main navigation'},
    ru:{home:'Главная',events:'События',academy:'Академия',club:'Дружина',walkers:'BrnoWalkers',about:'Обо мне',skip:'К содержанию',nav:'Главная навигация'},
    uk:{home:'Головна',events:'Події',academy:'Академія',club:'Дружина',walkers:'BrnoWalkers',about:'Про мене',skip:'До вмісту',nav:'Головна навігація'}
  };
  var supported=Array.from(new Set(
    Array.from(document.querySelectorAll('button[data-lang], a[data-lang], button[data-switch]'))
      .map(function(x){return x.getAttribute('data-lang')||x.getAttribute('data-switch');})
      .filter(function(x){return ['cs','en','ru','uk'].indexOf(x)>=0;})
  ));
  var registerIndex=/^register\/(?:(?:en|ru|uk)\/)?(?:index\.html)?$/.test(path);
  if(section==='about'||registerIndex||path==='druzina/cesty/'||path==='druzina/cesty/index.html')supported=['cs','en','ru','uk'];
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
  var keys=['home','events','academy','club','walkers','about'],links={};
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
  // Existing form, language, event and payment scripts remain authoritative.
})();