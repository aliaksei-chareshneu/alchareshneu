/* Shared published Academy price guidance (new enquiries only), not a payment quote.
   Actual invoice/bank details MUST come from an approved private server-side quote. */
(function(w){
'use strict';
const services=[
  ['czech','languages','Čeština','Czech','Чешский','Чеська'],
  ['english','languages','Angličtina','English','Английский','Англійська'],
  ['math','school','Matematika','Mathematics','Математика','Математика'],
  ['physics','school','Fyzika','Physics','Физика','Фізика'],
  ['chemistry','school','Chemie','Chemistry','Химия','Хімія'],
  ['biology','school','Biologie','Biology','Биология','Біологія'],
  ['biochemistry','school','Biochemie','Biochemistry','Биохимия','Біохімія'],
  ['natural-sciences','school','Přírodní vědy','Natural sciences','Естественные науки','Природничі науки'],
  ['python','technical','Programování · Python','Programming · Python','Программирование · Python','Програмування · Python'],
  ['data','technical','Data · SQL · AI','Data · SQL · AI','Данные · SQL · AI','Дані · SQL · AI'],
  ['fitness','movement','Osobní fitness','Personal fitness','Индивидуальный фитнес','Особистий фітнес'],
  ['calisthenics','movement','Kalistenika','Calisthenics','Калистеника','Калістеніка'],
  ['fencing','movement','Individuální šerm','Private fencing','Индивидуальное фехтование','Індивідуальне фехтування'],
  ['archery','movement','Individuální lukostřelba','Private archery','Индивидуальная стрельба из лука','Індивідуальна стрільба з лука'],
  ['medical','support','Tlumočení u lékaře','Medical interpreting','Перевод у врача','Переклад у лікаря'],
  ['offices','support','Úřady a dokumenty','Offices and documents','Учреждения и документы','Установи та документи'],
  ['legal','support','Hledání odborníka','Finding a specialist','Поиск специалиста','Пошук фахівця']
].map(x=>({id:x[0],category:x[1],names:{cs:x[2],en:x[3],ru:x[4],uk:x[5]}}));
const copies={
  cs:{quote:'Písemná nabídka před objednáním',from:'Od',minute:'60 min',provisional:'Orientační veřejná cena; konečná nabídka a platba až po potvrzení.',formats:{school:['Škola','Přijímačky / maturita','Univerzita'],technical:['Základy','Projekt / data','Pokročilé učení'],languages:['Běžné použití','Zkouška','Studium a práce'],movement:['Úvodní trénink','Pravidelný plán','Technika a bezpečnost'],support:['Příprava','Tlumočení / doprovod','Další kroky']}},
  en:{quote:'Written quote before ordering',from:'From',minute:'60 min',provisional:'Indicative public price. Final scope and bank details require written approval.',formats:{school:['School','Entrance / exams','University'],technical:['Basics','Project / data','Advanced learning'],languages:['Everyday use','Exam preparation','Study and work'],movement:['First session','Regular plan','Technique and safety'],support:['Preparation','Interpreting / support','Next steps']}},
  ru:{quote:'Цена по письменному предложению',from:'От',minute:'60 мин',provisional:'Публичный ориентир. Итоговая цена и реквизиты — после письменного подтверждения.',formats:{school:['Школа','Поступление / экзамены','Университет'],technical:['Основы','Проект / данные','Продвинутое обучение'],languages:['Для жизни','Для экзамена','Для учёбы и работы'],movement:['Первая тренировка','Регулярная программа','Техника и безопасность'],support:['Подготовка','Перевод / сопровождение','Дальнейшие шаги']}},
  uk:{quote:'Ціна за письмовою пропозицією',from:'Від',minute:'60 хв',provisional:'Публічний орієнтир. Остаточну ціну і реквізити підтверджують письмово.',formats:{school:['Школа','Вступ / іспити','Університет'],technical:['Основи','Проєкт / дані','Поглиблене навчання'],languages:['Для життя','Для іспиту','Для навчання й роботи'],movement:['Перше заняття','Регулярний план','Техніка та безпека'],support:['Підготовка','Переклад / супровід','Наступні кроки']}}
};
function find(id){return services.find(s=>s.id===id)||null}
function info(key,variant,lang){
 const s=find(key),d=copies[lang]||copies.cs;if(!s)return {label:d.quote,amount:null,exact:false,mode:'QUOTE'};
 const index=Math.max(0,Math.min(2,Number(String(variant).replace('v',''))-1||0));
 const category=s.category;
 let amount=null,exact=false,prefix='',mode='QUOTE',unit=d.minute;
 if(category==='school'||category==='languages'||category==='technical'&&index!==1){
   amount=690;exact=true;mode='STANDARD_LESSON';
 }
 if(category==='movement'){
   if(key==='fitness'||key==='calisthenics'){amount=index===1?600:400;exact=index!==2;mode=index===1?'IN_PERSON_TRAINING':'ONLINE_FITNESS';}
   else{amount=700;exact=false;mode='PRIVATE_SAFETY_QUOTE';prefix=d.from+' ';}
 }
 if(category==='support'&&key==='medical'){
   if(index===1){amount=900;exact=false;mode='IN_PERSON_INTERPRETING';prefix=d.from+' ';}
   else if(index===0){amount=600;exact=false;mode='ONLINE_INTERPRETING';prefix=d.from+' ';}
 }
 // Technical fixed-scope project, fitness special plan and administrative help are quoted.
 if(category==='technical'&&index===1||category==='support'&&key!=='medical'||category==='movement'&&index===2){
   amount=null;exact=false;mode='QUOTE';
 }
 const label=amount===null?d.quote:(prefix+amount+' Kč / '+unit);
 return {key:s.id,category,format:variant,name:s.names[lang]||s.names.cs,
   title:d.formats[category]?.[index]||s.names[lang],label,amount,exact,mode,notice:d.provisional};
}
w.ImperionAcademyCatalog=Object.freeze({services:services,copies:copies,info:info,find:find});
})(window);
