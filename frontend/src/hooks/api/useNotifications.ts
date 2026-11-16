import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { notificationApi } from '@/client/client'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (params: NotificationParams) => [...notificationKeys.all, 'list', params] as const,
  infinite: (limit: number) => [...notificationKeys.all, 'infinite', limit] as const,
}

export interface NotificationParams {
  page?: number
  limit?: number
}

export function useNotifications(params: NotificationParams = {}, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: () => notificationApi.getNotifications(params),
    placeholderData: keepPreviousData,
    enabled,
    // Notifications are time-sensitive, so always revalidate on mount.
    staleTime: 0,
  })
}

/** Paged notification list for the "load more" screens. */
export function useInfiniteNotifications(limit = 20, enabled = true) {
  return useInfiniteQuery({
    queryKey: notificationKeys.infinite(limit),
    queryFn: ({ pageParam }) => notificationApi.getNotifications({ page: pageParam, limit }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((count, page) => count + page.notifications.length, 0)
      return loaded < lastPage.total ? allPages.length + 1 : undefined
    },
    enabled,
    staleTime: 0,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
