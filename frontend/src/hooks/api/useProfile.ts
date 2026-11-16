import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/client/client'

/**
 * Profile reads and writes for the signed-in user. Session bootstrap and token
 * handling stay in AuthContext — these hooks are for screens that read or edit
 * the profile.
 */
export const profileKeys = {
  all: ['profile'] as const,
  me: () => [...profileKeys.all, 'me'] as const,
  usernameCheck: (username: string) => [...profileKeys.all, 'usernameCheck', username] as const,
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => authApi.me(),
    enabled,
  })
}

// Username availability; only runs once the candidate is long enough to be valid.
export function useUsernameCheck(username: string, enabled = true) {
  return useQuery({
    queryKey: profileKeys.usernameCheck(username),
    queryFn: () => authApi.checkUsername(username),
    enabled: enabled && username.length >= 3,
  })
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.me() }),
  })
}

/**
 * Re-reads the signed-in account on demand (for example a "check again"
 * button). It is a mutation rather than a query because it runs on a user
 * action, not on render.
 */
export function useRefreshMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => authApi.me(),
    onSuccess: (data) => qc.setQueryData(profileKeys.me(), data),
  })
}
