import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { authApi, getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { getInitials } from '@/lib/utils'
import { Phone, MapPin, Globe, Edit2, Leaf, GraduationCap, Building2, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LANGUAGES, categoryLabel } from '@/constants/public'

export function PublicProfilePage() {
  const { user, updateUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [languagePreference, setLanguagePreference] = useState('')

  if (!user) return null
  const initials = getInitials(user.name, user.mobileNumber)
  const cat = user.category

  function startEdit() {
    setName(user?.name || '')
    setLanguagePreference(user?.languagePreference || 'en')
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    try {
      const { user: fresh } = await authApi.updateMe({ name: name.trim(), languagePreference })
      updateUser(fresh)
      toast.success('Profile updated')
      setEditing(false)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save changes.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">My Profile</h2>
          <p className="text-sm text-text-secondary mt-0.5">Your account information.</p>
        </div>
        <Button onClick={startEdit} className="bg-emerald-500 hover:bg-emerald-600">
          <Edit2 className="h-4 w-4" /> Edit
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-xl font-bold">{initials}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-foreground">{user.name || '—'}</h3>
            <p className="text-sm text-text-secondary">{categoryLabel(cat)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-text-tertiary"><Phone className="h-3 w-3" />{user.mobileNumber}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-text-tertiary">Mobile</Label>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Phone className="h-4 w-4 text-emerald-600" />{user.mobileNumber}</p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-text-tertiary">Language</Label>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><Globe className="h-4 w-4 text-emerald-600" />{LANGUAGES.find((l) => l.code === user.languagePreference)?.label ?? user.languagePreference ?? '—'}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-xs uppercase tracking-wider text-text-tertiary">Location</Label>
            <p className="flex items-center gap-2 text-sm font-medium text-foreground"><MapPin className="h-4 w-4 text-emerald-600" />{[user.block, user.district, user.state].filter(Boolean).join(', ') || '—'}</p>
          </div>
        </CardContent>
      </Card>

      {(cat === 'student' || user.courseName || user.universityName) && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-emerald-600" /><h4 className="text-sm font-bold text-foreground">Education</h4></div>
            {user.courseName && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Course</span><span className="col-span-2 font-medium">{user.courseName}</span></div>}
            {user.collegeName && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">College</span><span className="col-span-2 font-medium">{user.collegeName}</span></div>}
            {user.universityName && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">University</span><span className="col-span-2 font-medium">{user.universityName}</span></div>}
          </CardContent>
        </Card>
      )}

      {(cat === 'farmer' || user.cropType) && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2"><Leaf className="h-4 w-4 text-emerald-600" /><h4 className="text-sm font-bold text-foreground">Farming</h4></div>
            {user.cropType && (
              <div className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-text-tertiary">Primary crops</span>
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {user.cropType.split(',').map((c) => c.trim()).filter(Boolean).map((c) => <span key={c} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{c}</span>)}
                </div>
              </div>
            )}
            {user.farmSize && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Farm size</span><span className="col-span-2 font-medium">{user.farmSize} acres</span></div>}
            {user.season && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Season</span><span className="col-span-2 font-medium">{user.season}</span></div>}
          </CardContent>
        </Card>
      )}

      {(cat === 'ngo' || cat === 'fpo' || user.organizationName) && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-emerald-600" /><h4 className="text-sm font-bold text-foreground">Organization</h4></div>
            {user.organizationName && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Name</span><span className="col-span-2 font-medium">{user.organizationName}</span></div>}
            {user.organisationType && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Type</span><span className="col-span-2 font-medium">{user.organisationType}</span></div>}
            {user.organizationRole && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Your role</span><span className="col-span-2 font-medium">{user.organizationRole}</span></div>}
            {user.numberOfFarmers != null && <div className="grid grid-cols-3 gap-2 text-sm"><span className="text-text-tertiary">Farmers reached</span><span className="col-span-2 font-medium">{user.numberOfFarmers}</span></div>}
          </CardContent>
        </Card>
      )}

      <Dialog open={editing} onOpenChange={(v) => !saving && setEditing(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pname">Full name</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label>Preferred language</Label>
              <Select value={languagePreference} onValueChange={setLanguagePreference}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}