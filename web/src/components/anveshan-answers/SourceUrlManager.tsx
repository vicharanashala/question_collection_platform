import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PlusCircle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AnveshanAnswerSource, AnveshanAnswerSourceType } from '@/types'
import { MAX_ANVESHAN_ANSWER_SOURCES } from '@/constants/public'

export const SOURCE_TYPE_LABELS: Record<AnveshanAnswerSourceType, string> = {
  hyper_local: 'Hyper Local',
  state: 'State',
  central: 'Central',
  other: 'Other',
}

const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS) as AnveshanAnswerSourceType[]

// Same checks as the expert review screen: PDF links need page numbers, pages are positive integers.
const isPdfLink = (url: string) => /pdf/i.test(url)
const isValidPageList = (input: string) =>
  input.split(',').map((p) => p.trim()).filter(Boolean).every((p) => /^[1-9]\d*$/.test(p))

// Returns a parsed http(s) URL, or null when the text is not one.
function parseHttpUrl(text: string): URL | null {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

interface SourceUrlManagerProps {
  sources: AnveshanAnswerSource[]
  onSourcesChange: (sources: AnveshanAnswerSource[]) => void
  disabled?: boolean
}

// Collects typed source references (type, name, URL and page numbers) for an answer.
export function SourceUrlManager({ sources, onSourcesChange, disabled = false }: SourceUrlManagerProps) {
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState<AnveshanAnswerSourceType | ''>('')
  const [sourceName, setSourceName] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [pageInput, setPageInput] = useState('')

  // Validates the inputs and appends the source, reporting the first problem found.
  const addSource = () => {
    const trimmedName = sourceName.trim()
    const trimmedUrl = urlInput.trim()
    const trimmedPage = pageInput.trim()

    if (!selectedType) return toast.error(t('anveshanAnswers.errors.sourceType', 'Please select a source type.'))
    if (!trimmedName) return toast.error(t('anveshanAnswers.errors.sourceName', 'Please enter the source name.'))
    if (!trimmedUrl) return toast.error(t('anveshanAnswers.errors.sourceUrl', 'Please enter the source URL.'))
    if (!parseHttpUrl(trimmedUrl)) {
      return toast.error(t('anveshanAnswers.errors.sourceUrlInvalid', 'Please enter a valid URL starting with http:// or https://.'))
    }
    if (isPdfLink(trimmedUrl) && !trimmedPage) {
      return toast.error(t('anveshanAnswers.errors.pdfPage', 'Page number is required for PDF links.'))
    }
    if (trimmedPage && !isValidPageList(trimmedPage)) {
      return toast.error(t('anveshanAnswers.errors.pageInvalid', 'Please enter valid page number(s) (e.g. 1 or 1,2,3).'))
    }
    if (sources.length >= MAX_ANVESHAN_ANSWER_SOURCES) {
      return toast.error(t('anveshanAnswers.errors.sourceLimit', { max: MAX_ANVESHAN_ANSWER_SOURCES, defaultValue: 'You can add up to {{max}} sources.' }))
    }

    const page = trimmedPage || null
    const exists = sources.some((s) => s.sourceType === selectedType && s.source === trimmedUrl && (s.page ?? null) === page)
    if (exists) return toast.error(t('anveshanAnswers.errors.sourceDuplicate', 'This source already exists.'))

    onSourcesChange([...sources, { sourceType: selectedType, sourceName: trimmedName, source: trimmedUrl, page }])
    setSelectedType('')
    setSourceName('')
    setUrlInput('')
    setPageInput('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSource()
    }
  }

  const typeLabel = selectedType ? SOURCE_TYPE_LABELS[selectedType] : ''

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-text" id="source-references-label">
        {t('anveshanAnswers.sourceReferences', 'Source References')} *
      </p>

      <Select
        value={selectedType}
        onValueChange={(val) => setSelectedType(val as AnveshanAnswerSourceType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-labelledby="source-references-label">
          <SelectValue placeholder={t('anveshanAnswers.selectSourceType', 'Select Source Type')} />
        </SelectTrigger>
        <SelectContent>
          {SOURCE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {SOURCE_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedType && (
        <div className="space-y-2">
          <Input
            type="text"
            aria-label={t('anveshanAnswers.sourceNameLabel', 'Source name')}
            placeholder={`${typeLabel} ${t('anveshanAnswers.sourceNamePlaceholder', 'Source Name')}`}
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              aria-label={t('anveshanAnswers.sourceUrlLabel', 'Source link URL')}
              placeholder={`${typeLabel} ${t('anveshanAnswers.sourceUrlPlaceholder', 'Source Link URL')}`}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="numeric"
                aria-label={t('anveshanAnswers.pageLabel', 'Page numbers')}
                placeholder={t('anveshanAnswers.pagePlaceholder', 'Page(s) e.g. 1,2,3')}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="flex-1 sm:w-36"
              />
              <button
                type="button"
                onClick={addSource}
                disabled={disabled}
                aria-label={t('anveshanAnswers.addSource', 'Add source')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                <PlusCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {sources.length > 0 && <SourceList sources={sources} onRemove={disabled ? undefined : (index) => onSourcesChange(sources.filter((_, i) => i !== index))} />}
    </div>
  )
}

interface SourceListProps {
  sources: AnveshanAnswerSource[]
  onRemove?: (index: number) => void
}

// Lists added sources; removal is offered only when onRemove is provided.
export function SourceList({ sources, onRemove }: SourceListProps) {
  const { t } = useTranslation()
  return (
    <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border-subtle p-2">
      {sources.map((item, index) => {
        const label = SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType
        return (
          <li
            key={`${item.source}-${item.page ?? ''}-${index}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-subtle bg-surface-variant px-3 py-2 text-sm"
          >
            <span className="inline-flex max-w-full items-center truncate rounded-md border border-border-subtle bg-surface px-2 py-0.5 text-xs font-medium text-text">
              {label}: {item.sourceName}
            </span>
            <a
              href={item.source}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-primary hover:underline"
              title={item.source}
            >
              {item.source}
            </a>
            {item.page && <span className="whitespace-nowrap text-xs text-text-tertiary">pg {item.page}</span>}
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-tertiary transition-colors hover:bg-surface hover:text-text"
                aria-label={t('anveshanAnswers.removeSource', 'Remove source')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
