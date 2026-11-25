import { toast } from 'sonner'

interface PendingTranslations {
  newStrings: number
  missingKeys: number
  command: string
}

const TOAST_ID = 'i18n-pending'

// Development only: keeps one warning toast in sync with the dev server's translation check.
if (import.meta.hot) {
  import.meta.hot.on('i18n:pending', ({ newStrings, missingKeys, command }: PendingTranslations) => {
    if (newStrings + missingKeys === 0) {
      toast.dismiss(TOAST_ID)
      return
    }
    console.warn(`[i18n] ${newStrings} new UI strings and ${missingKeys} keys need translating. Run: ${command}`)
    toast.warning('Translations pending', {
      id: TOAST_ID,
      description: `${newStrings} new UI strings and ${missingKeys} keys need translating. Run "${command}" in web/.`,
      duration: Infinity,
      closeButton: true,
    })
  })
}
