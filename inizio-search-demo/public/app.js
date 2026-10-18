const form = document.querySelector('#search-form');
const input = document.querySelector('#query');
const submit = document.querySelector('#submit');
const status = document.querySelector('#status');
const section = document.querySelector('#result-section');
const list = document.querySelector('#results-list');
const label = document.querySelector('#results-label');
const download = document.querySelector('#download');
let lastResponse = null;

function setStatus(message, isError = false) {
 status.textContent = message;
 status.classList.toggle('error', isError);
}

function renderResults(data) {
 list.replaceChildren();
 for (const item of data.results) {
 const li = document.createElement('li');
 const link = document.createElement('a');
 link.href = item.url;
 link.rel = 'noopener noreferrer';
 link.target = '_blank';
 link.textContent = item.title;
 const urlText = document.createElement('div');
 urlText.className = 'result-url';
 urlText.textContent = item.url;
 const snippet = document.createElement('p');
 snippet.textContent = item.snippet;
 li.append(link, urlText, snippet);
 list.append(li);
 }
 label.textContent = `${data.count} organick\u00fdch v\u00fdsledk\u016f`;
 section.hidden = false;
}

form.addEventListener('submit', async (event) => {
 event.preventDefault();
 const q = input.value.trim();
 if (q.length < 2) return;
 submit.disabled = true;
 section.hidden = true;
 lastResponse = null;
 setStatus('Na\u010d\u00edt\u00e1m v\u00fdsledky...');
 try {
 const response = await fetch('/api/search', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ q })
 });
 const data = await response.json();
 if (!response.ok) throw new Error(data.error || 'Search failed.');
 lastResponse = data;
 renderResults(data);
 setStatus(`Hotovo: ${data.count} organick\u00fdch v\u00fdsledk\u016f bez reklam.`);
 } catch (error) {
 setStatus(error.message || 'Nepoda\u0159ilo se vyhledat.', true);
 } finally {
 submit.disabled = false;
 }
});

download.addEventListener('click', () => {
 if (!lastResponse) return;
 const file = new Blob([JSON.stringify(lastResponse, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(file);
 const a = document.createElement('a');
 a.href = url;
 a.download = `organic-results-${new Date().toISOString().slice(0, 10)}.json`;
 document.body.append(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
});
