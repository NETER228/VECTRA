/* daily.js — Daily Question (и повтор вопросов из архива: daily.html?d=ГГГГ-ММ-ДД).
   Вопрос дня = Q.pick(номер_дня). Очки: 100·(1 − |log10(ответ/истина)|/2). Ответ вводится только цифрами + кнопки-множители. */
(function () {
  Vectra.loadQuestions().then(Q => {
    const $ = s => document.querySelector(s), S = Vectra.store, lang = Vectra.lang(), L = lang === 'ru' ? 0 : 1, F = Vectra.numFmt;
    const T = {
      ru: { title: 'Вопрос дня', ph: 'Ваш ответ…', chk: 'Сверить', today: 'Сегодня', arch: 'Архив', again: 'К архиву', mine: 'Ваш ответ', real: 'Правильный ответ', off: 'Ошибка', bad: 'Введите положительное число', next: 'Вернитесь завтра за новым вопросом', larger: 'раз больше', smaller: 'раз меньше', yrs: 'лет', approx: 'Ответ приближённый, очки считаются по порядку величины', you: 'Вы', ans: 'Ответ', prev: '← Прошлый вопрос', next2: 'Следующий вопрос →', errSave: 'Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.', tip: 'Вводите только цифры (дробную часть отделяйте запятой). Кнопки умножают число: K — тысяча, M — миллион, B — миллиард, T — триллион, Qa — квадриллион и так далее.', chips: 'Множитель' },
      en: { title: 'Daily Question', ph: 'Your answer…', chk: 'Check', today: 'Today', arch: 'Archive', again: 'To archive', mine: 'Your answer', real: 'Actual', off: 'Off by', bad: 'Enter a positive number', next: 'Come back tomorrow for a new one', larger: '× larger', smaller: '× smaller', yrs: 'years', approx: 'The answer is approximate; scoring is by order of magnitude', you: 'You', ans: 'Actual', prev: '← Previous question', next2: 'Next question →', errSave: 'Could not reach the server. Check your connection and try again.', tip: 'Type digits only (use a point for decimals). The buttons multiply your number: K — thousand, M — million, B — billion, T — trillion, Qa — quadrillion and so on.', chips: 'Multiplier' }
    }[lang];

    const today = Vectra.utcToday(); let date = new URLSearchParams(location.search).get('d') || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || Vectra.dayIndex(date) < 0) date = today;
    const idx = Vectra.dayIndex(date), q = Q.pick(idx), txt = q[L], ans = q[2], uk = q[3], unit = Q.units[uk][L], isToday = date === today, saved = S.get('daily', {});

    const fmtX = x => F.fmtNum(x, x >= 100 ? 0 : x >= 10 ? 1 : 2);
    const dateFmt = d => new Date(d + 'T00:00:00Z').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const toYears = { d: 365.25, h: 8766, min: 525960, s: 31557600 };
    $('#title').textContent = T.title; document.title = T.title + ' — Vectra';
    $('#dqDate').textContent = (isToday ? T.today + ' · ' : T.arch + ' · ') + dateFmt(date); $('#dqTag').textContent = '#' + (idx + 1);
    $('#dqQ').textContent = txt; $('#chk').textContent = T.chk; $('#dqTip').textContent = T.tip;

    /* ---------- ввод ---------- */
    const ni = Vectra.numInput($('#numin'), { unit, maxClass: 10, small: true, placeholder: T.ph, label: T.ph, chipsLabel: T.chips }), hint = $('#hint');
    function upd() {
      const v = ni.getValue(); hint.classList.remove('err'); if (!(v > 0) || !isFinite(v)) { hint.textContent = ''; return }
      hint.textContent = '= ' + F.describe(v) + ' ' + unit + (toYears[uk] && v / toYears[uk] >= 1 ? '  ≈ ' + F.fmtNum(v / toYears[uk], 1) + ' ' + T.yrs : '');
    }
    ni.onChange(upd); ni.input.addEventListener('keydown', e => { if (e.key === 'Enter') $('#chk').click() });

    /* ---------- результат ---------- */
    function axis(g, t) {   // логарифмическая шкала с точками «ответ» и «правда»
      const lo = Math.log10(Math.min(g, t)) - 1, hi = Math.log10(Math.max(g, t)) + 1, p = x => ((Math.log10(x) - lo) / (hi - lo)) * 100;
      const e0 = Math.ceil(lo), e1 = Math.floor(hi), step = Math.max(1, Math.ceil((e1 - e0 + 1) / 9)); let ticks = '';
      for (let e = e0; e <= e1; e += step) ticks += `<i class="tick" style="left:${(e - lo) / (hi - lo) * 100}%"><s>10<sup>${e}</sup></s></i>`;
      return `<div class="axis">${ticks}<i class="dot g" data-p="${p(g)}"><s>${T.you}</s></i><i class="dot t" data-p="${p(t)}"><s>${T.ans}</s></i></div>`;
    }
    function show(g, anim, srvPts) {
      const err = Math.abs(Math.log10(g / ans)), pts = srvPts == null ? Math.max(0, Math.round(100 * (1 - err / 2))) : srvPts, pct = Math.abs(g - ans) / ans * 100, r = g / ans;
      const cls = pts >= 80 ? 'good' : pts >= 40 ? 'mid' : 'bad', res = $('#res');
      res.innerHTML = `<div class="rcard inline ${cls}"><div class="rscore"><b id="rS">${anim ? 0 : pts}</b><span> / 100</span></div>
        <div class="rl">${T.mine}: <b>${F.describe(g)} ${unit}</b></div><div class="rl">${T.real}: <b>≈ ${F.describe(ans)} ${unit}</b></div>
        <div class="rm">${T.off} ${pct < 1000 ? Math.round(pct) + '%' : '×' + fmtX(Math.pow(10, err))} · ${r >= 1 ? fmtX(r) + ' ' + T.larger : fmtX(1 / r) + ' ' + T.smaller}</div></div>
        ${axis(g, ans)}<p class="dq-note">${T.approx}. ${isToday ? T.next : ''}</p><a class="again" href="archive.html">${T.again}</a>`;
      $('#play').classList.add('off'); res.classList.remove('off');
      const sb = Vectra.shareBlock({ title: T.title + ' #' + (idx + 1), score: pts, max: 100, pts: [pts], isBest: false }); sb.style.marginTop = '14px'; res.querySelector('.again').before(sb); if (anim) Vectra.sfx.play('reveal', pts / 100);
      requestAnimationFrame(() => { res.querySelector('.rcard').classList.add('on'); setTimeout(() => res.querySelectorAll('.dot').forEach(d => d.style.left = d.dataset.p + '%'), 150) });
      if (anim) { const t0 = performance.now(), el = $('#rS'); (function f(n) { const k = Math.min(1, (n - t0 - 350) / 1000); el.textContent = Math.round(pts * (1 - Math.pow(1 - Math.max(0, k), 3))); if (k < 1) requestAnimationFrame(f) })(t0) }
      return pts;
    }
    const mark = () => { $('#dqTag').textContent = '#' + (idx + 1) + ' · ✓' };
    $('#chk').onclick = async () => {
      const g = ni.getValue(); if (!(g > 0) || !isFinite(g)) { hint.textContent = T.bad; hint.classList.add('err'); ni.focus(); return }
      hint.classList.remove('err'); $('#chk').disabled = true; ni.setDisabled(true);
      try {                       // сервер проверит, что этот вопрос ещё не решён, и сам посчитает очки
        const r = await Vectra.db.submitDaily(date, Q.idxOf(idx), g, ans);
        Vectra.fairplay && Vectra.fairplay.off(); saved[date] = { g: r.guess, s: r.score }; S.set('daily', saved); show(r.guess, !r.already, r.score); if (r.already) mark();
      } catch (e) { console.warn('[vectra] daily not saved:', e.message || e); $('#chk').disabled = false; ni.setDisabled(false); hint.textContent = T.errSave; hint.classList.add('err') }
    };

    /* ---------- «прошлый / следующий вопрос» ---------- */
    const addDay = n => new Date((Vectra.dayNum(date) + n) * 864e5).toISOString().slice(0, 10), prevD = addDay(-1), nextD = addDay(1);
    function nav(el, d, can, label) {
      el.textContent = label + (saved[d] ? '  ✓' : '');
      if (can) el.href = 'daily.html?d=' + d; else { el.removeAttribute('href'); el.classList.add('dis'); el.setAttribute('aria-disabled', 'true') }
    }
    nav($('#prevQ'), prevD, Vectra.dayIndex(prevD) >= 0, T.prev); nav($('#nextQ'), nextD, nextD <= today, T.next2);

    /* ---------- каждый вопрос: решал ли его игрок — спрашиваем сервер ---------- */
    (async () => {
      let st; try { st = await Vectra.db.daily(date) } catch (e) { console.warn('[vectra] daily check failed:', e.message || e); hint.textContent = T.errSave; hint.classList.add('err'); $('#chk').disabled = true; ni.setDisabled(true); return }
      if (st.answered) { saved[date] = { g: st.g, s: st.s }; S.set('daily', saved); show(st.g, false, st.s); mark() } else { ni.focus(); Vectra.fairplay && Vectra.fairplay.on() }
    })();
  }).catch(e => { const el = document.getElementById('dqQ'); if (el) el.textContent = 'Не удалось загрузить data/questions.json — запусти сайт через сервер: python3 -m http.server'; console.error(e) });
})();
