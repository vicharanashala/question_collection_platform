import { useTranslation } from 'react-i18next'

/** Returns a formatter for ISO timestamps: "just now", "3 hours ago", "2 days ago", then a short date. */
export function useRelativeTime() {
  const { t } = useTranslation()
  return (s: string) => {
    try {
      const d = new Date(s)
      const now = new Date()
      const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
      if (diffH < 1) return t('common.justNow')
      if (diffH < 24) return t('common.hoursAgo', { count: diffH })
      const days = Math.floor(diffH / 24)
      if (days < 7) return t('common.daysAgo', { count: days })
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return s }
  }
}
