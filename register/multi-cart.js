/* Multi-event form enhancement. Reuses the existing calendar, API, safety form and QR vendor.
 * Never adds a payee to a different legal seller's transfer. */
(function(){
'use strict';
const byId=id=>document.getElementById(id);
const selected=new Set(),tiers=new Map();
let cartReceipt=null,cartQuote=null;
const MAX=8;
const copy={
 cs:{title:'Vybrané akce',hint:'Kliknutím na další termín v kalendáři jej přidáte. Nejvýše 8 akcí.',empty:'Vyberte termín v kalendáři.',remove:'Odebrat',std:'Standard',senior:'Senior (jen po ověření)',total:'Orientační součet',perSeller:'Organizátor',tentative:'Konečná cena a platba až po schválení. Přihláška není místo.',payees:'Různí příjemci = samostatné platby.',single:'Jedna platba je možná jen u stejného schváleného příjemce.',submit:'Odeslat {n} přihlášky →',pending:'Zatím nezaplaceno, místa nejsou potvrzena.',ok:'Přijali jsme {n} žádosti. Není to rezervace ani zaplacená účast.',save:'Uložte si soukromé kódy; po opuštění stránky je znovu nezobrazíme.',id:'Číslo společné žádosti',token:'Soukromý kód košíku',individual:'Kód k jednotlivé akci',copy:'Kopírovat všechny kódy',copied:'Zkopírováno',resume:'Obnovit platbu za košík',check:'Zkontrolovat schválenou souhrnnou platbu',quotePending:'Souhrnnou platbu zatím nelze vystavit. Počkejte na písemné schválení; nic neposílejte.',accept:'Souhlasím s osobní službou Aliakseie Chareshneua (OSVČ), nikoli s platbou členských příspěvků Družiny Moravy.',bank:'Potvrzené údaje pro JEDNU platbu',proof:'Přiložit PDF doklad o převodu (max. 5 MB)',sendProof:'Odeslat doklad na kontrolu',proofSaved:'PDF přijat. Připsání v bance a místo nejsou potvrzeny.',status:'Ověřit stav (ručně)',error:'Nepodařilo se potvrdit přijetí. Neposílejte znovu naslepo; kontaktujte pořadatele.',noMultiple:'Platba za různé právní subjekty nesmí být sloučena.',priceChanged:'Cena nebo stav termínu se změnily; požádejte o nové potvrzení.',free:'Zdarma',unknown:'Cena k ověření'},
 en:{title:'Selected events',hint:'Click another calendar date to add it. Up to 8 events.',empty:'Choose a date in the calendar.',remove:'Remove',std:'Standard',senior:'Senior (approval needed)',total:'Indicative total',perSeller:'Provider',tentative:'Final price and payment require approval. An RSVP is not a booked seat.',payees:'Different legal payees require separate payments.',single:'One transfer is possible only for an approved single legal payee.',submit:'Submit {n} event requests →',pending:'Unpaid; places not confirmed.',ok:'We received {n} requests. This is not a booking or proof of payment.',save:'Save your private codes: they cannot be displayed again after you leave.',id:'Combined request ID',token:'Private cart code',individual:'Individual event code',copy:'Copy all codes',copied:'Copied',resume:'Continue an existing cart payment',check:'Check approved combined payment',quotePending:'Combined payment is not available yet. Wait for written approval; do not transfer funds.',accept:'I agree to purchase the separate personal service from Aliaksei Chareshneu (OSVČ), not association membership.',bank:'Approved details for ONE transfer',proof:'Attach transfer PDF (max. 5 MB)',sendProof:'Submit PDF for review',proofSaved:'PDF received. Bank settlement and seats remain unconfirmed.',status:'Check status (manually)',error:'Receipt could not be verified. Do not retry blindly; contact the organiser.',noMultiple:'Different legal entities cannot share a bank transfer.',priceChanged:'Price or availability changed; request approval again.',free:'Free',unknown:'Price to confirm'},
 ru:{title:'Выбранные мероприятия',hint:'Нажимайте другие даты в календаре — они добавятся. До 8 событий.',empty:'Выберите дату в календаре.',remove:'Удалить',std:'Обычный',senior:'Senior (после проверки)',total:'Предварительная сумма',perSeller:'Организатор',tentative:'Окончательная цена и оплата — после согласования. Заявка не резервирует место.',payees:'Разные юридические получатели — разные платежи.',single:'Один перевод возможен только одному согласованному получателю.',submit:'Отправить {n} заявки →',pending:'Не оплачено; места не подтверждены.',ok:'Получено {n} заявок. Это ещё не бронь и не оплата.',save:'Сохраните личные коды: после закрытия страницы они повторно не показываются.',id:'Номер общей заявки',token:'Личный код корзины',individual:'Код отдельного мероприятия',copy:'Скопировать все коды',copied:'Скопировано',resume:'Вернуться к оплате корзины',check:'Проверить согласованную общую оплату',quotePending:'Общая оплата пока не разрешена. Дождитесь письменного согласования; деньги не переводите.',accept:'Я согласен на отдельную личную услугу Aliaksei Chareshneu (OSVČ), а не на оплату членства Družina Moravy.',bank:'Проверенные реквизиты для ОДНОГО перевода',proof:'Приложить PDF перевода (макс. 5 МБ)',sendProof:'Отправить PDF на проверку',proofSaved:'PDF принят. Поступление денег в банк и место пока не подтверждены.',status:'Проверить статус вручную',error:'Не удалось проверить получение. Не отправляйте заявку повторно вслепую — свяжитесь с организатором.',noMultiple:'Нельзя смешивать платежи разных юридических лиц.',priceChanged:'Изменились цена или статус мероприятия — запросите подтверждение.',free:'Бесплатно',unknown:'Цена уточняется'},
 uk:{title:'Вибрані події',hint:'Натискайте інші дати в календарі для додавання. До 8 подій.',empty:'Оберіть дату в календарі.',remove:'Прибрати',std:'Звичайний',senior:'Senior (після перевірки)',total:'Попередня сума',perSeller:'Організатор',tentative:'Остаточна ціна й оплата після погодження. Заявка не бронює місце.',payees:'Різні юридичні отримувачі — різні платежі.',single:'Один переказ лише одному погодженому отримувачу.',submit:'Надіслати {n} заявки →',pending:'Не сплачено; місця не підтверджено.',ok:'Отримано {n} заявок. Це не бронювання чи оплата.',save:'Збережіть приватні коди: після виходу їх не покажемо знову.',id:'Номер спільної заявки',token:'Приватний код кошика',individual:'Код окремої події',copy:'Копіювати всі коди',copied:'Скопійовано',resume:'Продовжити оплату кошика',check:'Перевірити погоджену спільну оплату',quotePending:'Спільна оплата поки недоступна. Дочекайтеся письмового погодження; не переказуйте кошти.',accept:'Погоджуюся на окрему послугу Aliaksei Chareshneu (OSVČ), а не сплату членства Družina Moravy.',bank:'Погоджені реквізити для ОДНОГО переказу',proof:'Додати PDF переказу (до 5 МБ)',sendProof:'Надіслати PDF на перевірку',proofSaved:'PDF отримано. Банк та місця ще не підтверджені.',status:'Перевірити стан вручну',error:'Не вдалося перевірити отримання. Не надсилайте заявку повторно без перевірки; зверніться до організатора.',noMultiple:'Не можна об’єднувати платежі різних юридичних осіб.',priceChanged:'Ціна чи доступність змінилися; отримайте нове погодження.',free:'Безкоштовно',unknown:'Ціну уточнюють'}
};
const lang=()=>['cs','en','ru','uk'].includes(document.documentElement.lang)?document.documentElement.lang:'cs';
const C=()=>copy[lang()];
const money=n=>new Intl.NumberFormat(lang()==='cs'?'cs-CZ':'en-GB',{maximumFractionDigits:2}).format(n)+' Kč';
const eventById=id=>typeof events!=='undefined'?events.find(e=>e.event_id===id):null;
const bookable=e=>e&&typeof eventMode==='function'&&eventMode(e)==='FORM';
const price=e=>{if(!e?.price_verified)return null;let t=tiers.get(e.event_id)||'STANDARD';
 const q=e.trainingPayment?.tiers?.find(x=>x.tier===t);
 if(e.event_id==='PUB-WALK-20261129'&&Date.now()>Date.parse('2026-11-27T15:30:00+01:00'))return 237.5;
 return Number.isFinite(Number(q?.totalCzk))?Number(q.totalCzk):Number.isFinite(Number(e.price_czk))?Number(e.price_czk):null;};
const elt=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const btn=(name,click)=>{const e=elt('button','retry',name);e.type='button';e.addEventListener('click',click);return e;};
const box=elt('section','imperion-cart');box.id='imperionMultiCart';
const heading=elt('h3','',C().title),help=elt('p','catalog-summary',C().hint);
const list=elt('div','cart-items'),totals=elt('div','cart-totals'),explain=elt('p','catalog-summary');
const resume=elt('details','cart-resume'),resTitle=elt('summary','',C().resume);
const resumeId=elt('input');resumeId.type='text';resumeId.placeholder=C().id;resumeId.autocomplete='off';
const resumeToken=elt('input');resumeToken.type='text';resumeToken.placeholder=C().token;resumeToken.autocomplete='off';
const accepted=elt('label','cart-consent');const approved=elt('input');approved.type='checkbox';
const acceptText=elt('span','',C().accept);accepted.append(approved,acceptText);
const controls=elt('div','cart-controls');controls.append(resumeId,resumeToken);
const check=btn(C().check,()=>getQuote());controls.append(check);
resume.append(resTitle,controls);
box.append(heading,help,list,totals,explain,accepted,resume);
const style=elt('style');style.textContent=`
.imperion-cart{margin:18px 0;padding:16px;border:1px solid #5d7d7b;border-radius:16px;background:#101f2af2;color:#f2f5ee}
.imperion-cart h3{margin:0 0 8px;font-size:1.2rem}.imperion-cart .cart-items{display:grid;gap:8px;margin:12px 0}
.imperion-cart .cart-item{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:9px;border:1px solid #425861;border-radius:9px}
.imperion-cart .cart-name{flex:1 1 190px;font-size:.9rem}.imperion-cart select{max-width:170px;min-height:40px;background:#0c202b;color:#fff;border:1px solid #759096;border-radius:7px}
.imperion-cart button{min-height:40px}.imperion-cart .cart-totals{font-size:.9rem;overflow-wrap:anywhere}
.imperion-cart .cart-consent{display:none;margin:12px 0;font-size:.9rem;gap:8px;align-items:start}
.imperion-cart .cart-consent input{margin-top:3px}.imperion-cart .cart-resume{margin:12px 0}
.imperion-cart .cart-resume summary{cursor:pointer;font-weight:650}.imperion-cart .cart-controls{display:grid;gap:8px;margin-top:10px}
.imperion-cart .cart-controls input{width:100%;min-width:0;min-height:42px;background:#0c202b;color:#fff;border:1px solid #759096;border-radius:8px;padding:8px}
.imperion-cart .cart-totals p{margin:4px 0}.cart-receipt{overflow-wrap:anywhere}.cart-receipt code{display:block;overflow-wrap:anywhere;margin:6px 0;padding:8px;border-radius:8px;background:#182b34}
.cart-receipt button{display:inline-block;margin:6px 4px 6px 0}.cart-bank{margin:16px 0;padding:12px;border:1px solid #549f8b;border-radius:12px;overflow-wrap:anywhere}
.cart-bank input[type=file]{width:100%;margin:9px 0}.cart-bank .cart-qr{padding:10px;background:white;display:inline-block;max-width:100%}
@media(max-width:520px){.imperion-cart{padding:12px}.cart-receipt code{font-size:.75rem}}
`;
document.head.append(style);
const layout=byId('rsvpForm')?.querySelector('.event-selection-layout');
if(!layout)return;
layout.after(box);
function currentEvents(){return [...selected].map(eventById).filter(bookable);}
function render(){
 const c=C();heading.textContent=c.title;help.textContent=c.hint;resTitle.textContent=c.resume;
 resumeId.placeholder=c.id;resumeToken.placeholder=c.token;check.textContent=c.check;acceptText.textContent=c.accept;
 const all=currentEvents();list.replaceChildren();totals.replaceChildren();
 for(const e of all){
   const line=elt('div','cart-item'),name=elt('span','cart-name',eventDate(e)+' · '+eventTitle(e));
   line.append(name);
   if(e.category==='HEMA Training'&&Number(e.price_czk)>0){
     const select=elt('select');select.setAttribute('aria-label',eventTitle(e)+' price tier');
     for(const [tier,title] of [['STANDARD',c.std],['SENIOR',c.senior]]){
       const op=elt('option','',title);op.value=tier;select.append(op);
     }
     select.value=tiers.get(e.event_id)||'STANDARD';
     select.addEventListener('change',()=>{tiers.set(e.event_id,select.value);render();});
     line.append(select);
   }
   const amt=price(e);line.append(elt('span','cart-price',amt===0?c.free:amt===null?c.unknown:money(amt)));
   line.append(btn(c.remove,()=>{
     selected.delete(e.event_id);tiers.delete(e.event_id);
     const next=currentEvents()[0];
     if(next && next.event_id!==byId('eventId')?.value && typeof window.chooseEvent==='function') {
       window.chooseEvent(next.event_id);
     } else if(!next && byId('eventId')) {
       byId('eventId').value='';byId('eventSearch').value='';
       if(typeof showEvent==='function')showEvent();
     }
     render();
   }));
   list.append(line);
   const rules=e.rules_url;if(typeof rules==='string'&&rules.startsWith('https://aliaksei-chareshneu.github.io/alchareshneu/')){
     const a=elt('a','catalog-summary','↳ '+(lang()==='ru'?'Правила':lang()==='uk'?'Правила':lang()==='en'?'Rules':'Pravidla'));
     a.href=rules;a.target='_blank';a.rel='noopener';list.append(a);
   }
 }
 if(!all.length)list.append(elt('p','catalog-summary',c.empty));
 const amounts=new Map();for(const e of all){const k=e.data_controller||e.community||'?';
   const v=amounts.get(k)||{sum:0,known:true};const p=price(e);if(p===null)v.known=false;else v.sum+=p;amounts.set(k,v);}
 for(const [seller,v] of amounts)totals.append(elt('p','',c.perSeller+': '+seller+' — '+(v.known?money(v.sum):c.unknown)));
 const multi=all.length>1;
 const distinct=[...amounts.keys()];
 explain.textContent=c.tentative+' '+(distinct.length>1?c.payees:c.single);
 const consentNeeded=all.some(e=>e.category==='HEMA Training'&&e.data_controller==='Aliaksei Chareshneu (OSVČ)');
 accepted.style.display=(consentNeeded||resume.open)?'flex':'none';
 if(!multi&&!resume.open)approved.checked=false;
 if(multi){for(const id of ['photo','future']){const cb=byId(id);if(cb){cb.checked=false;cb.disabled=true;}}}
 else if(typeof refreshOptIns==='function')refreshOptIns();
 const detail=byId('rsvpDetails');if(detail&&multi)detail.hidden=false;
 if(multi&&byId('paymentProof'))byId('paymentProof').required=false;
 const pay=byId('trainingPayment');if(pay&&multi)pay.hidden=true;
 const submit=byId('submit');if(submit&&multi){submit.disabled=false;submit.textContent=c.submit.replace('{n}',String(all.length));}
 else if(submit&&typeof t==='function'){submit.textContent=t('send');}
}
const originalChoose=window.chooseEvent;
if(typeof originalChoose==='function')window.chooseEvent=function(id){originalChoose(id);const e=eventById(id);
 if(bookable(e)&&!selected.has(id)&&selected.size<MAX)selected.add(id);render();};
const originalRender=window.renderEvents;
if(typeof originalRender==='function')window.renderEvents=function(){originalRender();
 const current=byId('eventId')?.value;if(!selected.size&&bookable(eventById(current)))selected.add(current);
 for(const id of [...selected])if(!bookable(eventById(id)))selected.delete(id);
 render();};
const originalShow=window.showEvent;
if(typeof originalShow==='function')window.showEvent=function(){originalShow();render();};
const form=byId('rsvpForm');
const values=()=>({firstName:byId('firstName').value,lastName:byId('lastName').value,
 email:byId('email').value,phone:byId('phone').value,
 ageGroup:document.querySelector('input[name=age]:checked')?.value,
 guardianName:byId('guardianName').value,guardianPhone:byId('guardianPhone').value,
 rsvp:document.querySelector('input[name=rsvp]:checked')?.value,
 safety:byId('safety').checked,photo:false,futureUpdates:false,language:lang(),website:byId('website').value,
 discoverySource:byId('discoverySource').value,
 utmSource:new URLSearchParams(location.search).get('utm_source')||'',
 utmMedium:new URLSearchParams(location.search).get('utm_medium')||'',
 utmCampaign:new URLSearchParams(location.search).get('utm_campaign')||''});
async function post(body,file){const options={method:'POST',cache:'no-store',signal:AbortSignal.timeout(30000)};
 if(file){const data=new FormData();data.append('payload',JSON.stringify(body));data.append('paymentProof',file,file.name);options.body=data;}
 else{options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
 const response=await fetch(ENDPOINT,options);const payload=await response.json().catch(()=>({}));
 if(!response.ok||payload.ok!==true)throw Error(payload.error||'request_failed');return payload;}
function receiptArea(){const result=byId('result');result.hidden=false;result.replaceChildren();result.className='state success cart-receipt';result.focus({preventScroll:true});result.scrollIntoView({block:'nearest'});return result;}
function showError(where,e){where.append(elt('p','event-state',e.message==='quote_changed'?C().priceChanged:C().error+' ('+String(e.message||'error')+')'));}
function auth(){const v=values();return {firstName:v.firstName,lastName:v.lastName,email:v.email,cartId:resumeId.value.trim(),cartToken:resumeToken.value.trim()};}
function showReceipt(payload,requested){cartReceipt=payload;
 const c=C(),result=receiptArea();result.append(elt('h3','',c.ok.replace('{n}',String(requested.length))),elt('p','',c.save),elt('p','',c.pending));
 const records=[[c.id,payload.cartId],[c.token,payload.cartToken]];
 for(const s of payload.secrets||[])records.push([c.individual+' · '+(eventTitle(eventById(s.eventId))||s.eventId),s.resumeToken]);
 for(const [k,v] of records){const row=elt('p');row.append(elt('strong','',k+': '),elt('code','',v));result.append(row);}
 result.append(btn(c.copy,async()=>{try{await navigator.clipboard.writeText(records.map(r=>r[0]+': '+r[1]).join('\n'));result.append(elt('p','',c.copied));}catch{}}));
 result.append(elt('p','',c.tentative));
 resumeId.value=payload.cartId;resumeToken.value=payload.cartToken;
 if(payload.controller==='Aliaksei Chareshneu (OSVČ)'&&values().rsvp==='YES'){
   result.append(btn(c.check,()=>getQuote(result)));
 }else result.append(elt('p','',c.noMultiple));
}
function showPayment(where,payload){cartQuote=payload.cartPayment;const c=C();const p=payload.cartPayment;
 const panel=elt('div','cart-bank');panel.append(elt('h3','',c.bank),
   elt('p','',p.recipient+' · '+money(p.totalCzk)),
   elt('code','',p.iban+' · VS: '+p.variableSymbol+' · '+p.paymentReference));
 const qr=elt('div','cart-qr');if(window.QRCode)new window.QRCode(qr,{text:p.spd,width:192,height:192,correctLevel:window.QRCode.CorrectLevel.M});
 panel.append(qr,elt('p','catalog-summary',c.pending));
 panel.append(btn(c.copy,()=>navigator.clipboard?.writeText([p.recipient,p.iban,money(p.totalCzk),'VS '+p.variableSymbol,'ID '+p.paymentReference].join('\n'))));
 const input=elt('input');input.type='file';input.accept='.pdf,application/pdf';input.setAttribute('aria-label',c.proof);panel.append(elt('p','',c.proof),input);
 panel.append(btn(c.sendProof,async()=>{
   const file=input.files?.[0];if(!file||file.size<100||file.size>5*1024*1024||!file.name.toLowerCase().endsWith('.pdf')){panel.append(elt('p','',c.proof));return;}
   try{const response=await post({...auth(),action:'cart_proof',quotedTotalCzk:p.totalCzk},file);
     if(response.paymentEvidenceStatus==='PROOF_RECEIVED'){panel.append(elt('p','',c.proofSaved));input.disabled=true;}}
   catch(e){showError(panel,e);}
 }));
 panel.append(btn(c.status,async()=>{
   try{const st=await post({...auth(),action:'cart_status'});panel.append(elt('p','',st.bankVerified?'BANK VERIFIED':st.paymentEvidenceStatus+' · '+c.pending));}
   catch(e){showError(panel,e);}
 }));
 where.append(panel);
}
async function getQuote(parent){const where=parent||receiptArea();
 if(!resumeId.value.trim()||!resumeToken.value.trim()){where.append(elt('p','',C().save));return;}
 if(selected.size>1&&currentEvents().some(e=>e.category==='HEMA Training'&&e.data_controller==='Aliaksei Chareshneu (OSVČ)')&&!approved.checked){where.append(elt('p','',C().accept));return;}
 try{const response=await post({...auth(),action:'cart_quote',osvcSellerConsent:approved.checked});
   showPayment(where,response);
 }catch(e){where.append(elt('p','event-state',C().quotePending+' ('+String(e.message||'')+')'));}
}
form.addEventListener('submit',async event=>{
 const all=currentEvents();if(all.length<2)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(!form.checkValidity()){form.reportValidity();return;}
 if(all.some(e=>e.category==='HEMA Training'&&e.data_controller==='Aliaksei Chareshneu (OSVČ)')&&!approved.checked){accepted.scrollIntoView({block:'center'});return;}
 const submit=byId('submit');submit.disabled=true;
 const body={...values(),action:'cart_submit',eventIds:all.map(e=>e.event_id),tiers:Object.fromEntries(tiers),osvcSellerConsent:approved.checked};
 try{const result=await post(body);form.hidden=true;showReceipt(result,all);}
 catch(e){const result=byId('result');result.hidden=false;result.className='state error';result.textContent=C().error+' ('+String(e.message||'')+')';result.focus({preventScroll:true});}
 finally{submit.disabled=false;}
},true);
document.querySelectorAll('input[name=age]').forEach(x=>x.addEventListener('change',render));
resume.addEventListener('toggle',render);
const preSelected=byId('eventId')?.value;
if(bookable(eventById(preSelected)))selected.add(preSelected);
render();
})();