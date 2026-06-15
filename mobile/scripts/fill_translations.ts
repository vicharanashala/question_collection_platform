#!/usr/bin/env node
/**
 * fill_translations.ts
 * Ensures every i18n key used in source files is present in all 22 language files.
 * Reads keys from TypeScript source directly — no shell dependencies.
 * Missing keys get the Hindi (English) source value; existing translations are preserved.
 */
import * as fs from 'fs';
import * as path from 'path';

const LANGS_DIR = path.resolve(__dirname, '..', 'public', 'locales');
const HI_FILE = path.resolve(__dirname, '..', 'public', 'locales', 'hi', 'common.json');
const LANGS = [
  'as','bn','brx','doi','gu','hi','kn','ks','kok',
  'mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur',
];

// Recursively find all .ts/.tsx files
function getSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...getSourceFiles(full));
    } else if (/\.t(sx)?$/.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

// Extract i18n keys from source content
function extractKeys(src: string): string[] {
  const keys: string[] = [];
  // i18n keys only contain: letters, digits, underscore, hyphen, dot
  for (const m of src.matchAll(/t\(['"]([a-zA-Z0-9_.-]+)['"]\)/g)) {
    keys.push(m[1]);
  }
  return keys;
}

const srcFiles = getSourceFiles(path.resolve(__dirname, '..', 'src'));
const keySet = new Set<string>();
for (const f of srcFiles) {
  const src = fs.readFileSync(f, 'utf-8');
  for (const k of extractKeys(src)) keySet.add(k);
}
const hiKeysInUse = [...keySet].sort();

console.log(`Keys to fill: ${hiKeysInUse.length}`);

// Load Hindi (source — all English values)
const hi: Record<string, string> = JSON.parse(fs.readFileSync(HI_FILE, 'utf-8'));

let grandFilled = 0;

for (const lang of LANGS) {
  const filePath = path.join(LANGS_DIR, lang, 'common.json');
  const langData: Record<string, unknown> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  let filled = 0;
  for (const key of hiKeysInUse) {
    if (!(key in langData)) {
      langData[key] = hi[key] ?? key;
      filled++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(langData, null, 2), 'utf-8');
  grandFilled += filled;
  console.log(`${lang}: filled=${filled}, total=${hiKeysInUse.length}`);
}

console.log(`\nTotal missing keys filled: ${grandFilled}`);
console.log('Regenerate resources: node scripts/generate-i18n-resources.js');