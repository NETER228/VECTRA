/* boot.js — запуск страницы: анонимная сессия → get_me → данные в память → только потом грузятся скрипты страницы (Vectra.run).
   Если сервер недоступен, показываем экран «нет связи»: игра без базы не работает. */
(function () {
  const root = document.documentElement; root.classList.add('booting');       // страница скрыта, пока не знаем, кто пришёл
  function offline(e) {
    console.warn('[vectra] server unavailable:', (e && e.message) || e);
    root.classList.remove('booting');
    document.body.insertAdjacentHTML('beforeend', `<div class="boot-off"><div><h2>Нет связи с сервером · No connection</h2><p>Vectra хранит прогресс на сервере и без него не запускается.<br>Vectra keeps your progress on the server and cannot start without it.</p><button class="go" onclick="location.reload()">Повторить · Retry</button></div></div>`);
  }
  Vectra.ready = (async () => {
    if (!(Vectra.db && Vectra.db.enabled())) throw new Error('supabase-js is not loaded');
    const me = await Vectra.db.me(); Vectra.hydrate(me); return me;
  })();
  Vectra.ready.catch(() => {});
  // Vectra.run(['js/a.js', …], {gate:true}): подождать профиль, проверить капчу (gate) и загрузить скрипты страницы по порядку
  Vectra.run = async (scripts, opt = {}) => {
    try { await Vectra.ready } catch (e) { return offline(e) }
    if (opt.gate && !Vectra.isVerified()) { location.replace('captcha.html'); return }
    root.classList.remove('booting');
    try {
      await Promise.all(scripts.map(src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ok; s.onerror = () => no(new Error('cannot load ' + src)); document.body.append(s) })));
    } catch (e) { console.error(e) }
  };
})();
