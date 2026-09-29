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
            {t('anveshanGuide.title', 'Advisory guide')}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {t('anveshanGuide.intro', {
              count: requiredAnswers,
              defaultValue:
                'Write an advisory for any {{count}} of your farmer queries with information you can back up. Here is how it works and what makes an advisory useful to farmers.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 divide-y divide-border-subtle overflow-y-auto px-5 text-sm sm:px-6">
          <GuideSection icon={ListChecks} title={t('anveshanGuide.stepsTitle', 'How to write an advisory')}>
            <ol className="list-decimal space-y-2.5 pl-5 leading-relaxed text-text-secondary marker:font-semibold marker:text-primary">
              <li>{t('anveshanGuide.step1', 'Pick a query from "Farmers\' Queries". Queries with a submitted advisory show a green "Advisory given" badge.')}</li>
              <li>{t('anveshanGuide.step2', 'Read the query again and write your advisory in "Draft Advisory".')}</li>
              <li>{t('anveshanGuide.step3', 'Add anything reviewers should know in "Remarks" (optional).')}</li>
              <li>{t('anveshanGuide.step4', 'Add at least one source: choose the type, enter the source name, paste the link and page numbers, then press + (or Enter).')}</li>
              <li>{t('anveshanGuide.step5', 'Press Submit. If anything is missing, a message appears under that field; fix it and press Submit again, then confirm.')}</li>
            </ol>
          </GuideSection>

          <GuideSection icon={ShieldCheck} title={t('anveshanGuide.rulesTitle', 'Checks before your advisory is accepted')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Rule>{t('anveshanGuide.ruleUnlock', 'Advisories unlock only after your question, crop, weed, pest and disease submissions are complete.')}</Rule>
              <Rule>{t('anveshanGuide.ruleEligible', 'Only the queries listed here (your earliest submissions) can receive an advisory.')}</Rule>
              <Rule>
                {t('anveshanGuide.ruleAnswerLength', {
                  min: MIN_ANVESHAN_ANSWER_LENGTH,
                  max: MAX_ANVESHAN_ANSWER_LENGTH,
                  defaultValue: 'The advisory is required and must be between {{min}} and {{max}} characters. The counter above the advisory box turns green once you pass {{min}}.',
                })}
              </Rule>
              <Rule>{t('anveshanGuide.ruleRemarks', { max: MAX_ANVESHAN_REMARKS_LENGTH, defaultValue: 'Remarks are optional, up to {{max}} characters.' })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceCount', { max: MAX_ANVESHAN_ANSWER_SOURCES, defaultValue: 'At least 1 source is required, and you can add up to {{max}}.' })}</Rule>
              <Rule>{t('anveshanGuide.ruleSourceFields', 'Every source needs a type (Hyper Local, State, Central or Other), a name and a link.')}</Rule>
              <Rule>{t('anveshanGuide.ruleUrl', 'Links must be complete public web addresses starting with http:// or https://, for example https://agritech.tnau.ac.in/…')}</Rule>
              <Rule>{t('anveshanGuide.rulePdf', 'For PDF links, page numbers are required so reviewers can find the exact lines.')}</Rule>
              <Rule>{t('anveshanGuide.rulePages', 'Page numbers must be whole numbers from 1, separated by commas, for example 4 or 12,13.')}</Rule>
              <Rule>{t('anveshanGuide.ruleDuplicate', 'The same link with the same type and pages cannot be added twice.')}</Rule>
              <Rule>{t('anveshanGuide.ruleOnce', 'Each query can receive one advisory. Advisories cannot be edited after submitting.')}</Rule>
              <Rule>{t('anveshanGuide.ruleEvaluation', 'The quality of every submitted advisory is carefully reviewed during evaluation.')}</Rule>
            </ul>
          </GuideSection>

          <GuideSection icon={PenLine} title={t('anveshanGuide.goodAnswerTitle', 'Writing a good advisory')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Tip>{t('anveshanGuide.good1', 'Address the exact query: the crop, the problem and the stage the farmer describes.')}</Tip>
              <Tip>{t('anveshanGuide.good2', 'Start with the likely cause, then give clear steps the farmer can follow in order.')}</Tip>
              <Tip>{t('anveshanGuide.good3', 'Be specific: product or practice name, dose per litre or per acre, timing, interval and how many times.')}</Tip>
              <Tip>
                {t('anveshanGuide.goodLength', {
                  min: MIN_ANVESHAN_ANSWER_LENGTH,
                  defaultValue: 'Use the {{min}}+ characters to explain properly: the cause, step-by-step actions, doses and precautions. Do not pad with repeated text.',
                })}
              </Tip>
              <Tip>{t('anveshanGuide.good4', 'Prefer safe and low-cost options first (cultural, biological), then chemical control if needed, with safety precautions.')}</Tip>
              <Tip>{t('anveshanGuide.good5', 'Match the local context: state, season and variety. Mention when a local expert or KVK should be consulted.')}</Tip>
              <Tip>{t('anveshanGuide.good6', 'Use simple language, short sentences and the same language as the question where possible.')}</Tip>
              <Tip>{t('anveshanGuide.good7', 'Only write what your sources support. Do not guess doses or product names.')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={BookOpenCheck} title={t('anveshanGuide.sourcesTitle', 'Choosing authentic sources')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <SourceType
                name={t('anveshanGuide.typeHyperLocal', 'Hyper Local')}
                example={t('anveshanGuide.typeHyperLocalEx', 'Krishi Vigyan Kendra (KVK), district agriculture office or local research station advisories, or similar local sources.')}
              />
              <SourceType
                name={t('anveshanGuide.typeState', 'State')}
                example={t('anveshanGuide.typeStateEx', 'State agricultural university package of practices or state agriculture department portals, or similar state sources.')}
              />
              <SourceType
                name={t('anveshanGuide.typeCentral', 'Central')}
                example={t('anveshanGuide.typeCentralEx', 'ICAR institutes, Ministry of Agriculture, CIB&RC approved uses or national crop portals, or similar central sources.')}
              />
              <SourceType
                name={t('anveshanGuide.typeOther', 'Other')}
                example={t('anveshanGuide.typeOtherEx', 'Peer-reviewed journals, FAO or similar recognised research bodies.')}
              />
            </div>
            <ul className="mt-4 space-y-2.5 leading-relaxed text-text-secondary">
              <Tip>{t('anveshanGuide.src1', 'Use official or research websites, for example sites ending in .gov.in, .nic.in, .ac.in, .res.in or icar.org.in, or similar.')}</Tip>
              <Tip>{t('anveshanGuide.src2', 'Link to the exact page or document, not a home page, and give the page numbers for PDFs.')}</Tip>
              <Tip>{t('anveshanGuide.src3', 'Name the source clearly, for example "KAU Package of Practices 2016".')}</Tip>
              <Tip>{t('anveshanGuide.src4', 'Prefer recent, region-specific recommendations. Open the link once to make sure it works.')}</Tip>
            </ul>
          </GuideSection>

          <GuideSection icon={XCircle} title={t('anveshanGuide.avoidTitle', 'Avoid')}>
            <ul className="space-y-2.5 leading-relaxed text-text-secondary">
              <Avoid>{t('anveshanGuide.avoid1', 'Social media posts, videos, forums, shopping sites or AI chat output as sources.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid2', 'Copying text without checking it fits the farmer’s crop and region.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid3', 'Banned or unapproved chemicals, or doses without units.')}</Avoid>
              <Avoid>{t('anveshanGuide.avoid4', 'Personal details, phone numbers or advertising in the advisory.')}</Avoid>
            </ul>
          </GuideSection>
        </div>

        <div className="border-t border-border-subtle px-5 py-3 sm:px-6">
          <Button className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            {t('anveshanGuide.close', 'Got it, start writing advisories')}
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
        <span className="font-medium text-text">{t('anveshanGuide.examplesLabel', 'For example:')}</span> {example}
      </p>
    </div>
  )
}
