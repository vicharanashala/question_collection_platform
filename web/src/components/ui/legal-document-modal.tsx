import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { TERMS_SECTIONS, PRIVACY_POLICY_SECTIONS } from '@/constants/legal'

interface LegalDocumentModalProps {
  type: 'terms' | 'privacy'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LegalDocumentModal({ type, open, onOpenChange }: LegalDocumentModalProps) {
  const [openId, setOpenId] = useState<string | null>('1')
  const sections = type === 'terms' ? TERMS_SECTIONS : PRIVACY_POLICY_SECTIONS
  const title = type === 'terms' ? 'Terms of Service' : 'Privacy Policy'
  const Icon = type === 'terms' ? FileText : ShieldCheck

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col p-0">
        {/* Header */}
        <div className="border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">
                {sections.length} sections · June 2026
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable accordion */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-1.5">
            {sections.map(({ id, title: sectionTitle, body }) => {
              const isOpen = openId === id
              return (
                <div key={id} className="rounded-lg border border-border-subtle overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : id)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-surface-variant/40"
                  >
                    <span className="flex flex-1 items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        {id}
                      </span>
                      <span className="text-sm font-medium text-foreground">{sectionTitle}</span>
                    </span>
                    {isOpen
                      ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    }
                  </button>
                  {isOpen && (
                    <div className="border-t border-border-subtle px-3 py-2.5">
                      <p className="text-xs leading-relaxed text-muted-foreground">{body}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}