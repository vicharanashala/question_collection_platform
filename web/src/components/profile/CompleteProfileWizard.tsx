/**
 * Complete-profile wizard (self-contained).
 *
 * Extracted from the legacy `PublicRegisterPage` so it can be hosted
 * inside a Dialog modal on the `/home` dashboard instead of being a
 * standalone full-screen page. The wizard has 4 steps:
 *   1. Category (Farmer / FPO / Student / Volunteer / NGO)
 *   2. Location (State → District → Block → Village → KVK)
 *   3. About-you (Name / Username / Gender / Age / category-specific fields)
 *   4. Language + consent (final submission)
 *
 * The wizard is responsible for:
 *   • managing its own form state + LGD cascading loaders
 *   • calling `authApi.register(payload)`
 *   • `login(...)` so the public user is authenticated immediately
 *   • navigating to `/home/verification-pending` on success
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, lgdApi, getErrorMessage } from '@/api/client'
import type { LgdDistrict, LgdKvk, LgdSubDistrict, LgdVillage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  CheckCircle2, Leaf, Users, GraduationCap, HandHeart, Building2, Loader2,
  ArrowLeft, ArrowRight, User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '@/components/BrandLogo'
import {
  LANGUAGES, USER_CATEGORIES, GENDER_OPTIONS, SUPPORTED_STATES,
  CROP_OPTIONS, COURSE_OPTIONS, ORG_TYPE_OPTIONS, SEASONS,
} from '@/constants/public'
import type { UserCategory } from '@/types'

const TOTAL_STEPS = 4
const STEP_KEYS = ['Tell us about yourself', 'Where are you from?', 'About you', 'Language & Consent']
const OTHER_VALUE = '__other__'

interface WizardFormState {
  category: UserCategory | ''
  state: string; district: string; districtCode: string; block: string; village: string; kvk: string
  name: string; username: string; gender: '' | 'male' | 'female' | 'other'; age: string
  farmSize: string; cropType: string[]
  courseName: string; courseNameOther: string; collegeName: string; universityName: string
  organisationType: string; organisationTypeOther: string
  organizationName: string; organizationRole: string; numberOfFarmers: string
  organizationState: string; organizationDistrict: string; organizationBlock: string; organizationVillage: string
  season: string; volunteerCropType: string
  languagePreference: string; consentGiven: boolean
}

const INITIAL_FORM: WizardFormState = {
  category: '',
  state: '', district: '', districtCode: '', block: '', village: '', kvk: '',
  name: '', username: '', gender: '', age: '',
  farmSize: '', cropType: [],
  courseName: '', courseNameOther: '', collegeName: '', universityName: '',
  organisationType: '', organisationTypeOther: '',
  organizationName: '', organizationRole: '', numberOfFarmers: '',
  organizationState: '', organizationDistrict: '', organizationBlock: '', organizationVillage: '',
  season: '', volunteerCropType: '',
  languagePreference: 'en',
  consentGiven: false,
}

type SetField = <K extends keyof WizardFormState>(k: K, v: WizardFormState[K]) => void

function CategoryIcon({ value, className }: { value: UserCategory; className?: string }) {
  const map: Record<UserCategory, JSX.Element> = {
    farmer: <Leaf className={className} />,
    fpo: <Users className={className} />,
    student: <GraduationCap className={className} />,
    volunteer: <HandHeart className={className} />,
    ngo: <Building2 className={className} />,
  }
  return map[value] ?? <UserIcon className={className} />
}

interface WizardFormStateProps {
  form: WizardFormState
  errors: Record<string, string>
  usernameStatus: 'idle' | 'checking' | 'available' | 'taken'
  usernameSuggestions: string[]
  districts: LgdDistrict[]
  blocks: LgdSubDistrict[]
  villages: LgdVillage[]
  kvks: LgdKvk[]
  setField: SetField
  loadDistricts: (stateName: string) => Promise<void>
  loadBlocks: (districtCode: string) => Promise<void>
  loadVillages: (blockCode: string) => Promise<void>
  loadKvks: (districtCode: string) => Promise<void>
}

function Step1({ form, errors, setField }: WizardFormStateProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">Pick the option that best describes you.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {USER_CATEGORIES.map((c) => {
          const active = form.category === c.value
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setField('category', c.value)}
              className={cn(
                'flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all hover:shadow-sm',
                active
                  ? `${c.ring} bg-emerald-50/50 dark:bg-emerald-950/20`
                  : 'border-border-subtle hover:border-emerald-200',
              )}
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', c.iconBg, c.iconColor)}>
                <CategoryIcon value={c.value} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{c.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{c.description}</p>
              </div>
              {active && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            </button>
          )
        })}
      </div>
      {errors.category && <p className="text-xs text-rose-600">{errors.category}</p>}
    </div>
  )
}

function Step2({ form, errors, districts, blocks, villages, kvks, setField, loadDistricts, loadBlocks, loadVillages, loadKvks }: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">We&apos;ll use this to match your questions with local experts.</p>
      <div className="space-y-1.5">
        <Label>State <span className="text-rose-600">*</span></Label>
        <Select value={form.state} onValueChange={(v) => { setField('state', v); setField('district', ''); setField('districtCode', ''); loadDistricts(v) }}>
          <SelectTrigger><SelectValue placeholder="Choose state" /></SelectTrigger>
          <SelectContent>{SUPPORTED_STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {errors.state && <p className="text-xs text-rose-600">{errors.state}</p>}
      </div>
      <div className="space-y-1.5">
        <Label>District <span className="text-rose-600">*</span></Label>
        <Select
          value={form.district}
          onValueChange={(v) => {
            const d = districts.find((x) => x.name === v)
            setField('district', v)
            setField('districtCode', d?.code ?? '')
            loadBlocks(d?.code ?? '')
          }}
          disabled={!form.state}
        >
          <SelectTrigger><SelectValue placeholder={form.state ? 'Choose district' : 'Choose state first'} /></SelectTrigger>
          <SelectContent>{districts.map((d) => <SelectItem key={d.code} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        {errors.district && <p className="text-xs text-rose-600">{errors.district}</p>}
      </div>
      {form.category === 'farmer' && (
        <div className="space-y-1.5">
          <Label>Block <span className="text-rose-600">*</span></Label>
          <Select
            value={form.block}
            onValueChange={(v) => {
              const block = blocks.find((b) => b.name === v)
              setField('block', v)
              loadVillages(block?.code ?? '')
              loadKvks(form.districtCode)
            }}
            disabled={!form.district}
          >
            <SelectTrigger><SelectValue placeholder={form.district ? 'Choose block' : 'Choose district first'} /></SelectTrigger>
            <SelectContent>{blocks.map((b) => <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          {errors.block && <p className="text-xs text-rose-600">{errors.block}</p>}
        </div>
      )}
      {form.category === 'farmer' && form.block && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Village</Label>
            <Select value={form.village} onValueChange={(v) => setField('village', v)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{villages.map((v) => <SelectItem key={v.code} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nearest KVK</Label>
            <Select value={form.kvk} onValueChange={(v) => setField('kvk', v)}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>{kvks.map((k) => <SelectItem key={k.code} value={k.name}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  )
}

function Step3({ form, errors, usernameStatus, usernameSuggestions, setField }: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full name <span className="text-rose-600">*</span></Label>
          <Input value={form.name} onChange={(e) => setField('name', e.target.value)} maxLength={80} placeholder="Your name" />
          {errors.name && <p className="text-xs text-rose-600">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Username <span className="text-rose-600">*</span></Label>
          <Input
            value={form.username}
            onChange={(e) => setField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
            maxLength={20}
            placeholder="e.g. ram_kr"
          />
          {errors.username && <p className="text-xs text-rose-600">{errors.username}</p>}
          {usernameStatus === 'available' && <p className="text-xs text-emerald-700">✓ Available</p>}
          {usernameStatus === 'taken' && (
            <div className="space-y-1">
              <p className="text-xs text-rose-600">Taken. Try one of these:</p>
              <div className="flex flex-wrap gap-1.5">
                {usernameSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField('username', s)}
                    className="rounded-full border border-emerald-200 px-2 py-0.5 text-xs text-emerald-700 hover:bg-emerald-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Gender <span className="text-rose-600">*</span></Label>
          <Select value={form.gender} onValueChange={(v) => setField('gender', v as any)}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{GENDER_OPTIONS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
          </Select>
          {errors.gender && <p className="text-xs text-rose-600">{errors.gender}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Age</Label>
          <Input type="number" min={1} max={120} value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder="Optional" />
          {errors.age && <p className="text-xs text-rose-600">{errors.age}</p>}
        </div>
      </div>
      {form.category === 'farmer' && (
        <>
          <div className="space-y-1.5">
            <Label>Farm size (acres) <span className="text-rose-600">*</span></Label>
            <Input value={form.farmSize} onChange={(e) => setField('farmSize', e.target.value)} placeholder="e.g. 2.5" />
            {errors.farmSize && <p className="text-xs text-rose-600">{errors.farmSize}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Primary crops <span className="text-rose-600">*</span></Label>
            <div className="flex flex-wrap gap-1.5">
              {CROP_OPTIONS.map((c) => {
                const selected = form.cropType.includes(c.value)
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() =>
                      setField(
                        'cropType',
                        selected ? form.cropType.filter((x) => x !== c.value) : [...form.cropType, c.value],
                      )
                    }
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                      selected
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-border-subtle text-text-secondary hover:border-emerald-300',
                    )}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>
            {errors.cropType && <p className="text-xs text-rose-600">{errors.cropType}</p>}
          </div>
        </>
      )}
      {form.category === 'student' && (
        <>
          <div className="space-y-1.5">
            <Label>Course <span className="text-rose-600">*</span></Label>
            <Select value={form.courseName} onValueChange={(v) => setField('courseName', v)}>
              <SelectTrigger><SelectValue placeholder="Choose course" /></SelectTrigger>
              <SelectContent>
                {COURSE_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {errors.courseName && <p className="text-xs text-rose-600">{errors.courseName}</p>}
            {form.courseName === OTHER_VALUE && (
              <Input
                className="mt-2"
                value={form.courseNameOther}
                onChange={(e) => setField('courseNameOther', e.target.value)}
                placeholder="Enter course name"
              />
            )}
            {errors.courseNameOther && <p className="text-xs text-rose-600">{errors.courseNameOther}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>College name <span className="text-rose-600">*</span></Label>
            <Input value={form.collegeName} onChange={(e) => setField('collegeName', e.target.value)} placeholder="College / institution" />
            {errors.collegeName && <p className="text-xs text-rose-600">{errors.collegeName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>University</Label>
            <Input value={form.universityName} onChange={(e) => setField('universityName', e.target.value)} placeholder="Optional" />
          </div>
        </>
      )}
      {(form.category === 'fpo' || form.category === 'ngo' || form.category === 'volunteer') && (
        <>
          <div className="space-y-1.5">
            <Label>Organisation type <span className="text-rose-600">*</span></Label>
            <Select value={form.organisationType} onValueChange={(v) => setField('organisationType', v)}>
              <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                <SelectItem value={OTHER_VALUE}>Other…</SelectItem>
              </SelectContent>
            </Select>
            {errors.organisationType && <p className="text-xs text-rose-600">{errors.organisationType}</p>}
            {form.organisationType === OTHER_VALUE && (
              <Input
                className="mt-2"
                value={form.organisationTypeOther}
                onChange={(e) => setField('organisationTypeOther', e.target.value)}
                placeholder="Specify organisation type"
              />
            )}
            {errors.organisationTypeOther && <p className="text-xs text-rose-600">{errors.organisationTypeOther}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Organisation name <span className="text-rose-600">*</span></Label>
              <Input value={form.organizationName} onChange={(e) => setField('organizationName', e.target.value)} placeholder="Registered name" />
              {errors.organizationName && <p className="text-xs text-rose-600">{errors.organizationName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Your role <span className="text-rose-600">*</span></Label>
              <Input value={form.organizationRole} onChange={(e) => setField('organizationRole', e.target.value)} placeholder="e.g. CEO, Field Officer" />
              {errors.organizationRole && <p className="text-xs text-rose-600">{errors.organizationRole}</p>}
            </div>
          </div>
          {(form.category === 'fpo' || form.category === 'ngo') && (
            <div className="space-y-1.5">
              <Label>Number of farmers served <span className="text-rose-600">*</span></Label>
              <Input
                type="number"
                min={0}
                value={form.numberOfFarmers}
                onChange={(e) => setField('numberOfFarmers', e.target.value)}
                placeholder="Approx."
              />
              {errors.numberOfFarmers && <p className="text-xs text-rose-600">{errors.numberOfFarmers}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Operating state <span className="text-rose-600">*</span></Label>
              <Select value={form.organizationState} onValueChange={(v) => setField('organizationState', v)}>
                <SelectTrigger><SelectValue placeholder="Choose state" /></SelectTrigger>
                <SelectContent>{SUPPORTED_STATES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
              {errors.organizationState && <p className="text-xs text-rose-600">{errors.organizationState}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>District <span className="text-rose-600">*</span></Label>
              <Input value={form.organizationDistrict} onChange={(e) => setField('organizationDistrict', e.target.value)} placeholder="District name" />
              {errors.organizationDistrict && <p className="text-xs text-rose-600">{errors.organizationDistrict}</p>}
            </div>
          </div>
          {form.category === 'volunteer' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Season</Label>
                <Select value={form.season} onValueChange={(v) => setField('season', v)}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{SEASONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Crop focus</Label>
                <Input value={form.volunteerCropType} onChange={(e) => setField('volunteerCropType', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Step4({ form, errors, setField }: WizardFormStateProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Preferred language <span className="text-rose-600">*</span></Label>
        <Select value={form.languagePreference} onValueChange={(v) => setField('languagePreference', v)}>
          <SelectTrigger><SelectValue placeholder="Choose language" /></SelectTrigger>
          <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
        </Select>
        {errors.languagePreference && <p className="text-xs text-rose-600">{errors.languagePreference}</p>}
      </div>
      <label className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/30 p-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-emerald-500"
          checked={form.consentGiven}
          onChange={(e) => setField('consentGiven', e.target.checked)}
        />
        <span>
          I have read and agree to the Terms of Service and Privacy Policy. I agree
          that the information I provide will be used to answer my agriculture
          questions and improve services, and I understand my mobile number will
          receive SMS notifications.
        </span>
      </label>
      {errors.consentGiven && <p className="text-xs text-rose-600">{errors.consentGiven}</p>}
      <div className="rounded-lg border border-border-subtle bg-surface/50 p-4 text-xs text-text-secondary">
        <p className="font-semibold text-foreground">What happens next?</p>
        <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
          <li>Your account will go through a quick verification (usually within 24 hours).</li>
          <li>Once verified you can ask questions, earn rewards, and access expert answers.</li>
          <li>You&apos;ll get a notification when verification completes.</li>
        </ul>
      </div>
    </div>
  )
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mb-5 flex items-center justify-center gap-1.5 sm:gap-2">
      {STEP_KEYS.map((label, idx) => {
        const n = idx + 1
        const isDone = n < step
        const isActive = n === step
        return (
          <div key={label} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8',
                  isDone || isActive
                    ? 'bg-emerald-500 text-white'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={cn(
                  'mt-1 hidden max-w-[80px] text-center text-[10px] leading-tight sm:block',
                  isActive ? 'font-semibold text-foreground' : 'text-text-tertiary',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEP_KEYS.length - 1 && (
              <div className="mb-4 sm:mb-5 h-px w-4 bg-border-subtle sm:w-6" />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface CompleteProfileWizardProps {
  /** Mobile number being registered (required by `authApi.register`). */
  mobileNumber: string
  /**
   * Back-button handler. When omitted, the Back button is hidden on step 1
   * (i.e. when the wizard is the only thing the user can see).
   */
  onBack?: () => void
}

export function CompleteProfileWizard({ mobileNumber, onBack }: CompleteProfileWizardProps) {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<WizardFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [districts, setDistricts] = useState<LgdDistrict[]>([])
  const [blocks, setBlocks] = useState<LgdSubDistrict[]>([])
  const [villages, setVillages] = useState<LgdVillage[]>([])
  const [kvks, setKvks] = useState<LgdKvk[]>([])

  useEffect(() => {
    const u = form.username.trim()
    if (u.length < 3) { setUsernameStatus('idle'); setUsernameSuggestions([]); return }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await authApi.checkUsername(u)
        if (res.available) { setUsernameStatus('available'); setUsernameSuggestions([]) }
        else { setUsernameStatus('taken'); setUsernameSuggestions(res.suggestions ?? []) }
      } catch { setUsernameStatus('idle') }
    }, 500)
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current) }
  }, [form.username])

  function setField<K extends keyof WizardFormState>(k: K, v: WizardFormState[K]) {
    setForm((p) => ({ ...p, [k]: v }))
    setErrors((e) => {
      if (!e[k as string]) return e
      const { [k as string]: _drop, ...rest } = e
      return rest
    })
  }

  function validateStep(s: 1 | 2 | 3 | 4): boolean {
    const e: Record<string, string> = {}
    if (s === 1) { if (!form.category) e.category = 'Please choose a category' }
    if (s === 2) {
      if (!form.state) e.state = 'Please choose a state'
      if (!form.district) e.district = 'Please choose a district'
      if (form.category === 'farmer' && !form.block) e.block = 'Block is required for farmers'
    }
    if (s === 3) {
      if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Please enter your full name'
      if (!form.username.trim()) e.username = 'Please choose a username'
      else if (form.username.trim().length < 3) e.username = 'Username must be at least 3 characters'
      else if (usernameStatus === 'taken') e.username = 'That username is taken. Pick or click a suggestion below.'
      if (!form.gender) e.gender = 'Please choose a gender'
      if (form.age && (Number(form.age) < 1 || Number(form.age) > 120)) e.age = 'Enter a valid age'
      if (form.category === 'farmer') {
        if (!form.farmSize.trim()) e.farmSize = 'Farm size is required'
        if (form.cropType.length === 0) e.cropType = 'Pick at least one crop'
      }
      if (form.category === 'student') {
        if (!form.courseName) e.courseName = 'Course is required'
        if (form.courseName === OTHER_VALUE && !form.courseNameOther.trim()) e.courseNameOther = 'Please enter course name'
        if (!form.collegeName.trim()) e.collegeName = 'College name is required'
      }
      if (form.category === 'fpo' || form.category === 'ngo' || form.category === 'volunteer') {
        if (!form.organisationType) e.organisationType = 'Organisation type is required'
        if (form.organisationType === OTHER_VALUE && !form.organisationTypeOther.trim()) e.organisationTypeOther = 'Please specify'
        if (!form.organizationName.trim()) e.organizationName = 'Organisation name is required'
        if (!form.organizationRole.trim()) e.organizationRole = 'Your role is required'
        if ((form.category === 'fpo' || form.category === 'ngo') && !form.numberOfFarmers.trim()) e.numberOfFarmers = 'Number of farmers is required'
        if (!form.organizationState) e.organizationState = 'Organisation state is required'
        if (!form.organizationDistrict.trim()) e.organizationDistrict = 'District is required'
      }
    }
    if (s === 4) {
      if (!form.languagePreference) e.languagePreference = 'Please choose a language'
      if (!form.consentGiven) e.consentGiven = 'You must accept the consent to register'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validateStep(step)) setStep((s) => (Math.min(4, s + 1) as 1 | 2 | 3 | 4))
  }
  function back() {
    if (step > 1) {
      setStep((s) => (Math.max(1, s - 1) as 1 | 2 | 3 | 4))
    } else if (onBack) {
      onBack()
    }
  }

  async function loadDistricts(stateName: string) {
    setDistricts([]); setBlocks([]); setVillages([])
    if (!stateName) return
    try {
      const res = await lgdApi.getStates()
      const target = stateName.trim().toLowerCase()
      const match = res.states.find((s) => (s.name ?? '').trim().toLowerCase() === target)
      if (!match) {
        console.warn(`[loadDistricts] No state matched "${stateName}".`)
        return
      }
      const d = await lgdApi.getDistricts(match.code)
      setDistricts(d.districts)
    } catch (err) {
      console.error('[loadDistricts] Failed to fetch districts:', err)
    }
  }

  async function loadBlocks(districtCode: string) {
    setBlocks([]); setVillages([])
    if (!districtCode) return
    try {
      const d = await lgdApi.getSubDistricts(districtCode)
      setBlocks(d.subdistricts)
    } catch { /* ignore */ }
  }

  async function loadVillages(blockCode: string) {
    setVillages([])
    if (!blockCode) return
    try {
      const v = await lgdApi.getVillages(blockCode)
      setVillages(v.villages)
    } catch { /* ignore */ }
  }

  async function loadKvks(districtCode: string) {
    setKvks([])
    if (!districtCode) return
    try {
      const k = await lgdApi.getKvks(districtCode)
      setKvks(k.kvks)
    } catch { /* ignore */ }
  }

  async function submit() {
    if (!validateStep(4)) return
    setLoading(true)
    try {
      const payload: any = {
        mobileNumber,
        name: form.name.trim(),
        username: form.username.trim(),
        category: form.category,
        state: form.state,
        district: form.district,
        block: form.block || undefined,
        village: form.village || undefined,
        kvk: form.kvk || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        languagePreference: form.languagePreference,
        consentGiven: true,
      }
      if (form.category === 'farmer') {
        payload.farmSize = form.farmSize.trim()
        payload.cropType = form.cropType.join(', ')
      }
      if (form.category === 'student') {
        payload.courseName = form.courseName === OTHER_VALUE ? form.courseNameOther.trim() : form.courseName
        payload.collegeName = form.collegeName.trim()
        payload.universityName = form.universityName.trim() || undefined
      }
      if (form.category === 'fpo' || form.category === 'ngo' || form.category === 'volunteer') {
        payload.organisationType = form.organisationType === OTHER_VALUE ? form.organisationTypeOther.trim() : form.organisationType
        payload.organizationName = form.organizationName.trim()
        payload.organizationRole = form.organizationRole.trim()
        payload.numberOfFarmers = form.numberOfFarmers.trim() ? parseInt(form.numberOfFarmers.trim(), 10) : undefined
        payload.organizationState = form.organizationState
        payload.organizationDistrict = form.organizationDistrict.trim()
        payload.organizationBlock = form.organizationBlock.trim() || undefined
        payload.organizationVillage = form.organizationVillage.trim() || undefined
      }
      if (form.category === 'volunteer') {
        payload.season = form.season || undefined
        payload.volunteerCropType = form.volunteerCropType.trim() || undefined
      }
      const res = await authApi.register(payload)
      login(res.tokens, res.user)
      navigate('/home/verification-pending', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const stepProps: WizardFormStateProps = {
    form, errors, usernameStatus, usernameSuggestions,
    districts, blocks, villages, kvks,
    setField, loadDistricts, loadBlocks, loadVillages, loadKvks,
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex flex-col items-center gap-1">
        <BrandLogo className="h-10 w-10" />
        <h1 className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">AnnaDatha</h1>
        <p className="text-xs text-text-secondary">Complete your profile</p>
      </div>

      <StepIndicator step={step} />

      <h2 className="mb-3 text-base font-bold text-foreground sm:text-lg">
        Step {step}: {STEP_KEYS[step - 1]}
      </h2>

      {step === 1 && <Step1 {...stepProps} />}
      {step === 2 && <Step2 {...stepProps} />}
      {step === 3 && <Step3 {...stepProps} />}
      {step === 4 && <Step4 {...stepProps} />}

      <div className="mt-5 flex items-center justify-between gap-2">
        {onBack || step > 1 ? (
          <Button variant="ghost" onClick={back} disabled={loading} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
        ) : (
          <span />
        )}
        {step < TOTAL_STEPS ? (
          <Button onClick={next} className="bg-emerald-500 hover:bg-emerald-600 gap-1.5">
            Next<ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Submit registration
          </Button>
        )}
      </div>
    </div>
  )
}
