import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusCircle, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AnveshanAnswerSource, AnveshanAnswerSourceType } from '@/types'
import { MAX_ANVESHAN_ANSWER_SOURCES } from '@/constants/public'
import { cn } from '@/lib/utils'
import { FieldError } from './FieldError'

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
  /** Id of an outside error (for example "at least one source") that describes this group. */
  describedBy?: string
}

type SourceField = 'type' | 'name' | 'url' | 'page' | 'list'
type SourceErrors = Partial<Record<SourceField, string>>

// Collects typed source references (type, name, URL and page numbers) for an answer, with inline errors per field.
export function SourceUrlManager({ sources, onSourcesChange, disabled = false, describedBy }: SourceUrlManagerProps) {
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState<AnveshanAnswerSourceType | ''>('')
  const [sourceName, setSourceName] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [pageInput, setPageInput] = useState('')
  const [errors, setErrors] = useState<SourceErrors>({})

  // Clears one field's error as soon as the user edits that field.
  const clearError = (field: SourceField) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))

  // Returns every problem with the current inputs, keyed by the field it belongs to.
  const validateInputs = (): SourceErrors => {
    const found: SourceErrors = {}
    const trimmedUrl = urlInput.trim()
    const trimmedPage = pageInput.trim()

    if (!selectedType) found.type = t('anveshanAnswers.errors.sourceType', 'Please select a source type.')
    if (!sourceName.trim()) found.name = t('anveshanAnswers.errors.sourceName', 'Please enter the source name.')
    if (!trimmedUrl) {
      found.url = t('anveshanAnswers.errors.sourceUrl', 'Please enter the source URL.')
    } else if (!parseHttpUrl(trimmedUrl)) {
      found.url = t('anveshanAnswers.errors.sourceUrlInvalid', 'Please enter a valid URL starting with http:// or https://.')
    }
    if (trimmedUrl && isPdfLink(trimmedUrl) && !trimmedPage) {
      found.page = t('anveshanAnswers.errors.pdfPage', 'Page number is required for PDF links.')
    } else if (trimmedPage && !isValidPageList(trimmedPage)) {
      found.page = t('anveshanAnswers.errors.pageInvalid', 'Please enter valid page number(s) (e.g. 1 or 1,2,3).')
    }
    if (sources.length >= MAX_ANVESHAN_ANSWER_SOURCES) {
      found.list = t('anveshanAnswers.errors.sourceLimit', { max: MAX_ANVESHAN_ANSWER_SOURCES, defaultValue: 'You can add up to {{max}} sources.' })
    } else if (
      selectedType &&
      sources.some((s) => s.sourceType === selectedType && s.source === trimmedUrl && (s.page ?? null) === (trimmedPage || null))
    ) {
      found.list = t('anveshanAnswers.errors.sourceDuplicate', 'This source already exists.')
    }
    return found
  }

  // Validates the inputs and appends the source when everything is valid.
  const addSource = () => {
    const found = validateInputs()
    setErrors(found)
    if (Object.values(found).some(Boolean) || !selectedType) return

    onSourcesChange([
      ...sources,
      { sourceType: selectedType, sourceName: sourceName.trim(), source: urlInput.trim(), page: pageInput.trim() || null },
    ])
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
  const invalidClass = 'border-destructive focus-visible:ring-destructive'

  return (
    <div className="grid gap-3" role="group" aria-labelledby="source-references-label" aria-describedby={describedBy}>
      <p className="text-sm font-medium text-text" id="source-references-label">
        {t('anveshanAnswers.sourceReferences', 'Source References')} *
      </p>

      <div>
        <Select
          value={selectedType}
          onValueChange={(val) => {
            setSelectedType(val as AnveshanAnswerSourceType)
            clearError('type')
          }}
          disabled={disabled}
        >
          <SelectTrigger
            className={cn('w-full', errors.type && invalidClass)}
            aria-label={t('anveshanAnswers.selectSourceType', 'Select Source Type')}
            aria-invalid={!!errors.type}
            aria-describedby={errors.type ? 'source-type-error' : undefined}
          >
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
        <FieldError id="source-type-error" message={errors.type} />
      </div>

      {selectedType && (
        <div className="space-y-2">
          <div>
            <Input
              type="text"
              aria-label={t('anveshanAnswers.sourceNameLabel', 'Source name')}
              placeholder={`${typeLabel} ${t('anveshanAnswers.sourceNamePlaceholder', 'Source Name')}`}
              value={sourceName}
              onChange={(e) => {
                setSourceName(e.target.value)
                clearError('name')
              }}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'source-name-error' : undefined}
              className={cn(errors.name && invalidClass)}
            />
            <FieldError id="source-name-error" message={errors.name} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                type="url"
                inputMode="url"
                aria-label={t('anveshanAnswers.sourceUrlLabel', 'Source link URL')}
                placeholder={`${typeLabel} ${t('anveshanAnswers.sourceUrlPlaceholder', 'Source Link URL')}`}
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  clearError('url')
                  clearError('page')
                  clearError('list')
                }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-invalid={!!errors.url}
                aria-describedby={errors.url ? 'source-url-error' : undefined}
                className={cn(errors.url && invalidClass)}
              />
              <FieldError id="source-url-error" message={errors.url} />
            </div>
            <div className="flex gap-2 sm:w-44">
              <div className="flex-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={t('anveshanAnswers.pageLabel', 'Page numbers')}
                  placeholder={t('anveshanAnswers.pagePlaceholder', 'Page(s) e.g. 1,2,3')}
                  value={pageInput}
                  onChange={(e) => {
                    setPageInput(e.target.value)
                    clearError('page')
                    clearError('list')
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
                  aria-invalid={!!errors.page}
                  aria-describedby={errors.page ? 'source-page-error' : undefined}
                  className={cn(errors.page && invalidClass)}
                />
                <FieldError id="source-page-error" message={errors.page} />
              </div>
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
          <FieldError id="source-list-error" message={errors.list} />
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
