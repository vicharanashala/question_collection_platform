import { useState, useEffect } from 'react'
import { distributor, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Question } from '@/types'

interface AssignResult {
  insertedStates: string[]
  skippedStates: string[]
  insertedCount: number
}

export function AssignStatesDialog({
  question, onClose, onDone,
}: {
  question: Question
  onClose: () => void
  onDone: () => void
}) {
  const [states, setStates] = useState<string[]>([])
  const [indianStates, setIndianStates] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AssignResult | null>(null)

  useEffect(() => {
    distributor.listIndianStates()
      .then((r) => setIndianStates(r.states))
      .catch((e) => toast.error(getErrorMessage(e, 'Failed to load states.')))
  }, [])

  const toggleState = (s: string) => {
    setStates((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }
  const selectAll = () => setStates(indianStates)
  const clearAll = () => setStates([])

  const submit = async () => {
    setSubmitting(true)
    try {
      const r = await distributor.assignStates(question.id, { states, notes: notes || undefined })
      setResult(r)
      // The backend reports `insertedCount` (NEW rows) and `skippedStates`
      // (states that were already in final_questions for this question —
      // skipped because of the unique index on
      // (referenceQuestionId, distributionState)). `r` is surfaced in the
      // success card below; the toast itself is intentionally neutral.
      toast.success('Questions moved')
      setTimeout(onDone, 1500)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to assign states.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="min-w-[75vw] p-2">
        <DialogHeader>
          <DialogTitle>Assign states to question</DialogTitle>
          <DialogDescription>
            Pick the Indian states where this question should be distributed. You can
            also submit with no states selected if the question is not state-specific.
            The parent question status will flip to <em>moved_to_final</em>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface p-3 text-xs sm:text-xs sm:text-sm line-clamp-3">
            {question.questionText}
          </div>

          <div className="flex items-center justify-between">
            <Label>Indian states ({states.length} selected)</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={selectAll}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-64 overflow-auto rounded-md border border-border p-2">
            {indianStates.map((s) => {
              const selected = states.includes(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleState(s)}
                  className={`text-left text-[11px] sm:text-[11px] sm:text-xs px-2 py-1.5 rounded-md border transition-colors ${
                    selected
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border hover:bg-surface'
                  }`}
                >
                  {selected && <span className="mr-1">✓</span>}
                  {s}
                </button>
              )
            })}
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Optional note about this distribution..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {result && (
            <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-3 text-[11px] sm:text-[11px] sm:text-xs">
              <div className="font-medium text-green-700 dark:text-green-300">
                {result.insertedCount === 0 && result.skippedStates.length === 0
                  ? '✓ Moved to final with no state assignment'
                  : result.insertedCount === 0
                  ? `✓ All ${result.skippedStates.length} picked state${result.skippedStates.length === 1 ? '' : 's'} already assigned — no new rows created`
                  : `✓ Inserted ${result.insertedCount} new distribution${result.insertedCount === 1 ? '' : 's'}`}
              </div>
              {result.skippedStates.length > 0 && result.insertedCount > 0 && (
                <div className="mt-1 text-green-700 dark:text-green-400">
                  Skipped (already distributed): {result.skippedStates.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className='mt-2'>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {states.length === 0
              ? 'Move to final (no states)'
              : `Assign to ${states.length} state${states.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}