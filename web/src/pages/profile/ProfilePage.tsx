import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { getInitials } from '@/lib/utils'
import { Phone, Shield, MapPin, Calendar, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { authApi, getErrorMessage } from '@/api/client'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'te', label: 'Telugu' },
  { value: 'bn', label: 'Bengali' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'pa', label: 'Punjabi' },
]

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [savingLang, setSavingLang] = useState(false)

  if (!user) return null

  const initials = getInitials(user.name || '', user.mobileNumber)

  async function handleLanguageChange(lang: string) {
    if (!user) return
    setSavingLang(true)
    try {
      const { user: updated } = await authApi.updateMe({ languagePreference: lang })
      updateUser({ languagePreference: updated.languagePreference })
      toast.success('Language preference saved')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to update language'))
    } finally {
      setSavingLang(false)
    }
  }

  function savePreference(locale: string) {
    localStorage.setItem('locale_preference', locale)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Hero card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black bg-primary text-primary-foreground">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-text">{user.name || 'Unnamed User'}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs text-text-secondary bg-surface-variant px-2 py-0.5 rounded-full capitalize">
                  <Shield className="h-3 w-3" /> {user.role.replace('_', ' ')}
                </span>
                <span className="text-sm text-text-tertiary">{user.mobileNumber}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { icon: Phone, label: 'Mobile', value: user.mobileNumber },
            { icon: MapPin, label: 'Location', value: [user.district, user.state].filter(Boolean).join(', ') || '—' },
            {
              icon: Calendar,
              label: 'Joined',
              value: user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—',
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2.5 text-text-tertiary">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <span className="font-medium text-text">{value}</span>
            </div>
          ))}

          <Separator />

          {/* Language preference */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-text-tertiary">
              <Globe className="h-4 w-4" />
              Language
            </div>
            <select
              className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 pr-6 text-sm text-text"
              value={user.languagePreference || 'en'}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={savingLang}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}