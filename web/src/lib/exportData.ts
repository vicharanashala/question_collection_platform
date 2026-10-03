import { format as formatDateFns } from 'date-fns'
import type { PaginatedResponse } from '@/types'

export type ExportFormat = 'csv' | 'xlsx'

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

const PAGE_SIZE = 100
export const MAX_EXPORT_ROWS = 10_000

/** Pages through a list endpoint until every row (up to MAX_EXPORT_ROWS) has been fetched. */
export async function fetchAllRows<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResponse<T>>,
): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = []
  let total = 0
  for (let page = 1; rows.length < MAX_EXPORT_ROWS; page++) {
    const res = await fetchPage(page, PAGE_SIZE)
    total = res.total
    rows.push(...res.items)
    if (res.items.length === 0 || rows.length >= total) break
  }
  return { rows: rows.slice(0, MAX_EXPORT_ROWS), total }
}

/** Local-time date for spreadsheet cells, e.g. 2026-09-30 or 2026-09-30 16:45. */
export function exportDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return formatDateFns(date, withTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd')
}

type Cell = string | number

function toTable<T>(rows: T[], columns: ExportColumn<T>[]): Cell[][] {
  return [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => c.value(row) ?? '')),
  ]
}

// Text starting with these is read as a formula by spreadsheet apps opening a CSV.
const FORMULA_PREFIX = /^[=+\-@\t\r]/

function csvCell(cell: Cell): string {
  const text = typeof cell === 'string' && FORMULA_PREFIX.test(cell) ? `'${cell}` : String(cell)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadTable<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  baseName: string,
  fileFormat: ExportFormat,
) {
  const table = toTable(rows, columns)
  const filename = `${baseName}_${formatDateFns(new Date(), 'yyyyMMdd_HHmm')}.${fileFormat}`

  if (fileFormat === 'csv') {
    // The BOM makes Excel read the file as UTF-8 so Indic names are not garbled.
    const csv = table.map((line) => line.map(csvCell).join(',')).join('\r\n')
    saveBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), filename)
    return
  }

  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(table)
  sheet['!cols'] = columns.map((c, i) => ({
    wch: Math.min(40, Math.max(c.header.length, ...table.slice(1, 200).map((r) => String(r[i]).length)) + 2),
  }))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, baseName.slice(0, 31))
  XLSX.writeFile(book, filename)
}
