import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/client/client'

export const reportKeys = {
  all: ['reports'] as const,
  list: (params: ListParams) => [...reportKeys.all, 'list', params ?? {}] as const,
  myList: (params: MyListParams) => [...reportKeys.all, 'mine', params ?? {}] as const,
  detail: (id: string | null) => [...reportKeys.all, 'detail', id] as const,
  myDetail: (id: string | null) => [...reportKeys.all, 'mineDetail', id] as const,
}

type ListParams = Parameters<typeof reportsApi.list>[0]
type MyListParams = Parameters<typeof reportsApi.listMy>[0]

// Staff list of all reports.
export function useReports(params?: ListParams) {
  return useQuery({
    queryKey: reportKeys.list(params),
    queryFn: () => reportsApi.list(params),
    placeholderData: keepPreviousData,
  })
}

// The signed-in user's own reports.
export function useMyReports(params?: MyListParams) {
  return useQuery({
    queryKey: reportKeys.myList(params),
    queryFn: () => reportsApi.listMy(params),
    placeholderData: keepPreviousData,
  })
}

export function useReport(reportId: string | null) {
  return useQuery({
    queryKey: reportKeys.detail(reportId),
    queryFn: () => reportsApi.get(reportId as string),
    enabled: !!reportId,
  })
}

// A report the signed-in user filed (public-side detail view).
export function useMyReport(reportId: string | null) {
  return useQuery({
    queryKey: reportKeys.myDetail(reportId),
    queryFn: () => reportsApi.getMy(reportId as string),
    enabled: !!reportId,
  })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: reportsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}

export function useUpdateReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { reportId: string; status: string }) => reportsApi.updateStatus(vars.reportId, vars.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}

export function useUpdateReportPriority() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { reportId: string; priority: string }) =>
      reportsApi.updatePriority(vars.reportId, vars.priority),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}

export function useAddReportReply() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { reportId: string; message: string }) => reportsApi.addReply(vars.reportId, vars.message),
    onSuccess: () => qc.invalidateQueries({ queryKey: reportKeys.all }),
  })
}
