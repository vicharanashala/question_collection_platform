import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { adminApi, userApi } from '@/client/client'

export const userKeys = {
  all: ['users'] as const,
  list: (params: ListParams) => [...userKeys.all, 'list', params ?? {}] as const,
  stats: (params: StatsParams) => [...userKeys.all, 'stats', params ?? {}] as const,
  detail: (userId: string | undefined | null) => [...userKeys.all, 'detail', userId] as const,
  anveshanDetail: (userId: string | undefined | null) => [...userKeys.all, 'anveshanDetail', userId] as const,
  session: (userId: string | null) => [...userKeys.all, 'session', userId] as const,
  wallet: (userId: string | null) => [...userKeys.all, 'wallet', userId] as const,
  transactions: (userId: string | null, params: TxParams) =>
    [...userKeys.all, 'transactions', userId, params ?? {}] as const,
  infiniteTransactions: (userId: string | null, params: TxParams) =>
    [...userKeys.all, 'infiniteTransactions', userId, params ?? {}] as const,
}

type ListParams = Parameters<typeof adminApi.getUsers>[0]
type StatsParams = Parameters<typeof adminApi.getUserStats>[0]
type TxParams = Parameters<typeof adminApi.getUserTransactions>[1]

export function useUsers(params?: ListParams, enabled = true) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => adminApi.getUsers(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

// Totals by cohort (testers, Anveshan, …) for the users page header.
export function useUserStats(params?: StatsParams, enabled = true) {
  return useQuery({
    queryKey: userKeys.stats(params),
    queryFn: () => adminApi.getUserStats(params),
    enabled,
  })
}

export function useUserDetail(userId: string | undefined | null) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => adminApi.getUserDetail(userId as string),
    enabled: !!userId,
  })
}

export function useAnveshanUserDetail(userId: string | undefined | null) {
  return useQuery({
    queryKey: userKeys.anveshanDetail(userId),
    queryFn: () => adminApi.getAnveshanUserDetail(userId as string),
    enabled: !!userId,
  })
}

export function useUserSession(userId: string | null) {
  return useQuery({
    queryKey: userKeys.session(userId),
    queryFn: () => adminApi.getUserSession(userId as string),
    enabled: !!userId,
  })
}

export function useUserWallet(userId: string | null) {
  return useQuery({
    queryKey: userKeys.wallet(userId),
    queryFn: () => adminApi.getUserWallet(userId as string),
    enabled: !!userId,
    staleTime: 0,
  })
}

export function useUserTransactions(userId: string | null, params?: TxParams) {
  return useQuery({
    queryKey: userKeys.transactions(userId, params),
    queryFn: () => adminApi.getUserTransactions(userId as string, params),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })
}

/** Paged transaction history for one user, for the "load more" tables. */
export function useInfiniteUserTransactions(
  userId: string | null,
  params: { limit: number; source?: string },
) {
  return useInfiniteQuery({
    queryKey: userKeys.infiniteTransactions(userId, params),
    queryFn: ({ pageParam }) => adminApi.getUserTransactions(userId as string, { ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
    enabled: !!userId,
    // Balances change from other screens, so always revalidate on open.
    staleTime: 0,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useVerifyUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.verifyUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useSuspendUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { userId: string; body: Parameters<typeof adminApi.suspendUser>[1] }) =>
      adminApi.suspendUser(vars.userId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useUnsuspendUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.unsuspendUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useRestoreUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.restoreUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useRevokeUserSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.revokeUserSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}

// Pulls the latest Anveshan profile data for the signed-in user.
export function useRefreshFromAnveshan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => userApi.refreshFromAnveshan(),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  })
}
