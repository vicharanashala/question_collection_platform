// Validates that web/src/i18n/resources.ts is parseable as TS and that
// the const resources = {...} declaration is a valid JS expression.
const fs = require('fs')
const path = require('path')

const src = fs.readFileSync(path.resolve(__dirname, '..', 'web', 'src', 'i18n', 'resources.ts'), 'utf8')

// Try to extract `const resources = {...}` (or `const resources = {...} as const`).
const m = src.match(/^const resources = (\{[\s\S]*?\n\})\s*\n?export default resources;?/m)
if (!m) {
  console.error('Could not extract resources object from file')
  process.exit(1)
}

// Try to JSON.parse the object. Note: this is a slight cheat because the file
// may have comments or trailing commas that real TS handles. We just want to
// catch obvious syntax errors like our missing-comma bug.
try {
  const cleaned = m[1]
    // Strip trailing commas before } or ]
    .replace(/,(\s*[}\]])/g, '$1')
  const obj = JSON.parse(cleaned)
  console.log(`OK — parsed ${Object.keys(obj).length} locales`)
  // Spot-check that the new keys exist in English and Hindi.
  for (const lang of ['en', 'hi']) {
    const v = obj[lang]?.common?.verificationPending
    if (!v) {
      console.error(`MISSING verificationPending for locale "${lang}"`)
      process.exit(1)
    }
    const want = ['welcomeHeading', 'welcomeDescription', 'accountCreated',
                  'detailsSaved', 'pendingCardTitle', 'pendingCardHint',
                  'currentStatus', 'continueToApp', 'checkingStatus',
                  'toastVerified', 'toastCheckFailed']
    for (const k of want) {
      if (!(k in v)) {
        console.error(`MISSING ${lang}.verificationPending.${k}`)
        process.exit(1)
      }
    }
    console.log(`[${lang}] all 11 new keys present`)
    console.log(`[${lang}] currentStatus = ${v.currentStatus}`)
  }
  process.exit(0)
} catch (e) {
  console.error('PARSE ERROR:', e.message)
  // Dump the area around the error if it's a position-based JSON error.
  process.exit(1)
}
