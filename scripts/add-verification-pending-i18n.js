/**
 * Adds new translation keys to the `verificationPending` block across
 * mobile/public/locales/{lang}/common.json AND web/src/i18n/resources.ts.
 *
 * English values are used as a baseline for all locales. Hindi gets proper
 * translations. Other locales fall back to English (i18next's fallbackLng:'en'
 * handles it anyway, but explicit entries keep file structure consistent
 * with the codebase's "all locales, all keys" convention).
 *
 * New keys added to verificationPending:
 *   welcomeHeading, welcomeDescription, accountCreated, detailsSaved,
 *   pendingCardTitle, pendingCardHint, currentStatus, continueToApp,
 *   checkingStatus
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const LANGS = [
  'en','as','bn','brx','doi','gu','hi','kn','ks','kok','mai',
  'ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur',
]

const EN = {
  welcomeHeading: "You're almost there!",
  welcomeDescription:
    'Your account has been created. An admin will review your details and verify you within 24–48 hours. You can already explore the app and submit a question.',
  accountCreated: 'Account created',
  detailsSaved: 'Your details are saved.',
  pendingCardTitle: 'Verification pending',
  pendingCardHint: 'An admin will review your profile soon.',
  // <bold>{{status}}</bold> is a Trans component placeholder (rendered as the
  // styled <span> in PublicVerificationPendingPage.tsx).
  currentStatus: 'Current status: <bold>{{status}}</bold>',
  continueToApp: 'Continue to AnnaDatha',
  checkingStatus: 'Checking…',
  toastVerified: 'You are verified! Welcome to AnnaDatha.',
  toastCheckFailed: 'Could not check status. Please try again.',
}

const HI = {
  welcomeHeading: 'आप लगभग वहाँ पहुँच गए हैं!',
  welcomeDescription:
    'आपका खाता बन गया है। एक एडमिन आपके विवरण की समीक्षा करेगा और 24–48 घंटों के भीतर आपका सत्यापन करेगा। आप अभी ऐप का अन्वेषण कर सकते हैं और एक प्रश्न सबमिट कर सकते हैं।',
  accountCreated: 'खाता बनाया गया',
  detailsSaved: 'आपका विवरण सुरक्षित कर लिया गया है।',
  pendingCardTitle: 'सत्यापन लंबित',
  pendingCardHint: 'एक एडमिन जल्द ही आपकी प्रोफ़ाइल की समीक्षा करेगा।',
  currentStatus: 'वर्तमान स्थिति: <bold>{{status}}</bold>',
  continueToApp: 'AnnaDatha पर जारी रखें',
  checkingStatus: 'जाँच हो रही है…',
  toastVerified: 'आपका सत्यापन हो गया है! AnnaDatha में आपका स्वागत है।',
  toastCheckFailed: 'स्थिति जाँच नहीं हो सकी। कृपया पुनः प्रयास करें।',
}

function getTranslations(lang) {
  if (lang === 'hi') return HI
  return EN
}

// ─── 1. Patch mobile/public/locales/{lang}/common.json ────────────────────

let mobileFilesChanged = 0
let mobileKeysAdded = 0

for (const lang of LANGS) {
  const filePath = path.join(ROOT, 'mobile', 'public', 'locales', lang, 'common.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)

  if (!json.verificationPending || typeof json.verificationPending !== 'object') {
    throw new Error(`${filePath}: missing verificationPending block — aborting`)
  }

  const tr = getTranslations(lang)
  let addedHere = 0
  let updatedHere = 0
  for (const [k, v] of Object.entries(tr)) {
    if (!(k in json.verificationPending)) {
      json.verificationPending[k] = v
      addedHere++
    } else if (json.verificationPending[k] !== v) {
      json.verificationPending[k] = v
      updatedHere++
    }
  }

  if (addedHere > 0 || updatedHere > 0) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8')
    mobileFilesChanged++
    mobileKeysAdded += addedHere + updatedHere
    console.log(`[mobile] ${lang}: +${addedHere} keys, ~${updatedHere} updated`)
  } else {
    console.log(`[mobile] ${lang}: already up-to-date`)
  }
}

// ─── 2. Patch web/src/i18n/resources.ts ───────────────────────────────────

const webFilePath = path.join(ROOT, 'web', 'src', 'i18n', 'resources.ts')
let webSrc = fs.readFileSync(webFilePath, 'utf8')
let webKeysAdded = 0

for (const lang of LANGS) {
  const tr = getTranslations(lang)
  const escaped = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  // Match the verificationPending block for this locale only.
  const blockRe = new RegExp(
    '("' + lang + '":\\s*\\{[\\s\\S]*?"verificationPending":\\s*\\{)([\\s\\S]*?)(\\n      \\})',
    'm',
  )

  const m = webSrc.match(blockRe)
  if (!m) {
    throw new Error(`web resources.ts: could not locate verificationPending block for locale "${lang}" — aborting`)
  }

  // Walk existing keys and figure out which are missing or have stale values.
  // Captures each "key": "value", line.
  const lineRe = /^\s+"([^"]+)":\s+"((?:\\.|[^"\\])*)",?\s*$/gm
  const existing = new Map()
  let lm
  while ((lm = lineRe.exec(m[2])) !== null) {
    existing.set(lm[1], lm[2])
  }

  const toAddOrUpdate = []
  for (const [k, v] of Object.entries(tr)) {
    const ev = existing.get(k)
    if (ev === undefined) {
      toAddOrUpdate.push([k, v, 'add'])
    } else if (JSON.stringify(ev) !== JSON.stringify(v)) {
      toAddOrUpdate.push([k, v, 'update'])
    }
  }

  if (toAddOrUpdate.length === 0) {
    console.log(`[web]    ${lang}: already up-to-date`)
    continue
  }

  let body = m[2]
  let added = 0
  let updated = 0
  for (const [k, v, op] of toAddOrUpdate) {
    const lineReKey = new RegExp(
      '^(\\s+)"' + k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '":\\s+"(?:\\\\.|[^"\\\\])*",?\\s*$',
      'm',
    )
    const escapedV = escaped(v)
    if (op === 'update') {
      body = body.replace(lineReKey, (_match, indent) => `${indent}"${k}": "${escapedV}",`)
      updated++
    } else {
      added++
    }
  }
  if (added > 0) {
    const newKeyLines = toAddOrUpdate
      .filter(([, , op]) => op === 'add')
      .map(([k, v]) => `        "${k}": "${escaped(v)}",`)
      .join('\n')
    const needsComma = !body.trimEnd().endsWith(',')
    body = body + (needsComma ? ',' : '') + '\n' + newKeyLines
  }

  const newBlock = m[1] + body + m[3]
  webSrc = webSrc.replace(blockRe, () => newBlock)
  webKeysAdded += added
  console.log(`[web]    ${lang}: +${added} keys, ~${updated} updated`)
}

fs.writeFileSync(webFilePath, webSrc, 'utf8')

console.log()
console.log(`Done.`)
console.log(`  mobile source files changed: ${mobileFilesChanged}/${LANGS.length} (keys added: ${mobileKeysAdded})`)
console.log(`  web   resources.ts keys added: ${webKeysAdded}`)
console.log()
console.log(`Next: regenerate mobile/src/i18n/resources.ts by running:`)
console.log(`  cd mobile && node scripts/generate-i18n-resources.js`)
