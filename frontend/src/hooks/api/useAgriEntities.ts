import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { agriEntityApi } from '@/client/client'

export const agriEntityKeys = {
  all: ['agriEntities'] as const,
  myCounts: () => [...agriEntityKeys.all, 'myCounts'] as const,
  mine: (params: MineParams) => [...agriEntityKeys.all, 'mine', params ?? {}] as const,
  list: (params: AllParams) => [...agriEntityKeys.all, 'list', params ?? {}] as const,
  users: (params: UsersParams) => [...agriEntityKeys.all, 'users', params ?? {}] as const,
}

type MineParams = Parameters<typeof agriEntityApi.listMine>[0]
type AllParams = Parameters<typeof agriEntityApi.listAll>[0]
type UsersParams = Parameters<typeof agriEntityApi.listUsers>[0]

// Per-type submission counts shown on the public submissions tabs.
export function useMyAgriEntityCounts(enabled = true) {
  return useQuery({
    queryKey: agriEntityKeys.myCounts(),
    queryFn: () => agriEntityApi.getMyCounts(),
    enabled,
    staleTime: 0,
  })
}

export function useMyAgriEntities(params?: MineParams, enabled = true) {
  return useQuery({
    queryKey: agriEntityKeys.mine(params),
    queryFn: () => agriEntityApi.listMine(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useAgriEntities(params?: AllParams, enabled = true) {
  return useQuery({
    queryKey: agriEntityKeys.list(params),
    queryFn: () => agriEntityApi.listAll(params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useAgriEntityUsers(params?: UsersParams, enabled = true) {
  return useQuery({
    queryKey: agriEntityKeys.users(params),
    queryFn: () => agriEntityApi.listUsers(params),
    enabled,
  })
}

export function useSubmitAgriEntity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: agriEntityApi.submit,
    onSuccess: () => qc.invalidateQueries({ queryKey: agriEntityKeys.all }),
  })
}
