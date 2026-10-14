/* archive.js — архив вопросов дня: все прошедшие даты с Vectra.START, новые сверху. */
(function () {
  Vectra.loadQuestions().then(Q => {
  const $ = s => document.querySelector(s), lang = Vectra.lang(), L = lang === 'ru' ? 0 : 1, saved = Vectra.store.get('daily', {});
  const T = lang === 'ru' ? { title: 'Архив', only: 'Только новые', today: 'Вопрос дня', played: 'Сыграно', fresh: 'Новый', empty: 'Здесь пока пусто' } : { title: 'Archive', only: 'Unplayed only', today: 'Today’s question', played: 'Played', fresh: 'New', empty: 'Nothing here yet' };
  const today = Vectra.utcToday(), n = Vectra.dayIndex(today), dates = [];
  for (let i = n - 1; i >= 0; i--) dates.push([i, new Date((Vectra.dayNum(Vectra.START) + i) * 864e5).toISOString().slice(0, 10)]);
  const dFmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  $('#title').textContent = T.title; document.title = T.title + ' — Vectra'; $('#onlyT').textContent = T.only; $('#todayLink').textContent = T.today + ' →';
  function render() {
    const only = $('#only').checked, list = $('#list'), rows = dates.filter(([, d]) => !(only && saved[d]));
    list.innerHTML = rows.length ? rows.map(([i, d]) => {
      const s = saved[d], q = Q.pick(i)[L], c = !s ? '' : s.s >= 80 ? 'good' : s.s >= 40 ? 'mid' : 'bad';
      return `<li><a class="ar-item" href="daily.html?d=${d}"><span class="ar-d"><b>#${i + 1}</b>${dFmt(d)}</span><span class="ar-q">${esc(q)}</span><span class="ar-s ${c}">${s ? s.s : T.fresh}</span></a></li>`;
    }).join('') : `<li class="ar-empty">${T.empty}</li>`;
  }
  const done = dates.filter(([, d]) => saved[d]).length, avg = done ? Math.round(dates.filter(([, d]) => saved[d]).reduce((a, [, d]) => a + saved[d].s, 0) / done) : 0;
  $('#prog').innerHTML = `${T.played} <b>${done} / ${dates.length}</b> <span>⌀ <b>${avg}</b></span>`;
  $('#only').onchange = render; render();
  }).catch(e => { const el = document.getElementById('list'); if (el) el.textContent = 'Не удалось загрузить data/questions.json — запусти сайт через сервер: python3 -m http.server'; console.error(e) });
})();
