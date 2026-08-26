const CONFIG = {
    PRICE_UPDATE_DATE: new Date('2026-09-01T00:00:00'),
    TALLY_URL: 'https://tally.so/r/npoM7E',
    BASE_IMG: './images/'
};

const DATA = {
    events: [
        { id: 'hema_sat', type: 'HEMA', title: 'Sword & Shield Basics', date: '2026-08-29T18:00:00', price: 200, seats: 5, img: 'img2.jpg' },
        { id: 'hike_karst', type: 'Hike', title: 'Moravian Karst Expedition', date: '2026-08-30T09:00:00', price: 250, seats: 3, img: 'img12.jpg' },
        { id: 'board_tue', type: 'Board Games', title: 'Strategy Night Brno', date: '2026-08-25T18:00:00', price: 0, seats: 12, img: 'img1.jpg' }
    ],
    translations: {
        cs: { storno: "Zrušení >48h: 100% | 24-48h: 50% | <24h: 0%", safety: "HEMA sparing je na vlastní nebezpečí. Povinná maska a rukavice.", book: "Rezervovat" },
        en: { storno: "Refunds >48h: 100% | 24-48h: 50% | <24h: 0%", safety: "HEMA sparring is at own risk. Mask and gloves mandatory.", book: "Book Now" },
        ru: { storno: "Возврат >48ч: 100% | 24-48ч: 50% | <24ч: 0%", safety: "HEMA спарринг на свой страх и риск. Маска и перчатки обязательны.", book: "Записаться" }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const lang = localStorage.getItem('lang') || 'cs';
    initApp(lang);
});

function initApp(lang) {
    const isPostUpdate = new Date() >= CONFIG.PRICE_UPDATE_DATE;
    renderEvents(lang, isPostUpdate);
    renderAcademy(isPostUpdate);
    startFomo();
    captureUTMs();
    setupLang(lang);
    
    document.getElementById('legal-storno').innerText = DATA.translations[lang].storno;
    document.getElementById('legal-safety').innerText = DATA.translations[lang].safety;
}

function renderEvents(lang, isPostUpdate) {
    const grid = document.getElementById('eventGrid');
    grid.innerHTML = DATA.events.map(ev => {
        const hoursLeft = (new Date(ev.date) - new Date()) / 36e5;
        const hasSurcharge = hoursLeft < 48 && ev.price > 0;
        
        let price = isPostUpdate ? Math.round(ev.price * 1.2) : ev.price;
        if (hasSurcharge) price = Math.round(price * 1.25);

        return `
            <div class="event-card" data-type="${ev.type}">
                <div class="card-img" style="background-image: url('${CONFIG.BASE_IMG}${ev.img}')"></div>
                ${ev.seats < 5 ? `<div class="card-fomo">Last ${ev.seats} spots!</div>` : ''}
                <div class="card-body">
                    <h3>${ev.title}</h3>
                    <p>${new Date(ev.date).toLocaleString(lang)}</p>
                    <div class="price-tag">${price} CZK</div>
                    <button class="btn btn-primary btn-full" onclick="book('${ev.id}', '${ev.title}')">${DATA.translations[lang].book}</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAcademy(isPostUpdate) {
    const p5 = isPostUpdate ? 2850 : 2375;
    const p10 = isPostUpdate ? 5400 : 4500;
    document.getElementById('price-tut-5').innerText = `${p5} Kč`;
    document.getElementById('price-tut-10').innerText = `${p10} Kč`;
}

function startFomo() {
    const timer = document.getElementById('countdown');
    const next = new Date(DATA.events[0].date);
    setInterval(() => {
        const diff = next - new Date();
        if (diff < 0) return;
        document.getElementById('fomo-banner').style.display = 'block';
        const h = String(Math.floor(diff / 36e5)).padStart(2, '0');
        const m = String(Math.floor((diff % 36e5) / 6e4)).padStart(2, '0');
        const s = String(Math.floor((diff % 6e4) / 1000)).padStart(2, '0');
        timer.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function book(id, name) {
    const utm = sessionStorage.getItem('utm_data') || '{}';
    window.location.href = `${CONFIG.TALLY_URL}?event_id=${id}&event_name=${encodeURIComponent(name)}&utm=${encodeURIComponent(utm)}`;
}

function bookService(service) {
    window.location.href = `${CONFIG.TALLY_URL}?service=${service}`;
}

function captureUTMs() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('utm_source')) sessionStorage.setItem('utm_data', params.toString());
}

function setupLang(lang) {
    const s = document.getElementById('langSwitcher');
    s.value = lang;
    s.addEventListener('change', (e) => {
        localStorage.setItem('lang', e.target.value);
        location.reload();
    });
}