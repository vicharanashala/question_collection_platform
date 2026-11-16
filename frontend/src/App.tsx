import { PrefetchProvider } from '@/stores/PrefetchContext'
import { LockedAccountModal } from '@/components/LockedAccountModal'
import { AppRoutes } from '@/routes'

/**
 * Outer shell — provides PrefetchContext to all routes. The route tree
 * itself lives in routes/ (routes/index.tsx + routes/guards.tsx).
 */
export default function App() {
  return (
    <PrefetchProvider>
      {/* Locked account modal rendered outside the protected layout so it
          survives navigation to /login after a 423 lock response. */}
      <LockedAccountModal />
      <AppRoutes />
    </PrefetchProvider>
  )
}
