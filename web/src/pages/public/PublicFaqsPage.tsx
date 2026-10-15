import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronDown, HelpCircle, HelpingHand, RefreshCcw, Search, X } from 'lucide-react'
import { faqApi } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { VideoSection } from '@/components/VideoSection'
import { cn } from '@/lib/utils'
import type { Faq } from '@/types'

const CATEGORIES = [
  { key: 'all', labelKey: 'wallet.filterAll', color: '#6366F1' },
  { key: 'account', labelKey: 'faqCategory.account', color: '#4A90D9' },
  { key: 'payment', labelKey: 'faqCategory.payment', color: '#27AE60' },
  { key: 'question', labelKey: 'faqCategory.question', color: '#E67E22' },
  { key: 'general', labelKey: 'faqCategory.general', color: '#8E44AD' },
]

interface FaqItemProps {
  item: Faq
  open: boolean
  onToggle: () => void
}

// Renders one expandable question with an animated, keyboard accessible answer.
function FaqItem({ item, open, onToggle }: FaqItemProps) {
  const cat = CATEGORIES.find((c) => c.key === item.category) ?? CATEGORIES[4]
  const panelId = `faq-panel-${item.id}`

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        open ? 'border-primary/40 shadow-sm' : 'border-border-subtle',
      )}
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[3.25rem] w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-variant/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: cat.color }}
          />
          <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-foreground">
            {item.question}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <p className="whitespace-pre-wrap break-words px-4 pb-4 pl-9 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </p>
        </div>
      </div>
    </div>
  )
}

export function PublicFaqsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // Loads the visible FAQs for the active category and ignores stale responses.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setOpenId(null)
    faqApi
      .getVisible({ category: activeCat === 'all' ? undefined : activeCat })
      .then((data) => { if (!cancelled) setItems(data) })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [activeCat, reloadKey])

  const visibleItems = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (f) => f.question.toLowerCase().includes(term) || f.answer.toLowerCase().includes(term),
    )
  }, [items, query])

  const isSearching = query.trim().length > 0

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate(-1)}
        className="rounded-full"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('faq.backToProfile', { defaultValue: 'Back to profile' })}
      </Button>

      <header className="flex flex-col items-center py-1 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 sm:h-[72px] sm:w-[72px]">
          <HelpingHand className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">{t('faq.title')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('faq.subtitle')}</p>
      </header>

      <VideoSection />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <Input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('faq.searchPlaceholder', { defaultValue: 'Search questions' })}
          aria-label={t('faq.searchPlaceholder', { defaultValue: 'Search questions' })}
          className="h-11 rounded-full pl-9 pr-10 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('faq.clearSearch', { defaultValue: 'Clear search' })}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-variant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label={t('faq.categories', { defaultValue: 'Categories' })}
        className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.key
          return (
            <button
              key={cat.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveCat(cat.key)}
              className={cn(
                'flex min-h-9 shrink-0 items-center rounded-full px-4 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'text-white shadow-sm'
                  : 'border border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
              style={isActive ? { backgroundColor: cat.color } : undefined}
            >
              {t(cat.labelKey)}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[3.25rem] animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      ) : failed ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
            <p role="alert" className="text-sm font-medium text-muted-foreground">{t('faq.loadError')}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('faq.retry', { defaultValue: 'Try again' })}
            </Button>
          </CardContent>
        </Card>
      ) : visibleItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="mb-3 h-12 w-12 text-muted-foreground/30" aria-hidden="true" />
            <p className="text-sm font-medium text-muted-foreground">
              {isSearching
                ? t('faq.noResultsTitle', { defaultValue: 'No matching questions' })
                : t('faq.emptyTitle')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSearching
                ? t('faq.noResultsSubtitle', { defaultValue: 'Try different words or clear the search' })
                : t('faq.emptySubtitle')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
            {visibleItems.length} {t('faq.group.article', { count: visibleItems.length })}
          </p>
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <FaqItem
                key={item.id}
                item={item}
                open={openId === item.id}
                onToggle={() => setOpenId((cur) => (cur === item.id ? null : item.id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
