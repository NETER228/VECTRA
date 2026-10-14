/* numinput.js — поле для ввода больших чисел без научной записи.
   • в поле можно набрать только цифры и один десятичный знак; разряды разделяются на лету (8 300 000 000 / 8,300,000,000);
   • ряд кнопок-множителей x10, x100, x1K, x1M, x1B, x1T … (K — тысяча, M — миллион, B — миллиард, T — триллион, Qa — квадриллион …);
   • Vectra.numFmt — словесные форматы («5,97 септиллиона», «25 цифр»).
   Vectra.numInput(контейнер, {unit, maxClass, small, placeholder, label, chipsLabel}) → {getValue, setValue, onChange, setDisabled, focus, reset, input} */
(function () {
  const lang = Vectra.lang(), GROUP = lang === 'ru' ? '\u00a0' : ',', DEC = lang === 'ru' ? ',' : '.', LOC = lang === 'ru' ? 'ru-RU' : 'en-US';
  const ABBR = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'];
  const EN = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion', 'sextillion', 'septillion', 'octillion', 'nonillion', 'decillion', 'undecillion', 'duodecillion', 'tredecillion'];
  const RU = ['', 'тысяч', 'миллион', 'миллиард', 'триллион', 'квадриллион', 'квинтиллион', 'секстиллион', 'септиллион', 'октиллион', 'нониллион', 'дециллион', 'ундециллион', 'дуодециллион', 'тредециллион'];
  const fmtNum = (n, d = 0) => n.toLocaleString(LOC, { maximumFractionDigits: d });
  const plural = (n, f) => { const a = n % 100, b = n % 10; return a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b >= 2 && b <= 4 ? f[1] : f[2] };
  function className(c, m) {                      // «миллиарда» / «миллиардов» / «billion»
    if (lang !== 'ru') return EN[c];
    const f = c === 1 ? ['тысяча', 'тысячи', 'тысяч'] : [RU[c], RU[c] + 'а', RU[c] + 'ов'];
    return Number.isInteger(m) ? plural(m, f) : f[1];
  }
  function words(v) {                             // 5,97 септиллиона · 8,3 млрд
    if (!(v > 0)) return ''; let c = Math.min(14, Math.floor(Math.log10(v) / 3));
    if (c < 1) return fmtNum(v, v < 10 ? 2 : v < 100 ? 1 : 0);
    let m = +(v / 10 ** (3 * c)).toPrecision(3); if (m >= 1000 && c < 14) { m = 1; c++ }
    return `${fmtNum(m, 2)} ${className(c, m)}`;
  }
  const digitsWord = n => lang === 'ru' ? plural(n, ['цифра', 'цифры', 'цифр']) : 'digits';
  function describe(v) {                          // подпись под полем: полное число и «словами»
    if (!(v > 0) || !isFinite(v)) return '';
    if (v < 1e4) return fmtNum(v, v < 10 ? 2 : v < 1000 ? 1 : 0);
    const digits = Math.floor(Math.log10(v)) + 1;
    return v < 1e15 ? `${fmtNum(Math.round(v))} (≈ ${words(v)})` : `≈ ${words(v)} · ${digits} ${digitsWord(digits)}`;
  }
  Vectra.numFmt = { fmtNum, words, describe, className, digitsWord, ABBR, GROUP, DEC };

  const isDig = ch => ch >= '0' && ch <= '9';
  function format(raw) {                          // оставляем цифры и один десятичный знак, расставляем разряды
    let int = '', frac = '', dec = false;
    for (const ch of raw) {
      if (isDig(ch)) { if (dec) frac += ch; else int += ch }
      else if (!dec && (ch === DEC || ((ch === '.' || ch === ',') && ch !== GROUP))) dec = true;
    }
    int = int.replace(/^0+(?=\d)/, '').slice(0, 15); frac = frac.slice(0, 6);
    return int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP) + (dec ? DEC + frac : '');
  }
  function normalizePaste(t) {                    // «8,300,000» / «8.300.000» / «8,3» из буфера обмена
    t = t.replace(/[^\d.,]/g, ''); const d = t.lastIndexOf('.'), c = t.lastIndexOf(','), i = Math.max(d, c); if (i < 0) return t;
    const count = t.split(t[i]).length - 1, after = t.length - i - 1, dec = (d >= 0 && c >= 0) || (count === 1 && after !== 3);
    return dec ? t.slice(0, i).replace(/[.,]/g, '') + DEC + t.slice(i + 1).replace(/[.,]/g, '') : t.replace(/[.,]/g, '');
  }

  Vectra.numInput = function (root, opt = {}) {
    const maxC = opt.maxClass ?? 10; root.classList.add('ni');
    root.innerHTML = `<div class="ni-field"><input class="ni-in" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="${opt.placeholder || ''}" aria-label="${opt.label || ''}"><span class="ni-unit">${opt.unit || ''}</span></div><div class="ni-chips" role="group" aria-label="${opt.chipsLabel || ''}"></div>`;
    const inp = root.querySelector('.ni-in'), box = root.querySelector('.ni-chips'), subs = []; let mult = 1, selected = -1;
    const defs = []; if (opt.small !== false) defs.push({ m: 10, label: 'x10', title: '×10' }, { m: 100, label: 'x100', title: '×100' });
    for (let c = 1; c <= maxC; c++) defs.push({ m: 10 ** (3 * c), label: 'x1' + ABBR[c], title: '×1 ' + EN[c], c });
    const btns = defs.map((d, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = d.label; b.title = d.title; b.setAttribute('aria-pressed', 'false'); b.onclick = () => { pick(selected === i ? -1 : i); inp.focus() }; box.append(b); return b });
    function pick(i) { selected = i; mult = i < 0 ? 1 : defs[i].m; btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', String(k === i)) }); emit() }
    const emit = () => subs.forEach(f => f(api.getValue()));
    const sigRaw = ch => isDig(ch) || ((ch === '.' || ch === ',') && ch !== GROUP);
    function apply() {                            // переформатировать поле, сохранив положение курсора
      const raw = inp.value, caret = inp.selectionStart; let n = 0; for (const ch of raw.slice(0, caret)) if (sigRaw(ch)) n++;
      const f = format(raw); inp.value = f; let pos = 0, cnt = 0; while (pos < f.length && cnt < n) { if (isDig(f[pos]) || f[pos] === DEC) cnt++; pos++ }
      inp.setSelectionRange(pos, pos); emit();
    }
    const insert = t => { inp.setRangeText(t, inp.selectionStart, inp.selectionEnd, 'end'); apply() };
    inp.addEventListener('beforeinput', e => {
      if (e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') return;     // удаление и прочее — пропускаем
      const d = e.data || ''; if (d.length === 1 && isDig(d)) return;
      e.preventDefault(); if (d === '.' || d === ',') insert(DEC); else if (d.length > 1) insert(normalizePaste(d));    // всё остальное (буквы, e, минус, пробел) — запрещено
    });
    inp.addEventListener('paste', e => { e.preventDefault(); insert(normalizePaste((e.clipboardData || window.clipboardData).getData('text'))) });
    inp.addEventListener('input', apply);
    inp.addEventListener('drop', e => e.preventDefault());
    const api = {
      input: inp,
      getValue() { const s = inp.value.split(GROUP).join('').replace(DEC, '.').replace(',', '.'); const m = s === '' || s === '.' ? NaN : parseFloat(s); return m * mult },
      setValue(v, silent) {                        // 5.97e24 → «5,97» + кнопка x1Sp
        if (!(v > 0)) return; let c = Math.max(0, Math.min(maxC, Math.floor(Math.log10(v) / 3))), m = +(v / 10 ** (3 * c)).toPrecision(3);
        if (m >= 1000 && c < maxC) { m = 1; c++ }
        const i = c === 0 ? -1 : defs.findIndex(d => d.c === c); selected = i; mult = i < 0 ? 1 : defs[i].m; btns.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-pressed', String(k === i)) });
        inp.value = format(String(m).replace('.', DEC)); if (!silent) emit();
      },
      onChange(f) { subs.push(f) }, focus() { inp.focus() },
      setDisabled(b) { inp.disabled = b; btns.forEach(x => x.disabled = b) },
      reset() { inp.value = ''; pick(-1) }
    };
    return api;
  };
})();
