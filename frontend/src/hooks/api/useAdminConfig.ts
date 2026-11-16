import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/client/client'

export const adminConfigKeys = {
  all: ['adminConfig'] as const,
}

// Platform settings (limits, toggles) managed on the settings page.
export function useAdminConfig(enabled = true) {
  return useQuery({
    queryKey: adminConfigKeys.all,
    queryFn: () => adminApi.getConfig(),
    enabled,
  })
}

export function useUpdateAdminConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: adminApi.updateConfig,
    onSuccess: () => qc.invalidateQueries({ queryKey: adminConfigKeys.all }),
  })
}
