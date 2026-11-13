/* Optional navigation enhancement. Forms and service destinations stay with their existing owners. */
(() => {
  'use strict';
  const navigation = document.querySelector('.tabs-bar');
  const actions = document.querySelector('.nav .nav-actions');
  const brand = document.querySelector('.nav .brand');
  const page = document.querySelector('.hero')?.id;
  if (brand) brand.dataset.siteMonogram = {druzina:'DM', walkers:'BW', academy:'EL'}[page] || 'AC';
  if (!navigation || !actions) return;

  const labels = {
    en: {open:'Open navigation', close:'Close navigation', navigation:'Main navigation'},
    cs: {open:'Otevřít nabídku', close:'Zavřít nabídku', navigation:'Hlavní navigace'},
    ru: {open:'Открыть меню', close:'Закрыть меню', navigation:'Главная навигация'},
    uk: {open:'Відкрити меню', close:'Закрити меню', navigation:'Головна навігація'}
  };
  const media = matchMedia('(max-width: 760px)');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'site-menu-toggle';
  button.setAttribute('aria-expanded', 'false');
  navigation.id = navigation.id || 'site-navigation';
  navigation.setAttribute('role', 'navigation');
  button.setAttribute('aria-controls', navigation.id);
  button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><g class="site-menu-icon"><path d="M4 8h16M4 16h16"/></g><g class="site-close-icon"><path d="m6 6 12 12M18 6 6 18"/></g></svg>';
  actions.append(button);
  navigation.classList.add('site-nav-ready');
  let open = false;

  function render() {
    const language = labels[document.documentElement.lang] || labels.en;
    button.setAttribute('aria-label', open ? language.close : language.open);
    button.setAttribute('aria-expanded', String(open));
    navigation.setAttribute('aria-label', language.navigation);
    navigation.hidden = media.matches && !open;
  }
  button.addEventListener('click', () => { open = !open; render(); });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a') && media.matches) { open = false; render(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      open = false;
      render();
      button.focus();
    }
  });
  media.addEventListener('change', () => { open = false; render(); });
  document.addEventListener('site:language', render);
  render();
})();
