/* core.js — общие утилиты: хранилище, тема, язык, статус проверки, стрик. Подключается в <head> страниц. */
(function () {
  const P = 'vectra_';
  const store = {
    get(k, d) { try { const v = localStorage.getItem(P + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(P + k); } catch {} }
  };
  const root = document.documentElement;
  let theme = store.get('theme', null) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  root.dataset.theme = theme;
  const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 864e5);
  window.Vectra = {
    store,
    START: '2026-08-15',                         // день, с которого идёт нумерация Daily Question
    theme: () => root.dataset.theme,
    toggleTheme() {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = theme; store.set('theme', theme);
      dispatchEvent(new Event('vectra:theme'));
    },
    lang: () => store.get('lang', (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en'),
    setLang: l => store.set('lang', l),
    utcToday: () => new Date().toISOString().slice(0, 10),
    dayNum,
    dayIndex(d) { return dayNum(d) - dayNum(this.START) },
    // Прототип: флаг «проверка пройдена» живёт 12 часов. В проде его заменит анонимная сессия Supabase.
    isVerified: () => store.get('verified', 0) > Date.now(),
    setVerified() { store.set('verified', Date.now() + 12 * 3600e3); },
    clearVerified() { store.del('verified'); },
    // локальная история забегов (для статистики без интернета)
    addRun(mode, score) { const r = store.get('runs', []); r.push({ mode, score, t: new Date().toISOString() }); store.set('runs', r.slice(-200)) },
    // вызывается, когда игрок завершил игру / ответил на сегодняшний вопрос
    markPlayed() {
      const d = n => { const t = new Date(); t.setDate(t.getDate() - n); return t.toLocaleDateString('sv') }, last = store.get('lastPlay', '');
      if (last !== d(0)) { const n = last === d(1) ? store.get('streak', 0) + 1 : 1; store.set('streak', n); store.set('streakBest', Math.max(n, store.get('streakBest', 0))); store.set('lastPlay', d(0)) }
    }
  };
})();
