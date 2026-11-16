import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { questionApi } from '@/client/client'

/** Query keys for the question domain. Invalidate `questionKeys.all` after mutations. */
export const questionKeys = {
  all: ['questions'] as const,
  list: (params: ListParams) => [...questionKeys.all, 'list', params ?? {}] as const,
  myList: (params: MyQuestionsParams) => [...questionKeys.all, 'mine', params] as const,
  detail: (id: string | null) => [...questionKeys.all, 'detail', id] as const,
  myStats: () => [...questionKeys.all, 'myStats'] as const,
  anveshanMilestone: () => [...questionKeys.all, 'anveshanMilestone'] as const,
  anveshanAnswerQuestions: () => [...questionKeys.all, 'anveshanAnswerQuestions'] as const,
  anveshanAnswer: (id: string | null) => [...questionKeys.all, 'anveshanAnswer', id] as const,
  anveshanAnswerScore: (id: string | null) => [...questionKeys.all, 'anveshanAnswerScore', id] as const,
}

type ListParams = Parameters<typeof questionApi.getQuestions>[0]

export interface MyQuestionsParams {
  page?: number
  limit?: number
  status?: string
}

// Staff list of all questions, filtered server-side.
export function useQuestionsList(params: ListParams) {
  return useQuery({
    queryKey: questionKeys.list(params),
    queryFn: () => questionApi.getQuestions(params),
    placeholderData: keepPreviousData,
  })
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

// Daily and total submission counters for the signed-in public user.
export function useMyQuestionStats(enabled = true) {
  return useQuery({
    queryKey: questionKeys.myStats(),
    queryFn: () => questionApi.getMyStats(),
    enabled,
    staleTime: 0,
  })
}

// Anveshan progress milestone for the signed-in user.
export function useMyAnveshanMilestone(enabled = true) {
  return useQuery({
    queryKey: questionKeys.anveshanMilestone(),
    queryFn: () => questionApi.getMyAnveshanMilestone(),
    enabled,
  })
}

// Questions the Anveshan user still has to answer.
export function useMyAnveshanAnswerQuestions(enabled = true) {
  return useQuery({
    queryKey: questionKeys.anveshanAnswerQuestions(),
    queryFn: () => questionApi.getMyAnveshanAnswerQuestions(),
    enabled,
  })
}

// Staff view of the answer an Anveshan user submitted for a question.
export function useAnveshanAnswer(questionId: string | null) {
  return useQuery({
    queryKey: questionKeys.anveshanAnswer(questionId),
    queryFn: () => questionApi.getAnveshanAnswer(questionId as string),
    enabled: !!questionId,
  })
}

// ── Mutations ──────────────────────────────────────────────────────────────

// Runs duplicate detection before a question is finally submitted.
export function usePreviewQuestion() {
  return useMutation({ mutationFn: questionApi.preview })
}

export function useSubmitQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: questionApi.submitQuestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useAttachQuestionAudio() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { questionId: string; audioUrls: string[] }) =>
      questionApi.attachAudio(vars.questionId, vars.audioUrls),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useSubmitAnveshanAnswer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { questionId: string; body: Parameters<typeof questionApi.submitAnveshanAnswer>[1] }) =>
      questionApi.submitAnveshanAnswer(vars.questionId, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useApproveQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: questionApi.approveQuestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}

export function useRejectQuestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; reason?: string }) => questionApi.rejectQuestion(vars.id, vars.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  })
}
