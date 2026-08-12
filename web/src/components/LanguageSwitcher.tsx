/**
 * Language switcher modal — mirrors mobile/src/components/LanguageSwitcher.tsx
 *
 * Lists all 22 supported languages (native name + English name), persists the
 * choice to localStorage (via i18next-browser-languagedetector's cache) and
 * updates the active i18next language immediately.
 */
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, RTL_LANGUAGES, type SupportedLanguageCode } from '@/i18n'

interface LanguageSwitcherProps {
  open: boolean
  onClose: () => void
}

export function LanguageSwitcher({ open, onClose }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()

  function handleSelect(code: SupportedLanguageCode) {
    i18n.changeLanguage(code)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[80vh] max-w-sm overflow-hidden p-0">
        <DialogHeader className="border-b border-border-subtle px-4 py-3">
          <DialogTitle>{t('auth.selectLanguage', 'Select Language')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto py-1">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = i18n.language === lang.code
            const isRTL = RTL_LANGUAGES.includes(lang.code as SupportedLanguageCode)
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent',
                  isSelected && 'bg-emerald-50 dark:bg-emerald-950/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-semibold',
                      isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
                      isRTL && 'text-right',
                    )}
                  >
                    {lang.nativeName}
                  </p>
                  <p className={cn('truncate text-xs', isSelected ? 'text-emerald-600 dark:text-emerald-500' : 'text-text-secondary')}>
                    {lang.name}
                  </p>
                </div>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LanguageSwitcher
