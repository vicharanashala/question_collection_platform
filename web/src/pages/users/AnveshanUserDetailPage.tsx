import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, MapPin, Phone, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi, getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserDetailSkeleton } from '@/components/ui/skeleton'
import { TesterTag } from '@/components/TesterTag'
import { AnveshanProgressSummary } from '@/components/anveshan-user/AnveshanProgressSummary'
import { AnveshanQuestionsTab } from '@/components/anveshan-user/AnveshanQuestionsTab'
import { AnveshanEntitiesTab } from '@/components/anveshan-user/AnveshanEntitiesTab'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils'
import type { AnveshanUserDetail, User } from '@/types'

// A labelled value in the profile grid; empty values show a dash.
function ProfileItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{value || '—'}</dd>
    </div>
  )
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">{children}</dl>
      </CardContent>
    </Card>
  )
}

// Profile details grouped into personal, location and organisation sections.
function ProfileTab({ user }: { user: User }) {
  return (
    <div className="space-y-4">
      <ProfileSection title="Personal">
        <ProfileItem label="Language" value={user.languagePreference} />
        <ProfileItem label="Category" value={user.category} />
        <ProfileItem label="Age" value={user.age} />
        <ProfileItem label="Gender" value={user.gender} />
        <ProfileItem label="Farm size" value={user.farmSize} />
        <ProfileItem label="Season" value={user.season} />
        <ProfileItem label="Main crop" value={user.cropType} />
      </ProfileSection>
      <ProfileSection title="Location">
        <ProfileItem label="State" value={user.state} />
        <ProfileItem label="District" value={user.district} />
        <ProfileItem label="Block" value={user.block} />
        <ProfileItem label="Village" value={user.village} />
        <ProfileItem label="KVK" value={user.kvk} />
      </ProfileSection>
      <ProfileSection title="Organisation and education">
        <ProfileItem label="Organisation" value={user.organizationName} />
        <ProfileItem label="Role" value={user.organizationRole} />
        <ProfileItem label="Organisation type" value={user.organisationType} />
        <ProfileItem label="College" value={user.collegeName} />
        <ProfileItem label="University" value={user.universityName} />
        <ProfileItem label="Course" value={user.courseName} />
      </ProfileSection>
      {user.crops?.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-foreground">Crops</h3>
            <div className="flex flex-wrap gap-2">
              {user.crops.map((crop) => <Badge key={crop} variant="secondary">{crop}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Staff review page for one Anveshan user: profile, milestone progress, questions with answers, and entities. */
export function AnveshanUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<AnveshanUserDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminApi
      .getAnveshanUserDetail(userId)
      .then((res) => { if (!cancelled) setDetail(res) })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err, 'Failed to load Anveshan user'))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [userId])

  if (loading) return <UserDetailSkeleton />
  if (!detail) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-muted-foreground">Anveshan user not found</p>
        <Button variant="outline" onClick={() => navigate('/users')}>
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Button>
      </div>
    )
  }

  const { user, progress, questions, entities } = detail
  const answered = questions.filter((q) => q.answer).length

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-black text-white ring-2 ring-primary/20">
            {getInitials(user.name || '', user.mobileNumber)}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold text-foreground sm:text-xl">{user.name || 'Unnamed user'}</h2>
                {user.username && <p className="text-xs text-text-tertiary sm:text-sm">@{user.username}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="gap-1 bg-emerald-600 text-white"><Sprout className="h-3 w-3" aria-hidden="true" />Anveshan user</Badge>
                  <Badge variant="secondary" className="capitalize">{user.verificationStatus.replace('_', ' ')}</Badge>
                  {user.isTester && <TesterTag />}
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={`/users/${user.id}?classic=1`}>Account and payment details</Link>
              </Button>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs text-text-secondary sm:grid-cols-2 lg:grid-cols-4 sm:text-sm">
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" /><dd>{user.mobileNumber}</dd></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /><dd className="truncate">{[user.district, user.state].filter(Boolean).join(', ') || '—'}</dd></div>
              <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" aria-hidden="true" /><dd>Joined {formatDate(user.createdAt)}</dd></div>
              <div className="flex items-center gap-2"><Clock className="h-4 w-4 shrink-0" aria-hidden="true" /><dd>{user.lastLoginAt ? `Last login ${formatDateTime(user.lastLoginAt)}` : 'Never logged in'}</dd></div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <AnveshanProgressSummary progress={progress} />

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="questions">
          <p className="mb-3 text-xs text-text-secondary">{answered} of {questions.length} questions answered</p>
          <AnveshanQuestionsTab questions={questions} />
        </TabsContent>
        <TabsContent value="entities"><AnveshanEntitiesTab entities={entities} /></TabsContent>
        <TabsContent value="profile"><ProfileTab user={user} /></TabsContent>
      </Tabs>
    </div>
  )
}
