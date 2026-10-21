#!/usr/bin/env node
/* import_svgs.js — импорт готовых чёрных SVG-силуэтов (по одному контуру-«заливке» на файл) в js/shapes.js, assets/svg/ и data/objects.json.
   Запуск:  node tools/import_svgs.js "<папка с svg>"      (по умолчанию — Downloads/Telegram Desktop)
   Что делает: читает <path d="M x,y L …Z M …">, упрощает контур (Рамер–Дуглас–Пёкер, чтобы файл не раздувался), считает габариты тела,
   пишет силуэт в shapes.js (заливка evenodd — дырки в контурах остаются дырками) и добавляет/обновляет объект в objects.json.
   Размеры и массы ниже — приближённые («средний взрослый» и т.п.); поправить цифру можно прямо в таблице OBJ и запустить скрипт снова. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DIR = process.argv[2] || 'C:/Users/sules/Downloads/Telegram Desktop';

/* f — начало имени файла; dim: 'w' размер = ширина силуэта, 'h' — высота; m — размер в метрах; mass — кг (нет — объект только для Compare’It) */
const OBJ = [
  { f: 'Human Eyeball', id: 'eyeball', cat: 'animal', dim: 'w', ru: 'Глазное яблоко человека', en: 'Human eyeball', m: 0.024, noun: 'n.diameter' },
  { f: 'Merino Sheep', id: 'merino', cat: 'animal', dim: 'h', ru: 'Овца породы меринос', en: 'Merino sheep', m: 0.9, noun: 'n.height', mass: 55, noteRu: 'взрослая овца', noteEn: 'adult ewe' },
  { f: 'One_World_Trade_Center', id: 'wtc', cat: 'monument', dim: 'h', ru: 'Всемирный торговый центр 1', en: 'One World Trade Center', m: 541, noun: 'n.hAnt' },
  { f: 'Pink Salmon', id: 'salmon', cat: 'animal', dim: 'w', ru: 'Горбуша', en: 'Pink salmon', m: 0.5, noun: 'n.length', mass: 2, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Syrian Hamster', id: 'hamster', cat: 'animal', dim: 'w', ru: 'Сирийский хомяк', en: 'Syrian hamster', m: 0.17, noun: 'n.length' },
  { f: 'Typhoon Class', id: 'typhoon', cat: 'tech', dim: 'w', ru: 'Подлодка «Акула» (проект 941)', en: 'Typhoon-class submarine', m: 175, noun: 'n.length', mass: 4.8e7, noteRu: 'в подводном положении', noteEn: 'submerged displacement' },
  { f: 'White Rhinoceros Calf', id: 'rhino-calf', cat: 'animal', dim: 'w', ru: 'Новорождённый белый носорог', en: 'Newborn white rhino calf', m: 1.1, noun: 'n.length', mass: 50, noteRu: 'новорождённый', noteEn: 'newborn' },
  { f: 'Alto Saxophone', id: 'sax', cat: 'item', dim: 'h', ru: 'Альт-саксофон', en: 'Alto saxophone', m: 0.7, noun: 'n.height', mass: 2.5 },
  { f: 'Bottlenose Dolphin', id: 'dolphin', cat: 'animal', dim: 'w', ru: 'Афалина', en: 'Bottlenose dolphin', m: 2.7, noun: 'n.length', mass: 200, noteRu: 'взрослая особь', noteEn: 'adult' },
  { f: 'Bumblebee_Bat', id: 'bumblebee-bat', cat: 'animal', dim: 'w', ru: 'Свиноносая летучая мышь', en: 'Bumblebee bat', m: 0.15, noun: 'n.wingspan' },
  { f: 'Chevrolet Silverado', id: 'silverado', cat: 'tech', dim: 'w', ru: 'Chevrolet Silverado 1500', en: 'Chevrolet Silverado 1500', m: 5.8, noun: 'n.length', mass: 2300, noteRu: 'пикап, Double Cab', noteEn: 'pickup, Double Cab' },
  { f: 'Concert Flute', id: 'flute', cat: 'item', dim: 'w', ru: 'Флейта', en: 'Concert flute', m: 0.67, noun: 'n.length' },
  { f: 'Concert Grand Piano', id: 'piano', cat: 'item', dim: 'w', ru: 'Концертный рояль', en: 'Concert grand piano', m: 2.74, noun: 'n.length', mass: 480, noteRu: 'Steinway Model D', noteEn: 'Steinway Model D' },
  { f: 'Drum Kit', id: 'drums', cat: 'item', dim: 'w', ru: 'Ударная установка', en: 'Drum kit', m: 1.8, noun: 'n.width' },
  { f: 'Giant Manta Ray', id: 'manta', cat: 'animal', dim: 'w', ru: 'Гигантский манта', en: 'Giant manta ray', m: 5, noun: 'n.wingspan', mass: 1350, noteRu: 'взрослая самка', noteEn: 'adult female' },
  { f: 'Gray Wolf', id: 'wolf', cat: 'animal', dim: 'w', ru: 'Серый волк', en: 'Gray wolf', m: 1.5, noun: 'n.length', mass: 40, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Harmonica', id: 'harmonica', cat: 'item', dim: 'w', ru: 'Губная гармоника', en: 'Harmonica', m: 0.11, noun: 'n.length' },
  { f: 'Hindenburg', id: 'hindenburg', cat: 'tech', dim: 'w', ru: 'Дирижабль «Гинденбург»', en: 'Hindenburg airship', m: 245, noun: 'n.length', mass: 1.18e5, noteRu: 'без груза и топлива', noteEn: 'empty, no cargo or fuel' },
  { f: 'Human (Average Male)', id: 'human', cat: 'animal', dim: 'h', ru: 'Человек', en: 'Human', m: 1.75, noun: 'n.height', mass: 70, noteRu: 'взрослый человек', noteEn: 'an adult person' },
  { f: 'iPhone 16', id: 'iphone', cat: 'item', dim: 'h', ru: 'iPhone 16', en: 'iPhone 16', m: 0.1476, noun: 'n.height' },
  { f: 'iPod Nano', id: 'ipod', cat: 'item', dim: 'h', ru: 'iPod nano', en: 'iPod nano', m: 0.0765, noun: 'n.height' },
  { f: 'Killer Whale', id: 'orca', cat: 'animal', dim: 'w', ru: 'Косатка', en: 'Killer whale', m: 7, noun: 'n.length', mass: 5500, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Land Rover Defender', id: 'defender', cat: 'tech', dim: 'w', ru: 'Land Rover Defender 110', en: 'Land Rover Defender 110', m: 4.7, noun: 'n.length', mass: 1950, noteRu: 'внедорожник', noteEn: 'off-roader' },
  { f: 'Nelson', id: 'nelson', cat: 'monument', dim: 'h', ru: 'Колонна Нельсона', en: 'Nelson’s Column', m: 51.6, noun: 'n.height' },
  { f: 'Santiago Bernab', id: 'bernabeu', cat: 'monument', dim: 'w', ru: 'Стадион «Сантьяго Бернабеу»', en: 'Santiago Bernabéu Stadium', m: 270, noun: 'n.width' },
  { f: 'Washington Monument', id: 'washington', cat: 'monument', dim: 'h', ru: 'Монумент Вашингтона', en: 'Washington Monument', m: 169.3, noun: 'n.height', mass: 8.2e7, noteRu: 'обелиск в Вашингтоне', noteEn: 'obelisk in Washington DC' },
  { f: 'Wright Flyer', id: 'wright-flyer', cat: 'tech', dim: 'w', ru: 'Флайер братьев Райт', en: 'Wright Flyer', m: 6.4, noun: 'n.length', mass: 274, noteRu: 'первый самолёт, без пилота', noteEn: 'first powered aircraft, no pilot' },
  { f: 'Airbus A380', id: 'a380', cat: 'tech', dim: 'w', ru: 'Airbus A380', en: 'Airbus A380', m: 72.7, noun: 'n.length', mass: 2.77e5, noteRu: 'пустой самолёт', noteEn: 'empty aircraft' },
  { f: 'Chess Pawn', id: 'pawn', cat: 'item', dim: 'h', ru: 'Шахматная пешка', en: 'Chess pawn', m: 0.05, noun: 'n.height' },
  { f: 'Coca-Cola Glass Bottle', id: 'coke', cat: 'item', dim: 'h', ru: 'Стеклянная бутылка Coca-Cola', en: 'Coca-Cola glass bottle', m: 0.19, noun: 'n.height' },
  { f: 'Cricket Ball', id: 'cricket-ball', cat: 'item', dim: 'w', ru: 'Мяч для крикета', en: 'Cricket ball', m: 0.072, noun: 'n.diameter' },
  { f: 'Giant Armadillo', id: 'armadillo', cat: 'animal', dim: 'w', ru: 'Гигантский броненосец', en: 'Giant armadillo', m: 1.3, noun: 'n.length', mass: 30, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Giant Panda', id: 'panda', cat: 'animal', dim: 'h', ru: 'Большая панда', en: 'Giant panda', m: 0.75, noun: 'n.hShoulder', mass: 110, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Grizzly Bear', id: 'grizzly', cat: 'animal', dim: 'h', ru: 'Гризли', en: 'Grizzly bear', m: 2.1, noun: 'n.height', mass: 270, noteRu: 'самец, стоя на задних лапах', noteEn: 'male, standing upright' },
  { f: 'Holstein Cow', id: 'cow', cat: 'animal', dim: 'h', ru: 'Голштинская корова', en: 'Holstein cow', m: 1.5, noun: 'n.height', mass: 680, noteRu: 'молочная корова', noteEn: 'dairy cow' },
  { f: 'Modern London', id: 'bus', cat: 'tech', dim: 'w', ru: 'Лондонский двухэтажный автобус', en: 'London double-decker bus', m: 11.2, noun: 'n.length', mass: 11800, noteRu: 'современный, низкопольный', noteEn: 'modern low-floor type' },
  { f: 'PlayStation 5', id: 'ps5', cat: 'item', dim: 'h', ru: 'PlayStation 5', en: 'PlayStation 5', m: 0.39, noun: 'n.height', mass: 4.5, noteRu: 'версия с дисководом', noteEn: 'disc edition' },
  { f: 'Red Kidney Bean', id: 'bean', cat: 'item', dim: 'w', ru: 'Фасолина (красная)', en: 'Red kidney bean', m: 0.016, noun: 'n.length' },
  { f: 'Space Shuttle Discovery', id: 'shuttle', cat: 'tech', dim: 'w', ru: 'Шаттл «Дискавери»', en: 'Space Shuttle Discovery', m: 37.2, noun: 'n.length', mass: 8e4, noteRu: 'сам орбитальный корабль, пустой', noteEn: 'orbiter alone, empty' },
  { f: 'Triceratops', id: 'triceratops', cat: 'animal', dim: 'w', ru: 'Трицератопс', en: 'Triceratops', m: 9, noun: 'n.length', mass: 8000, noteRu: 'вымерший динозавр', noteEn: 'extinct dinosaur' },
  { f: 'Apple (fruit)', id: 'apple', cat: 'item', dim: 'w', ru: 'Яблоко', en: 'Apple', m: 0.08, noun: 'n.diameter' },
  { f: 'Christ the Redeemer', id: 'christ', cat: 'monument', dim: 'h', ru: 'Статуя Христа-Искупителя', en: 'Christ the Redeemer', m: 38, noun: 'n.height', mass: 6.35e5, noteRu: 'статуя вместе с постаментом', noteEn: 'statue with pedestal' },
  { f: 'Common Vampire Bat', id: 'vampire-bat', cat: 'animal', dim: 'w', ru: 'Обыкновенный вампир', en: 'Common vampire bat', m: 0.18, noun: 'n.wingspan' },
  { f: 'Die.svg', id: 'die', cat: 'item', dim: 'w', ru: 'Игральная кость', en: 'Die', m: 0.016, noun: 'n.length' },
  { f: 'French Bulldog', id: 'bulldog', cat: 'animal', dim: 'w', ru: 'Французский бульдог', en: 'French bulldog', m: 0.5, noun: 'n.length', mass: 12, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Giant Hummer', id: 'hummer', cat: 'tech', dim: 'w', ru: 'Гигантский Hummer H1', en: 'Giant Hummer H1', m: 14.1, noun: 'n.length' },
  { f: 'Leaning Tower', id: 'pisa', cat: 'monument', dim: 'h', ru: 'Пизанская башня', en: 'Leaning Tower of Pisa', m: 56, noun: 'n.height', mass: 1.45e7, noteRu: 'падающая башня', noteEn: 'the leaning tower' },
  { f: 'Rugby Ball', id: 'rugby-ball', cat: 'item', dim: 'w', ru: 'Мяч для регби', en: 'Rugby ball', m: 0.29, noun: 'n.length' },
  { f: 'Table Tennis Ball', id: 'tt-ball', cat: 'item', dim: 'w', ru: 'Мячик для настольного тенниса', en: 'Table tennis ball', m: 0.04, noun: 'n.diameter' },
  { f: 'The Motherland Calls', id: 'motherland', cat: 'monument', dim: 'h', ru: 'Родина-мать зовёт!', en: 'The Motherland Calls', m: 85, noun: 'n.height', mass: 7.9e6, noteRu: 'статуя в Волгограде', noteEn: 'statue in Volgograd' },
  { f: 'Woolly Mammoth', id: 'mammoth', cat: 'animal', dim: 'h', ru: 'Шерстистый мамонт', en: 'Woolly mammoth', m: 3.2, noun: 'n.height', mass: 6000, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'African Bush Elephant', id: 'elephant', cat: 'animal', dim: 'h', ru: 'Африканский слон', en: 'African elephant', m: 3.2, noun: 'n.height', mass: 6000, noteRu: 'взрослый самец', noteEn: 'adult bull' },
  { f: 'B-2 Spirit', id: 'b2', cat: 'tech', dim: 'w', ru: 'Бомбардировщик B-2 Spirit', en: 'B-2 Spirit bomber', m: 52.4, noun: 'n.wingspan', mass: 7.17e4, noteRu: 'пустой самолёт', noteEn: 'empty aircraft' },
  { f: 'Blue Whale Calf', id: 'whale-calf', cat: 'animal', dim: 'w', ru: 'Новорождённый синий кит', en: 'Newborn blue whale', m: 7, noun: 'n.length', mass: 2700, noteRu: 'новорождённый', noteEn: 'newborn calf' },
  { f: 'Brooklyn Bridge', id: 'brooklyn', cat: 'monument', dim: 'w', ru: 'Бруклинский мост', en: 'Brooklyn Bridge', m: 1053, noun: 'n.length' },
  { f: 'Burj Khalifa', id: 'burj', cat: 'monument', dim: 'h', ru: 'Бурдж-Халифа', en: 'Burj Khalifa', m: 828, noun: 'n.height', mass: 5e8, noteRu: 'самое высокое здание', noteEn: 'the tallest building' },
  { f: 'Giant_Forest_Hog', id: 'forest-hog', cat: 'animal', dim: 'w', ru: 'Лесная свинья', en: 'Giant forest hog', m: 1.7, noun: 'n.length', mass: 200, noteRu: 'взрослый самец', noteEn: 'adult male' },
  { f: 'Golden Gate Bridge', id: 'golden-gate', cat: 'monument', dim: 'w', ru: 'Мост Золотые Ворота', en: 'Golden Gate Bridge', m: 2737, noun: 'n.length' }
];

/* ---------- разбор и упрощение ---------- */
function rings(svg) {                      // понимает M m L l H h V v Z z (абсолютные и относительные)
  const out = [];
  for (const m of svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    let cur = null, x = 0, y = 0, cmd = 'M', pend = []; const flush = () => { if (cur && cur.length >= 3) out.push(cur); cur = null };
    for (const t of m[1].matchAll(/([MmLlHhVvZz])|(-?\d*\.?\d+)/g)) {
      if (t[1]) { cmd = t[1]; pend = []; if (/z/i.test(cmd)) flush(); else if (/m/i.test(cmd)) { flush(); cur = [] } continue }
      pend.push(+t[2]); const need = /[hHvV]/.test(cmd) ? 1 : 2; if (pend.length < need) continue;
      const v = pend.splice(0, need), rel = cmd === cmd.toLowerCase();
      if (/h/i.test(cmd)) x = rel ? x + v[0] : v[0]; else if (/v/i.test(cmd)) y = rel ? y + v[0] : v[0]; else { x = rel ? x + v[0] : v[0]; y = rel ? y + v[1] : v[1] }
      if (!cur) cur = []; cur.push([x, y]); if (/m/i.test(cmd)) cmd = rel ? 'l' : 'L';
    }
    flush();
  }
  return out;
}
function dist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; if (!L) return Math.hypot(p[0] - a[0], p[1] - a[1]); return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / Math.sqrt(L) }
function rdp(P, eps) {                     // Рамер–Дуглас–Пёкер без рекурсии
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1; const st = [[0, P.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let mx = 0, k = -1; for (let i = a + 1; i < b; i++) { const d = dist(P[i], P[a], P[b]); if (d > mx) { mx = d; k = i } } if (mx > eps) { keep[k] = 1; st.push([a, k], [k, b]) } }
  return P.filter((_, i) => keep[i]);
}
function simplifyRing(P, eps) {            // замкнутый контур: режем в самой далёкой от начала точке
  if (P.length > 1 && P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1]) P = P.slice(0, -1);
  let k = 0, mx = -1; P.forEach((p, i) => { const d = Math.hypot(p[0] - P[0][0], p[1] - P[0][1]); if (d > mx) { mx = d; k = i } });
  const A = rdp(P.slice(0, k + 1), eps), B = rdp(P.slice(k).concat([P[0]]), eps); return A.slice(0, -1).concat(B.slice(0, -1));
}

const shapesFile = path.join(ROOT, 'js', 'shapes.js'), src = fs.readFileSync(shapesFile, 'utf8'), eq = src.indexOf('=');
let shapes = JSON.parse(src.slice(eq + 1).trim().replace(/;$/, ''));
const objFile = path.join(ROOT, 'data', 'objects.json'), data = JSON.parse(fs.readFileSync(objFile, 'utf8'));
const files = fs.readdirSync(DIR);
fs.mkdirSync(path.join(ROOT, 'assets', 'svg'), { recursive: true });

console.log('id'.padEnd(14), 'dim', 'W×H'.padEnd(12), 'W/H'.padStart(6), ' другая сторона при заданном размере');
for (const o of OBJ) {
  const file = files.find(x => x.startsWith(o.f) && x.endsWith('.svg')); if (!file) { console.warn('НЕТ ФАЙЛА:', o.f); continue }
  const text = fs.readFileSync(path.join(DIR, file), 'utf8'), vb = text.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number), big = Math.max(vb[2], vb[3]);
  const eps = big * 0.0009, minSize = big * 0.004;
  let R = rings(text).map(r => simplifyRing(r, eps)).filter(r => r.length >= 3);
  R = R.filter(r => { const xs = r.map(p => p[0]), ys = r.map(p => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= minSize });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const r of R) for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const W = x1 - x0, H = y1 - y0, paths = [R.map(r => 'M' + r.map(p => Math.round(p[0]) + ' ' + Math.round(p[1])).join(' L') + ' Z').join(' ')];   // один путь: иначе evenodd не вырежет дырки
  const body = o.dim === 'h' ? { left: x0, ref: H, top: y0, bottom: y1, w: W, dim: 'h' } : { left: x0, ref: W, top: y0, bottom: y1 };
  const entry = { id: o.id, vbw: vb[2], vbh: vb[3], tf: [1, 0, 0, 1, 0, 0], rule: 'evenodd', paths, body };
  shapes = shapes.filter(s => s.id !== o.id).concat(entry);
  fs.writeFileSync(path.join(ROOT, 'assets', 'svg', o.id + '.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"><path d="${paths.join(' ')}" fill="#000" fill-rule="evenodd"/></svg>\n`);
  const other = o.dim === 'h' ? W / H * o.m : H / W * o.m;
  console.log(o.id.padEnd(14), o.dim.padEnd(3), (Math.round(W) + '×' + Math.round(H)).padEnd(12), (W / H).toFixed(2).padStart(6), ' ', (o.dim === 'h' ? 'ширина ' : 'высота ') + (+other.toPrecision(3)) + ' м');
  const obj = { id: o.id, shape: o.id, cat: o.cat, ru: o.ru, en: o.en, size: { m: o.m, noun: o.noun } };
  if (o.mass) obj.mass = o.mass; if (o.noteRu) { obj.noteRu = o.noteRu; obj.noteEn = o.noteEn }
  const i = data.objects.findIndex(x => x.id === o.id); if (i >= 0) data.objects[i] = obj; else data.objects.push(obj);
}
fs.writeFileSync(shapesFile, src.slice(0, eq) + '=' + JSON.stringify(shapes) + ';\n');
const NL = '\n';
fs.writeFileSync(objFile, ['{', ' "_readme": ' + JSON.stringify(data._readme) + ',', ' "objects": [', data.objects.map(o => '  ' + JSON.stringify(o)).join(',' + NL), ' ]', '}', ''].join(NL));
fs.writeFileSync(path.join(ROOT, 'data', 'objects.js'), '/* Сгенерировано tools/build_data.py из objects.json — не редактировать вручную. */' + NL + 'window.VECTRA_OBJECTS = ' + JSON.stringify(data) + ';' + NL);
console.log('объектов всего:', data.objects.length, '· shapes.js', Math.round(fs.statSync(shapesFile).size / 1024), 'КБ');
