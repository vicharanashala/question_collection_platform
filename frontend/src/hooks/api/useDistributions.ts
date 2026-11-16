import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { distributor } from '@/client/client'
import { questionKeys } from './useQuestions'

export const distributionKeys = {
  all: ['distributions'] as const,
  indianStates: () => [...distributionKeys.all, 'indianStates'] as const,
  approvedQueue: (params: ApprovedParams) => [...distributionKeys.all, 'approvedQueue', params ?? {}] as const,
  approvedQuestion: (id: string | null) => [...distributionKeys.all, 'approvedQuestion', id] as const,
  list: (params: ListParams) => [...distributionKeys.all, 'list', params ?? {}] as const,
  forQuestion: (questionId: string | null) => [...distributionKeys.all, 'forQuestion', questionId] as const,
}

type ApprovedParams = Parameters<typeof distributor.listApprovedQuestions>[0]
type ListParams = Parameters<typeof distributor.listDistributions>[0]

// The fixed list of Indian states a question can be distributed to.
export function useIndianStates(enabled = true) {
  return useQuery({
    queryKey: distributionKeys.indianStates(),
    queryFn: () => distributor.listIndianStates(),
    enabled,
    staleTime: Infinity,
  })
}

export function useApprovedQuestions(params?: ApprovedParams) {
  return useQuery({
    queryKey: distributionKeys.approvedQueue(params),
    queryFn: () => distributor.listApprovedQuestions(params),
    placeholderData: keepPreviousData,
  })
}

export function useApprovedQuestion(id: string | null) {
  return useQuery({
    queryKey: distributionKeys.approvedQuestion(id),
    queryFn: () => distributor.getApprovedQuestion(id as string),
    enabled: !!id,
  })
}

export function useDistributions(params?: ListParams) {
  return useQuery({
    queryKey: distributionKeys.list(params),
    queryFn: () => distributor.listDistributions(params),
    placeholderData: keepPreviousData,
  })
}

export function useDistributionsForQuestion(questionId: string | null) {
  return useQuery({
    queryKey: distributionKeys.forQuestion(questionId),
    queryFn: () => distributor.getDistributionsForQuestion(questionId as string),
    enabled: !!questionId,
  })
}

// Distributing flips the source question's status, so question caches refresh too.
export function useAssignStates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { questionId: string; payload: Parameters<typeof distributor.assignStates>[1] }) =>
      distributor.assignStates(vars.questionId, vars.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: distributionKeys.all })
      qc.invalidateQueries({ queryKey: questionKeys.all })
    },
  })
}
