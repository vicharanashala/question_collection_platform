import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface StatusOption<K extends string> {
  key: K
  label: string
}

interface SubmissionStatusFilterProps<K extends string> {
  options: StatusOption<K>[]
  value: K
  onChange: (key: K) => void
}

/** Status pills on larger screens, a dropdown on phones. The empty key means "all". */
export function SubmissionStatusFilter<K extends string>({ options, value, onChange }: SubmissionStatusFilterProps<K>) {
  return (
    <>
      <div className="hidden sm:flex gap-2 overflow-x-auto pb-1">
        {options.map((s) => (
          <button key={s.key || 'all'} type="button" onClick={() => onChange(s.key)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors', value === s.key ? 'bg-primary text-primary-foreground' : 'border border-border-subtle bg-surface text-text-secondary hover:border-primary/40 dark:hover:border-primary/60')}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="sm:hidden">
        <Select value={value} onValueChange={(v) => onChange(v as K)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={options[0]?.label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((s) => (
              <SelectItem key={s.key || 'all'} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
