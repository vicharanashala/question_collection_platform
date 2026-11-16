import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { feedbackApi } from '@/client/client'

export const feedbackKeys = {
  all: ['feedbacks'] as const,
  anveshanList: (params: ListParams) => [...feedbackKeys.all, 'anveshan', params ?? {}] as const,
}

type ListParams = Parameters<typeof feedbackApi.listAnveshanFeedback>[0]

export function useAnveshanFeedback(params?: ListParams) {
  return useQuery({
    queryKey: feedbackKeys.anveshanList(params),
    queryFn: () => feedbackApi.listAnveshanFeedback(params),
    placeholderData: keepPreviousData,
  })
}

export function useSubmitAnveshanFeedback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: feedbackApi.submitAnveshanFeedback,
    onSuccess: () => qc.invalidateQueries({ queryKey: feedbackKeys.all }),
  })
}
