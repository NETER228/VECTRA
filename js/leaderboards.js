/* leaderboards.js — таблицы лидеров из функции get_leaderboard в Supabase: виден только никнейм и очки. */
(function () {
  const $ = s => document.querySelector(s), S = Vectra.store, lang = Vectra.lang();
  const T = lang === 'ru' ? {
    title: 'Таблицы лидеров', compare: 'Compare’It', weight: 'Угадай вес', today: 'Вопрос дня · сегодня', total: 'Вопрос дня · всего',
    subCompare: 'Лучший забег из 5 раундов (максимум 500).', subWeight: 'Лучший забег из 5 раундов (максимум 500).', subToday: 'Результаты за сегодня (по UTC), максимум 100.', subTotal: 'Сумма очков за все ответы на вопрос дня.',
    runs: 'забегов', answers: 'ответов', you: 'вы', empty: 'Пока никого нет — станьте первым!', off: 'Нужна связь с базой. Включите анонимные входы в Supabase и выполните supabase/schema.sql.', live: 'Обновлено только что', loading: 'Загружаем…', yourBest: 'Ваш рекорд на этом устройстве'
  } : {
    title: 'Leaderboards', compare: 'Compare’It', weight: 'Specify the weight', today: 'Daily · today', total: 'Daily · total',
    subCompare: 'Best 5-round run (maximum 500).', subWeight: 'Best 5-round run (maximum 500).', subToday: 'Today’s results (UTC), maximum 100.', subTotal: 'Sum of points over all daily-question answers.',
    runs: 'runs', answers: 'answers', you: 'you', empty: 'Nobody here yet — be the first!', off: 'A database connection is needed. Enable anonymous sign-ins in Supabase and run supabase/schema.sql.', live: 'Just updated', loading: 'Loading…', yourBest: 'Your best on this device'
  };
  const TABS = [
    { k: 'compare', label: T.compare, sub: T.subCompare, score: r => r.best, extra: r => `${r.runs} ${T.runs}` },
    { k: 'weight', label: T.weight, sub: T.subWeight, score: r => r.best, extra: r => `${r.runs} ${T.runs}` },
    { k: 'today', label: T.today, sub: T.subToday, score: r => r.score, extra: () => '' },
    { k: 'total', label: T.total, sub: T.subTotal, score: r => r.total, extra: r => `${r.answered} ${T.answers}` }
  ];
  $('#title').textContent = T.title; document.title = T.title + ' — Vectra';
  const me = () => (S.get('nick', '') || '').toLowerCase(), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const medal = i => ['🥇', '🥈', '🥉'][i] || '#' + (i + 1);
  let cur = TABS[0].k; const cache = {};

  function draw(tab, rows) {
    $('#list').innerHTML = rows.length ? rows.map((r, i) => {
      const mine = (r.nickname || '').toLowerCase() === me(), sc = tab.score(r);
      return `<li><div class="ar-item lb-row${mine ? ' me' : ''}"><span class="lb-rank">${medal(i)}</span><span class="lb-nick">${esc(r.nickname)}${mine ? ` <em>${T.you}</em>` : ''}<small>${tab.extra(r)}</small></span><span class="ar-s ${sc >= (tab.k === 'compare' || tab.k === 'weight' ? 400 : tab.k === 'total' ? 1e9 : 80) ? 'good' : ''}">${sc}</span></div></li>`;
    }).join('') : `<li class="ar-empty">${T.empty}</li>`;
  }
  async function show(k) {
    cur = k; const tab = TABS.find(t => t.k === k);
    document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-selected', String(b.dataset.k === k)) });
    $('#sub').textContent = tab.sub; if (cache[k]) draw(tab, cache[k]); else $('#list').innerHTML = `<li class="ar-empty">${T.loading}</li>`;
    try {
      if (!(Vectra.db && Vectra.db.enabled())) throw new Error('offline');
      const rows = await Vectra.db.leaderboard(tab.k); cache[k] = rows; if (cur === k) { draw(tab, rows); $('#sync').textContent = T.live; $('#sync').classList.remove('off-line') }
    } catch (e) {
      console.info('[vectra] leaderboard:', e.message || e);
      if (cur === k) { $('#sync').textContent = '—'; $('#sync').classList.add('off-line'); const best = S.get('best', 0); $('#list').innerHTML = `<li class="ar-empty">${T.off}${best ? `<br><b>${T.yourBest}: ${best}</b>` : ''}</li>` }
    }
  }
  $('#tabs').innerHTML = TABS.map(t => `<button role="tab" data-k="${t.k}">${t.label}</button>`).join('');
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => show(b.dataset.k));
  show(cur);
})();
