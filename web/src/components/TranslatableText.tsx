import { useState, useEffect, useRef, useCallback } from "react";
import { speechApi } from "@/api/speech";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from "./ui/select";
import { Rings } from "react-loader-spinner";

/** Language display labels. */
const LANG_LABELS: Record<string, string> = {
  en: "English",
  as: "Assamese",
  bn: "Bengali",
  brx: "Bodo",
  doi: "Dogri",
  gu: "Gujarati",
  hi: "Hindi",
  kn: "Kannada",
  ks: "Kashmiri",
  kok: "Konkani",
  mai: "Maithili",
  ml: "Malayalam",
  mni: "Manipuri",
  mr: "Marathi",
  ne: "Nepali",
  or: "Odia",
  pa: "Punjabi",
  sa: "Sanskrit",
  sat: "Santali",
  sd: "Sindhi",
  ta: "Tamil",
  te: "Telugu",
  ur: "Urdu",
};

export const SUPPORTED_LANGS = Object.keys(LANG_LABELS);

interface TranslatableTextProps {
  /** The question text (always the original, untranslated text). */
  text: string;
  /** Currently selected target language code. */
  selectedLang: string;
  /** Callback fired when the user picks a language. */
  onLangChange: (lang: string) => void;
  /** 2-letter source language of `text`. Defaults to 'en'. */
  sourceLanguage?: string;
  /** Optional CSS class for the container. */
  className?: string;
  /** Whether translated text is always shown inline (no expand toggle). */
  inline?: boolean;
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
  sourceLanguage = "en",
  className,
}: TranslatableTextProps) {
  // translated: the currently displayed translated text (null = showing original)
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // const [expanded, setExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  // const [dropdownPos, setDropdownPos] = useState<{
  //   top: number;
  //   left: number;
  // } | null>(null);
  const [portalEl] = useState<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // displayedLang: the language code of the text currently shown in the card.
  // This is the source for the NEXT translation call.
  const [displayedLang, setDisplayedLang] = useState(sourceLanguage);

  const dropdownRef = useRef<HTMLDivElement>(null);
  // Keeps selectedLang fresh inside async callbacks without stale-closure issues.
  // Synced via useEffect to avoid "cannot update ref during render" warning.
  const selectedLangRef = useRef(selectedLang);
  useEffect(() => {
    selectedLangRef.current = selectedLang;
  }, [selectedLang]);
  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const inButton = dropdownRef.current?.contains(e.target as Node);
      const inPortal = portalEl?.contains(e.target as Node);
      if (!inButton && !inPortal) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown, portalEl]);

  // When the user picks a new target language, reset the translation state.
  // The next doTranslate call (triggered by handleLangSelect) will use the
  // currently displayed text as source, enabling correct chain translations.

  // const doTranslate = useCallback(async () => {
  //   if (!selectedLangRef.current || loading) return

  //   // Always translate from the currently displayed text, not the original.
  //   // This is the key to correct chain translations.
  //   const currentText = translated ?? text
  //   if (!currentText.trim()) return

  //   setLoading(true)
  //   setError(null)
  //   try {
  //     const result = await speechApi.translate(
  //       currentText.trim(),
  //       selectedLangRef.current, // target
  //       displayedLang,           // source (language of currentText)
  //     )
  //     setTranslated(result.translatedText)
  //     setDisplayedLang(selectedLangRef.current)
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : 'Translation unavailable')
  //   } finally {
  //     setLoading(false)
  //   }
  // }, [text, translated, displayedLang, loading])

const doTranslate = useCallback(
  async (targetLang: string) => {
    if (!targetLang || loading) return;

    // Selecting the original language means
    // return to the original question text.
    if (targetLang === sourceLanguage) {
      setTranslated(null);
      setDisplayedLang(sourceLanguage);
      setError(null);
      return;
    }

    const currentText = translated ?? text;

    if (!currentText.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await speechApi.translate(
        currentText.trim(),
        targetLang,
        displayedLang,
      );

      setTranslated(result.translatedText);
      setDisplayedLang(targetLang);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Translation unavailable",
      );
    } finally {
      setLoading(false);
    }
  },
  [text, translated, displayedLang, loading, sourceLanguage],
);
  // function handleLangSelect(code: string) {
  //   setShowDropdown(false)
  //   onLangChange(code)
  //   doTranslate() // uses refs + current state to determine source + target
  // }

  function handleLangSelect(code: string) {
    setShowDropdown(false);

    onLangChange(code);

    // Explicitly pass the newly selected language.
    doTranslate(code);
  }

  // Re-translate when selectedLang changes (e.g. parent re-mounts with a pre-set lang)
  // Re-translate when selectedLang changes (e.g. parent re-mounts with a pre-set lang)

  // Mount-time auto-translate for inline mode
  // Mount-time auto-translate for inline mode

  return (
    <div className={cn("space-y-2", className)}>
      {/* Currently displayed text (original or translated) */}
      <div className="text-xs sm:text-xs sm:text-sm text-text leading-relaxed whitespace-pre-wrap">
        {loading
          ? <div className="flex items-center">
              <Rings
                visible={true}
                height="30"
                width="30"
                color="#4fa94d"
                ariaLabel="rings-loading"
                wrapperStyle={{}}
                wrapperClass=""
              />
             <span>Translating...</span>
            </div>
          : (translated ?? text)}
      </div>

      {/* Controls: language picker + translate button */}

      <div className="flex items-center gap-2">
        <Select onValueChange={(value) => handleLangSelect(value)}>
          <SelectTrigger className="border-2 p-2 rounded-sm text-xs size-auto">
            <SelectValue placeholder="Languages" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGS.map((code) => (
              <SelectItem key={code} value={code}>
                {LANG_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-[11px] sm:text-[11px] sm:text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
