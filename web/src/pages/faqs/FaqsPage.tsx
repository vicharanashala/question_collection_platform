import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { faqApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Plus, Pencil, Trash2, Eye, EyeOff, HelpCircle, Loader2,
  ChevronUp, ChevronDown, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight,
  X, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Faq, FaqCategory, PaginatedResponse } from '@/types'
import { VideoSection } from '@/components/VideoSection'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortBy = 'displayOrder' | 'createdAt' | 'updatedAt' | 'question'
type SortOrder = 'ASC' | 'DESC'

interface FormState {
  question: string
  answer: string
  category: FaqCategory
  isVisible: boolean
}

interface Stats { total: number; visible: number; hidden: number }

const EMPTY: FormState = { question: '', answer: '', category: 'general', isVisible: true }

const PAGE_SIZES = [10, 20, 50, 100]

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all',     label: 'All',     color: '#6366F1' },
  { key: 'account', label: 'Account', color: '#4A90D9' },
  { key: 'payment', label: 'Payments', color: '#27AE60' },
  { key: 'question', label: 'Questions', color: '#E67E22' },
  { key: 'general', label: 'General', color: '#8E44AD' },
]

function getCatMeta(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[4]
}

// ─── FAQ row ──────────────────────────────────────────────────────────────────

function FaqRow({
  faq,
  onEdit,
  onDelete,
  onToggle,
  toggling,
}: {
  faq: Faq
  onEdit: (f: Faq) => void
  onDelete: (f: Faq) => void
  onToggle: (f: Faq) => void
  toggling: string | null
}) {
  const [open, setOpen] = useState(false)
  const catMeta = getCatMeta(faq.category)

  return (
    <div className="border-b border-border-subtle last:border-0">
      <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-variant/30 transition-colors">
        <div
          className="w-2 h-2 rounded-full mt-2.5 shrink-0"
          style={{ backgroundColor: catMeta.color }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button className="flex-1 text-left" onClick={() => setOpen((o) => !o)}>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {faq.question}
                </p>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{
                    backgroundColor: catMeta.color + '18',
                    color: catMeta.color,
                    border: `1px solid ${catMeta.color}30`,
                  }}
                >
                  {catMeta.label}
                </span>
              </div>
              {open && (
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                  {faq.answer}
                </p>
              )}
            </button>
            <button
              className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
              onClick={() => setOpen((o) => !o)}
            >
              {open
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />
              }
            </button>
          </div>
        </div>

        <Badge
          variant={faq.isVisible ? 'default' : 'secondary'}
          className="shrink-0 text-xs mt-0.5"
          style={
            faq.isVisible
              ? {
                  backgroundColor: catMeta.color + '18',
                  color: catMeta.color,
                  borderColor: catMeta.color + '30',
                }
              : {}
          }
        >
          {faq.isVisible
            ? <Eye className="h-3 w-3 mr-1" />
            : <EyeOff className="h-3 w-3 mr-1" />
          }
          {faq.isVisible ? 'Visible' : 'Hidden'}
        </Badge>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onToggle(faq)} disabled={!!toggling}
            title={faq.isVisible ? 'Hide' : 'Show'}
          >
            {toggling === faq.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : faq.isVisible
                ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                : <Eye className="h-3.5 w-3.5" style={{ color: catMeta.color }} />
            }
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onEdit(faq)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(faq)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function PaginationControls({
  page,
  pages,
  total,
  limit,
  onPage,
  onLimit,
}: {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (p: number) => void
  onLimit: (l: number) => void
}) {
  if (pages <= 1 && total <= limit) return null

  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {start}–{end} of {total}
        </span>
        <span className="text-border">|</span>
        <div className="flex items-center gap-1">
          <span>Rows:</span>
          <Select
            value={String(limit)}
            onValueChange={(v) => onLimit(Number(v))}
          >
            <SelectTrigger className="h-7 w-16 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onPage(1)} disabled={page <= 1}
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onPage(page - 1)} disabled={page <= 1}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        {/* Page number pills — show up to 5 nearby pages */}
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          let p: number
          if (pages <= 5) {
            p = i + 1
          } else if (page <= 3) {
            p = i + 1
          } else if (page >= pages - 2) {
            p = pages - 4 + i
          } else {
            p = page - 2 + i
          }
          return (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className="h-7 w-7 text-xs"
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          )
        })}

        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onPage(page + 1)} disabled={page >= pages}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onPage(pages)} disabled={page >= pages}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Add/Edit dialog ──────────────────────────────────────────────────────────

function FaqDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean
  initial: Faq | null
  onClose: () => void
  onSave: (data: FormState) => Promise<void>
}) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<FormState>>({})

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? {
              question: initial.question,
              answer: initial.answer,
              category: initial.category ?? 'general',
              isVisible: initial.isVisible,
            }
          : EMPTY,
      )
      setErrors({})
    }
  }, [open, initial])

  function validate(): boolean {
    const e: Partial<FormState> = {}
    if (!form.question.trim()) e.question = 'Question is required'
    if (!form.answer.trim()) e.answer = 'Answer is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setSaving(true)
    try { await onSave(form); onClose() }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          <DialogDescription>
            {initial ? 'Update the question and answer below.' : 'Fill in the question and answer below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="faq-question">Question <span className="text-destructive">*</span></Label>
            <Input
              id="faq-question"
              placeholder="e.g. How do I submit a question?"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              aria-invalid={!!errors.question}
            />
            {errors.question && <p className="text-xs text-destructive">{errors.question}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">Answer <span className="text-destructive">*</span></Label>
            <Textarea
              id="faq-answer"
              placeholder="Enter the full answer..."
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              rows={5}
              aria-invalid={!!errors.answer}
            />
            {errors.answer && <p className="text-xs text-destructive">{errors.answer}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as FaqCategory }))}
            >
              <SelectTrigger id="faq-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Visible to users</p>
              <p className="text-xs text-muted-foreground">Hidden FAQs are not shown on the public FAQ page</p>
            </div>
            <Switch
              checked={form.isVisible}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? 'Save changes' : 'Create FAQ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete dialog ────────────────────────────────────────────────────────────

function DeleteDialog({
  open,
  faq,
  onClose,
  onConfirm,
}: {
  open: boolean
  faq: Faq | null
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting] = useState(false)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete FAQ?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{faq?.question}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setDeleting(true)
              try { await onConfirm() }
              finally { setDeleting(false) }
              onClose()
            }}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FaqsPage() {
  // List state
  const [result, setResult] = useState<PaginatedResponse<Faq> | null>(null)
  const [loading, setLoading] = useState(true)

  // Filters & sort
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortBy>('displayOrder')
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogInitial, setDialogInitial] = useState<Faq | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState<Stats>({ total: 0, visible: 0, hidden: 0 })

  const fetchStats = useCallback((cat?: string) => {
    faqApi.getStats(cat).then(setStats).catch(() => {/* non-critical */})
  }, [])

  const fetchList = useCallback((cat?: string) => {
    setLoading(true)
    faqApi
      .getAll({
        category: cat,
        search: search || undefined,
        page,
        limit,
        sortBy,
        sortOrder,
      })
      .then(setResult)
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load FAQs')))
      .finally(() => setLoading(false))
  }, [activeCat, search, page, limit, sortBy, sortOrder])

  // Re-fetch when filters/page change
  useEffect(() => {
    fetchList(activeCat === 'all' ? undefined : activeCat)
  }, [fetchList])

  // Re-fetch stats when category changes
  useEffect(() => {
    fetchStats(activeCat === 'all' ? undefined : activeCat)
  }, [activeCat, fetchStats])

  // Reset to page 1 when category/search/sort changes
  function handleCategoryChange(cat: string) {
    setActiveCat(cat)
    setPage(1)
  }

  function handleSearchChange(val: string) {
    setSearch(val)
    setPage(1)
  }

  function handleSortChange(field: SortBy) {
    if (sortBy === field) {
      setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setSortBy(field)
      setSortOrder('ASC')
    }
    setPage(1)
  }

  function handlePageChange(p: number) {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleLimitChange(l: number) {
    setLimit(l)
    setPage(1)
  }

  async function handleSave(data: FormState) {
    if (dialogInitial) {
      const updated = await faqApi.update(dialogInitial.id, data)
      setResult((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === dialogInitial.id ? updated : i)) } : prev,
      )
      toast.success('FAQ updated')
    } else {
      await faqApi.create(data)
      // Refresh full list and stats
      await fetchList(activeCat === 'all' ? undefined : activeCat)
      await fetchStats(activeCat === 'all' ? undefined : activeCat)
      toast.success('FAQ created')
      return
    }
    await fetchStats(activeCat === 'all' ? undefined : activeCat)
  }

  async function handleToggle(faq: Faq) {
    setToggling(faq.id)
    const next = !faq.isVisible
    setResult((prev) =>
      prev
        ? { ...prev, items: prev.items.map((i) => (i.id === faq.id ? { ...i, isVisible: next } : i)) }
        : prev,
    )
    setStats((s) => ({ ...s, visible: s.visible + (next ? 1 : -1), hidden: s.hidden + (next ? -1 : 1) }))
    try {
      await faqApi.toggleVisibility(faq.id, next)
      toast.success(next ? 'FAQ is now visible' : 'FAQ is now hidden')
    } catch (e) {
      setResult((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === faq.id ? faq : i)) } : prev,
      )
      setStats((s) => ({ ...s, visible: s.visible + (next ? -1 : 1), hidden: s.hidden + (next ? 1 : -1) }))
      toast.error(getErrorMessage(e, 'Failed to update visibility'))
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(faq: Faq) {
    await faqApi.remove(faq.id)
    setResult((prev) =>
      prev ? { ...prev, items: prev.items.filter((i) => i.id !== faq.id), total: prev.total - 1 } : prev,
    )
    setStats((s) => ({
      total: s.total - 1,
      visible: s.visible - (faq.isVisible ? 1 : 0),
      hidden: s.hidden - (faq.isVisible ? 0 : 1),
    }))
    toast.success('FAQ deleted')
  }

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const pages = result?.pages ?? 1
  const activeCatMeta = getCatMeta(activeCat)

  // Page size options for display
  const PAGE_SIZE_OPTIONS = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '50 / page', value: 50 },
    { label: '100 / page', value: 100 },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">FAQ Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage frequently asked questions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              fetchList(activeCat === 'all' ? undefined : activeCat)
              fetchStats(activeCat === 'all' ? undefined : activeCat)
            }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            onClick={() => { setDialogInitial(null); setDialogOpen(true) }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add FAQ
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',   value: stats.total,   icon: HelpCircle, color: '#6366F1' },
          { label: 'Visible', value: stats.visible,  icon: Eye,        color: '#27AE60' },
          { label: 'Hidden',  value: stats.hidden,   icon: EyeOff,     color: '#9CA3AF' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="px-4 py-3 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: color + '20' }}
              >
                <Icon className="h-[18px] w-[18px]" style={{ color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Video guide */}
      <VideoSection />

      {/* Filter bar: search + sort */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-80">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search questions or answers…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Sort */}
        <Select
          value={sortBy}
          onValueChange={(v) => { setSortBy(v as SortBy); setPage(1) }}
        >
          <SelectTrigger className="h-9 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="displayOrder">Sort: Order</SelectItem>
            <SelectItem value="createdAt">Sort: Created</SelectItem>
            <SelectItem value="updatedAt">Sort: Updated</SelectItem>
            <SelectItem value="question">Sort: Question</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost" size="icon" className="h-9 w-9"
          onClick={() => handleSortChange(sortBy)}
          title={sortOrder === 'ASC' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'ASC'
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </Button>

        {/* Page size */}
        <Select
          value={String(limit)}
          onValueChange={(v) => handleLimitChange(Number(v))}
        >
          <SelectTrigger className="h-9 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category filter — pill tabs */}
      <div className="flex items-center gap-1.5 w-fit">
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={
                isActive
                  ? {
                      backgroundColor: cat.color,
                      color: '#fff',
                      boxShadow: `0 2px 8px ${cat.color}40`,
                    }
                  : {
                      backgroundColor: 'var(--surface-variant)',
                      color: 'var(--muted-foreground)',
                      border: '1px solid var(--border)',
                    }
              }
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border-subtle">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse bg-muted/20 rounded" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: activeCatMeta.color + '15' }}
            >
              <HelpCircle className="h-7 w-7" style={{ color: activeCatMeta.color + '60' }} />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {activeCat !== 'all' || search
                ? `No FAQs matching your filters`
                : 'No FAQs yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-52">
              {activeCat !== 'all' || search
                ? 'Try adjusting your search or category filter'
                : 'Create your first FAQ to get started'}
            </p>
            {(activeCat === 'all' && !search) && (
              <Button
                className="mt-4 gap-2"
                onClick={() => { setDialogInitial(null); setDialogOpen(true) }}
              >
                <Plus className="h-4 w-4" />
                Create FAQ
              </Button>
            )}
            {(activeCat !== 'all' || search) && (
              <Button
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => { setActiveCat('all'); setSearch(''); setPage(1) }}
              >
                <X className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border-subtle">
                {items.map((faq) => (
                  <FaqRow
                    key={faq.id}
                    faq={faq}
                    onEdit={(f) => { setDialogInitial(f); setDialogOpen(true) }}
                    onDelete={setDeleteTarget}
                    onToggle={handleToggle}
                    toggling={toggling}
                  />
                ))}
              </div>
            </CardContent>

            {/* Pagination footer */}
            <div className="px-4 py-2.5 border-t border-border-subtle">
              <PaginationControls
                page={page}
                pages={pages}
                total={total}
                limit={limit}
                onPage={handlePageChange}
                onLimit={handleLimitChange}
              />
            </div>
          </Card>

          {/* Empty state for filtered results */}
          {activeCat !== 'all' && (
            <div className="flex justify-end">
              <button
                onClick={() => { setActiveCat('all'); setPage(1) }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear category filter
              </button>
            </div>
          )}
        </>
      )}

      <FaqDialog
        open={dialogOpen}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
      <DeleteDialog
        open={!!deleteTarget}
        faq={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget ? handleDelete(deleteTarget) : Promise.resolve()}
      />
    </div>
  )
}