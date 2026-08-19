import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CropImage } from '@/components/CropImage'
import { CROPS } from '@/constants/public'
import { cn } from '@/lib/utils'

interface CropPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Currently selected crop names */
  selected: string[]
  onSelectionChange: (crops: string[]) => void
  /** Max crops allowed (0 = unlimited) */
  max?: number
}

export function CropPickerModal({
  open,
  onOpenChange,
  selected,
  onSelectionChange,
  max = 0,
}: CropPickerModalProps) {
  const [query, setQuery] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [otherText, setOtherText] = useState('')

  const allOptions = useMemo(
    () => CROPS.map((c) => ({ value: c, label: c })),
    [],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return allOptions
    const q = query.toLowerCase()
    return allOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [query, allOptions])

  function toggleCrop(value: string) {
    if (selected.includes(value)) {
      onSelectionChange(selected.filter((c) => c !== value))
    } else {
      if (max > 0 && selected.length >= max) return
      onSelectionChange([...selected, value])
    }
  }

  function confirmOther() {
    const v = otherText.trim()
    if (!v) return
    if (!selected.includes(v)) {
      if (!(max > 0 && selected.length >= max)) {
        onSelectionChange([...selected, v])
      }
    }
    handleClose()
  }

  function handleClose() {
    setQuery('')
    setShowOther(false)
    setOtherText('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[92dvh] sm:max-h-[85vh] max-w-2xl flex-col p-0 sm:p-0 max-md:bottom-0 max-md:top-auto max-md:translate-y-0 max-md:max-w-none max-md:rounded-b-none max-md:animate-in max-md:fade-in-0 max-md:slide-in-from-bottom-0">
        <DialogHeader className="border-b border-border-subtle px-4 py-3">
          <DialogTitle className="text-sm sm:text-sm sm:text-base font-semibold">Select crops</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowOther(false) }}
              placeholder="Search crops…"
              className="rounded-full bg-surface-variant pl-9"
            />
          </div>
        </div>

        {/* Scrollable grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {showOther ? (
            <div className="space-y-3 px-2 py-3">
              <Label htmlFor="other-crop-manual">Enter crop name</Label>
              <Input
                id="other-crop-manual"
                autoFocus
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="e.g. exotic mushroom"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmOther() } }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowOther(false); setOtherText('') }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!otherText.trim()}
                  onClick={confirmOther}
                >
                  Use this crop
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs sm:text-xs sm:text-sm text-muted-foreground">
              No crops match your search
            </p>
          ) : (
            <div className="grid grid-cols-3 xs:grid-cols-4 gap-x-2 gap-y-4 sm:gap-y-5">
              {filtered.map((c) => {
                const isSelected = selected.includes(c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCrop(c.value)}
                    disabled={max > 0 && !isSelected && selected.length >= max}
                    className={cn(
                      "flex flex-col items-center gap-1.5 disabled:opacity-40",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="relative">
                      <div
                        className={cn(
                          "flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center overflow-hidden rounded-full border-2 transition-colors",
                          isSelected
                            ? "border-emerald-500"
                            : "border-border-subtle hover:border-emerald-300",
                        )}
                      >
                        <CropImage name={c.value} className="h-full w-full rounded-full object-cover" />
                      </div>
                      {isSelected && (
                        <div className="absolute -bottom-0.5 -right-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow">
                          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <span
                      className={cn(
                        "line-clamp-2 text-center text-[11px] sm:text-[11px] sm:text-xs leading-tight",
                        isSelected
                          ? "font-semibold text-emerald-700 dark:text-emerald-300"
                          : "font-medium text-foreground",
                      )}
                    >
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Other crop CTA */}
        {!showOther && (
          <div className="border-t border-border-subtle px-4 py-3">
            <button
              type="button"
              onClick={() => setShowOther(true)}
              className="flex w-full items-center justify-center rounded-md px-3 py-2 text-center text-xs sm:text-xs sm:text-sm font-medium text-emerald-700 hover:bg-surface-variant dark:text-emerald-300"
            >
              Can't find your crop? Enter manually
            </button>
          </div>
        )}

        {/* Footer with count + done */}
        {selected.length > 0 && (
          <div className="sticky bottom-0 border-t border-border-subtle bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs sm:text-xs sm:text-sm text-muted-foreground">
                {selected.length} selected{max > 0 ? ` / ${max} max` : ''}
              </p>
              <Button size="sm" onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}