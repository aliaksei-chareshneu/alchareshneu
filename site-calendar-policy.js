/* Shared public display policy: recurring training SLOT, NOT an approved event or reservation.
   No database writes; do not manufacture a verified event ID. Entire calendar horizon
   always has Monday 18:00 slots unless a verified real Monday HEMA event exists. */
(function(global){
  'use strict';
  var fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'});
  var hour=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',hour:'2-digit',hourCycle:'h23'});
  function dateKey(iso){
    var d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';
    var p={};fmt.formatToParts(d).forEach(function(x){p[x.type]=x.value;});
    return p.year+'-'+p.month+'-'+p.day;
  }
  function atPrague18(y,m,d){
    var utc=Date.UTC(y,m,d,17,0);
    var guess=new Date(utc);
    if(hour.format(guess)!=='18')guess=new Date(utc-3600000);
    return guess.toISOString();
  }
  var copy={
    cs:{title:'Pravidelný pondělní slot HEMA · orientačně',detail:'Pondělí 18:00–19:30, Brno. Jde o plánovaný pravidelný slot, nikoli potvrzenou lekci nebo místo. Konkrétní datum, vedoucího, místo, bezpečnost a cenu musí pořadatel před účastí písemně potvrdit. Soboty jsou pozastavené.',status:'Termín k ověření · bez rezervace',price:'Cena až po potvrzení',ask:'Ověřit pondělní trénink'},
    en:{title:'Weekly Monday HEMA slot · tentative',detail:'Mondays 18:00–19:30 in Brno. This is a recurring planning slot, NOT a confirmed session or reserved place. Check the exact date, instructor, venue, safety and fee in writing before attending. Saturdays are suspended.',status:'Subject to confirmation · not booked',price:'Price on confirmation',ask:'Check Monday training'},
    ru:{title:'Понедельник · фехтование · планируемое занятие',detail:'По понедельникам 18:00–19:30, Брно. Это регулярное плановое время, НЕ подтверждённая тренировка и НЕ бронирование. Конкретные дату, ведущего, место, безопасность и цену требуется подтвердить письменно. Субботы приостановлены.',status:'Нужно подтверждение · не запись',price:'Цена после подтверждения',ask:'Уточнить тренировку в понедельник'},
    uk:{title:'Понеділок · фехтування · попередній план',detail:'Щопонеділка 18:00–19:30, Брно. Це регулярний запланований час, НЕ підтверджене заняття чи бронювання. Точну дату, тренера, місце, безпеку та ціну треба письмово підтвердити до участі. Суботи призупинені.',status:'Потребує підтвердження · не бронювання',price:'Ціна після підтвердження',ask:'Уточнити тренування в понеділок'}
  };
  function langData(code){return copy[code]||copy.cs;}
  function isClub(e){return /hema|družin|druzin|šerm|s(e|é)rm|fenc/i.test([e.category,e.community,e.title].join(' '));}
  function forMonth(y,m,events){
    if(!Number.isInteger(y)||!Number.isInteger(m)||m<0||m>11)return [];
    var today=dateKey(new Date()),result=[],last=new Date(Date.UTC(y,m+1,0)).getUTCDate(),seen={};
    (Array.isArray(events)?events:[]).forEach(function(e){if(isClub(e)){var k=dateKey(e.begins_at);if(k)seen[k]=true;}});
    for(var d=1;d<=last;d++){
      if(new Date(Date.UTC(y,m,d)).getUTCDay()!==1)continue;
      var k=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      if(k<today||seen[k])continue;
      var begin=atPrague18(y,m,d);
      if(Date.parse(begin)<Date.now())continue;
      result.push({
        provisional:true,
        begins_at:begin,
        local_day:k,
        event_id:'PREVIEW-ONLY-'+k,
        category:'HEMA Training',community:'Družina Moravy',
        title:copy.cs.title,
        registration_mode:'NONE',is_open:false,price_verified:false,end_time_verified:false,
        venue:'Brno (only after organiser confirmation)',
        data_controller:'Družina Moravy, z. s.'
      });
    }
    return result;
  }
  function enquire(lang,key){
    var t=langData(lang),msg=t.ask+' · '+key+'. '+t.status+'. '+t.detail;
    return 'https://wa.me/420702914842?text='+encodeURIComponent(msg);
  }
  global.ImperionCalendarPolicy=Object.freeze({forMonth:forMonth,langData:langData,enquire:enquire,dateKey:dateKey});
})(window);
