/* Academy booking: presentation only. Server owns slots, rate and price. */
"use strict";
const API="https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-academy-book";
const LOCAL={en:"en-GB",cs:"cs-CZ",ru:"ru-RU",uk:"uk-UA"};
const copy={
en:{back:"Academy home",packs:"Programmes",title:"Choose a lesson time.",subtitle:"One-on-one Czech, languages, mathematics, science and programming. Pick a published time slot. No calendar account required.",alertTitle:"Payment proof is not a confirmed payment.",alert:"A PDF upload creates a pending request, not a paid or confirmed booking. A person checks the bank transfer and confirms the lesson separately. Old agreements are not changed.",choose:"1. Choose your lesson and time",subjectLabel:"Subject",durationLabel:"Session",lessonOption:"Individual lesson · 60 min · 1,000 Kč",consultOption:"Service choice consultation · 15 min · 250 Kč",dateLabel:"Available date (Prague time)",dateHelp:"Only dates and times explicitly released by the tutor can be selected.",timesLabel:"Available times",loading:"Loading available slots…",notAvailable:"No suitable slot? Request a custom schedule or a 5/10/20-lesson programme.",askPlan:"Request a programme",yourDetails:"2. Your details and PDF receipt",noSlot:"No time selected",nameLabel:"Paying adult / guardian name",emailLabel:"Email for the booking response",goalLabel:"Learning goal (optional)",receiptLabel:"Bank transfer confirmation · PDF only · up to 4 MB",receiptHelp:"Pay only using payment details you have already verified with the organiser. Do not upload ID documents or confidential unrelated files.",privacy:"I have read the privacy notice about processing necessary to handle this request.",guardian:"I am 18+ or the student's legal guardian, authorised to arrange payment and lessons.",privacyLink:"Privacy and retention information",conditions:"Provisional +25% if payment is received less than 48h before start. Final fee depends on verified bank value date. Cancellations and packages follow individually agreed written conditions.",submit:"Submit booking request + PDF",operator:"Independent OSVČ tuition. Enquiry ≠ payment ≠ confirmed lesson.",empty:"No approved slots available for this date and session.",loadFail:"Live availability could not be checked. Do not pay or submit until the service works.",late:"Less than 48h: provisional +25%.",normal:"48h or more: no urgent surcharge shown.",base:"Base",fee:"Provisional urgency",statusSubmitting:"Sending PDF securely…",invalid:"Select a time and complete all required fields, including a valid PDF (max 4 MB).",success:"Request received. Reference: {id}. Payment and appointment are NOT yet verified or confirmed.",slotTaken:"This time was just taken. Choose another slot.",failed:"Could not save the request. No booking is confirmed; please retry after checking availability."},
cs:{back:"Zpět do Academy",packs:"Programy",title:"Vyberte si termín lekce.",subtitle:"Individuální čeština, jazyky, matematika, přírodní vědy a programování. Vyberte zveřejněný termín bez kalendářového účtu.",alertTitle:"Nahrané potvrzení není ověřená platba.",alert:"PDF založí neověřenou žádost. Bankovní připsání a termín potvrdí zvlášť organizátor. Starší dohody se nemění.",choose:"1. Předmět a termín",subjectLabel:"Předmět",durationLabel:"Služba",lessonOption:"Individuální lekce · 60 min · 1 000 Kč",consultOption:"Konzultace k výběru služby · 15 min · 250 Kč",dateLabel:"Datum (čas Prahy)",dateHelp:"Lze zvolit pouze termíny výslovně uvolněné lektorem.",timesLabel:"Volné časy",loading:"Načítání termínů…",notAvailable:"Nehodí se žádný čas? Poptat individuální rozvrh nebo balíček 5/10/20 lekcí.",askPlan:"Poptat program",yourDetails:"2. Údaje a potvrzení platby",noSlot:"Termín není zvolen",nameLabel:"Jméno platící dospělé osoby / zákonného zástupce",emailLabel:"E-mail pro odpověď",goalLabel:"Studijní cíl (nepovinné)",receiptLabel:"Potvrzení bankovního převodu · pouze PDF · max. 4 MB",receiptHelp:"Plaťte pouze na údaje předem ověřené s pořadatelem. Nenahrávejte doklady totožnosti ani nesouvisející citlivé dokumenty.",privacy:"Přečetl/a jsem informace o ochraně osobních údajů a souhlasím s jejich nezbytným zpracováním pro žádost.",guardian:"Je mi 18+ nebo jsem zákonný zástupce studenta oprávněný sjednat výuku a platbu.",privacyLink:"Soukromí a doba uchování",conditions:"Orientační příplatek +25 %, pokud peníze dorazí méně než 48 h před termínem. Rozhoduje ověřené připsání v bance. Storno a balíčky dle písemně sjednaných podmínek.",submit:"Odeslat žádost a PDF",operator:"Výuka OSVČ. Žádost ≠ platba ≠ potvrzený termín.",empty:"Pro tento den a službu nejsou zveřejněné termíny.",loadFail:"Dostupnost nelze ověřit. Neplaťte ani neposílejte žádost, dokud služba nefunguje.",late:"Méně než 48 h: orientačně +25 %.",normal:"48 h a více: bez příplatku za naléhavost.",base:"Základ",fee:"Orientační příplatek",statusSubmitting:"Bezpečně odesílám PDF…",invalid:"Vyberte termín a vyplňte povinná pole včetně PDF do 4 MB.",success:"Žádost přijata. Reference: {id}. Platba ani termín zatím NEJSOU potvrzeny.",slotTaken:"Termín byl právě obsazen. Vyberte jiný.",failed:"Nepodařilo se uložit žádost. Termín není potvrzen; zkuste to znovu po kontrole dostupnosti."},
ru:{back:"Академия",packs:"Программы",title:"Выберите время занятия.",subtitle:"Индивидуальные уроки чешского, языков, математики, естественных наук и программирования. Нажмите на открытый слот — без аккаунта календаря.",alertTitle:"PDF-квитанция не равна подтверждённой оплате.",alert:"Загрузка PDF создаёт заявку на проверку. Зачисление денег на счёт и запись подтверждаются отдельно. Старые договорённости сохраняются.",choose:"1. Предмет и время",subjectLabel:"Предмет",durationLabel:"Формат",lessonOption:"Индивидуальный урок · 60 мин · 1 000 Kč",consultOption:"Консультация по выбору услуги · 15 мин · 250 Kč",dateLabel:"Дата (время Праги)",dateHelp:"Выбрать можно только слоты, которые преподаватель открыл для записи.",timesLabel:"Доступное время",loading:"Загружаю слоты…",notAvailable:"Нет подходящего времени? Запросите персональное расписание или пакет из 5/10/20 уроков.",askPlan:"Запросить программу",yourDetails:"2. Данные и PDF об оплате",noSlot:"Время не выбрано",nameLabel:"Имя плательщика / законного представителя",emailLabel:"Email для ответа",goalLabel:"Цель обучения (необязательно)",receiptLabel:"Подтверждение банковского перевода · PDF до 4 МБ",receiptHelp:"Платите только по реквизитам, заранее проверенным у организатора. Не загружайте паспорта и посторонние конфиденциальные документы.",privacy:"Я ознакомился(-лась) с условиями обработки данных и разрешаю обработку, необходимую для заявки.",guardian:"Мне 18+ либо я законный представитель ученика с правом согласовать урок и оплату.",privacyLink:"Конфиденциальность и хранение данных",conditions:"Предварительная надбавка +25%, если платёж зачислен менее чем за 48 часов до начала. Окончательная сумма зависит от времени зачисления в банке. Отмена и пакеты — по письменным условиям.",submit:"Отправить заявку и PDF",operator:"Уроки OSVČ. Заявка ≠ оплата ≠ подтверждённая запись.",empty:"На выбранный день и формат открытых слотов нет.",loadFail:"Не удалось проверить свободное время. Не оплачивайте и не отправляйте заявку до восстановления системы.",late:"Менее 48 часов: предварительно +25%.",normal:"48 часов и больше: срочная надбавка не показана.",base:"Базовая цена",fee:"Предварительная надбавка",statusSubmitting:"Безопасно отправляю PDF…",invalid:"Выберите время, заполните обязательные поля и загрузите PDF до 4 МБ.",success:"Заявка получена. Номер: {id}. Оплата и занятие пока НЕ подтверждены.",slotTaken:"Время только что заняли. Выберите другое.",failed:"Заявка не сохранена. Запись не подтверждена; проверьте доступность и повторите."},
uk:{back:"Академія",packs:"Програми",title:"Оберіть час заняття.",subtitle:"Індивідуальні заняття з чеської, мов, математики, природничих наук і програмування. Оберіть доступний слот без облікового запису календаря.",alertTitle:"PDF-квитанція не підтверджує оплату.",alert:"Завантаження PDF створює заявку на перевірку. Надходження коштів та запис підтверджуються окремо. Попередні домовленості зберігаються.",choose:"1. Предмет і час",subjectLabel:"Предмет",durationLabel:"Послуга",lessonOption:"Індивідуальне заняття · 60 хв · 1 000 Kč",consultOption:"Консультація щодо послуги · 15 хв · 250 Kč",dateLabel:"Дата (час Праги)",dateHelp:"Доступні тільки слоти, відкриті викладачем.",timesLabel:"Доступний час",loading:"Завантаження слотів…",notAvailable:"Не підходить час? Запитайте індивідуальний розклад або пакет 5/10/20 занять.",askPlan:"Запитати програму",yourDetails:"2. Дані та PDF оплати",noSlot:"Час не обрано",nameLabel:"Ім'я платника / законного представника",emailLabel:"Електронна пошта для відповіді",goalLabel:"Навчальна мета (необов'язково)",receiptLabel:"Підтвердження банківського переказу · лише PDF до 4 МБ",receiptHelp:"Платіть тільки за раніше перевіреними реквізитами. Не завантажуйте паспорт або сторонні конфіденційні документи.",privacy:"Я ознайомився(-лась) з інформацією про приватність і дозволяю необхідну обробку даних.",guardian:"Мені 18+ або я законний представник учня, уповноважений домовлятися про оплату і заняття.",privacyLink:"Приватність і термін зберігання",conditions:"Попередня доплата +25%, якщо гроші надійшли менш ніж за 48 годин до заняття. Остаточна сума залежить від підтвердженого часу надходження. Скасування та пакети — за письмовими умовами.",submit:"Надіслати заявку й PDF",operator:"Уроки OSVČ. Заявка ≠ оплата ≠ підтверджене заняття.",empty:"Немає доступних слотів на цей день.",loadFail:"Доступність перевірити не вдалося. Не платіть до відновлення роботи.",late:"Менш як 48 годин: попередньо +25%.",normal:"48 годин і більше: без термінової доплати.",base:"Базова ціна",fee:"Попередня доплата",statusSubmitting:"Безпечно надсилаю PDF…",invalid:"Оберіть час та заповніть обов'язкові поля, включно з PDF до 4 МБ.",success:"Заявку отримано. Номер: {id}. Оплату та заняття ще НЕ підтверджено.",slotTaken:"Цей слот уже зайнято. Оберіть інший.",failed:"Заявку не збережено. Запис не підтверджено; перевірте час і повторіть."}
};
const el=id=>document.getElementById(id);
let lang="en",list=[],selected=null,clockOffset=0,rates={LESSON:1000,CONSULT:250},latePct=25;
const booking=el("booking"),day=el("day"),service=el("service");
const num=n=>new Intl.NumberFormat(LOCAL[lang]).format(n)+" Kč";
const dateParts=iso=>{
 const bits=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Prague",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso));
 const part=x=>bits.find(b=>b.type===x)?.value||"";
 return part("year")+"-"+part("month")+"-"+part("day");
};
const when=iso=>new Intl.DateTimeFormat(LOCAL[lang],{timeZone:"Europe/Prague",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
const time=iso=>new Intl.DateTimeFormat(LOCAL[lang],{timeZone:"Europe/Prague",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(iso));
const T=key=>copy[lang][key]||copy.en[key]||key;
function show(id,msg,kind=""){const e=el(id);e.textContent=msg;e.className="status "+kind;}
function translate(){
 document.documentElement.lang=lang; el("locale").value=lang;
 document.querySelectorAll("[data-t]").forEach(e=>e.textContent=T(e.dataset.t));
 document.querySelectorAll("[data-lang]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===lang)));
 document.title=T("title")+" | Eternal Learning Academy";
 renderSlots();updatePrice();
}
function updatePrice(){
 const code=selected?.service_code||service.value;
 const base=Number(rates[code]||0);
 const late=selected && Date.now()+clockOffset>new Date(selected.starts_at).getTime()-48*3600000;
 const fee=late?Math.ceil(base*latePct/100):0;
 el("selectedTime").textContent=selected?when(selected.starts_at)+" · "+selected.delivery_mode:T("noSlot");
 el("price").textContent=num(base+fee);
 el("priceBreakdown").textContent=T("base")+": "+num(base)+" · "+T("fee")+": "+num(fee);
 el("urgent").textContent=selected?(late?T("late"):T("normal")):"";
 el("send").disabled=!selected;
}
function renderSlots(){
 const target=el("slots");target.replaceChildren();
 const visible=list.filter(x=>x.service_code===service.value&&dateParts(x.starts_at)===day.value);
 if(selected&&!visible.some(x=>x.id===selected.id)){selected=null;el("slot").value="";}
 if(!visible.length){const p=document.createElement("div");p.className="empty";p.textContent=T("empty");target.append(p);}
 else visible.forEach(x=>{
  const btn=document.createElement("button");btn.type="button";btn.className="slot";
  btn.textContent=time(x.starts_at);btn.title=when(x.starts_at);
  btn.setAttribute("aria-pressed",String(selected?.id===x.id));
  btn.addEventListener("click",()=>{selected=x;el("slot").value=x.id;renderSlots();updatePrice();});
  target.append(btn);
 });
 updatePrice();
}
async function refresh(){
 el("loadError").classList.add("hidden");
 try{
  const controller=new AbortController(); // no fake slots if API fails
  const response=await fetch(API,{method:"GET",cache:"no-store",signal:controller.signal});
  if(!response.ok)throw Error("unavailable");
  const data=await response.json();
  if(!data.ok||!Array.isArray(data.slots))throw Error("invalid");
  list=data.slots.filter(x=>/^[a-f0-9-]{36}$/i.test(x.id)&&!Number.isNaN(Date.parse(x.starts_at)));
  clockOffset=Date.parse(data.server_now)-Date.now();
  rates=data.rates_czk||rates;latePct=25;
  const earliest=list.filter(x=>x.service_code===service.value)[0];
  if(!day.value&&earliest)day.value=dateParts(earliest.starts_at);
  const nowInPrague=dateParts(data.server_now);
  day.min=nowInPrague;
  const max=new Date(Date.parse(data.server_now)+45*86400000).toISOString();
  day.max=dateParts(max);
  renderSlots();
 }catch{
  list=[];selected=null;el("slot").value="";
  show("loadError",T("loadFail"),"error");
  renderSlots();
 }
}
document.querySelectorAll("[data-lang]").forEach(b=>b.addEventListener("click",()=>{lang=b.dataset.lang;translate();}));
service.addEventListener("change",()=>{selected=null;el("slot").value="";day.value="";const next=list.find(s=>s.service_code===service.value);if(next)day.value=dateParts(next.starts_at);renderSlots();});
day.addEventListener("change",()=>{selected=null;el("slot").value="";renderSlots();});
el("subject").addEventListener("change",()=>{el("selectedSubject").value=el("subject").value;});
booking.addEventListener("submit",async event=>{
 event.preventDefault();
 const file=el("receipt").files?.[0];
 if(!selected||!booking.checkValidity()||!file||file.size>4*1024*1024||file.type!=="application/pdf"){
  booking.reportValidity();show("result",T("invalid"),"error");return;
 }
 el("send").disabled=true;show("result",T("statusSubmitting"));
 el("selectedSubject").value=el("subject").value;
 const payload=new FormData(booking);
 try{
  const res=await fetch(API,{method:"POST",body:payload,cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(res.status===409){show("result",T("slotTaken"),"error");await refresh();return;}
  if(!res.ok||!data.ok||!data.reference)throw Error("failed");
  show("result",T("success").replace("{id}",data.reference),"ok");
  el("send").disabled=true;
  booking.querySelectorAll("input,textarea").forEach(e=>{if(e.id!=="requestId")e.disabled=true;});
 }catch{show("result",T("failed"),"error");el("send").disabled=!selected;}
});
el("selectedSubject").value=el("subject").value;
el("requestId").value=crypto.randomUUID();
const queryLang=new URLSearchParams(location.search).get("lang");
lang=Object.prototype.hasOwnProperty.call(copy,queryLang)?queryLang:"en";
translate();refresh();
