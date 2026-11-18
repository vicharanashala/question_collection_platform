import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadTable, exportDate, exportDateTime, fetchAllRows, MAX_EXPORT_ROWS, type ExportColumn } from '@/lib/exportData'
import type { PaginatedResponse } from '@/types'

const page = <T,>(items: T[], total: number) => ({ items, total }) as unknown as PaginatedResponse<T>

describe('lib/exportData', () => {
  describe('fetchAllRows', () => {
    it('pages until every row is fetched', async () => {
      const fetchPage = vi
        .fn()
        .mockResolvedValueOnce(page(Array(100).fill('a'), 150))
        .mockResolvedValueOnce(page(Array(50).fill('b'), 150))

      const result = await fetchAllRows(fetchPage)

      expect(fetchPage).toHaveBeenNthCalledWith(1, 1, 100)
      expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 100)
      expect(result.rows).toHaveLength(150)
      expect(result.total).toBe(150)
    })

    it('stops on an empty page even if the total says otherwise', async () => {
      const fetchPage = vi.fn().mockResolvedValueOnce(page(['a'], 500)).mockResolvedValueOnce(page([], 500))

      const result = await fetchAllRows(fetchPage)

      expect(fetchPage).toHaveBeenCalledTimes(2)
      expect(result.rows).toEqual(['a'])
    })

    it(`never returns more than ${MAX_EXPORT_ROWS} rows`, async () => {
      const fetchPage = vi.fn((_page: number, limit: number) => Promise.resolve(page(Array(limit).fill(1), 50_000)))

      const result = await fetchAllRows(fetchPage)

      expect(result.rows).toHaveLength(MAX_EXPORT_ROWS)
      expect(fetchPage).toHaveBeenCalledTimes(MAX_EXPORT_ROWS / 100)
    })
  })

  describe('date cells', () => {
    it('formats dates and returns empty strings for missing or invalid values', () => {
      const local = new Date(2026, 8, 30, 16, 45, 5)

      expect(exportDate(local.toISOString())).toBe('2026-09-30')
      expect(exportDate(local.toISOString(), true)).toBe('2026-09-30 16:45')
      expect(exportDateTime(local)).toBe('30/09/2026 16:45:05')
      expect(exportDate(null)).toBe('')
      expect(exportDate('garbage')).toBe('')
      expect(exportDateTime(undefined)).toBe('')
      expect(exportDateTime('garbage')).toBe('')
    })
  })

  describe('downloadTable as CSV', () => {
    let blobs: Blob[]
    let anchors: HTMLAnchorElement[]

    beforeEach(() => {
      blobs = []
      anchors = []
      vi.stubGlobal('URL', { ...URL, createObjectURL: (blob: Blob) => (blobs.push(blob), 'blob:test'), revokeObjectURL: vi.fn() })
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        anchors.push(this)
      })
    })
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    interface Row {
      name: string
      note: string | null
    }
    const columns: ExportColumn<Row>[] = [
      { header: 'Name', value: (r) => r.name },
      { header: 'Note', value: (r) => r.note },
    ]

    // jsdom's Blob has no text() or arrayBuffer(), so read it through FileReader.
    const readBytes = (blob: Blob) =>
      new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
      })

    // Reads the generated CSV back as text, without the UTF-8 BOM.
    const csvText = async () => new TextDecoder().decode(await readBytes(blobs[0])).replace(/^\uFEFF/, '')

    it('writes a header row and CRLF separated rows with a UTF-8 BOM for Excel', async () => {
      await downloadTable([{ name: 'Asha', note: null }], columns, 'users', 'csv')

      const raw = await readBytes(blobs[0])
      expect(Array.from(raw.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
      expect(await csvText()).toBe('Name,Note\r\nAsha,')
      expect(anchors[0].download).toMatch(/^users_\d{8}_\d{4}\.csv$/)
    })

    it('quotes commas, quotes and newlines', async () => {
      await downloadTable([{ name: 'Kumar, Ramesh', note: 'said "hi"\nbye' }], columns, 'users', 'csv')

      expect(await csvText()).toBe('Name,Note\r\n"Kumar, Ramesh","said ""hi""\nbye"')
    })

    it.each(['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)'])(
      'neutralises spreadsheet formula injection in %p',
      async (payload) => {
        await downloadTable([{ name: payload, note: null }], columns, 'users', 'csv')

        const cell = (await csvText()).split('\r\n')[1]
        expect(cell.replace(/^"/, '').startsWith(`'`)).toBe(true)
      },
    )

    it('preserves Indic text', async () => {
      await downloadTable([{ name: 'रमेश कुमार', note: null }], columns, 'users', 'csv')

      expect(await csvText()).toContain('रमेश कुमार')
    })
  })
})
