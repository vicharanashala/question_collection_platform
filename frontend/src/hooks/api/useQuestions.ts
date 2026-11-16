import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { questionApi } from '@/client/client'

/** Query keys for the question domain. Invalidate `questionKeys.all` after mutations. */
export const questionKeys = {
  all: ['questions'] as const,
  myList: (params: MyQuestionsParams) => [...questionKeys.all, 'mine', params] as const,
  detail: (id: string | null) => [...questionKeys.all, 'detail', id] as const,
}

export interface MyQuestionsParams {
  page?: number
  limit?: number
  status?: string
}

// Lists the current user's own questions; previous page stays visible while the next loads.
export function useMyQuestions(params: MyQuestionsParams) {
  return useQuery({
    queryKey: questionKeys.myList(params),
    queryFn: () => questionApi.listMyQuestions(params),
    placeholderData: keepPreviousData,
    // Always revalidate on mount so a question submitted on another screen
    // shows up immediately; cached data still renders while it refetches.
    staleTime: 0,
  })
}

// Fetches a single question. Pass null to disable (e.g. while a dialog is closed).
export function useQuestion(id: string | null) {
  return useQuery({
    queryKey: questionKeys.detail(id),
    queryFn: () => questionApi.getQuestion(id as string),
    enabled: !!id,
  })
}
