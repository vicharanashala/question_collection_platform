import { useState, useEffect, useCallback } from 'react'
import { distributor, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Search, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'
import { Pagination } from './Pagination'
import { AssignStatesDialog } from './AssignStatesDialog'

/**
 * "Approved Queue" tab — lists questions in `approved` status so the
 * distributor can pick states to assign them to.
 */
export function ApprovedQueue() {
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Question[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [assignFor, setAssignFor] = useState<Question | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await distributor.listApprovedQuestions({ page, limit, search })
      setItems(list.items)
      setTotal(list.total)
      setPages(list.pages)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load approved questions.'))
    } finally {
      setLoading(false)
    }
  }, [page, limit, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search approved questions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Question</th>
                <th className="text-left px-4 py-2 font-medium">Origin</th>
                <th className="text-left px-4 py-2 font-medium">Approved</th>
                <th className="text-right px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Loading...
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No approved questions waiting.
                </td></tr>
              ) : items.map((q) => (
                <tr key={q.id} className="border-t border-border">
                  <td className="px-4 py-2 max-w-md">
                    <div className="line-clamp-2">{q.questionText}</div>
                  </td>
                  <td className="px-4 py-2 text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
                    {[q.state, q.district].filter(Boolean).join(' / ')}
                  </td>
                  <td className="px-4 py-2 text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
                    {q.reviewedAt ? new Date(q.reviewedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" onClick={() => setAssignFor(q)}>
                      <Send className="h-4 w-4 mr-1.5" />
                      Assign states
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <Pagination
          page={page} pages={pages} total={total} limit={limit}
          onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1) }}
        />
      </Card>

      {assignFor && (
        <AssignStatesDialog
          question={assignFor}
          onClose={() => setAssignFor(null)}
          onDone={() => { setAssignFor(null); load() }}
        />
      )}
    </div>
  )
}