/* core.js — общие утилиты. ВАЖНО: Vectra.store живёт только в памяти страницы и ничего не пишет в браузер.
   Всё состояние игрока (ник, соглашение, капча, тема/язык, стрик, рекорд, ответы на вопрос дня) хранится в Supabase и подтягивается
   при каждой загрузке страницы (см. boot.js → get_me). В браузере остаётся только токен анонимной сессии supabase-js. */
(function () {
  const root = document.documentElement, mem = { gameActive: false };
  const store = { get: (k, d) => (k in mem ? mem[k] : d), set(k, v) { mem[k] = v }, del(k) { delete mem[k] } };
  root.dataset.theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';      // до загрузки профиля — системная тема
  const fade = () => { root.classList.add('theme-crossfade'); clearTimeout(fade.t); fade.t = setTimeout(() => root.classList.remove('theme-crossfade'), 700) };      // плавная смена темы только на время смены, иначе !important ломает остальные анимации
  fade();
  const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5);
  window.Vectra = {
    store,
    START: '2026-08-15',                         // день, с которого идёт нумерация Daily Question (перекрывается значением из data/questions.json)
    theme: () => root.dataset.theme,
    toggleTheme() {
      const t = root.dataset.theme === 'dark' ? 'light' : 'dark'; fade(); root.dataset.theme = t; mem.theme = t; dispatchEvent(new Event('vectra:theme'));
      if (this.db) this.db.setPrefs({ theme: t }).catch(() => {});
    },
    setGameActive(v) { mem.gameActive = !!v; },
    isGameActive() { return !!mem.gameActive; },
    lang: () => mem.lang || ((navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en'),
    setLang(l) { mem.lang = l; return this.db ? this.db.setPrefs({ lang: l }) : Promise.resolve() },
    // данные профиля с сервера → память страницы
    hydrate(me) {
      const m = me || {}, st = m.streak || {}, pr = m.prefs || {};
      Object.assign(mem, { nick: m.nickname || '', nickChosen: !!m.nickname_set, nickChangedAt: m.changed_at || '', terms: { v: m.terms || 0 }, verified: m.verified_until || 0,
        best: m.best || 0, streak: st.current || 0, streakBest: st.best || 0, daily: m.daily || {}, theme: pr.theme, lang: pr.lang });
      if (pr.theme && pr.theme !== root.dataset.theme) { fade(); root.dataset.theme = pr.theme; dispatchEvent(new Event('vectra:theme')) }
    },
    isVerified: () => (mem.verified || 0) > Date.now(),
    setVerified() { mem.verified = Date.now() + 12 * 3600e3; return this.db.setVerified(true) },
    clearVerified() { mem.verified = 0; return this.db.setVerified(false) },
    markPlayed() {}, addRun() {},               // стрик и история считаются на сервере (submit_run / submit_daily)
    utcToday: () => new Date().toISOString().slice(0, 10),
    dayNum,
    dayIndex(d) { return dayNum(d) - dayNum(this.START) }
  };
  addEventListener('pagehide', () => Vectra.setGameActive(false));
  addEventListener('visibilitychange', () => { if (document.hidden) Vectra.setGameActive(false) });
})();
