/* weight.js — «Specify the weight»: объект стоит на весах, игрок задаёт массу.
   Три способа ввода, все связаны: стрелка на циферблате, ползунок и поле (только цифры + множители x1K … x1Td).
   Шкала логарифмическая: 1 кг … 10⁴² кг, 270°. Очки: 100·(1 − |log10(ответ/истина)|/2). Объекты — data/objects.json (поле mass). */
(function () {
  Vectra.loadObjects().then(DATA => {
    const $ = s => document.querySelector(s), tr = Vectra.t, lang = Vectra.lang(), S = Vectra.store, F = Vectra.numFmt, ROUNDS = 5, LMAX = 42, A0 = -135, SPAN = 270;
    const SH = {}; VECTRA_SHAPES.forEach(s => { s.P = s.paths.map(d => new Path2D(d)); SH[s.id] = s });
    const OBJ = DATA.filter(o => o.mass).map(o => ({ id: o.id, shape: o.shape, cat: o.cat, name: o[lang], m: o.mass, note: lang === 'ru' ? o.noteRu : o.noteEn }));
    const KG = tr('w.kg'), ease = t => 1 - Math.pow(1 - t, 3), SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };

    /* ---------- состояние ---------- */
    const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage'), descs = $('#descs'), go = $('#go'), rc = $('#rcard'), sl = $('#wSl'), guessBox = $('#wGuess');
    let W = 0, H = 0, g = {}, col = {}, val = 1e21, disp = 21, phase = 'guess', drag = false, pts = 0, resT = 0, shown = -1, cur = null, G = { round: 0, score: 0, objs: [], log: [] };
    const lg = () => Math.log10(val);
    const ni = Vectra.numInput($('#numin'), { unit: KG, maxClass: 14, small: false, placeholder: tr('w.ph'), label: tr('w.label'), chipsLabel: tr('w.chips') });
    $('#wMin').textContent = '1 ' + KG; $('#wMax').textContent = F.words(1e42) + ' ' + KG; $('#wTip').textContent = tr('w.tip');

    function readCols() { const s = getComputedStyle(document.documentElement), q = n => s.getPropertyValue(n).trim(); col = { bg: q('--bg'), card2: q('--card2'), pink: q('--pink'), green: q('--green'), tx: q('--tx'), mut: q('--mut'), ind: q('--ind2') } }
    function resize() {
      const r = Math.min(devicePixelRatio || 1, 2), b = stage.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0);
      const s = Math.max(.55, Math.min(1.15, (H - 130) / 330, W / 330)), cx = W / 2, floor = H - 70, footY = floor - 16 * s, bodyBot = footY, bodyTop = bodyBot - 190 * s, panY = bodyTop - 28 * s;
      g = { s, cx, floor, footY, bodyTop, bodyBot, panY, dcx: cx, dcy: bodyTop + 96 * s, dr: 66 * s };
    }

    /* ---------- рисование ---------- */
    const ang = l => (A0 + SPAN * l / LMAX) * Math.PI / 180, pt = (r, a) => [g.dcx + r * Math.sin(a), g.dcy - r * Math.cos(a)];
    function silhouette() {
      const sh = SH[cur.shape], b = sh.body, tall = b.dim === 'h', bw = b.w || b.ref, bhh = b.bottom - b.top;
      const k = Math.min((tall ? 190 : 150) * g.s / bw, Math.min(tall ? 215 * g.s : 1e9, g.panY - 64) / bhh);
      ctx.save(); ctx.translate(g.cx - b.left * k - bw * k / 2, g.panY - b.bottom * k); ctx.scale(k, k); ctx.transform(...sh.tf);
      ctx.fillStyle = col.pink; for (const p of sh.P) ctx.fill(p, sh.rule); ctx.restore();
    }
    function scale() {
      const { s, cx } = g; ctx.strokeStyle = col.tx; ctx.lineWidth = 2.5 * Math.max(.8, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.fillStyle = col.card2;
      ctx.beginPath(); ctx.roundRect(cx - 95 * s, g.panY, 190 * s, 13 * s, 6 * s); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 20 * s, g.panY + 13 * s); ctx.lineTo(cx - 20 * s, g.bodyTop); ctx.moveTo(cx + 20 * s, g.panY + 13 * s); ctx.lineTo(cx + 20 * s, g.bodyTop); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 100 * s, g.bodyTop); ctx.lineTo(cx + 100 * s, g.bodyTop); ctx.lineTo(cx + 128 * s, g.bodyBot); ctx.lineTo(cx - 128 * s, g.bodyBot); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(cx - 90 * s, g.footY, 180 * s, 16 * s, 7 * s); ctx.fill(); ctx.stroke();
    }
    function dial(now) {
      const { dcx, dcy, dr, s } = g; ctx.fillStyle = col.bg; ctx.strokeStyle = col.tx; ctx.lineWidth = 2 * Math.max(.8, s);
      ctx.beginPath(); ctx.arc(dcx, dcy, dr, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = col.mut; ctx.fillStyle = col.mut; ctx.font = `700 ${Math.max(7, 8 * s)}px Quicksand,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let l = 0; l <= LMAX; l++) { const a = ang(l), major = l % 3 === 0, [x1, y1] = pt(dr - 3 * s, a), [x2, y2] = pt(dr - (major ? 9 : 5) * s, a); ctx.lineWidth = major ? 1.8 : 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke() }
      for (let l = 0; l <= LMAX; l += 3) { const [x, y] = pt(dr - 18 * s, ang(l)); ctx.fillText(l ? F.ABBR[l / 3] : '1', x, y) }       // K, M, B, T, Qa … — те же подписи, что на кнопках
      ctx.textBaseline = 'alphabetic';
      const needle = (l, c, w) => { const a = ang(Math.max(0, Math.min(LMAX, l))), [x, y] = pt(dr * .78, a); ctx.strokeStyle = c; ctx.lineWidth = w * Math.max(.8, s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(dcx, dcy); ctx.lineTo(x, y); ctx.stroke() };
      if (phase === 'result') { ctx.globalAlpha = .95; needle(Math.log10(cur.m) * ease(Math.min(1, (now - resT) / 1400)), col.green, 3); ctx.globalAlpha = 1 }
      needle(disp, col.pink, 3.5); ctx.fillStyle = col.tx; ctx.beginPath(); ctx.arc(dcx, dcy, 5 * s, 0, 7); ctx.fill();
    }
    let prev = performance.now();
    function frame(now) {
      const dt = Math.min(.05, (now - prev) / 1000); prev = now; disp += (lg() - disp) * Math.min(1, dt * 12);
      ctx.clearRect(0, 0, W, H); ctx.setLineDash([]); ctx.strokeStyle = col.ind; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, g.floor + .5); ctx.lineTo(W, g.floor + .5); ctx.stroke();
      silhouette(); scale(); dial(now);
      if (phase === 'result') { const v = Math.round(pts * ease(Math.max(0, Math.min(1, (now - resT - 350) / 1000)))); if (v !== shown) { shown = v; $('#rS').textContent = v } }
      requestAnimationFrame(frame);
    }

    /* ---------- ввод: стрелка, ползунок и поле всегда показывают одно и то же ---------- */
    function setVal(v, from) {
      val = Math.max(1, Math.min(1e42, v)); if (from !== 'sl') sl.value = lg(); if (from !== 'in') ni.setValue(val, true);
      $('#wBigV').textContent = F.words(val); $('#wBigU').textContent = KG; $('#wFull').textContent = F.describe(val) + (val < 1e4 ? '' : '');
      $('#wFull').classList.remove('err');
    }
    sl.addEventListener('input', () => setVal(10 ** +sl.value, 'sl'));
    ni.onChange(v => { if (v >= 1 && v <= 1e42) setVal(v, 'in'); else if (isFinite(v) && v > 0) { $('#wFull').textContent = tr('w.bad'); $('#wFull').classList.add('err') } });
    function fromPointer(e) {
      const r = stage.getBoundingClientRect(), dx = e.clientX - r.left - g.dcx, dy = e.clientY - r.top - g.dcy, a = Math.atan2(dx, -dy) * 180 / Math.PI;      // 0 = вверх
      setVal(10 ** ((Math.max(-135, Math.min(135, a)) - A0) / SPAN * LMAX));
    }
    cv.addEventListener('pointerdown', e => { if (phase !== 'guess') return; const r = stage.getBoundingClientRect(); if (Math.hypot(e.clientX - r.left - g.dcx, e.clientY - r.top - g.dcy) > g.dr + 26 * g.s) return; drag = true; cv.setPointerCapture(e.pointerId); fromPointer(e) });
    cv.addEventListener('pointermove', e => { if (drag) fromPointer(e) });
    const up = () => { drag = false }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { if (phase !== 'guess') return; e.preventDefault(); setVal(10 ** Math.max(0, Math.min(LMAX, lg() - e.deltaY * .0025))) }, { passive: false });
    ni.input.addEventListener('keydown', e => { if (e.key === 'Enter') go.click() });

    /* ---------- игра ---------- */
    const setPill = () => { $('#rd').textContent = Math.min(G.round + 1, ROUNDS) + '/' + ROUNDS; $('#sc').textContent = G.score };
    function pickObjs() {                 // 5 разных объектов, не больше двух из одной категории
      const left = OBJ.slice().sort(() => Math.random() - .5), out = [], cnt = {};
      for (const o of left) if (out.length < ROUNDS && (cnt[o.cat] || 0) < 2) { out.push(o); cnt[o.cat] = (cnt[o.cat] || 0) + 1 }
      return out;
    }
    function startRound() {
      cur = G.objs[G.round]; phase = 'guess'; shown = -1; ni.reset(); ni.setDisabled(false); sl.disabled = false; setVal(1e21); disp = lg();
      rc.classList.remove('on'); rc.style.display = 'none'; guessBox.style.display = ''; stage.classList.remove('res');
      $('#wTop').textContent = `${cur.name} — ${cur.note || tr('w.cat.' + cur.cat)}`;
      descs.innerHTML = `<div><span class="pk">${tr('w.desc', { name: cur.name })}</span></div><div class="gr"><em>${tr('w.hint')}</em></div>`;
      go.textContent = tr('w.toWeigh'); setPill(); Vectra.fairplay && Vectra.fairplay.on();
    }
    function newGame() { G = { round: 0, score: 0, objs: pickObjs(), log: [] }; $('#end').classList.add('off'); go.disabled = false; startRound() }
    const times = r => r < 1e4 ? F.fmtNum(r, r < 10 ? 2 : r < 100 ? 1 : 0) : F.words(r);
    function weigh() {
      const v = ni.getValue(); if (!(v >= 1 && v <= 1e42)) { $('#wFull').textContent = tr('w.bad'); $('#wFull').classList.add('err'); ni.focus(); return }
      val = v; const t = cur.m, err = Math.abs(Math.log10(val / t)), pct = Math.abs(val - t) / t * 100;
      pts = Math.max(0, Math.round(100 * (1 - err / 2))); G.score += pts; G.log.push({ k: cur.id, g: val, t }); phase = 'result'; resT = performance.now(); shown = -1; setPill(); Vectra.fairplay && Vectra.fairplay.off();
      ni.setDisabled(true); sl.disabled = true; guessBox.style.display = 'none'; rc.style.display = '';
      $('#rS').textContent = 0; rc.className = 'rcard inline ' + (pts >= 80 ? 'good' : pts >= 40 ? 'mid' : 'bad');
      $('#rA').textContent = F.describe(val) + ' ' + KG; $('#rT').textContent = F.describe(t) + ' ' + KG;
      $('#rO').textContent = tr('c.off', { x: pct < 1000 ? Math.round(pct) + '%' : '×' + times(Math.pow(10, err)) }); $('#rR').textContent = tr(val >= t ? 'w.hi' : 'w.lo', { x: times(val >= t ? val / t : t / val) });
      requestAnimationFrame(() => rc.classList.add('on')); stage.classList.add('res'); go.textContent = tr(G.round + 1 < ROUNDS ? 'c.next' : 'c.finish');
    }
    function next() { if (G.round + 1 < ROUNDS) { G.round++; startRound() } else finish() }
    function finish() {
      const best = S.get('best', 0), isBest = G.score > best; if (isBest) S.set('best', G.score); Vectra.markPlayed(); Vectra.addRun('weight', G.score);
      $('#endS').textContent = G.score; $('#endP').textContent = isBest ? tr('c.newBest') : tr('c.best', { n: best }); $('#endSync').textContent = tr('c.local');
      if (Vectra.db && Vectra.db.enabled()) Vectra.db.submitRun('weight', G.log).then(r => { if (r) $('#endSync').textContent = tr('c.synced') }).catch(e => console.info('[vectra] run not synced:', e.message || e));
      go.disabled = true; $('#end').classList.remove('off'); $('#again').focus();
    }
    go.onclick = () => phase === 'guess' ? weigh() : next(); $('#again').onclick = newGame;
    $('#helpBtn').onclick = e => { const h = $('#how'); h.hidden = !h.hidden; e.currentTarget.setAttribute('aria-expanded', String(!h.hidden)) };

    new ResizeObserver(resize).observe(stage); addEventListener('vectra:theme', readCols);
    readCols(); resize(); newGame(); requestAnimationFrame(frame);
  }).catch(e => { console.error(e); document.getElementById('descs').textContent = 'Не удалось загрузить data/objects.json — запусти сайт через сервер: python3 -m http.server' });
})();
