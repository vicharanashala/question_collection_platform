import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SubmissionsPaginationProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}

export function SubmissionsPagination({ page, limit, total, onPageChange }: SubmissionsPaginationProps) {
  const { t } = useTranslation()
  const pages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between text-[11px] sm:text-[11px] sm:text-xs text-text-secondary">
      <span>{t('common.showing', { start, end, total })}</span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-7 px-2">
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2 text-foreground">{t('common.pageX', { page, total: pages })}</span>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)} className="h-7 px-2">
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
