import { useQuery } from '@tanstack/react-query'
import { adminApi, analyticsApi, curatorApi, distributor } from '@/client/client'

/** Dashboard and analytics reads for the staff dashboards. */
export const analyticsKeys = {
  all: ['analytics'] as const,
  adminStats: () => [...analyticsKeys.all, 'adminStats'] as const,
  dashboard: (params: DashboardParams) => [...analyticsKeys.all, 'dashboard', params ?? {}] as const,
  users: (params: UserParams) => [...analyticsKeys.all, 'users', params ?? {}] as const,
  questions: (params: QuestionParams) => [...analyticsKeys.all, 'questions', params ?? {}] as const,
  rewards: (params: RewardParams) => [...analyticsKeys.all, 'rewards', params ?? {}] as const,
  curatorStats: (params: CuratorParams) => [...analyticsKeys.all, 'curatorStats', params ?? {}] as const,
  reviewQueue: (params: ReviewQueueParams) => [...analyticsKeys.all, 'reviewQueue', params ?? {}] as const,
  distributorStats: () => [...analyticsKeys.all, 'distributorStats'] as const,
}

type DashboardParams = Parameters<typeof analyticsApi.getDashboard>[0]
type UserParams = Parameters<typeof analyticsApi.getUserAnalytics>[0]
type QuestionParams = Parameters<typeof analyticsApi.getQuestionAnalytics>[0]
type RewardParams = Parameters<typeof analyticsApi.getRewardAnalytics>[0]
type CuratorParams = Parameters<typeof curatorApi.getCuratorStats>[0]
type ReviewQueueParams = Parameters<typeof curatorApi.getReviewQueue>[0]

// Platform-wide counters for the admin dashboard header.
export function useAdminStats() {
  return useQuery({
    queryKey: analyticsKeys.adminStats(),
    queryFn: () => adminApi.getStats(),
  })
}

export function useDashboardAnalytics(params?: DashboardParams) {
  return useQuery({
    queryKey: analyticsKeys.dashboard(params),
    queryFn: () => analyticsApi.getDashboard(params),
  })
}

export function useUserAnalytics(params?: UserParams, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.users(params),
    queryFn: () => analyticsApi.getUserAnalytics(params),
    enabled,
  })
}

export function useQuestionAnalytics(params?: QuestionParams, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.questions(params),
    queryFn: () => analyticsApi.getQuestionAnalytics(params),
    enabled,
  })
}

export function useRewardAnalytics(params?: RewardParams, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.rewards(params),
    queryFn: () => analyticsApi.getRewardAnalytics(params),
    enabled,
  })
}

export function useCuratorStats(params?: CuratorParams) {
  return useQuery({
    queryKey: analyticsKeys.curatorStats(params),
    queryFn: () => curatorApi.getCuratorStats(params),
  })
}

export function useReviewQueue(params?: ReviewQueueParams) {
  return useQuery({
    queryKey: analyticsKeys.reviewQueue(params),
    queryFn: () => curatorApi.getReviewQueue(params),
  })
}

export function useDistributorStats() {
  return useQuery({
    queryKey: analyticsKeys.distributorStats(),
    queryFn: () => distributor.getStats(),
  })
}
