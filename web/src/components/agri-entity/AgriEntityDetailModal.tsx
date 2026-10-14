import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageIcon, Tags, BookOpen, Maximize2 } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import type { AgriEntitySubmission } from '@/types'
import { ImageLightbox } from './ImageLightbox'
import { agriEntityStatusBadge, agriEntityStatusLabel, submitterName } from './agriEntityStatus'

interface AgriEntityDetailModalProps {
  /** Submission to show; null closes the dialog. */
  entity: AgriEntitySubmission | null
  onClose: () => void
}

/** Read-only view of one crop / weed / pest / disease submission. */
export function AgriEntityDetailModal({ entity, onClose }: AgriEntityDetailModalProps): ReactNode {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  // Anveshan users do not see review status; staff (never Anveshan users) still do.
  const hideStatus = !!user?.isAnveshanUser || (entity?.submitter !== undefined && entity.status === 'pending')
  const typeLabel = entity
    ? t(`agriEntity.tabs.${entity.type}`, AGRI_ENTITY_TYPES.find((type) => type.value === entity.type)?.label ?? '')
    : ''

  return (
    <Dialog open={entity !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92dvh] sm:max-h-[88vh] max-w-4xl gap-0 overflow-y-auto p-0 sm:p-0">
        {entity && (
          <>
            <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-4 pr-12 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-xl sm:text-2xl font-extrabold leading-tight text-foreground">
                  {entity.submitter === undefined
                    ? t('agriEntity.yourSubmission', { type: typeLabel, defaultValue: 'Your {{type}} submission' })
                    : t('agriEntity.submissionTitle', { type: typeLabel, defaultValue: '{{type}} submission' })}
                </DialogTitle>
                {!hideStatus && (
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', agriEntityStatusBadge(entity.status))}>
                    {agriEntityStatusLabel(t, entity.status)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs sm:text-sm text-text-tertiary">
                {t('submissions.submitted')} {formatDateTime(entity.createdAt)}
                {entity.submitter !== undefined && <> · {submitterName(entity)}</>}
              </p>
            </DialogHeader>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <Card>
                <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-6">
                  <Field label={t('agriEntity.localName', 'Local Name')} value={entity.localName} />
                  <Field label={t('agriEntity.englishName', 'English Name')} value={entity.englishName} />
                  <Field label={t('agriEntity.botanicalName', 'Botanical Name')} value={entity.botanicalName} italic />
                </CardContent>
              </Card>

              {entity.localNameSource?.trim() && (
                <Card>
                  <CardContent className="space-y-2 p-4 sm:p-6">
                    <SectionTitle icon={BookOpen}>{t('agriEntity.localNameSource', 'Source supporting the local name = standard name')}</SectionTitle>
                    <SourceText value={entity.localNameSource} />
                  </CardContent>
                </Card>
              )}

              {entity.alternateNames?.length > 0 && (
                <Card>
                  <CardContent className="space-y-2 p-4 sm:p-6">
                    <SectionTitle icon={Tags}>{t('agriEntity.alternateNames', 'Alternate names with sources')}</SectionTitle>
                    <ul className="divide-y divide-border-subtle">
                      {entity.alternateNames.map((alt, i) => (
                        <li key={`${alt.name}-${i}`} className="py-2 first:pt-0 last:pb-0">
                          <p className="text-xs sm:text-sm font-medium text-foreground">{alt.name}</p>
                          <SourceText value={alt.source} />
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="space-y-2 p-4 sm:p-6">
                  <SectionTitle icon={ImageIcon}>{t('agriEntity.images', 'Images')}</SectionTitle>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {entity.imageUrls.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setViewerIndex(i)}
                        aria-label={t('agriEntity.viewImage', { n: i + 1, defaultValue: 'View photo {{n}} full size' })}
                        className="group relative block overflow-hidden rounded-lg border border-border-subtle focus:outline-none focus:ring-2 focus:ring-focus"
                      >
                        <img src={url} alt={t('agriEntity.imageAlt', { n: i + 1, name: entity.englishName, defaultValue: '{{name}} photo {{n}}' })} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" loading="lazy" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100">
                          <Maximize2 className="h-6 w-6" aria-hidden="true" />
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
            <ImageLightbox images={entity.imageUrls} index={viewerIndex} title={entity.englishName} onIndexChange={setViewerIndex} />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value, italic }: { label: string; value: string; italic?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={cn('mt-0.5 break-words text-xs sm:text-sm text-foreground', italic && 'italic')}>{value}</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }: { icon: typeof ImageIcon; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide text-text-secondary">
      <Icon className="h-4 w-4" />
      {children}
    </div>
  )
}

// Sources are often links; show those as clickable, everything else as plain text.
// Renders a source reference as a link or plain text, or nothing when the optional source is empty.
function SourceText({ value }: { value?: string }) {
  if (!value?.trim()) return null
  const isLink = /^https?:\/\//i.test(value)
  return isLink ? (
    <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-[11px] sm:text-xs text-primary underline-offset-2 hover:underline">
      {value}
    </a>
  ) : (
    <p className="break-words text-[11px] sm:text-xs text-text-tertiary">{value}</p>
  )
}
