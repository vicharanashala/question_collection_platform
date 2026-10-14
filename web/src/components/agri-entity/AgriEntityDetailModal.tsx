import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TesterTag } from '@/components/TesterTag'
import { BookOpen, Calendar, ImageIcon, Maximize2, Tags, User as UserIcon } from 'lucide-react'
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
  const [selectedImage, setSelectedImage] = useState(0)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const isStaffView = entity?.submitter !== undefined
  // Anveshan users do not see review status, and staff do not need to see the pending state.
  const hideStatus = !!user?.isAnveshanUser || (isStaffView && entity?.status === 'pending')
  const typeLabel = entity
    ? t(`agriEntity.tabs.${entity.type}`, AGRI_ENTITY_TYPES.find((type) => type.value === entity.type)?.label ?? '')
    : ''

  // Closes the dialog and resets the gallery for the next submission.
  const handleOpenChange = (open: boolean) => {
    if (open) return
    setSelectedImage(0)
    setViewerIndex(null)
    onClose()
  }

  return (
    <Dialog open={entity !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[94dvh] max-h-[94dvh] max-w-[calc(100vw-16px)] lg:max-w-6xl xl:max-w-7xl content-start gap-0 overflow-y-auto p-0 sm:p-0">
        {entity && (
          <>
            <DialogHeader className="space-y-2 border-b border-border-subtle bg-surface px-5 py-5 pr-12 sm:px-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {typeLabel}
                </span>
                {!hideStatus && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider', agriEntityStatusBadge(entity.status))}>
                    {agriEntityStatusLabel(t, entity.status)}
                  </span>
                )}
              </div>
              <DialogTitle className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                {entity.englishName}
                <span className="font-semibold text-text-secondary"> · {entity.localName}</span>
              </DialogTitle>
              {entity.botanicalName && <p className="text-sm italic text-text-secondary sm:text-base">{entity.botanicalName}</p>}
            </DialogHeader>

            <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <section aria-label={t('agriEntity.images', 'Images')} className="space-y-3 lg:sticky lg:top-0 lg:self-start">
                {entity.imageUrls.length === 0 ? (
                  <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-border-subtle text-text-tertiary">
                    <ImageIcon className="h-8 w-8" aria-hidden="true" />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setViewerIndex(selectedImage)}
                      aria-label={t('agriEntity.viewImage', { n: selectedImage + 1, defaultValue: 'View photo {{n}} full size' })}
                      className="group relative block w-full overflow-hidden rounded-xl border border-border-subtle bg-black/5 focus:outline-none focus:ring-2 focus:ring-focus dark:bg-black/30"
                    >
                      <img
                        src={entity.imageUrls[selectedImage] ?? entity.imageUrls[0]}
                        alt={t('agriEntity.imageAlt', { n: selectedImage + 1, name: entity.englishName, defaultValue: '{{name}} photo {{n}}' })}
                        className="aspect-[4/3] w-full object-contain"
                      />
                      <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white opacity-90 transition group-hover:bg-black/80">
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('agriEntity.viewFull', 'View full size')}
                      </span>
                      {entity.imageUrls.length > 1 && (
                        <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                          {selectedImage + 1} / {entity.imageUrls.length}
                        </span>
                      )}
                    </button>
                    {entity.imageUrls.length > 1 && (
                      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                        {entity.imageUrls.map((url, i) => (
                          <button
                            key={url}
                            type="button"
                            onClick={() => setSelectedImage(i)}
                            aria-label={t('agriEntity.showImage', { n: i + 1, defaultValue: 'Show photo {{n}}' })}
                            aria-current={i === selectedImage}
                            className={cn(
                              'overflow-hidden rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-focus',
                              i === selectedImage ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
                            )}
                          >
                            <img src={url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              <div className="space-y-5">
                <div className="grid gap-4 rounded-xl border border-border-subtle bg-card p-5 sm:grid-cols-3">
                  <Field label={t('agriEntity.localName', 'Local Name')} value={entity.localName} />
                  <Field label={t('agriEntity.englishName', 'English Name')} value={entity.englishName} />
                  <Field label={t('agriEntity.botanicalName', 'Botanical Name')} value={entity.botanicalName} italic />
                </div>

                {entity.localNameSource?.trim() && (
                  <Panel icon={BookOpen} title={t('agriEntity.localNameSource', 'Source supporting the local name = standard name')}>
                    <SourceText value={entity.localNameSource} />
                  </Panel>
                )}

                {entity.alternateNames?.length > 0 && (
                  <Panel icon={Tags} title={t('agriEntity.alternateNames', 'Alternate names with sources')}>
                    <ul className="divide-y divide-border-subtle">
                      {entity.alternateNames.map((alt, i) => (
                        <li key={`${alt.name}-${i}`} className="space-y-0.5 py-2.5 first:pt-0 last:pb-0">
                          <p className="text-sm font-semibold text-foreground">{alt.name}</p>
                          <SourceText value={alt.source} />
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                <div className="grid gap-4 rounded-xl border border-border-subtle bg-card p-5 sm:grid-cols-2">
                  {isStaffView && (
                    <div className="flex min-w-0 items-start gap-3">
                      <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('agriEntity.submittedBy', 'Submitted by')}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-medium text-foreground">{submitterName(entity)}</p>
                          {entity.submitter?.isTester && <TesterTag />}
                        </div>
                        {entity.submitter?.username && <p className="text-xs text-text-tertiary">@{entity.submitter.username}</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex min-w-0 items-start gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{t('submissions.submitted')}</p>
                      <p className="mt-0.5 text-sm font-medium text-foreground">{formatDateTime(entity.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
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
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={cn('mt-1 break-words text-sm font-medium text-foreground sm:text-base', italic && 'italic')}>{value || '—'}</p>
    </div>
  )
}

// Titled card used for the source and alternate name sections.
function Panel({ icon: Icon, title, children }: { icon: typeof ImageIcon; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border-subtle bg-card p-5">
      <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">
        <Icon className="h-4 w-4" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  )
}

// Renders a source reference as a link or plain text, or nothing when the optional source is empty.
function SourceText({ value }: { value?: string }) {
  if (!value?.trim()) return null
  const isLink = /^https?:\/\//i.test(value)
  return isLink ? (
    <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-primary underline-offset-2 hover:underline sm:text-sm">
      {value}
    </a>
  ) : (
    <p className="break-words text-xs text-text-secondary sm:text-sm">{value}</p>
  )
}
