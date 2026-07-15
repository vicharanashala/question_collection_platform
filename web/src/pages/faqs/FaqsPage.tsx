import { useState, useEffect, useCallback } from 'react'
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
  ChevronUp, ChevronDown, X,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Faq, FaqCategory } from '@/types'
import { VideoSection } from '@/components/VideoSection'
interface FormState {
  question: string
  answer: string
  category: FaqCategory
  isVisible: boolean
}

const EMPTY: FormState = { question: '', answer: '', category: 'general', isVisible: true }

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'all', label: 'All', color: '#6366F1' },
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
        {/* Category colour dot */}
        <div
          className="w-2 h-2 rounded-full mt-2.5 shrink-0"
          style={{ backgroundColor: catMeta.color }}
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <button
              className="flex-1 text-left"
              onClick={() => setOpen((o) => !o)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {faq.question}
                </p>
                {/* Category badge */}
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

        {/* Visibility badge */}
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

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggle(faq)}
            disabled={!!toggling}
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
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(faq)}
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(faq)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
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
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
          <DialogDescription>
            {initial
              ? 'Update the question and answer below.'
              : 'Fill in the question and answer below.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="faq-question">
              Question <span className="text-destructive">*</span>
            </Label>
            <Input
              id="faq-question"
              placeholder="e.g. How do I submit a question?"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              aria-invalid={!!errors.question}
            />
            {errors.question && (
              <p className="text-xs text-destructive">{errors.question}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-answer">
              Answer <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="faq-answer"
              placeholder="Enter the full answer..."
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              rows={5}
              aria-invalid={!!errors.answer}
            />
            {errors.answer && (
              <p className="text-xs text-destructive">{errors.answer}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="faq-category">Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v as FaqCategory }))
              }
            >
              <SelectTrigger id="faq-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.filter((c) => c.key !== 'all').map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">
                Visible to users
              </p>
              <p className="text-xs text-muted-foreground">
                Hidden FAQs are not shown on the public FAQ page
              </p>
            </div>
            <Switch
              checked={form.isVisible}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
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
            Are you sure you want to delete &ldquo;{faq?.question}&rdquo;? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              setDeleting(true)
              try {
                await onConfirm()
              } finally {
                setDeleting(false)
              }
              onClose()
            }}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function FaqsPage() {
  const [items, setItems] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogInitial, setDialogInitial] = useState<Faq | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Faq | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [activeCat, setActiveCat] = useState('all')

  const fetch_ = useCallback(
    (category?: string) => {
      setLoading(true)
      faqApi
        .getAll({ category })
        .then((data) => setItems(data))
        .catch((e) => toast.error(getErrorMessage(e, 'Failed to load FAQs')))
        .finally(() => setLoading(false))
    },
    [],
  )

  // Initial load — always fetch all so we have stats
  useEffect(() => { fetch_() }, [fetch_])

  // Re-fetch when category changes
  useEffect(() => {
    fetch_(activeCat === 'all' ? undefined : activeCat)
  }, [activeCat, fetch_])

  // Stats derived from the active dataset only
  const stats = {
    total: items.length,
    visible: items.filter((i) => i.isVisible).length,
    hidden: items.filter((i) => !i.isVisible).length,
  }

  async function handleSave(data: FormState) {
    if (dialogInitial) {
      const updated = await faqApi.update(dialogInitial.id, data)
      setItems((prev) => prev.map((i) => (i.id === dialogInitial.id ? updated : i)))
      toast.success('FAQ updated')
    } else {
      const created = await faqApi.create(data)
      setItems((prev) => [...prev, created])
      toast.success('FAQ created')
    }
  }

  async function handleToggle(faq: Faq) {
    setToggling(faq.id)
    const next = !faq.isVisible
    setItems((prev) =>
      prev.map((i) => (i.id === faq.id ? { ...i, isVisible: next } : i)),
    )
    try {
      await faqApi.toggleVisibility(faq.id, next)
      toast.success(next ? 'FAQ is now visible' : 'FAQ is now hidden')
    } catch (e) {
      setItems((prev) =>
        prev.map((i) => (i.id === faq.id ? faq : i)),
      )
      toast.error(getErrorMessage(e, 'Failed to update visibility'))
    } finally {
      setToggling(null)
    }
  }

  async function handleDelete(faq: Faq) {
    await faqApi.remove(faq.id)
    setItems((prev) => prev.filter((i) => i.id !== faq.id))
    toast.success('FAQ deleted')
  }

  const activeCatMeta = getCatMeta(activeCat)

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
        <Button
          onClick={() => {
            setDialogInitial(null)
            setDialogOpen(true)
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add FAQ
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Total',
            value: stats.total,
            icon: HelpCircle,
            color: '#6366F1',
          },
          {
            label: 'Visible',
            value: stats.visible,
            icon: Eye,
            color: '#27AE60',
          },
          {
            label: 'Hidden',
            value: stats.hidden,
            icon: EyeOff,
            color: '#9CA3AF',
          },
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

      {/* Category filter — pill tabs */}
      <div className="flex items-center gap-1.5 w-fit">
        {CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
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
              {isActive && (
                <span
                  className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                >
                  {stats.total}
                </span>
              )}
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
                <div
                  key={i}
                  className="h-14 animate-pulse bg-muted/20 rounded"
                />
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
              <HelpCircle
                className="h-7 w-7"
                style={{ color: activeCatMeta.color + '60' }}
              />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {activeCat !== 'all'
                ? `No FAQs in ${activeCatMeta.label}`
                : 'No FAQs yet'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-52">
              {activeCat !== 'all'
                ? 'Move FAQs to this category or pick another filter'
                : 'Create your first FAQ to get started'}
            </p>
            {activeCat === 'all' && (
              <Button
                className="mt-4 gap-2"
                onClick={() => {
                  setDialogInitial(null)
                  setDialogOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                Create FAQ
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border-subtle">
              {items.map((faq) => (
                <FaqRow
                  key={faq.id}
                  faq={faq}
                  onEdit={(f) => {
                    setDialogInitial(f)
                    setDialogOpen(true)
                  }}
                  onDelete={setDeleteTarget}
                  onToggle={handleToggle}
                  toggling={toggling}
                />
              ))}
            </div>
          </CardContent>
          <div className="px-4 py-2.5 border-t border-border-subtle flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {items.length} of {items.length} FAQs
            </p>
            {activeCat !== 'all' && (
              <button
                onClick={() => setActiveCat('all')}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>
        </Card>
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
        onConfirm={() =>
          deleteTarget ? handleDelete(deleteTarget) : Promise.resolve()
        }
      />
    </div>
  )
}