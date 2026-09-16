import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

/** Statuses that mean an admin has not approved the account yet. */
const UNVERIFIED_STATUSES = ['pending', 'manual_review'] as const

/**
 * Persistent notice shown under the header while the signed-in account is still
 * awaiting admin verification. Renders nothing once the account is verified, and for
 * suspended or banned accounts, which AuthContext signs out instead.
 */
export function VerificationBanner() {
  const { user } = useAuth()
  const { t } = useTranslation()

  const status = user?.verificationStatus
  if (!status) return null
  if (!UNVERIFIED_STATUSES.includes(status as (typeof UNVERIFIED_STATUSES)[number])) {
    return null
  }

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-6 dark:border-amber-900/60 dark:bg-amber-950/40"
    >
      <ShieldAlert
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <p className="text-xs leading-relaxed text-amber-900 sm:text-sm dark:text-amber-100">
        {t(
          'account.notVerifiedBanner',
          'Your account is not verified by an admin yet. Some features stay unavailable until it is approved.',
        )}
      </p>
    </div>
  )
}
