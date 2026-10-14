/* supabase.js — тонкая обёртка над supabase-js: анонимная сессия + вызовы RPC из supabase/schema.sql.
   Если библиотека не загрузилась или база не настроена, Vectra.db.* бросают ошибку, а игра продолжает работать локально. */
(function () {
  const C = window.VECTRA_CONFIG || {};
  let sb = null, sessionP = null;
  function client() {
    if (sb) return sb;
    if (!window.supabase || !C.url || !C.anonKey) return null;
    sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vectra-auth' } });
    return sb;
  }
  // Анонимная сессия: регистрации нет, user_id привязан к браузеру. Нужно включить «Anonymous sign-ins» в Supabase Auth.
  function session() {
    if (sessionP) return sessionP;
    sessionP = (async () => {
      const c = client(); if (!c) return null;
      const { data: { session: s } } = await c.auth.getSession(); if (s) return s;
      const { data, error } = await c.auth.signInAnonymously();
      if (error) { console.warn('[vectra] anonymous sign-in failed:', error.message); return null }
      return data.session;
    })().finally(() => { setTimeout(() => { sessionP = null }, 5000) });   // при неудаче повторим позже
    return sessionP;
  }
  async function rpc(fn, args) {
    const s = await session(); if (!s) throw new Error('offline');
    const { data, error } = await client().rpc(fn, args); if (error) throw error;
    return data;
  }
  Vectra.db = {
    enabled: () => !!client(), session,
    profile: () => rpc('ensure_profile'),
    setNickname: (n, initial) => rpc('set_nickname', { p_nick: n, p_initial: !!initial }),
    submitDaily: (day, q, guess, truth) => rpc('submit_daily', { p_day: day, p_q: q, p_guess: guess, p_truth: truth }),
    submitRun: (mode, rounds) => rpc('submit_run', { p_mode: mode, p_rounds: rounds }),
    stats: () => rpc('get_my_stats'),
    // таблицы лидеров: view из supabase/schema.sql (виден только ник и очки)
    async leaderboard(view) { const s = await session(); if (!s) throw new Error('offline'); const { data, error } = await client().from(view).select('*'); if (error) throw error; return data }
  };
})();
