import { useState, useEffect } from "react";
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

type View = "original" | "en";

interface TranslatableTextProps {
  /** The original, untranslated text. */
  text: string;
  /** Optional CSS class for the container. */
  className?: string;
}

/**
 * Displays `text` and lets the user switch between the original
 * and its English translation. The English translation is fetched
 * lazily and cached until `text` changes.
 */
export function TranslatableText({ text, className }: TranslatableTextProps) {
  const [view, setView] = useState<View>("original");
  const [english, setEnglish] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset everything if the original text changes.
  useEffect(() => {
    setView("original");
    setEnglish(null);
    setError(null);
  }, [text]);

  async function handleChange(value: string) {
    const next = value as View;
    setError(null);

    if (next === "original") {
      setView("original");
      return;
    }

    // Already translated: just switch back, no API call.
    if (english !== null) {
      setView("en");
      return;
    }

    if (!text.trim() || loading) return;

    setLoading(true);
    try {
      // Source language is auto-detected; target is always English.
      const result = await speechApi.translate(text.trim(), "en-IN", "auto");
      setEnglish(result.translatedText);
      setView("en");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Translation unavailable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs sm:text-sm text-text leading-relaxed whitespace-pre-wrap">
        {loading ? (
          <div className="flex items-center">
            <Rings
              visible={true}
              height="30"
              width="30"
              color="#4fa94d"
              ariaLabel="rings-loading"
            />
            <span>Translating...</span>
          </div>
        ) : view === "en" && english !== null ? (
          english
        ) : (
          text
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={view} onValueChange={handleChange} disabled={loading}>
          <SelectTrigger className="border-2 p-2 rounded-sm text-xs size-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="original">Original</SelectItem>
            <SelectItem value="en">English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-[11px] sm:text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}