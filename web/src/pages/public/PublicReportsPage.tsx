/**
 * Public Reports Page — "Report an Issue".
 *
 * Layout:
 *   1. Header card ────── "Report an Issue" title
 *   2. Support card ───── "Raise Support Ticket": opens the Zoho Desk Web-to-Case form
 *                         (static /raise-ticket.html) in a new tab.
 *
 * Reports are no longer created from this page. Existing reports stay reachable at
 * /home/reports/:reportId (e.g. from notifications), and the reports API and admin
 * report management are unchanged.
 */
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ExternalLink, LifeBuoy } from 'lucide-react'
import { RAISE_TICKET_URL } from '@/constants/public'

export function PublicReportsPage(): ReactNode {
  const navigate = useNavigate()
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">
      <div className="flex items-center gap-3">
        <Button
          variant={"outline"}
          size={"sm"}
          onClick={() => navigate(-1)}
          className="rounded-full"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" /> Back to profile
        </Button>
      </div>

      {/* Header card */}
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
            {t('report.title')}
          </h1>
        </CardContent>
      </Card>

      {/* Zoho Desk support ticket — opens the standalone Web-to-Case form in a new tab */}
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LifeBuoy className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-lg sm:text-xl font-extrabold text-foreground">
            {t('report.raiseSupportTicket', 'Raise Support Ticket')}
          </h2>
          <p className="mt-2 max-w-sm text-xs sm:text-sm text-text-secondary">
            {t('report.raiseSupportTicketHint', 'Need help from our support team? Raise a ticket and we will reply to you by email.')}
          </p>
          <Button
            size="lg"
            className="mt-6 rounded-full"
            onClick={() => window.open(RAISE_TICKET_URL, '_blank', 'noopener,noreferrer')}
          >
            {t('report.raiseSupportTicket', 'Raise Support Ticket')}
            <ExternalLink className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <p className="pt-2 text-center text-[11px] sm:text-xs text-text-tertiary">
        {t('app.footer')}
      </p>
    </div>
  )
}

export default PublicReportsPage
