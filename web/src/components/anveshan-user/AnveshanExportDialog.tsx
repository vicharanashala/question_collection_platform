import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { downloadWorkbook, exportDateTime, workbookSheet, type ExportColumn, type WorkbookSheet } from '@/lib/exportData'
import type { AnveshanUserDetail, AnveshanUserQuestion, AgriEntitySubmission } from '@/types'
import { getErrorMessage } from '@/api/client'

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
  const options: { key: Section; label: string; hint: string }[] = [
    { key: 'user', label: 'User details', hint: 'Profile and Anveshan progress' },
    { key: 'questions', label: 'Questions', hint: `${detail.questions.length} questions with their answers` },
    { key: 'entities', label: 'Entities', hint: `${detail.entities.length} crops, weeds, pests and diseases` },
  ]
  const anySelected = Object.values(selected).some(Boolean)

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Anveshan user data</DialogTitle>
          <DialogDescription>Choose what to include. Each choice becomes its own sheet in one Excel file.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Data to export</legend>
          {options.map(({ key, label, hint }) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-subtle p-3 hover:border-primary/40">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected[key]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-text-secondary">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleDownload} disabled={!anySelected || exporting}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {exporting ? 'Preparing…' : 'Download Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
