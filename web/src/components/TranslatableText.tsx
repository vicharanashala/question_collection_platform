import { useState, useEffect, useRef, useCallback } from 'react'
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
  /** The question text (always the original, untranslated text). */
  text: string
  /** Currently selected target language code. */
  selectedLang: string
  /** Callback fired when the user picks a language. */
  onLangChange: (lang: string) => void
  /** 2-letter source language of `text`. Defaults to 'en'. */
  sourceLanguage?: string
  /** Optional CSS class for the container. */
  className?: string
  /** Whether translated text is always shown inline (no expand toggle). */
  inline?: boolean
}

/**
 * Displays `text` and provides lazy translation via the Sarvam API.
 *
 * Chain translations are handled correctly: if the user translates en→hi and
 * then selects ta, the API is called with the *Hindi* text and source=hi-IN,
 * producing a Hindi→Tamil translation rather than re-translating the original
 * English from Tamil.
 *
 * State machine (displayedLang drives which language the UI is showing):
 *
 *   Start:          displayedLang = sourceLanguage, translated = null
 *   After en→hi:    displayedLang = 'hi',          translated = Hindi text
 *   After hi→ta:    displayedLang = 'ta',          translated = Tamil text
 *   After ta→en:    displayedLang = sourceLanguage, translated = null (reset)
 */
export function TranslatableText({
  text,
  selectedLang,
  onLangChange,
  sourceLanguage = 'en',
  className,
  inline = false,
}: TranslatableTextProps) {
  // translated: the currently displayed translated text (null = showing original)
  const [translated, setTranslated] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // displayedLang: the language code of the text currently shown in the card.
  // This is the source for the NEXT translation call.
  const [displayedLang, setDisplayedLang] = useState(sourceLanguage)

  const dropdownRef = useRef<HTMLDivElement>(null)
  // Keeps selectedLang fresh inside async callbacks without stale-closure issues.
  // Synced via useEffect to avoid "cannot update ref during render" warning.
  const selectedLangRef = useRef(selectedLang)
  useEffect(() => { selectedLangRef.current = selectedLang }, [selectedLang])

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

  // When the user picks a new target language, reset the translation state.
  // The next doTranslate call (triggered by handleLangSelect) will use the
  // currently displayed text as source, enabling correct chain translations.
  useEffect(() => {
    if (selectedLang) {
      // Reset translation state when user picks a new language.
      setTranslated(null)
      setExpanded(false)
      setDisplayedLang((prev) => (prev === selectedLang ? sourceLanguage : prev))
    }
  }, [selectedLang, sourceLanguage])

  const doTranslate = useCallback(async () => {
    if (!selectedLangRef.current || loading) return

    // Always translate from the currently displayed text, not the original.
    // This is the key to correct chain translations.
    const currentText = translated ?? text
    if (!currentText.trim()) return

    setLoading(true)
    setError(null)
    try {
      const result = await speechApi.translate(
        currentText.trim(),
        selectedLangRef.current, // target
        displayedLang,           // source (language of currentText)
      )
      setTranslated(result.translatedText)
      setDisplayedLang(selectedLangRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation unavailable')
    } finally {
      setLoading(false)
    }
  }, [text, translated, displayedLang, loading])

  function handleLangSelect(code: string) {
    setShowDropdown(false)
    onLangChange(code)
    doTranslate() // uses refs + current state to determine source + target
  }

  // Re-translate when selectedLang changes (e.g. parent re-mounts with a pre-set lang)
  // Re-translate when selectedLang changes (e.g. parent re-mounts with a pre-set lang)
  useEffect(() => {
    if (selectedLang && selectedLang !== sourceLanguage && !translated && !loading) {
      doTranslate()
    }
  }, [selectedLang])

  // Mount-time auto-translate for inline mode
  // Mount-time auto-translate for inline mode
  useEffect(() => {
    if (inline && selectedLang && selectedLang !== sourceLanguage && !translated && !loading) {
      doTranslate()
    }
  }, [inline])

  return (
    <div className={cn('space-y-2', className)}>
      {/* Currently displayed text (original or translated) */}
      <div className="text-sm text-text leading-relaxed whitespace-pre-wrap">
        {translated ?? text}
      </div>

      {/* Controls: language picker + translate button */}
      <div className="flex items-center gap-2">
        {/* Language picker */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowDropdown((v) => !v) }}
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
                  onClick={(e) => { e.stopPropagation(); handleLangSelect(code) }}
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

        {/* Translate / show / hide / reset button */}
        {!isSameLang && !translated && !loading && selectedLang && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); doTranslate() }}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline font-medium"
          >
            <Languages className="h-3 w-3" />
            Translate to {langLabel}
          </button>
        )}

        {!isSameLang && translated && !loading && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          >
            <Languages className="h-3 w-3" />
            Show {langLabel}
          </button>
        )}

        {!isSameLang && loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader className="h-3 w-3 animate-spin" />
            Translating…
          </span>
        )}

        {expanded && translated && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
            Hide {langLabel}
          </button>
        )}

        {isSameLang && translated && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setTranslated(null); setExpanded(false) }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3 w-3" />
            Original
          </button>
        )}
      </div>

      {/* Inline / expanded translated text */}
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