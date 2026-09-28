import { AlertCircle } from 'lucide-react'

interface FieldErrorProps {
  id: string
  message?: string
}

// Inline validation message shown under a field; the id links it to the field via aria-describedby.
export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
