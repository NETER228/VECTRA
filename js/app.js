/* app.js — главная: статистика в шапке, язык, счётчик архива, калькулятор очков, синхронизация с Supabase */
(function () {
  const $ = s => document.querySelector(s), t = Vectra.t, S = Vectra.store, lang = Vectra.lang();

  const tiles = (best, streak) => { $('#best').textContent = t('home.score', { n: best }); $('#streak').textContent = t('home.days', { n: streak }) };
  if (Vectra.guest) {
    $('#best').textContent = lang === 'ru' ? 'Гостевая игра' : 'Guest play';
    $('#streak').textContent = lang === 'ru' ? 'Без сохранения' : 'Not saved';
  } else tiles(S.get('best', 0), S.get('streak', 0));

  const lb = $('#langBtn'); lb.textContent = t('home.langs', { l: lang.toUpperCase() });
  lb.onclick = () => Vectra.setLangAndReload(lang === 'ru' ? 'en' : 'ru');

  const nArch = Vectra.dayIndex(Vectra.utcToday()) + 1, ac = $('#archCount'); if (nArch > 0) ac.textContent = t('home.questions', { n: nArch });

  /* ---------- «как считаются очки»: таблица и калькулятор используют ту же формулу, что и игра ---------- */
  const pts = f => Vectra.pts(Math.log10(f));
  const fx = f => '×' + (f >= 10 ? +f.toFixed(1) : +f.toFixed(2));
  $('#scTab').innerHTML = [1.1, 1.25, 1.5, 2, 3, 4, 5].map(f => `<tr><td>${fx(f)}</td><td><b>${pts(f)}</b></td></tr>`).join('');
  const r = $('#scR'), upd = () => { const f = Math.pow(10, r.value / 100); $('#scX').textContent = t('sc.off', { x: fx(f).slice(1) }); $('#scP').textContent = t('sc.pts', { n: pts(f) }) };
  r.oninput = upd; upd();

  // Согласие требуется при первом входе; публичный ник пользователь задаёт в разделе «Статистика».
  if (!Vectra.guest && Vectra.needsTerms()) Vectra.askTerms(() => {});

  // соглашение можно перечитать в любой момент (кнопка «Принять» уже не нужна — повторно только показываем)
  $('#termsLink').onclick = e => { e.preventDefault(); Vectra.askTerms(() => {}, true) };


  async function animateWordmark() {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches || document.hidden) return;
    const word = $('.brand.big b');
    const original = word.textContent;
    const cursor = document.createElement('div');
    cursor.className = 'wordmark-pointer typing';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<svg viewBox="0 0 24 28"><path class="ibeam" d="M7 3h10M12 3v22M7 25h10"/><path class="arrow" d="M2 2v22l6-6 5 9 4-2-5-9h9Z"/></svg>';
    const letters = document.createElement('span');
    letters.className = 'wordmark-letters';
    letters.setAttribute('aria-hidden', 'true');
    word.classList.add('wordmark-editing');
    word.append(letters);
    document.body.append(cursor);
    const pause = ms => new Promise(done => setTimeout(done, ms));
    const move = (x, y) => { cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)' };
    const besideText = () => {
      const rect = letters.getBoundingClientRect();
      move(rect.right - 6, word.getBoundingClientRect().top + (word.offsetHeight - 23) / 2);
    };
    try {
      besideText();
      await pause(180);
      for (const [text, delay] of [['V',150],['VE',180],['VEC',125],['VECT',165],['VECTE',510],['VECT',210],['VECTR',160],[original,320]]) {
        if (motion.matches || document.hidden) return;
        letters.textContent = text;
        besideText();
        await pause(delay);
      }
      letters.classList.add('wordmark-selected');
      const rect = letters.getBoundingClientRect();
      cursor.classList.remove('typing');
      move(rect.right + 8, rect.bottom - 5);
      await pause(220);
      move(rect.right, rect.bottom);
      await pause(200);
      for (const scale of [1.13, 0.94, 1]) {
        if (motion.matches || document.hidden) return;
        letters.style.transform = 'scale(' + scale + ')';
        move(rect.left + rect.width * scale, rect.top + rect.height * scale);
        await pause(390);
      }
      letters.classList.remove('wordmark-selected');
      cursor.classList.add('wordmark-leaving');
      const start = cursor.getBoundingClientRect();
      const exit = innerWidth + 40;
      await cursor.animate([
        { transform: 'translate(' + start.x + 'px,' + start.y + 'px)' },
        { transform: 'translate(' + (start.x + (exit - start.x) * .35) + 'px,' + (start.y + 16) + 'px)', offset: .42 },
        { transform: 'translate(' + exit + 'px,' + Math.max(0, start.y - 56) + 'px)' }
      ], { duration: 690, easing: 'cubic-bezier(.45,.02,.68,1)' }).finished;
    } finally {
      cursor.remove();
      letters.remove();
      word.classList.remove('wordmark-editing');
    }
  }
  animateWordmark();

})();
