import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  downloadTable, fetchAllRows,
  type ExportColumn, type ExportFormat,
} from '@/lib/exportData'
import type { PaginatedResponse } from '@/types'

interface ExportMenuProps<T> {
  /** Used as the file name prefix, e.g. "users" */
  name: string
  columns: ExportColumn<T>[]
  /** Fetches one page of the list with the filters currently applied on screen */
  fetchPage: (page: number, limit: number, tester?: 'exclude') => Promise<PaginatedResponse<T>>
  /**
   * Current tester filter on screen. When provided and empty, the export asks whether to include
   * tester accounts (excluded by default); a filter that is already set is used as is.
   */
  testerFilter?: string
  /** Optional ordering to match what the screen shows */
  sort?: (a: T, b: T) => number
  disabled?: boolean
}

export function ExportMenu<T>({ name, columns, fetchPage, sort, disabled, testerFilter }: ExportMenuProps<T>) {
  const [exporting, setExporting] = useState(false)
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null)
  const [includeTesters, setIncludeTesters] = useState(false)
  const asksAboutTesters = testerFilter === ''

  // Asks about tester accounts first when the screen is not already filtered by them.
  function startExport(fileFormat: ExportFormat) {
    if (!asksAboutTesters) {
      void handleExport(fileFormat)
      return
    }
    setIncludeTesters(false)
    setPendingFormat(fileFormat)
  }

  // Runs the export with the chosen tester option, then closes the question dialog.
  function confirmExport() {
    if (!pendingFormat) return
    const fileFormat = pendingFormat
    setPendingFormat(null)
    void handleExport(fileFormat, includeTesters ? undefined : 'exclude')
  }

  async function handleExport(fileFormat: ExportFormat, tester?: 'exclude') {
    setExporting(true)
    try {
      const { rows, total } = await fetchAllRows((page, limit) => fetchPage(page, limit, tester))
      if (rows.length === 0) {
        toast.info('Nothing to export for the current filters')
        return
      }
      if (sort) rows.sort(sort)
      await downloadTable(rows, columns, name, fileFormat)
      if (total > rows.length) {
        toast.warning(`Exported the first ${rows.length.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} rows. Narrow the filters to export the rest.`)
      } else {
        toast.success(`Exported ${rows.length.toLocaleString('en-IN')} row${rows.length === 1 ? '' : 's'}`)
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={disabled || exporting}>
            {exporting
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Download className="h-4 w-4 mr-1.5" />}
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => startExport('csv')}>
            <FileText className="h-4 w-4" />
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => startExport('xlsx')}>
            <FileSpreadsheet className="h-4 w-4" />
            Excel (.xlsx)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={pendingFormat !== null} onOpenChange={(open) => { if (!open) setPendingFormat(null) }}>
        <DialogContent className="max-w-md gap-5 p-6 sm:p-6">
          <DialogHeader className="space-y-1.5 pr-6">
            <DialogTitle className="text-lg font-bold">Include tester accounts?</DialogTitle>
            <DialogDescription className="text-sm text-text-secondary">Choose whether data from tester accounts should be part of this export.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Tester accounts" className="space-y-2">
            {[
              { value: false, title: 'Exclude testers', hint: 'Recommended. Real user data only.' },
              { value: true, title: 'Include testers', hint: 'Tester accounts are marked in the file.' },
            ].map((option) => (
              <label
                key={option.title}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors hover:border-primary/50 ${includeTesters === option.value ? 'border-primary bg-primary/5' : 'border-border-subtle'}`}
              >
                <input
                  type="radio"
                  name="include-testers"
                  checked={includeTesters === option.value}
                  onChange={() => setIncludeTesters(option.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-semibold text-foreground">{option.title}</span>
                  <span className="block text-xs text-text-tertiary">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:space-x-0 sm:gap-2">
            <Button variant="outline" size="sm" onClick={() => setPendingFormat(null)}>Cancel</Button>
            <Button size="sm" onClick={confirmExport}>Export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
