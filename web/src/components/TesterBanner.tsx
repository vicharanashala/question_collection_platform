import { useTranslation } from 'react-i18next'
import { FlaskConical } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// Persistent notice for internal test accounts. Renders nothing for everyone else.
export function TesterBanner() {
  const { user } = useAuth()
  const { t } = useTranslation()

  if (!user?.isTester) return null

  return (
    <div
      role="status"
      className="flex items-center gap-2.5 border-b border-violet-200 bg-violet-50 px-4 py-2.5 sm:px-6 dark:border-violet-900/60 dark:bg-violet-950/40"
    >
      <FlaskConical aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
      <p className="text-xs font-semibold leading-snug text-violet-900 sm:text-sm dark:text-violet-200">
        {t('tester.banner', { defaultValue: 'Your account is a tester account.' })}
      </p>
    </div>
  )
}
