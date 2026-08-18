/**
 * Public Terms of Service page — mirrors
 * mobile/src/screens/Auth/TermsOfServiceScreen.tsx
 *
 * Standalone, linked from the Profile page's Actions list. Reuses the same
 * accordion content shown during registration consent (`@/constants/legal`)
 * so the two surfaces never drift apart.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { TERMS_SECTIONS } from '@/constants/legal'

export function PublicTermsPage() {
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<string | null>('1')

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-4">
      <Button variant="outline" size="sm" onClick={() => navigate('/home/profile')} className="rounded-full">
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Button>

      {/* Hero */}
      <div className="flex flex-col items-center py-2 text-center">
        <div className="mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <FileText className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground">Terms of Service</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Last updated: June 2026 · {TERMS_SECTIONS.length} sections
        </p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-1.5">
        {TERMS_SECTIONS.map(({ id, title, body }) => {
          const isOpen = openId === id
          return (
            <Card key={id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-variant/40"
              >
                <span className="flex flex-1 items-center gap-3">
                  <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                    {id}
                  </span>
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-text-tertiary" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
                )}
              </button>
              {isOpen && (
                <CardContent className="border-t border-border-subtle px-4 py-3">
                  <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      <p className="pt-2 text-center text-xs text-text-tertiary">
        AnnaDatha — Made for Indian farmers
      </p>
    </div>
  )
}

export default PublicTermsPage
