/* One calendar always visible, independent of bookable registration form state.
   Tentative Monday slots are visible without presenting a payment or reservable form. */
(function(){
'use strict';
function boot(){
 var form=document.getElementById('rsvpForm');
 var calendar=form&&form.querySelector('.event-calendar');
 if(!form||!calendar||!form.parentElement)return;
 form.insertAdjacentElement('beforebegin',calendar);
 calendar.setAttribute('data-standalone-public-calendar','yes');
 var loading=document.getElementById('loading');
 function repaint(){if(typeof renderCalendar==='function')renderCalendar();}
 if(loading)new MutationObserver(repaint).observe(loading,{attributes:true,attributeFilter:['hidden']});
 repaint();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
