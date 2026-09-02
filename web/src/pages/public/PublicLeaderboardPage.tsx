/**
 * Public Leaderboard page — mirrors mobile/src/screens/Leaderboard/LeaderboardScreen.tsx
 *
 * Reached from the trophy icon in the public header. Top-3 podium, a stats
 * row, and a ranked list of the rest of the participants.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { leaderboardApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { Banknote, HelpCircle, Trophy, Medal, Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { LeaderboardEntry } from '@/types'

// const FETCH_LIMIT = 100

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatINR(amount: number): string {
  if (amount <= 0) return '₹0'
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

function getInitials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

const MEDALS = {
  gold:   { color: 'text-amber-600 dark:text-amber-400',   ring: 'ring-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40',   label: '1st' },
  silver: { color: 'text-slate-600 dark:text-slate-300',   ring: 'ring-slate-400',  bg: 'bg-slate-100 dark:bg-slate-800/60',  label: '2nd' },
  bronze: { color: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', label: '3rd' },
} as const

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ name, size, ring, isCurrentUser }: { name?: string; size: number; ring?: string; isCurrentUser?: boolean }) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-extrabold',
        ring ? `ring-2 ${ring}` : '',
        isCurrentUser ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {getInitials(name)}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconClassName, value, label }: { icon: typeof Banknote; iconClassName: string; value: string | number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-border-subtle bg-surface px-3 py-3">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', iconClassName)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs sm:text-xs sm:text-sm font-extrabold text-foreground">{value}</p>
        <p className="truncate text-[11px] font-medium text-text-secondary">{label}</p>
      </div>
    </div>
  )
}

// ─── Podium ──────────────────────────────────────────────────────────────────

function PodiumSlot({ entry, medal, height }: { entry: LeaderboardEntry; medal: keyof typeof MEDALS; height: number }) {
  const m = MEDALS[medal]
  const isWinner = medal === 'gold'
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-2.5 flex flex-col items-center">
        {isWinner && <Star className={cn('mb-1 h-3.5 w-3.5', m.color)} fill="currentColor" />}
        <Avatar name={entry.name} size={isWinner ? 56 : 46} ring={m.ring} />
        <p className="mt-2 max-w-[96px] truncate text-center text-[11px] sm:text-[11px] sm:text-xs font-bold text-foreground">{entry.name || 'Unknown'}</p>
        <p className="truncate text-[11px] sm:text-[11px] sm:text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{formatINR(entry.totalEarned)}</p>
      </div>
      <div
        className={cn('flex w-full flex-col items-center justify-center gap-0.5 rounded-t-lg border', m.bg)}
        style={{ height, borderColor: 'transparent' }}
      >
        <Medal className={cn(isWinner ? 'h-6 w-6' : 'h-5 w-5', m.color)} />
        <span className={cn('font-black', m.color, isWinner ? 'text-lg sm:text-xl' : 'text-sm sm:text-sm sm:text-base')}>{entry.rank}</span>
        <span className={cn('text-[9px] font-bold uppercase tracking-wide', m.color)}>{m.label}</span>
      </div>
    </div>
  )
}

function Podium({ top3 }: { top3: LeaderboardEntry[] }) {
  if (top3.length === 0) return null
  const slots: Array<{ entry: LeaderboardEntry; medal: keyof typeof MEDALS; height: number }> = []
  if (top3[1]) slots.push({ entry: top3[1], medal: 'silver', height: 76 })
  if (top3[0]) slots.push({ entry: top3[0], medal: 'gold', height: 100 })
  if (top3[2]) slots.push({ entry: top3[2], medal: 'bronze', height: 64 })

  return (
    <Card>
      <CardContent className="flex items-end gap-2 px-3 py-4">
        {slots.map((s) => (
          <PodiumSlot key={s.entry.userId} entry={s.entry} medal={s.medal} height={s.height} />
        ))}
      </CardContent>
    </Card>
  )
}

// ─── List row ────────────────────────────────────────────────────────────────

function ListRow({ entry }: { entry: LeaderboardEntry }) {
  const isMe = entry.isCurrentUser
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
        isMe ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-border-subtle bg-surface',
      )}
    >
      <span className={cn('w-6 shrink-0 text-center text-xs sm:text-xs sm:text-sm font-extrabold', isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-tertiary')}>
        {entry.rank}
      </span>
      <Avatar name={entry.name} size={36} isCurrentUser={isMe} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-xs sm:text-xs sm:text-sm', isMe ? 'font-extrabold text-foreground' : 'font-semibold text-foreground')}>
          {entry.name || 'Unknown'}
        </p>
        {isMe && <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">You</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-xs sm:text-xs sm:text-sm font-extrabold', entry.totalEarned > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-text-tertiary')}>
          {formatINR(entry.totalEarned)}
        </p>
        <p className="text-[11px] font-medium text-text-tertiary">
          {entry.totalQuestions > 0 ? `${entry.totalQuestions} Qs` : '—'}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

// export function PublicLeaderboardPage(): ReactNode {
//   const [response, setResponse] = useState<LeaderboardResponse | null>(null)
//   const [loading, setLoading] = useState(true)

//   const fetchLeaderboard = useCallback(async () => {
//     try {
//       const res = await leaderboardApi.getLeaderboard({ limit: FETCH_LIMIT, offset: 10 });
//       setResponse(res)
//     } catch (e) {
//       toast.error(getErrorMessage(e, 'Failed to load leaderboard'))
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   useEffect(() => {
//     fetchLeaderboard()
//   }, [fetchLeaderboard])

//   const sortedEntries = useMemo(() => {
//     if (!response) return []
//     return [...response.entries].sort((a, b) => {
//       if (b.totalEarned !== a.totalEarned) return b.totalEarned - a.totalEarned
//       return b.totalQuestions - a.totalQuestions
//     })
//   }, [response])

//   const top3 = sortedEntries.slice(0, 3)
//   const rest = sortedEntries.slice(3)

//   const totalEarningsAll = sortedEntries.reduce((sum, e) => sum + (e.totalEarned ?? 0), 0)
//   const totalQuestionsAll = sortedEntries.reduce((sum, e) => sum + (e.totalQuestions ?? 0), 0)

//   return (
//     <div className="mx-auto max-w-2xl space-y-5 pb-4">
//       <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
//         <CardContent className="p-4">
//           <h1 className="text-lg sm:text-lg sm:text-xl font-extrabold tracking-tight text-foreground">Leaderboard</h1>
//           <p className="mt-0.5 text-xs sm:text-xs sm:text-sm text-text-secondary">
//             {response ? `${response.total} participants` : 'Loading…'}
//           </p>
//         </CardContent>
//       </Card>

//       {loading ? (
//         <Card>
//           <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
//             <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
//             <p className="mt-3 text-xs sm:text-xs sm:text-sm font-medium">Loading leaderboard…</p>
//           </CardContent>
//         </Card>
//       ) : sortedEntries.length === 0 ? (
//         <Card>
//           <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
//             <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-variant dark:bg-surface-variant">
//               <Trophy className="h-12 w-12 text-text-tertiary" strokeWidth={1.75} />
//             </div>
//             <h2 className="mt-5 text-lg sm:text-lg sm:text-xl font-extrabold text-foreground">No rankings yet</h2>
//             <p className="mt-2 max-w-sm text-xs sm:text-xs sm:text-sm text-text-secondary">
//               Submit and get questions approved to appear on the leaderboard.
//             </p>
//           </CardContent>
//         </Card>
//       ) : (
//         <>
//           <div className="flex gap-2.5">
//             <StatCard
//               icon={Banknote}
//               iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
//               value={formatINR(totalEarningsAll)}
//               label="Total rewards"
//             />
//             <StatCard
//               icon={HelpCircle}
//               iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
//               value={totalQuestionsAll > 0 ? totalQuestionsAll : '—'}
//               label="Approved Qs"
//             />
//             <StatCard
//               icon={Trophy}
//               iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
//               value={response?.userRank ? `#${response.userRank}` : '—'}
//               label="Your rank"
//             />
//           </div>

//           <Podium top3={top3} />

//           {rest.length > 0 && (
//             <div>
//               <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">All participants</p>
//               <div className="space-y-2">
//                 {rest.map((entry) => (
//                   <ListRow key={entry.userId} entry={entry} />
//                 ))}
//               </div>
//             </div>
//           )}
//         </>
//       )}

//       <p className="pt-2 text-center text-[11px] sm:text-[11px] sm:text-xs text-text-tertiary">AnnaDatha &mdash; To Strengthen Indian Farmers</p>
//     </div>
//   )
// }

export function PublicLeaderboardPage(): ReactNode {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<number | null>(null)
  const [total, setTotal] = useState(0)

  const [offset, setOffset] = useState(0)

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const FETCH_LIMIT = 10

  const hasMore = entries.length < total

  // ─────────────────────────────────────────────────────────────
  // Fetch leaderboard page
  // ─────────────────────────────────────────────────────────────

  const fetchLeaderboard = useCallback(
    async (currentOffset: number, isInitial = false) => {
      try {
        if (isInitial) {
          setLoading(true)
        } else {
          setLoadingMore(true)
        }

        const res = await leaderboardApi.getLeaderboard({
          limit: FETCH_LIMIT,
          offset: currentOffset,
        })

        // Initial request → replace
        // Subsequent requests → append
        setEntries((prev) =>
          currentOffset === 0
            ? res.entries
            : [...prev, ...res.entries],
        )

        setTotal(res.total)
        setUserRank(res.userRank)

        // Move offset forward by the number actually returned
        setOffset(
          currentOffset + res.entries.length,
        )
      } catch (e) {
        toast.error(
          getErrorMessage(
            e,
            'Failed to load leaderboard',
          ),
        )
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  // ─────────────────────────────────────────────────────────────
  // Initial load
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchLeaderboard(0, true)
  }, [fetchLeaderboard])

  // ─────────────────────────────────────────────────────────────
  // Load next page
  // ─────────────────────────────────────────────────────────────

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return

    fetchLeaderboard(offset)
  }

  // ─────────────────────────────────────────────────────────────
  // Sort
  // ─────────────────────────────────────────────────────────────

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (b.totalEarned !== a.totalEarned) {
        return b.totalEarned - a.totalEarned
      }

      if (b.totalQuestions !== a.totalQuestions) {
        return b.totalQuestions - a.totalQuestions
      }

      return a.rank - b.rank
    })
  }, [entries])

  // ─────────────────────────────────────────────────────────────
  // Top 3
  // ─────────────────────────────────────────────────────────────

  const top3 = sortedEntries.filter(
    (entry) => entry.rank <= 3,
  )

  // ─────────────────────────────────────────────────────────────
  // Remaining users
  // ─────────────────────────────────────────────────────────────

  const rest = sortedEntries.filter(
    (entry) => entry.rank > 3,
  )

  // ─────────────────────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────────────────────

  const totalEarningsAll = entries.reduce(
    (sum, e) => sum + (e.totalEarned ?? 0),
    0,
  )

  const totalQuestionsAll = entries.reduce(
    (sum, e) => sum + (e.totalQuestions ?? 0),
    0,
  )

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-4">

      {/* ─────────────────────────────────────────────
          Header
      ───────────────────────────────────────────── */}

      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/50">
        <CardContent className="p-4">
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
            Leaderboard
          </h1>

          <p className="mt-0.5 text-xs sm:text-sm text-text-secondary">
            {total > 0
              ? `${total} participants`
              : 'Loading…'}
          </p>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────
          Initial loading
      ───────────────────────────────────────────── */}

      {loading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-text-tertiary">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />

            <p className="mt-3 text-xs sm:text-sm font-medium">
              Loading leaderboard…
            </p>
          </CardContent>
        </Card>
      ) : sortedEntries.length === 0 ? (

        /* ───────────────────────────────────────────
           Empty state
        ─────────────────────────────────────────── */

        <Card>
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-surface-variant dark:bg-surface-variant">
              <Trophy
                className="h-12 w-12 text-text-tertiary"
                strokeWidth={1.75}
              />
            </div>

            <h2 className="mt-5 text-lg sm:text-xl font-extrabold text-foreground">
              No rankings yet
            </h2>

            <p className="mt-2 max-w-sm text-xs sm:text-sm text-text-secondary">
              Submit and get questions approved to appear on the leaderboard.
            </p>
          </CardContent>
        </Card>

      ) : (

        <>
          {/* ─────────────────────────────────────────
              Stats
          ───────────────────────────────────────── */}

          <div className="flex gap-2.5">
            <StatCard
              icon={Banknote}
              iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
              value={formatINR(totalEarningsAll)}
              label="Total rewards"
            />

            <StatCard
              icon={HelpCircle}
              iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
              value={
                totalQuestionsAll > 0
                  ? totalQuestionsAll
                  : '—'
              }
              label="Approved Qs"
            />

            <StatCard
              icon={Trophy}
              iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
              value={
                userRank
                  ? `#${userRank}`
                  : '—'
              }
              label="Your rank"
            />
          </div>

          {/* ─────────────────────────────────────────
              Top 3
          ───────────────────────────────────────── */}

          <Podium top3={top3} />

          {/* ─────────────────────────────────────────
              Remaining users
          ───────────────────────────────────────── */}

          {rest.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                All participants
              </p>

              <div className="space-y-2">
                {rest.map((entry) => (
                  <ListRow
                    key={entry.userId}
                    entry={entry}
                  />
                ))}
              </div>

              {/* ─────────────────────────────────────
                  Load more
              ───────────────────────────────────── */}

              {hasMore && (
                <div className="flex justify-center pt-5">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className={cn(
                      'rounded-lg border px-5 py-2.5 text-sm font-bold transition',
                      'border-border-subtle bg-surface',
                      'hover:bg-surface-variant',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                  >
                    {loadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </span>
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}

              {!hasMore && (
                <p className="pt-5 text-center text-[11px] sm:text-xs text-text-tertiary">
                  You've reached the end of the leaderboard.
                </p>
              )}
            </div>
          )}

          {/* If there are only 1–3 users */}
          {rest.length === 0 && hasMore === false && (
            <p className="text-center text-[11px] sm:text-xs text-text-tertiary">
              You've reached the end of the leaderboard.
            </p>
          )}
        </>
      )}

      <p className="pt-2 text-center text-[11px] sm:text-xs text-text-tertiary">
        AnnaDatha &mdash; To Strengthen Indian Farmers
      </p>
    </div>
  )
}

export default PublicLeaderboardPage
