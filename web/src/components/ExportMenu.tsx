import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
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
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>
  /** Optional ordering to match what the screen shows */
  sort?: (a: T, b: T) => number
  disabled?: boolean
}

export function ExportMenu<T>({ name, columns, fetchPage, sort, disabled }: ExportMenuProps<T>) {
  const [exporting, setExporting] = useState(false)

  async function handleExport(fileFormat: ExportFormat) {
    setExporting(true)
    try {
      const { rows, total } = await fetchAllRows(fetchPage)
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
        <DropdownMenuItem onSelect={() => handleExport('csv')}>
          <FileText className="h-4 w-4" />
          CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
