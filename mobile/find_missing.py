import json

HI_FILE = './mobile/public/locales/hi/common.json'
LANGS_DIR = './mobile/public/locales'
LANGS = ['as','bn','brx','doi','gu','kn','ks','kok','mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur']

# Load used keys (i18n keys from code, excluding API paths and comments)
with open('/tmp/i18n_keys.txt') as f:
    used_keys = set(line.strip() for line in f if '.' in line and not line.startswith('/'))

print(f'Used i18n keys: {len(used_keys)}')

hi = json.load(open(HI_FILE))
hi_keys_in_use = set(k for k in used_keys if k in hi)
print(f'Hindi keys in use: {len(hi_keys_in_use)}')

# For each language, find which used keys are missing or English placeholders
def check(lang):
    d = json.load(open(f'{LANGS_DIR}/{lang}/common.json'))
    missing = []
    english = []
    for k in sorted(hi_keys_in_use):
        if k not in d:
            missing.append(k)
        else:
            v = d[k]
            if isinstance(v, str) and v.isascii() and len(v) < 80:
                english.append((k, v))
    return missing, english

for lang in LANGS:
    missing, english = check(lang)
    total = len(missing) + len(english)
    if total > 0:
        print(f'\n{lang}: {len(missing)} MISSING, {len(english)} English → {total} need translation')
        if missing:
            print('  Missing: ' + ', '.join(missing[:5]) + ('...' if len(missing)>5 else ''))
        if english:
            print('  English: ' + ', '.join(k+'='+repr(v[:30]) for k,v in english[:8]) + ('...' if len(english)>8 else ''))
    else:
        print(f'{lang}: OK')