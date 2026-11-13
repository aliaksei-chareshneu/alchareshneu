/* IMPERION Academy private checkout. Client never confirms payment or event availability. */
(function(){
'use strict';
const API='https://cmrknyhnnehyjpreehcf.supabase.co/functions/v1/imperion-academy-checkout';
const c=window.ImperionAcademyCatalog;if(!c)return;
const qs=new URLSearchParams(location.search),languages=['cs','en','ru','uk'];
const lang=languages.includes(qs.get('lang'))?qs.get('lang'):'cs';
document.documentElement.lang=lang;
const $=id=>document.getElementById(id);
const TEXT={
cs:{
 heading:'Vyberte službu a požádejte o termín',lead:'Vyberte konkrétní službu, požadovaný čas a popište svůj cíl. Jde o nezávaznou žádost, nikoli rezervaci. Bankovní údaje a konečnou cenu zveřejníme pouze po písemném schválení nabídky pro konkrétního klienta.',
 serviceHeading:'Vaše objednávka',service:'Služba',variant:'Varianta služby',price:'Předběžná veřejná cena',schedule:'Požádejte o čas',scheduleNote:'Zatím jde o vámi navržený čas, NIKOLI o ověřené volné místo. Přesný termín potvrdíme podle obsazenosti pracovního kalendáře a povinností.',date:'Požadované datum',time:'Požadovaný začátek',zone:'Časy jsou uvedeny pro Brno · Europe/Prague. Délka standardně 60 minut, ostatní podle nabídky.',
 details:'Kontaktní údaje a cíl',name:'Jméno',email:'E-mail',goal:'Co se chcete naučit nebo vyřešit?',goalPlace:'Např.: příprava na CERMAT z matematiky, 8. ročník; termín v prosinci.',
 adult:'Jsem plnoletý/á nebo jsem zákonný zástupce účastníka.',privacy:'Přečetl(a) jsem informace o zpracování osobních údajů.',privacyLink:'Soukromí a důkazy o platbě',
 submit:'Odeslat nezávaznou objednávku',sending:'Odesílání…',legal:'Odeslání neposkytuje rezervaci ani platební povinnost. OSVČ Aliaksei Chareshneu, IČO 23041625. Družina Moravy z. s. je samostatná organizace.',
 success:'Poptávka byla přijata. Uložte si číslo a soukromý pokračovací kód. Bez nich nelze bezpečně znovu otevřít schválené platební údaje.',orderRef:'Číslo žádosti',orderCode:'Pokračovací kód — uchovejte soukromě',copy:'Zkopírovat oba údaje',copied:'Zkopírováno',duplicate:'Tento požadavek už byl doručen. Použijte původní číslo a kód.',error:'Žádost se nepodařilo ověřit. Zkontrolujte údaje nebo zkuste znovu.',
 statusHeading:'Nabídka, platba a stav',statusLead:'Teprve po schválení přesného rozsahu a účtu poskytovatele se zde zobrazí platební údaje. Nahraný doklad není potvrzením připsání peněz.',reference:'Číslo žádosti',statusEmail:'Stejný e-mail jako v objednávce',code:'Soukromý pokračovací kód',check:'Ověřit nabídku a stav',checking:'Ověřuji…',review:'Poptávka čeká na individuální kontrolu. Zatím nic neplaťte.',proofReceived:'Doklad přijat k prověření. Platba a termín nejsou ještě potvrzeny.',verified:'Příjem peněz byl ověřen oprávněnou osobou; datum účasti se potvrzuje odděleně.',confirmed:'Příjem peněz a termín byly samostatně potvrzeny.',quoteHeading:'Schválená platební nabídka',amount:'Celkem',payee:'Příjemce',bank:'Bankovní účet',message:'Variabilní identifikace',quoteWarning:'Plaťte pouze na účet zde uvedeného smluvního poskytovatele a s tímto identifikátorem. Před platbou zkontrolujte datum a schválený rozsah. Neodesílejte výpis jiných transakcí.',
 proof:'Připojit potvrzení bankovního převodu',proofHelp:'PDF, PNG nebo JPG, maximálně 2 MB. Přebytečné osobní údaje začerněte. Soubor je uložen soukromě; jeho nahrání samo neznamená platbu.',proofButton:'Odeslat doklad k ověření',proofSending:'Nahrávám…',proofBad:'Použijte PDF, PNG nebo JPG do 2 MB.',
 stepsHeading:'Jak probíhá objednávka',steps:['Vyberte konkrétní službu a navrhněte čas.','Obdržíte číslo a soukromý kód, nikoli potvrzení rezervace.','Po kontrole rozsahu dostanete přesnou nabídku s účtem správného poskytovatele.','Po převodu můžete nahrát doklad, ale platbu uznáme až po ověření v bance.','Konečné místo a čas potvrdí pořadatel samostatně.'],
 back:'Zpět do Akademie',custom:'Jiný dotaz přes WhatsApp ↗',invalid:'Vyplňte všechny potřebné údaje včetně souhlasu a zvolte budoucí datum.',invalidTime:'Vybraný čas není platný nebo již uplynul.',noBooking:'Čas není rezervovaný.'
},
en:{
 heading:'Choose a service and request a time',lead:'Choose a specific service, propose a time and describe your goal. This is an enquiry, not a booking. The exact price and recipient account are provided only after a written quote is approved for you.',
 serviceHeading:'Your request',service:'Service',variant:'Service format',price:'Indicative public rate',schedule:'Propose a time',scheduleNote:'This is your preferred time, NOT a verified free slot. The host must check the working calendar and other commitments before confirming.',date:'Preferred date',time:'Preferred start',zone:'Times are in Brno · Europe/Prague. Normally 60 minutes; other formats are quoted separately.',
 details:'Contact and learning goal',name:'Name',email:'Email',goal:'What would you like to learn or solve?',goalPlace:'For example: maths entrance exam preparation, grade 8, in December.',
 adult:'I am an adult or the participant’s legal guardian.',privacy:'I have read the information on personal data processing.',privacyLink:'Privacy and payment evidence',
 submit:'Send a non-binding order request',sending:'Sending…',legal:'Submitting a request does not reserve a slot or create a payment obligation. Seller: Aliaksei Chareshneu OSVČ, IČO 23041625. Družina Moravy z. s. is separate.',
 success:'Request received. Save your reference and private continuation code. Both are needed to reopen an approved quote.',orderRef:'Reference',orderCode:'Private continuation code — keep safe',copy:'Copy reference and code',copied:'Copied',duplicate:'This request is already recorded. Use your previous reference and code.',error:'Could not process the request. Check the fields and try again.',
 statusHeading:'Quote, payment and status',statusLead:'Bank details are shown only after the service, payee and exact price are approved. A bank transfer image is not proof of cleared funds.',reference:'Request reference',statusEmail:'Same email as in your request',code:'Private continuation code',check:'Check offer and status',checking:'Checking…',review:'Awaiting individual review. Do not make a transfer yet.',proofReceived:'Evidence received for review; payment and booking are not confirmed.',verified:'The owner has verified funds received; the time is separately confirmed.',confirmed:'Funds and appointment confirmed separately.',quoteHeading:'Approved payment quote',amount:'Exact amount',payee:'Legal payee',bank:'Bank account',message:'Payment reference',quoteWarning:'Transfer only to the named legal seller and use this reference. Confirm your agreed scope and time before paying. Redact unrelated banking information.',
 proof:'Attach bank transfer evidence',proofHelp:'PDF, PNG or JPG up to 2 MB. Redact unrelated transactions. Stored privately; uploading is not bank verification.',proofButton:'Submit evidence for review',proofSending:'Uploading…',proofBad:'Please use PDF, PNG or JPG, maximum 2 MB.',
 stepsHeading:'How it works',steps:['Select a service and propose a time.','Keep the reference and private continuation code; no booking yet.','The seller checks the scope and provides approved payment details.','Upload proof after transfer; only a bank reconciliation verifies payment.','A booking is confirmed separately.'],
 back:'Back to Academy',custom:'Different question via WhatsApp ↗',invalid:'Fill in all required fields and select a future time.',invalidTime:'This time is invalid or has already passed.',noBooking:'No slot is reserved.'
},
ru:{
 heading:'Выберите услугу и запросите время',lead:'Выберите конкретную программу, предложите время и опишите свою задачу. Это запрос, а не подтверждённая бронь. Итоговую стоимость и реквизиты покажем только после письменного согласования предложения.',
 serviceHeading:'Ваш заказ',service:'Услуга',variant:'Формат',price:'Предварительная цена',schedule:'Предложите время',scheduleNote:'Пока это желаемое время, а НЕ проверенный свободный слот. Сначала сверим рабочий календарь и другие обязательства, затем подтвердим доступность.',date:'Желаемая дата',time:'Желаемое начало',zone:'Время Брно · Europe/Prague. Стандартно 60 минут; другие форматы согласуем отдельно.',
 details:'Контакты и задача',name:'Имя',email:'Электронная почта',goal:'Какую задачу нужно решить?',goalPlace:'Например: математика для поступления в вуз; физика в университете; фитнес для новичка.',
 adult:'Я совершеннолетний(-яя) или законный представитель участника.',privacy:'Я ознакомился(-лась) с информацией об обработке данных.',privacyLink:'Приватность и подтверждение оплаты',
 submit:'Отправить заявку на заказ',sending:'Отправка…',legal:'Заявка не бронирует время и не обязывает платить. Продавец: OSVČ Aliaksei Chareshneu, IČO 23041625. Družina Moravy z. s. — отдельная организация.',
 success:'Заявка получена. Сохраните номер и личный код продолжения. Они нужны, чтобы безопасно открыть согласованные реквизиты.',orderRef:'Номер заявки',orderCode:'Личный код продолжения — сохраните приватно',copy:'Скопировать номер и код',copied:'Скопировано',duplicate:'Такая заявка уже есть. Используйте прежний номер и код.',error:'Не удалось обработать запрос. Проверьте данные или попробуйте снова.',
 statusHeading:'Предложение, оплата и статус',statusLead:'Реквизиты открываются только после согласования конкретной суммы и правильного получателя. Скриншот перевода сам по себе не доказывает поступление денег.',reference:'Номер заявки',statusEmail:'Та же почта, что в заявке',code:'Личный код продолжения',check:'Проверить предложение и статус',checking:'Проверяем…',review:'Заявка ожидает индивидуальной проверки. Пока ничего не переводите.',proofReceived:'Подтверждение получено для проверки. Поступление денег и время ещё не подтверждены.',verified:'Поступление денег проверено владельцем, время подтверждается отдельно.',confirmed:'Поступление денег и время подтверждены отдельно.',quoteHeading:'Согласованные реквизиты',amount:'Точная сумма',payee:'Получатель',bank:'Счёт',message:'Назначение платежа',quoteWarning:'Переводите деньги только указанному продавцу с правильным назначением. Проверьте согласованные время и объём. Скрывайте сведения о посторонних платежах.',
 proof:'Прикрепить подтверждение банковского перевода',proofHelp:'PDF, PNG или JPG до 2 МБ. Скройте посторонние операции. Файл хранится закрыто; загрузка не означает поступления денег.',proofButton:'Отправить подтверждение на проверку',proofSending:'Загружаем…',proofBad:'Разрешены PDF, PNG и JPG размером до 2 МБ.',
 stepsHeading:'Как это устроено',steps:['Выберите услугу и предложите время.','Получите номер и личный код: запись пока не подтверждена.','После проверки условий получите точную сумму и счёт правильного продавца.','Приложите подтверждение перевода; получение денег проверяется отдельно по банку.','Дату и время организатор подтверждает отдельно.'],
 back:'Вернуться в Академию',custom:'Другая задача — WhatsApp ↗',invalid:'Заполните обязательные поля, отметки и укажите время в будущем.',invalidTime:'Выбранное время недоступно для запроса или уже прошло.',noBooking:'Время пока не забронировано.'
},
uk:{
 heading:'Оберіть послугу та запропонуйте час',lead:'Оберіть конкретну послугу, час і опишіть свою мету. Це звернення, а не бронювання. Остаточну ціну та реквізити надамо лише після письмового погодження пропозиції.',
 serviceHeading:'Ваше замовлення',service:'Послуга',variant:'Формат',price:'Попередня ціна',schedule:'Запропонуйте час',scheduleNote:'Це бажаний час, а НЕ перевірений вільний слот. Спочатку звіримо робочий календар та зобов’язання, потім підтвердимо доступність.',date:'Бажана дата',time:'Бажаний початок',zone:'Час Брно · Europe/Prague. Зазвичай 60 хвилин; інші формати погоджуються окремо.',
 details:'Контакти й мета',name:'Ім’я',email:'Електронна пошта',goal:'Яку проблему потрібно вирішити?',goalPlace:'Наприклад: математика для вступу; фізика в університеті; фітнес для початківця.',
 adult:'Я повнолітній(-ня) або законний представник учасника.',privacy:'Я ознайомився(-лась) із правилами обробки персональних даних.',privacyLink:'Приватність і підтвердження оплати',
 submit:'Надіслати запит на замовлення',sending:'Надсилаємо…',legal:'Звернення не бронює час і не зобов’язує платити. Продавець: OSVČ Aliaksei Chareshneu, IČO 23041625. Družina Moravy z. s. — окрема організація.',
 success:'Запит отримано. Збережіть номер і приватний код продовження. Вони потрібні для перевірки погоджених реквізитів.',orderRef:'Номер заявки',orderCode:'Приватний код продовження — збережіть',copy:'Скопіювати номер і код',copied:'Скопійовано',duplicate:'Цей запит уже збережено. Використовуйте попередній номер і код.',error:'Не вдалося обробити звернення. Перевірте дані або повторіть спробу.',
 statusHeading:'Пропозиція, оплата і статус',statusLead:'Реквізити видно лише після погодження суми та правильного отримувача. Фото переказу не підтверджує зарахування грошей.',reference:'Номер звернення',statusEmail:'Та сама адреса, що у зверненні',code:'Приватний код продовження',check:'Перевірити пропозицію і статус',checking:'Перевіряємо…',review:'Запит очікує індивідуальної перевірки. Поки нічого не сплачуйте.',proofReceived:'Документ отримано на перевірку. Оплата й час ще не підтверджені.',verified:'Власник перевірив надходження грошей; час підтверджується окремо.',confirmed:'Надходження грошей і час підтверджені окремо.',quoteHeading:'Погоджені реквізити',amount:'Точна сума',payee:'Отримувач',bank:'Рахунок',message:'Призначення',quoteWarning:'Переказуйте кошти лише зазначеному продавцю та з правильним призначенням. Перевірте погоджений обсяг і час. Приховайте сторонні транзакції.',
 proof:'Додати підтвердження банківського переказу',proofHelp:'PDF, PNG або JPG до 2 МБ. Приховайте сторонні операції. Файл зберігається приватно; завантаження не є банківською перевіркою.',proofButton:'Надіслати документ на перевірку',proofSending:'Завантажуємо…',proofBad:'Дозволені PDF, PNG та JPG до 2 МБ.',
 stepsHeading:'Як працює замовлення',steps:['Оберіть послугу і запропонуйте час.','Збережіть номер і приватний код; бронювання ще немає.','Після перевірки отримаєте погоджену суму та рахунок належного продавця.','Додайте документ переказу, але оплату перевірять окремо в банку.','Дату й час організатор підтвердить окремо.'],
 back:'До Академії',custom:'Інше питання через WhatsApp ↗',invalid:'Заповніть обов’язкові поля, згоду та майбутній час.',invalidTime:'Обраний час некоректний або вже минув.',noBooking:'Час ще не заброньовано.'
}
};
const t=TEXT[lang],labels={
 aoHeading:'heading',aoLead:'lead',aoServiceHeading:'serviceHeading',aoServiceLabel:'service',aoVariantLabel:'variant',
 aoPriceLabel:'price',aoScheduleHeading:'schedule',aoScheduleNote:'scheduleNote',aoDateLabel:'date',
 aoTimeLabel:'time',aoZone:'zone',aoDetailsHeading:'details',aoNameLabel:'name',aoEmailLabel:'email',
 aoGoalLabel:'goal',aoAdultLabel:'adult',aoPrivacyLabel:'privacy',aoPrivacyLink:'privacyLink',
 aoSubmit:'submit',aoLegalNote:'legal',aoStatusHeading:'statusHeading',aoStatusLead:'statusLead',
 aoRefLabel:'reference',aoEmailStatusLabel:'statusEmail',aoTokenLabel:'code',aoStatusButton:'check',
 aoQuoteHeading:'quoteHeading',aoAmountLabel:'amount',aoPayeeLabel:'payee',aoAccountLabel:'bank',
 aoMessageLabel:'message',aoQuoteWarning:'quoteWarning',aoProofLabel:'proof',aoProofNote:'proofHelp',
 aoProofButton:'proofButton',aoStepsHeading:'stepsHeading',aoBack:'back',aoCustom:'custom'
};
for(const [id,key] of Object.entries(labels))$(id).textContent=t[key];
$('aoGoal').placeholder=t.goalPlace;
$('aoPrivacyLink').href='privacy.html?lang='+lang;
$('aoBack').href='../?lang='+lang;
$('aoCustom').href='https://wa.me/420702914842?text='+encodeURIComponent(t.custom);
document.querySelectorAll('.ao-lang a').forEach(a=>a.setAttribute('aria-current',String(a.dataset.lang===lang)));
const steps=$('aoSteps');t.steps.forEach(s=>{const li=document.createElement('li');li.textContent=s;steps.append(li)});
const service=$('aoService'),variant=$('aoVariant');
c.services.forEach(x=>{const o=document.createElement('option');o.value=x.id;o.textContent=x.names[lang];service.append(o)});
const initial=qs.get('service');service.value=c.find(initial)?initial:'czech';
const requestedVariant=/^v[1-3]$/.test(qs.get('variant')||'')?qs.get('variant'):'v1';
function renderVariants(initialValue){
 const sel=c.find(service.value);if(!sel)return;
 const names=c.copies[lang].formats[sel.category]||[];
 variant.replaceChildren();names.forEach((s,i)=>{const o=document.createElement('option');o.value='v'+(i+1);o.textContent=s;variant.append(o)});
 variant.value=initialValue||'v1';renderPrice();
}
function renderPrice(){
 const p=c.info(service.value,variant.value,lang);
 $('aoPrice').textContent=p.label;
 $('aoPriceNote').textContent=p.exact?t.provisional:t.provisional;
}
service.addEventListener('change',()=>renderVariants('v1'));
variant.addEventListener('change',renderPrice);
renderVariants(requestedVariant);
function pragueDate(iso){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
function parts(d){const r={};new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).forEach(x=>r[x.type]=x.value);return r;}
function pragueLocalISO(day,time){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!/^\d{2}:\d{2}$/.test(time))return '';
 const [y,m,d]=day.split('-').map(Number),[h,n]=time.split(':').map(Number);
 if(!Number.isInteger(y)||m<1||m>12||d<1||d>31||h<0||h>23||n<0||n>59)return '';
 for(const offset of [1,2]){
  const date=new Date(Date.UTC(y,m-1,d,h-offset,n));
  const p=parts(date);
  if(Number(p.year)===y&&Number(p.month)===m&&Number(p.day)===d&&Number(p.hour)===h&&Number(p.minute)===n)return date.toISOString();
 }
 return '';
}
const today=new Date();
$('aoDate').min=pragueDate(today);
$('aoDate').max=pragueDate(new Date(Date.now()+89*86400000));
$('aoTime').append(new Option('—',''));
for(let hour=9;hour<=20;hour++){for(const minute of [0,30]){if(hour===20&&minute)continue;const val=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');$('aoTime').append(new Option(val,val))}}
let lastReference='',lastCode='';
function showResult(message){
 const div=$('aoResult');div.replaceChildren();div.hidden=false;
 const p=document.createElement('p');p.textContent=message;div.append(p);
}
function fillStatus(){
 $('aoReference').value=lastReference;$('aoContinuationCode').value=lastCode;$('aoEmailStatus').value=$('aoEmail').value.trim();
}
$('aoOrder').addEventListener('submit',async event=>{
 event.preventDefault();
 const date=pragueLocalISO($('aoDate').value,$('aoTime').value),name=$('aoName').value.trim(),email=$('aoEmail').value.trim();
 if(!name||name.length<2||!email||!$('aoEmail').checkValidity()||!$('aoGoal').value.trim()||!$('aoAdult').checked||!$('aoPrivacy').checked||!date){
   showResult(t.invalid);return;
 }
 if(Date.parse(date)<Date.now()||Date.parse(date)>Date.now()+90*86400000){showResult(t.invalidTime);return;}
 const btn=$('aoSubmit');btn.disabled=true;btn.textContent=t.sending;
 try{
  const body={action:'order',serviceKey:service.value,serviceVariant:variant.value,requestedSession:date,firstName:name,
   email,goal:$('aoGoal').value.trim(),locale:lang,privacyAcknowledged:true,adultOrGuardianConfirmed:true,
   website:$('aoWebsite').value,
   utmSource:(qs.get('utm_source')||'').slice(0,64),
   utmMedium:(qs.get('utm_medium')||'').slice(0,64),
   utmCampaign:(qs.get('utm_campaign')||'').slice(0,64)};
  const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await resp.json();
  if(!resp.ok||!data.ok)throw Error(data.error||'invalid_request');
  if(data.duplicate||data.status==='DUPLICATE_ENQUIRY'){showResult(t.duplicate);return;}
  lastReference=String(data.reference||'');lastCode=String(data.continuationCode||'');
  showResult(t.success);
  const div=$('aoResult');
  for(const [label,value] of [[t.orderRef,lastReference],[t.orderCode,lastCode]]){
    const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label;
    const code=document.createElement('span');code.className='ao-saved-code';code.textContent=value;
    p.append(strong,code);div.append(p);
  }
  const copy=document.createElement('button');copy.type='button';copy.className='ao-secondary ao-followup';copy.textContent=t.copy;
  copy.addEventListener('click',async()=>{
   const text=t.orderRef+': '+lastReference+'\n'+t.orderCode+': '+lastCode;
   try{if(navigator.clipboard)await navigator.clipboard.writeText(text);else throw Error('clipboard');
       copy.textContent=t.copied;}catch{copy.textContent=t.copy;}
  });div.append(copy);
  fillStatus();
 }catch(e){showResult(t.error+' ('+String(e.message||e).slice(0,60)+')');}
 finally{btn.disabled=false;btn.textContent=t.submit}
});
$('aoStatusForm').addEventListener('submit',async event=>{event.preventDefault();await checkStatus()});
async function checkStatus(){
 const reference=$('aoReference').value.trim(),email=$('aoEmailStatus').value.trim(),continuationCode=$('aoContinuationCode').value.trim();
 if(!reference||!email||!continuationCode){$('aoStatusResult').textContent=t.invalid;return;}
 const btn=$('aoStatusButton');btn.disabled=true;btn.textContent=t.checking;
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'status',reference,email,continuationCode})});
  const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'unavailable');
  const quote=$('aoQuote'),proof=$('aoProofForm');
  const show=!!data.quoteApproved;
  quote.hidden=!show;proof.hidden=!data.proofRequired;
  if(show){
   $('aoAmount').textContent=String(data.amountCzk)+' Kč';
   $('aoPayee').textContent=String(data.payee||'');
   $('aoAccount').textContent=String(data.bankAccount||'');
   $('aoPaymentMessage').textContent=String(data.paymentMessage||'');
  }
  if(data.bookingConfirmed)$('aoStatusResult').textContent=t.confirmed;
  else if(data.bankVerified)$('aoStatusResult').textContent=t.verified;
  else if(data.evidenceReceived)$('aoStatusResult').textContent=t.proofReceived;
  else $('aoStatusResult').textContent=t.review;
 }catch(e){$('aoQuote').hidden=true;$('aoStatusResult').textContent=t.error+' ('+String(e.message||e).slice(0,80)+')';}
 finally{btn.disabled=false;btn.textContent=t.check}
}
$('aoProofForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const file=$('aoProof').files?.[0];
 if(!file||file.size<100||file.size>2097152||!/\.(pdf|png|jpg|jpeg)$/i.test(file.name)){
  $('aoStatusResult').textContent=t.proofBad;return;
 }
 const btn=$('aoProofButton');btn.disabled=true;btn.textContent=t.proofSending;
 const data=new FormData();
 data.append('reference',$('aoReference').value.trim());data.append('email',$('aoEmailStatus').value.trim());
 data.append('continuationCode',$('aoContinuationCode').value.trim());data.append('paymentProof',file,file.name);
 try{
  const resp=await fetch(API,{method:'POST',body:data});const result=await resp.json();
  if(!resp.ok||!result.ok)throw Error(result.error||'failed');
  $('aoStatusResult').textContent=t.proofReceived;
  $('aoProofForm').hidden=true;$('aoProof').value='';
 }catch(e){$('aoStatusResult').textContent=t.error+' ('+String(e.message||e).slice(0,80)+')';}
 finally{btn.disabled=false;btn.textContent=t.proofButton}
});
})();