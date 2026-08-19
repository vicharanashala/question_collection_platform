import { useState } from 'react'
import { DistributionsList } from './DistributionsList'
import { ApprovedQueue } from './ApprovedQueue'
import { Send, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { isDistributor } from '@/lib/roles'

/**
 * Distributor landing page.
 * Tabs:
 *   - Distributions : browse & manage final_questions rows
 *   - Approved Queue (distributor-only) : review approved questions and assign states
 *
 * The "Approved Queue" tab/flow is restricted to the `distributor` role.
 * Curators / admins / super_admins can still browse the read-only
 * Distributions tab for monitoring, but cannot perform the
 * promote-to-final action.
 */
export function DistributionsPage() {
  const { user } = useAuth()
  const canAssign = isDistributor(user)

  // Distributors default to the queue; non-distributors land on the list
  // since they cannot perform the assign action.
  const [tab, setTab] = useState<'queue' | 'distributions'>(
    () => (canAssign ? 'queue' : 'distributions'),
  )
  // Non-distributors are always forced onto the read-only Distributions view,
  // regardless of any stale `tab` value.
  const effectiveTab: 'queue' | 'distributions' = canAssign ? tab : 'distributions'

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg sm:text-lg sm:text-xl font-semibold">Distributions</h1>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
            Distribute approved questions to one or more Indian states.
          </p>
        </div>
      </header>

      <div className="border-b border-border px-6 flex gap-1">
        <button
          onClick={() => setTab('distributions')}
          className={`px-4 py-2 text-xs sm:text-xs sm:text-sm font-medium border-b-2 transition-colors ${
            effectiveTab === 'distributions'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Send className="inline h-4 w-4 mr-1.5 -mt-0.5" />
          Distributions
        </button>
        {canAssign && (
          <button
            onClick={() => setTab('queue')}
            className={`px-4 py-2 text-xs sm:text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              effectiveTab === 'queue'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            Approved Queue
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {effectiveTab === 'distributions' ? <DistributionsList /> : <ApprovedQueue />}
      </div>
    </div>
  )
}

export default DistributionsPage