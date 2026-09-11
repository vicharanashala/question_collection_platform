import { useEffect, useRef, useState } from 'react'
import {
  adminApi,
  authApi,
  getErrorMessage,
  lgdApi,
  type LgdDistrict,
  type LgdKvk,
  type LgdState,
  type LgdSubDistrict,
  type LgdVillage,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import { CropPickerModal } from '@/components/ui/crop-picker-modal'
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
import { MultiSearchableSelect } from '@/components/ui/multi-searchable-select'
import { COURSE_OPTIONS, GENDER_OPTIONS, ORG_TYPE_OPTIONS, SEASONS } from '@/constants/public'
import type { UserCategory, UserRole } from '@/types'
import { CheckCircle2, Loader2, MapPin, Sprout, UserRound, X } from 'lucide-react'

const OTHER_VALUE = '__other__'

type CreatableRole = Exclude<UserRole, 'super_admin'>

interface AddUserForm {
  name: string
  mobileNumber: string
  role: CreatableRole
  category: UserCategory
  username: string
  gender: '' | 'male' | 'female' | 'other'
  age: string
  state: string
  district: string
  block: string
  village: string
  kvk: string
  farmSize: string
  crops: string[]
  courseName: string
  courseNameOther: string
  collegeName: string
  universityName: string
  organisationType: string
  organisationTypeOther: string
  organizationName: string
  organizationRole: string
  numberOfFarmers: string
  organizationState: string[]
  season: string
  volunteerCrops: string[]
}

const INITIAL_FORM: AddUserForm = {
  name: '',
  mobileNumber: '',
  role: 'user',
  category: 'farmer',
  username: '',
  gender: '',
  age: '',
  state: '',
  district: '',
  block: '',
  village: '',
  kvk: '',
  farmSize: '',
  crops: [],
  courseName: '',
  courseNameOther: '',
  collegeName: '',
  universityName: '',
  organisationType: '',
  organisationTypeOther: '',
  organizationName: '',
  organizationRole: '',
  numberOfFarmers: '',
  organizationState: [],
  season: '',
  volunteerCrops: [],
}

const selectClassName = 'mt-1 flex h-10 w-full rounded-md border border-border-subtle bg-surface-variant px-3 py-2 text-sm text-text disabled:cursor-not-allowed disabled:opacity-60 dark:!bg-surface-variant'

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-variant/25 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-text">{title}</h3>
          <p className="mt-0.5 text-xs text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

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
  const [cropPickerOpen, setCropPickerOpen] = useState(false)
  const [volunteerCropPickerOpen, setVolunteerCropPickerOpen] = useState(false)

  const [stateCode, setStateCode] = useState('')
  const [districtCode, setDistrictCode] = useState('')
  const [blockCode, setBlockCode] = useState('')
  const [villageCode, setVillageCode] = useState('')
  const [states, setStates] = useState<LgdState[]>([])
  const [districts, setDistricts] = useState<LgdDistrict[]>([])
  const [blocks, setBlocks] = useState<LgdSubDistrict[]>([])
  const [villages, setVillages] = useState<LgdVillage[]>([])
  const [kvks, setKvks] = useState<LgdKvk[]>([])
  const [loadingStates, setLoadingStates] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [loadingVillages, setLoadingVillages] = useState(false)
  const [loadingKvks, setLoadingKvks] = useState(false)

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([])
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isEndUser = form.role === 'user'
  const isFarmer = isEndUser && form.category === 'farmer'
  const hasOrganisation = isEndUser && ['fpo', 'ngo', 'volunteer'].includes(form.category)

  function resetForm() {
    setForm(INITIAL_FORM)
    setErrors({})
    setFormError('')
    setStateCode('')
    setDistrictCode('')
    setBlockCode('')
    setVillageCode('')
    setDistricts([])
    setBlocks([])
    setVillages([])
    setKvks([])
    setUsernameStatus('idle')
    setUsernameSuggestions([])
  }

  useEffect(() => {
    if (!open) return
    resetForm()
    let cancelled = false
    setLoadingStates(true)
    lgdApi.getStates()
      .then(({ states: stateList }) => {
        if (!cancelled) setStates(stateList)
      })
      .catch((err) => {
        if (!cancelled) setFormError(getErrorMessage(err, 'Failed to load states'))
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false)
      })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current)
    const username = form.username.trim()
    if (!isEndUser || username.length < 3) {
      setUsernameStatus('idle')
      setUsernameSuggestions([])
      return
    }
    setUsernameStatus('checking')
    usernameTimer.current = setTimeout(async () => {
      try {
        const response = await authApi.checkUsername(username)
        setUsernameStatus(response.available ? 'available' : 'taken')
        setUsernameSuggestions(response.suggestions ?? [])
      } catch {
        setUsernameStatus('idle')
      }
    }, 500)
    return () => {
      if (usernameTimer.current) clearTimeout(usernameTimer.current)
    }
  }, [form.username, isEndUser])

  function setField<K extends keyof AddUserForm>(field: K, value: AddUserForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!current[field]) return current
      const { [field]: _removed, ...rest } = current
      return rest
    })
    setFormError('')
  }

  function resetFarmerLocation(clearDistrict: boolean) {
    setBlockCode('')
    setVillageCode('')
    setBlocks([])
    setVillages([])
    setKvks([])
    setForm((current) => ({
      ...current,
      district: clearDistrict ? '' : current.district,
      block: '',
      village: '',
      kvk: '',
    }))
    if (clearDistrict) setDistrictCode('')
  }

  function handleRoleChange(role: CreatableRole) {
    setField('role', role)
    resetFarmerLocation(role === 'user' && form.category === 'farmer' && !!districtCode)
  }

  function handleCategoryChange(category: UserCategory) {
    setField('category', category)
    resetFarmerLocation(category === 'farmer' && !!districtCode)
  }

  async function handleStateChange(code: string) {
    const selected = states.find((state) => state.code === code)
    setStateCode(code)
    setDistrictCode('')
    setBlockCode('')
    setVillageCode('')
    setDistricts([])
    setBlocks([])
    setVillages([])
    setKvks([])
    setForm((current) => ({
      ...current,
      state: selected?.name ?? '',
      district: '',
      block: '',
      village: '',
      kvk: '',
    }))
    setFormError('')
    if (!code) return
    setLoadingDistricts(true)
    try {
      const response = await lgdApi.getDistricts(code)
      setDistricts(response.districts)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load districts'))
    } finally {
      setLoadingDistricts(false)
    }
  }

  async function handleDistrictChange(code: string) {
    const selected = districts.find((district) => district.code === code)
    setDistrictCode(code)
    setBlockCode('')
    setVillageCode('')
    setBlocks([])
    setVillages([])
    setKvks([])
    setForm((current) => ({
      ...current,
      district: selected?.name ?? '',
      block: '',
      village: '',
      kvk: '',
    }))
    setFormError('')
    if (!code || !isFarmer) return
    setLoadingBlocks(true)
    setLoadingKvks(true)
    const [blockResult, kvkResult] = await Promise.allSettled([
      lgdApi.getSubDistricts(code),
      lgdApi.getKvks(code),
    ])
    if (blockResult.status === 'fulfilled') setBlocks(blockResult.value.subdistricts)
    else setFormError(getErrorMessage(blockResult.reason, 'Failed to load blocks'))
    if (kvkResult.status === 'fulfilled') setKvks(kvkResult.value.kvks)
    else setFormError(getErrorMessage(kvkResult.reason, 'Failed to load KVKs'))
    setLoadingBlocks(false)
    setLoadingKvks(false)
  }

  async function handleBlockChange(code: string) {
    const selected = blocks.find((block) => block.code === code)
    setBlockCode(code)
    setVillageCode('')
    setVillages([])
    setForm((current) => ({ ...current, block: selected?.name ?? '', village: '' }))
    setFormError('')
    if (!code) return
    setLoadingVillages(true)
    try {
      const response = await lgdApi.getVillages(code)
      setVillages(response.villages)
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to load villages'))
    } finally {
      setLoadingVillages(false)
    }
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Enter the full name.'
    if (!/^\d{10}$/.test(form.mobileNumber.trim())) next.mobileNumber = 'Enter a valid 10-digit mobile number.'
    const age = Number(form.age)
    if (!form.age || age < 16 || age > 100) next.age = 'Age must be between 16 and 100.'
    if (!form.state) next.state = 'Select a state.'
    if (!form.district) next.district = 'Select a district.'

    if (isEndUser) {
      if (form.username.trim().length < 3) next.username = 'Username must contain at least 3 characters.'
      else if (usernameStatus === 'taken') next.username = 'This username is already taken.'
      if (!form.gender) next.gender = 'Select a gender.'
      if (isFarmer) {
        if (!form.block) next.block = 'Select a block.'
        if (!form.village) next.village = 'Select a village.'
        if (!form.kvk) next.kvk = 'Select the nearest KVK.'
        if (!form.farmSize.trim()) next.farmSize = 'Enter the farm size.'
        if (form.crops.length === 0) next.crops = 'Select at least one primary crop.'
      }
      if (form.category === 'student') {
        if (!form.courseName) next.courseName = 'Select a course.'
        if (form.courseName === OTHER_VALUE && !form.courseNameOther.trim()) next.courseNameOther = 'Enter the course name.'
        if (!form.collegeName.trim()) next.collegeName = 'Enter the college name.'
      }
      if (hasOrganisation) {
        if (!form.organisationType) next.organisationType = 'Select an organisation type.'
        if (form.organisationType === OTHER_VALUE && !form.organisationTypeOther.trim()) next.organisationTypeOther = 'Specify the organisation type.'
        if (!form.organizationName.trim()) next.organizationName = 'Enter the organisation name.'
        if (!form.organizationRole.trim()) next.organizationRole = 'Enter the role in the organisation.'
        if (form.organizationState.length === 0) next.organizationState = 'Select at least one operating state.'
      }
      if ((form.category === 'fpo' || form.category === 'ngo') && Number(form.numberOfFarmers) < 1) {
        next.numberOfFarmers = 'Enter the number of farmers served.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validate()) return
    setCreating(true)
    setFormError('')
    try {
      const courseName = form.courseName === OTHER_VALUE ? form.courseNameOther.trim() : form.courseName
      const organisationType = form.organisationType === OTHER_VALUE
        ? form.organisationTypeOther.trim()
        : form.organisationType
      await adminApi.createUser({
        name: form.name.trim(),
        mobileNumber: form.mobileNumber.trim(),
        role: form.role,
        age: Number(form.age),
        state: form.state,
        district: form.district,
        ...(isEndUser && {
          category: form.category,
          username: form.username.trim(),
          gender: form.gender,
        }),
        ...(isFarmer && {
          block: form.block,
          village: form.village,
          kvk: form.kvk,
          farmSize: form.farmSize.trim(),
          cropType: form.crops.join(', '),
        }),
        ...(isEndUser && form.category === 'student' && {
          courseName,
          collegeName: form.collegeName.trim(),
          universityName: form.universityName.trim() || undefined,
        }),
        ...(hasOrganisation && {
          organisationType,
          organizationName: form.organizationName.trim(),
          organizationRole: form.organizationRole.trim(),
          organizationState: form.organizationState,
        }),
        ...(isEndUser && (form.category === 'fpo' || form.category === 'ngo') && {
          numberOfFarmers: Number(form.numberOfFarmers),
        }),
        ...(isEndUser && form.category === 'volunteer' && {
          season: form.season || undefined,
          volunteerCropType: form.volunteerCrops.length ? form.volunteerCrops.join(', ') : undefined,
        }),
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
    <>
      <Dialog open={open} onOpenChange={(next) => !creating && onOpenChange(next)}>
        <DialogContent className="flex h-[85vh] max-h-[85vh] !w-[85vw] !max-w-[85vw] grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-border-subtle px-5 py-4 pr-12 sm:px-7 sm:py-5">
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              {isEndUser
                ? 'Complete the same profile information collected during public registration.'
                : 'Staff accounts require basic personal and assigned location information.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <Section icon={UserRound} title="Account & personal information" description="Basic identity and role details for this account.">
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <Label htmlFor="add-user-name">Full Name *</Label>
                    <Input id="add-user-name" className="mt-1" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Ramesh Kumar" maxLength={80} />
                    <FieldError message={errors.name} />
                  </div>
                  <div>
                    <Label htmlFor="add-user-mobile">Mobile Number *</Label>
                    <Input id="add-user-mobile" className="mt-1" type="tel" inputMode="numeric" value={form.mobileNumber} onChange={(e) => setField('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210" />
                    <FieldError message={errors.mobileNumber} />
                  </div>
                  <div>
                    <Label htmlFor="add-user-role">Role *</Label>
                    <select id="add-user-role" className={selectClassName} value={form.role} onChange={(e) => handleRoleChange(e.target.value as CreatableRole)}>
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
                      <select id="add-user-category" className={selectClassName} value={form.category} onChange={(e) => handleCategoryChange(e.target.value as UserCategory)}>
                        <option value="farmer">Farmer</option>
                        <option value="fpo">FPO Member</option>
                        <option value="student">Student</option>
                        <option value="volunteer">Volunteer</option>
                        <option value="ngo">NGO Partner</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <Label htmlFor="add-user-age">Age *</Label>
                    <Input id="add-user-age" className="mt-1" type="number" min={16} max={100} value={form.age} onChange={(e) => setField('age', e.target.value)} placeholder="e.g. 28" />
                    <FieldError message={errors.age} />
                  </div>
                  {isEndUser && (
                    <>
                      <div className="lg:col-span-2">
                        <Label htmlFor="add-user-username">Username *</Label>
                        <div className="relative mt-1">
                          <Input id="add-user-username" value={form.username} onChange={(e) => setField('username', e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())} placeholder="e.g. ram_kr" maxLength={30} className="pr-9" />
                          {usernameStatus === 'checking' && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-text-tertiary" />}
                          {usernameStatus === 'available' && <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-success" />}
                        </div>
                        <FieldError message={errors.username} />
                        {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {usernameSuggestions.map((suggestion) => (
                              <button key={suggestion} type="button" onClick={() => setField('username', suggestion)} className="rounded-full border border-primary/30 px-2.5 py-1 text-xs text-primary hover:bg-primary/10">
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="add-user-gender">Gender *</Label>
                        <select id="add-user-gender" className={selectClassName} value={form.gender} onChange={(e) => setField('gender', e.target.value as AddUserForm['gender'])}>
                          <option value="">Select gender…</option>
                          {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <FieldError message={errors.gender} />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <Section icon={MapPin} title="Location information" description={isFarmer ? 'Farm location and nearest agricultural support centre.' : 'Assigned state and district for this account.'}>
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="add-user-state">State *</Label>
                    <select id="add-user-state" className={selectClassName} value={stateCode} onChange={(e) => void handleStateChange(e.target.value)} disabled={loadingStates || loadingDistricts}>
                      <option value="">{loadingStates ? 'Loading states…' : 'Select state…'}</option>
                      {states.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
                    </select>
                    <FieldError message={errors.state} />
                  </div>
                  <div>
                    <Label htmlFor="add-user-district">District *</Label>
                    <select id="add-user-district" className={selectClassName} value={districtCode} onChange={(e) => void handleDistrictChange(e.target.value)} disabled={!stateCode || loadingDistricts || loadingBlocks || loadingKvks}>
                      <option value="">{loadingDistricts ? 'Loading districts…' : stateCode ? 'Select district…' : 'Select state first'}</option>
                      {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
                    </select>
                    <FieldError message={errors.district} />
                  </div>
                  {isFarmer && (
                    <>
                      <div>
                        <Label htmlFor="add-user-block">Block *</Label>
                        <select id="add-user-block" className={selectClassName} value={blockCode} onChange={(e) => void handleBlockChange(e.target.value)} disabled={!districtCode || loadingBlocks || loadingVillages}>
                          <option value="">{loadingBlocks ? 'Loading blocks…' : districtCode ? 'Select block…' : 'Select district first'}</option>
                          {blocks.map((block) => <option key={block.code} value={block.code}>{block.name}</option>)}
                        </select>
                        <FieldError message={errors.block} />
                      </div>
                      <div>
                        <Label htmlFor="add-user-village">Village *</Label>
                        <select id="add-user-village" className={selectClassName} value={villageCode} onChange={(e) => {
                          const village = villages.find((item) => item.code === e.target.value)
                          setVillageCode(e.target.value)
                          setField('village', village?.name ?? '')
                        }} disabled={!blockCode || loadingVillages}>
                          <option value="">{loadingVillages ? 'Loading villages…' : blockCode ? 'Select village…' : 'Select block first'}</option>
                          {villages.map((village) => <option key={village.code} value={village.code}>{village.name}</option>)}
                        </select>
                        <FieldError message={errors.village} />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="add-user-kvk">Nearest KVK *</Label>
                        <select id="add-user-kvk" className={selectClassName} value={form.kvk} onChange={(e) => setField('kvk', e.target.value)} disabled={!districtCode || loadingKvks}>
                          <option value="">{loadingKvks ? 'Loading KVKs…' : districtCode ? 'Select nearest KVK…' : 'Select district first'}</option>
                          {kvks.map((kvk) => <option key={kvk.code} value={kvk.address}>{kvk.address}</option>)}
                        </select>
                        <FieldError message={errors.kvk} />
                      </div>
                    </>
                  )}
                </div>
              </Section>

              {isEndUser && (
                <Section icon={Sprout} title={`${form.category === 'farmer' ? 'Farmer' : form.category === 'student' ? 'Education' : 'Organisation'} information`} description="Category-specific details collected by the complete-profile wizard.">
                  {isFarmer && (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="add-user-farm-size">Farm size (acres) *</Label>
                        <Input id="add-user-farm-size" className="mt-1" inputMode="decimal" value={form.farmSize} onChange={(e) => setField('farmSize', e.target.value.replace(/[^0-9.]/g, ''))} placeholder="e.g. 2.5" />
                        <FieldError message={errors.farmSize} />
                      </div>
                      <div>
                        <Label>Primary crops *</Label>
                        <Button type="button" variant="outline" className="mt-1 w-full justify-start font-normal" onClick={() => setCropPickerOpen(true)}>
                          {form.crops.length ? `${form.crops.length} crop${form.crops.length === 1 ? '' : 's'} selected` : 'Select primary crops…'}
                        </Button>
                        <FieldError message={errors.crops} />
                      </div>
                      {form.crops.length > 0 && (
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          {form.crops.map((crop) => (
                            <span key={crop} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                              {crop}
                              <button type="button" onClick={() => setField('crops', form.crops.filter((item) => item !== crop))} aria-label={`Remove ${crop}`}><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {form.category === 'student' && (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="add-user-course">Course *</Label>
                        <select id="add-user-course" className={selectClassName} value={form.courseName} onChange={(e) => setField('courseName', e.target.value)}>
                          <option value="">Select course…</option>
                          {COURSE_OPTIONS.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                          <option value={OTHER_VALUE}>Other…</option>
                        </select>
                        <FieldError message={errors.courseName} />
                      </div>
                      {form.courseName === OTHER_VALUE && (
                        <div>
                          <Label htmlFor="add-user-course-other">Course name *</Label>
                          <Input id="add-user-course-other" className="mt-1" value={form.courseNameOther} onChange={(e) => setField('courseNameOther', e.target.value)} placeholder="Enter course name" />
                          <FieldError message={errors.courseNameOther} />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="add-user-college">College name *</Label>
                        <Input id="add-user-college" className="mt-1" value={form.collegeName} onChange={(e) => setField('collegeName', e.target.value)} placeholder="College / institution" />
                        <FieldError message={errors.collegeName} />
                      </div>
                      <div>
                        <Label htmlFor="add-user-university">University</Label>
                        <Input id="add-user-university" className="mt-1" value={form.universityName} onChange={(e) => setField('universityName', e.target.value)} placeholder="Optional" />
                      </div>
                    </div>
                  )}

                  {hasOrganisation && (
                    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="add-user-org-type">Organisation type *</Label>
                        <select id="add-user-org-type" className={selectClassName} value={form.organisationType} onChange={(e) => setField('organisationType', e.target.value)}>
                          <option value="">Select type…</option>
                          {ORG_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          <option value={OTHER_VALUE}>Other…</option>
                        </select>
                        <FieldError message={errors.organisationType} />
                      </div>
                      {form.organisationType === OTHER_VALUE && (
                        <div>
                          <Label htmlFor="add-user-org-type-other">Specify type *</Label>
                          <Input id="add-user-org-type-other" className="mt-1" value={form.organisationTypeOther} onChange={(e) => setField('organisationTypeOther', e.target.value)} />
                          <FieldError message={errors.organisationTypeOther} />
                        </div>
                      )}
                      <div>
                        <Label htmlFor="add-user-org-name">Organisation name *</Label>
                        <Input id="add-user-org-name" className="mt-1" value={form.organizationName} onChange={(e) => setField('organizationName', e.target.value)} placeholder="Registered name" />
                        <FieldError message={errors.organizationName} />
                      </div>
                      <div>
                        <Label htmlFor="add-user-org-role">Role in organisation *</Label>
                        <Input id="add-user-org-role" className="mt-1" value={form.organizationRole} onChange={(e) => setField('organizationRole', e.target.value)} placeholder="e.g. CEO, Field Officer" />
                        <FieldError message={errors.organizationRole} />
                      </div>
                      {(form.category === 'fpo' || form.category === 'ngo') && (
                        <div>
                          <Label htmlFor="add-user-farmer-count">Number of farmers served *</Label>
                          <Input id="add-user-farmer-count" className="mt-1" type="number" min={1} value={form.numberOfFarmers} onChange={(e) => setField('numberOfFarmers', e.target.value)} placeholder="Approximate count" />
                          <FieldError message={errors.numberOfFarmers} />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Label>Operating state(s) *</Label>
                        <div className="mt-1">
                          <MultiSearchableSelect items={states.map((state) => ({ value: state.name, label: state.name }))} values={form.organizationState} onValuesChange={(values) => setField('organizationState', values)} placeholder="Search operating states…" helperText="Select all states where the organisation operates." />
                        </div>
                        <FieldError message={errors.organizationState} />
                      </div>
                      {form.category === 'volunteer' && (
                        <>
                          <div>
                            <Label htmlFor="add-user-season">Season</Label>
                            <select id="add-user-season" className={selectClassName} value={form.season} onChange={(e) => setField('season', e.target.value)}>
                              <option value="">Optional</option>
                              {SEASONS.map((season) => <option key={season.value} value={season.value}>{season.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label>Crop focus</Label>
                            <Button type="button" variant="outline" className="mt-1 w-full justify-start font-normal" onClick={() => setVolunteerCropPickerOpen(true)}>
                              {form.volunteerCrops.length ? `${form.volunteerCrops.length} crop${form.volunteerCrops.length === 1 ? '' : 's'} selected` : 'Select crops (optional)…'}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Section>
              )}

              {formError && <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</div>}
            </div>

            <DialogFooter className="shrink-0 gap-2 border-t border-border-subtle bg-surface px-5 py-4 sm:px-7">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>Cancel</Button>
              <Button type="submit" disabled={creating || loadingStates}>
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {creating ? 'Creating…' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CropPickerModal open={cropPickerOpen} onOpenChange={setCropPickerOpen} selected={form.crops} onSelectionChange={(crops) => setField('crops', crops)} title="Select primary crops" />
      <CropPickerModal open={volunteerCropPickerOpen} onOpenChange={setVolunteerCropPickerOpen} selected={form.volunteerCrops} onSelectionChange={(crops) => setField('volunteerCrops', crops)} title="Select crop focus" />
    </>
  )
}