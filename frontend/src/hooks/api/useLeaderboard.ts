import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { leaderboardApi } from '@/client/client'

export const leaderboardKeys = {
  all: ['leaderboard'] as const,
  list: (params: ListParams) => [...leaderboardKeys.all, 'list', params] as const,
  infinite: (limit: number) => [...leaderboardKeys.all, 'infinite', limit] as const,
}

export interface ListParams {
  limit?: number
  offset?: number
}

export function useLeaderboard(params: ListParams = {}, enabled = true) {
  return useQuery({
    queryKey: leaderboardKeys.list(params),
    queryFn: () => leaderboardApi.getLeaderboard(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Offset-paged leaderboard for the "load more" view. */
export function useInfiniteLeaderboard(limit: number) {
  return useInfiniteQuery({
    queryKey: leaderboardKeys.infinite(limit),
    queryFn: ({ pageParam }) => leaderboardApi.getLeaderboard({ limit, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      // The server may return fewer rows than asked for; advance by what arrived.
      const loaded = allPages.reduce((count, page) => count + page.entries.length, 0)
      if (lastPage.entries.length === 0 || loaded >= lastPage.total) return undefined
      return loaded
    },
  })
}
