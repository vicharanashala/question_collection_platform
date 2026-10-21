import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { faqApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChevronDown, ChevronUp, HelpCircle, ArrowLeft, Search, X, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Faq } from '@/types'
// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all', label: 'All', color: '#6366F1' },
  { key: 'account', label: 'Account', color: '#4A90D9' },
  { key: 'payment', label: 'Payments', color: '#27AE60' },
  { key: 'question', label: 'Questions', color: '#E67E22' },
  { key: 'general', label: 'General', color: '#8E44AD' },
]

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ item }: { item: Faq }) {
  const [open, setOpen] = useState(false)
  const catMeta = CATEGORIES.find((c) => c.key === item.category) ?? CATEGORIES[4]

  return (
    <div className="border-b border-border-subtle last:border-0">
      <button
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-variant/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {/* Category colour dot */}
        <div
          className="w-2 h-2 rounded-full mt-2 shrink-0"
          style={{ backgroundColor: catMeta.color }}
        />

        {/* Question */}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs sm:text-xs sm:text-sm font-semibold text-foreground leading-snug">
              {item.question}
            </span>
            <span className="shrink-0 mt-0.5 text-muted-foreground">
              {open
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </span>
          </div>

          {open && (
            <p className="mt-2.5 text-xs sm:text-xs sm:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {item.answer}
            </p>
          )}
        </div>
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FaqListPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState(false)
  const debouncedSearch = useDebouncedValue(search.trim(), 400)
  const [reloadKey, setReloadKey] = useState(0)

  // Loads FAQs for the active filters and ignores responses from outdated requests.
  const loadFaqs = useCallback((signal: { cancelled: boolean }) => {
    setLoading(true)
    setError(false)
    faqApi.getVisible({
      category: activeCat === 'all' ? undefined : activeCat,
      search: debouncedSearch || undefined,
    })
      .then((data) => { if (!signal.cancelled) setItems(data) })
      .catch((e) => {
        if (signal.cancelled) return
        setError(true)
        toast.error(getErrorMessage(e, 'Failed to load FAQs'))
      })
      .finally(() => { if (!signal.cancelled) setLoading(false) })
  }, [activeCat, debouncedSearch])

  useEffect(() => {
    const signal = { cancelled: false }
    loadFaqs(signal)
    return () => { signal.cancelled = true }
  }, [loadFaqs, reloadKey])

  const hasFilters = activeCat !== 'all' || debouncedSearch !== ''

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-lg sm:text-lg sm:text-xl font-bold text-foreground">Help & FAQ</h2>
          <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground mt-0.5">
            Find answers to common questions
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions or answers"
          aria-label="Search FAQs"
          className="h-10 pl-9 pr-9 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'bg-surface border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
              }`}
              style={isActive ? { backgroundColor: cat.color } : {}}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-14 bg-muted/30 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
              We could not load the FAQs
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-2"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-xs sm:text-xs sm:text-sm font-medium text-muted-foreground">
              {hasFilters ? 'No FAQs match your search' : 'No FAQs available yet'}
            </p>
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground mt-1">
              {hasFilters ? 'Try different words or another category' : 'Check back later for help content'}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { setSearch(''); setActiveCat('all') }}
              >
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Results count */}
          <div className="flex items-center justify-between px-1">
            <p className="text-[11px] sm:text-[11px] sm:text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? 'article' : 'articles'}
            </p>
          </div>

          <Card>
            <CardContent className="p-0">
              {items.map((item) => (
                <FaqItem key={item.id} item={item} />
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}