import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable, type ColumnDef } from '@/components/DataTable'

interface Farmer {
  id: string
  name: string
  state: string
  questions: number
}

const ROWS: Farmer[] = [
  { id: '1', name: 'Bhavna', state: 'Kerala', questions: 12 },
  { id: '2', name: 'Arjun', state: 'Punjab', questions: 30 },
  { id: '3', name: 'Chitra', state: 'Kerala', questions: 5 },
]

const COLUMNS: ColumnDef<Farmer>[] = [
  { key: 'name', header: 'Name', sortable: true, render: (r) => r.name },
  { key: 'state', header: 'State', render: (r) => r.state },
  { key: 'questions', header: 'Questions', sortable: true, render: (r) => String(r.questions) },
]

type Props = Partial<Parameters<typeof DataTable<Farmer>>[0]>

// Renders the table with sensible defaults and returns the handler mocks.
function setup(props: Props = {}) {
  const handlers = { onPageChange: vi.fn(), onSearchChange: vi.fn(), onRowClick: vi.fn() }
  render(<DataTable<Farmer> data={ROWS} columns={COLUMNS} page={1} totalPages={1} totalCount={ROWS.length} {...handlers} {...props} />)
  return handlers
}

// Names in the order they are rendered.
const renderedNames = () => screen.getAllByText(/^(Arjun|Bhavna|Chitra)$/).map((el) => el.textContent)

describe('DataTable', () => {
  it('renders a header and one row per record', () => {
    setup()

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(renderedNames()).toEqual(['Bhavna', 'Arjun', 'Chitra'])
  })

  it('shows the empty message when there is no data', () => {
    setup({ data: [], totalCount: 0, emptyMessage: 'No farmers yet' })

    expect(screen.getByText('No farmers yet')).toBeInTheDocument()
  })

  it('shows skeleton rows instead of data while loading', () => {
    setup({ loading: true })

    expect(screen.queryByText('Bhavna')).not.toBeInTheDocument()
  })

  it('sorts ascending, then descending, on a sortable header', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByText('Name'))
    expect(renderedNames()).toEqual(['Arjun', 'Bhavna', 'Chitra'])

    await user.click(screen.getByText('Name'))
    expect(renderedNames()).toEqual(['Chitra', 'Bhavna', 'Arjun'])
  })

  it('sorts numbers numerically', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByText('Questions'))

    expect(renderedNames()).toEqual(['Chitra', 'Bhavna', 'Arjun'])
  })

  it('ignores clicks on non-sortable headers', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByText('State'))

    expect(renderedNames()).toEqual(['Bhavna', 'Arjun', 'Chitra'])
  })

  it('reports row clicks with the row', async () => {
    const user = userEvent.setup()
    const { onRowClick } = setup()

    await user.click(screen.getByText('Arjun'))

    expect(onRowClick).toHaveBeenCalledWith(ROWS[1])
  })

  it('forwards search input', async () => {
    const user = userEvent.setup()
    const { onSearchChange } = setup()

    await user.type(screen.getByPlaceholderText('Search records...'), 'k')

    expect(onSearchChange).toHaveBeenCalledWith('k')
  })

  it('hides the search box when asked', () => {
    setup({ hideSearch: true })

    expect(screen.queryByPlaceholderText('Search records...')).not.toBeInTheDocument()
  })

  it('hides pagination for a single page', () => {
    setup()

    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument()
  })

  it('pages forwards and backwards within bounds', async () => {
    const user = userEvent.setup()
    const { onPageChange } = setup({ page: 2, totalPages: 3, totalCount: 9 })
    const pager = screen.getByText('2 / 3').parentElement as HTMLElement
    const [prev, next] = Array.from(pager.querySelectorAll('button'))

    await user.click(prev)
    await user.click(next)

    expect(onPageChange.mock.calls).toEqual([[1], [3]])
  })

  it('disables previous on the first page and next on the last', () => {
    setup({ page: 1, totalPages: 2, totalCount: 6 })
    const [prev, next] = Array.from((screen.getByText('1 / 2').parentElement as HTMLElement).querySelectorAll('button'))

    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()
  })
})
