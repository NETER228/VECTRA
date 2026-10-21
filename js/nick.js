/* nick.js — «придумай никнейм или останься анонимом» (один раз после соглашения). Ник и признак выбора хранятся на сервере.
   Vectra.needsNick() — игрок ещё не выбирал; Vectra.onboard(cb) — соглашение → никнейм → callback. */
(function () {
  const t = Vectra.t, S = Vectra.store, RE = /^[A-Za-z0-9А-Яа-яЁё_.-]{3,20}$/;
  Vectra.needsNick = () => !S.get('nickChosen', false);
  function done(nick, cb) {
    S.set('nick', nick); S.set('nickChosen', true); dispatchEvent(new Event('vectra:profile'));
    const m = document.getElementById('nmBack'); if (m) m.remove(); if (cb) cb(nick);
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
    async function submit() {            // свой ник: уникальность проверяет сервер
      const n = inp.value.trim(); if (!RE.test(n)) { say(t('nick.rules'), 'err'); inp.focus(); return }
      busy(true); say(t('nick.saving'));
      try { const p = await Vectra.db.setNickname(n, true); done(p.nickname, cb) }
      catch (e) { busy(false); const m = (e && e.message) || ''; say(t(m.includes('taken') ? 'nick.taken' : m.includes('invalid') ? 'nick.rules' : 'err.save'), 'err'); inp.focus() }
    }
    ok.onclick = submit; inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit() });
    an.onclick = async () => {           // анонимно: сервер уже выдал ник player_12345 — просто отмечаем, что выбор сделан
      busy(true); say(t('nick.saving'));
      try { const p = await Vectra.db.profile(); const q = await Vectra.db.setNickname(p.nickname, true); done(q.nickname, cb) } catch (e) { busy(false); say(t('err.save'), 'err') }
    };
    setTimeout(() => inp.focus(), 50);
  };
  Vectra.onboard = cb => {
    const nick = () => Vectra.needsNick() ? Vectra.askNick(cb) : cb && cb();
    if (Vectra.needsTerms()) Vectra.askTerms(nick); else nick();
  };
})();
