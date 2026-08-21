/**
 * verify-mobile-nav.js
 * ---------------------
 * Drives the dev server with Puppeteer at an iPhone-sized viewport and
 * checks whether the staff bottom tab bar renders after a successful login.
 *
 *   1. POST /auth/request-otp for a known seed user (in dev, any OTP is
 *      accepted because NODE_ENV=development skips bcrypt verification).
 *   2. POST /auth/verify-otp with any 6-digit code to mint JWT tokens.
 *   3. Open the web app in a headless Chrome at 375 x 812 viewport.
 *   4. Inject the tokens into localStorage and navigate to /dashboard.
 *   5. Inspect the rendered DOM for the StaffBottomNav element and take
 *      a screenshot for visual confirmation.
 */
const puppeteer = require('puppeteer-core')

const APP_URL   = 'http://localhost:5173'
const API_BASE  = 'http://localhost:3000/api/v1'
const CHROME    = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const MOBILE    = '9111111111'   // seed user from backend/src/.../seed-questions.ts
const VIEWPORT  = { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function api(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text }
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text}`)
  return json
}

async function main() {
  console.log('[1/5] Requesting OTP for', MOBILE)
  await api('/auth/request-otp', { mobileNumber: MOBILE })

  console.log('[2/5] Verifying OTP (dev mode accepts any 6-digit code)')
  const verify = await api('/auth/verify-otp', { mobileNumber: MOBILE, otp: '000000' })
  if (!verify.tokens) throw new Error('No tokens returned — user may not exist')
  const { accessToken, refreshToken } = verify.tokens
  const user = verify.user
  console.log('       Got tokens for user', user.name, '(role=' + user.role + ')')

  console.log('[3/5] Launching headless Chrome at', VIEWPORT.width + 'x' + VIEWPORT.height)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    defaultViewport: VIEWPORT,
  })
  const page = await browser.newPage()

  // Pre-seed localStorage by navigating to the app origin first
  await page.goto(APP_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })

  await page.evaluate(({ at, rt, u }) => {
    localStorage.setItem('access_token', at)
    localStorage.setItem('refresh_token', rt)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }, { at: accessToken, rt: refreshToken, u: { ...user, token: accessToken } })

  console.log('[4/5] Navigating to /dashboard')
  await page.goto(APP_URL + '/dashboard', { waitUntil: 'networkidle0', timeout: 30000 })
  // Give the auth rehydration + lazy chunk a moment
  await new Promise((r) => setTimeout(r, 1500))

  console.log('[5/5] Inspecting DOM for the staff bottom nav')
  const result = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Staff navigation"]')
    if (!nav) {
      const allNavs = Array.from(document.querySelectorAll('nav')).map((n) => n.getAttribute('aria-label') || n.outerHTML.slice(0, 80))
      return { found: false, allNavs, currentPath: location.pathname, bodySnippet: document.body.innerHTML.slice(0, 500) }
    }
    const rect = nav.getBoundingClientRect()
    const style = getComputedStyle(nav)
    return {
      found: true,
      visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden',
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      display: style.display,
      visibility: style.visibility,
      tabs: Array.from(nav.querySelectorAll('a, button')).map((el) => el.textContent?.trim()).filter(Boolean),
    }
  })

  console.log('\nResult:', JSON.stringify(result, null, 2))

  await page.screenshot({ path: 'd:\\question_collection_platform\\verify-mobile-dashboard.png', fullPage: false })
  console.log('\nScreenshot written to verify-mobile-dashboard.png')

  await browser.close()

  if (!result.found) {
    console.error('\n[FAIL] StaffBottomNav was NOT found in the DOM')
    process.exit(1)
  }
  if (!result.visible) {
    console.error('\n[FAIL] StaffBottomNav is in the DOM but is not visible')
    process.exit(2)
  }
  console.log('\n[PASS] StaffBottomNav is rendered and visible on mobile viewport')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})