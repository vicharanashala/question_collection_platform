#!/usr/bin/env python3
"""Fill all 146 i18n keys in every language file with Hindi (English) source values.
This ensures every screen label is present in all 22 languages.
Team can then replace English values with native-script translations per language."""
import json, os

HI_FILE = './mobile/public/locales/hi/common.json'
LANGS_DIR = './mobile/public/locales'
LANGS = ['as','bn','brx','doi','gu','hi','kn','ks','kok','mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur']

hi = json.load(open(HI_FILE))
used_keys = sorted(k.strip() for k in open('/tmp/i18n_keys.txt')
                   if '.' in k.strip() and not k.startswith('/'))
hi_keys_in_use = [k for k in used_keys if k in hi]

print(f'Keys to fill: {len(hi_keys_in_use)}')

for lang in LANGS:
    path = f'{LANGS_DIR}/{lang}/common.json'
    lang_data = json.load(open(path))

    filled = 0
    for key in hi_keys_in_use:
        if key not in lang_data:
            lang_data[key] = hi[key]
            filled += 1

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(lang_data, f, ensure_ascii=False, indent=2)

    print(f'{lang}: {filled} missing keys filled, file has {len(lang_data)} total keys')

print('\nDone. Regenerate resources: node mobile/scripts/generate-i18n-resources.js')
print('Then commit and push.')