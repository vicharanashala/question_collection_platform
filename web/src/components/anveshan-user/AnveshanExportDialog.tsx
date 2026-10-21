import { useState } from 'react'
import { Check, Download, FileSpreadsheet, MessageSquare, Sprout, UserRound, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadWorkbook, exportDateTime, workbookSheet, type ExportColumn, type WorkbookSheet } from '@/lib/exportData'
import type { AnveshanUserDetail, AnveshanUserQuestion, AgriEntitySubmission } from '@/types'
import { getErrorMessage } from '@/api/client'
import { cn } from '@/lib/utils'

type Section = 'user' | 'questions' | 'entities'

const QUESTION_COLUMNS: ExportColumn<AnveshanUserQuestion>[] = [
  { header: 'Question ID', value: (q) => q.id },
  { header: 'Question', value: (q) => q.questionText },
  { header: 'Crop', value: (q) => q.cropType },
  { header: 'Season', value: (q) => q.season },
  { header: 'State', value: (q) => q.state },
  { header: 'District', value: (q) => q.district },
  { header: 'Language', value: (q) => q.language },
  { header: 'Submitted At', value: (q) => exportDateTime(q.submittedAt) },
  { header: 'Answered', value: (q) => (q.answer ? 'Yes' : 'No') },
  { header: 'Answered At', value: (q) => exportDateTime(q.answer?.answeredAt) },
  { header: 'Answer', value: (q) => q.answer?.answer },
  { header: 'Answer Sources', value: (q) => q.answer?.sources.map((s) => `${s.sourceName} (${s.source})`).join('; ') },
  { header: 'Answer Remarks', value: (q) => q.answer?.remarks },
  { header: 'Answer Score %', value: (q) => (q.answer?.scorePercentage == null ? '' : Math.round(q.answer.scorePercentage)) },
]

const ENTITY_COLUMNS: ExportColumn<AgriEntitySubmission>[] = [
  { header: 'Type', value: (e) => e.type },
  { header: 'Local Name', value: (e) => e.localName },
  { header: 'English Name', value: (e) => e.englishName },
  { header: 'Botanical Name', value: (e) => e.botanicalName },
  { header: 'Local Name Source', value: (e) => e.localNameSource },
  { header: 'Alternate Names', value: (e) => e.alternateNames.map((a) => `${a.name} (${a.source})`).join('; ') },
  { header: 'Images', value: (e) => e.imageUrls.length },
  { header: 'Submitted At', value: (e) => exportDateTime(e.submissionLocation?.capturedAt ?? e.createdAt) },
  { header: 'State', value: (e) => e.submissionLocation?.state },
  { header: 'District', value: (e) => e.submissionLocation?.district },
  { header: 'Block', value: (e) => e.submissionLocation?.block },
  { header: 'Village', value: (e) => e.submissionLocation?.village },
]

// Profile and progress as a vertical Field and Value sheet.
function userSheet({ user, progress }: AnveshanUserDetail): WorkbookSheet {
  const fields: [string, string | number | null | undefined][] = [
    ['Name', user.name],
    ['Mobile Number', user.mobileNumber],
    ['Username', user.username],
    ['Category', user.category],
    ['Language', user.languagePreference],
    ['Age', user.age],
    ['Gender', user.gender],
    ['State', user.state],
    ['District', user.district],
    ['Block', user.block],
    ['Village', user.village],
    ['KVK', user.kvk],
    ['Organisation', user.organizationName],
    ['Crops', user.crops?.join(', ')],
    ['Joined At', exportDateTime(user.createdAt)],
    ['Last Login At', exportDateTime(user.lastLoginAt)],
    ['Anveshan Progress %', progress?.percent],
    ['Anveshan Completed', progress ? (progress.completed ? 'Yes' : 'No') : ''],
  ]
  return workbookSheet('User', fields, [
    { header: 'Field', value: ([label]) => label },
    { header: 'Value', value: ([, value]) => value },
  ])
}

interface AnveshanExportDialogProps {
  detail: AnveshanUserDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Asks which data to include, then downloads it as one Excel workbook with a sheet per choice. */
export function AnveshanExportDialog({ detail, open, onOpenChange }: AnveshanExportDialogProps) {
  const [selected, setSelected] = useState<Record<Section, boolean>>({ user: true, questions: true, entities: true })
  const [exporting, setExporting] = useState(false)
  const options: { key: Section; label: string; hint: string; icon: LucideIcon }[] = [
    { key: 'user', label: 'User details', hint: 'Profile and Anveshan progress', icon: UserRound },
    { key: 'questions', label: 'Questions', hint: `${detail.questions.length} questions with their answers`, icon: MessageSquare },
    { key: 'entities', label: 'Entities', hint: `${detail.entities.length} crops, weeds, pests and diseases`, icon: Sprout },
  ]
  const selectedCount = Object.values(selected).filter(Boolean).length
  const anySelected = selectedCount > 0

  // Builds the chosen sheets and downloads the workbook.
  const handleDownload = async () => {
    setExporting(true)
    try {
      const sheets: WorkbookSheet[] = []
      if (selected.user) sheets.push(userSheet(detail))
      if (selected.questions) sheets.push(workbookSheet('Questions', detail.questions, QUESTION_COLUMNS))
      if (selected.entities) sheets.push(workbookSheet('Entities', detail.entities, ENTITY_COLUMNS))
      const safeName = (detail.user.name || detail.user.mobileNumber).replace(/[^\w-]+/g, '_')
      await downloadWorkbook(sheets, `anveshan_${safeName}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader className="flex-row items-start gap-3 p-5 pr-12 pb-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle>Export Anveshan user data</DialogTitle>
            <DialogDescription>Choose what to include. Each choice becomes its own sheet in one Excel file.</DialogDescription>
          </div>
        </DialogHeader>

        <fieldset className="space-y-2 px-5 pb-5">
          <legend className="sr-only">Data to export</legend>
          {options.map(({ key, label, hint, icon: Icon }) => {
            const checked = selected[key]
            return (
              <label
                key={key}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-focus',
                  checked ? 'border-primary bg-primary/5' : 'border-border-subtle hover:border-primary/40',
                )}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', checked ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-text-secondary')}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block text-xs text-text-secondary">{hint}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', checked ? 'border-primary bg-primary text-white' : 'border-text-tertiary bg-surface')}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
              </label>
            )
          })}
        </fieldset>

        <DialogFooter className="items-center gap-3 border-t border-border-subtle bg-surface-variant/40 px-5 py-4 sm:justify-between sm:space-x-0">
          <span className="text-xs text-text-secondary" aria-live="polite">
            {anySelected ? `${selectedCount} ${selectedCount === 1 ? 'sheet' : 'sheets'} selected` : 'Select at least one'}
          </span>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleDownload} disabled={!anySelected || exporting}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {exporting ? 'Preparing…' : 'Download Excel'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
