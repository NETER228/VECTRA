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
  Vectra.loadObjects = () => cache.o || (cache.o = loadData('objects', 'VECTRA_OBJECTS').then(d => d.objects));
})();
