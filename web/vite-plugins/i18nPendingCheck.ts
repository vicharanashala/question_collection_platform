import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

export const I18N_PENDING_EVENT = 'i18n:pending'
const TRANSLATE_COMMAND = 'npm run i18n:translate:apply'
// Waits for edits to settle before scanning again.
const RESCAN_DELAY_MS = 3000

export interface PendingTranslations {
  // Hard-coded text with no English entry yet: the translate command handles these.
  newStrings: number
  // Hard-coded text that already has a key in resources.ts: the code should use t('key').
  alreadyTranslated: number
  // t('key') calls whose key is missing in some language.
  missingKeys: number
  command: string
}

interface I18nPendingCheckOptions {
  repoRoot: string
  baseRef?: string
}

// Collects every English string in resources.ts, loaded through Vite like any other module.
async function readEnglishTexts(server: ViteDevServer): Promise<Set<string>> {
  const module = await server.ssrLoadModule('/src/i18n/resources.ts')
  const resources = module.default as { en: Record<string, unknown> }
  const texts = new Set<string>()
  const collect = (value: unknown) => {
    if (typeof value === 'string') texts.add(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(collect)
  }
  collect(resources.en)
  return texts
}

// Runs the read-only i18n scanner against the base branch and returns what still needs translating.
async function scanPending(
  server: ViteDevServer,
  repoRoot: string,
  baseRef: string,
  reportPath: string,
): Promise<PendingTranslations> {
  const scanner = path.join(repoRoot, 'scripts/i18n/scan-web-i18n.cjs')
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [scanner, 'scan', '--base', baseRef, '--out', reportPath], { cwd: repoRoot }, (error) =>
      error ? reject(error) : resolve(),
    )
  })
  const { summary, highConfidenceFindings } = JSON.parse(await readFile(reportPath, 'utf8')) as {
    summary: { missingTranslationReferences: number }
    highConfidenceFindings: { text: string }[]
  }
  const englishTexts = await readEnglishTexts(server)
  const alreadyTranslated = highConfidenceFindings.filter(({ text }) => englishTexts.has(text.trim())).length
  return {
    newStrings: highConfidenceFindings.length - alreadyTranslated,
    alreadyTranslated,
    missingKeys: summary.missingTranslationReferences,
    command: TRANSLATE_COMMAND,
  }
}

// Builds the terminal warning, one line per kind of pending work plus a hint about re-checking.
function pendingMessages({ newStrings, alreadyTranslated, missingKeys }: PendingTranslations): string[] {
  const lines: string[] = []
  if (newStrings + missingKeys > 0) {
    lines.push(
      `${newStrings} new UI strings and ${missingKeys} keys need translating. ` +
        `Run "${TRANSLATE_COMMAND}" in web/ (needs the backend running in development with SARVAM_API_KEY).`,
    )
  }
  if (alreadyTranslated > 0) {
    lines.push(
      `${alreadyTranslated} strings are already translated but still hard-coded. ` +
        `Replace them with t('key'); the keys are in scripts/i18n/reports/translation-preview.json.`,
    )
  }
  if (lines.length > 0) {
    lines.push(
      'Already done this? The check re-runs when you save a file in src/. ' +
        'If the warning stays, restart the dev server (stop it and run "npm run dev" again).',
    )
  }
  return lines
}

/**
 * Dev server only. Warns in the terminal and the browser when changed web files have
 * text that is not translated yet, and names the command that translates it.
 */
export function i18nPendingCheck({ repoRoot, baseRef = 'origin/develop' }: I18nPendingCheckOptions): Plugin {
  const reportPath = path.join(tmpdir(), `annadatha-i18n-scan-${process.pid}.json`)
  let latest: PendingTranslations | null = null
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined

  // Scans once, reports the result and shares it with every open browser tab.
  async function check(server: ViteDevServer) {
    if (running) return
    running = true
    try {
      latest = await scanPending(server, repoRoot, baseRef, reportPath)
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
      server.config.logger.warn(`[i18n] Could not check for pending translations: ${reason}`, { timestamp: true })
      return
    } finally {
      running = false
    }

    const lines = pendingMessages(latest)
    if (lines.length > 0) {
      server.config.logger.warn(lines.map((line) => `[i18n] ${line}`).join('\n'), { timestamp: true })
    }
    server.ws.send({ type: 'custom', event: I18N_PENDING_EVENT, data: latest })
  }

  return {
    name: 'annadatha-i18n-pending-check',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => void check(server))
      // A tab opened after the scan still gets the latest result.
      server.ws.on('connection', () => {
        if (latest) server.ws.send({ type: 'custom', event: I18N_PENDING_EVENT, data: latest })
      })
      server.watcher.on('change', (file) => {
        if (!file.includes(`${path.sep}src${path.sep}`)) return
        clearTimeout(timer)
        timer = setTimeout(() => void check(server), RESCAN_DELAY_MS)
      })
    },
  }
}
