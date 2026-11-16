import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { adminApi } from '@/client/client'
import { walletKeys } from './useWallet'

export const withdrawalKeys = {
  all: ['withdrawals'] as const,
  list: (params: ListParams) => [...withdrawalKeys.all, 'list', params ?? {}] as const,
  detail: (id: string | null) => [...withdrawalKeys.all, 'detail', id] as const,
  infinite: (params: ListParams) => [...withdrawalKeys.all, 'infinite', params ?? {}] as const,
}

type ListParams = Parameters<typeof adminApi.listWithdrawals>[0]

export function useWithdrawals(params?: ListParams) {
  return useQuery({
    queryKey: withdrawalKeys.list(params),
    queryFn: () => adminApi.listWithdrawals(params),
    placeholderData: keepPreviousData,
  })
}

/** Paged withdrawal list for the "load more" table. */
export function useInfiniteWithdrawals(params: Record<string, string | number>) {
  return useInfiniteQuery({
    queryKey: withdrawalKeys.infinite(params),
    queryFn: ({ pageParam }) => adminApi.listWithdrawals({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
  })
}

// A withdrawal plus the transactions it generated (detail modal).
export function useWithdrawalWithTransactions(id: string | null) {
  return useQuery({
    queryKey: withdrawalKeys.detail(id),
    queryFn: () => adminApi.getWithdrawalWithTransactions(id as string),
    enabled: !!id,
  })
}

// Approving or rejecting moves money, so wallet caches are invalidated too.
export function useProcessWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof adminApi.processWithdrawal>[1] }) =>
      adminApi.processWithdrawal(vars.id, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: withdrawalKeys.all })
      qc.invalidateQueries({ queryKey: walletKeys.all })
    },
  })
}

export function useMarkWithdrawalFailed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason: string }) => adminApi.markWithdrawalFailed(vars.id, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: withdrawalKeys.all }),
  })
}

export function useRetryFailedWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.retryFailedWithdrawal,
    onSuccess: () => qc.invalidateQueries({ queryKey: withdrawalKeys.all }),
  })
}
