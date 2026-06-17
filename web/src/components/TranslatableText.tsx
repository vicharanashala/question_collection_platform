import { useState, useEffect } from 'react'
import { Languages, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { speechApi } from '@/api/speech'
import { cn } from '@/lib/utils'

/** Language display labels. */
const LANG_LABELS: Record<string, string> = {
  en: 'English',  as: 'Assamese',   bn: 'Bengali',    brx: 'Bodo',
  doi: 'Dogri',   gu: 'Gujarati',   hi: 'Hindi',      kn: 'Kannada',
  ks: 'Kashmiri', kok: 'Konkani',   mai: 'Maithili',  ml: 'Malayalam',
  mni: 'Manipuri', mr: 'Marathi',   ne: 'Nepali',     or: 'Odia',
  pa: 'Punjabi',  sa: 'Sanskrit',   sat: 'Santali',   sd: 'Sindhi',
  ta: 'Tamil',    te: 'Telugu',     ur: 'Urdu',
}

interface TranslatableTextProps {
  /** The question text to display (typically in English). */
  text: string
  /** 2-letter target language code for translation. */
  targetLanguage: string
  /** 2-letter source language of `text`. Defaults to 'en'. */
  sourceLanguage?: string
  /** Optional CSS class for the container. */
  className?: string
  /** Whether the translated text is always shown inline (no expand toggle). */
  inline?: boolean
}

/**
 * Displays `text` and provides a lazy translation via the Sarvam API.
 *
 * - Shows the original text first.
 * - A "Translate" button fetches the translation from the backend.
 * - Once fetched, the translated text is shown below the original.
 * - Does NOT modify or manage `text` — the parent owns the value.
 */
export function TranslatableText({
  text,
  targetLanguage,
  sourceLanguage = 'en',
  className,
  inline = false,
}: TranslatableTextProps) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const langLabel = LANG_LABELS[targetLanguage] ?? targetLanguage.toUpperCase()
  const isSameLang = sourceLanguage === targetLanguage || targetLanguage === 'en'

  // Auto-fetch when used in inline mode
  useEffect(() => {
    if (inline && text && !translated && !loading && !isSameLang) {
      handleTranslate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, targetLanguage])

  async function handleTranslate() {
    if (!text.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await speechApi.translate(text.trim(), targetLanguage)
      setTranslated(result.translatedText)
    } catch {
      setError('Translation unavailable')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Original text */}
      <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">{text}</div>

      {/* Translated text or expand toggle */}
      {translated ? (
        inline || expanded ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <Languages className="h-3.5 w-3.5" />
              {langLabel}
            </div>
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{translated}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <Languages className="h-3.5 w-3.5" />
            Show {langLabel} translation
          </button>
        )
      ) : (
        !isSameLang && (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading || !text.trim()}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium"
          >
            {loading ? (
              <Loader className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Languages className="h-3.5 w-3.5" />
            )}
            {loading ? 'Translating…' : `Translate to ${langLabel}`}
          </button>
        )
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Collapse button when expanded */}
      {!inline && translated && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-text"
        >
          <ChevronUp className="h-3 w-3" />
          Hide translation
        </button>
      )}
    </div>
  )
}