import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

// Query client without retries or caching between tests, so failures surface immediately.
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
  routeState?: unknown
  queryClient?: QueryClient
}

/** Prints the current path so tests can assert where a redirect landed. */
export function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

// Renders UI inside a memory router and React Query provider, with a catch-all route that reports redirects.
export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { route = '/', routeState, queryClient = createTestQueryClient(), ...renderOptions } = options
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: route, state: routeState }]}>
        <Routes>
          <Route path={route} element={children} />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) }
}
