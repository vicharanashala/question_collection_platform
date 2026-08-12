import { useState, useEffect, useCallback } from 'react'
import { distributor, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Loader2, Search, RefreshCw, MapPin, Bookmark,
} from 'lucide-react'
import { toast } from 'sonner'
import type { FinalQuestion, DistributorStats } from '@/types'
import { Pagination } from './Pagination'

export function DistributionsList() {
  const [stats, setStats] = useState<DistributorStats | null>(null)
  const [indianStates, setIndianStates] = useState<string[]>([])
  const [distributionState, setDistributionState] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [items, setItems] = useState<FinalQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, st, list] = await Promise.all([
        distributor.getStats(),
        distributor.listIndianStates(),
        distributor.listDistributions({
          page, limit,
          ...(distributionState ? { distributionState } : {}),
          ...(search ? { search } : {}),
        }),
      ])
      setStats(s)
      setIndianStates(st.states)
      setItems(list.items)
      setTotal(list.total)
      setPages(list.pages)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load distributions.'))
    } finally {
      setLoading(false)
    }
  }, [page, limit, distributionState, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search distributions..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={distributionState || 'all'} onValueChange={(v) => { setDistributionState(v === 'all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {indianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Question</th>
                <th className="text-left px-4 py-2 font-medium">State</th>
                <th className="text-left px-4 py-2 font-medium">Distributor</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Loading...
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No distributions yet.
                </td></tr>
              ) : items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 max-w-md">
                    <div className="line-clamp-2 text-foreground">{row.questionText}</div>
                    {row.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        Note: {row.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {row.distributionState ? (
                      <Badge variant="outline">
                        <MapPin className="h-3 w-3 mr-1" />
                        {row.distributionState}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" title="Canonical reference doc — the original question row">
                        <Bookmark className="h-3 w-3 mr-1" />
                        (Original question)
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {row.distributor?.name
                      || row.distributor?.username
                      || `${row.distributorId.slice(0, 8)}…`}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(row.createdAt).toLocaleString()}</td>
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
    </div>
  )
}