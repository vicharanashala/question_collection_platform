import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { faqApi } from '@/client/client'

export const faqKeys = {
  all: ['faqs'] as const,
  visible: (filters: VisibleFilters) => [...faqKeys.all, 'visible', filters ?? {}] as const,
  list: (filters: AllFilters) => [...faqKeys.all, 'list', filters ?? {}] as const,
  stats: (category?: string) => [...faqKeys.all, 'stats', category ?? null] as const,
}

type VisibleFilters = Parameters<typeof faqApi.getVisible>[0]
type AllFilters = Parameters<typeof faqApi.getAll>[0]

// FAQs visible to the current audience (public side).
export function useVisibleFaqs(filters?: VisibleFilters) {
  return useQuery({
    queryKey: faqKeys.visible(filters),
    queryFn: () => faqApi.getVisible(filters),
  })
}

// Full FAQ list for admin management, including hidden entries.
export function useAllFaqs(filters?: AllFilters) {
  return useQuery({
    queryKey: faqKeys.list(filters),
    queryFn: () => faqApi.getAll(filters),
    placeholderData: keepPreviousData,
  })
}

export function useCreateFaq() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: faqApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.all }),
  })
}

export function useUpdateFaq() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; body: Parameters<typeof faqApi.update>[1] }) => faqApi.update(vars.id, vars.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.all }),
  })
}

export function useToggleFaqVisibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; isVisible: boolean }) => faqApi.toggleVisibility(vars.id, vars.isVisible),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.all }),
  })
}

export function useReorderFaqs() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: faqApi.reorder,
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.all }),
  })
}

export function useDeleteFaq() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: faqApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.all }),
  })
}

/** Total / visible / hidden counts for the admin FAQ header. */
export function useFaqStats(category?: string) {
  return useQuery({
    queryKey: faqKeys.stats(category),
    queryFn: () => faqApi.getStats(category),
  })
}
