import { Button } from '@/components/ui/button'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
} from 'lucide-react'

const PAGE_SIZES = [10, 20, 50, 100]

/** Compact table footer with page size + pagination. */
export function Pagination({
  page, pages, total, limit, onPage, onLimit,
}: {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (p: number) => void
  onLimit: (l: number) => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] sm:text-[11px] sm:text-xs">
      <div className="text-muted-foreground">
        Showing {total === 0 ? 0 : (page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </div>
      <div className="flex items-center gap-2">
        <Select value={String(limit)} onValueChange={(v) => onLimit(Number(v))}>
          <SelectTrigger className="h-7 w-20 text-[11px] sm:text-[11px] sm:text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}/page</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(1)}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">Page {page} / {Math.max(1, pages)}</span>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(pages)}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}