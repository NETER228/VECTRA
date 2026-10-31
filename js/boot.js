/* boot.js — гостевой запуск: игра работает без регистрации и без записи результатов. */
(function () {
  const root = document.documentElement; root.classList.add('booting');       // страница скрыта, пока не знаем, кто пришёл
  Vectra.ready = (async () => {
    try {
      const s = await Vectra.db.session();
      Vectra.guest = !s;
      if (s) {
        Vectra.store.set('emailLogin', String(s.user.email || '').split('@')[0]);
        const me = await Vectra.db.me();
        Vectra.hydrate(me);
      }
      return { guest: Vectra.guest };
    } catch (e) {
      console.warn('[vectra] account session unavailable:', e.message || e);
      Vectra.guest = true;
      return { guest: true };
    }
  })();
  Vectra.ready.catch(() => {});
  // Vectra.run(['js/a.js', …]): загрузить скрипты страницы по порядку.
  Vectra.run = async (scripts, opt = {}) => {
    await Vectra.ready;
    root.classList.remove('booting');
    try {
      await Promise.all(scripts.map(src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = () => no(new Error('cannot load ' + src)); document.body.append(s) })));
    } catch (e) { console.error(e) }
  };
})();
