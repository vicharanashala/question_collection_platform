#!/usr/bin/env python3
"""Translate one language - run independently per language."""
import json, time, urllib.request, urllib.parse, sys

lang = sys.argv[1]
LANGS_DIR = './mobile/public/locales'
hi = json.load(open('./mobile/public/locales/hi/common.json'))
used_keys = set(l.strip() for l in open('/tmp/i18n_keys.txt') if '.' in l and not l.startswith('/'))
hi_keys_in_use = sorted(k for k in used_keys if k in hi)
source_map = {k: hi[k] for k in hi_keys_in_use}

lang_data = json.load(open(f'{LANGS_DIR}/{lang}/common.json'))
english_keys = {}
for key in hi_keys_in_use:
    v = lang_data.get(key)
    if isinstance(v, str) and v.isascii() and len(v) < 80:
        english_keys[key] = source_map[key]

if not english_keys:
    print(f'{lang}: nothing to do')
    sys.exit(0)

unique_texts = list(dict.fromkeys(english_keys.values()))
print(f'{lang}: {len(english_keys)} keys, {len(unique_texts)} texts')

BATCH_SIZE = 10
text_map = {}

for i in range(0, len(unique_texts), BATCH_SIZE):
    batch = unique_texts[i:i+BATCH_SIZE]
    url = 'https://api.mymemory.translated.net/get?' + urllib.parse.urlencode({
        'q': ' ||| '.join(batch), 'langpair': 'en|' + lang, 'de': 'agent@translation.bot'
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                d = json.loads(r.read())
            if d.get('responseStatus') == 200:
                raw = d['responseData']['translatedText']
                results = [p.strip() for p in raw.split('|||')]
                if len(results) == len(batch):
                    for src, tr in zip(batch, results):
                        text_map[src] = tr
                    break
            # Fallback to individual
            print(f'  batch {i//BATCH_SIZE+1} fallback', flush=True)
            for src in batch:
                url2 = 'https://api.mymemory.translated.net/get?' + urllib.parse.urlencode({
                    'q': src, 'langpair': 'en|' + lang
                })
                try:
                    with urllib.request.urlopen(url2, timeout=15) as r2:
                        d2 = json.loads(r2.read())
                    text_map[src] = d2['responseData']['translatedText'] if d2.get('responseStatus') == 200 else src
                except Exception:
                    text_map[src] = src
                time.sleep(1.2)
            break
        except Exception as e:
            time.sleep(3)
    else:
        for src in batch:
            text_map[src] = src
    time.sleep(2)

for key in english_keys:
    lang_data[key] = text_map.get(source_map[key], source_map[key])

with open(f'{LANGS_DIR}/{lang}/common.json', 'w', encoding='utf-8') as f:
    json.dump(lang_data, f, ensure_ascii=False, indent=2)

print(f'{lang}: done ({len(english_keys)} keys)')