import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SubmissionStatusFilter } from '@/components/submissions/SubmissionStatusFilter'

const OPTIONS = [
  { key: '' as const, label: 'All' },
  { key: 'pending' as const, label: 'Pending' },
  { key: 'approved' as const, label: 'Approved' },
]

describe('SubmissionStatusFilter', () => {
  // The pill row is the larger-screen variant; the dropdown is covered by Radix's own tests.
  const pills = () => within(screen.getByRole('button', { name: 'All' }).parentElement as HTMLElement)

  it('renders a pill per status and highlights the selected one', () => {
    render(<SubmissionStatusFilter options={OPTIONS} value="pending" onChange={vi.fn()} />)

    expect(pills().getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Pending', 'Approved'])
    expect(pills().getByRole('button', { name: 'Pending' })).toHaveClass('bg-primary')
    expect(pills().getByRole('button', { name: 'Approved' })).not.toHaveClass('bg-primary')
  })

  it('reports the chosen status, using the empty key for "All"', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SubmissionStatusFilter options={OPTIONS} value="pending" onChange={onChange} />)

    await user.click(pills().getByRole('button', { name: 'Approved' }))
    await user.click(pills().getByRole('button', { name: 'All' }))

    expect(onChange.mock.calls).toEqual([['approved'], ['']])
  })
})
