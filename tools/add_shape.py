#!/usr/bin/env python3
"""Добавляет (или обновляет) силуэт в js/shapes.js.

  python3 tools/add_shape.py <файл.svg> <id> [--dim w|h]

  --dim w  (по умолчанию) размер объекта = ширина силуэта;   --dim h  — высота (башни, здания, статуи).
Понимает SVG после potrace (<path> + transform) и SVG со вшитой растровой картинкой (<image href="data:image/png;base64,…">):
второй случай векторизуется в сплошной силуэт (контур по альфа-каналу). Для планет с кольцами и Солнца замеры тела заданы вручную
в SPECIAL ниже (они были подобраны по картинкам). Нужны: pip install cairosvg opencv-python-headless numpy pillow"""
import sys, re, io, json, base64, pathlib, argparse
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
import cairosvg, cv2

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHAPES = ROOT / 'js' / 'shapes.js'
RENDER_W = 400

def raster_to_svg(text):
    m = re.search(r'href="data:image/\w+;base64,([^"]+)"', text)
    im = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')
    a = np.array(im)[..., 3]
    w = 1400; h = int(a.shape[0] * w / a.shape[1])
    a = cv2.resize(a, (w, h), interpolation=cv2.INTER_AREA)
    mask = (a > 100).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61)))   # склеиваем штриховку в сплошную фигуру
    mask = cv2.GaussianBlur(mask, (0, 0), 2.2); mask = (mask > 127).astype(np.uint8) * 255
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    cnts = [c for c in cnts if cv2.contourArea(c) > 0.002 * w * h]
    d = ' '.join('M' + ' L'.join(f'{p[0][0]} {p[0][1]}' for p in cv2.approxPolyDP(c, 1.1, True)) + ' Z' for c in cnts)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><path d="{d}" fill="#000"/></svg>'

def parse(svg_text):
    root = ET.fromstring(svg_text.encode('utf-8'))
    vb = [float(x) for x in root.get('viewBox').split()]
    tf, paths, rule = [1, 0, 0, 1, -vb[0], -vb[1]], [], 'nonzero'
    for el in root.iter():
        t = el.tag.split('}')[1]
        if t == 'g' and el.get('transform'):       # potrace: translate(x,y) scale(sx,sy)
            tx, ty, sx, sy = map(float, re.findall(r'-?[\d.]+', el.get('transform'))[:4]); tf = [sx, 0, 0, sy, tx - vb[0], ty - vb[1]]
        if t == 'path':
            paths.append(re.sub(r'\s+', ' ', el.get('d')).strip())
            if el.get('fill-rule') == 'evenodd': rule = 'evenodd'
    return vb, tf, paths, rule

# замеры тела (в пикселях растра шириной 400), подобранные вручную для объектов, где «размер» ≠ габарит картинки
SPECIAL = {}

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('svg'); ap.add_argument('id'); ap.add_argument('--dim', choices=['w', 'h'], default='w'); a = ap.parse_args()
    text = pathlib.Path(a.svg).read_text(encoding='utf-8')
    if '<image' in text and 'base64' in text: text = raster_to_svg(text)
    asset = ROOT / 'assets' / 'svg' / f'{a.id}.svg'; asset.parent.mkdir(parents=True, exist_ok=True); asset.write_text(text, encoding='utf-8')
    vb, tf, paths, rule = parse(text)
    png = cairosvg.svg2png(bytestring=text.encode('utf-8'), output_width=RENDER_W, background_color='white')
    g = np.array(Image.open(io.BytesIO(png)).convert('L')) < 128
    ys, xs = np.where(g); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    u = vb[2] / RENDER_W
    ref = (y1 - y0) if a.dim == 'h' else (x1 - x0)
    body = dict(left=round(x0 * u, 2), ref=round(ref * u, 2), top=round(y0 * u, 2), bottom=round(y1 * u, 2), w=round((x1 - x0) * u, 2), dim=a.dim)
    entry = dict(id=a.id, vbw=vb[2], vbh=vb[3], tf=tf, rule=rule, paths=paths, body=body)
    src = SHAPES.read_text(encoding='utf-8'); head, arr = src.split('=', 1)
    shapes = [s for s in json.loads(arr.strip().rstrip(';')) if s['id'] != a.id] + [entry]
    SHAPES.write_text(head + '=' + json.dumps(shapes, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{a.id}: {len(paths)} путей, dim={a.dim}, body={body}, shapes.js {SHAPES.stat().st_size // 1024} КБ')

if __name__ == '__main__': main()
