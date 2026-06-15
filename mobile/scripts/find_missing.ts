#!/usr/bin/env node
/**
 * find_missing.ts
 * Reports which i18n keys are missing or still in English (untranslated) per language.
 * Reads source files directly — no shell/grep dependency, works on macOS & Linux.
 */
import * as fs from 'fs';
import * as path from 'path';

const LANGS_DIR = path.resolve(__dirname, '..', 'public', 'locales');
const HI_FILE = path.resolve(__dirname, '..', 'public', 'locales', 'hi', 'common.json');
const LANGS = [
  'as','bn','brx','doi','gu','hi','kn','ks','kok',
  'mai','ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur',
];

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

function extractKeys(src: string): string[] {
  const keys: string[] = [];
  // i18n keys only contain: letters, digits, underscore, hyphen, dot
  // Avoids path-like strings (../../), template literal args ({ limit: ... }), etc.
  for (const m of src.matchAll(/t\(['"]([a-zA-Z0-9_.-]+)['"]\)/g)) {
    if (m[1].includes('/')) continue; // skip path-like (../../api/client)
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

console.log(`i18n keys in use: ${hiKeysInUse.length}\n`);

const hi: Record<string, string> = JSON.parse(fs.readFileSync(HI_FILE, 'utf-8'));
const asciiRe = /^[\x00-\x7F]*$/;

let allOk = true;

for (const lang of LANGS) {
  const filePath = path.join(LANGS_DIR, lang, 'common.json');
  const langData: Record<string, string> = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  const missing: string[] = [];
  const english: string[] = [];
  const native: string[] = [];

  for (const key of hiKeysInUse) {
    const val = langData[key];
    if (val === undefined) {
      missing.push(key);
    } else if (asciiRe.test(val) && val === hi[key]) {
      english.push(key);
    } else {
      native.push(key);
    }
  }

  const total = hiKeysInUse.length;
  const missingCount = missing.length;
  const englishCount = english.length;
  const nativeCount = native.length;

  if (missingCount === 0 && englishCount === 0) {
    console.log(`${lang}: ✅ ${nativeCount}/${total} native`);
  } else if (missingCount > 0) {
    console.log(`${lang}: ❌ ${missingCount} missing, ${englishCount} English — ${nativeCount} native`);
    console.log(`    Missing: ${missing.join(', ')}`);
    allOk = false;
  } else {
    console.log(`${lang}: ⚠️  ${nativeCount} native, ${englishCount} English — ${nativeCount + englishCount}/${total}`);
    if (englishCount > 0 && englishCount <= 5) {
      for (const k of english) {
        console.log(`    ${k} = '${langData[k]}'`);
      }
    } else if (englishCount > 0) {
      console.log(`    (${englishCount} English keys — first 3: ${english.slice(0, 3).join(', ')})`);
    }
  }
}

if (allOk) {
  console.log('\n✅ All 22 languages have all keys. No missing keys.');
} else {
  console.log('\n❌ Run: npx tsx fill_translations.ts');
}