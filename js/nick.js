/* nick.js — «придумай никнейм или останься анонимом» (показывается один раз после капчи) и фоновая синхронизация ника с базой.
   Vectra.needsNick() — пользователь ещё не выбрал; Vectra.askNick(callback) — показать окно; Vectra.syncNick() — дослать ник в базу, если раньше не было связи. */
(function () {
  const t = Vectra.t, S = Vectra.store, RE = /^[A-Za-z0-9А-Яа-яЁё_.-]{3,20}$/;
  const online = () => !!(Vectra.db && Vectra.db.enabled());
  const rnd = () => 'player_' + String(Math.floor(Math.random() * 1e5)).padStart(5, '0');
  Vectra.needsNick = () => !S.get('nickChosen', false);

  async function choose(n) {     // свой ник: уникальность проверяет база; без связи сохраняем локально и досылаем позже
    if (!online()) return { nick: n, synced: false };
    try { const p = await Vectra.db.setNickname(n, true); return { nick: p.nickname, synced: true } }
    catch (e) { const m = (e && e.message) || ''; if (m.includes('nickname_taken') || m.includes('invalid_nickname')) throw e; return { nick: n, synced: false } }
  }
  async function anonymous() {   // анонимно: базa выдаёт player_12345; без связи генерируем такой же сами
    if (online()) { try { const p = await Vectra.db.profile(); return { nick: p.nickname, synced: true } } catch (e) {} }
    return { nick: S.get('nick', '') || rnd(), synced: false };
  }
  function done(r, cb) {
    S.set('nick', r.nick); S.set('nickChosen', true); S.set('nickPending', !r.synced); dispatchEvent(new Event('vectra:profile'));
    const m = document.getElementById('nmBack'); if (m) m.remove(); if (cb) cb(r.nick);
  }

  Vectra.askNick = cb => {
    if (document.getElementById('nmBack')) return;
    document.body.insertAdjacentHTML('beforeend', `
<div class="nm-back" id="nmBack"><div class="nm-card" role="dialog" aria-modal="true" aria-labelledby="nmT">
  <h2 id="nmT">${t('nick.title')}</h2><p>${t('nick.text')}</p>
  <input id="nmIn" maxlength="20" placeholder="${t('nick.ph')}" autocomplete="off" spellcheck="false" aria-label="${t('nick.ph')}">
  <p class="nm-msg" id="nmMsg" aria-live="polite">${t('nick.rules')}</p>
  <div class="nm-btns"><button class="go" id="nmOk">${t('nick.ok')}</button><button class="go alt" id="nmAnon">${t('nick.anon')}</button></div>
  <small>${t('nick.later')}</small>
</div></div>`);
    const $ = s => document.getElementById(s), inp = $('nmIn'), msg = $('nmMsg'), ok = $('nmOk'), an = $('nmAnon');
    const say = (m, c) => { msg.textContent = m; msg.className = 'nm-msg ' + (c || '') }, busy = b => { ok.disabled = an.disabled = b };
    async function submit() {
      const n = inp.value.trim(); if (!RE.test(n)) { say(t('nick.rules'), 'err'); inp.focus(); return }
      busy(true); say(t('nick.saving'));
      try { done(await choose(n), cb) } catch (e) { busy(false); say(t((e.message || '').includes('taken') ? 'nick.taken' : 'nick.rules'), 'err'); inp.focus() }
    }
    ok.onclick = submit; inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit() });
    an.onclick = async () => { busy(true); done(await anonymous(), cb) };
    setTimeout(() => inp.focus(), 50);
  };

  // порядок после капчи: пользовательское соглашение → никнейм (или анонимность) → callback
  Vectra.onboard = cb => {
    const nick = () => Vectra.needsNick() ? Vectra.askNick(cb) : cb && cb();
    if (Vectra.needsTerms()) Vectra.askTerms(nick); else nick();
  };

  Vectra.syncNick = async () => {
    if (!S.get('nickPending') || !online()) return;
    const want = S.get('nick', '');
    try {
      const p = await Vectra.db.profile();
      if (want && p.nickname !== want) { try { S.set('nick', (await Vectra.db.setNickname(want)).nickname) } catch (e) { if (/taken|invalid/.test((e && e.message) || '')) S.set('nick', p.nickname); else throw e } }
      else S.set('nick', p.nickname);
      S.set('nickPending', false); dispatchEvent(new Event('vectra:profile'));
    } catch (e) { /* попробуем при следующем заходе */ }
  };
})();
