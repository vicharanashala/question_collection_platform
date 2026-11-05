import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenCheck, CheckCircle2, ListChecks, PenLine, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  MAX_ANVESHAN_ANSWER_LENGTH,
  MAX_ANVESHAN_ANSWER_SOURCES,
  MAX_ANVESHAN_REMARKS_LENGTH,
  MIN_ANVESHAN_ANSWER_LENGTH,
} from '@/constants/public'

interface AnsweringGuideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requiredAnswers: number
}

// Explains how to answer, every check applied before submitting, and how to write a well-sourced answer.
export function AnsweringGuideDialog({ open, onOpenChange, requiredAnswers }: AnsweringGuideDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 p-0 sm:max-w-2xl lg:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-border-subtle px-5 py-4 pr-12 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('anveshanGuide.title')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('anveshanGuide.intro', {
              count: requiredAnswers,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 divide-y divide-border-subtle overflow-y-auto px-5 text-sm sm:px-6">
          <GuideSection icon={ListChecks} title={t('anveshanGuide.stepsTitle')}>
            <ol className="list-decimal space-y-2.5 pl-5 leading-relaxed text-text-secondary marker:font-semibold marker:text-primary">
              <li>{t('anveshanGuide.step1')}</li>
              <li>{t('anveshanGuide.step2')}</li>
              <li>{t('anveshanGuide.step3')}</li>
              <li>{t('anveshanGuide.step4')}</li>
              <li>{t('anveshanGuide.step5')}</li>
            </ol>
          </GuideSection>

          <GuideSection icon={ShieldCheck} title={t('anveshanGuide.rulesTitle')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Rule>{t('anveshanGuide.ruleUnlock')}</Rule>
              <Rule>{t('anveshanGuide.ruleEligible')}</Rule>
              <Rule>
                {t('anveshanGuide.ruleAnswerLength', {
                  min: MIN_ANVESHAN_ANSWER_LENGTH,
                  max: MAX_ANVESHAN_ANSWER_LENGTH,
                })}
              </Rule>
              <Rule>{t('anveshanGuide.ruleRemarks', { max: MAX_ANVESHAN_REMARKS_LENGTH })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceCount', { max: MAX_ANVESHAN_ANSWER_SOURCES })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceFields')}</Rule>
              <Rule>{t('anveshanGuide.ruleUrl')}</Rule>
              <Rule>{t('anveshanGuide.rulePdf')}</Rule>
              <Rule>{t('anveshanGuide.rulePages')}</Rule>
              <Rule>{t('anveshanGuide.ruleDuplicate')}</Rule>
              <Rule>{t('anveshanGuide.ruleOnce')}</Rule>
              <Rule>{t('anveshanGuide.ruleEvaluation')}</Rule>
            </ul>
          </GuideSection>

          <GuideSection icon={PenLine} title={t('anveshanGuide.goodAnswerTitle')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Tip>{t('anveshanGuide.good1')}</Tip>
              <Tip>{t('anveshanGuide.good2')}</Tip>
              <Tip>{t('anveshanGuide.good3')}</Tip>
              <Tip>
                {t('anveshanGuide.goodLength', {
                  min: MIN_ANVESHAN_ANSWER_LENGTH,
                })}
              </Tip>
              <Tip>{t('anveshanGuide.good4')}</Tip>
              <Tip>{t('anveshanGuide.good5')}</Tip>
              <Tip>{t('anveshanGuide.good6')}</Tip>
              <Tip>{t('anveshanGuide.good7')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={BookOpenCheck} title={t('anveshanGuide.sourcesTitle')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <SourceType
                name={t('anveshanGuide.typeHyperLocal')}
                example={t('anveshanGuide.typeHyperLocalEx')}
              />
              <SourceType
                name={t('anveshanGuide.typeState')}
                example={t('anveshanGuide.typeStateEx')}
              />
              <SourceType
                name={t('anveshanGuide.typeCentral')}
                example={t('anveshanGuide.typeCentralEx')}
              />
              <SourceType
                name={t('anveshanGuide.typeOther')}
                example={t('anveshanGuide.typeOtherEx')}
              />
            </div>
            <ul className="mt-4 space-y-2.5 leading-relaxed text-text-secondary">
              <Tip>{t('anveshanGuide.src1')}</Tip>
              <Tip>{t('anveshanGuide.src2')}</Tip>
              <Tip>{t('anveshanGuide.src3')}</Tip>
              <Tip>{t('anveshanGuide.src4')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={XCircle} title={t('anveshanGuide.avoidTitle')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Avoid>{t('anveshanGuide.avoid1')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid2')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid3')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid4')}</Avoid>
            </ul>
          </GuideSection>
        </div>

        <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {t('anveshanGuide.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface GuideSectionProps {
  icon: LucideIcon
  title: string
  children: ReactNode
}

// One guide section: icon tile and heading, with the content spaced below.
function GuideSection({ icon: Icon, title, children }: GuideSectionProps) {
  return (
    <section className="py-5 first:pt-5 last:pb-6">
      <h3 className="mb-4 flex items-center gap-3 text-sm font-semibold text-text sm:text-base">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        {title}
      </h3>
      <div className="sm:pl-11">{children}</div>
    </section>
  )
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <ShieldCheck className="mt-[3px] h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="mt-[3px] h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Avoid({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <XCircle className="mt-[3px] h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

// One source type with example publishers; the examples are illustrative, not a closed list.
function SourceType({ name, example }: { name: string; example: string }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-variant/50 p-3.5">
      <p className="text-sm font-semibold text-text">{name}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
        <span className="font-medium text-text">{t('anveshanGuide.examplesLabel')}</span> {example}
      </p>
    </div>
  )
}
