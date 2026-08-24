import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import type { SupportedLanguageCode } from '@/i18n'
import { authApi, adminApi, lgdApi, getErrorMessage } from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn, getInitials, formatDate } from '@/lib/utils'
import {
  Phone, MapPin, Calendar, Globe, HelpCircle, Edit2,
  Shield, CheckCircle, AlertCircle, Clock,
  Leaf, Users, GraduationCap, Building2, MapPinned,
  TrendingUp, FileText, Lock, User,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AuthUser } from '@/types'
import type { LgdState, LgdDistrict, LgdSubDistrict, LgdVillage, LgdKvk } from '@/api/client'

const LANGUAGES = [
  { value: 'en',  label: 'English' },
  { value: 'hi',  label: 'Hindi' },
  { value: 'mr',  label: 'Marathi' },
  { value: 'ta',  label: 'Tamil' },
  { value: 'te',  label: 'Telugu' },
  { value: 'bn',  label: 'Bengali' },
  { value: 'kn',  label: 'Karnataka' },
  { value: 'ml',  label: 'Malayalam' },
  { value: 'gu',  label: 'Gujarati' },
  { value: 'pa',  label: 'Punjabi' },
]

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']

const ROLE_LABELS: Record<string, string> = {
  user:        'Farmer',
  curator:     'Curator',
  admin:       'Admin',
  super_admin: 'Super Admin',
  finance:     'Finance',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    verified:      { label: 'Verified',       cls: 'bg-emerald-500 text-white',        icon: CheckCircle },
    pending:       { label: 'Pending Review', cls: 'bg-amber-500 text-white',          icon: Clock },
    manual_review: { label: 'Under Review',   cls: 'bg-blue-500 text-white',           icon: AlertCircle },
    suspended:     { label: 'Suspended',      cls: 'bg-orange-400 text-white',         icon: AlertCircle },
    banned:        { label: 'Banned',         cls: 'bg-red-600 text-white',            icon: AlertCircle },
  }
  const { label, cls, icon: Icon } = map[status] ?? {
    label: status, cls: 'bg-muted text-muted-foreground', icon: AlertCircle,
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold capitalize', cls)}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

function FieldRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between text-xs sm:text-xs sm:text-sm">
      <div className="flex items-center gap-2.5 text-text-tertiary">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="font-medium text-text text-right">{value || '—'}</span>
    </div>
  )
}

// ─── Edit dialog ───────────────────────────────────────────────────────────────

interface EditForm {
  name: string
  age: string
  gender: string
  state: string
  district: string
  block: string
  village: string
  kvk: string
  farmSize: string
  cropType: string
  courseName: string
  collegeName: string
  universityName: string
  organisationType: string
  organizationName: string
  organizationRole: string
  numberOfFarmers: string
  /**
   * `organizationState` is stored as `string[]` on the server (an organisation
   * can operate in multiple states). The edit dialog renders this as a
   * comma-separated text input for simplicity — we split it back into an array
   * on save and join it for display.
   */
  organizationState: string
  organizationDistrict: string
  organizationBlock: string
  organizationVillage: string
  season: string
  languagePreference: string
}

function blank(s: string | null | undefined) { return s ?? '' }

/** Convert the server-side `string[] | null` into a comma-separated display string. */
function orgStatesToString(states: string[] | null | undefined): string {
  return states && states.length > 0 ? states.join(', ') : ''
}

/**
 * Convert the comma-separated text input back to a `string[]`. Filters out
 * blank entries so a trailing comma doesn't add an empty string.
 */
function parseOrgStates(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function EditProfileDialog({
  user,
  open,
  onClose,
  onSaved,
}: {
  user: AuthUser
  open: boolean
  onClose: () => void
  onSaved: (u: AuthUser) => void
}) {
  const { setLanguage } = useLanguage()
  const [tab, setTab] = useState('personal')
  const [saving, setSaving] = useState(false)

  // LGD location dropdown options
  const [states,       setStates]       = useState<LgdState[]>([])
  const [districts,    setDistricts]    = useState<LgdDistrict[]>([])
  const [subdistricts, setSubdistricts] = useState<LgdSubDistrict[]>([])
  const [villages,     setVillages]     = useState<LgdVillage[]>([])
  const [kvks,         setKvks]         = useState<LgdKvk[]>([])

  // Loading flags for dependent dropdowns
  const [loadingDistricts,    setLoadingDistricts]    = useState(false)
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false)
  const [loadingVillages,     setLoadingVillages]     = useState(false)
  const [loadingKvks,         setLoadingKvks]         = useState(false)

  // Load all states on dialog open
  useEffect(() => {
    if (!open) return
    lgdApi.getStates().then(({ states }) => setStates(states)).catch(() => {})
  }, [open])

  // When dialog opens with pre-filled state/district, pre-load their children
  useEffect(() => {
    if (!open) return
    const s = form.state
    const d = form.district
    const b = form.block
    if (s) {
      lgdApi.getDistricts(s).then(({ districts }) => {
        setDistricts(districts)
        if (d) {
          lgdApi.getSubDistricts(d).then(({ subdistricts }) => {
            setSubdistricts(subdistricts)
            if (b) {
              lgdApi.getVillages(b).then(({ villages }) => setVillages(villages)).catch(() => {})
            }
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  }, [open])

  const [form, setForm] = useState<EditForm>({
    name:               blank(user.name),
    age:                user.age            ? String(user.age)            : '',
    gender:             blank(user.gender),
    state:              blank(user.state),
    district:           blank(user.district),
    block:              blank(user.block),
    village:            blank(user.village),
    kvk:                blank(user.kvk),
    farmSize:           blank(user.farmSize),
    cropType:           blank(user.cropType),
    courseName:         blank(user.courseName),
    collegeName:        blank(user.collegeName),
    universityName:     blank(user.universityName),
    organisationType:   blank(user.organisationType),
    organizationName:   blank(user.organizationName),
    organizationRole:   blank(user.organizationRole),
    numberOfFarmers:    user.numberOfFarmers != null ? String(user.numberOfFarmers) : '',
    organizationState:   orgStatesToString(user.organizationState),
    organizationDistrict: blank(user.organizationDistrict),
    organizationBlock:   blank(user.organizationBlock),
    organizationVillage: blank(user.organizationVillage),
    season:             blank(user.season),
    languagePreference: blank(user.languagePreference),
  })

  // Reset form when user changes or dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        name:               blank(user.name),
        age:                user.age            ? String(user.age)            : '',
        gender:             blank(user.gender),
        state:              blank(user.state),
        district:           blank(user.district),
        block:              blank(user.block),
        village:            blank(user.village),
        kvk:                blank(user.kvk),
        farmSize:           blank(user.farmSize),
        cropType:           blank(user.cropType),
        courseName:         blank(user.courseName),
        collegeName:        blank(user.collegeName),
        universityName:     blank(user.universityName),
        organisationType:   blank(user.organisationType),
        organizationName:   blank(user.organizationName),
        organizationRole:   blank(user.organizationRole),
        numberOfFarmers:    user.numberOfFarmers != null ? String(user.numberOfFarmers) : '',
        organizationState:   orgStatesToString(user.organizationState),
        organizationDistrict: blank(user.organizationDistrict),
        organizationBlock:   blank(user.organizationBlock),
        organizationVillage: blank(user.organizationVillage),
        season:             blank(user.season),
        languagePreference: blank(user.languagePreference),
      })
      setTab('personal')
    }
  }, [open, user])

  function set(key: keyof EditForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Cascade: reset children when a parent changes
  function onStateChange(code: string) {
    setForm((f) => ({ ...f, state: code, district: '', block: '', village: '', kvk: '' }))
    setDistricts([]); setSubdistricts([]); setVillages([]); setKvks([])
    if (!code) return
    setLoadingDistricts(true)
    lgdApi.getDistricts(code).then(({ districts }) => setDistricts(districts)).catch(() => {}).finally(() => setLoadingDistricts(false))
  }

  function onDistrictChange(code: string) {
    setForm((f) => ({ ...f, district: code, block: '', village: '', kvk: '' }))
    setSubdistricts([]); setVillages([]); setKvks([])
    if (!code) return
    setLoadingSubdistricts(true)
    lgdApi.getSubDistricts(code).then(({ subdistricts }) => setSubdistricts(subdistricts)).catch(() => {}).finally(() => setLoadingSubdistricts(false))
  }

  function onBlockChange(code: string) {
    setForm((f) => ({ ...f, block: code, village: '', kvk: '' }))
    setVillages([]); setKvks([])
    if (!code) return
    setLoadingVillages(true)
    lgdApi.getVillages(code).then(({ villages }) => setVillages(villages)).catch(() => {}).finally(() => setLoadingVillages(false))
  }

  function onVillageChange(code: string) {
    setForm((f) => ({ ...f, village: code, kvk: '' }))
    setKvks([])
    if (!code) return
    // KVK is keyed by district, not village — find the district code from current form
    const distCode = form.district
    if (!distCode) return
    setLoadingKvks(true)
    lgdApi.getKvks(distCode).then(({ kvks }) => setKvks(kvks)).catch(() => {}).finally(() => setLoadingKvks(false))
  }

  function onKvkChange(code: string) {
    setForm((f) => ({ ...f, kvk: code }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Name cannot be empty'); return }
    setSaving(true)
    try {
      const payload: Record<string, any> = { name: form.name.trim() }
      if (form.age)                   payload.age                  = parseInt(form.age) || 0
      if (form.gender)                payload.gender               = form.gender
      if (form.state)                 payload.state                = form.state
      if (form.district)              payload.district             = form.district
      if (form.block)                 payload.block                = form.block
      if (form.village)               payload.village              = form.village
      if (form.kvk)                   payload.kvk                  = form.kvk
      if (form.farmSize)              payload.farmSize             = form.farmSize
      if (form.cropType)              payload.cropType             = form.cropType
      if (form.courseName)            payload.courseName           = form.courseName
      if (form.collegeName)           payload.collegeName          = form.collegeName
      if (form.universityName)        payload.universityName       = form.universityName
      if (form.organisationType)      payload.organisationType     = form.organisationType
      if (form.organizationName)      payload.organizationName     = form.organizationName
      if (form.organizationRole)      payload.organizationRole     = form.organizationRole
      if (form.numberOfFarmers)       payload.numberOfFarmers      = parseInt(form.numberOfFarmers) || 0
      if (form.organizationState)     payload.organizationState    = parseOrgStates(form.organizationState)
      if (form.organizationDistrict)  payload.organizationDistrict = form.organizationDistrict
      if (form.organizationBlock)     payload.organizationBlock    = form.organizationBlock
      if (form.organizationVillage)   payload.organizationVillage  = form.organizationVillage
      if (form.season)                payload.season               = form.season
      if (form.languagePreference)    payload.languagePreference   = form.languagePreference

      const { user: updated } = await authApi.updateMe(payload)
      onSaved(updated)
      toast.success('Profile updated')
      onClose()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to update profile'))
    } finally {
      setSaving(false)
    }
  }

  const rowCls = 'grid grid-cols-[140px_1fr] items-center gap-3'
  const labelCls = 'text-xs sm:text-xs sm:text-sm text-text-secondary'
  const inputCls = 'h-8 text-xs sm:text-sm'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-4 w-4" />
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="farming">Farming</TabsTrigger>
            <TabsTrigger value="org">Org</TabsTrigger>
          </TabsList>

          {/* ── Personal ── */}
          <TabsContent value="personal" className="space-y-4 mt-4">
            <div className={rowCls}>
              <Label className={labelCls}>Full Name *</Label>
              <Input
                className={inputCls}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={100}
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Age</Label>
              <Input
                className={inputCls}
                type="number"
                min={1}
                max={120}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                placeholder="e.g. 35"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Gender</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">Select…</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Language</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
                value={form.languagePreference}
                onChange={(e) => {
                  const v = e.target.value
                  set("languagePreference", v)
                  // Live preview — switch the whole app's i18n language so the
                  // page re-renders in the chosen language immediately. The
                  // choice is also sent to the backend on Save.
                  void setLanguage(v as SupportedLanguageCode)
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Student fields shown in personal tab */}
            <Separator />
            <p className="text-[11px] sm:text-[11px] sm:text-xs font-semibold text-text-tertiary uppercase tracking-wide">
              Education (Student)
            </p>
            <div className={rowCls}>
              <Label className={labelCls}>Course</Label>
              <Input
                className={inputCls}
                value={form.courseName}
                onChange={(e) => set("courseName", e.target.value)}
                placeholder="B.Sc Agriculture"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>College</Label>
              <Input
                className={inputCls}
                value={form.collegeName}
                onChange={(e) => set("collegeName", e.target.value)}
                placeholder="ABC College"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>University</Label>
              <Input
                className={inputCls}
                value={form.universityName}
                onChange={(e) => set("universityName", e.target.value)}
                placeholder="XYZ University"
              />
            </div>
          </TabsContent>

          {/* ── Location ── */}
          <TabsContent value="location" className="space-y-4 mt-4">
            <div className={rowCls}>
              <Label className={labelCls}>State</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus"
                value={form.state}
                onChange={(e) => onStateChange(e.target.value)}
              >
                <option value="">Select State…</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>District</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
                value={form.district}
                onChange={(e) => onDistrictChange(e.target.value)}
                disabled={!form.state || loadingDistricts}
              >
                <option value="">Select District…</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Block</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
                value={form.block}
                onChange={(e) => onBlockChange(e.target.value)}
                disabled={!form.district || loadingSubdistricts}
              >
                <option value="">Select Block…</option>
                {subdistricts.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Village</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
                value={form.village}
                onChange={(e) => onVillageChange(e.target.value)}
                disabled={!form.block || loadingVillages}
              >
                <option value="">Select Village…</option>
                {villages.map((v) => (
                  <option key={v.code} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>KVK</Label>
              <select
                className="h-8 rounded-md border border-border-subtle bg-surface-variant px-2 text-xs sm:text-xs sm:text-sm text-text focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
                value={form.kvk}
                onChange={(e) => onKvkChange(e.target.value)}
                disabled={!form.district || loadingKvks}
              >
                <option value="">Select KVK…</option>
                {kvks.map((k) => (
                  <option key={k.code} value={k.address}>
                    {k.address}
                  </option>
                ))}
              </select>
            </div>
          </TabsContent>

          {/* ── Farming ── */}
          <TabsContent value="farming" className="space-y-4 mt-4">
            <div className={rowCls}>
              <Label className={labelCls}>Farm Size</Label>
              <Input
                className={inputCls}
                value={form.farmSize}
                onChange={(e) => set("farmSize", e.target.value)}
                placeholder="e.g. 5 acres"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Crop Type</Label>
              <Input
                className={inputCls}
                value={form.cropType}
                onChange={(e) => set("cropType", e.target.value)}
                placeholder="e.g. Wheat, Rice"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Season</Label>
              <Input
                className={inputCls}
                value={form.season}
                onChange={(e) => set("season", e.target.value)}
                placeholder="e.g. Kharif, Rabi"
              />
            </div>
          </TabsContent>

          {/* ── Organisation ── */}
          <TabsContent value="org" className="space-y-4 mt-4">
            <div className={rowCls}>
              <Label className={labelCls}>Org. Type</Label>
              <Input
                className={inputCls}
                value={form.organisationType}
                onChange={(e) => set("organisationType", e.target.value)}
                placeholder="e.g. FPO, NGO, Volunteer"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Org. Name</Label>
              <Input
                className={inputCls}
                value={form.organizationName}
                onChange={(e) => set("organizationName", e.target.value)}
                placeholder="Organisation name"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Your Role</Label>
              <Input
                className={inputCls}
                value={form.organizationRole}
                onChange={(e) => set("organizationRole", e.target.value)}
                placeholder="e.g. Coordinator, President"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>No. of Farmers</Label>
              <Input
                className={inputCls}
                type="number"
                min={1}
                value={form.numberOfFarmers}
                onChange={(e) => set("numberOfFarmers", e.target.value)}
                placeholder="e.g. 250"
              />
            </div>
            <Separator />
            <p className="text-[11px] sm:text-[11px] sm:text-xs font-semibold text-text-tertiary uppercase tracking-wide">
              Org. Location
            </p>
            <div className={rowCls}>
              <Label className={labelCls}>Org. State(s)</Label>
              <Input
                className={inputCls}
                value={form.organizationState}
                onChange={(e) => set("organizationState", e.target.value)}
                placeholder="e.g. Assam, Bihar, Arunachal Pradesh"
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Org. District</Label>
              <Input
                className={inputCls}
                value={form.organizationDistrict}
                onChange={(e) => set("organizationDistrict", e.target.value)}
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Org. Block</Label>
              <Input
                className={inputCls}
                value={form.organizationBlock}
                onChange={(e) => set("organizationBlock", e.target.value)}
              />
            </div>
            <div className={rowCls}>
              <Label className={labelCls}>Org. Village</Label>
              <Input
                className={inputCls}
                value={form.organizationVillage}
                onChange={(e) => set("organizationVillage", e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stats strip ───────────────────────────────────────────────────────────────

function fetchUserQuestions(userId: string): Promise<any[]> {
  return adminApi.getUserDetail(userId).then((r) => r.questions ?? []).catch(() => [])
}

function StatsStrip({ userId }: { userId: string }) {
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUserQuestions(userId).then(setQuestions).catch(() => {}).finally(() => setLoading(false))
  }, [userId])

  if (loading) return <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
    {[1,2,3,4].map((i) => <div key={i} className="h-20 rounded-xl bg-surface-variant animate-pulse" />)}
  </div>

  const counts = {
    total:    questions.length,
    approved: questions.filter((q) => q.status === 'approved').length,
    rejected: questions.filter((q) => q.status === 'rejected').length,
    pending:  questions.filter((q) => ['pending', 'held'].includes(q.status)).length,
  }
  const items = [
    { label: 'Total Questions', value: counts.total,    icon: FileText,   bg: 'bg-blue-50 dark:bg-blue-950/40',    text: 'text-blue-600' },
    { label: 'Approved',        value: counts.approved, icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600' },
    { label: 'Pending',         value: counts.pending,  icon: Clock,      bg: 'bg-amber-50 dark:bg-amber-950/40',   text: 'text-amber-600' },
    { label: 'Rejected',        value: counts.rejected, icon: AlertCircle, bg: 'bg-red-50 dark:bg-red-950/40',     text: 'text-red-600' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, bg, text }) => (
        <Card key={label} className={cn('border-0 shadow-xs', bg)}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-[11px] sm:text-[11px] sm:text-xs font-medium text-muted-foreground">{label}</p>
              <p className={cn('mt-1 text-xl sm:text-2xl font-extrabold', text)}>{value}</p>
            </div>
            <Icon className={cn('h-7 w-7 opacity-60', text)} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user, updateUser } = useAuth()
  const { setLanguage } = useLanguage()
  const navigate = useNavigate()
  const [editOpen, setEditOpen] = useState(false)

  if (!user) return null

  const initials = getInitials(user.name || '', user.mobileNumber)
  const locationStr = [user.district, user.state].filter(Boolean).join(', ') || '—'

  function handleSaved(updated: AuthUser) {
    updateUser({ ...updated })
    // Switch the whole app's i18n language to match the saved preference so
    // the page re-renders in the new language immediately (the EditProfileDialog
    // already calls setLanguage for live preview, but the user might save
    // without changing the select — sync here too to keep them consistent).
    if (updated.languagePreference) {
      void setLanguage(updated.languagePreference as SupportedLanguageCode)
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text">My Profile</h2>
          <p className="text-xs sm:text-xs sm:text-sm text-text-tertiary mt-0.5">Manage your account and preferences</p>
        </div>
        <Button onClick={() => setEditOpen(true)}>
          <Edit2 className="h-4 w-4 mr-1.5" />
          Edit Profile
        </Button>
      </div>

      {/* Stats */}
      <StatsStrip userId={user.id} />

      {/* Hero card */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-full text-base sm:text-base sm:text-lg font-black bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface bg-emerald-500" title="Active" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg sm:text-lg sm:text-xl font-extrabold text-text truncate">{user.name || 'Unnamed User'}</h2>
                <Badge variant="outline" className="capitalize text-[11px] sm:text-[11px] sm:text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {ROLE_LABELS[user.role] ?? user.role}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <VerificationBadge status={user.verificationStatus ?? 'pending'} />
                <span className="text-xs sm:text-xs sm:text-sm text-text-tertiary">{user.mobileNumber}</span>
                {user.category && (
                  <Badge variant="secondary" className="capitalize text-[11px] sm:text-[11px] sm:text-xs">{user.category}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Account + Security */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldRow icon={Phone}    label="Mobile"   value={user.mobileNumber} />
            <FieldRow icon={MapPin}   label="Location" value={locationStr} />
            <FieldRow icon={Calendar} label="Joined"   value={user.createdAt ? formatDate(user.createdAt) : '—'} />
            <FieldRow
              icon={Globe}
              label="Language"
              value={LANGUAGES.find((l) => l.value === user.languagePreference)?.label ?? user.languagePreference ?? 'English'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Security & Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldRow icon={Lock}    label="Role"        value={ROLE_LABELS[user.role] ?? user.role} />
            <FieldRow icon={Clock}   label="Last Login"  value={user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'} />
            <FieldRow icon={Shield}  label="Consent"     value={user.consentGiven ? 'Given' : 'Not Given'} />
            <FieldRow icon={MapPin}  label="Active State" value={user.state || '—'} />
          </CardContent>
        </Card>
      </div>

      {/* Personal location */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-primary" />
            Personal Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'State',    value: user.state    || '—' },
              { label: 'District', value: user.district || '—' },
              { label: 'Block',    value: user.block    || '—' },
              { label: 'Village',  value: user.village  || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[11px] sm:text-[11px] sm:text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</span>
                <span className="text-xs sm:text-xs sm:text-sm font-semibold text-text">{value}</span>
              </div>
            ))}
          </div>
          {user.kvk && (
            <div className="mt-3 flex items-center gap-2 text-xs sm:text-xs sm:text-sm">
              <span className="font-medium text-text-tertiary">KVK:</span>
              <span className="text-text">{user.kvk}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Personal details */}
      {(user.age || user.gender) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold">Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.age    && <FieldRow icon={User} label="Age"     value={String(user.age)} />}
            {user.gender && <FieldRow icon={User} label="Gender"  value={user.gender} />}
          </CardContent>
        </Card>
      )}

      {/* Organisation section */}
      {(user.organizationState || user.organizationDistrict ||
        user.organizationBlock || user.organizationVillage ||
        user.organizationName || user.organizationRole) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Organisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.organizationName && <FieldRow icon={Building2} label="Org. Name" value={user.organizationName} />}
            {user.organizationRole && <FieldRow icon={Building2} label="Your Role" value={user.organizationRole} />}
            {user.organisationType && <FieldRow icon={Building2} label="Org. Type" value={user.organisationType} />}
            {user.numberOfFarmers  && <FieldRow icon={Users}    label="No. of Farmers" value={String(user.numberOfFarmers)} />}
          </CardContent>
          <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Org. State',    value: user.organizationState    || '—' },
              { label: 'Org. District', value: user.organizationDistrict || '—' },
              { label: 'Org. Block',    value: user.organizationBlock    || '—' },
              { label: 'Org. Village',  value: user.organizationVillage  || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[11px] sm:text-[11px] sm:text-xs font-medium text-text-tertiary uppercase tracking-wide">{label}</span>
                <span className="text-xs sm:text-xs sm:text-sm font-semibold text-text">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category-specific details */}
      {user.category === 'farmer' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-500" />
              Farming Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.farmSize && <FieldRow icon={Leaf} label="Farm Size" value={user.farmSize} />}
            {user.cropType && <FieldRow icon={Leaf} label="Crop Type" value={user.cropType} />}
            {user.season   && <FieldRow icon={Leaf} label="Season"    value={user.season} />}
          </CardContent>
        </Card>
      )}

      {user.category === 'student' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-purple-500" />
              Education Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.courseName    && <FieldRow icon={GraduationCap} label="Course"    value={user.courseName} />}
            {user.collegeName   && <FieldRow icon={GraduationCap} label="College"   value={user.collegeName} />}
            {user.universityName && <FieldRow icon={GraduationCap} label="University" value={user.universityName} />}
          </CardContent>
        </Card>
      )}

      {(user.category === 'volunteer' || user.category === 'ngo') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-500" />
              Volunteer / NGO Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {user.organisationType && <FieldRow icon={Building2} label="Org. Type" value={user.organisationType} />}
            {user.season           && <FieldRow icon={Leaf}      label="Season"    value={user.season} />}
            {user.cropType         && <FieldRow icon={Leaf}      label="Crop Type" value={user.cropType} />}
          </CardContent>
        </Card>
      )}

      {/* Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-sm sm:text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs sm:text-xs sm:text-sm text-text-tertiary">
              <HelpCircle className="h-4 w-4" />
              Help & FAQ
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primary/80"
              onClick={() => navigate('/faqs')}
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <EditProfileDialog
        user={user}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}