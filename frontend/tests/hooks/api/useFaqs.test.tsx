import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { faqKeys, useCreateFaq, useDeleteFaq, useToggleFaqVisibility, useVisibleFaqs } from '@/hooks/api/useFaqs'
import { createTestQueryClient } from '../../utils/render'

const faqApi = vi.hoisted(() => ({
  getVisible: vi.fn(),
  getAll: vi.fn(),
  getStats: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  toggleVisibility: vi.fn(),
  reorder: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('@/client/client', () => ({ faqApi }))

describe('useFaqs hooks', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>

  beforeEach(() => {
    queryClient = createTestQueryClient()
  })

  it('builds stable, filter-specific query keys', () => {
    expect(faqKeys.visible({ category: 'payment' })).toEqual(['faqs', 'visible', { category: 'payment' }])
    expect(faqKeys.visible(undefined)).toEqual(['faqs', 'visible', {}])
    expect(faqKeys.stats()).toEqual(['faqs', 'stats', null])
  })

  it('loads visible FAQs with the given filters', async () => {
    faqApi.getVisible.mockResolvedValue({ items: [{ id: 'f1' }] })

    const { result } = renderHook(() => useVisibleFaqs({ category: 'payment' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual({ items: [{ id: 'f1' }] })
    expect(faqApi.getVisible).toHaveBeenCalledWith({ category: 'payment' })
  })

  it('exposes API errors to the UI', async () => {
    faqApi.getVisible.mockRejectedValue(new Error('Network down'))

    const { result } = renderHook(() => useVisibleFaqs(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Network down')
  })

  it('refreshes every FAQ query after creating one', async () => {
    faqApi.create.mockResolvedValue({ id: 'f2' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCreateFaq(), { wrapper })

    await act(() => result.current.mutateAsync({ question: 'Q', answer: 'A' }))

    expect(faqApi.create).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['faqs'] })
  })

  it('refreshes every FAQ query after deleting one', async () => {
    faqApi.remove.mockResolvedValue(undefined)
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteFaq(), { wrapper })

    await act(() => result.current.mutateAsync('f1'))

    expect(faqApi.remove).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['faqs'] })
  })

  it('passes id and visibility through when toggling', async () => {
    faqApi.toggleVisibility.mockResolvedValue({})
    const { result } = renderHook(() => useToggleFaqVisibility(), { wrapper })

    await act(() => result.current.mutateAsync({ id: 'f1', isVisible: false }))

    expect(faqApi.toggleVisibility).toHaveBeenCalledWith('f1', false)
  })

  it('does not refresh queries when a mutation fails', async () => {
    faqApi.remove.mockRejectedValue(new Error('Forbidden'))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useDeleteFaq(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('f1')).rejects.toThrow('Forbidden')
    })

    expect(invalidate).not.toHaveBeenCalled()
  })
})
