import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/features/distributions/Pagination'

// Renders the footer with handlers and returns them alongside the four navigation buttons.
function setup(props: Partial<Parameters<typeof Pagination>[0]> = {}) {
  const onPage = vi.fn()
  const onLimit = vi.fn()
  render(<Pagination page={2} pages={5} total={95} limit={20} onPage={onPage} onLimit={onLimit} {...props} />)
  // The page size select is a combobox, so these are the four navigation buttons in order.
  const [first, prev, next, last] = screen.getAllByRole('button')
  return { onPage, onLimit, first, prev, next, last }
}

describe('Pagination', () => {
  it('shows the visible range and current page', () => {
    setup()

    expect(screen.getByText('Showing 21–40 of 95')).toBeInTheDocument()
    expect(screen.getByText('Page 2/ 5')).toBeInTheDocument()
  })

  it('clamps the range on the last page', () => {
    setup({ page: 5 })

    expect(screen.getByText('Showing 81–95 of 95')).toBeInTheDocument()
  })

  it('shows 0–0 for an empty list and never page 0', () => {
    setup({ page: 1, pages: 0, total: 0 })

    expect(screen.getByText('Showing 0–0 of 0')).toBeInTheDocument()
    expect(screen.getByText('Page 1/ 1')).toBeInTheDocument()
  })

  it('navigates to first, previous, next and last pages', async () => {
    const user = userEvent.setup()
    const { onPage, first, prev, next, last } = setup({ page: 3 })

    await user.click(first)
    await user.click(prev)
    await user.click(next)
    await user.click(last)

    expect(onPage.mock.calls).toEqual([[1], [2], [4], [5]])
  })

  it('disables backwards navigation on the first page and forwards on the last', () => {
    const firstPage = setup({ page: 1 })
    expect(firstPage.first).toBeDisabled()
    expect(firstPage.prev).toBeDisabled()
    expect(firstPage.next).toBeEnabled()
  })

  it('disables forwards navigation on the last page', () => {
    const lastPage = setup({ page: 5 })
    expect(lastPage.next).toBeDisabled()
    expect(lastPage.last).toBeDisabled()
    expect(lastPage.prev).toBeEnabled()
  })
})
