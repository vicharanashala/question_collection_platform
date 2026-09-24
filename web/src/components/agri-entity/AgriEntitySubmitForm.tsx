import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus, Loader2, Plus, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { agriEntityApi, getErrorMessage } from '@/api/client'
import { storageApi } from '@/api/storage'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AGRI_ENTITY_IMAGE_MIME_TYPES,
  MAX_AGRI_ENTITY_IMAGES,
  MAX_AGRI_ENTITY_NAME_LENGTH,
  MAX_AGRI_ENTITY_SOURCE_LENGTH,
} from '@/constants/public'
import type { AgriEntityAlternateName, AgriEntityType } from '@/types'

interface SelectedImage {
  id: string
  file: File
  previewUrl: string
}

interface FormValues {
  localName: string
  englishName: string
  botanicalName: string
  localNameSource: string
  alternateNames: AgriEntityAlternateName[]
}

type NameField = 'localName' | 'englishName' | 'botanicalName'

const EMPTY_ALTERNATE: AgriEntityAlternateName = { name: '', source: '' }

const EMPTY_VALUES: FormValues = {
  localName: '',
  englishName: '',
  botanicalName: '',
  localNameSource: '',
  alternateNames: [EMPTY_ALTERNATE],
}

// Returns true when every mandatory text field and at least one image are provided.
function isFormComplete(values: FormValues, imageCount: number): boolean {
  const filled = (v: string) => v.trim().length > 0
  return (
    filled(values.localName) &&
    filled(values.englishName) &&
    filled(values.botanicalName) &&
    filled(values.localNameSource) &&
    values.alternateNames.length > 0 &&
    values.alternateNames.every((a) => filled(a.name) && filled(a.source)) &&
    imageCount > 0
  )
}

// Builds a readable storage filename such as "tomato_2.jpg" from the English name.
function buildImageFilename(englishName: string, index: number, file: File): string {
  const slug = englishName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
  const ext = file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1]
  return `${slug}_${index + 1}.${ext ?? 'jpg'}`
}

interface AgriEntitySubmitFormProps {
  type: AgriEntityType
  typeLabel: string
}

/** Form for submitting a crop, weed, pest or disease with names, sources and images. */
export function AgriEntitySubmitForm({ type, typeLabel }: AgriEntitySubmitFormProps) {
  const { t } = useTranslation()
  const fieldId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Uploaded storage URLs keyed by image id, so a retry after a failed submit does not re-upload.
  const uploadedUrlsRef = useRef(new Map<string, string>())

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES)
  const [images, setImages] = useState<SelectedImage[]>([])
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Release preview object URLs when the form unmounts.
  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl)), [])

  const requiredError = t('agriEntity.errors.required', 'This field is required')
  const errorFor = (value: string) => (showErrors && !value.trim() ? requiredError : undefined)

  function setField(field: NameField | 'localNameSource', value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function updateAlternate(index: number, key: keyof AgriEntityAlternateName, value: string) {
    setValues((prev) => ({
      ...prev,
      alternateNames: prev.alternateNames.map((a, i) => (i === index ? { ...a, [key]: value } : a)),
    }))
  }

  function addAlternate() {
    setValues((prev) => ({ ...prev, alternateNames: [...prev.alternateNames, EMPTY_ALTERNATE] }))
  }

  function removeAlternate(index: number) {
    setValues((prev) => ({ ...prev, alternateNames: prev.alternateNames.filter((_, i) => i !== index) }))
  }

  // Adds picked files as previews, skipping unsupported types and anything over the image limit.
  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const valid = picked.filter((f) => AGRI_ENTITY_IMAGE_MIME_TYPES.includes(f.type))
    if (valid.length < picked.length) {
      toast.error(t('agriEntity.errors.imageType', 'Only JPEG, PNG and WEBP images are supported'))
    }
    const room = MAX_AGRI_ENTITY_IMAGES - images.length
    if (valid.length > room) {
      toast.error(t('agriEntity.errors.imageLimit', { max: MAX_AGRI_ENTITY_IMAGES, defaultValue: 'You can add up to {{max}} images' }))
    }
    const added = valid.slice(0, Math.max(room, 0)).map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    setImages((prev) => [...prev, ...added])
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((img) => img.id !== id)
    })
    uploadedUrlsRef.current.delete(id)
  }

  function resetForm() {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl))
    uploadedUrlsRef.current.clear()
    setImages([])
    setValues(EMPTY_VALUES)
    setShowErrors(false)
  }

  // Uploads any images not yet stored and returns their URLs in display order.
  async function uploadImages(): Promise<string[]> {
    return Promise.all(
      images.map(async (img, index) => {
        const cached = uploadedUrlsRef.current.get(img.id)
        if (cached) return cached
        const filename = buildImageFilename(values.englishName, index, img.file)
        const { url } = await storageApi.uploadAgriEntityImage(img.file, type, filename)
        uploadedUrlsRef.current.set(img.id, url)
        return url
      }),
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (!isFormComplete(values, images.length)) {
      setShowErrors(true)
      toast.error(t('agriEntity.errors.incomplete', 'Please fill in all fields and add at least one image'))
      return
    }

    setSubmitting(true)
    try {
      const imageUrls = await uploadImages()
      await agriEntityApi.submit({
        type,
        localName: values.localName.trim(),
        englishName: values.englishName.trim(),
        botanicalName: values.botanicalName.trim(),
        localNameSource: values.localNameSource.trim(),
        alternateNames: values.alternateNames.map((a) => ({ name: a.name.trim(), source: a.source.trim() })),
        imageUrls,
      })
      toast.success(t('agriEntity.submitted', { type: typeLabel, defaultValue: '{{type}} submitted successfully' }))
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err, t('agriEntity.errors.submitFailed', 'Submission failed. Please try again.')))
    } finally {
      setSubmitting(false)
    }
  }

  const nameFields: { key: NameField; label: string; placeholder: string }[] = [
    { key: 'localName', label: t('agriEntity.localName', 'Local Name'), placeholder: t('agriEntity.localNamePlaceholder', 'Name used in your area') },
    { key: 'englishName', label: t('agriEntity.englishName', 'English Name'), placeholder: t('agriEntity.englishNamePlaceholder', 'Common English name') },
    { key: 'botanicalName', label: t('agriEntity.botanicalName', 'Botanical Name'), placeholder: t('agriEntity.botanicalNamePlaceholder', 'Scientific name') },
  ]
  const imagesError = showErrors && images.length === 0
  const sourceError = errorFor(values.localNameSource)

  return (
    <Card>
      <CardContent className="p-5 lg:p-6">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Names */}
          <section className="space-y-3" aria-labelledby={`${fieldId}-names`}>
            <h2 id={`${fieldId}-names`} className="text-sm font-semibold text-foreground">
              {t('agriEntity.namesTitle', { type: typeLabel, defaultValue: '{{type}} names' })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {nameFields.map(({ key, label, placeholder }) => {
                const error = errorFor(values[key])
                const id = `${fieldId}-${key}`
                return (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={id}>{label} <span className="text-rose-600" aria-hidden="true">*</span></Label>
                    <Input
                      id={id}
                      required
                      value={values[key]}
                      onChange={(e) => setField(key, e.target.value)}
                      placeholder={placeholder}
                      maxLength={MAX_AGRI_ENTITY_NAME_LENGTH}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? `${id}-error` : undefined}
                      className={key === 'botanicalName' ? 'italic placeholder:not-italic' : undefined}
                    />
                    {error && <p id={`${id}-error`} className="text-xs text-rose-600">{error}</p>}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Source for local name = standard name */}
          <section className="space-y-1.5">
            <Label htmlFor={`${fieldId}-source`}>
              {t('agriEntity.localNameSource', 'Source supporting the local name = standard name')} <span className="text-rose-600" aria-hidden="true">*</span>
            </Label>
            <p id={`${fieldId}-source-hint`} className="text-[11px] text-text-tertiary sm:text-xs">
              {t('agriEntity.localNameSourceHint', 'A book, website, research paper or institution that confirms this local name refers to the standard name.')}
            </p>
            <Input
              id={`${fieldId}-source`}
              required
              value={values.localNameSource}
              onChange={(e) => setField('localNameSource', e.target.value)}
              placeholder={t('agriEntity.sourcePlaceholder', 'e.g. TNAU Agritech Portal, or a URL')}
              maxLength={MAX_AGRI_ENTITY_SOURCE_LENGTH}
              aria-invalid={Boolean(sourceError)}
              aria-describedby={`${fieldId}-source-hint${sourceError ? ` ${fieldId}-source-error` : ''}`}
            />
            {sourceError && <p id={`${fieldId}-source-error`} className="text-xs text-rose-600">{sourceError}</p>}
          </section>

          {/* Alternate names */}
          <section className="space-y-3" aria-labelledby={`${fieldId}-alt`}>
            <div>
              <h2 id={`${fieldId}-alt`} className="text-sm font-semibold text-foreground">
                {t('agriEntity.alternateNames', 'Alternate names with sources')} <span className="text-rose-600" aria-hidden="true">*</span>
              </h2>
              <p className="text-[11px] text-text-tertiary sm:text-xs">{t('agriEntity.alternateNamesHint', 'Add at least one other name and where it is used or documented.')}</p>
            </div>
            <ul className="space-y-3">
              {values.alternateNames.map((alt, index) => {
                const nameId = `${fieldId}-alt-name-${index}`
                const sourceId = `${fieldId}-alt-source-${index}`
                const nameError = errorFor(alt.name)
                const altSourceError = errorFor(alt.source)
                return (
                  <li key={index} className="rounded-xl border border-border-subtle bg-surface-variant/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                      <div className="space-y-1.5">
                        <Label htmlFor={nameId} className="text-xs">{t('agriEntity.alternateName', 'Alternate name')} {index + 1}</Label>
                        <Input
                          id={nameId}
                          value={alt.name}
                          onChange={(e) => updateAlternate(index, 'name', e.target.value)}
                          maxLength={MAX_AGRI_ENTITY_NAME_LENGTH}
                          aria-invalid={Boolean(nameError)}
                        />
                        {nameError && <p className="text-xs text-rose-600">{nameError}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={sourceId} className="text-xs">{t('agriEntity.source', 'Source')}</Label>
                        <Input
                          id={sourceId}
                          value={alt.source}
                          onChange={(e) => updateAlternate(index, 'source', e.target.value)}
                          maxLength={MAX_AGRI_ENTITY_SOURCE_LENGTH}
                          aria-invalid={Boolean(altSourceError)}
                        />
                        {altSourceError && <p className="text-xs text-rose-600">{altSourceError}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAlternate(index)}
                        disabled={values.alternateNames.length === 1}
                        className="justify-self-end text-text-secondary hover:text-rose-600 sm:mt-6"
                        aria-label={t('agriEntity.removeAlternate', { n: index + 1, defaultValue: 'Remove alternate name {{n}}' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <Button type="button" variant="outline" size="sm" onClick={addAlternate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('agriEntity.addAlternate', 'Add alternate name')}
            </Button>
          </section>

          {/* Images */}
          <section className="space-y-3" aria-labelledby={`${fieldId}-images`}>
            <div>
              <h2 id={`${fieldId}-images`} className="text-sm font-semibold text-foreground">
                {t('agriEntity.images', 'Images')} <span className="text-rose-600" aria-hidden="true">*</span>
              </h2>
              <p className="text-[11px] text-text-tertiary sm:text-xs">
                {t('agriEntity.imagesHint', { max: MAX_AGRI_ENTITY_IMAGES, defaultValue: 'Add 1 to {{max}} clear photos (JPEG, PNG or WEBP).' })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {images.map((img, index) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border-subtle bg-surface-variant">
                  <img
                    src={img.previewUrl}
                    alt={t('agriEntity.imageAlt', { n: index + 1, name: values.englishName || typeLabel, defaultValue: '{{name}} photo {{n}}' })}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    disabled={submitting}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50"
                    aria-label={t('agriEntity.removeImage', { n: index + 1, defaultValue: 'Remove image {{n}}' })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {images.length < MAX_AGRI_ENTITY_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={submitting}
                  className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50 ${
                    imagesError
                      ? 'border-rose-400 text-rose-600'
                      : 'border-border-subtle text-text-secondary hover:border-emerald-400 hover:text-emerald-700'
                  }`}
                >
                  <ImagePlus className="h-6 w-6" />
                  {t('agriEntity.addImage', 'Add image')}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={AGRI_ENTITY_IMAGE_MIME_TYPES.join(',')}
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleFilesPicked}
            />
            {imagesError && <p className="text-xs text-rose-600">{t('agriEntity.errors.imageRequired', 'Add at least one image')}</p>}
          </section>

          <div className="flex justify-end border-t border-border-subtle pt-4">
            <Button type="submit" disabled={submitting} className="w-full gap-2 sm:w-auto">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting
                ? t('agriEntity.submitting', 'Submitting...')
                : t('agriEntity.submit', { type: typeLabel, defaultValue: 'Submit {{type}}' })}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
