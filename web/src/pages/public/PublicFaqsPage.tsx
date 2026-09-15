import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { faqApi, getErrorMessage } from '@/api/client'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Faq } from '@/types'
import { VideoSection } from '@/components/VideoSection'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { key: 'all', labelKey: 'wallet.filterAll', color: '#6366F1' },
  { key: 'account', labelKey: 'faqCategory.account', color: '#4A90D9' },
  { key: 'payment', labelKey: 'faqCategory.payment', color: '#27AE60' },
  { key: 'question', labelKey: 'faqCategory.question', color: '#E67E22' },
  { key: 'general', labelKey: 'faqCategory.general', color: '#8E44AD' },
]

function FaqItem({ item }: { item: Faq }) {
  const [open, setOpen] = useState(false)
  const cat = CATEGORIES.find((c) => c.key === item.category) ?? CATEGORIES[4]
  return (
    <div className="border-b border-border-subtle last:border-0">
      <button className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-emerald-50/30 transition-colors dark:hover:bg-emerald-950/20" onClick={() => setOpen((o) => !o)}>
        <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ backgroundColor: cat.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground leading-snug">{item.question}</span>
            <span className="shrink-0 mt-0.5 text-muted-foreground">
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </div>
          {open && <p className="mt-2.5 text-xs sm:text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.answer}</p>}
        </div>
      </button>
    </div>
  )
}

export function PublicFaqsPage() {
  const { t } = useTranslation()
  const [items, setItems] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('all')

  async function load(category?: string) {
    setLoading(true)
    try {
      const data = await faqApi.getVisible({ category })
      setItems(data)
    } catch (e) {
      toast.error(getErrorMessage(e, t('faq.loadError')))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { load(activeCat === 'all' ? undefined : activeCat) }, [activeCat])

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-lg sm:text-lg sm:text-xl font-bold text-foreground">{t('faq.title')}</h2>
        <p className="text-xs sm:text-xs sm:text-sm text-text-secondary mt-0.5">{t('faq.subtitle')}</p>
      </div>
      <VideoSection />
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.key
          return (
            <button key={cat.key} onClick={() => setActiveCat(cat.key)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all',
              isActive ? 'text-white shadow-sm' : 'bg-surface border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}
              style={isActive ? { backgroundColor: cat.color } : {}}>
              {t(cat.labelKey)}
            </button>
          )
        })}
      </div>
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Card key={i} className="animate-pulse"><CardContent className="h-14 bg-muted/30 rounded-lg" /></Card>)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">{t('faq.emptyTitle')}</p>
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">{t('faq.emptySubtitle')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">{items.length} {t('faq.group.article', { count: items.length })}</p>
          </div>
          <Card><CardContent className="p-0">{items.map((item) => <FaqItem key={item.id} item={item} />)}</CardContent></Card>
        </>
      )}
    </div>
  )
}