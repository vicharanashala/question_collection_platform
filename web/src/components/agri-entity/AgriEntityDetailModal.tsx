import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageIcon, Tags, BookOpen } from 'lucide-react'
import { cn, formatDateTime } from '@/lib/utils'
import { AGRI_ENTITY_TYPES } from '@/constants/public'
import type { AgriEntitySubmission } from '@/types'
import { agriEntityStatusBadge, agriEntityStatusLabel, submitterName } from './agriEntityStatus'

interface AgriEntityDetailModalProps {
  /** Submission to show; null closes the dialog. */
  entity: AgriEntitySubmission | null
  onClose: () => void
}

/** Read-only view of one crop / weed / pest / disease submission. */
export function AgriEntityDetailModal({ entity, onClose }: AgriEntityDetailModalProps): ReactNode {
  const { t } = useTranslation()
  const typeLabel = entity
    ? t(`agriEntity.tabs.${entity.type}`, AGRI_ENTITY_TYPES.find((type) => type.value === entity.type)?.label ?? '')
    : ''

  return (
    <Dialog open={entity !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92dvh] sm:max-h-[88vh] max-w-2xl gap-0 overflow-y-auto p-0 sm:p-0">
        {entity && (
          <>
            <DialogHeader className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-base sm:text-lg font-extrabold leading-tight text-foreground">
                  {entity.submitter === undefined
                    ? t('agriEntity.yourSubmission', { type: typeLabel, defaultValue: 'Your {{type}} submission' })
                    : t('agriEntity.submissionTitle', { type: typeLabel, defaultValue: '{{type}} submission' })}
                </DialogTitle>
                <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', agriEntityStatusBadge(entity.status))}>
                  {agriEntityStatusLabel(t, entity.status)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] sm:text-xs text-text-tertiary">
                {t('submissions.submitted')} {formatDateTime(entity.createdAt)}
                {entity.submitter !== undefined && <> · {submitterName(entity)}</>}
              </p>
            </DialogHeader>

            <div className="space-y-3 px-4 py-4 sm:px-5">
              <Card>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                  <Field label={t('agriEntity.localName', 'Local Name')} value={entity.localName} />
                  <Field label={t('agriEntity.englishName', 'English Name')} value={entity.englishName} />
                  <Field label={t('agriEntity.botanicalName', 'Botanical Name')} value={entity.botanicalName} italic />
                </CardContent>
              </Card>

              {entity.localNameSource?.trim() && (
                <Card>
                  <CardContent className="space-y-2 p-4 sm:p-5">
                    <SectionTitle icon={BookOpen}>{t('agriEntity.localNameSource', 'Source supporting the local name = standard name')}</SectionTitle>
                    <SourceText value={entity.localNameSource} />
                  </CardContent>
                </Card>
              )}

              {entity.alternateNames?.length > 0 && (
                <Card>
                  <CardContent className="space-y-2 p-4 sm:p-5">
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
                <CardContent className="space-y-2 p-4 sm:p-5">
                  <SectionTitle icon={ImageIcon}>{t('agriEntity.images', 'Images')}</SectionTitle>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {entity.imageUrls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border border-border-subtle">
                        <img src={url} alt={t('agriEntity.imageAlt', { n: i + 1, name: entity.englishName, defaultValue: '{{name}} photo {{n}}' })} className="aspect-square w-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
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
