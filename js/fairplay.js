/* fairplay.js — мягкое напоминание «отвечай сам». Пока включено Vectra.fairplay.on() (раунд идёт), считаем уходы со страницы:
   переключение вкладки / окна и увод курсора за пределы окна. Если это случается часто (3 раза за 5 минут), показываем дружелюбное окно.
   Ничего не блокируем и не читаем из других вкладок — браузер такого и не позволил бы; считается только сам факт ухода. */
(function () {
  const WINDOW = 5 * 60e3, LIMIT = 3, COOLDOWN = 90e3;
  let on = false, hits = [], last = 0, shownAt = 0;
  function show() {
    if (document.getElementById('fpBack')) return; const t = Vectra.t;
    document.body.insertAdjacentHTML('beforeend', `<div class="nm-back" id="fpBack"><div class="nm-card" role="alertdialog" aria-modal="true" aria-labelledby="fpT"><h2 id="fpT">${t('fair.title')}</h2><p>${t('fair.msg')}</p><div class="nm-btns"><button class="go" id="fpOk">${t('fair.ok')}</button></div></div></div>`);
    const b = document.getElementById('fpOk'); b.onclick = () => document.getElementById('fpBack').remove(); b.focus();
  }
  function hit() {
    if (!on) return; const n = Date.now(); if (n - last < 1200) return; last = n;      // вкладка и окно часто срабатывают разом — считаем как одно событие
    hits = hits.filter(x => n - x < WINDOW); hits.push(n);
    if (hits.length >= LIMIT && n - shownAt > COOLDOWN) { shownAt = n; hits = []; show() }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) hit() });
  addEventListener('blur', hit);
  document.documentElement.addEventListener('mouseleave', hit);
  Vectra.fairplay = { on() { on = true; hits = [] }, off() { on = false }, _hit: hit };
})();
