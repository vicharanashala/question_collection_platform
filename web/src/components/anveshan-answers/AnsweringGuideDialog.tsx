import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpenCheck, CheckCircle2, ListChecks, PenLine, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  MAX_ANVESHAN_ANSWER_LENGTH,
  MAX_ANVESHAN_ANSWER_SOURCES,
  MAX_ANVESHAN_REMARKS_LENGTH,
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
            {t('anveshanGuide.title', 'Answering guide')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('anveshanGuide.intro', {
              count: requiredAnswers,
              defaultValue:
                'Answer any {{count}} of your own questions with information you can back up. Here is how it works and what makes an answer useful to farmers.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm sm:px-6">
          <GuideSection icon={ListChecks} title={t('anveshanGuide.stepsTitle', 'How to answer')}>
            <ol className="list-decimal space-y-1.5 pl-5 text-text-secondary marker:font-semibold marker:text-text">
              <li>{t('anveshanGuide.step1', 'Pick a question from "Your Questions". Answered ones show a green "Answered" badge.')}</li>
              <li>{t('anveshanGuide.step2', 'Read the query again and write your answer in "Draft Response".')}</li>
              <li>{t('anveshanGuide.step3', 'Add anything reviewers should know in "Remarks" (optional).')}</li>
              <li>{t('anveshanGuide.step4', 'Add at least one source: choose the type, enter the source name, paste the link and page numbers, then press + (or Enter).')}</li>
              <li>{t('anveshanGuide.step5', 'Press Submit, cross-check everything in the confirmation, then confirm.')}</li>
            </ol>
          </GuideSection>

          <GuideSection icon={ShieldCheck} title={t('anveshanGuide.rulesTitle', 'Checks before your answer is accepted')}>
            <ul className="space-y-1.5 text-text-secondary">
              <Rule>{t('anveshanGuide.ruleUnlock', 'Answering unlocks only after your question, crop, weed, pest and disease submissions are complete.')}</Rule>
              <Rule>{t('anveshanGuide.ruleEligible', 'Only the questions listed here (your earliest submissions) can be answered.')}</Rule>
              <Rule>{t('anveshanGuide.ruleAnswer', { max: MAX_ANVESHAN_ANSWER_LENGTH, defaultValue: 'The answer is required and can be up to {{max}} characters.' })}</Rule>
              <Rule>{t('anveshanGuide.ruleRemarks', { max: MAX_ANVESHAN_REMARKS_LENGTH, defaultValue: 'Remarks are optional, up to {{max}} characters.' })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceCount', { max: MAX_ANVESHAN_ANSWER_SOURCES, defaultValue: 'At least 1 source is required, and you can add up to {{max}}.' })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceFields', 'Every source needs a type (Hyper Local, State, Central or Other), a name and a link.')}</Rule>
              <Rule>{t('anveshanGuide.ruleUrl', 'Links must be complete web addresses starting with http:// or https://.')}</Rule>
              <Rule>{t('anveshanGuide.rulePdf', 'For PDF links, page numbers are required so reviewers can find the exact lines.')}</Rule>
              <Rule>{t('anveshanGuide.rulePages', 'Page numbers must be whole numbers from 1, separated by commas, for example 4 or 12,13.')}</Rule>
              <Rule>{t('anveshanGuide.ruleDuplicate', 'The same link with the same type and pages cannot be added twice.')}</Rule>
              <Rule>{t('anveshanGuide.ruleOnce', 'Each question can be answered once. Answers cannot be edited after submitting.')}</Rule>
            </ul>
          </GuideSection>

          <GuideSection icon={PenLine} title={t('anveshanGuide.goodAnswerTitle', 'Writing a good answer')}>
            <ul className="space-y-1.5 text-text-secondary">
              <Tip>{t('anveshanGuide.good1', 'Answer the exact question asked: the crop, the problem and the stage the farmer describes.')}</Tip>
              <Tip>{t('anveshanGuide.good2', 'Start with the likely cause, then give clear steps the farmer can follow in order.')}</Tip>
              <Tip>{t('anveshanGuide.good3', 'Be specific: product or practice name, dose per litre or per acre, timing, interval and how many times.')}</Tip>
              <Tip>{t('anveshanGuide.good4', 'Prefer safe and low-cost options first (cultural, biological), then chemical control if needed, with safety precautions.')}</Tip>
              <Tip>{t('anveshanGuide.good5', 'Match the local context: state, season and variety. Mention when a local expert or KVK should be consulted.')}</Tip>
              <Tip>{t('anveshanGuide.good6', 'Use simple language, short sentences and the same language as the question where possible.')}</Tip>
              <Tip>{t('anveshanGuide.good7', 'Only write what your sources support. Do not guess doses or product names.')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={BookOpenCheck} title={t('anveshanGuide.sourcesTitle', 'Choosing authentic sources')}>
            <div className="grid gap-2 sm:grid-cols-2">
              <SourceType
                name={t('anveshanGuide.typeHyperLocal', 'Hyper Local')}
                example={t('anveshanGuide.typeHyperLocalEx', 'Krishi Vigyan Kendra (KVK), district agriculture office, local research station advisories.')}
              />
              <SourceType
                name={t('anveshanGuide.typeState', 'State')}
                example={t('anveshanGuide.typeStateEx', 'State agricultural university package of practices, state agriculture department portals.')}
              />
              <SourceType
                name={t('anveshanGuide.typeCentral', 'Central')}
                example={t('anveshanGuide.typeCentralEx', 'ICAR institutes, Ministry of Agriculture, CIB&RC approved uses, national crop portals.')}
              />
              <SourceType
                name={t('anveshanGuide.typeOther', 'Other')}
                example={t('anveshanGuide.typeOtherEx', 'Peer-reviewed journals, FAO and other recognised research bodies.')}
              />
            </div>
            <ul className="mt-3 space-y-1.5 text-text-secondary">
              <Tip>{t('anveshanGuide.src1', 'Use official or research websites (often .gov.in, .nic.in, .ac.in, .res.in, icar.org.in).')}</Tip>
              <Tip>{t('anveshanGuide.src2', 'Link to the exact page or document, not a home page, and give the page numbers for PDFs.')}</Tip>
              <Tip>{t('anveshanGuide.src3', 'Name the source clearly, for example "KAU Package of Practices 2016".')}</Tip>
              <Tip>{t('anveshanGuide.src4', 'Prefer recent, region-specific recommendations. Open the link once to make sure it works.')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={XCircle} title={t('anveshanGuide.avoidTitle', 'Avoid')}>
            <ul className="space-y-1.5 text-text-secondary">
              <Avoid>{t('anveshanGuide.avoid1', 'Social media posts, videos, forums, shopping sites or AI chat output as sources.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid2', 'Copying text without checking it fits the farmer’s crop and region.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid3', 'Banned or unapproved chemicals, or doses without units.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid4', 'Personal details, phone numbers or advertising in the answer.')}</Avoid>
            </ul>
          </GuideSection>
        </div>

        <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {t('anveshanGuide.close', 'Got it, start answering')}
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

function GuideSection({ icon: Icon, title, children }: GuideSectionProps) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  )
}

function Rule({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function Avoid({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

function SourceType({ name, example }: { name: string; example: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-variant/50 p-3">
      <p className="text-xs font-semibold text-text">{name}</p>
      <p className="mt-0.5 text-xs text-text-secondary">{example}</p>
    </div>
  )
}
