/**
 * verify-volunteer-crop-focus.js
 * --------------------------------
 * Visual verification of the redesigned "Crop focus" field on the
 * volunteer step of the CompleteProfileWizard.
 */
const puppeteer = require('puppeteer-core')

const APP_URL  = process.env.APP_URL  || 'http://localhost:5173'
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1'
const CHROME   = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const VIEWPORT = { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
const MOBILE   = process.env.MOBILE || ('9' + Date.now().toString().slice(-9))

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
  console.log('[1/5] OTP for', MOBILE)
  await api('/auth/request-otp', { mobileNumber: MOBILE })

  console.log('[2/5] Launching headless Chrome at', VIEWPORT.width + 'x' + VIEWPORT.height)
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  await page.setViewport(VIEWPORT)
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('       [console.error]', msg.text())
  })
  try {
    await page.goto(APP_URL + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.evaluate(() => {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('auth_user')
    })

    console.log('[3/5] Going through the LoginPage OTP UI')
    await page.waitForSelector('input[type="tel"], input[inputmode="numeric"]', { timeout: 10000 })
    await page.type('input[type="tel"], input[inputmode="numeric"]', MOBILE)
    await new Promise((r) => setTimeout(r, 300))
    await clickByText(page, 'send otp|continue')
    await new Promise((r) => setTimeout(r, 1500))
    await page.screenshot({ path: 'verify-debug-otp-step.png', fullPage: false })
    console.log('       Debug screenshot saved (verify-debug-otp-step.png)')

    // The OTP input has name="otp" and is rendered sr-only. Puppeteer's
    // .type() works on hidden inputs as long as they are in the DOM.
    const otpInput = await page.$('input[name="otp"]')
    if (!otpInput) throw new Error('No OTP input found')
    await otpInput.type('000000')
    await new Promise((r) => setTimeout(r, 600))
    await clickByText(page, 'verify|sign in')
    await new Promise((r) => setTimeout(r, 2000))

    console.log('[3b/5] Waiting for wizard modal on /home')
    await page.waitForFunction(
      () => document.body && document.body.innerText.includes('Pick the option that best describes you'),
      { timeout: 15000 },
    )
    console.log('       Wizard heading detected.')

    console.log('       Picking Volunteer')
    await clickByText(page, 'Volunteer')
    await new Promise((r) => setTimeout(r, 250))
    await clickByText(page, 'Continue')
    await new Promise((r) => setTimeout(r, 600))

    // Step 2: walk through every required field. For each empty field, open
    // the dropdown, type 'a' to filter, then click the first cmdk item.
    for (let i = 0; i < 6; i++) {
      const onStep2 = await page.evaluate(() =>
        document.body.innerText.includes("We'll use this to match your questions"),
      )
      if (!onStep2) break
      const field = await page.evaluate(() => {
        const want = ['State', 'District', 'Block', 'Village', 'Nearest KVK']
        for (const label of want) {
          const lbl = [...document.querySelectorAll('label')].find((l) => l.textContent.startsWith(label))
          if (!lbl) continue
          const container = lbl.parentElement
          if (!container) continue
          const valueSpan = container.querySelector('button[type="button"] span')
          // Empty placeholders always include "Search" or "Choose … first"
          if (valueSpan && valueSpan.textContent &&
              !valueSpan.textContent.includes('Search') &&
              !valueSpan.textContent.includes('Choose')) continue
          const trigger = container.querySelector('button[type="button"]')
          if (trigger) { trigger.click(); return label }
        }
        return null
      })
      if (!field) break
      await new Promise((r) => setTimeout(r, 700))
      // Type 'a' into the dropdown search to filter options
      await page.evaluate(() => {
        const input = document.querySelector('input[placeholder*="Search"]')
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          setter.call(input, 'a')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
      await new Promise((r) => setTimeout(r, 400))
      // Click the first cmdk item
      const picked = await page.evaluate(() => {
        const opt = document.querySelector('[cmdk-item], [role="option"]')
        if (opt) { opt.click(); return opt.textContent.trim() }
        return null
      })
      console.log('       Selected', field, '→', picked)
      await new Promise((r) => setTimeout(r, 500))
      await clickByText(page, 'Continue')
      await new Promise((r) => setTimeout(r, 700))
    }

    console.log('[4/5] Screenshotting the "Crop focus" section')
    const found = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, p, span, div')]
      const target = labels.find((el) => el.textContent && el.textContent.trim() === 'Crop focus')
      if (!target) return false
      // Scroll the nearest scrollable ancestor so the label is centred
      let scrollEl = target.parentElement
      while (scrollEl) {
        const style = getComputedStyle(scrollEl)
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') break
        scrollEl = scrollEl.parentElement
      }
      if (scrollEl) {
        const top = target.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop - 80
        scrollEl.scrollTo({ top, behavior: 'instant' })
      } else {
        target.scrollIntoView({ block: 'center' })
      }
      return true
    })
    if (!found) console.warn('       Could not find "Crop focus" label.')
    await new Promise((r) => setTimeout(r, 800))
    await page.screenshot({ path: 'verify-volunteer-crop-focus.png', fullPage: false })
    console.log('       Saved verify-volunteer-crop-focus.png')

    const layout = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, p, span, div')]
      const target = labels.find((el) => el.textContent && el.textContent.includes('Crop focus'))
      if (!target) return { hasGrid: false, seeAll: false, gridButtons: 0 }
      let container = target
      while (container && container.parentElement) {
        if (container.querySelector('button[aria-pressed]')) break
        container = container.parentElement
      }
      const gridButtons = container ? container.querySelectorAll('button[aria-pressed]').length : 0
      const allBtns = container ? container.querySelectorAll('button') : []
      const seeAll = [...allBtns].some((b) => b.textContent && b.textContent.includes('See all'))
      return { hasGrid: gridButtons >= 6, seeAll, gridButtons }
    })
    console.log('       Layout:', JSON.stringify(layout))

    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, p, span, div')]
      const target = labels.find((el) => el.textContent && el.textContent.includes('Crop focus'))
      if (!target) return
      let container = target
      while (container && container.parentElement) {
        if (container.querySelector('button[aria-pressed]')) break
        container = container.parentElement
      }
      const btn = container ? container.querySelector('button[aria-pressed]') : null
      if (btn) btn.click()
    })
    await new Promise((r) => setTimeout(r, 500))

    await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, p, span, div')]
      const target = labels.find((el) => el.textContent && el.textContent.includes('Crop focus'))
      if (!target) return
      let container = target
      while (container && container.parentElement) {
        if (container.querySelector('button[aria-pressed]')) break
        container = container.parentElement
      }
      const btns = container ? container.querySelectorAll('button') : []
      const seeAll = [...btns].find((b) => b.textContent && b.textContent.includes('See all'))
      if (seeAll) seeAll.click()
    })
    await new Promise((r) => setTimeout(r, 800))
    await page.screenshot({ path: 'verify-volunteer-crop-focus-modal.png', fullPage: false })
    console.log('       Saved verify-volunteer-crop-focus-modal.png')
    console.log('[5/5] Done.')
  } catch (err) {
    console.error('FAILED:', err.message)
    try { await page.screenshot({ path: 'verify-volunteer-crop-focus-error.png' }) } catch {}
    throw err
  } finally {
    await browser.close()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })

async function clickByText(page, regexSrc) {
  return page.evaluate((src) => {
    const r = new RegExp(src, 'i')
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent && r.test(b.textContent),
    )
    if (btn) { btn.click(); return true }
    return false
  }, regexSrc)
}
