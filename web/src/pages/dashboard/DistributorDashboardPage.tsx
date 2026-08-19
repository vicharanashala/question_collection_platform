import { useEffect, useState } from 'react'
import { distributor, getErrorMessage } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { DistributorStats } from '@/types'

/**
 * Distributor dashboard. Shows summary stats and a
 * CTA to open the distributions list.
 */
export function DistributorDashboardPage() {
  const [stats, setStats] = useState<DistributorStats | null>(null)
  const [indianStates, setIndianStates] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const [s, st] = await Promise.all([
        distributor.getStats(),
        distributor.listIndianStates(),
      ])
      setStats(s)
      setIndianStates(st.states)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load stats.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const totalDistributed = stats?.byState.reduce((sum, b) => sum + b.count, 0) ?? 0

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg sm:text-lg sm:text-xl font-semibold">Distributor Dashboard</h1>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
            Distribute approved questions to one or more Indian states.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">Total States</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.indianStatesTotal ?? indianStates.length}</div>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">All Indian states/UTs covered</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{totalDistributed}</div>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">Total question-state rows</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">States covered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats?.byState.filter((b) => b.count > 0).length ?? 0}</div>
              <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">of {indianStates.length} states have at least one distribution</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-sm sm:text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/distributions')}>
              <Send className="h-4 w-4 mr-1.5" />
              Open Distributions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}