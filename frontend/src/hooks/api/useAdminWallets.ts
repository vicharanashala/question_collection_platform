import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { adminApi } from '@/client/client'
import { userKeys } from './useUsers'

/** Staff view of every user wallet. Public-user wallet hooks live in useWallet.ts. */
export const adminWalletKeys = {
  all: ['adminWallets'] as const,
  list: (params: ListParams) => [...adminWalletKeys.all, 'list', params ?? {}] as const,
  summary: (params: SummaryParams) => [...adminWalletKeys.all, 'summary', params ?? {}] as const,
  infinite: (params: ListParams) => [...adminWalletKeys.all, 'infinite', params ?? {}] as const,
  financialSummary: (params: FinancialParams) => [...adminWalletKeys.all, 'financial', params ?? {}] as const,
}

type ListParams = Parameters<typeof adminApi.getWallets>[0]
type SummaryParams = Parameters<typeof adminApi.getWalletsSummary>[0]
type FinancialParams = Parameters<typeof adminApi.getFinancialSummary>[0]

export function useAdminWallets(params?: ListParams) {
  return useQuery({
    queryKey: adminWalletKeys.list(params),
    queryFn: () => adminApi.getWallets(params),
    placeholderData: keepPreviousData,
  })
}

/** Paged wallet list for the "load more" table. */
export function useInfiniteAdminWallets(params: { limit: number; search?: string; tester?: string }) {
  return useInfiniteQuery({
    queryKey: adminWalletKeys.infinite(params),
    queryFn: ({ pageParam }) => adminApi.getWallets({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.items.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
  })
}

// Totals across all wallets, shown above the admin wallets table.
export function useAdminWalletsSummary(params?: SummaryParams) {
  return useQuery({
    queryKey: adminWalletKeys.summary(params),
    queryFn: () => adminApi.getWalletsSummary(params),
  })
}

export function useFinancialSummary(params?: FinancialParams) {
  return useQuery({
    queryKey: adminWalletKeys.financialSummary(params),
    queryFn: () => adminApi.getFinancialSummary(params),
  })
}

// Manual credit or debit on a user wallet; refreshes both wallet and user views.
export function useAdjustWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { userId: string; body: Parameters<typeof adminApi.adjustWallet>[1] }) =>
      adminApi.adjustWallet(vars.userId, vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminWalletKeys.all })
      qc.invalidateQueries({ queryKey: userKeys.all })
    },
  })
}
