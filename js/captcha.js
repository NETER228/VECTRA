/* captcha.js — капча для ПК: «Я не робот» → провести мышью по подсвеченной траектории.
   verify() и makeChallenge() — чистые функции: в проде переносятся в Supabase Edge Function. */
const $ = s => document.querySelector(s), cv = $('#c'), ctx = cv.getContext('2d');
const win = $('#win'), box = $('#box'), msg = $('#msg'), okc = $('#ok'), okTxt = $('#okTxt'), hint = $('#hint'), hintTxt = $('#hintTxt'), bar = $('#bar');
const POP_R = 52, TTL = 60000, MC = ['#5b6bd6', '#8a7fe0', '#46a37e', '#c46ad6', '#6f86b8', '#9aa3d6'];
const MSG0 = 'Поставь галочку в квадрате, затем проведи мышью по подсвеченной линии.';
let pops = [], parts = [], endFlash = -1e9, bgA = 0, W, H, D, tol, st = 'idle', ch = null, user = [], drawing = false, fails = 0, lockUntil = 0, lastErr = '', ghost = null, mice = [], mr, col = {};
let mseed = crypto.getRandomValues(new Uint32Array(1))[0];

/* ---------- цвета из CSS-переменных (работает со светлой и тёмной темой) ---------- */
function readCols() { const s = getComputedStyle(document.documentElement), g = n => s.getPropertyValue(n).trim(); col = { bg: g('--bg'), card: g('--card'), pink: g('--pink'), green: g('--green'), tx: g('--tx'), mut: g('--mut'), err: g('--err') }; }

/* ---------- генератор, сплайн, геометрия ---------- */
function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function spline(c) { const o = [], P = [c[0], ...c, c[c.length - 1]]; for (let i = 1; i < P.length - 2; i++) { const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]]; for (let s = 0; s < 24; s++) { const t = s / 24, t2 = t * t, t3 = t2 * t; o.push([0, 1].map(a => .5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3))) } } o.push(c[c.length - 1]); return o }
function resample(p, n) { const L = [0]; for (let i = 1; i < p.length; i++)L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); const T = L[L.length - 1], o = []; let k = 1; for (let i = 0; i < n; i++) { const d = T * i / (n - 1); while (k < p.length - 1 && L[k] < d) k++; const u = Math.min(1, Math.max(0, (d - L[k - 1]) / (L[k] - L[k - 1] || 1))); o.push([p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u]) } return o }
function frechet(P, Q) { const n = P.length, m = Q.length, c = new Float32Array(n * m); for (let i = 0; i < n; i++)for (let j = 0; j < m; j++) { const d = Math.hypot(P[i][0] - Q[j][0], P[i][1] - Q[j][1]); c[i * m + j] = i == 0 && j == 0 ? d : i == 0 ? Math.max(c[j - 1], d) : j == 0 ? Math.max(c[(i - 1) * m], d) : Math.max(Math.min(c[(i - 1) * m + j], c[(i - 1) * m + j - 1], c[i * m + j - 1]), d) } return c[n * m - 1] }

/* ---------- challenge (в проде — на сервере, одноразовый) ---------- */
function makeChallenge() {
  // Четыре вида линии: плавная кривая, волна, зигзаг и дуга. Вид, направление и размеры выбираются из seed.
  const seed = crypto.getRandomValues(new Uint32Array(1))[0], r = rng(seed), kind = ['spline', 'wave', 'zigzag', 'arc'][Math.floor(r() * 4)], vert = r() > .5, rev = r() > .5, ctrl = [], P = (a, b) => ctrl.push(vert ? [b, a] : [a, b]);
  if (kind === 'spline') for (let i = 0; i < 6; i++) P(.1 + .8 * i / 5, .18 + .64 * r());
  else if (kind === 'wave') { const n = 11, per = 1.4 + r() * 1.1, amp = .19 + r() * .1, ph = r() * 6.28; for (let i = 0; i < n; i++) { const t = i / (n - 1); P(.08 + .84 * t, .5 + amp * Math.sin(ph + 6.283 * per * t)) } }
  else if (kind === 'zigzag') { const n = 5 + Math.floor(r() * 3), h = .17 + r() * .12; for (let i = 0; i < n; i++) P(.08 + .84 * i / (n - 1), .5 + (i % 2 ? h : -h) * (.8 + r() * .4)) }
  else { const a0 = r() * 6.283, sw = (1.1 + r() * .45) * Math.PI; for (let i = 0; i < 9; i++) { const a = a0 + sw * i / 8; ctrl.push([.5 + .34 * Math.cos(a), .5 + .3 * Math.sin(a)]) } }
  if (rev) ctrl.reverse();
  return { id: seed.toString(36), seed, kind, ctrl, expires: Date.now() + TTL };
}
function buildPath() { ch.path = spline(ch.ctrl.map(([a, b]) => [a * W, b * H])); ch.ref = resample(ch.path, 200); ch.s = ch.path[0]; ch.e = ch.path[ch.path.length - 1] }

/* ---------- проверка (в проде — Edge Function) ---------- */
function verify(u, ref, tol, D) {
  if (u.length < 25) return 'Слишком мало движений. Веди курсор плавно.';
  const last = u[u.length - 1];
  if (Math.hypot(last[0] - ref[199][0], last[1] - ref[199][1]) > tol * 1.3) return 'Линия не доведена до квадрата.';
  const dur = last[2] - u[0][2];
  if (dur < 700) return 'Слишком быстро.';
  if (dur > 25000) return 'Слишком долго.';
  let maxStep = 0, sp = [];
  for (let i = 1; i < u.length; i++) { const d = Math.hypot(u[i][0] - u[i - 1][0], u[i][1] - u[i - 1][1]), dt = u[i][2] - u[i - 1][2]; maxStep = Math.max(maxStep, d); if (dt > 0) sp.push(d / dt) }
  if (maxStep > .2 * D) return 'Курсор «перепрыгивал» по экрану.';
  const m = sp.reduce((a, b) => a + b, 0) / sp.length, sd = Math.sqrt(sp.reduce((a, b) => a + (b - m) ** 2, 0) / sp.length);
  if (!(sd / m > .2)) return 'Движение слишком ровное.';
  const ru = resample(u.map(p => [p[0], p[1]]), 64);
  if (frechet(ru, resample(ref, 64)) > tol * 1.15) return 'Ты ушёл слишком далеко от линии.';
  let dev = 0; for (const p of ru) { let b = 1e9; for (const q of ref) b = Math.min(b, Math.hypot(p[0] - q[0], p[1] - q[1])); dev += b }
  if (dev / ru.length < 1.2) return 'Слишком идеальное повторение линии.';
  return null;
}

/* ---------- фоновые мышки: бродят сами, а во время проверки плавно «едут» по линии и лопаются у квадрата ---------- */
function initMice(seed) { mr = rng(seed ^ 0x9e3779b9); const n = W < 700 ? 8 : 16; mice = []; for (let i = 0; i < n; i++)mice.push({ x: mr() * W, y: mr() * H, vx: 0, vy: 0, tx: mr() * W, ty: mr() * H, sp: 110 + mr() * 170, ph: mr() * 9, c: MC[i % MC.length], tr: [], al: 0, wait: 0 }) }
function armRobots() {
  const r = rng(ch.seed ^ 0x51ed270b), n = ch.path.length, act = W < 700 ? 4 : 6;   // во время проверки активны только несколько мышек
  mice.forEach((m, idx) => {
    if (idx >= act) { m.wp = null; return }
    const k = 6 + Math.floor(r() * 4), off = 18 + r() * 40; m.wp = [];
    for (let i = 0; i < k; i++) { const q = ch.path[Math.round((n - 1) * i / (k - 1))], a = r() * 6.28, f = i && i < k - 1 ? 1 : .25; m.wp.push([q[0] + Math.cos(a) * off * f, q[1] + Math.sin(a) * off * f]) }
    m.x = m.wp[0][0]; m.y = m.wp[0][1]; m.vx = m.vy = 0; m.i = 1; m.tr = []; m.wait = idx * .7 + r() * .8; m.rs = 150 + r() * 110; m.al = 0;
  });
}
function respawn(m) { m.i = 1; m.tr = []; m.x = m.wp[0][0]; m.y = m.wp[0][1]; m.vx = m.vy = 0; m.wait = .8 + Math.random() * 1.8; m.al = 0 }
function pop(m, now) {
  pops.push({ x: m.x, y: m.y, t: now, c: m.c, s: Array.from({ length: 12 }, (_, i) => { const a = i / 12 * 6.283 + Math.random() * .4, v = 110 + Math.random() * 190; return [Math.cos(a) * v, Math.sin(a) * v] }) });
  endFlash = now; respawn(m);
}
function stepRobot(m, dt, now) {
  if (m.wait > 0) { m.wait -= dt; return }
  const w = m.wp[m.i], dx = w[0] - m.x, dy = w[1] - m.y, d = Math.hypot(dx, dy) || 1, k = Math.min(1, dt * 3.2);
  m.vx += (dx / d * m.rs - m.vx) * k; m.vy += (dy / d * m.rs - m.vy) * k;   // плавный разгон и повороты
  m.x += m.vx * dt; m.y += m.vy * dt;
  if (d < 30 && m.i < m.wp.length - 1) m.i++;
  m.tr.push([m.x, m.y]); if (m.tr.length > 42) m.tr.shift();
  if (Math.hypot(m.x - ch.e[0], m.y - ch.e[1]) < POP_R || (m.i >= m.wp.length - 1 && d < 20)) pop(m, now);
}
function stepMice(dt, now) {      // мышки есть только во время проверки: до клика по квадрату и после неё экран чистый
  for (const m of mice) {
    const tgt = st === 'trace' ? (m.wp && m.wait <= 0 ? 1 : 0) : 0; m.al += (tgt - m.al) * Math.min(1, dt * (tgt ? 5 : 6));
    if (st === 'trace' && m.wp) stepRobot(m, dt, now);
  }
}
const CUR = new Path2D('M0 0L0 17L4.6 12.9L7.6 19.6L10.4 18.4L7.5 11.9L13 11.6Z');
function drawMice() {
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const m of mice) {
    const A = m.al; if (A < .02) continue;
    ctx.strokeStyle = m.c;
    for (let i = 1; i < m.tr.length; i++) { ctx.globalAlpha = i / m.tr.length * .45 * A; ctx.beginPath(); ctx.moveTo(...m.tr[i - 1]); ctx.lineTo(...m.tr[i]); ctx.stroke() }
    ctx.globalAlpha = .9 * A; ctx.save(); ctx.translate(m.x, m.y); ctx.fillStyle = m.c; ctx.strokeStyle = col.bg; ctx.lineWidth = 1.2; ctx.fill(CUR); ctx.stroke(CUR); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawPops(now) {   // «лопнувшие» мышки: кольцо + искры
  pops = pops.filter(p => now - p.t < 700);
  for (const p of pops) {
    const a = (now - p.t) / 1000, k = 1 - a / .7;
    ctx.strokeStyle = p.c; ctx.lineWidth = 2.5; ctx.globalAlpha = k * .85; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + a * 80, 0, 7); ctx.stroke();
    ctx.globalAlpha = k * .4; ctx.beginPath(); ctx.arc(p.x, p.y, 4 + a * 40, 0, 7); ctx.stroke();
    ctx.fillStyle = p.c; ctx.globalAlpha = k;
    for (const [vx, vy] of p.s) { ctx.beginPath(); ctx.arc(p.x + vx * a * (1 - a * .6), p.y + vy * a * (1 - a * .6), 2.8 * k + .4, 0, 7); ctx.fill() }
  }
  ctx.globalAlpha = 1;
}

/* ---------- фон на время проверки: туманности, сетка, созвездие частиц, волны от цели ---------- */
function initParts() { const n = Math.max(16, Math.min(38, Math.round(W * H / 38000))); parts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * 18, vy: -6 - Math.random() * 14, r: .8 + Math.random() * 1.8 })) }
function drawBg(now, dt) {
  const t = now / 1000, R = Math.max(W, H) * .5; ctx.save(); ctx.globalAlpha = bgA;
  [[col.pink, .3, .35, .11, .17], ['#5b6bd6', .7, .3, .13, .09], [col.green, .5, .8, .09, .14]].forEach(([c, bx, by, sx, sy], i) => {
    const x = W * (bx + .22 * Math.sin(t * sx * 2 + i * 2)), y = H * (by + .22 * Math.cos(t * sy * 2 + i)), g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, c + '15'); g.addColorStop(1, c + '00'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  const gs = 56, o = (t * 14) % gs; ctx.strokeStyle = col.mut + '0d'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = -gs + o; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H) } for (let y = -gs + o * .6; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y) } ctx.stroke();
  for (const q of parts) { q.x += q.vx * dt; q.y += q.vy * dt; if (q.y < -10) { q.y = H + 10; q.x = Math.random() * W } if (q.x < -10) q.x = W + 10; if (q.x > W + 10) q.x = -10 }
  ctx.lineWidth = 1; ctx.strokeStyle = col.tx;
  for (let i = 0; i < parts.length; i++)for (let j = i + 1; j < parts.length; j++) { const d = Math.hypot(parts[i].x - parts[j].x, parts[i].y - parts[j].y); if (d < 120) { ctx.globalAlpha = bgA * (1 - d / 120) * .09; ctx.beginPath(); ctx.moveTo(parts[i].x, parts[i].y); ctx.lineTo(parts[j].x, parts[j].y); ctx.stroke() } }
  ctx.fillStyle = col.tx; ctx.globalAlpha = bgA * .2; for (const q of parts) { ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 7); ctx.fill() }
  if (ch) for (let i = 0; i < 3; i++) { const u = (t * .6 + i / 3) % 1; ctx.strokeStyle = col.green; ctx.globalAlpha = bgA * (1 - u) * .14; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ch.e[0], ch.e[1], 26 + u * 140, 0, 7); ctx.stroke() }
  ctx.restore();
}

/* ---------- отрисовка ---------- */
function line(pts, w, c, dash) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]) }
function drawPath(now) {
  line(ch.path, tol * 2, col.pink + '14');
  ctx.save(); ctx.shadowColor = col.pink; ctx.shadowBlur = 18; line(ch.path, 5, col.pink + 'bf'); ctx.restore();
  line(ch.path, 1.5, col.tx, [2, 9]);
  const pu = (Math.sin(now / 260) + 1) / 2;
  ctx.fillStyle = col.pink; ctx.beginPath(); ctx.arc(ch.s[0], ch.s[1], 9, 0, 7); ctx.fill();
  ctx.strokeStyle = col.pink + 'b3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ch.s[0], ch.s[1], 14 + pu * 10, 0, 7); ctx.stroke();
  const ex = ch.e[0], ey = ch.e[1], l = user[user.length - 1], near = drawing && l && Math.hypot(l[0] - ex, l[1] - ey) < 60;
  ctx.save(); ctx.shadowColor = near ? col.green : col.tx; ctx.shadowBlur = near ? 22 : 12; ctx.fillStyle = col.card; ctx.strokeStyle = near ? col.green : col.tx; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(ex - 19, ey - 19, 38, 38, 10); ctx.fill(); ctx.stroke(); ctx.restore();
  const fa = (now - endFlash) / 500; if (fa >= 0 && fa < 1) { ctx.strokeStyle = col.green; ctx.globalAlpha = (1 - fa) * .8; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(ex - 19 - fa * 22, ey - 19 - fa * 22, 38 + fa * 44, 38 + fa * 44, 10 + fa * 14); ctx.stroke(); ctx.globalAlpha = 1 }
  ctx.strokeStyle = near ? col.green : col.mut; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(ex - 8, ey + 1); ctx.lineTo(ex - 2, ey + 7); ctx.lineTo(ex + 9, ey - 6); ctx.stroke();
}
let prev = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  ctx.clearRect(0, 0, W, H);
  bgA += ((st === 'trace' ? 1 : 0) - bgA) * Math.min(1, dt * 2.2); if (bgA > .01) drawBg(now, dt);
  stepMice(dt, now);
  if (st === 'trace') {
    drawPath(now);
    const left = ch.expires - Date.now(); bar.style.transform = 'scaleX(' + Math.max(0, left / TTL) + ')';
    if (left <= 0 && !drawing) reset('Время вышло. Линия обновлена, попробуй ещё раз.', false);
  }
  drawMice(); drawPops(now);
  if (user.length > 1 && (st === 'trace' || ghost)) {
    const a = ghost ? Math.max(0, 1 - (now - ghost) / 900) : 1; ctx.globalAlpha = a; ctx.save();
    ctx.shadowColor = ghost ? col.err : col.green; ctx.shadowBlur = 10; line(user, 3.5, ghost ? col.err : col.green); ctx.restore(); ctx.globalAlpha = 1;
    if (ghost && a <= 0) { ghost = null; user = [] }
  }
  if (st === 'idle' && lockUntil) { const left = lockUntil - Date.now(), t = left > 0 ? lastErr + ' Повтор через ' + Math.ceil(left / 1000) + ' с.' : 'Поставь галочку в квадрате и попробуй ещё раз.'; if (msg.textContent !== t) say(t, left > 0 ? 'err' : ''); if (left <= 0) lockUntil = 0 }
  requestAnimationFrame(frame);
}

/* ---------- сценарий ---------- */
function say(t, c) { msg.textContent = t; msg.className = c || '' }
function begin() {
  if (st !== 'idle' || Date.now() < lockUntil) return;
  ch = makeChallenge(); buildPath(); initMice(ch.seed); armRobots(); user = []; ghost = null; st = 'trace';
  win.classList.add('off'); hint.classList.remove('off'); hintTxt.textContent = 'Зажми кнопку мыши на пульсирующей точке и веди до квадрата с галочкой'; box.className = 'box spin';
}
function reset(text, penalty) {
  st = 'idle'; drawing = false; mice.forEach(m => m.wp = null); win.classList.remove('off'); hint.classList.add('off'); box.className = 'box'; lastErr = text;
  if (penalty) { fails++; lockUntil = Date.now() + Math.min(16, 2 ** (fails - 1)) * 1000 }
  say(text, 'err');
}
let vp = Promise.resolve(), verr = null;      // отметка «капча пройдена» сохраняется на сервере
function finish() {
  const err = verify(user, ch.ref, tol, D);
  if (err) { ghost = performance.now(); return reset(err, true) }
  st = 'done'; fails = 0; mice.forEach(m => m.wp = null); win.classList.remove('off'); hint.classList.add('off'); box.className = 'box spin'; say('Проверяем…');
  const t0 = user[0][2], payload = { id: ch.id, pts: user.map(p => [Math.round(p[0]), Math.round(p[1]), Math.round(p[2] - t0)]) };
  console.log('captcha payload →', payload);
  setTimeout(() => { box.className = 'box ok'; say('Галочка поставлена', 'good'); vp = Vectra.setVerified().catch(e => { verr = e; console.warn('[vectra] set_verified failed:', e.message || e) }) }, 700);
  setTimeout(() => { win.classList.add('off'); okTxt.textContent = 'Переходим на главную…'; okc.classList.remove('off'); dispatchEvent(new CustomEvent('vectra:captcha-pass', { detail: payload })) }, 1500);
  setTimeout(async () => {
    await vp; if (verr) { okc.classList.add('off'); win.classList.remove('off'); box.className = 'box'; st = 'idle'; say('Не удалось сохранить результат проверки на сервере. Проверьте соединение и попробуйте ещё раз.', 'err'); return }
    const go = () => { location.href = 'index.html' };
    if (Vectra.needsTerms() || Vectra.needsNick()) { okc.classList.add('off'); Vectra.onboard(go) } else go();
  }, 2600);
}
box.onclick = begin;

cv.addEventListener('pointerdown', e => {
  if (st !== 'trace' || drawing) return;
  if (Math.hypot(e.clientX - ch.s[0], e.clientY - ch.s[1]) > tol * 1.3) { hintTxt.textContent = 'Начинай с пульсирующей точки'; return }
  drawing = true; ghost = null; user = [[e.clientX, e.clientY, e.timeStamp]]; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!drawing) return;
  const ev = e.getCoalescedEvents?.(); (ev && ev.length ? ev : [e]).forEach(p => user.push([p.clientX, p.clientY, p.timeStamp]));
  const l = user[user.length - 1]; if (user.length > 25 && Math.hypot(l[0] - ch.e[0], l[1] - ch.e[1]) < 20) { drawing = false; finish() }
});
cv.addEventListener('pointerup', () => { if (drawing) { drawing = false; finish() } });
cv.addEventListener('pointercancel', () => { if (drawing) { drawing = false; reset('Ввод прерван. Попробуй ещё раз.', false) } });

function resize() { const r = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; D = Math.hypot(W, H); tol = Math.min(44, Math.max(26, D * .022)); cv.width = W * r; cv.height = H * r; ctx.setTransform(r, 0, 0, r, 0, 0); if (ch) buildPath(); initParts() }
addEventListener('resize', resize); addEventListener('vectra:theme', readCols);
readCols(); resize(); initMice(mseed); initParts(); requestAnimationFrame(frame);
