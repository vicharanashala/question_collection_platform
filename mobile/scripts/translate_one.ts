#!/usr/bin/env node
/**
 * translate_one.ts
 * Translate one language's English i18n keys to native script via MyMemory API.
 * Run: npx tsx scripts/translate_one.ts <lang>
 * e.g.  npx tsx scripts/translate_one.ts gu
 */
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

const LANGS_DIR = path.resolve(__dirname, '..', 'public', 'locales');
const HI_FILE = path.resolve(__dirname, '..', 'public', 'locales', 'hi', 'common.json');

function getSourceKeys(): string[] {
  // Read keys from source files directly (same logic as fill_translations.ts)
  function getSourceFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) files.push(...getSourceFiles(full));
      else if (/\.t(sx)?$/.test(e.name)) files.push(full);
    }
    return files;
  }
  function extractKeys(src: string): string[] {
    const keys: string[] = [];
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
  return [...keySet].sort();
}

function httpsGet(url: string, timeout = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'agent@translation.bot' } }, (res) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function translateBatch(texts: string[], lang: string): Promise<Record<string, string>> {
  const textMap: Record<string, string> = {};
  const BATCH_SIZE = 10;
  const DELAY_BETWEEN_BATCHES_MS = 2000;
  const DELAY_BETWEEN_SINGLE_MS = 1200;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const encoded = encodeURIComponent(batch.join(' ||| '));
    const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|${lang}&de=agent@translation.bot`;

    let ok = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const data = await httpsGet(url);
        const d = JSON.parse(data);

        if (d.responseStatus === 200) {
          const raw: string = d.responseData.translatedText;
          const results = raw.split('|||').map((p: string) => p.trim());
          if (results.length === batch.length) {
            for (const [src, tr] of zip(batch, results)) {
              textMap[src] = tr;
            }
            ok = true;
            break;
          }
        } else if (d.responseStatus === 429) {
          // Rate limited — wait and retry
          const retryAfter = parseInt(d.responseDetails?.match(/\d+/)?.[0] ?? '5') * 1000;
          console.log(`  Rate limited, waiting ${retryAfter / 1000}s...`);
          await sleep(retryAfter);
          continue;
        }
        // Fallback to individual
        throw new Error(`batch failed status ${d.responseStatus}`);
      } catch (e: unknown) {
        console.log(`  batch ${i / BATCH_SIZE + 1} fallback (attempt ${attempt + 1})`, e instanceof Error ? e.message : '');
        await sleep(2000);
      }
    }

    if (!ok) {
      // Per-text fallback
      for (const src of batch) {
        await sleep(DELAY_BETWEEN_SINGLE_MS);
        try {
          const url2 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(src)}&langpair=en|${lang}`;
          const data = await httpsGet(url2);
          const d2 = JSON.parse(data);
          textMap[src] = d2.responseStatus === 200 ? d2.responseData.translatedText : src;
        } catch {
          textMap[src] = src;
        }
      }
    }

    if (i + BATCH_SIZE < texts.length) await sleep(DELAY_BETWEEN_BATCHES_MS);
  }

  return textMap;
}

function zip<T, U>(a: T[], b: U[]): [T, U][] {
  return a.map((v, i) => [v, b[i]]);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const lang = process.argv[2];
  if (!lang) {
    console.error('Usage: npx tsx scripts/translate_one.ts <lang>');
    process.exit(1);
  }

  const hi: Record<string, string> = JSON.parse(fs.readFileSync(HI_FILE, 'utf-8'));
  const usedKeys = getSourceKeys();
  const hiKeysInUse = usedKeys.filter(k => k in hi);

  const langData: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(LANGS_DIR, lang, 'common.json'), 'utf-8')
  );

  // Find English-only keys (need translation)
  const englishKeys: Record<string, string> = {};
  for (const key of hiKeysInUse) {
    const v = langData[key];
    if (typeof v === 'string' && /^[\x00-\x7F]*$/.test(v) && v === hi[key] && v.length < 80) {
      englishKeys[key] = hi[key];
    }
  }

  if (Object.keys(englishKeys).length === 0) {
    console.log(`${lang}: nothing to do — all keys already translated`);
    return;
  }

  // Unique source texts to translate
  const uniqueTexts = [...new Set(Object.values(englishKeys))];
  console.log(`${lang}: ${Object.keys(englishKeys).length} keys, ${uniqueTexts.length} texts to translate`);

  const textMap = await translateBatch(uniqueTexts, lang);

  // Apply translations
  for (const [key, srcText] of Object.entries(englishKeys)) {
    langData[key] = textMap[srcText] ?? srcText;
  }

  fs.writeFileSync(
    path.join(LANGS_DIR, lang, 'common.json'),
    JSON.stringify(langData, null, 2),
    'utf-8'
  );

  console.log(`${lang}: done (${Object.keys(englishKeys).length} keys translated)`);
}

main().catch(console.error);