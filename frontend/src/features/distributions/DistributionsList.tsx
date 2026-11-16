import { useState, useEffect } from 'react'
import { TesterFilter, type TesterFilterValue } from '@/components/TesterFilter'
import { TesterTag } from '@/components/TesterTag'
import { getErrorMessage } from '@/client/client'
import { useDistributions, useIndianStates } from '@/hooks/api/useDistributions'
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
import { Pagination } from './Pagination'
import { useTranslation } from 'react-i18next'

export function DistributionsList() {
  const { t } = useTranslation()
  // const [stats, setStats] = useState<DistributorStats | null>(null)
  const [distributionState, setDistributionState] = useState<string>('')
  const [questionType, setQuestionType] = useState<'' | 'original' | 'distributed'>('')
  const [search, setSearch] = useState('')
  const [testerFilter, setTesterFilter] = useState<TesterFilterValue>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)


  const statesQuery = useIndianStates()
  const listQuery = useDistributions({
    page, limit,
    ...(distributionState ? { distributionState } : {}),
    ...(questionType ? { questionType } : {}),
    ...(search ? { search } : {}),
    ...(testerFilter ? { tester: testerFilter } : {}),
  })
  const indianStates = statesQuery.data?.states ?? []
  const items = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const pages = listQuery.data?.pages ?? 0
  const loading = listQuery.isFetching || statesQuery.isFetching
  const loadError = listQuery.error ?? statesQuery.error

  const load = () => {
    void listQuery.refetch()
    void statesQuery.refetch()
  }

  useEffect(() => {
    if (loadError) toast.error(getErrorMessage(loadError, 'Failed to load distributions.'))
  }, [loadError])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('distributionsList.searchDistributions')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <Select value={distributionState || 'all'} onValueChange={(v) => { setDistributionState(v === 'all' ? '' : v); setPage(1) }} disabled={questionType === 'original'}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('distributionsList.filterByState')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('distributionsList.allStates')}</SelectItem>
              {indianStates.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-44">
            <TesterFilter value={testerFilter} onChange={(value) => { setTesterFilter(value); setPage(1) }} />
          </div>
          <Select
            value={questionType || 'all'}
            onValueChange={(v) => {
              const next = v === 'all' ? '' : (v as 'original' | 'distributed')
              setQuestionType(next)
              if (next === 'original') setDistributionState('')
              setPage(1)
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder={t('distributionsList.filterByType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('distributionsList.allQuestions')}</SelectItem>
              <SelectItem value="original">{t('distributionsList.originalQuestions')}</SelectItem>
              <SelectItem value="distributed">{t('distributionsList.distributedOnly')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-xs sm:text-xs sm:text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{t('wallet.questionText')}</th>
                <th className="text-left px-4 py-2 font-medium">{t('admin.state')}</th>
                <th className="text-left px-4 py-2 font-medium">{t('roles.distributor')}</th>
                <th className="text-left px-4 py-2 font-medium">{t('distributionsList.created')}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> {t('common.loading')}
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t('distributionsList.noDistributionsYet')}</td></tr>
              ) : items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 max-w-md">
                    <div className="line-clamp-2 text-foreground">{row.questionText}</div>
                    {row.submitterIsTester && <div className="mt-1"><TesterTag /></div>}
                    {row.notes && (
                      <div className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">{t('distributionsList.note', { notes: row.notes })}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(row.distributionState ?? row.state) ? (
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          {row.distributionState ?? row.state}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {!row.distributionState && (
                        <Badge variant="secondary" title={t('distributionsList.canonicalReferenceDocThe')}>
                          <Bookmark className="h-3 w-3 mr-1" />
                          {t('translatableText.original')}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-[11px] sm:text-[11px] sm:text-xs">
                    {row.distributor?.name
                      || row.distributor?.username
                      || `${row.distributorId.slice(0, 8)}…`}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-[11px] sm:text-[11px] sm:text-xs">{new Date(row.createdAt).toLocaleString()}</td>
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