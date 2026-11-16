import { useQuery } from '@tanstack/react-query'
import { lgdApi } from '@/client/client'

/**
 * Location lookups (LGD directory). These lists are effectively static, so
 * they are cached for the session and each level is disabled until its parent
 * code is known.
 */
export const lgdKeys = {
  all: ['lgd'] as const,
  states: () => [...lgdKeys.all, 'states'] as const,
  districts: (stateCode: string | null | undefined) => [...lgdKeys.all, 'districts', stateCode] as const,
  subDistricts: (districtCode: string | null | undefined) => [...lgdKeys.all, 'subDistricts', districtCode] as const,
  villages: (blockCode: string | null | undefined) => [...lgdKeys.all, 'villages', blockCode] as const,
  kvks: (districtCode: string | null | undefined) => [...lgdKeys.all, 'kvks', districtCode] as const,
}

const STATIC = { staleTime: Infinity, gcTime: Infinity } as const

export function useStates(enabled = true) {
  return useQuery({ queryKey: lgdKeys.states(), queryFn: () => lgdApi.getStates(), enabled, ...STATIC })
}

export function useDistricts(stateCode: string | null | undefined) {
  return useQuery({
    queryKey: lgdKeys.districts(stateCode),
    queryFn: () => lgdApi.getDistricts(stateCode as string),
    enabled: !!stateCode,
    ...STATIC,
  })
}

export function useSubDistricts(districtCode: string | null | undefined) {
  return useQuery({
    queryKey: lgdKeys.subDistricts(districtCode),
    queryFn: () => lgdApi.getSubDistricts(districtCode as string),
    enabled: !!districtCode,
    ...STATIC,
  })
}

export function useVillages(blockCode: string | null | undefined) {
  return useQuery({
    queryKey: lgdKeys.villages(blockCode),
    queryFn: () => lgdApi.getVillages(blockCode as string),
    enabled: !!blockCode,
    ...STATIC,
  })
}

export function useKvks(districtCode: string | null | undefined) {
  return useQuery({
    queryKey: lgdKeys.kvks(districtCode),
    queryFn: () => lgdApi.getKvks(districtCode as string),
    enabled: !!districtCode,
    ...STATIC,
  })
}
