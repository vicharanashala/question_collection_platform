import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SUPPORTED_LANGUAGES } from '@/i18n'

// Vitest runs from the frontend folder (see vitest.config.ts).
const LOCALES_DIR = join(process.cwd(), 'src/i18n/locales')
const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g

interface Tree {
  [key: string]: string | Tree
}

// Flattens nested translation objects into dot separated keys.
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((out, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? { ...out, [path]: value } : { ...out, ...flatten(value, path) }
  }, {})
}

const placeholders = (text: string) => new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]))
const load = (file: string) => flatten(JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8')) as Tree)

const english = load('en.json')
const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json')

// Translations that reference a variable English never passes, so it would render literally.
// Fix the translation and remove the entry; the test fails if a new one appears.
const KNOWN_UNKNOWN_PLACEHOLDERS = new Set(['as.json:common.home.editWindowTip'])

// Missing keys fall back to English at runtime; this keeps that gap small.
const MIN_KEY_COVERAGE = 0.99

describe('i18n locales', () => {
  it('ships a locale file for every supported language', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => `${l.code}.json`).filter((f) => f !== 'en.json')

    expect(files.sort()).toEqual(codes.sort())
  })

  describe.each(files)('%s', (file) => {
    const locale = load(file)

    it('has no empty translations', () => {
      expect(Object.entries(locale).filter(([, v]) => v.trim() === '').map(([k]) => k)).toEqual([])
    })

    it(`translates at least ${MIN_KEY_COVERAGE * 100}% of English keys`, () => {
      const covered = Object.keys(english).filter((k) => k in locale).length

      expect(covered / Object.keys(english).length).toBeGreaterThanOrEqual(MIN_KEY_COVERAGE)
    })

    it('only uses interpolation variables that English provides', () => {
      const unknown = Object.entries(locale)
        .filter(([key]) => key in english && !KNOWN_UNKNOWN_PLACEHOLDERS.has(`${file}:${key}`))
        .filter(([key, value]) => [...placeholders(value)].some((p) => !placeholders(english[key]).has(p)))
        .map(([key]) => key)

      expect(unknown).toEqual([])
    })
  })
})
