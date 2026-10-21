/* menu.js — боковое меню, одинаковое на всех страницах. Открывается любой кнопкой с атрибутом data-menu-open.
   Содержит профиль (никнейм), тему, язык, список режимов и раздел Explore. Также даёт Vectra.toast() и заглушки «скоро». */
(function () {
  const t = Vectra.t, S = Vectra.store, lang = Vectra.lang();
  const P = {
    logo: '<path d="M3 8l4-4 4 4 4-4 5 5M3 15l4-4 4 4 4-4 5 5M3 21l4-4 4 4 4-4 5 5" transform="scale(.9) translate(1 -2)"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', chev: '<path d="M9 6l6 6-6 6"/>',
    compare: '<path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/>',
    scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z"/>',
    sigma: '<path d="M18 5H6l6 7-6 7h12"/>', layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
    bars: '<path d="M5 21V11M12 21V4M19 21v-7"/>', trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    vol: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11"/>', mute: '<path d="M4 9.5v5h3.5L12 19V5L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5"/>',
    moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>'
  };
  const ic = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;
  const item = (href, icon, title, sub, soon) => `<a class="item" href="${href}"${soon ? ` data-soon="${title}"` : ''}><span class="ib">${ic(icon)}</span><span class="tt"><b>${title}</b><small>${sub}</small></span>${ic('chev', 'chev')}</a>`;

  document.body.insertAdjacentHTML('beforeend', `
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" aria-label="Menu" aria-hidden="true">
  <div class="d-head"><a class="brand" href="index.html"><span class="logo">${ic('logo')}</span><b>Vectra</b></a><button class="icon-btn" id="closeBtn" aria-label="${t('menu.close')}">${ic('x')}</button></div>
  <a class="d-profile" href="stats.html#nick"><span class="avatar" id="mAv">?</span><span class="tt"><b id="mNick"></b><small>${t('menu.nickChange')}</small></span>${ic('chev', 'chev')}</a>
  <div class="d-pref"><span class="label">${t('menu.prefs')}</span>
    <div class="d-ctrls"><div class="seg" role="group" aria-label="${t('menu.lang')}"><button data-lang="ru">RU</button><button data-lang="en">EN</button></div>
    <button class="icon-btn sfx-btn" id="sfxBtn">${ic('vol', 'von')}${ic('mute', 'voff')}</button>
    <button class="icon-btn theme-btn" id="themeBtn">${ic('sun', 'sun')}${ic('moon', 'moon')}</button></div></div>
  <div class="d-sec"><div class="label">${t('menu.play')}</div>
    ${item('compare.html', 'compare', t('mode.compare'), t('menu.compareSub'))}
    ${item('weight.html', 'scale', t('mode.weight'), t('menu.weightSub'))}
    ${item('daily.html', 'sigma', t('mode.daily'), t('menu.dailySub'))}
    ${item('archive.html', 'layers', t('menu.archive'), t('menu.archiveSub'))}</div>
  <div class="d-sec"><div class="label">${t('menu.explore')}</div>
    ${item('stats.html', 'bars', t('menu.stats'), t('menu.statsSub'))}
    ${item('leaderboards.html', 'trophy', t('menu.lb'), t('menu.lbSub'))}</div>
  <div class="d-foot"><button id="recheck">${t('menu.recheck')}</button></div>
</aside>`);

  const $ = s => document.querySelector(s), drawer = $('#drawer'), scrim = $('#scrim'), closeBtn = $('#closeBtn');
  let opener = null; drawer.inert = true;
  function setOpen(open) {
    drawer.classList.toggle('open', open); scrim.classList.toggle('on', open); drawer.inert = !open; drawer.setAttribute('aria-hidden', String(!open));
    document.querySelectorAll('[data-menu-open]').forEach(b => b.setAttribute('aria-expanded', String(open)));
    document.body.style.overflow = open ? 'hidden' : ''; if (open) closeBtn.focus(); else if (opener) opener.focus();
  }
  document.querySelectorAll('[data-menu-open]').forEach(b => { b.setAttribute('aria-label', t('menu.open')); b.setAttribute('aria-controls', 'drawer'); b.onclick = () => { opener = b; setOpen(true) } });
  closeBtn.onclick = scrim.onclick = () => setOpen(false);
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false) });

  // звук
  const sb = $('#sfxBtn'), syncSfx = () => { const e = Vectra.sfx ? Vectra.sfx.enabled() : false; sb.classList.toggle('muted', !e); sb.setAttribute('aria-label', t(e ? 'menu.soundOff' : 'menu.soundOn')); sb.setAttribute('aria-pressed', String(e)); sb.title = t('menu.sound') };
  sb.onclick = () => { if (Vectra.sfx) Vectra.sfx.toggle(); syncSfx() }; syncSfx(); addEventListener('vectra:sfx', syncSfx);
  // тема и язык
  const tb = $('#themeBtn'), syncTheme = () => { const l = Vectra.theme() === 'light'; tb.setAttribute('aria-label', t(l ? 'menu.themeToDark' : 'menu.themeToLight')); tb.setAttribute('aria-pressed', String(l)) };
  tb.onclick = () => { Vectra.toggleTheme(); syncTheme() }; syncTheme();
  drawer.querySelectorAll('[data-lang]').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === lang);
    b.onclick = () => {
      if (b.dataset.lang !== lang) {
        if (Vectra.isGameActive()) { Vectra.toast(t('menu.langBusy')); return }
        Vectra.setLangAndReload(b.dataset.lang)
      }
    }
  });

  // профиль в шапке меню
  function profile() { const n = S.get('nick', ''); $('#mNick').textContent = n || t('menu.guest'); $('#mAv').textContent = (n || '?').trim().charAt(0).toUpperCase() }
  profile(); addEventListener('vectra:profile', profile);
  $('#recheck').onclick = async () => { try { await Vectra.clearVerified() } catch (e) {} location.href = 'captcha.html' };

  // всплывающая подсказка и режимы, которых ещё нет
  let toastEl, toastT;
  Vectra.toast = msg => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.append(toastEl) }
    toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 1900);
  };
  document.addEventListener('click', e => { const a = e.target.closest('[data-soon]'); if (a) { e.preventDefault(); Vectra.toast(t('menu.soon', { name: a.dataset.soon })) } });
})();
