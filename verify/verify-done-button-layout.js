/**
 * verify-done-button-layout.js
 * --------------------------------
 * Verifies that in the CropPickerModal:
 *   - the Done footer is at the BOTTOM of the modal (not floating mid-grid)
 *   - the "X selected" line is inside the same footer
 *   - the scrollable grid sits ABOVE the footer
 */
const puppeteer = require('puppeteer-core')

const APP_URL  = process.env.APP_URL  || 'http://localhost:5173'
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1'
const CHROME   = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const VIEWPORT = process.env.VIEWPORT === 'desktop'
  ? { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
  : { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
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

async function fillStep2Fields(page) {
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
    await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="Search"]')
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, 'a')
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await new Promise((r) => setTimeout(r, 400))
    const picked = await page.evaluate(() => {
      const opt = document.querySelector('[cmdk-item], [role="option"]')
      if (opt) { opt.click(); return opt.textContent.trim() }
      return null
    })
    console.log('       Selected', field, '->', picked)
    await new Promise((r) => setTimeout(r, 500))
    await clickByText(page, 'Continue')
    await new Promise((r) => setTimeout(r, 700))
  }
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role="dialog"]')]
    const inner = dialogs[dialogs.length - 1]
    if (!inner) return { error: 'no inner dialog' }
    const rect = inner.getBoundingClientRect()
    const doneBtn = [...inner.querySelectorAll('button')].find((b) => b.textContent && b.textContent.trim() === 'Done')
    // Outer footer div = the sticky Done wrapper (the parent that has border-t + bg-surface)
    let footer = null
    if (doneBtn) {
      let cur = doneBtn.parentElement
      while (cur && cur !== inner) {
        const cs = getComputedStyle(cur)
        if (cs.borderTopWidth !== '0px' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
          footer = cur
          break
        }
        cur = cur.parentElement
      }
      if (!footer) footer = doneBtn.closest('div.border-t, div[class*="border-t"]') || doneBtn.parentElement.parentElement
    }
    // The "<p>3 selected</p>" element specifically (leaf-level text node)
    const selectedP = [...inner.querySelectorAll('p')].find((el) => /^\d+ selected/.test((el.textContent || '').trim()))
    const cta = [...inner.querySelectorAll('button')].find((b) => b.textContent && b.textContent.includes('Enter manually'))?.closest('div')
    // The scrollable wrapper is the div that contains the grid AND has overflow-y-auto
    const scrollWrap = [...inner.querySelectorAll('div')].find((el) => {
      const cs = getComputedStyle(el)
      return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.querySelector('button[aria-pressed]')
    })
    const r = (el) => el && { y: el.getBoundingClientRect().y, b: el.getBoundingClientRect().bottom, h: el.getBoundingClientRect().height }
    return {
      dialogRect: r(inner),
      footerRect: r(footer),
      doneRect: r(doneBtn),
      selectedRect: r(selectedP),
      ctaRect: r(cta),
      scrollWrapRect: r(scrollWrap),
    }
  })
}

async function runAssertions(layout) {
  const fail = []
  if (!layout.footerRect) fail.push('No Done footer found')
  if (!layout.dialogRect) fail.push('No dialog rect')

  if (layout.footerRect && layout.dialogRect) {
    const distance = layout.dialogRect.b - layout.footerRect.b
    console.log('       Distance from footer-bottom to dialog-bottom:', distance.toFixed(1), 'px')
    if (distance < -2 || distance > 30) {
      fail.push(`Done footer not at bottom: distance=${distance.toFixed(1)}px`)
    }
  }

  if (layout.ctaRect && layout.footerRect && layout.ctaRect.b > layout.footerRect.y + 1) {
    fail.push('CTA is below footer top - footer is not at the bottom of the modal')
  }

  if (layout.selectedRect && layout.footerRect) {
    const insideFooter =
      layout.selectedRect.y >= layout.footerRect.y - 1 &&
      layout.selectedRect.b <= layout.footerRect.b + 1
    if (!insideFooter) {
      fail.push(
        `"X selected" text not inside footer: ` +
        `selected=${JSON.stringify(layout.selectedRect)} ` +
        `footer=${JSON.stringify(layout.footerRect)}`,
      )
    }
  }

  if (layout.scrollWrapRect && layout.footerRect) {
    if (layout.scrollWrapRect.b > layout.footerRect.y + 1) {
      fail.push('Scroll wrapper extends below footer top - footer overlaps content')
    }
  }

  return fail
}

async function main() {
  console.log('[1/5] OTP for', MOBILE)
  await api('/auth/request-otp', { mobileNumber: MOBILE })

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

    console.log('[2/5] Login OTP')
    await page.waitForSelector('input[type="tel"], input[inputmode="numeric"]', { timeout: 10000 })
    await page.type('input[type="tel"], input[inputmode="numeric"]', MOBILE)
    await new Promise((r) => setTimeout(r, 300))
    await clickByText(page, 'send otp|continue')
    await new Promise((r) => setTimeout(r, 1500))
    const otpInput = await page.$('input[name="otp"]')
    if (!otpInput) throw new Error('No OTP input found')
    await otpInput.type('000000')
    await new Promise((r) => setTimeout(r, 600))
    await clickByText(page, 'verify|sign in')
    await new Promise((r) => setTimeout(r, 2000))

    console.log('[3/5] Wizard - Volunteer, fill step 2, advance to step 3')
    await page.waitForFunction(
      () => document.body && document.body.innerText.includes('Pick the option that best describes you'),
      { timeout: 15000 },
    )
    await clickByText(page, 'Volunteer')
    await new Promise((r) => setTimeout(r, 250))
    await clickByText(page, 'Continue')
    await new Promise((r) => setTimeout(r, 600))
    await fillStep2Fields(page)
    await new Promise((r) => setTimeout(r, 600))

    console.log('[4/5] Open Crop picker, pick 3 crops')
    const opened = await page.evaluate(() => {
      const labels = [...document.querySelectorAll('label, p, span, div')]
      const target = labels.find((el) => el.textContent && el.textContent.trim() === 'Crop focus')
      if (!target) return false
      let container = target
      while (container && container.parentElement) {
        if (container.querySelector('button[aria-pressed]')) break
        container = container.parentElement
      }
      const btns = container ? container.querySelectorAll('button') : []
      const seeAll = [...btns].find((b) => b.textContent && b.textContent.includes('See all'))
      if (seeAll) { seeAll.click(); return true }
      return false
    })
    if (!opened) throw new Error('Could not open Crop picker modal')
    await new Promise((r) => setTimeout(r, 800))
    await page.screenshot({ path: 'verify-done-modal-empty.png' })
    console.log('       Saved verify-done-modal-empty.png (no selection)')

    // Pick the first 3 visible crop buttons inside the inner modal.
    await page.evaluate(() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')]
      const inner = dialogs[dialogs.length - 1]
      const all = inner.querySelectorAll('button[aria-pressed]')
      for (let i = 0; i < Math.min(3, all.length); i++) all[i].click()
    })
    await new Promise((r) => setTimeout(r, 700))
    await page.screenshot({ path: 'verify-done-modal-3selected.png' })
    console.log('       Saved verify-done-modal-3selected.png')

    console.log('[5/5] Measure layout - Done footer must be at bottom of modal')
    const layout = await measureLayout(page)
    console.log('       Layout:', JSON.stringify(layout, null, 2))

    const fail = await runAssertions(layout)
    if (fail.length) {
      console.error('       FAIL:', fail.join(' | '))
      process.exitCode = 1
    } else {
      console.log('       PASS - Done footer pinned to bottom of modal')
    }
  } catch (err) {
    console.error('FAILED:', err.message)
    try { await page.screenshot({ path: 'verify-done-button-layout-error.png' }) } catch {}
    throw err
  } finally {
    await browser.close()
  }
}

main().catch((err) => { console.error(err); process.exit(1) })