import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock, Download, MapPin, Phone, Sprout } from 'lucide-react'
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
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Export
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
      <AnveshanExportDialog detail={detail} open={exportOpen} onOpenChange={setExportOpen} />

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="entities">Entities ({entities.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="questions">
          <p className="mb-3 text-xs text-text-secondary">{answered} of {questions.length} questions answered</p>
          <AnveshanQuestionsTab questions={questions} />
        </TabsContent>
        <TabsContent value="entities"><AnveshanEntitiesTab entities={entities} /></TabsContent>
      </Tabs>
    </div>
  )
}
