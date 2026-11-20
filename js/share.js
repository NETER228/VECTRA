/* share.js — итоговая карточка игры и «поделиться результатом».
   Vectra.showResult({ mode, title, score, max, pts: [очки по раундам], best, isBest, onAgain }) — окно по окончании игры (Compare’It, вес).
   Vectra.shareBlock(data) — готовая строка кнопок «Telegram / Discord / текст / картинка» (используется и в Daily Question).
   Картинка рисуется на canvas в браузере (ничего не загружается на сервер), текст — Wordle-стиля: 🟩🟨🟥. */
(function () {
  const tr = Vectra.t, esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const emoji = p => p >= 80 ? '🟩' : p >= 40 ? '🟨' : '🟥';
  const CW = 1200, CH = 630;

  function siteUrl() { try { const u = new URL('index.html', location.href); u.search = ''; u.hash = ''; return u.href.replace(/index\.html$/, '') } catch (e) { return location.href } }
  function textOf(d) {
    const line = tr('share.line', { mode: d.title, score: d.score, max: d.max });
    return line + '\n' + d.pts.map(emoji).join('') + '\n' + siteUrl();
  }

  /* ---------- картинка ---------- */
  async function drawCard(d) {
    try { await Promise.all([document.fonts.load('700 40px "Golos Text"'), document.fonts.load('400 20px "Golos Text"')]) } catch (e) {}
    const c = document.createElement('canvas'); c.width = CW; c.height = CH; const x = c.getContext('2d'), F = '"Golos Text", system-ui, sans-serif';
    const bg = x.createLinearGradient(0, 0, CW, CH); bg.addColorStop(0, '#0d1226'); bg.addColorStop(1, '#06080f'); x.fillStyle = bg; x.fillRect(0, 0, CW, CH);
    const glow = x.createRadialGradient(CW * .82, CH * .12, 10, CW * .82, CH * .12, 520); glow.addColorStop(0, 'rgba(232,121,249,.28)'); glow.addColorStop(1, 'rgba(232,121,249,0)'); x.fillStyle = glow; x.fillRect(0, 0, CW, CH);
    const glow2 = x.createRadialGradient(CW * .05, CH * 1.0, 10, CW * .05, CH * 1.0, 480); glow2.addColorStop(0, 'rgba(74,222,154,.18)'); glow2.addColorStop(1, 'rgba(74,222,154,0)'); x.fillStyle = glow2; x.fillRect(0, 0, CW, CH);
    x.strokeStyle = '#1f2a4d'; x.lineWidth = 2; x.beginPath(); x.roundRect(24, 24, CW - 48, CH - 48, 28); x.stroke();

    // логотип + режим
    x.strokeStyle = '#e879f9'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round'; x.save(); x.translate(68, 62); x.scale(2.2, 2.2); x.beginPath();
    x.moveTo(3, 8); x.lineTo(7, 4); x.lineTo(11, 8); x.lineTo(15, 4); x.lineTo(20, 9); x.moveTo(3, 15); x.lineTo(7, 11); x.lineTo(11, 15); x.lineTo(15, 11); x.lineTo(20, 16); x.stroke(); x.restore();
    x.fillStyle = '#f2f4ff'; x.font = `700 40px ${F}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; x.fillText('VECTRA', 130, 98);
    x.fillStyle = '#9aa5d0'; x.font = `700 30px ${F}`; x.textAlign = 'right'; x.fillText(d.title, CW - 68, 98);

    // очки
    x.textAlign = 'left'; x.fillStyle = '#e879f9'; x.font = `700 190px ${F}`; x.fillText(String(d.score), 64, 300);
    const sw = x.measureText(String(d.score)).width; x.fillStyle = '#6e78a0'; x.font = `700 64px ${F}`; x.fillText('/ ' + d.max, 64 + sw + 22, 300);
    if (d.isBest) { x.fillStyle = '#4ade9a'; x.font = `700 30px ${F}`; x.fillText('★ ' + tr('c.newBest'), 68, 352) }

    // раунды: цветные столбики
    const n = d.pts.length, left = 68, right = CW - 68, top = 372, gap = 16, bw = (right - left - gap * (n - 1)) / n;
    d.pts.forEach((p, i) => {
      const bx = left + i * (bw + gap), col = p >= 80 ? '#4ade9a' : p >= 40 ? '#e0b400' : '#ff7a9c', h = 12 + 98 * (p / 100);
      x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(bx, top, bw, 110, 16); x.fill();
      x.fillStyle = col; x.beginPath(); x.roundRect(bx, top + 110 - h, bw, h, 16); x.fill();
      x.fillStyle = '#f2f4ff'; x.font = `700 32px ${F}`; x.textAlign = 'center'; x.fillText(String(p), bx + bw / 2, top + 110 + 40);
    });
    x.textAlign = 'left'; x.fillStyle = '#f2f4ff'; x.font = `700 34px ${F}`; x.fillText(tr('share.beat'), 68, 588);
    x.textAlign = 'right'; x.fillStyle = '#6e78a0'; x.font = `400 26px ${F}`; x.fillText(siteUrl().replace(/^https?:\/\//, '').replace(/\/$/, ''), CW - 68, 588);
    return c;
  }
  const toBlob = c => new Promise(ok => c.toBlob(ok, 'image/png'));

  /* ---------- действия ---------- */
  function shareBlock(d) {
    const box = document.createElement('div');
    box.className = 'share-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-btn pk';
    const ru = Vectra.lang() === 'ru';
    button.textContent = ru ? 'Поделиться' : 'Share';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = '';
      try {
        const item = new ClipboardItem({ 'image/png': drawCard(d).then(toBlob) });
        await navigator.clipboard.write([item]);
        status.textContent = ru ? 'Результат скопирован в буфер обмена' : 'Result copied to clipboard';
      } catch {
        status.textContent = ru ? 'Не удалось скопировать картинку. Проверьте доступ к буферу обмена.' : 'Could not copy the image. Check clipboard access.';
      } finally { button.disabled = false }
    };
    box.append(button, status);
    return box;
  }
  Vectra.shareBlock = shareBlock;

  /* ---------- окно «Игра окончена» ---------- */
  Vectra.showResult = async function (o) {
    const d = { title: o.title, score: o.score, max: o.max, pts: o.pts, isBest: o.isBest };
    const roundsHtml = o.pts.map((v, i) => `<div class="round-row"><span class="round-label">${tr('c.round')} ${i + 1}</span><div class="round-bar"><div class="round-fill ${v >= 80 ? 'good' : v >= 40 ? 'mid' : 'bad'}" style="width:${v}%"></div></div><span class="round-score">${v}</span></div>`).join('');
    const el = document.createElement('div'); el.className = 'result-modal on'; el.id = 'resultModal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'resT');
    el.innerHTML = `<div class="result-card">
      <h2 id="resT">${tr('c.gameOver')}</h2>
      <div class="result-total"><b id="resNum">0</b><span>${tr('c.score')} · ${o.score} / ${o.max}</span></div>
      <div class="rounds">${roundsHtml}</div>
      <p class="result-note">${o.isBest ? tr('c.newBest') : tr('c.best', { n: o.best })}</p>
      ${Vectra.guest ? `<p class="dq-note" role="status">${tr('c.guest')}</p>` : ''}
      <div id="shareSlot"></div>
      <div class="result-actions"><button class="go pink" id="resAgain">${tr('c.again')}</button><a class="go alt" href="index.html">${tr('c.home')}</a></div>
    </div>`;
    document.body.append(el); el.querySelector('#shareSlot').append(shareBlock(d));
    const num = el.querySelector('#resNum'), t0 = performance.now();               // очки «накручиваются»
    (function f(n) { const k = Math.min(1, (n - t0) / 900); num.textContent = Math.round(o.score * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f) })(t0);
    Vectra.sfx && Vectra.sfx.play('finish', o.score / o.max);
    el.querySelector('#resAgain').onclick = () => { el.remove(); o.onAgain() };
    el.querySelector('#resAgain').focus();
  };
})();
