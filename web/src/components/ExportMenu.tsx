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
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation()
  const [exporting, setExporting] = useState(false)

  async function handleExport(fileFormat: ExportFormat) {
    setExporting(true)
    try {
      const { rows, total } = await fetchAllRows(fetchPage)
      if (rows.length === 0) {
        toast.info(t('exportMenu.nothingToExportFor'))
        return
      }
      if (sort) rows.sort(sort)
      await downloadTable(rows, columns, name, fileFormat)
      if (total > rows.length) {
        toast.warning(t('exportMenu.exportedTheFirstOf', { value1: rows.length.toLocaleString('en-IN'), value3: total.toLocaleString('en-IN') }))
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
          {exporting ? t('exportMenu.exporting') : t('exportMenu.export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handleExport('csv')}>
          <FileText className="h-4 w-4" />
          {t('exportMenu.csvCsv')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('exportMenu.excelXlsx')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
