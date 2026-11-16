import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auditApi } from '@/client/client'

export const auditKeys = {
  all: ['auditLogs'] as const,
  list: (params: ListParams) => [...auditKeys.all, 'list', params ?? {}] as const,
}

type ListParams = Parameters<typeof auditApi.getAuditLogs>[0]

export function useAuditLogs(params?: ListParams) {
  return useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => auditApi.getAuditLogs(params),
    placeholderData: keepPreviousData,
  })
}
