/* supabase.js — чтение публичного рейтинга. Гостевой сайт не создаёт аккаунты. */
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
      return null;
    })().finally(() => { setTimeout(() => { sessionP = null }, 5000) });   // при неудаче повторим позже
    return sessionP;
  }
  async function rpc(fn, args) {
    const s = await session(); if (!s) throw new Error('offline');
    const { data, error } = await client().rpc(fn, args); if (error) throw error;
    return data;
  }
  // Supabase Auth requires an email-shaped identifier; the UI still exposes only the username.
  const loginEmail = name => `vectra.${name.toLowerCase()}@gmail.com`;
  Vectra.db = {
    enabled: () => !!client(), session,
    async signUp(name, password) {
      const c = client(); if (!c) throw new Error('offline');
      const { data, error } = await c.auth.signUp({ email: loginEmail(name), password });
      if (error) throw error;
      if (!data.session) throw new Error('confirmation_required');
      sessionP = Promise.resolve(data.session);
      return data;
    },
    async signIn(name, password) {
      const c = client(); if (!c) throw new Error('offline');
      const { data, error } = await c.auth.signInWithPassword({ email: loginEmail(name), password });
      if (error) throw error;
      sessionP = Promise.resolve(data.session);
      return data;
    },
    async signOut() { const c = client(); if (!c) return; const { error } = await c.auth.signOut(); if (error) throw error; sessionP = null },
    profile: () => rpc('ensure_profile'),
    setNickname: (n, initial) => rpc('set_nickname', { p_nick: n, p_initial: !!initial }),
    submitDaily: (day, q, guess, truth) => rpc('submit_daily', { p_day: day, p_q: q, p_guess: guess, p_truth: truth }),
    submitRun: (mode, rounds) => rpc('submit_run', { p_mode: mode, p_rounds: rounds }),
    stats: () => rpc('get_my_stats'),
    me: () => rpc('get_me'),
    setPrefs: ({ theme, lang }) => rpc('set_prefs', { p_theme: theme ?? null, p_lang: lang ?? null }),
    acceptTerms: v => rpc('accept_terms', { p_version: v }),
    setVerified: on => rpc('set_verified', { p_on: !!on }),
    daily: day => rpc('get_daily', { p_day: day }),
    // подробности ответов на вопрос дня (день, номер вопроса, время) для статистики
    async dailyAnswers() { const s = await session(); if (!s) throw new Error('offline'); const { data, error } = await client().from('daily_answers').select('day,q_idx,score,answered_at').eq('user_id', s.user.id).order('answered_at', { ascending: true }); if (error) throw error; return data },
    // таблицы лидеров: get_leaderboard из supabase/schema.sql (виден только ник и очки). kind: compare | weight | today | total
    async leaderboard(kind) {
      const c = client(); if (!c) throw new Error('offline');
      const { data, error } = await c.rpc('get_leaderboard', { p_kind: kind });
      if (error) throw error;
      return data;
    }
  };
})();
