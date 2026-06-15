#!/usr/bin/env python3
import json, time, urllib.request, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

hi = json.load(open('./mobile/public/locales/hi/common.json'))
used_keys = set(l.strip() for l in open('/tmp/i18n_keys.txt') if '.' in l and not l.startswith('/'))
hi_keys_in_use = sorted(k for k in used_keys if k in hi)
source_map = {k: hi[k] for k in hi_keys_in_use}

LANGS_DIR = './mobile/public/locales'
ALL_LANGS = ['as','bn','gu','kn','ks','mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur']
BATCH_SIZE = 10

def translate_batch(texts, lang_pair):
    url = 'https://api.mymemory.translated.net/get?' + urllib.parse.urlencode({
        'q': ' ||| '.join(texts), 'langpair': lang_pair, 'de': 'agent@translation.bot'
    })
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                d = json.loads(r.read())
            if d.get('responseStatus') == 200:
                raw = d['responseData']['translatedText']
                return [p.strip() for p in raw.split('|||')]
            elif d.get('responseStatus') == 429:
                time.sleep(5)
                continue
            return None
        except Exception:
            time.sleep(2 ** attempt)
    return None

def do_lang(lang):
    lang_data = json.load(open(f'{LANGS_DIR}/{lang}/common.json'))
    english_keys = {}
    for key in hi_keys_in_use:
        v = lang_data.get(key)
        if isinstance(v, str) and v.isascii() and len(v) < 80:
            english_keys[key] = source_map[key]
    if not english_keys:
        return lang, {}, {}
    unique_texts = list(dict.fromkeys(english_keys.values()))
    text_map = {}
    for i in range(0, len(unique_texts), BATCH_SIZE):
        batch = unique_texts[i:i+BATCH_SIZE]
        for attempt in range(3):
            results = translate_batch(batch, 'en|' + lang)
            if results and len(results) == len(batch):
                for src, tr in zip(batch, results):
                    text_map[src] = tr
                break
            time.sleep(3)
        else:
            for src in batch:
                text_map[src] = src
        time.sleep(1.5)
    return lang, text_map, english_keys

with ThreadPoolExecutor(max_workers=10) as ex:
    futures = {ex.submit(do_lang, lang): lang for lang in ALL_LANGS}
    done = 0
    for future in as_completed(futures):
        try:
            lang, text_map, english_keys = future.result()
            if english_keys:
                lang_data = json.load(open(f'{LANGS_DIR}/{lang}/common.json'))
                for key in english_keys:
                    lang_data[key] = text_map.get(source_map[key], source_map[key])
                with open(f'{LANGS_DIR}/{lang}/common.json', 'w', encoding='utf-8') as f:
                    json.dump(lang_data, f, ensure_ascii=False, indent=2)
            print('Done', lang, ':', len(english_keys), 'keys')
        except Exception as e:
            print('Error:', e)
        done += 1
        print('Progress:', done, '/', len(ALL_LANGS))

print('ALL DONE')