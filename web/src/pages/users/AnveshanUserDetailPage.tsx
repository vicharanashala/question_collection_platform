import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Download, MapPin, Phone, Sprout } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi, getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/badge'
import { NewBadge } from '@/components/ui/new-badge'
import { markFeatureSeen } from '@/lib/newFeatures'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserDetailSkeleton } from '@/components/ui/skeleton'
import { TesterTag } from '@/components/TesterTag'
import { AnveshanProgressSummary } from '@/components/anveshan-user/AnveshanProgressSummary'
import { AnveshanQuestionsTab, AnveshanQuestionsToolbar } from '@/components/anveshan-user/AnveshanQuestionsTab'
import { AnveshanExportDialog } from '@/components/anveshan-user/AnveshanExportDialog'
import { AnveshanEntitiesTab } from '@/components/anveshan-user/AnveshanEntitiesTab'
import { formatDate, formatDateTime, getInitials } from '@/lib/utils'
import type { AnveshanUserDetail } from '@/types'

/** Staff review page for one Anveshan user: profile, milestone progress, questions with answers, and entities. */
export function AnveshanUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<AnveshanUserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [tab, setTab] = useState('questions')
  const [search, setSearch] = useState('')
  const [answeredOnly, setAnsweredOnly] = useState(false)

  // Opening the page counts as having seen the new Anveshan user page.
  useEffect(() => { markFeatureSeen('anveshanUserPage') }, [])

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
    <div className="space-y-5">
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </button>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-black text-white ring-2 ring-primary/20 sm:h-16 sm:w-16 sm:text-lg">
              {getInitials(user.name || '', user.mobileNumber)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-lg font-extrabold leading-tight text-foreground sm:text-xl">{user.name || 'Unnamed user'}</h2>
              {user.username && <p className="text-xs text-text-tertiary sm:text-sm">@{user.username}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="gap-1 bg-emerald-600 text-white"><Sprout className="h-3 w-3" aria-hidden="true" />Anveshan user</Badge>
                <Badge variant="secondary" className="capitalize">{user.verificationStatus.replace('_', ' ')}</Badge>
                {user.isTester && <TesterTag />}
              </div>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => { markFeatureSeen('anveshanUserExport'); setExportOpen(true) }}>
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Export
              <NewBadge feature="anveshanUserExport" className="ml-1.5" />
            </Button>
          </div>
          <dl className="grid grid-cols-1 gap-3 border-t border-border-subtle pt-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Phone, label: 'Mobile', value: user.mobileNumber },
              { icon: MapPin, label: 'Location', value: [user.district, user.state].filter(Boolean).join(', ') || '—' },
              { icon: Calendar, label: 'Joined', value: formatDate(user.createdAt) ?? '—' },
              { icon: Clock, label: 'Last login', value: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never logged in' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-w-0 items-start gap-3 rounded-lg bg-surface-variant/50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium text-foreground">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <AnveshanProgressSummary progress={progress} />
      <AnveshanExportDialog detail={detail} open={exportOpen} onOpenChange={setExportOpen} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="self-start">
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
            <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
          </TabsList>
          {tab === 'questions' && (
            <AnveshanQuestionsToolbar
              search={search}
              answeredOnly={answeredOnly}
              onSearchChange={setSearch}
              onAnsweredOnlyChange={setAnsweredOnly}
            />
          )}
        </div>
        <TabsContent value="questions" className="space-y-3">
          <p className="text-xs text-text-secondary">{answered} of {questions.length} questions answered</p>
          <AnveshanQuestionsTab questions={questions} search={search} answeredOnly={answeredOnly} />
        </TabsContent>
        <TabsContent value="entities"><AnveshanEntitiesTab entities={entities} /></TabsContent>
      </Tabs>
    </div>
  )
}
