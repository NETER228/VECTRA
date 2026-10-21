/* sfx.js — звуки сайта. Ничего не скачивается: все звуки синтезируются Web Audio прямо в браузере (мягкие синусоиды в пентатонике).
   Vectra.sfx.play('click' | 'tick' | 'pick' | 'drop' | 'reveal' | 'next' | 'finish' | 'on', арг) — арг: для tick это 0..1 (высота тона), для reveal/finish — доля очков 0..1.
   Включён/выключен — кнопка в меню; выбор хранится в localStorage (это единственное, что Vectra пишет в браузер; профиль живёт на сервере). */
(function () {
  const KEY = 'vectra-sfx';
  let on = true; try { on = localStorage.getItem(KEY) !== '0' } catch (e) {}
  let ac = null, out = null, lastTick = 0;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); const comp = ac.createDynamicsCompressor(); out = ac.createGain(); out.gain.value = .55; out.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  // пентатоника до-мажор: приятно звучит при любой последовательности
  const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  function tone(f, t0, dur, o = {}) {
    const a = ctx(); if (!a) return;
    const osc = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0, vol = o.vol ?? .25;
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + (o.atk ?? .008)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + .03);
    if (o.bell) { const h = a.createOscillator(), hg = a.createGain(); h.type = 'sine'; h.frequency.value = f * 2.01; hg.gain.setValueAtTime(vol * .35, t); hg.gain.exponentialRampToValueAtTime(0.0001, t + dur * .6); h.connect(hg); hg.connect(out); h.start(t); h.stop(t + dur) }
  }
  function noise(t0, dur, f0, f1, vol) {      // «вжух» — шум через проходящий фильтр
    const a = ctx(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + t0;
    s.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * .3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + dur);
  }

  const S = {
    click() { tone(540, 0, .07, { to: 760, vol: .16 }) },
    tick(v) { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tone(520 + 700 * Math.max(0, Math.min(1, v ?? .5)), 0, .035, { type: 'triangle', vol: .07, atk: .003 }) },
    pick() { tone(330, 0, .09, { to: 440, vol: .16 }) },
    drop() { tone(300, 0, .12, { to: 200, vol: .18 }); noise(0, .06, 900, 300, .05) },
    next() { noise(0, .22, 500, 2400, .09) },
    on() { tone(660, 0, .09, { vol: .15 }); tone(880, .08, .14, { vol: .15, bell: true }) },
    // результат раунда: чем точнее ответ, тем длиннее и ярче мелодия
    reveal(r) {
      r = Math.max(0, Math.min(1, r ?? .5));
      if (r < .4) { tone(246.94, 0, .28, { to: 196, type: 'triangle', vol: .2 }); tone(185, .16, .4, { to: 146.83, type: 'triangle', vol: .18 }); return }
      if (r < .8) { tone(PENTA[2], 0, .3, { bell: true }); tone(PENTA[4], .12, .45, { bell: true }); return }
      const notes = r >= .95 ? [0, 2, 4, 5, 7, 9] : [0, 2, 4, 6];
      notes.forEach((k, i) => tone(PENTA[k + 1], i * .085, .5, { bell: true, vol: .22 }));
      if (r >= .95) tone(PENTA[10], notes.length * .085, .9, { bell: true, vol: .16 });
    },
    // конец игры: аккорд, красота которого зависит от итога
    finish(r) {
      r = Math.max(0, Math.min(1, r ?? .5));
      const set = r >= .8 ? [0, 2, 4, 5, 7, 9] : r >= .5 ? [0, 2, 4, 5] : [0, 2, 3];
      set.forEach((k, i) => tone(PENTA[k], i * .11, 1.1, { bell: true, vol: .2 }));
      if (r >= .8) set.forEach((k, i) => tone(PENTA[k + 2] || PENTA[10], .7 + i * .06, .7, { bell: true, vol: .12 }));
    }
  };

  Vectra.sfx = {
    enabled: () => on,
    set(v) { on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0') } catch (e) {} dispatchEvent(new Event('vectra:sfx')); if (on) { ctx(); S.on() } },
    toggle() { this.set(!on); return on },
    play(name, arg) { if (!on || !S[name]) return; try { if (ctx()) S[name](arg) } catch (e) {} }
  };

  // короткий щелчок на любой кнопке/карточке/пункте меню (по нажатию, чтобы отклик был мгновенным)
  document.addEventListener('pointerdown', e => {
    if (!on || e.button) return; const el = e.target.closest('button, a.card, a.item, a.go, .chip, .seg button'); if (!el || el.disabled || el.closest('[data-nosfx]')) return;
    Vectra.sfx.play('click');
  }, true);
})();
