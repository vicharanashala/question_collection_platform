import * as React from 'react'
import type { DateRange } from '@daypicker/react'
import { CalendarIcon, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from './ui/button'
import { Calendar } from './ui/calender'
import { Label } from './ui/label'

interface DateRangeFilterProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  label?: string
  className?: string
  hideLabel?: boolean
  placeholder?: string
}

/** A reusable DayPicker-backed date-range control. */
export function DateRangeFilter({
  value,
  onChange,
  label = 'Date range',
  className = '',
  hideLabel = false,
  placeholder = 'Select a start and end date',
}: DateRangeFilterProps) {
  const [isCalendarVisible, setIsCalendarVisible] = React.useState(false)

  function handleDateSelect(range: DateRange | undefined) {
    if (!range?.from) {
      onChange(undefined)
      return
    }

    // This DayPicker version reports the first range click as from === to.
    // Keep it as a start-only choice, so the user can select an end date next.
    const isFirstClick = !value?.from
      && range.to
      && range.from.getTime() === range.to.getTime()
    if (isFirstClick) {
      onChange({ from: range.from })
      return
    }

    onChange(range)
    if (range.to) setIsCalendarVisible(false)
  }

  function clearDates() {
    onChange(undefined)
    setIsCalendarVisible(false)
  }

  const triggerText = value?.from
    ? value.to
      ? `${format(value.from, 'LLL dd, y')} – ${format(value.to, 'LLL dd, y')}`
      : `${format(value.from, 'LLL dd, y')} – Select end date`
    : placeholder

  return (
    <div className={`relative min-w-0 ${className}`}>
      {!hideLabel && <Label className="text-xs">{label}</Label>}
      <Button
        type="button"
        variant="outline"
        className="mt-1 w-full justify-start bg-background text-left font-normal hover:bg-accent/50"
        onClick={() => setIsCalendarVisible((visible) => !visible)}
        aria-expanded={isCalendarVisible}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-text-tertiary" />
        <span className={value?.from ? 'text-foreground' : 'text-text-tertiary'}>{triggerText}</span>
        {isCalendarVisible ? <ChevronUp className="ml-auto h-4 w-4 text-text-tertiary" /> : <ChevronDown className="ml-auto h-4 w-4 text-text-tertiary" />}
      </Button>

      {isCalendarVisible && (
        <div className="absolute right-0 z-50 mt-2 w-[20rem] rounded-lg border border-border-subtle bg-popover text-popover-foreground shadow-lg sm:w-[22rem]">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={handleDateSelect}
            numberOfMonths={1}
            className="w-full"
          />
          {value?.from && (
            <div className="flex justify-end border-t border-border-subtle px-2 py-1">
              <Button type="button" variant="ghost" size="sm" onClick={clearDates}>
                <RefreshCcw className="mr-2 h-4 w-4" />Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
