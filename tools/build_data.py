#!/usr/bin/env python3
"""Собирает data/questions.js и data/objects.js из одноимённых .json.
Нужен только если открываешь сайт прямо из папки (file://), где браузер запрещает fetch() к JSON.
На хостинге (Vercel, Cloudflare Pages, GitHub Pages) и через `python3 -m http.server` страницы читают .json напрямую."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent / 'data'
for name, var in (('questions', 'VECTRA_QUESTIONS'), ('objects', 'VECTRA_OBJECTS')):
    data = json.loads((root / f'{name}.json').read_text(encoding='utf-8'))
    (root / f'{name}.js').write_text(f'/* Сгенерировано tools/build_data.py из {name}.json — не редактировать вручную. */\nwindow.{var} = ' + json.dumps(data, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f'data/{name}.js обновлён')
