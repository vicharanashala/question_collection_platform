import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/client/client'
import type { Crop } from '@/components/ui/crop-picker-modal'

export const cropKeys = {
  all: ['crops'] as const,
}

interface CropsResponse {
  crops: Crop[]
}

/**
 * Crop catalogue for the crop picker. The query cache dedupes concurrent
 * pickers and keeps the list for the session; a failed load is retried on the
 * next mount.
 */
export function useCrops(): Crop[] {
  const { data } = useQuery({
    queryKey: cropKeys.all,
    queryFn: async () => {
      const res = (await authApi.getCrops()) as CropsResponse
      return res.crops ?? []
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })

  return data ?? []
}
