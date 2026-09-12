import { useEffect, useState } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UserCategory, UserRole } from '@/types'
import { Loader2, UserRound } from 'lucide-react'

type CreatableRole = Exclude<UserRole, 'super_admin'>

interface AddUserForm {
  name: string
  mobileNumber: string
  role: CreatableRole
  category: UserCategory
}

const INITIAL_FORM: AddUserForm = {
  name: '',
  mobileNumber: '',
  role: 'user',
  category: 'farmer',
}

const selectClassName = 'mt-1 flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 py-2 text-sm text-text disabled:cursor-not-allowed disabled:opacity-60 dark:!bg-surface-variant'

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null
}

export function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<AddUserForm>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const isEndUser = form.role === 'user'

  useEffect(() => {
    if (!open) return
    setForm(INITIAL_FORM)
    setErrors({})
    setFormError('')
  }, [open])

  function setField<K extends keyof AddUserForm>(field: K, value: AddUserForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const { [field]: _removed, ...rest } = current
      return rest
    })
    setFormError('')
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Enter the full name.'
    if (!/^\d{10}$/.test(form.mobileNumber.trim())) {
      next.mobileNumber = 'Enter a valid 10-digit mobile number.'
    }
    if (isEndUser && !form.category) next.category = 'Select a category.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return
    setCreating(true)
    setFormError('')
    try {
      await adminApi.createUser({
        name: form.name.trim(),
        mobileNumber: form.mobileNumber.trim(),
        role: form.role,
        ...(isEndUser ? { category: form.category } : {}),
      })
      onCreated()
      onOpenChange(false)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to create user'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !creating && onOpenChange(next)}>
      <DialogContent className="flex h-[85vh] max-h-[85vh] !w-[85vw] !max-w-[85vw] grid-rows-none flex-col gap-0 overflow-hidden p-2 sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b border-border-subtle px-5 py-4 pr-12 sm:px-7 sm:py-5">
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create an account using the user&apos;s basic details and assigned role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <section className="rounded-xl border border-border-subtle bg-surface-variant/25 p-5 sm:p-6">
              <div className="mb-6 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-text">Account information</h3>
                  <p className="mt-0.5 text-sm text-text-tertiary">Enter the details required to create this account.</p>
                </div>
              </div>

              <div className="overflow-hidden p-1">
                <div>
                  <Label htmlFor="add-user-name">Full Name *</Label>
                  <Input id="add-user-name" className="mt-1" value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Ramesh Kumar" maxLength={80} />
                  <FieldError message={errors.name} />
                </div>
                <div>
                  <Label htmlFor="add-user-mobile">Mobile Number *</Label>
                  <Input id="add-user-mobile" className="mt-1" type="tel" inputMode="numeric" value={form.mobileNumber} onChange={(event) => setField('mobileNumber', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
                  <FieldError message={errors.mobileNumber} />
                </div>
                <div>
                  <Label htmlFor="add-user-role">Role *</Label>
                  <select id="add-user-role" className={selectClassName} value={form.role} onChange={(event) => setField('role', event.target.value as CreatableRole)}>
                    <option value="user">User</option>
                    <option value="curator">Curator</option>
                    <option value="finance">Finance</option>
                    <option value="distributor">Distributor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {isEndUser && (
                  <div>
                    <Label htmlFor="add-user-category">Category *</Label>
                    <select id="add-user-category" className={selectClassName} value={form.category} onChange={(event) => setField('category', event.target.value as UserCategory)}>
                      <option value="farmer">Farmer</option>
                      <option value="fpo">FPO Member</option>
                      <option value="student">Student</option>
                      <option value="volunteer">Volunteer</option>
                      <option value="ngo">NGO Partner</option>
                    </select>
                    <FieldError message={errors.category} />
                  </div>
                )}
              </div>
            </section>

            {formError && <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</div>}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border-subtle bg-surface px-5 py-4 sm:px-7">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button>
            <Button type="submit" disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}