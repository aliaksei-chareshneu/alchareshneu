const DATA = {
    events: [
        { id: 'hike_1', type: 'Hike', title: 'Moravian Karst Adventure', date: '2026-08-30T10:00:00', price: 200, seats: 3 },
        { id: 'hema_1', type: 'HEMA', title: 'HEMA Fundamentals', date: '2026-08-24T18:00:00', price: 200, seats: 8 }
    ]
};
document.addEventListener('DOMContentLoaded', () => {
    renderEvents();
    startFomo();
});
function renderEvents() {
    const grid = document.getElementById('eventGrid');
    grid.innerHTML = DATA.events.map(ev => `
        <div class="event-card">
            <h3>${ev.title}</h3>
            <p>${new Date(ev.date).toLocaleString()}</p>
            <div class="price-tag">${ev.price} CZK</div>
            <button class="btn btn-primary btn-full" onclick="book('${ev.id}', '${ev.title}')">Reserve Slot</button>
        </div>
    `).join('');
}
function startFomo() {
    const banner = document.getElementById('fomo-banner');
    const timer = document.getElementById('countdown');
    setInterval(() => {
        const diff = new Date(DATA.events[1].date) - new Date();
        if (diff < 0) return;
        banner.style.display = 'block';
        timer.innerText = new Date(diff).toISOString().substr(11, 8);
    }, 1000);
}
function book(id, name) { window.location.href = `https://tally.so/r/3yP1E9?event_id=${id}&event_name=${encodeURIComponent(name)}`; }
function bookService(s) { window.location.href = `https://tally.so/r/3yP1E9?service=${s}`; }