/* compare.js — Compare’It: объект A показан в масштабе, объект B игрок двигает и растягивает.
   B перемещается перетаскиванием за тело, размер меняется ТОЛЬКО ползунком (ручкой на линейке).
   Очки: 100 · (1 − |log10(догадка / истина)| / 2), от 0 до 100 за раунд. */
(function () {
  Vectra.loadObjects().then(DATA => {
  const $ = s => document.querySelector(s), ROUNDS = 5, GAP = 22, BAND = 26, tr = Vectra.t, lang = Vectra.lang();
  const SH = {}; VECTRA_SHAPES.forEach(s => { s.P = s.paths.map(d => new Path2D(d)); SH[s.id] = s });

  // объекты — data/objects.json (size.m — метры). Размер: диаметр / длина / высота (у башен и зданий — высота, см. n.* в i18n.js)
  const OBJ = DATA.filter(o => o.size).map(o => ({ id: o.id, shape: o.shape, cat: o.cat, name: o[lang], len: o.size.m, noun: tr(o.size.noun) }));
  const ww = o => { const b = SH[o.shape].body; return b.w ? b.w / b.ref : 1 };      // ширина силуэта в долях измеряемого размера

  /* ---------- форматирование ---------- */
  const loc = (n, d = 0) => n.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: d });
  function fmtLen(m) {
    if (m < 1e-2) return loc(m * 1e3, 2) + ' ' + tr('u.mm'); if (m < 1) return loc(m * 100, 1) + ' ' + tr('u.cm'); if (m < 1e3) return loc(m, 1) + ' ' + tr('u.m');
    if (m >= 1e11) { const au = m / 1.495978707e11; return loc(au, au < 10 ? 2 : au < 1000 ? 1 : 0) + ' ' + tr('u.au') }
    const km = m / 1e3; return km < 1e6 ? loc(km, km < 100 ? 1 : 0) + ' ' + tr('u.km') : loc(km / 1e6, 2) + ' ' + tr('u.mkm');
  }
  function fmtX(x) { return x >= 1000 ? loc(Math.round(x)) : x >= 100 ? String(Math.round(x)) : x >= 10 ? String(+x.toFixed(1)) : String(+x.toFixed(2)) }
  const rel = r => tr(r >= 1 ? 'c.larger' : 'c.smaller', { x: fmtX(r >= 1 ? r : 1 / r) });
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* ---------- подбор пар: сложность растёт от раунда к раунду ---------- */
  function pickPairs() {
    const tiers = [[.05, 1], [.25, 1.7], [1, 2.6], [1.5, 4.2], [3, 10]], used = new Map(), res = [];
    for (const [lo, hi] of tiers) {
      let c = [];
      const astro = o => ['star', 'planet', 'exo', 'bh'].includes(o.cat);
      const tiny = o => o.cat === 'animal' || o.cat === 'item';
      for (const a of OBJ) for (const b of OBJ) { if (a === b || (tiny(a) && astro(b)) || (tiny(b) && astro(a))) continue; const lr = Math.abs(Math.log10(b.len / a.len)); if (lr >= lo && lr <= hi) c.push([a, b, (used.get(a) || 0) + (used.get(b) || 0)]) }
      const m = Math.min(...c.map(x => x[2])); c = c.filter(x => x[2] === m);
      const [a, b] = c[Math.random() * c.length | 0];
      used.set(a, (used.get(a) || 0) + 1); used.set(b, (used.get(b) || 0) + 1); res.push({ A: a, B: b });
    }
    return res;
  }

  /* ---------- состояние ---------- */
  const cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage'), descs = $('#descs'), go = $('#go'), zl = $('#zl'), rc = $('#rcard');
  let W = 0, H = 0, x0 = 0, ground = 0, col = {};
  let lz = 0, tlz = 0, z = 1, ox = 0, ax = 0, fit = false, tox = 0, z0 = 1, lzMin = 0, lzMax = 0, gridM = 1;   // камера: x_экрана = ox + x_мира · z
  let Bg = 1, bx = 0, by = 0, phase = 'guess', mode = null, grab = {}, geo = { hand: { x: -99, y: -99 } };
  let G = { round: 0, score: 0, pairs: [] }, cur = null, lastZl = '', resT = 0, pts = 0, shown = -1;

  function readCols() { const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim(); col = { bg: g('--bg'), card: g('--card'), pink: g('--pink'), green: g('--green'), tx: g('--tx'), mut: g('--mut'), ind: g('--ind2'), line: g('--line') } }
  function resize() { const r = Math.min(devicePixelRatio || 1, 2), b = stage.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); x0 = Math.round(W * (W < 560 ? .36 : .34)); ground = H - 72; if (cur) { limits(); tlz = clampZ(tlz) } }

  /* ---------- рисование ---------- */
  function put(sh, left, base, bodyPx, o) {   // тело объекта (а не весь SVG) имеет ширину bodyPx и стоит на высоте base
    const s = bodyPx / sh.body.ref, k = s * Math.abs(sh.tf[0]);
    ctx.save(); ctx.translate(left - sh.body.left * s, base - sh.body.bottom * s); ctx.scale(s, s); ctx.transform(...sh.tf);
    for (const p of sh.P) { ctx.fillStyle = o.fill; ctx.fill(p, sh.rule) }
    ctx.restore();
  }
  function marker(x, y, c, t) {
    ctx.fillStyle = c; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(x, y - 5, 4, 0, 7); ctx.fill();
    ctx.globalAlpha = .4; ctx.beginPath(); ctx.arc(x, y - 5, 9, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.font = '700 12px Quicksand,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(t, x, y - 20);
  }
  const seg = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke() };
  function label(t, x, y, c) { ctx.font = '700 12px Quicksand,sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = c; ctx.fillText(t, Math.max(40, Math.min(W - 40, x)), y) }

  function drawGrid() {     // сетка привязана к миру: подбираем шаг 1-2-5·10ⁿ, чтобы клетка была ≥ ~46 px
    const t = 70 / z, mag = 10 ** Math.floor(Math.log10(t)), r = t / mag, m = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag, st = m * z; gridM = m;
    ctx.fillStyle = col.tx; ctx.globalAlpha = .035; ctx.fillRect(0, ground + BAND, W, H);          // «подземная» часть
    ctx.strokeStyle = col.tx; ctx.lineWidth = 1;
    for (const major of [false, true]) {
      ctx.globalAlpha = major ? .15 : .065; ctx.beginPath();
      for (let k = Math.ceil(-ox / st), x; (x = ox + k * st) <= W; k++) if ((k % 5 === 0) === major) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H) }
      for (let k = 0, y; (y = ground - k * st) >= 0; k++) if ((k % 5 === 0) === major) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5) }
      for (let k = 1, y; (y = ground + BAND + k * st) <= H; k++) if ((k % 5 === 0) === major) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(W, Math.round(y) + .5) }
      ctx.stroke();
    }
    ctx.globalAlpha = .5; ctx.fillStyle = col.ind; ctx.fillRect(0, ground, W, BAND); ctx.globalAlpha = 1;   // полоса земли
  }

  let prev = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - prev) / 1000); prev = now; const k = Math.min(1, dt * 7);
    const zOld = z; lz += (tlz - lz) * k; z = Math.exp(lz);
    if (fit) { ox += (tox - ox) * k; if (Math.abs(tlz - lz) < 1e-3 && Math.abs(tox - ox) < .5) fit = false } else ox = ax - (ax - ox) * z / zOld;   // зум к якорной точке

    ctx.clearRect(0, 0, W, H); ctx.setLineDash([]); ctx.globalAlpha = 1; drawGrid();
    const A = cur.A, B = cur.B, As = SH[A.shape], Bs = SH[B.shape], Apx = A.len * z, Bpx = Bg * z, Tpx = B.len * z, res = phase === 'result';
    const aL = ox, bL = ox + bx * z, gB = ground - by * z, tA = res ? ease(Math.min(1, (now - resT) / 700)) : 0;

    if (Apx < 3) marker(aL + Apx / 2, ground, col.pink, 'A'); else if (Apx < 2e6) put(As, aL, ground, Apx, { fill: col.pink });
    if (Bpx < 3) marker(bL + Bpx / 2, gB, col.green, 'B'); else if (Bpx < 2e6) put(Bs, bL, gB, Bpx, { fill: col.green + (res ? 'cc' : 'ff') });

    const bh = Bs.body.bottom - Bs.body.top, hB = bh * Bpx / Bs.body.ref, hT = bh * Tpx / Bs.body.ref, wB = Bpx * ww(B), wT = Tpx * ww(B), vert = Bs.body.dim === 'h';
    const rx = bL - 28, topB = gB - Bpx, OFF = 13, cxn = bL + wB, cyn = gB - hB;      // высота: рейка слева; диаметр/длина: ручка у правого верхнего угла
    geo = { bL, gB, wB, hB, vert, off: OFF, ux: ww(B), uy: -bh / Bs.body.ref, hand: vert ? { x: rx, y: Math.max(24, Math.min(H - 20, topB)) } : { x: Math.max(18, Math.min(W - 30, cxn + OFF)), y: Math.max(24, Math.min(H - 30, cyn - OFF)) } };
    if (vert) { ctx.strokeStyle = col.tx; ctx.lineWidth = 1.5; ctx.globalAlpha = .85; seg(rx, gB, rx, topB); seg(rx - 5, gB, rx + 5, gB); seg(rx, topB, bL + wB, topB); ctx.globalAlpha = 1 }
    if (!res) {                                             // ручка: единственное место, за которое меняется размер
      const { x, y } = geo.hand, hot = mode === 'size';
      ctx.fillStyle = hot ? col.pink : col.ind; ctx.beginPath(); ctx.roundRect(x - 15, y - 15, 30, 30, 9); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      const tri = (x1, y1, x2, y2, x3, y3) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.fill() };
      if (vert) { tri(x, y - 10, x - 6, y - 4, x + 6, y - 4); tri(x, y + 10, x - 6, y + 4, x + 6, y + 4) }
      else { seg(x - 6, y + 6, x + 6, y - 6); tri(x + 9, y - 9, x + 9, y - 2, x + 2, y - 9); tri(x - 9, y + 9, x - 9, y + 2, x - 2, y + 9) }
      if (vert ? topB < 24 : (cxn + OFF > W - 30 || cyn - OFF < 24)) label(tr('c.zoomOut') + (vert ? ' ▲' : ' ↗'), vert ? x + 50 : Math.min(W - 60, x), vert ? y + 6 : y + 34, col.mut);
    } else {
      ctx.globalAlpha = tA * .32; if (Tpx >= 3 && Tpx < 2e6) put(Bs, bL, gB, Tpx, { fill: col.tx }); ctx.globalAlpha = tA;
      if (vert) { ctx.strokeStyle = col.tx; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); seg(bL - 40, gB - Tpx, bL + wT + 14, gB - Tpx); ctx.setLineDash([]); label(tr('c.actualL'), bL + wT / 2, gB - Tpx - 8, col.tx) }
      else label(tr('c.actualL'), bL + wT / 2, gB - hT - 8, col.tx);
      const close = Math.abs(wT - wB) / 2 < 90;
      label(tr('c.guess'), bL + wB / 2, ground + BAND + 18, col.green); label(tr('c.actualL'), bL + wT / 2, ground + BAND + (close ? 34 : 18), col.tx); ctx.globalAlpha = 1;
      const v = Math.round(pts * ease(Math.max(0, Math.min(1, (now - resT - 350) / 1000))));          // счёт «накручивается»
      if (v !== shown) { shown = v; $('#rS').textContent = v }
    }
    const zt = '×' + (+(z / z0).toPrecision(2)) + ' · ' + tr('c.grid') + ' ' + fmtLen(gridM); if (zt !== lastZl) { zl.textContent = tr('c.zoom') + ' ' + zt; lastZl = zt }
    requestAnimationFrame(frame);
  }

  /* ---------- камера ---------- */
  // пределы зума: отдалять можно, пока самый большой объект каталога не уместится на экране; приближать — пока клетка сетки не станет 1 см
  const MAXLEN = Math.max(...OBJ.map(o => o.len * ww(o)));
  function limits() { lzMax = Math.log(7000); lzMin = Math.log(.92 * (W - 90) / MAXLEN) }      // 7000 px/м → шаг сетки 1 см (≈70 px)
  const clampZ = v => Math.max(lzMin, Math.min(lzMax, v));
  function zoomAt(f, px) { ax = px; fit = false; tlz = clampZ(tlz + Math.log(f)) }
  function fitBoth() {
    const A = cur.A, B = cur.B, a = SH[A.shape].body, b = SH[B.shape].body, res = phase === 'result', bw = res ? Math.max(Bg, B.len) : Bg;
    const xmin = Math.min(0, bx), xmax = Math.max(A.len * ww(A), bx + bw * ww(B)), hm = Math.max(A.len * (a.bottom - a.top) / a.ref, by + bw * (b.bottom - b.top) / b.ref);
    tlz = clampZ(Math.log(Math.min((W - 130) / (xmax - xmin), (ground - 100) / hm))); const zf = Math.exp(tlz);
    tox = W / 2 - 25 - (xmin + xmax) / 2 * zf; fit = true;
  }

  function fitTruth() {      // после «compare» камера наезжает на «тень» реального размера
    const B = cur.B, b = SH[B.shape].body, asp = (b.bottom - b.top) / b.ref;
    const Tw = B.len * ww(B); tlz = clampZ(Math.log(Math.min(.6 * (W - 130) / Tw, (ground - 100) / (by + B.len * asp)))); const zf = Math.exp(tlz);
    tox = (W - 60) / 2 - (bx + Tw / 2) * zf; fit = true;
  }

  /* ---------- игра ---------- */
  function setPill() { $('#rd').textContent = Math.min(G.round + 1, ROUNDS) + '/' + ROUNDS; $('#sc').textContent = G.score }
  function startRound() {
    cur = G.pairs[G.round]; const A = cur.A, B = cur.B;
    limits(); lz = tlz = clampZ(Math.log(.2 * W / A.len)); z = z0 = Math.exp(lz); fit = false;
    const wA = A.len * ww(A); ox = x0 - GAP - wA * z0; ax = x0; bx = wA + GAP / z0; by = 0; Bg = A.len; phase = 'guess'; lastZl = ''; shown = -1;
    stage.classList.remove('res'); rc.classList.remove('on');
    descs.innerHTML = `<div><span class="pk">${A.name}</span> — ${A.noun}: <b>${fmtLen(A.len)}</b> <em class="pk">${tr('c.toScale')}</em></div><div><span class="gr">${B.name}</span> — ${B.noun} <em class="gr">${tr('c.adjust')}</em></div>`;
    go.textContent = tr('c.compareBtn'); setPill(); G.log = G.log || []; Vectra.fairplay && Vectra.fairplay.on()
  }
  function newGame() { Vectra.setGameActive(true); G = { round: 0, score: 0, pairs: pickPairs(), log: [] }; $('#end').classList.add('off'); go.disabled = false; startRound() }
  function compare() {
    const A = cur.A, B = cur.B, g = Bg / A.len, t = B.len / A.len, err = Math.abs(Math.log10(g / t)), pct = Math.abs(Bg - B.len) / B.len * 100;
    pts = Math.max(0, Math.round(100 * (1 - err / 2))); G.score += pts; G.log.push({ k: A.id + '>' + B.id, g: g, t: t, pts }); phase = 'result'; mode = null; Vectra.sfx.play('reveal', pts / 100); Vectra.fairplay && Vectra.fairplay.off(); resT = performance.now(); shown = -1; setPill();
    $('#rS').textContent = 0; rc.className = 'rcard ' + (pts >= 80 ? 'good' : pts >= 40 ? 'mid' : 'bad');
    $('#rA').textContent = fmtLen(Bg); $('#rT').textContent = fmtLen(B.len) + ' (' + B.noun.replace(/ \(.*/, '') + ')';
    $('#rO').textContent = tr('c.off', { x: pct < 1000 ? Math.round(pct) + '%' : '×' + fmtX(Math.pow(10, err)) });
    $('#rR').textContent = lang === 'ru' ? tr('c.rel', { b: B.name, a: A.name, r: fmtX(t) }) : tr('c.rel', { b: B.name, a: A.name, r: rel(t) });
    requestAnimationFrame(() => rc.classList.add('on')); stage.classList.add('res'); go.textContent = tr(G.round + 1 < ROUNDS ? 'c.next' : 'c.finish'); fitTruth();
  }
  function next() { if (G.round + 1 < ROUNDS) { Vectra.sfx.play('next'); G.round++; startRound() } else finish() }
  function finish() {
    Vectra.setGameActive(false);
    const S = Vectra.store, best = S.get('best', 0), isBest = G.score > best; if (isBest) S.set('best', G.score);
    $('#end').classList.add('off');
    Vectra.showResult({ title: tr('mode.compare'), score: G.score, max: ROUNDS * 100, pts: G.log.map(l => (l && l.pts != null) ? l.pts : 0), best, isBest, onAgain: newGame });
    Vectra.db.submitRun('compare', G.log).then(() => {}).catch(e => { console.warn('[vectra] run not saved:', e.message || e) });
  }
  go.onclick = () => phase === 'guess' ? compare() : next();
  $('#again').onclick = newGame;

  /* ---------- управление ---------- */
  $('#zin').onclick = () => zoomAt(10, W / 2); $('#zout').onclick = () => zoomAt(.1, W / 2); $('#fit').onclick = fitBoth;
  stage.addEventListener('wheel', e => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * .0032), e.clientX - stage.getBoundingClientRect().left) }, { passive: false });
  const inB = (x, y) => { const w = Math.max(geo.wB, 30), h = Math.max(geo.hB, 30); return x >= geo.bL - 6 && x <= geo.bL + w + 6 && y >= geo.gB - h - 6 && y <= geo.gB + 6 };
  const pos = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] };
  cv.addEventListener('pointerdown', e => {
    const [x, y] = pos(e); cv.setPointerCapture(e.pointerId); fit = false; ax = x;
    if (phase === 'guess' && Math.hypot(x - geo.hand.x, y - geo.hand.y) < 26) { mode = 'size'; Vectra.sfx.play('pick'); grab.dx = geo.hand.x - x; grab.dy = geo.hand.y - y }
    else if (phase === 'guess' && inB(x, y)) { mode = 'move'; Vectra.sfx.play('pick'); grab.x = x; grab.y = y }
    else { mode = 'pan'; grab.x = x }
    cv.style.cursor = mode === 'size' ? (geo.vert ? 'ns-resize' : 'nesw-resize') : 'grabbing';
  });
  cv.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    if (!mode) { cv.style.cursor = phase === 'guess' && Math.hypot(x - geo.hand.x, y - geo.hand.y) < 26 ? (geo.vert ? 'ns-resize' : 'nesw-resize') : phase === 'guess' && inB(x, y) ? 'grab' : 'default'; return }
    if (mode === 'size') {
      if (geo.vert) Bg = Math.max(2 / z, (geo.gB - (y + grab.dy)) / z);
      else { const cx = x + grab.dx - geo.off, cy = y + grab.dy + geo.off; Bg = Math.max(2 / z, ((cx - geo.bL) * geo.ux + (cy - geo.gB) * geo.uy) / (geo.ux * geo.ux + geo.uy * geo.uy) / z) }      // проекция на диагональ объекта
    }          // размер — только отсюда
    else if (mode === 'move') { bx += (x - grab.x) / z; by = Math.max(0, by - (y - grab.y) / z); grab.x = x; grab.y = y }
    else { ox += x - grab.x; grab.x = x }
  });
  const up = () => { if (mode === 'size' || mode === 'move') Vectra.sfx.play('drop'); mode = null; cv.style.cursor = 'default' }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  stage.addEventListener('keydown', e => {
    const f = e.shiftKey ? 1.2 : 1.03;
    if (e.key === 'ArrowRight' && phase === 'guess') Bg *= f; else if (e.key === 'ArrowLeft' && phase === 'guess') Bg /= f;
    else if (e.key === '+' || e.key === '=') zoomAt(10, W / 2); else if (e.key === '-') zoomAt(.1, W / 2); else if (e.key === 'f') fitBoth(); else if (e.key === 'Enter') go.click(); else return;
    e.preventDefault();
  });
  $('#helpBtn').onclick = e => { const h = $('#how'); h.hidden = !h.hidden; e.currentTarget.setAttribute('aria-expanded', String(!h.hidden)) };

  new ResizeObserver(resize).observe(stage); addEventListener('vectra:theme', readCols);
  readCols(); resize(); newGame(); requestAnimationFrame(frame);
  }).catch(e => { console.error(e); const d = document.getElementById('descs'); if (d) d.textContent = 'Не удалось загрузить data/objects.json — запусти сайт через сервер: python3 -m http.server' });
})();
