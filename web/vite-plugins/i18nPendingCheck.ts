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
  newStrings: number
  missingKeys: number
  command: string
}

interface I18nPendingCheckOptions {
  repoRoot: string
  baseRef?: string
}

// Runs the read-only i18n scanner against the base branch and returns what still needs translating.
async function scanPending(repoRoot: string, baseRef: string, reportPath: string): Promise<PendingTranslations> {
  const scanner = path.join(repoRoot, 'scripts/i18n/scan-web-i18n.cjs')
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [scanner, 'scan', '--base', baseRef, '--out', reportPath], { cwd: repoRoot }, (error) =>
      error ? reject(error) : resolve(),
    )
  })
  const { summary } = JSON.parse(await readFile(reportPath, 'utf8')) as {
    summary: { highConfidence: number; missingTranslationReferences: number }
  }
  return {
    newStrings: summary.highConfidence,
    missingKeys: summary.missingTranslationReferences,
    command: TRANSLATE_COMMAND,
  }
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
      latest = await scanPending(repoRoot, baseRef, reportPath)
    } catch (error) {
      const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
      server.config.logger.warn(`[i18n] Could not check for pending translations: ${reason}`, { timestamp: true })
      return
    } finally {
      running = false
    }

    if (latest.newStrings + latest.missingKeys > 0) {
      server.config.logger.warn(
        `[i18n] Translations pending: ${latest.newStrings} new UI strings, ${latest.missingKeys} keys missing translations.\n` +
          `[i18n] Run "${TRANSLATE_COMMAND}" in web/ (needs the backend running in development with SARVAM_API_KEY).`,
        { timestamp: true },
      )
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
