import { toast } from 'sonner'

interface PendingTranslations {
  newStrings: number
  alreadyTranslated: number
  missingKeys: number
  command: string
}

const TOAST_ID = 'i18n-pending'

// Development only: keeps one warning toast in sync with the dev server's translation check.
if (import.meta.hot) {
  import.meta.hot.on('i18n:pending', ({ newStrings, alreadyTranslated, missingKeys, command }: PendingTranslations) => {
    const needsTranslating = newStrings + missingKeys
    if (needsTranslating + alreadyTranslated === 0) {
      toast.dismiss(TOAST_ID)
      return
    }
    const parts = [
      needsTranslating > 0 && `${needsTranslating} strings need translating. Run "${command}" in web/.`,
      alreadyTranslated > 0 && `${alreadyTranslated} translated strings are still hard-coded. Replace them with t('key').`,
    ].filter(Boolean)
    console.warn(`[i18n] ${parts.join(' ')}`)
    toast.warning('Translations pending', {
      id: TOAST_ID,
      description: `${parts.join(' ')} If you already did this, restart the dev server.`,
      duration: Infinity,
      closeButton: true,
    })
  })
}
