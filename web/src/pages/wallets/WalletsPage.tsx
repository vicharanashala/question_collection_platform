import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { adminApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { WalletDetailModal } from '@/components/WalletDetailModal'
import {
  Wallet, Search, RefreshCw, X, TrendingUp,
  TrendingDown, Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import type { WalletSummary } from '@/types'

// ─── Main Wallets Page ───────────────────────────────────────────────────────

export function WalletsPage() {
  const [wallets, setWallets] = useState<WalletSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [detailWallet, setDetailWallet] = useState<WalletSummary | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const limit = 30

  const location = useLocation()
  const navigate = useNavigate()
  const [pendingOpenUserId, setPendingOpenUserId] = useState<string | null>(null)

  // Pick up openUserId passed from notification click
  useEffect(() => {
    const userId = (location.state as { openUserId?: string } | null)?.openUserId
    if (userId) {
      setPendingOpenUserId(userId)
      // Clear state so a refresh doesn't re-open
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchWallets = useCallback(async (pageNum = 1, search = searchQuery) => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page: pageNum, limit }
      if (search) params.search = search
      const res = await adminApi.getWallets(params)
      setWallets(pageNum === 1 ? res.items : (prev) => [...prev, ...res.items])
      setTotal(res.total)
      setPage(pageNum)

      // Auto-open the wallet modal if a user was passed in from notifications
      if (pendingOpenUserId) {
        const target = res.items.find((w: WalletSummary) => w.userId === pendingOpenUserId)
        if (target) {
          setDetailWallet(target)
          setDetailOpen(true)
          setPendingOpenUserId(null)
        }
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load wallets'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchWallets(1, searchQuery)
  }, [])

  async function onRefresh() {
    setRefreshing(true)
    await fetchWallets(1, searchQuery)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchInput)
    setPage(1)
    setWallets([])
    fetchWallets(1, searchInput)
  }

  function openDetail(wallet: WalletSummary) {
    setDetailWallet(wallet)
    setDetailOpen(true)
  }

  function closeDetail() {
    setDetailOpen(false)
    // Refresh to pick up any balance changes
    fetchWallets(1, searchQuery)
    setDetailWallet(null)
  }

  // Aggregate totals
  const totalBalance = wallets.reduce((s, w) => s + Number(w.balance), 0)
  const totalEarned = wallets.reduce((s, w) => s + Number(w.totalEarned), 0)
  const totalWithdrawn = wallets.reduce((s, w) => s + Number(w.totalWithdrawn), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Wallet Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {total.toLocaleString('en-IN')} wallet{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Distributed</p>
                <p className="mt-1 text-2xl font-extrabold text-success tabular-nums">
                  ₹{totalEarned.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-text-tertiary mt-1">Across all wallets</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary">Total Withdrawn</p>
                <p className="mt-1 text-2xl font-extrabold text-destructive tabular-nums">
                  ₹{totalWithdrawn.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-text-tertiary mt-1">All withdrawal payouts</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-text-secondary">Active Balance</p>
                <p className="mt-1 text-2xl font-extrabold text-primary tabular-nums">
                  ₹{totalBalance.toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-text-tertiary mt-1">Available in wallets</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <Input
            placeholder="Search by name or mobile number…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm">Search</Button>
        {searchQuery && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('')
              setSearchQuery('')
              setPage(1)
              setWallets([])
              fetchWallets(1, '')
            }}
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </form>

      {/* Wallets table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Category</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Balance</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Total Earned</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Withdrawn</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && wallets.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24" /></td>
                    ))}
                  </tr>
                ))
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    {searchQuery ? 'No wallets match your search' : 'No wallets found'}
                  </td>
                </tr>
              ) : (
                wallets.map((wallet) => (
                  <tr key={wallet.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                          type="button"
                          className="font-medium text-primary hover:underline text-left"
                          onClick={() => navigate(`/users/${wallet.user.id}`)}
                        >
                          {wallet.user.name}
                        </button>
                      <p className="text-xs text-muted-foreground">{wallet.user.mobileNumber} · {wallet.user.state}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{wallet.user.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">
                      ₹{Number(wallet.balance).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right text-success tabular-nums">
                      ₹{Number(wallet.totalEarned).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-right text-destructive tabular-nums">
                      ₹{Number(wallet.totalWithdrawn).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge className={cn(
                        'text-xs capitalize',
                        wallet.user.verificationStatus === 'verified' ? 'bg-success text-white' :
                        wallet.user.verificationStatus === 'pending' ? 'bg-warning text-white' :
                        wallet.user.verificationStatus === 'suspended' || wallet.user.verificationStatus === 'banned' ? 'bg-destructive text-white' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {wallet.user.verificationStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-primary hover:text-primary"
                        onClick={() => openDetail(wallet)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {total > limit && (
          <div className="flex items-center justify-center px-4 py-3 border-t bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchWallets(page + 1, searchQuery)}
              disabled={loading}
            >
              {loading ? 'Loading…' : `Load More (${total - wallets.length} remaining)`}
            </Button>
          </div>
        )}
      </div>

      {/* Wallet detail modal — shared component */}
      {detailWallet && (
        <WalletDetailModal
          userId={detailWallet.userId}
          open={detailOpen}
          onClose={closeDetail}
          summary={detailWallet}
        />
      )}
    </div>
  )
}

export default WalletsPage