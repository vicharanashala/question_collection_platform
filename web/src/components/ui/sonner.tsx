import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border-border-subtle group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-text-secondary',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-surface-variant group-[.toast]:text-text-secondary',
          success: 'group-[.toaster]:border-success',
          error: 'group-[.toaster]:border-destructive',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }