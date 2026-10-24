/* qload.js — загрузка данных из data/*.json (единственный источник).
   Если страница открыта прямо из папки (file://), fetch к JSON запрещён браузером — тогда читаем data/<имя>.js, который собирает tools/build_data.py. */
(function () {
  const cache = {};
  function loadData(name, globalName) {
    return cache[name] || (cache[name] = (async () => {
      try { const r = await fetch(`data/${name}.json`, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return await r.json() }
      catch (e) {
        await new Promise((ok, no) => { const s = document.createElement('script'); s.src = `data/${name}.js`; s.onload = ok; s.onerror = no; document.head.append(s) });
        return window[globalName];
      }
    })());
  }
  Vectra.loadQuestions = () => cache.q || (cache.q = loadData('questions', 'VECTRA_QUESTIONS').then(d => {
    const list = d.questions.map(q => [q.ru, q.en, q.answer, q.unit]), n = list.length, step = d.step || 55;
    Vectra.START = d.start || Vectra.START;
    const Q = { units: d.units, list, start: d.start };
    Q.idxOf = i => (((i % n) + n) % n * step) % n;     // номер дня -> индекс вопроса
    Q.pick = i => list[Q.idxOf(i)];
    return Q;
  }));
  // Compare’It: подбор пар (сложность растёт от раунда к раунду). rnd — функция 0..1; для архива она задана датой, и пары у всех одинаковые
  Vectra.seededRng = str => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19 }
    let a = h >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } };
  Vectra.comparePairs = (OBJ, rnd = Math.random) => {
    const tiers = [[.05, 1], [.25, 1.7], [1, 2.6], [1.5, 4.2], [3, 10]], used = new Map(), res = [];
    const astro = o => ['star', 'planet', 'exo', 'bh'].includes(o.cat), tiny = o => o.cat === 'animal' || o.cat === 'item';
    for (const [lo, hi] of tiers) {
      let c = [];
      for (const a of OBJ) for (const b of OBJ) { if (a === b || (tiny(a) && astro(b)) || (tiny(b) && astro(a))) continue; const lr = Math.abs(Math.log10(b.len / a.len)); if (lr >= lo && lr <= hi) c.push([a, b, (used.get(a) || 0) + (used.get(b) || 0)]) }
      const m = Math.min(...c.map(x => x[2])); c = c.filter(x => x[2] === m);
      const [a, b] = c[rnd() * c.length | 0];
      used.set(a, (used.get(a) || 0) + 1); used.set(b, (used.get(b) || 0) + 1); res.push({ A: a, B: b });
    }
    return res;
  };
  // название архивной партии: «Compare’It от 24.10.26»
  Vectra.compareName = (d, lang) => { const [y, m, dd] = d.split('-'); return 'Compare’It ' + (lang === 'ru' ? 'от ' : '· ') + dd + '.' + m + '.' + y.slice(2) };
  Vectra.loadObjects = () => cache.o || (cache.o = loadData('objects', 'VECTRA_OBJECTS').then(d => d.objects));
})();
