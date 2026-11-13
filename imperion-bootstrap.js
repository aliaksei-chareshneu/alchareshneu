/* IMPERION: first paint guard.
   Loaded synchronously in <head>, before any legacy markup is parsed.
   On JS failure the safe legacy page is restored after a short timeout. */
(function(){
  'use strict';
  var h=document.documentElement;
  var query=new URLSearchParams(location.search);
  var rootPage=/\/(?:index\.html)?$/.test(location.pathname);
  if(rootPage&&query.get('view')==='details')return;
  h.setAttribute('data-imp-boot','pending');
  window.setTimeout(function(){
    if(h.getAttribute('data-imp-boot')==='pending'){
      h.removeAttribute('data-imp-boot');
      h.setAttribute('data-imp-fallback','legacy');
    }
  },8000);
})();
