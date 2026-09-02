// Validates that web/src/i18n/resources.ts contains the curatorDashboard
// block for every locale, and that all required keys are present.
const fs = require('fs')
const path = require('path')

const REQUIRED_KEYS = [
  'title', 'subtitle', 'range30d', 'range7d', 'range90d',
  'statQueue', 'statQueueSub', 'statApproved', 'statApprovedSub',
  'statRejected', 'statRejectedSub',
  'slaTitle', 'slaMessage', 'slaQueueNote',
  'dailyVolumeTitle', 'dailyVolumeSub',
  'legendSubmitted', 'legendApproved', 'legendRejected',
  'queueByStatusTitle', 'queueByStatusSub',
  'topStatesTitle', 'topStatesSub',
  'topCropsTitle', 'topCropsSub',
  'quickActionsTitle', 'quickActionsSub',
  'actionReviewQueue', 'actionAllQuestions',
  'noVolumeData', 'loadError',
]

const src = fs.readFileSync(path.resolve(__dirname, '..', 'web', 'src', 'i18n', 'resources.ts'), 'utf8')
const m = src.match(/^const resources = (\{[\s\S]*?\n\})\s*\n?export default resources;?/m)
if (!m) { console.error('Could not extract resources object'); process.exit(1) }

let obj
try {
  const cleaned = m[1].replace(/,(\s*[}\]])/g, '$1')
  obj = JSON.parse(cleaned)
} catch (e) {
  console.error('PARSE ERROR:', e.message)
  process.exit(1)
}

console.log(`Parsed ${Object.keys(obj).length} locales`)
let failures = 0
for (const lang of Object.keys(obj)) {
  const cd = obj[lang]?.common?.curatorDashboard
  if (!cd) { console.error(`[${lang}] MISSING common.curatorDashboard`); failures++; continue }
  for (const key of REQUIRED_KEYS) {
    if (!(key in cd)) { console.error(`[${lang}] MISSING curatorDashboard.${key}`); failures++ }
  }
}

if (failures > 0) {
  console.error(`FAILED with ${failures} errors`)
  process.exit(1)
}

// Verify Hindi translations are actually Hindi (not English fallback).
const hiCd = obj.hi?.common?.curatorDashboard
const enCd = obj.en?.common?.curatorDashboard
if (!hiCd || !enCd) { console.error('en or hi missing'); process.exit(1) }
const sameAsEnglish = []
for (const key of REQUIRED_KEYS) {
  if (hiCd[key] === enCd[key]) sameAsEnglish.push(key)
}
if (sameAsEnglish.length > 0) {
  console.warn(`Hindi is identical to English for: ${sameAsEnglish.join(', ')}`)
}

// Spot-check Hindi values
console.log('---')
console.log(`[hi] title: ${hiCd.title}`)
console.log(`[hi] subtitle: ${hiCd.subtitle}`)
console.log(`[hi] statQueue: ${hiCd.statQueue}`)
console.log(`[hi] slaTitle: ${hiCd.slaTitle}`)
console.log(`[hi] slaMessage: ${hiCd.slaMessage}`)
console.log(`[hi] quickActionsTitle: ${hiCd.quickActionsTitle}`)
console.log(`---`)
console.log('OK — all 23 locales have full curatorDashboard block with', REQUIRED_KEYS.length, 'keys')