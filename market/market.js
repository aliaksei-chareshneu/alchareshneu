/* Brno Finds: CS/EN static discovery pilot. No analytics, no remote fetch, no payment. */
(() => {
  "use strict";
  const txt = {
    cs: {
      skip:"Přejít na obsah", brandTag:"Výběrová online výloha", back:"Hlavní web",
      eyebrow:"Výběr z Brna · veřejný pilot", h1:"Zajímavé věci. Na dosah. Bez přeplněného tržiště.",
      intro:"Objevujte historizující oblečení, řemeslné doplňky a neobvyklé nápady. Vyberte si směr, napište prodávajícímu a domluvte se na konkrétním kusu, ceně a případném zaslání.",
      browseAction:"Prohlédnout výběr", howAction:"Jak to funguje",
      heroProof:"Bez registrace · Bez sledovacích cookies · Žádná platba přes tuto stránku",
      pilotTitle:"Ověřovací katalog.", pilotText:"Kategorie nejsou potvrzením skladových zásob. Konkrétní položky, fotografie, cena, dostupnost a doručení se upřesňují přímo s prodávajícím před jakýmkoli závazkem.",
      shelfTag:"Pomalé procházení. Dobré nálezy.", browseTitle:"Co by vás mohlo zaujmout?",
      browseDetail:"Zatím jen naše vlastní tematické nabídky; externí prodejci se nezobrazují bez domluvy.",
      fAll:"Vše", fClothes:"Oděvy", fLeather:"Kůže", fAccessories:"Doplňky", fDigital:"Digitální",
      artOne:"OBLEČENÍ", artTwo:"KŮŽE", artThree:"DOPLŇKY", artFour:"NÁSTROJE",
      preorder:"Nabídka na dotaz, bez rezervace", clothesTitle:"Dlouhé košile a historizující oděvy",
      clothesDesc:"Na tematickou akci, slavnost nebo jen jako neobvyklý kousek. Rozměry a stav konkrétní věci sdělíme před domluvou.",
      ownSeller:"Prodejce: Aliaksei Chareshneu · OSVČ", inquire:"Zeptat se na nabídku",
      beltsTitle:"Kožené opasky a praktické doplňky",
      beltsDesc:"Drobnosti s charakterem. Aktuální výběr, stav, rozměry a cena se potvrzují před koupí.",
      hatTitle:"Klobouky a tematické detaily",
      hatDesc:"Hledáte doplněk ke kostýmu nebo originální dárek? Napište, co potřebujete, a ověříme skutečnou dostupnost.",
      digitalBadge:"Samostatná nabídka na našem webu", digitalTitle:"Praktické digitální nástroje",
      digitalDesc:"Přehled vlastních digitálních sad pro práci s daty a rozhodování o automatizaci. Podmínky a stav objednávky jsou na stránce produktu.",
      digitalCta:"Prohlédnout podrobnosti",
      howTag:"Jednoduchá cesta", howTitle:"Z výlohy přímo k prodávajícímu",
      step1Title:"Prohlédněte si kategorie", step1:"Žádné povinné účty ani stahování aplikace.",
      step2Title:"Pošlete nezávazný dotaz", step2:"Zvolíte, co vás zajímá. E-mail se odešle až ve chvíli, kdy jej sami odešlete.",
      step3Title:"Potvrďte podmínky", step3:"Konkrétní prodejce sdělí dostupnost, cenu, dopravu, práva a platební podmínky před objednávkou.",
      shipping:"Výdejní box nebo doručení domů? Jen pokud to prodávající u konkrétního zboží skutečně umožňuje. Tato stránka zatím neprovozuje objednávky ani přepravní integraci.",
      sellerTag:"Pro obchodníky a organizátory", sellerHeadline:"Máte věci, které stojí za objevení?",
      sellerBody:"Prověřujeme možnost omezené společné online výlohy pro vybrané prodejce a tematické trhy. Zatím bez poplatků, bez garance zařazení a bez předávání kontaktů třetím stranám. O případné spolupráci a podmínkách rozhodneme písemně.",
      sellerCta:"Zeptat se na spolupráci", legalTitle:"Kdo za výlohou stojí?",
      legalBody:"Provozovatel této zkušební stránky a vlastní nabídky: Aliaksei Chareshneu, OSVČ, IČO 23041625, Česká republika. Brno Finds není nezávislá právnická osoba, obchodní platforma s platbami ani projekt spolku Družina Moravy z. s. Nepřijímáme přes tuto stránku žádné peníze ani objednávky. Komunikace probíhá až po dobrovolném odeslání e-mailu; žádné kontakty nejsou automaticky uloženy ani předány partnerům. Před případným nákupem musí prodejce sdělit úplné zákonné údaje a podmínky.",
      legalLink:"Právní informace k digitálním produktům", footerPilot:"Ověřovací verze",footerBack:"Hlavní web"
    },
    en: {
      skip:"Skip to content",brandTag:"A curated online window",back:"Main website",
      eyebrow:"Curated in Brno · early pilot",h1:"Unusual finds. Close to home. No crowded marketplace.",
      intro:"Explore historical-style clothes, hand-crafted accessories and unusual ideas. Pick what catches your eye, contact the seller and agree on the exact item, price and possible shipping.",
      browseAction:"Browse the collection",howAction:"How it works",
      heroProof:"No account · No tracking cookies · No payments on this page",
      pilotTitle:"Exploratory catalogue.",pilotText:"Categories are not proof of inventory. The specific item, photographs, price, availability and delivery are confirmed directly by the seller before any commitment.",
      shelfTag:"Slow browsing. Better discoveries.",browseTitle:"What might catch your eye?",
      browseDetail:"For now, only our own product themes. We do not list third-party vendors without an agreement.",
      fAll:"All",fClothes:"Clothing",fLeather:"Leather",fAccessories:"Accessories",fDigital:"Digital",
      artOne:"CLOTHING",artTwo:"LEATHER",artThree:"ACCESSORIES",artFour:"TOOLS",
      preorder:"Enquiry only · No reservation",clothesTitle:"Long shirts and historical-style clothing",
      clothesDesc:"For an event, a celebration or an unusual everyday item. Ask for the specific item's measurements and condition before deciding.",
      ownSeller:"Seller: Aliaksei Chareshneu · Czech sole trader",inquire:"Ask about availability",
      beltsTitle:"Leather belts and practical accessories",
      beltsDesc:"Useful pieces with character. We confirm the current selection, condition, sizing and price before any sale.",
      hatTitle:"Hats and costume details",
      hatDesc:"Looking for a costume accessory or an original gift? Say what you need and we will check actual availability.",
      digitalBadge:"Separate range on our website",digitalTitle:"Useful digital tools",
      digitalDesc:"Our existing catalogue of downloadable tools for data work and assessing automation. Check each product page for actual terms and checkout status.",
      digitalCta:"See product details",
      howTag:"A simple journey",howTitle:"From the window to the actual seller",
      step1Title:"Explore the categories",step1:"No mandatory account or application download.",
      step2Title:"Send a non-binding enquiry",step2:"Tell the seller what interests you. Your email is only sent if you choose to send it.",
      step3Title:"Confirm the terms",step3:"The actual seller confirms availability, full price, delivery, legal rights and payment conditions before an order.",
      shipping:"Parcel locker or home delivery? Only if the seller actually offers it for the item. No checkout or carrier integration is operated on this pilot page.",
      sellerTag:"For makers and event organisers",sellerHeadline:"Got things worth discovering?",
      sellerBody:"We are exploring a small shared online window for selected sellers and themed markets. No listing charges for this exploratory stage, no guaranteed placement and no sharing of contacts with third parties. Any cooperation and terms would be agreed in writing first.",
      sellerCta:"Ask about cooperation",legalTitle:"Who operates this project?",
      legalBody:"This pilot and the owner's offers are operated by Aliaksei Chareshneu, Czech sole trader, IČO 23041625, Czech Republic. Brno Finds is not a separate legal entity, a payment marketplace or a Družina Moravy z. s. association project. No payments or orders are accepted through this page. Communication occurs only when you voluntarily send an email. Contact data are not automatically collected or shared with partners. The selling trader must provide all mandatory legal details and terms before a purchase.",
      legalLink:"Terms for the separate digital tool store",footerPilot:"Exploratory pilot",footerBack:"Main website"
    }
  };
  const titleKeys = {clothes:"clothesTitle",belts:"beltsTitle",hats:"hatTitle"};
  let language = new URLSearchParams(location.search).get("lang")==="en"?"en":"cs";
  let category = "all";
  function mailto(subject, body) {
    return "mailto:chereshnev.biochem@gmail.com?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  }
  function applyFilter() {
    let visible=0;
    document.querySelectorAll(".tile[data-category]").forEach(card=>{
      const show=category==="all"||card.dataset.category===category;
      card.hidden=!show;if(show)visible++;
    });
    document.querySelectorAll("[data-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.filter===category)));
    document.querySelector("#count").textContent=language==="cs"?visible+" tematické "+(visible===1?"téma":visible>=2&&visible<=4?"směry":"směrů"):visible+" collection "+(visible===1?"theme":"themes");
  }
  function render() {
    document.documentElement.lang=language;
    document.title=language==="cs"?"Brno Finds | Malý online výběr s osobním přístupem":"Brno Finds | Curated discoveries from Brno";
    document.querySelector('meta[name="description"]').content=language==="cs"?"Netradiční výběr z Brna. Cenu, sklad a dopravu ověřte přímo u prodejce. Bez registrace a online platby.":"Explore unusual finds from Brno. Ask the seller to confirm the exact item, total price and possible shipping. No login or payment.";
    document.querySelectorAll("[data-i]").forEach(el=>{
      const key=el.dataset.i;
      if(!Object.prototype.hasOwnProperty.call(txt[language],key))return;
      if(key==="h1"){
        const value=txt[language].h1;
        const sep=language==="cs"?"Na dosah.":"Close to home.";
        const before=value.split(sep);
        el.replaceChildren(document.createTextNode(before[0]),Object.assign(document.createElement("em"),{textContent:sep}),document.createTextNode(before[1]));
      } else el.textContent=txt[language][key];
    });
    document.querySelectorAll("[data-lang]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.lang===language)));
    document.querySelectorAll("[data-inquire]").forEach(el=>{
      const key=el.dataset.inquire;
      const name=txt[language][titleKeys[key]];
      const subject=(language==="cs"?"Brno Finds – dotaz: ":"Brno Finds — enquiry: ")+name;
      const body=language==="cs"?
        "Dobrý den, zajímá mě: "+name+". Prosím o potvrzení fotografií konkrétního kusu, stavu, rozměrů, celkové ceny, možností dopravy a nákupních podmínek. Zatím nic neobjednávám.\n\nDěkuji.":
        "Hello, I am interested in: "+name+". Please confirm photos of the actual item, condition, sizing, total price, shipping options and purchase terms. This is not an order.\n\nThank you.";
      el.href=mailto(subject,body);
    });
    document.querySelector("#vendor-contact").href=mailto(
      language==="cs"?"Brno Finds – dotaz na zařazení prodejce":"Brno Finds — potential seller enquiry",
      language==="cs"?"Dobrý den, mám zájem zjistit podmínky případné spolupráce. Sortiment, odkaz na skutečnou nabídku, identita právního prodávajícího: \n\nZatím nejde o objednávku ani závaznou přihlášku.":
      "Hello, I would like to ask about possible collaboration. My actual product range, listing URL and legal seller identity: \n\nThis is not a booking or agreement."
    );
    document.querySelector(".filters").setAttribute("aria-label",language==="cs"?"Filtr kategorie":"Category filter");
    document.querySelector(".languages").setAttribute("aria-label","Jazyk / Language");
    applyFilter();
  }
  document.querySelectorAll("[data-filter]").forEach(el=>el.addEventListener("click",()=>{category=el.dataset.filter;applyFilter()}));
  document.querySelectorAll("[data-lang]").forEach(el=>el.addEventListener("click",()=>{
    language=el.dataset.lang;
    const u=new URL(location.href);u.searchParams.set("lang",language);
    history.replaceState(null,"",u.pathname+u.search+u.hash);
    render();
  }));
  render();
})();