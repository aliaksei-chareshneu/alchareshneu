/* Shared CZ/EN/RU/UA calendar over the same verified RSVP event catalog. */
const CALENDAR_COPY={
 cs:{heading:'Kalendář akcí',prev:'Předchozí měsíc',next:'Další měsíc',hint:'Klikněte na den s ikonou. Dostupnost přihlášek se zobrazí u vybrané akce.',onDay:'Akce dne'},
 en:{heading:'Event calendar',prev:'Previous month',next:'Next month',hint:'Select a day with an icon. Registration availability appears beside the selected event.',onDay:'Events on'},
 ru:{heading:'Календарь мероприятий',prev:'Предыдущий месяц',next:'Следующий месяц',hint:'Нажмите день с иконкой. Статус записи указан в описании выбранного мероприятия.',onDay:'Мероприятия на'},
 uk:{heading:'Календар подій',prev:'Попередній місяць',next:'Наступний місяць',hint:'Натисніть день з іконкою. Статус запису показано в описі обраної події.',onDay:'Події на'}
};
let calendarYear=0,calendarMonth=0,calendarInitialized=false,calendarExpandedDay='';
const pragueCalendarDay=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'});
function calendarLocale(){return lang==='cs'?'cs-CZ':lang==='ru'?'ru-RU':lang==='uk'?'uk-UA':'en-GB'}
function calendarDayKey(e){
 const time=Date.parse(e?.begins_at);
 if(!Number.isFinite(time))return '';
 const parts=Object.fromEntries(pragueCalendarDay.formatToParts(new Date(time)).map(part=>[part.type,part.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function calendarIcon(e){
 const value=[e.category,e.community,e.title,e.event_id].filter(Boolean).join(' ').toLocaleLowerCase();
 if(/výsad|vysad|sázen|sazen|plant|úklid|uklid|cleanup|ecolog|ekolog/.test(value))return '🌱';
 if(/workshop|díln|diln|řemesl|remesl|craft|výrob|vyrob|repair/.test(value))return '🛠️';
 if(/hema|družin|druzin|trénink|trenink|training|boj|combat|šerm|serm/.test(value))return '🛡️';
 if(/hike|walk|brnowalkers|procház|prochaz|výlet|vylet|vycház|vychaz|trek/.test(value))return '🥾';
 if(/larp|bajka|art[uú]š|art[uú]s|roleplay|historick/.test(value))return '🎭';
 if(/talk|meetup|setkán|setkan|network|diskus/.test(value))return '💬';
 return '📅';
}
function calendarJumpTo(dayKey){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dayKey))return;
 calendarYear=Number(dayKey.slice(0,4));calendarMonth=Number(dayKey.slice(5,7))-1;
}
function calendarDayLabel(year,month,day){
 return new Intl.DateTimeFormat(calendarLocale(),{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month,day,12)));
}
function calendarRenderDayOptions(entries,dayKey){
 const panel=$('calendarDayEvents');panel.replaceChildren();
 if(!entries?.length){panel.hidden=true;return}
 panel.hidden=false;
 const heading=document.createElement('strong');
 heading.textContent=CALENDAR_COPY[lang].onDay+' '+calendarDayLabel(calendarYear,calendarMonth,Number(dayKey.slice(-2)));
 panel.append(heading);
 for(const e of entries){
   const draft=!!e.provisional;
   const button=document.createElement(draft?'a':'button');
   if(!draft)button.type='button';
   button.className='calendar-option'+(draft?' calendar-option-preview':'');
   const icon=document.createElement('span');icon.textContent=calendarIcon(e);icon.setAttribute('aria-hidden','true');
   const caption=document.createElement('span');
   const t=window.ImperionCalendarPolicy?.langData(lang);
   caption.textContent=draft?(e.local_day+' · 18:00 · '+t.title+' — '+t.status):(eventDate(e)+' · '+e.title+' — '+statusLabel(e));
   button.append(icon,caption);
   if(draft){button.href=window.ImperionCalendarPolicy.enquire(lang,e.local_day);button.target='_blank';button.rel='noopener noreferrer';}
   else button.addEventListener('click',()=>chooseEvent(e.event_id));
   panel.append(button);
 }
}
function renderCalendar(){
 if(!calendarYear)calendarJumpTo(calendarDayKey({begins_at:new Date().toISOString()}));
 const dict=CALENDAR_COPY[lang]||CALENDAR_COPY.cs;
 $('eventCalendarHeading').textContent=dict.heading;
 $('calendarHint').textContent=dict.hint;
 $('calendarPrev').setAttribute('aria-label',dict.prev);$('calendarPrev').title=dict.prev;
 $('calendarNext').setAttribute('aria-label',dict.next);$('calendarNext').title=dict.next;
 $('calendarMonth').textContent=new Intl.DateTimeFormat(calendarLocale(),{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(calendarYear,calendarMonth,15,12)));
 const weekdays=$('calendarWeekdays');weekdays.replaceChildren();
 const weekdayFormatter=new Intl.DateTimeFormat(calendarLocale(),{weekday:'short',timeZone:'UTC'});
 for(let i=0;i<7;i++){
   const label=document.createElement('span');label.textContent=weekdayFormatter.format(new Date(Date.UTC(2024,0,1+i)));
   weekdays.append(label);
 }
 const grouped=new Map(),prefix=String(calendarYear)+'-'+String(calendarMonth+1).padStart(2,'0')+'-';
 for(const e of events){
   const key=calendarDayKey(e);
   if(!key.startsWith(prefix))continue;
   if(!grouped.has(key))grouped.set(key,[]);
   grouped.get(key).push(e);
 }
 // Add only visual Monday previews, never rows in the booking list or backend.
 const previews=window.ImperionCalendarPolicy?.forMonth(calendarYear,calendarMonth,events)||[];
 for(const preview of previews){const k=preview.local_day;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(preview);}
 for(const list of grouped.values())list.sort((a,b)=>Date.parse(a.begins_at)-Date.parse(b.begins_at));
 const grid=$('calendarGrid');grid.replaceChildren();
 const start=(new Date(Date.UTC(calendarYear,calendarMonth,1)).getUTCDay()+6)%7;
 const days=new Date(Date.UTC(calendarYear,calendarMonth+1,0)).getUTCDate();
 const selected=events.find(e=>e.event_id===$('eventId').value),selectedKey=selected?calendarDayKey(selected):'';
 const todayKey=calendarDayKey({begins_at:new Date().toISOString()});
 for(let i=0;i<start;i++){
   const blank=document.createElement('span');blank.className='calendar-empty';blank.setAttribute('aria-hidden','true');grid.append(blank);
 }
 for(let day=1;day<=days;day++){
   const key=prefix+String(day).padStart(2,'0'),entries=grouped.get(key)||[];
   const cell=document.createElement(entries.length?'button':'span');
   cell.className='calendar-day'+(entries.length?' has-events':'')+(entries.some(e=>e.provisional)?' has-recurring-preview':'')+(entries.some(e=>!e.provisional&&eventMode(e)==='FORM')?' has-open':'')+(key===selectedKey?' is-selected':'')+(key===todayKey?' is-today':'');
   if(entries.length){
     cell.type='button';
     const label=calendarDayLabel(calendarYear,calendarMonth,day);
     cell.setAttribute('aria-label',label+': '+entries.map(e=>e.provisional?window.ImperionCalendarPolicy.langData(lang).title+' — '+window.ImperionCalendarPolicy.langData(lang).status:e.title+' ('+statusLabel(e)+')').join('; '));
     cell.setAttribute('aria-pressed',String(key===selectedKey));
     cell.title=entries.map(e=>e.provisional?('🛡️ '+e.local_day+' · 18:00 · '+window.ImperionCalendarPolicy.langData(lang).status):(calendarIcon(e)+' '+eventDate(e)+' · '+e.title+' — '+statusLabel(e))).join('\n');
     cell.addEventListener('click',()=>{
       if(entries.length===1&&!entries[0].provisional){chooseEvent(entries[0].event_id)}
       else{calendarExpandedDay=calendarExpandedDay===key?'':key;renderCalendar()}
     });
   }
   const number=document.createElement('span');number.textContent=String(day);cell.append(number);
   if(entries.length){
     const icons=document.createElement('span');icons.className='calendar-day-icons';icons.setAttribute('aria-hidden','true');
     for(const e of entries.slice(0,2)){const icon=document.createElement('span');icon.textContent=calendarIcon(e);icons.append(icon)}
     if(entries.length>2){const more=document.createElement('small');more.textContent='+'+(entries.length-2);icons.append(more)}
     cell.append(icons);
   }
   grid.append(cell);
 }
 if(calendarExpandedDay && calendarExpandedDay.startsWith(prefix))calendarRenderDayOptions(grouped.get(calendarExpandedDay),calendarExpandedDay);
 else{$('calendarDayEvents').hidden=true;calendarExpandedDay=''}
}
function shiftCalendarMonth(direction){
 const next=new Date(Date.UTC(calendarYear,calendarMonth+direction,1));
 calendarYear=next.getUTCFullYear();calendarMonth=next.getUTCMonth();calendarExpandedDay='';renderCalendar();
}
document.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('calendarPrev')?.addEventListener('click',()=>shiftCalendarMonth(-1));
 document.getElementById('calendarNext')?.addEventListener('click',()=>shiftCalendarMonth(1));
});
