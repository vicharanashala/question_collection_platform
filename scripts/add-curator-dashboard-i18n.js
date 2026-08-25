/**
 * Adds the `curatorDashboard` translation block to:
 *   • mobile/public/locales/{lang}/common.json   (×23 locales, source of truth)
 *   • web/src/i18n/resources.ts                  (auto-copied bundle)
 *
 * Hindi gets real translations. The other 22 locales fall back to English
 * baseline values (i18next's `fallbackLng:'en'` would produce the same UX
 * anyway, but explicit entries keep file structure consistent with the
 * codebase's "all locales, all keys" convention used for `verificationPending`,
 * `admin`, `home`, etc.).
 *
 * See the bottom of this file for the full list of keys.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

const LANGS = [
  'en','as','bn','brx','doi','gu','hi','kn','ks','kok','mai',
  'ml','mni','mr','ne','or','pa','sa','sat','sd','ta','te','ur',
]

const EN = {
  title: 'Review Dashboard',
  subtitle: 'Curator overview · last 30 days',

  range30d: '30D',
  range7d: '7D',
  range90d: '90D',

  statQueue: 'Review Queue',
  statQueueSub: '{{count}} awaiting action',
  statApproved: 'Approved',
  statApprovedSub: '{{rate}}% approval rate',
  statRejected: 'Rejected',
  statRejectedSub: '{{count}} total submitted',

  slaTitle: 'SLA Breach Warning',
  // <bold>...</bold> are Trans component placeholders that render as
  // styled <span className="font-semibold"> in CuratorDashboardPage.tsx.
  slaMessage: 'Average review turnaround is <bold>{{minutes}}m</bold> — above the 60-minute target.',
  slaQueueNote: '<bold>{{count}}</bold> questions in queue.',

  dailyVolumeTitle: 'Daily Submission Volume',
  dailyVolumeSub: 'Last 30 days — submitted, approved, rejected',
  legendSubmitted: 'Submitted',
  legendApproved: 'Approved',
  legendRejected: 'Rejected',

  queueByStatusTitle: 'Queue by Status',
  queueByStatusSub: 'Current distribution',

  topStatesTitle: 'Top States by Volume',
  topStatesSub: 'Questions submitted per state',

  topCropsTitle: 'Top Crops',
  topCropsSub: 'Question distribution by crop type',

  quickActionsTitle: 'Quick Actions',
  quickActionsSub: 'Navigate the platform',
  actionReviewQueue: 'Review Queue',
  actionAllQuestions: 'All Questions',

  noVolumeData: 'No volume data available',
  loadError: 'Failed to load curator stats',
}

const HI = {
  title: 'समीक्षा डैशबोर्ड',
  subtitle: 'क्यूरेटर अवलोकन · पिछले 30 दिन',

  range30d: '30 दिन',
  range7d: '7 दिन',
  range90d: '90 दिन',

  statQueue: 'समीक्षा कतार',
  statQueueSub: '{{count}} कार्रवाई लंबित',
  statApproved: 'स्वीकृत',
  statApprovedSub: '{{rate}}% स्वीकृति दर',
  statRejected: 'अस्वीकृत',
  statRejectedSub: '{{count}} कुल सबमिट किए गए',

  slaTitle: 'SLA उल्लंघन चेतावनी',
  slaMessage: 'औसत समीक्षा टर्नअराउंड <bold>{{minutes}} मिनट</bold> है — 60 मिनट के लक्ष्य से अधिक।',
  slaQueueNote: 'कतार में <bold>{{count}}</bold> प्रश्न हैं।',

  dailyVolumeTitle: 'दैनिक सबमिशन वॉल्यूम',
  dailyVolumeSub: 'पिछले 30 दिन — सबमिट किए गए, स्वीकृत, अस्वीकृत',
  legendSubmitted: 'सबमिट किए गए',
  legendApproved: 'स्वीकृत',
  legendRejected: 'अस्वीकृत',

  queueByStatusTitle: 'स्थिति के अनुसार कतार',
  queueByStatusSub: 'वर्तमान वितरण',

  topStatesTitle: 'वॉल्यूम के अनुसार शीर्ष राज्य',
  topStatesSub: 'प्रति राज्य सबमिट किए गए प्रश्न',

  topCropsTitle: 'शीर्ष फसलें',
  topCropsSub: 'फसल प्रकार के अनुसार प्रश्न वितरण',

  quickActionsTitle: 'त्वरित कार्रवाइयां',
  quickActionsSub: 'प्लेटफ़ॉर्म पर नेविगेट करें',
  actionReviewQueue: 'समीक्षा कतार',
  actionAllQuestions: 'सभी प्रश्न',

  noVolumeData: 'कोई वॉल्यूम डेटा उपलब्ध नहीं है',
  loadError: 'क्यूरेटर आँकड़े लोड करने में विफल',
}

function getTranslations(lang) {
  if (lang === 'hi') return HI
  return EN
}


// ─── 1. Patch mobile/public/locales/{lang}/common.json ────────────────────

let mobileFilesChanged = 0
let mobileKeysAdded = 0
let mobileKeysUpdated = 0

for (const lang of LANGS) {
  const filePath = path.join(ROOT, 'mobile', 'public', 'locales', lang, 'common.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)

  if (!json.curatorDashboard || typeof json.curatorDashboard !== 'object') {
    json.curatorDashboard = {}
  }

  const tr = getTranslations(lang)
  let addedHere = 0
  let updatedHere = 0
  for (const [k, v] of Object.entries(tr)) {
    if (!(k in json.curatorDashboard)) {
      json.curatorDashboard[k] = v
      addedHere++
    } else if (json.curatorDashboard[k] !== v) {
      json.curatorDashboard[k] = v
      updatedHere++
    }
  }

  if (addedHere > 0 || updatedHere > 0) {
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8')
    mobileFilesChanged++
    mobileKeysAdded += addedHere
    mobileKeysUpdated += updatedHere
    console.log(`[mobile] ${lang}: +${addedHere} keys, ~${updatedHere} updated`)
  } else {
    console.log(`[mobile] ${lang}: already up-to-date`)
  }
}


// ─── 2. Patch web/src/i18n/resources.ts ───────────────────────────────────
//
// Strategy: for each locale, find the bounds of `"<lang>": { ... }` by
// brace-counting, then find `"common": { ... }` inside it, then either add
// to an existing `"curatorDashboard": { ... }` block or create a new one
// at the end of `common`. This handles whichever state the file is in.

const webFilePath = path.join(ROOT, 'web', 'src', 'i18n', 'resources.ts')
let webSrc = fs.readFileSync(webFilePath, 'utf8')
let webKeysAdded = 0
let webKeysUpdated = 0

// Returns the index of the matching `}` for the `{` at `openIdx` in `src`.
// Properly skips over string literals and their escapes.
function findMatchingBrace(src, openIdx) {
  let depth = 0
  let i = openIdx
  let inString = false
  let strDelim = ''
  let esc = false
  for (; i < src.length; i++) {
    const c = src[i]
    if (esc) { esc = false; continue }
    if (inString) {
      if (c === '\\') { esc = true; continue }
      if (c === strDelim) { inString = false }
      continue
    }
    if (c === '"') { inString = true; strDelim = c; continue }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

for (const lang of LANGS) {
  const tr = getTranslations(lang)
  const langHeaderRe = new RegExp(`("${lang}":\\s*\\{)`, 'm')
  const headerMatch = webSrc.match(langHeaderRe)
  if (!headerMatch) {
    throw new Error(`web resources.ts: could not locate locale "${lang}" — aborting`)
  }
  const localeStart = headerMatch.index
  const localeOpenIdx = localeStart + headerMatch[0].length - 1 // index of `{`
  const localeEnd = findMatchingBrace(webSrc, localeOpenIdx)
  if (localeEnd < 0) {
    throw new Error(`web resources.ts: could not find closing brace for locale "${lang}" — aborting`)
  }

  // Find "common": { inside this locale body
  const localeBody = webSrc.slice(localeStart, localeEnd + 1)
  const commonMatch = localeBody.match(/"common":\s*\{/)
  if (!commonMatch) {
    throw new Error(`web resources.ts: locale "${lang}" has no "common" block — aborting`)
  }
  const commonStartAbs = localeStart + commonMatch.index
  const commonOpenIdx = commonStartAbs + commonMatch[0].length - 1
  const commonEnd = findMatchingBrace(webSrc, commonOpenIdx)
  if (commonEnd < 0) {
    throw new Error(`web resources.ts: locale "${lang}": could not find closing brace of "common" — aborting`)
  }

  // Look for an existing "curatorDashboard": { block inside common body
  const cdMatch = webSrc.slice(commonOpenIdx + 1, commonEnd).match(/"curatorDashboard":\s*\{/)
  if (cdMatch) {
    const cdStartAbs = commonOpenIdx + 1 + cdMatch.index
    const cdOpenIdx = cdStartAbs + cdMatch[0].length - 1
    const cdEnd = findMatchingBrace(webSrc, cdOpenIdx)
    if (cdEnd < 0) {
      throw new Error(`web resources.ts: locale "${lang}": could not find closing brace of "curatorDashboard" — aborting`)
    }
    const cdBody = webSrc.slice(cdOpenIdx + 1, cdEnd)

    // Parse existing keys
    const lineRe = /^\s+"([^"]+)":\s+"((?:\\.|[^"\\])*)",?\s*$/gm
    const existing = new Map()
    let lm
    while ((lm = lineRe.exec(cdBody)) !== null) {
      existing.set(lm[1], { raw: lm[2] })
    }

    const additions = []
    let updatesCount = 0
    for (const [key, value] of Object.entries(tr)) {
      const ev = existing.get(key)
      const escapedV = JSON.stringify(value).slice(1, -1)
      if (ev === undefined) {
        additions.push([key, value])
      } else if (JSON.stringify(ev.raw) !== JSON.stringify(value)) {
        const keyRe = new RegExp(
          '^(\\s+)"' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '":\\s+"(?:\\\\.|[^"\\\\])*",?\\s*$',
          'm',
        )
        webSrc = webSrc.replace(keyRe, (_m, indent) => `${indent}"${key}": "${escapedV}",`)
        updatesCount++
      }
    }
    webKeysUpdated += updatesCount

    if (additions.length > 0) {
      const addText = additions
        .map(([key, value]) => `        "${key}": "${JSON.stringify(value).slice(1, -1)}",`)
        .join('\n')
      const needsComma = !cdBody.trimEnd().endsWith(',')
      const insertion = (needsComma ? ',' : '') + '\n' + addText
      // Re-find close brace since previous updates may have shifted offsets.
      const newCdEnd = findMatchingBrace(webSrc, cdOpenIdx)
      if (newCdEnd < 0) throw new Error('inconsistent state after updates')
      webSrc = webSrc.slice(0, newCdEnd) + insertion + webSrc.slice(newCdEnd)
      webKeysAdded += additions.length
    }

    console.log(`[web]    ${lang}: +${additions.length} keys, ~${updatesCount} updated`)
  } else {
    // No existing block — create one at the end of common. We must also
    // ensure the previous last sibling has a trailing comma (TS requires it
    // when a new sibling is added after it).
    const commonSlice = webSrc.slice(commonOpenIdx + 1, commonEnd)
    const siblingIndent = commonSlice.match(/\n( +)"[a-zA-Z][a-zA-Z0-9]*":\s*\{/m)
    const blockIndent = siblingIndent ? siblingIndent[1] : '      '
    const fieldIndent = blockIndent + '  '

    const blockLines = Object.entries(tr).map(
      ([key, value]) => `${fieldIndent}"${key}": "${JSON.stringify(value).slice(1, -1)}",`,
    )
    const newBlock = `\n${blockIndent}"curatorDashboard": {\n${blockLines.join('\n')}\n${blockIndent}},`

    // Check whether the char immediately before commonEnd is a `,`. If not,
    // the previous last sibling needs a trailing comma inserted before the
    // new block.
    let prefix = ''
    // Find the last non-whitespace char before commonEnd
    let look = commonEnd - 1
    while (look >= 0 && /\s/.test(webSrc[look])) look--
    if (look >= 0 && webSrc[look] !== ',') {
      // Insert a comma right after that char (before any trailing whitespace).
      const cut = look + 1
      prefix = webSrc.slice(commonOpenIdx + 1, cut) + ',' + webSrc.slice(cut, commonEnd)
    } else {
      prefix = webSrc.slice(commonOpenIdx + 1, commonEnd)
    }
    webSrc = webSrc.slice(0, commonOpenIdx + 1) + prefix + newBlock + webSrc.slice(commonEnd)
    webKeysAdded += Object.keys(tr).length
    console.log(`[web]    ${lang}: +${Object.keys(tr).length} keys (new block)`)
  }
}

fs.writeFileSync(webFilePath, webSrc, 'utf8')

console.log()
console.log(`Done.`)
console.log(`  mobile source files changed: ${mobileFilesChanged}/${LANGS.length} (keys added: ${mobileKeysAdded}, updated: ${mobileKeysUpdated})`)
console.log(`  web   resources.ts keys added: ${webKeysAdded}, updated: ${webKeysUpdated}`)
console.log()
console.log(`Next: regenerate mobile/src/i18n/resources.ts by running:`)
console.log(`  cd mobile && node scripts/generate-i18n-resources.js`)


