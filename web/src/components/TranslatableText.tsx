import { useState, useEffect, useRef } from 'react'
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

export const SUPPORTED_LANGS = Object.keys(LANG_LABELS)

interface TranslatableTextProps {
  /** The question text to display (typically in English). */
  text: string
  /** Currently selected target language code. */
  selectedLang: string
  /** Callback fired when the user picks a language from the dropdown. */
  onLangChange: (lang: string) => void
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
 * - Shows the original text first (or the currently translated text once
 *   a translation is loaded — subsequent translations use that as source,
 *   enabling chain translations like en→hi→te correctly).
 * - A language picker lets the user pick any supported language.
 * - A translate button fetches the translation from the backend.
 * - Once fetched, the translated text is shown inline or behind an expand toggle.
 * - Does NOT modify or manage `text` — the parent owns the value.
 */
export function TranslatableText({
  text,
  selectedLang,
  onLangChange,
  sourceLanguage = 'en',
  className,
  inline = false,
}: TranslatableTextProps) {
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // displayedLang tracks the language of the text currently shown so
  // chain translations work: en → hi → te uses hi as source, not en
  const [displayedLang, setDisplayedLang] = useState(sourceLanguage)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const langLabel = LANG_LABELS[selectedLang] ?? selectedLang.toUpperCase()
  const isSameLang = displayedLang === selectedLang

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDropdown])

  // When the user picks a new target language, reset and use the currently
  // displayed language as the source for the next translation
  useEffect(() => {
    setTranslated(null)
    setExpanded(false)
    setDisplayedLang((prev) => (prev === selectedLang ? sourceLanguage : prev))
  }, [selectedLang])

  // Auto-fetch when selectedLang is set in inline mode
  useEffect(() => {
    if (inline && selectedLang && text && !translated && !loading && !isSameLang) {
      handleTranslate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, selectedLang, inline, isSameLang])

  async function handleTranslate() {
    if (!text.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      // Translate from whatever language is currently displayed, not the original
      const result = await speechApi.translate(text.trim(), selectedLang, displayedLang)
      setTranslated(result.translatedText)
      setDisplayedLang(selectedLang)
    } catch {
      setError('Translation unavailable')
    } finally {
      setLoading(false)
    }
  }

  function handleLangSelect(code: string) {
    setShowDropdown(false)
    onLangChange(code)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Original / currently displayed text */}
      <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">{translated ?? text}</div>

      {/* Controls row: lang picker + translate button */}
      <div className="flex items-center gap-2">
        {/* Language picker dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-border-subtle bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Languages className="h-3 w-3" />
            {selectedLang ? langLabel : 'Language'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', showDropdown && 'rotate-180')} />
          </button>
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-border-subtle rounded-lg shadow-lg w-40 max-h-60 overflow-y-auto">
              {SUPPORTED_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLangSelect(code)}
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors',
                    selectedLang === code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground',
                  )}
                >
                  {LANG_LABELS[code]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Translate / hide button */}
        {!isSameLang && (
          translated ? (
            expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronUp className="h-3 w-3" />
                Hide {langLabel}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <Languages className="h-3 w-3" />
                Show {langLabel}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleTranslate}
              disabled={loading || !text.trim()}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium"
            >
              {loading ? (
                <Loader className="h-3 w-3 animate-spin" />
              ) : (
                <Languages className="h-3 w-3" />
              )}
              {loading ? 'Translating…' : `Translate to ${langLabel}`}
            </button>
          )
        )}
        {isSameLang && translated && (
          <button
            type="button"
            onClick={() => { setTranslated(null); setExpanded(false) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
            Original
          </button>
        )}
      </div>

      {/* Inline translated text */}
      {(inline || expanded) && translated && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Languages className="h-3.5 w-3.5" />
            {langLabel}
          </div>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{translated}</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}