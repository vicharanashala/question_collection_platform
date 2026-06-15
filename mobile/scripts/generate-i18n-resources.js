const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'i18n', 'resources.ts');

const LANGS = [
  'en','as','bn','brx','doi','gu','hi','kn','ks','kok','mai',
  'ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur'
];

function loadLang(lang) {
  const dir = path.join(LOCALES_DIR, lang);
  const merged = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    const ns = file.replace('.json', '');
    merged[ns] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return merged;
}

const resources = {};
for (const lang of LANGS) resources[lang] = loadLang(lang);

fs.writeFileSync(OUTPUT_FILE, `// AUTO-GENERATED — do not edit manually\n// Run: node scripts/generate-i18n-resources.js\n\nconst resources = ${JSON.stringify(resources, null, 2)};\n\nexport default resources;\n`);
console.log(`Written ${LANGS.length} languages → ${OUTPUT_FILE}`);
