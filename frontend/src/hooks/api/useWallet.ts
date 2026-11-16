import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { walletApi } from '@/client/client'

/** Public-user wallet. Admin-side wallet hooks live in useAdminWallets.ts. */
export const walletKeys = {
  all: ['wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: (params: TransactionParams) => [...walletKeys.all, 'transactions', params] as const,
  infiniteTransactions: (limit: number) => [...walletKeys.all, 'infiniteTransactions', limit] as const,
  config: () => [...walletKeys.all, 'config'] as const,
  paymentDetails: () => [...walletKeys.all, 'paymentDetails'] as const,
}

export interface TransactionParams {
  page?: number
  limit?: number
}

export function useWalletBalance(enabled = true) {
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: () => walletApi.getBalance(),
    enabled,
    staleTime: 0,
  })
}

export function useWalletTransactions(params: TransactionParams = {}, enabled = true) {
  return useQuery({
    queryKey: walletKeys.transactions(params),
    queryFn: () => walletApi.getTransactions(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Paged transaction history for the "load more" wallet list. */
export function useInfiniteWalletTransactions(limit: number) {
  return useInfiniteQuery({
    queryKey: walletKeys.infiniteTransactions(limit),
    queryFn: ({ pageParam }) => walletApi.getTransactions({ page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + (page.transactions?.length ?? 0), 0)
      return loaded < (lastPage.total ?? 0) ? allPages.length + 1 : undefined
    },
    staleTime: 0,
  })
}

// Withdrawal limits and fees — changes rarely, so it is cached longer.
export function useWalletConfig(enabled = true) {
  return useQuery({
    queryKey: walletKeys.config(),
    queryFn: () => walletApi.getWalletConfig(),
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function usePaymentDetails(enabled = true) {
  return useQuery({
    queryKey: walletKeys.paymentDetails(),
    queryFn: () => walletApi.getPaymentDetails(),
    enabled,
  })
}

export function useWithdraw() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: walletApi.withdraw,
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.all }),
  })
}

export function useAddPaymentDetail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: walletApi.addPaymentDetail,
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.paymentDetails() }),
  })
}

export function useDeletePaymentDetail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: walletApi.deletePaymentDetail,
    onSuccess: () => qc.invalidateQueries({ queryKey: walletKeys.paymentDetails() }),
  })
}
