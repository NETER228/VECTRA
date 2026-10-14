/* stats.js — личная статистика и никнейм. Источник — Supabase (get_my_stats); без связи показываем локальные данные. */
(function () {
  const $ = s => document.querySelector(s), S = Vectra.store, lang = Vectra.lang();
  const T = lang === 'ru' ? {
    title: 'Статистика', recent: 'Последние результаты', nick: 'Никнейм', save: 'Сменить никнейм', limit: 'Менять никнейм можно не чаще одного раза в 3 дня.', cTitle: 'Сменить никнейм?', cText: 'Новый никнейм: «{n}». После смены вы не сможете изменить его снова в течение 3 дней.', cOk: 'Сменить', cNo: 'Отмена', cool: 'Следующая смена будет доступна {d}.', same: 'Это ваш текущий никнейм.', synced: 'Синхронизировано с профилем', local: 'Только на этом устройстве',
    streak: 'Streak', days: 'дн.', best: 'рекорд', weight: 'Угадай вес', compare: 'Compare’It', runs: 'забегов', avg: 'в среднем', bestRun: 'лучший забег', daily: 'Вопрос дня', answered: 'ответов', perfect: 'почти идеальных (≥95)',
    bestOne: 'лучший ответ', rounds: 'Точность по раундам', roundsOf: 'средние очки за раунд', total: 'Всего очков', totalOf: 'за все игры на 5 раундов', empty: 'Пока нет результатов — сыграй первую игру!',
    ok: 'Никнейм сохранён', okLocal: 'Сохранено на этом устройстве. Подключение к базе не удалось.', taken: 'Этот никнейм уже занят', invalid: '3–20 символов: буквы, цифры, _ . -', saving: 'Сохраняем…', modeC: 'Compare’It', modeW: 'Угадай вес', modeD: 'Вопрос дня', maxC: '/ 500', maxD: '/ 100'
  } : {
    weight: 'Specify the weight', title: 'Statistics', recent: 'Recent results', nick: 'Nickname', save: 'Change nickname', limit: 'You can change your nickname once every 3 days.', cTitle: 'Change nickname?', cText: 'New nickname: “{n}”. After the change you will not be able to change it again for 3 days.', cOk: 'Change', cNo: 'Cancel', cool: 'The next change will be available on {d}.', same: 'This is your current nickname.', synced: 'Synced with your profile', local: 'This device only',
    streak: 'Streak', days: 'days', best: 'best', compare: 'Compare’It', runs: 'runs', avg: 'average', bestRun: 'best run', daily: 'Daily Question', answered: 'answered', perfect: 'near-perfect (≥95)',
    bestOne: 'best answer', rounds: 'Round accuracy', roundsOf: 'average points per round', total: 'Total points', totalOf: 'across all 5-round games', empty: 'No results yet — play your first game!',
    ok: 'Nickname saved', okLocal: 'Saved on this device. Could not reach the database.', taken: 'This nickname is already taken', invalid: '3–20 characters: letters, digits, _ . -', saving: 'Saving…', modeC: 'Compare’It', modeW: 'Specify the weight', modeD: 'Daily Question', maxC: '/ 500', maxD: '/ 100'
  };
  $('#title').textContent = T.title; document.title = T.title + ' — Vectra'; $('#nickLbl').textContent = T.nick; $('#saveNick').textContent = T.save; $('#nickLimit').textContent = T.limit; $('#recT').textContent = T.recent;

  /* ---------- локальный запасной вариант той же структуры, что отдаёт get_my_stats ---------- */
  function localStats() {
    const all = S.get('runs', []), runs = all.filter(r => r.mode === 'compare'), wruns = all.filter(r => r.mode === 'weight'), wsc = wruns.map(r => r.score), daily = Object.entries(S.get('daily', {})), sc = runs.map(r => r.score), ds = daily.map(([, v]) => v.s);
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    return {
      profile: { nickname: S.get('nick', '') }, streak: { current: S.get('streak', 0), best: S.get('streakBest', S.get('streak', 0)) },
      compare: { runs: sc.length, best: Math.max(0, ...sc), avg: avg(sc), total: sc.reduce((x, y) => x + y, 0) }, weight: { runs: wsc.length, best: Math.max(0, ...wsc), avg: avg(wsc), total: wsc.reduce((x, y) => x + y, 0) }, rounds: { count: (sc.length + wsc.length) * 5, avg: Math.round(avg(sc.concat(wsc)) / 5) },
      daily: { answered: ds.length, avg: avg(ds), best: Math.max(0, ...ds), perfect: ds.filter(x => x >= 95).length },
      recent: [...all.filter(r => r.mode !== 'daily').map(r => ({ mode: r.mode, score: r.score, t: r.t })), ...daily.map(([d, v]) => ({ mode: 'daily', score: v.s, t: d + 'T12:00:00Z' }))].sort((a, b) => b.t.localeCompare(a.t)).slice(0, 20)
    };
  }

  const tile = (cls, label, big, sub) => `<div class="st-tile ${cls}"><small>${label}</small><b>${big}</b><span>${sub}</span></div>`;
  function render(s, synced) {
    $('#sync').textContent = synced ? T.synced : T.local; $('#sync').classList.toggle('off-line', !synced);
    const nick = (s.profile && s.profile.nickname) || ''; $('#nick').value = nick; $('#av').textContent = (nick || '?').charAt(0).toUpperCase();
    if (nick) { S.set('nick', nick); dispatchEvent(new Event('vectra:profile')) }
    if (s.profile && s.profile.changed_at) { S.set('nickChangedAt', s.profile.changed_at); cooldownUI() }
    const st = s.streak || { current: 0, best: 0 }, w = s.weight || { runs: 0, best: 0, avg: 0, total: 0 };
    $('#tiles').innerHTML =
      tile('pk', T.streak, `${st.current} <em>${T.days}</em>`, `${T.best}: ${st.best}`) +
      tile('', T.compare, `${s.compare.best} <em>${T.maxC}</em>`, `${T.bestRun} · ${s.compare.runs} ${T.runs} · ${T.avg} ${s.compare.avg}`) +
      tile('', T.weight, `${w.best} <em>${T.maxC}</em>`, `${T.bestRun} · ${w.runs} ${T.runs} · ${T.avg} ${w.avg}`) +
      tile('', T.daily, `${s.daily.avg} <em>${T.maxD}</em>`, `${T.avg} · ${s.daily.answered} ${T.answered} · ${T.bestOne} ${s.daily.best} · ${T.perfect}: ${s.daily.perfect}`) +
      tile('', T.rounds, `${s.rounds.avg} <em>/ 100</em>`, `${T.roundsOf} (${s.rounds.count})`) +
      tile('', T.total, loc(s.compare.total + w.total), T.totalOf);
    const rec = s.recent || [];
    $('#chart').innerHTML = rec.length ? chart(rec.slice().reverse()) : '';
    const d = x => new Date(x).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('#recent').innerHTML = rec.length ? rec.map(r => { const five = r.mode !== 'daily', c = five ? r.score / 5 : r.score; return `<li><div class="ar-item st-row"><span class="ar-d"><b>${{ compare: T.modeC, weight: T.modeW, daily: T.modeD }[r.mode]}</b>${d(r.t)}</span><span class="ar-q"></span><span class="ar-s ${c >= 80 ? 'good' : c >= 40 ? 'mid' : 'bad'}">${r.score} ${five ? T.maxC : T.maxD}</span></div></li>` }).join('') : `<li class="ar-empty">${T.empty}</li>`;
  }
  const loc = n => n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
  function chart(rows) {   // столбики: 100% = максимум за игру (Compare’It делим на 5), розовый — Compare’It, зелёный — Daily
    const w = 28, g = 6, h = 96, W = Math.max(rows.length, 20) * (w + g);
    return `<svg viewBox="0 0 ${W} ${h + 4}" preserveAspectRatio="xMinYMax meet" role="img" aria-label="${T.recent}">` + rows.map((r, i) => {
      const v = r.mode !== 'daily' ? r.score / 5 : r.score, bh = Math.max(3, v / 100 * h);
      return `<rect x="${i * (w + g)}" y="${h - bh + 2}" width="${w}" height="${bh}" rx="5" class="${{ compare: 'bc', weight: 'bw', daily: 'bd' }[r.mode]}"><title>${{ compare: T.modeC, weight: T.modeW, daily: T.modeD }[r.mode]}: ${r.score}</title></rect>`;
    }).join('') + '</svg>';
  }

  /* ---------- загрузка ---------- */
  render(localStats(), false);
  if (Vectra.db && Vectra.db.enabled()) Vectra.db.stats().then(s => { if (s) render(s, true) }).catch(e => console.info('[vectra] offline stats:', e.message || e));

  /* ---------- никнейм ---------- */
  const msg = $('#nickMsg'), say = (t, c) => { msg.textContent = t; msg.className = 'dq-hint ' + (c || '') };
  const COOL = 3 * 864e5, fmtD = t => new Date(t).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const nextAt = () => { const c = S.get('nickChangedAt', ''); return c ? Date.parse(c) + COOL : 0 };
  function cooldownUI() { const n = nextAt(), lock = n > Date.now(); $('#saveNick').disabled = lock; if (lock) say(T.cool.replace('{d}', fmtD(n))); return lock }
  function confirmChange(n) {      // предупреждаем о лимите прямо перед сменой
    return new Promise(res => {
      document.body.insertAdjacentHTML('beforeend', `<div class="nm-back" id="ccBack"><div class="nm-card" role="alertdialog" aria-modal="true" aria-labelledby="ccT"><h2 id="ccT">${T.cTitle}</h2><p>${T.cText.replace('{n}', n.replace(/[<>&]/g, ''))}</p><div class="nm-btns"><button class="go" id="ccOk">${T.cOk}</button><button class="go alt" id="ccNo">${T.cNo}</button></div></div></div>`);
      const close = v => { document.getElementById('ccBack').remove(); res(v) }; document.getElementById('ccOk').onclick = () => close(true); document.getElementById('ccNo').onclick = () => close(false); document.getElementById('ccNo').focus();
    });
  }
  async function save() {
    const n = $('#nick').value.trim();
    if (n.length < 3 || n.length > 20 || !/^[A-Za-z0-9А-Яа-яЁё_.-]+$/.test(n)) return say(T.invalid, 'err');
    if (n === S.get('nick', '')) return say(T.same);
    if (cooldownUI()) return;
    if (!(await confirmChange(n))) return say('');
    say(T.saving); $('#saveNick').disabled = true;
    try {
      const p = await Vectra.db.setNickname(n, false); S.set('nick', p.nickname); S.set('nickChosen', true); S.set('nickPending', false); S.set('nickChangedAt', new Date().toISOString());
      $('#av').textContent = p.nickname.charAt(0).toUpperCase(); dispatchEvent(new Event('vectra:profile')); say(T.ok, 'ok'); $('#sync').textContent = T.synced; $('#sync').classList.remove('off-line');
    } catch (e) {
      const m = (e && e.message) || '', cd = m.match(/nickname_cooldown:(\S+)/);
      if (cd) { S.set('nickChangedAt', new Date(Date.parse(cd[1]) - COOL).toISOString()); cooldownUI(); return }      // сервер сам хранит время последней смены
      if (m.includes('nickname_taken')) say(T.taken, 'err'); else if (m.includes('invalid_nickname')) say(T.invalid, 'err');
      else { S.set('nick', n); S.set('nickChosen', true); S.set('nickPending', true); S.set('nickChangedAt', new Date().toISOString()); $('#av').textContent = n.charAt(0).toUpperCase(); dispatchEvent(new Event('vectra:profile')); say(T.okLocal) }
    } finally { if (nextAt() <= Date.now()) $('#saveNick').disabled = false; else cooldownUI() }
  }
  $('#saveNick').onclick = save; $('#nick').addEventListener('keydown', e => { if (e.key === 'Enter') save() });
  cooldownUI(); Vectra.syncNick(); if (location.hash === '#nick') { $('#nick').focus(); $('#nick').select() }
})();
