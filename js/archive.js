/* archive.js — архив: вкладка «Вопросы дня» (все прошедшие даты с Vectra.START, новые сверху) и вкладка «Compare’It»
   (для каждой прошедшей даты — своя партия из 5 раундов, пары задаются датой: compare.html?d=ГГГГ-ММ-ДД). */
(function () {
  Promise.all([Vectra.loadQuestions(), Vectra.loadObjects()]).then(([Q, DATA]) => {
  const $ = s => document.querySelector(s), lang = Vectra.lang(), L = lang === 'ru' ? 0 : 1, saved = Vectra.store.get('daily', {});
  const T = lang === 'ru' ? { title: 'Архив', only: 'Только новые', today: 'Вопрос дня', todayC: 'Играть в Compare’It', played: 'Сыграно', fresh: 'Новый', empty: 'Здесь пока пусто', tq: 'Вопросы дня', tc: 'Compare’It', play: 'Играть', days: 'Партий', note: 'Партии из архива не идут в рекорды' }
    : { title: 'Archive', only: 'Unplayed only', today: 'Today’s question', todayC: 'Play Compare’It', played: 'Played', fresh: 'New', empty: 'Nothing here yet', tq: 'Daily questions', tc: 'Compare’It', play: 'Play', days: 'Games', note: 'Archive games don’t count toward records' };
  const today = Vectra.utcToday(), n = Vectra.dayIndex(today), dates = [];
  for (let i = n - 1; i >= 0; i--) dates.push([i, new Date((Vectra.dayNum(Vectra.START) + i) * 864e5).toISOString().slice(0, 10)]);
  const dFmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const OBJ = DATA.filter(o => o.size).map(o => ({ id: o.id, cat: o.cat, name: o[lang], len: o.size.m }));
  let tab = location.hash === '#compare' ? 'c' : 'q';
  $('#title').textContent = T.title; document.title = T.title + ' — Vectra'; $('#onlyT').textContent = T.only; $('#tabQ').textContent = T.tq; $('#tabC').textContent = T.tc; $('#arNote').textContent = T.note;

  function renderQ() {
    const only = $('#only').checked, rows = dates.filter(([, d]) => !(only && saved[d]));
    $('#list').innerHTML = rows.length ? rows.map(([i, d]) => {
      const s = saved[d], q = Q.pick(i)[L], c = !s ? '' : s.s >= 80 ? 'good' : s.s >= 40 ? 'mid' : 'bad';
      return `<li><a class="ar-item" href="daily.html?d=${d}"><span class="ar-d"><b>#${i + 1}</b>${dFmt(d)}</span><span class="ar-q">${esc(q)}</span><span class="ar-s ${c}">${s ? s.s : T.fresh}</span></a></li>`;
    }).join('') : `<li class="ar-empty">${T.empty}</li>`;
    const done = dates.filter(([, d]) => saved[d]).length, avg = done ? Math.round(dates.filter(([, d]) => saved[d]).reduce((a, [, d]) => a + saved[d].s, 0) / done) : 0;
    $('#prog').innerHTML = `${T.played} <b>${done} / ${dates.length}</b> <span>⌀ <b>${avg}</b></span>`;
  }
  function renderC() {
    $('#list').innerHTML = dates.length ? dates.map(([i, d]) => {
      const names = Vectra.comparePairs(OBJ, Vectra.seededRng('compare:' + d)).map(p => `<span>${esc(p.A.name)} <i>→</i> ${esc(p.B.name)}</span>`).join('');
      return `<li><a class="ar-item ar-c" href="compare.html?d=${d}"><span class="ar-d"><b>#${i + 1}</b>${dFmt(d)}</span><span class="ar-cb"><b class="ar-name">${esc(Vectra.compareName(d, lang))}</b><span class="ar-pairs">${names}</span></span><span class="ar-s">${T.play}</span></a></li>`;
    }).join('') : `<li class="ar-empty">${T.empty}</li>`;
    $('#prog').innerHTML = `${T.days} <b>${dates.length}</b>`;
  }
  function render() {
    const q = tab === 'q';
    $('#tabQ').classList.toggle('on', q); $('#tabC').classList.toggle('on', !q);
    $('#tabQ').setAttribute('aria-selected', q); $('#tabC').setAttribute('aria-selected', !q);
    $('.ar-filter').hidden = !q; $('#arNote').hidden = q;
    const a = $('#todayLink'); a.textContent = (q ? T.today : T.todayC) + ' →'; a.href = q ? 'daily.html' : 'compare.html';
    q ? renderQ() : renderC();
  }
  const pick = t => () => { tab = t; history.replaceState(null, '', t === 'c' ? '#compare' : location.pathname + location.search); render() };
  $('#tabQ').onclick = pick('q'); $('#tabC').onclick = pick('c'); $('#only').onchange = render; render();
  }).catch(e => { const el = document.getElementById('list'); if (el) el.textContent = 'Не удалось загрузить data/*.json — запусти сайт через сервер: python3 -m http.server'; console.error(e) });
})();
