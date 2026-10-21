/* stats.js — личная статистика и никнейм. Источник — Supabase (get_my_stats); без связи показываем локальные данные. */
(function () {
  const $ = s => document.querySelector(s), S = Vectra.store, lang = Vectra.lang();
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const T = lang === 'ru' ? {
    title: 'Статистика', recent: 'Последние результаты', nick: 'Никнейм', save: 'Сменить никнейм', limit: 'Менять никнейм можно не чаще одного раза в 3 дня.', cTitle: 'Сменить никнейм?', cText: 'Новый никнейм: «{n}». После смены вы не сможете изменить его снова в течение 3 дней.', cOk: 'Сменить', cNo: 'Отмена', cool: 'Следующая смена будет доступна {d}.', same: 'Это ваш текущий никнейм.', errSave: 'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.', synced: 'Синхронизировано с профилем', local: 'Нет связи с базой',
    streak: 'Streak', days: 'дн.', best: 'рекорд', weight: 'Угадай вес', compare: 'Compare’It', runs: 'забегов', avg: 'в среднем', bestRun: 'лучший забег', daily: 'Вопрос дня', answered: 'ответов', perfect: 'почти идеальных (≥95)',
    bestOne: 'лучший ответ', rounds: 'Точность по раундам', roundsOf: 'средние очки за раунд', total: 'Всего очков', totalOf: 'за все игры на 5 раундов', empty: 'Пока нет результатов — сыграй первую игру!',
    ok: 'Никнейм сохранён', okLocal: 'Сохранено на этом устройстве. Подключение к базе не удалось.', taken: 'Этот никнейм уже занят', invalid: '3–20 символов: буквы, цифры, _ . -', saving: 'Сохраняем…', modeC: 'Compare’It', modeW: 'Угадай вес', modeD: 'Вопрос дня', maxC: '/ 500', maxD: '/ 100'
  } : {
    weight: 'Specify the weight', title: 'Statistics', recent: 'Recent results', nick: 'Nickname', save: 'Change nickname', limit: 'You can change your nickname once every 3 days.', cTitle: 'Change nickname?', cText: 'New nickname: “{n}”. After the change you will not be able to change it again for 3 days.', cOk: 'Change', cNo: 'Cancel', cool: 'The next change will be available on {d}.', same: 'This is your current nickname.', errSave: 'Could not reach the server. Check your connection and try again.', synced: 'Synced with your profile', local: 'No connection',
    streak: 'Streak', days: 'days', best: 'best', compare: 'Compare’It', runs: 'runs', avg: 'average', bestRun: 'best run', daily: 'Daily Question', answered: 'answered', perfect: 'near-perfect (≥95)',
    bestOne: 'best answer', rounds: 'Round accuracy', roundsOf: 'average points per round', total: 'Total points', totalOf: 'across all 5-round games', empty: 'No results yet — play your first game!',
    ok: 'Nickname saved', okLocal: 'Saved on this device. Could not reach the database.', taken: 'This nickname is already taken', invalid: '3–20 characters: letters, digits, _ . -', saving: 'Saving…', modeC: 'Compare’It', modeW: 'Specify the weight', modeD: 'Daily Question', maxC: '/ 500', maxD: '/ 100'
  };
  $('#title').textContent = T.title; document.title = T.title + ' — Vectra'; $('#nickLbl').textContent = T.nick; $('#saveNick').textContent = T.save; $('#nickLimit').textContent = T.limit; $('#recT').textContent = T.recent;

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
    // Подтягиваем текст вопроса для Daily: recent из get_my_stats содержит только t/mode/score,
    // поэтому сопоставляем строки с ответами из daily_answers по точному времени answered_at.
    rec.forEach(r => {
      if (r.mode !== 'daily') { r._qtext = ''; return }
      const det = r._d || null;
      const q = det && s._Q && det.q_idx != null ? s._Q.list[det.q_idx] : null;
      r._qtext = q ? (lang === 'ru' ? q[0] : q[1]) : '';
    });
    const daily = rec.filter(r => r.mode === 'daily').slice().reverse();
    const others = rec.filter(r => r.mode !== 'daily').slice().reverse();
    $('#chart').innerHTML = !rec.length ? '' : `
      ${daily.length ? `<div class="chart-group">
        <h4 data-i18n="stats.chartDaily">${T.modeD} (0–100)</h4>
        <div id="chartDaily">${lineChart(daily, 100)}</div>
      </div>` : ''}
      ${others.length ? `<div class="chart-group">
        <h4 data-i18n="stats.chartOthers">${T.modeC} · ${T.modeW} (0–500)</h4>
        <div id="chartOthers">${lineChart(others, 500)}</div>
      </div>` : ''}`;
    if (!document.getElementById('chartTip')) document.body.insertAdjacentHTML('beforeend', '<div class="chart-tooltip" id="chartTip"></div>');
    const d = x => new Date(x).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    $('#recent').innerHTML = rec.length ? rec.map(r => {
      const five = r.mode !== 'daily', c = five ? r.score / 5 : r.score, q = r._qtext || '';
      const date = new Date(r.t).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
      return `<li><div class="ar-item st-row candle-link" data-key="${esc(r.t)}" data-mode="${esc(r.mode)}" data-score="${r.score}" data-date="${esc(date)}"><span class="ar-d"><b>${{ compare: T.modeC, weight: T.modeW, daily: T.modeD }[r.mode]}</b>${d(r.t)}</span><span class="ar-q"${q ? ` title="${esc(q)}"` : ''}>${esc(q)}</span><span class="ar-s ${c >= 80 ? 'good' : c >= 40 ? 'mid' : 'bad'}">${r.score} ${five ? T.maxC : T.maxD}</span></div></li>`;
    }).join('') : `<li class="ar-empty">${T.empty}</li>`;
    wireCandles(rec.length);
  }
  const loc = n => n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
  function lineChart(rows, maxScale = 100) {   // красивый линейный граф по очкам
    if (!rows.length) return `<div class="candles empty">${T.empty}</div>`;
    const pad = { l: 34, r: 10, t: 20, b: 30 };
    const W = Math.max(320, Math.round($('#chart')?.clientWidth || 640));
    const H = 150;
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const vals = rows.map(r => r.score);  // raw score, already on proper scale
    const maxV = Math.max(maxScale, ...vals);
    const x = (i, n) => n === 1 ? pad.l + innerW / 2 : pad.l + (i / (n - 1)) * innerW;
    const y = v => H - pad.b - (v / maxV) * innerH;
    const modeColor = { compare: 'var(--pink)', weight: 'var(--ind)', daily: 'var(--green)' };
    // grid lines: 0, 25%, 50%, 75%, 100% of maxScale
    const gridSteps = [0, maxScale * 0.25, maxScale * 0.5, maxScale * 0.75, maxScale];
    const grid = gridSteps.map(v => {
      const yy = y(v);
      return `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" class="chart-grid"/><text x="${pad.l - 8}" y="${yy + 4}" text-anchor="end">${Math.round(v)}</text>`;
    }).join('');
    const firstColor = modeColor[rows[0].mode] || 'var(--pink)';
    const gradId = 'grad' + maxScale;
    // area under line
    const areaPts = rows.map((r, i) => `${x(i, rows.length)},${y(vals[i])}`).join(' ');
    const area = `<path d="M${pad.l},${H - pad.b} L${areaPts} L${x(rows.length - 1, rows.length)},${H - pad.b} Z" fill="url(#${gradId})" class="chart-area"/>`;
    // line path — цвет от первого пункта
    const linePts = rows.map((r, i) => `${x(i, rows.length)},${y(vals[i])}`).join(' L');
    const line = `<path d="M${linePts}" class="chart-path" stroke="${firstColor}"/>`;
    // dots
    const dots = rows.map((r, i) => {
      const v = vals[i];
      const color = modeColor[r.mode] || 'var(--pink)';
      const date = new Date(r.t).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short' });
      const modeLbl = { compare: T.modeC, weight: T.modeW, daily: T.modeD }[r.mode];
      return `<circle cx="${x(i, rows.length)}" cy="${y(v)}" data-index="${i}" data-key="${esc(r.t)}" data-score="${r.score}" data-date="${esc(date)}" data-mode="${esc(r.mode)}" data-modeLbl="${esc(modeLbl)}" data-q="${esc(r._qtext || '')}" class="chart-dot" fill="${color}"/>`;
    }).join('');
    return `<div class="st-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T.recent}"><defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${firstColor}" stop-opacity=".35"/><stop offset="100%" stop-color="${firstColor}" stop-opacity="0"/></linearGradient></defs><g class="chart-grid">${grid}</g>${area}${line}${dots}</svg></div>`;
  }
  function wireCandles(n) {
    const list = $('#recent'), tip = $('#chartTip');
    if (!list) return;
    // collect all dots from both SVGs
    const allDots = [];
    document.querySelectorAll('#chartDaily svg, #chartOthers svg').forEach(svg => {
      svg.querySelectorAll('.chart-dot').forEach(d => allDots.push(d));
    });
    const showTip = (dot, html) => {
      tip.textContent = ''; tip.insertAdjacentHTML('beforeend', html); tip.classList.add('on');
      const r = dot.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      // держим подсказку внутри окна, чтобы она не обрезалась у краёв графа
      const cx = Math.max(tw / 2 + 8, Math.min(r.left + r.width / 2, innerWidth - tw / 2 - 8));
      const above = r.top - th - 14 >= 8;
      tip.classList.toggle('below', !above);
      tip.style.left = cx + 'px';
      tip.style.top = (above ? r.top : r.bottom) + 'px';
    };
    const hideTip = () => { tip.classList.remove('on') };
    // Подсветка идёт только от графа к строке: наведение на строку граф не трогает.
    const setActive = key => {
      allDots.forEach(d => d.classList.toggle('active', d.dataset.key === key));
      list.querySelectorAll('.candle-link').forEach(li => li.classList.toggle('active', li.dataset.key === key));
    };
    document.querySelectorAll('#chartDaily svg, #chartOthers svg').forEach(svg => {
      const dots = svg.querySelectorAll('.chart-dot');
      svg.addEventListener('mousemove', e => {
        const rect = svg.getBoundingClientRect();
        const vbW = svg.viewBox.baseVal.width || rect.width;
        const mx = (e.clientX - rect.left) * (vbW / rect.width);
        let best = null, bestDist = Infinity;
        dots.forEach(d => { const dx = Math.abs(+d.getAttribute('cx') - mx); if (dx < bestDist) { bestDist = dx; best = d } });
        if (best && bestDist < 22) {
          setActive(best.dataset.key);
          const q = best.dataset.q || '';
          const html = `${q ? `<div class="chart-tip-q">${esc(q)}</div>` : ''}<div><b>${best.dataset.score}</b> · ${esc(best.dataset.modeLbl)}</div><div class="chart-tip-d">${esc(best.dataset.date)}</div>`;
          showTip(best, html);
        } else { setActive(''); hideTip() }
      });
      svg.addEventListener('mouseleave', () => { setActive(''); hideTip() });
    });
  }

  /* ---------- загрузка ---------- */
  Vectra.db.stats().then(async s => {
    try {
      const [answers, Q] = await Promise.all([
        Vectra.db.dailyAnswers().catch(() => []),
        Vectra.loadQuestions().catch(() => null)
      ]);
      const byTime = new Map((answers || []).map(a => [a.answered_at, a]));
      const byKey = new Map((answers || []).map(a => [Date.parse(a.answered_at) + '|' + a.score, a]));
      (s.recent || []).forEach(r => { if (r.mode === 'daily') r._d = byTime.get(r.t) || byKey.get(Date.parse(r.t) + '|' + r.score) || null });
      s._Q = Q;
    } catch (e) { console.info('[vectra] daily details unavailable:', e.message || e) }
    render(s, true);
  }).catch(e => { console.info('[vectra] stats unavailable:', e.message || e); $('#sync').textContent = T.local; $('#sync').classList.add('off-line'); $('#tiles').innerHTML = `<p class="dq-note">${T.errSave}</p>` });

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
      const p = await Vectra.db.setNickname(n, false); S.set('nick', p.nickname); S.set('nickChosen', true); S.set('nickChangedAt', new Date().toISOString());
      $('#av').textContent = p.nickname.charAt(0).toUpperCase(); dispatchEvent(new Event('vectra:profile')); say(T.ok, 'ok'); $('#sync').textContent = T.synced; $('#sync').classList.remove('off-line');
    } catch (e) {
      const m = (e && e.message) || '', cd = m.match(/nickname_cooldown:(\S+)/);
      if (cd) { S.set('nickChangedAt', new Date(Date.parse(cd[1]) - COOL).toISOString()); cooldownUI(); return }      // сервер сам хранит время последней смены
      if (m.includes('nickname_taken')) say(T.taken, 'err'); else if (m.includes('invalid_nickname')) say(T.invalid, 'err');
      else say(T.errSave, 'err');
    } finally { if (nextAt() <= Date.now()) $('#saveNick').disabled = false; else cooldownUI() }
  }
  $('#saveNick').onclick = save; $('#nick').addEventListener('keydown', e => { if (e.key === 'Enter') save() });
  cooldownUI(); if (location.hash === '#nick') { $('#nick').focus(); $('#nick').select() }
})();
