#!/usr/bin/env node
/* new_shapes.js — рисует новые силуэты прямо из кода (эллипсы, отрезки-«кости», многоугольники), кладёт их в js/shapes.js и assets/svg/*.svg
   и добавляет объекты в data/objects.json + пересобирает data/objects.js.   Запуск:  node tools/new_shapes.js
   Повторный запуск безопасен: фигуры и объекты с теми же id заменяются, а не дублируются.
   Силуэт «смотрит» вправо, ось y направлена вниз. dim: 'w' — размер объекта = ширина силуэта, 'h' — высота (люди, башни, ракеты). */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

/* ---------- примитивы: каждый возвращает список многоугольников (массивов точек) ---------- */
const ell = (cx, cy, rx, ry, rot = 0, n = 44) => {
  const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180), P = [];
  for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI, x = rx * Math.cos(a), y = ry * Math.sin(a); P.push([cx + x * c - y * s, cy + x * s + y * c]) }
  return [P];
};
const poly = pts => [pts];
const rect = (x1, y1, x2, y2) => [[[x1, y1], [x2, y1], [x2, y2], [x1, y2]]];
// отрезок с толщиной w1 → w2 и круглыми концами (ноги, шеи, хоботы, хвосты)
const seg = (x1, y1, x2, y2, w1, w2 = w1) => {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  return [[[x1 + nx * w1 / 2, y1 + ny * w1 / 2], [x2 + nx * w2 / 2, y2 + ny * w2 / 2], [x2 - nx * w2 / 2, y2 - ny * w2 / 2], [x1 - nx * w1 / 2, y1 - ny * w1 / 2]], ...ell(x1, y1, w1 / 2, w1 / 2, 0, 20), ...ell(x2, y2, w2 / 2, w2 / 2, 0, 20)];
};
const mirrorY = (shapes, axis) => shapes.map(P => P.map(([x, y]) => [x, 2 * axis - y]));
const all = (...parts) => parts.flat();

/* ---------- сами силуэты ---------- */
const SHAPES = {
  giraffe: { dim: 'h', parts: all(ell(42, 56, 20, 11, -8), seg(54, 50, 70, 14, 11, 6), ell(77, 10, 9, 5, 15), seg(72, 6, 71, 0, 1.8, 1.8), seg(77, 6, 77, 0, 1.8, 1.8),
    seg(28, 62, 27, 112, 5.5, 3.6), seg(36, 64, 36, 112, 5.5, 3.6), seg(50, 64, 51, 112, 5.5, 3.6), seg(58, 60, 60, 112, 5.5, 3.6), seg(22, 52, 16, 76, 1.8, 1.2), ell(16, 78, 2, 3.2)) },
  'blue-whale': { dim: 'w', parts: all(ell(52, 30, 50, 17), seg(95, 28, 128, 20, 16, 5), poly([[124, 20], [140, 6], [146, 8], [139, 22], [147, 34], [141, 36], [124, 24]]), poly([[34, 40], [54, 58], [50, 60], [28, 44]]), poly([[84, 19], [94, 12], [97, 24]])) },
  trex: { dim: 'w', parts: all(seg(0, 30, 38, 40, 2, 17), ell(58, 44, 24, 16, -6), seg(74, 34, 86, 22, 15, 12), poly([[80, 10], [100, 6], [118, 12], [120, 20], [104, 24], [110, 28], [98, 30], [82, 26]]),
    ell(56, 58, 12, 16, 10), seg(52, 66, 48, 84, 12, 7), poly([[40, 86], [52, 82], [62, 88], [64, 92], [38, 92]]), ell(66, 58, 11, 15, 5), seg(66, 68, 68, 84, 11, 7), poly([[58, 86], [70, 82], [80, 88], [82, 92], [56, 92]]), seg(80, 48, 88, 56, 4, 2.5)) },
  car: { dim: 'w', parts: all(poly([[0, 30], [2, 22], [16, 19], [28, 6], [54, 6], [68, 19], [84, 21], [88, 30], [88, 36], [0, 36]]), ell(19, 36, 8, 8), ell(69, 36, 8, 8)) },
  boeing747: { dim: 'w', parts: (() => { const half = all(poly([[66, 46], [44, 4], [52, 4], [80, 46]]), poly([[14, 46], [2, 33], [7, 33], [24, 46]]), ell(52, 22, 4.5, 2.2), ell(60, 34, 4.5, 2.2));
    return all(rect(4, 45, 90, 55), ell(90, 50, 10, 5), poly([[4, 46], [4, 54], [0, 51], [0, 49]]), half, mirrorY(half, 50)) })() },
  'saturn-v': { dim: 'h', parts: all(rect(-.35, 0, .35, 9), poly([[-.35, 9], [.35, 9], [1.6, 15], [-1.6, 15]]), rect(-3, 15, 3, 32), poly([[-3, 32], [3, 32], [4.5, 36], [-4.5, 36]]), rect(-4.5, 36, 4.5, 100),
    poly([[-4.5, 86], [-7.5, 100], [-4.5, 100]]), poly([[4.5, 86], [7.5, 100], [4.5, 100]])) },
  everest: { dim: 'h', parts: poly([[0, 60], [10, 52], [18, 40], [27, 44], [36, 22], [42, 26], [50, 0], [58, 18], [64, 14], [74, 34], [84, 40], [92, 52], [100, 60]]) }
};

/* ---------- объекты (метры, килограммы; значения приближённые) ---------- */
const OBJECTS = [
  { id: 'giraffe', shape: 'giraffe', cat: 'animal', ru: 'Жираф', en: 'Giraffe', size: { m: 5.0, noun: 'n.height' }, mass: 1200, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { id: 'blue-whale', shape: 'blue-whale', cat: 'animal', ru: 'Синий кит', en: 'Blue whale', size: { m: 25, noun: 'n.length' }, mass: 150000, noteRu: 'самое тяжёлое животное в истории', noteEn: 'the heaviest animal ever' },
  { id: 'trex', shape: 'trex', cat: 'animal', ru: 'Тираннозавр', en: 'Tyrannosaurus rex', size: { m: 12.3, noun: 'n.length' }, mass: 8400, noteRu: 'вымерший хищник', noteEn: 'extinct predator' },
  { id: 'car', shape: 'car', cat: 'tech', ru: 'Легковой автомобиль', en: 'Family car', size: { m: 4.5, noun: 'n.length' }, mass: 1500, noteRu: 'обычный седан', noteEn: 'an ordinary sedan' },
  { id: 'boeing747', shape: 'boeing747', cat: 'tech', ru: 'Боинг 747', en: 'Boeing 747', size: { m: 70.7, noun: 'n.length' }, mass: 180000, noteRu: 'самолёт без груза и топлива', noteEn: 'empty aircraft, no fuel or cargo' },
  { id: 'saturn-v', shape: 'saturn-v', cat: 'tech', ru: 'Ракета «Сатурн V»', en: 'Saturn V rocket', size: { m: 110.6, noun: 'n.height' }, mass: 2970000, noteRu: 'заправленная, на старте', noteEn: 'fully fuelled at liftoff' },
  { id: 'everest', shape: 'everest', cat: 'monument', ru: 'Эверест', en: 'Mount Everest', size: { m: 8849, noun: 'n.height' } },
  { id: 'moon', shape: 'mercury', cat: 'planet', ru: 'Луна', en: 'Moon', size: { m: 3474800, noun: 'n.diameter' }, mass: 7.342e22, noteRu: 'спутник Земли', noteEn: 'Earth’s satellite' },
  { id: 'pluto', shape: 'mercury', cat: 'planet', ru: 'Плутон', en: 'Pluto', size: { m: 2376600, noun: 'n.diameter' }, mass: 1.303e22, noteRu: 'карликовая планета', noteEn: 'dwarf planet' },
  { id: 'ceres', shape: 'mercury', cat: 'planet', ru: 'Церера', en: 'Ceres', size: { m: 939400, noun: 'n.diameter' }, mass: 9.384e20, noteRu: 'карликовая планета в поясе астероидов', noteEn: 'dwarf planet in the asteroid belt' }
];

/* ---------- сборка ---------- */
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function build(id, def) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const P of def.parts) for (const [x, y] of P) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  // одинаковое направление обхода у всех контуров — иначе при заливке nonzero перекрытия «вырезаются»
  const paths = def.parts.map(P => {
    let a = 0; P.forEach(([x, y], i) => { const [u, v] = P[(i + 1) % P.length]; a += x * v - u * y });
    const Q = (a < 0 ? P.slice().reverse() : P).map(([x, y]) => [r1(x - x0), r1(y - y0)]);
    return 'M' + Q.map(p => p.join(' ')).join(' L') + ' Z';
  });
  const W = r2(x1 - x0), H = r2(y1 - y0), vertical = def.dim === 'h';
  const body = vertical ? { left: 0, ref: H, top: 0, bottom: H, w: W, dim: 'h' } : { left: 0, ref: W, top: 0, bottom: H };
  const entry = { id, vbw: W, vbh: H, tf: [1, 0, 0, 1, 0, 0], rule: 'nonzero', paths, body };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${paths.join(' ')}" fill="#000" fill-rule="nonzero"/></svg>\n`;
  return { entry, svg };
}

const shapesFile = path.join(ROOT, 'js', 'shapes.js'), src = fs.readFileSync(shapesFile, 'utf8'), eq = src.indexOf('=');
let list = JSON.parse(src.slice(eq + 1).trim().replace(/;$/, ''));
fs.mkdirSync(path.join(ROOT, 'assets', 'svg'), { recursive: true });
for (const [id, def] of Object.entries(SHAPES)) {
  const { entry, svg } = build(id, def);
  list = list.filter(s => s.id !== id).concat(entry);
  fs.writeFileSync(path.join(ROOT, 'assets', 'svg', id + '.svg'), svg);
  console.log(`${id}: ${entry.paths.length} контуров, ${entry.vbw}×${entry.vbh}`);
}
fs.writeFileSync(shapesFile, src.slice(0, eq) + '=' + JSON.stringify(list) + ';\n');

const objFile = path.join(ROOT, 'data', 'objects.json'), data = JSON.parse(fs.readFileSync(objFile, 'utf8'));
for (const o of OBJECTS) {
  if (!list.some(s => s.id === o.shape)) throw new Error('нет силуэта ' + o.shape);
  const i = data.objects.findIndex(x => x.id === o.id); if (i >= 0) data.objects[i] = o; else data.objects.push(o);
}
const NL = '\n';
fs.writeFileSync(objFile, ['{', ' "_readme": ' + JSON.stringify(data._readme) + ',', ' "objects": [', data.objects.map(o => '  ' + JSON.stringify(o)).join(',' + NL), ' ]', '}', ''].join(NL));
// то же, что tools/build_data.py: data/objects.js для запуска с file://
fs.writeFileSync(path.join(ROOT, 'data', 'objects.js'), '/* Сгенерировано tools/build_data.py из objects.json — не редактировать вручную. */\nwindow.VECTRA_OBJECTS = ' + JSON.stringify(data) + ';\n');
console.log('объектов всего:', data.objects.length);
