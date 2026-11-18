import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubmissionsPagination } from '@/components/submissions/SubmissionsPagination'

describe('SubmissionsPagination', () => {
  it('shows the range and page count', () => {
    render(<SubmissionsPagination page={2} limit={10} total={25} onPageChange={vi.fn()} />)

    expect(screen.getByText('Showing 11-20 of 25')).toBeInTheDocument()
    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument()
  })

  it('moves between pages and disables the ends', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(<SubmissionsPagination page={1} limit={10} total={25} onPageChange={onPageChange} />)
    const [prev, next] = screen.getAllByRole('button')

    expect(prev).toBeDisabled()
    await user.click(next)

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('treats an empty list as a single page', () => {
    render(<SubmissionsPagination page={1} limit={10} total={0} onPageChange={vi.fn()} />)

    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument()
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled())
  })
})
