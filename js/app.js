/* app.js — главная: статистика в шапке, язык, счётчик архива, калькулятор очков, синхронизация с Supabase */
(function () {
  const $ = s => document.querySelector(s), t = Vectra.t, S = Vectra.store, lang = Vectra.lang();

  const tiles = (best, streak) => { $('#best').textContent = t('home.score', { n: best }); $('#streak').textContent = t('home.days', { n: streak }) };
  tiles(S.get('best', 0), S.get('streak', 0));

  const lb = $('#langBtn'); lb.textContent = t('home.langs', { l: lang.toUpperCase() });
  lb.onclick = () => Vectra.setLangAndReload(lang === 'ru' ? 'en' : 'ru');

  const nArch = Vectra.dayIndex(Vectra.utcToday()), ac = $('#archCount'); if (nArch > 0) ac.textContent = t('home.questions', { n: nArch });

  /* ---------- «как считаются очки»: таблица и калькулятор используют ту же формулу, что и игра ---------- */
  const pts = f => Math.max(0, Math.round(100 * (1 - Math.log10(f) / 2)));
  const fx = f => '×' + (f >= 10 ? +f.toFixed(1) : +f.toFixed(2));
  $('#scTab').innerHTML = [1.1, 1.5, 2, 5, 10, 30, 100].map(f => `<tr><td>${fx(f)}</td><td><b>${pts(f)}</b></td></tr>`).join('');
  const r = $('#scR'), upd = () => { const f = Math.pow(10, r.value / 100); $('#scX').textContent = t('sc.off', { x: fx(f).slice(1) }); $('#scP').textContent = t('sc.pts', { n: pts(f) }) };
  r.oninput = upd; upd();

  // первый вход без выбранного ника — спрашиваем (капчу пользователь уже прошёл); ник, сохранённый без связи, досылаем в базу
  if (Vectra.needsTerms() || Vectra.needsNick()) Vectra.onboard();

  // соглашение можно перечитать в любой момент (кнопка «Принять» уже не нужна — повторно только показываем)
  $('#termsLink').onclick = e => { e.preventDefault(); Vectra.askTerms(() => {}, true) };

})();
