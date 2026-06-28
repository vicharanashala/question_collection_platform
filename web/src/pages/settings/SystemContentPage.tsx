import { useState, useEffect, useRef } from 'react'
import { adminApi, getErrorMessage, systemApi } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { FileText, Upload, RefreshCw, Eye, CheckCircle2, XCircle, Download } from 'lucide-react'
import type { SystemContentType, SystemContentItem } from '@/types'

// ── Sample markdown content ───────────────────────────────────────────────────

const SAMPLE_TOS = `# Terms of Service

Last updated: June 2026

## 1. Acceptance of Terms



## 2. Purpose of the Platform



## 3. User Accounts



## 4. Content You Submit



## 5. Moderation



## 6. Rewards and Incentives



## 7. Privacy



## 8. Account Deletion



## 9. Limitation of Liability



## 10. Changes to Terms



## 11. Contact

`

const SAMPLE_PP = `# Privacy Policy

Last updated: June 2026

## 1. Information We Collect



## 2. How We Use Your Information



## 3. Data Storage & Security



## 4. Data Sharing



## 5. Your Rights



## 6. Children's Privacy



## 7. Changes to This Policy



## 8. Contact & Data Requests

`

// ── Helpers ──────────────────────────────────────────────────────────────────

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  content: string
  isActive: boolean
}

function emptyForm(): FormState {
  return { title: '', description: '', content: '', isActive: true }
}

export function SystemContentPage() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [tos, setTos] = useState<FormState>(emptyForm())
  const [pp, setPp] = useState<FormState>(emptyForm())

  const [originalTos, setOriginalTos] = useState<SystemContentItem | null>(null)
  const [originalPp, setOriginalPp] = useState<SystemContentItem | null>(null)

  const [previewItem, setPreviewItem] = useState<{ title: string; content: string } | null>(null)

  const fileInputTosRef = useRef<HTMLInputElement>(null)
  const fileInputPpRef = useRef<HTMLInputElement>(null)

  async function loadContent() {
    setLoading(true)
    try {
      const items = await systemApi.getAll()
      const tosItem = items.find((i) => i.type === 'terms_of_service') ?? null
      const ppItem = items.find((i) => i.type === 'privacy_policy') ?? null

      setOriginalTos(tosItem)
      setOriginalPp(ppItem)

      setTos({
        title: tosItem?.title ?? 'Terms of Service',
        description: tosItem?.description ?? '',
        content: tosItem?.content ?? '',
        isActive: tosItem?.isActive ?? true,
      })
      setPp({
        title: ppItem?.title ?? 'Privacy Policy',
        description: ppItem?.description ?? '',
        content: ppItem?.content ?? '',
        isActive: ppItem?.isActive ?? true,
      })
      console.debug('[SystemContent] getAll() → items:', items.length, items.map(i => ({ type: i.type, title: i.title, contentLen: i.content?.length ?? 0 })))
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load system content'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadContent() }, [])

  async function handleUpload(type: SystemContentType, file: File) {
    if (!file.name.endsWith('.md')) {
      toast.error('Only .md (markdown) files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5 MB.')
      return
    }
    setUploading(true)
    try {
      const { content } = await systemApi.uploadMarkdown(file)
      if (type === 'terms_of_service') {
        setTos((prev) => ({ ...prev, content }))
      } else {
        setPp((prev) => ({ ...prev, content }))
      }
      toast.success(`"${file.name}" loaded — review the content below before saving.`)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Upload failed'))
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(type: SystemContentType) {
    const form = type === 'terms_of_service' ? tos : pp
    if (!form.title.trim()) {
      toast.error('Title is required.')
      return
    }
    setSaving(true)
    try {
      await systemApi.upsert(type, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        content: form.content || undefined,
        isActive: form.isActive,
      })
      toast.success(`${type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy'} saved.`)
      void loadContent()
    } catch (e) {
      toast.error(getErrorMessage(e, 'Save failed'))
    } finally {
      setSaving(false)
    }
  }

  function hasChanges(type: SystemContentType) {
    const orig = type === 'terms_of_service' ? originalTos : originalPp
    const form = type === 'terms_of_service' ? tos : pp
    if (!orig) return true
    return (
      orig.title !== form.title ||
      (orig.description ?? '') !== form.description ||
      (orig.content ?? '') !== form.content ||
      orig.isActive !== form.isActive
    )
  }

  const preview = (item: FormState) => {
    setPreviewItem({ title: item.title, content: item.content })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Legal & Consent Content
          </h2>
          <p className="text-sm text-text-tertiary mt-1">
            Manage Terms of Service and Privacy Policy shown on the registration screen.
            Upload a <code className="text-xs bg-surface px-1 py-0.5 rounded">.md</code> file or write content directly.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadContent()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Only <strong>super_admin</strong> can modify these settings.
        </div>
      )}

      <Tabs defaultValue="terms_of_service" className="space-y-4">
        <TabsList>
          <TabsTrigger value="terms_of_service">Terms of Service</TabsTrigger>
          <TabsTrigger value="privacy_policy">Privacy Policy</TabsTrigger>
        </TabsList>

        {/* ── Terms of Service ── */}
        <TabsContent value="terms_of_service">
          <div className="flex justify-end mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadMarkdown('sample-terms-of-service.md', SAMPLE_TOS)}
              title="Download a template you can edit and re-upload"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Sample Terms of Service (.md)
            </Button>
          </div>
          <ContentEditor
            type="terms_of_service"
            form={tos}
            onChange={setTos}
            onSave={() => void handleSave('terms_of_service')}
            onUpload={(f) => void handleUpload('terms_of_service', f)}
            onPreview={() => preview(tos)}
            hasChanges={hasChanges('terms_of_service')}
            saving={saving}
            uploading={uploading}
            disabled={!isSuperAdmin}
            original={originalTos}
            fileInputRef={fileInputTosRef}
          />
        </TabsContent>

        {/* ── Privacy Policy ── */}
        <TabsContent value="privacy_policy">
          <div className="flex justify-end mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => downloadMarkdown('sample-privacy-policy.md', SAMPLE_PP)}
              title="Download a template you can edit and re-upload"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Download Sample Privacy Policy (.md)
            </Button>
          </div>
          <ContentEditor
            type="privacy_policy"
            form={pp}
            onChange={setPp}
            onSave={() => void handleSave('privacy_policy')}
            onUpload={(f) => void handleUpload('privacy_policy', f)}
            onPreview={() => preview(pp)}
            hasChanges={hasChanges('privacy_policy')}
            saving={saving}
            uploading={uploading}
            disabled={!isSuperAdmin}
            original={originalPp}
            fileInputRef={fileInputPpRef}
          />
        </TabsContent>
      </Tabs>

      {/* Preview dialog */}
      <Dialog open={!!previewItem} onOpenChange={(o) => !o && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewItem?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm text-text-secondary font-mono leading-relaxed">
              {previewItem?.content || <span className="text-text-tertiary italic">No content yet.</span>}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewItem(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Sub-component: editor card for one content type ──────────────────────────

interface ContentEditorProps {
  type: SystemContentType
  form: FormState
  onChange: (f: FormState) => void
  onSave: () => void
  onUpload: (file: File) => void
  onPreview: () => void
  hasChanges: boolean
  saving: boolean
  uploading: boolean
  disabled: boolean
  original: SystemContentItem | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

function ContentEditor({
  type,
  form,
  onChange,
  onSave,
  onUpload,
  onPreview,
  hasChanges,
  saving,
  uploading,
  disabled,
  original,
  fileInputRef,
}: ContentEditorProps) {
  const label = type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy'

  return (
    <Card className="shadow-xs">
      <CardContent className="p-6 space-y-5">
        {/* Status badge + last updated */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {form.isActive ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-3 w-3" /> Active — shown on registration
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-700">
                <XCircle className="h-3 w-3" /> Inactive — hidden from registration
              </span>
            )}
            {original?.updatedAt && (
              <span className="text-xs text-text-tertiary">
                Last saved {new Date(original.updatedAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onPreview}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Eye className="h-3.5 w-3.5" /> Preview content
          </button>
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ ...form, isActive: !form.isActive })}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              form.isActive ? 'bg-green-500' : 'bg-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.isActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <Label className="text-sm font-medium cursor-pointer" onClick={() => !disabled && onChange({ ...form, isActive: !form.isActive })}>
            Show on registration screen
          </Label>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor={`title-${type}`}>Title</Label>
          <Input
            id={`title-${type}`}
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
            disabled={disabled}
            placeholder={`e.g. ${label}`}
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor={`desc-${type}`}>
            Short Description
            <span className="ml-1 text-text-tertiary font-normal text-xs">(shown on consent screen)</span>
          </Label>
          <Input
            id={`desc-${type}`}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            disabled={disabled}
            placeholder="A one-line summary shown next to the checkbox on the registration screen"
          />
        </div>

        {/* Markdown file upload */}
        <div className="space-y-1.5">
          <Label>Upload .md File</Label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,text/markdown"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onUpload(file)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? 'Uploading…' : 'Upload .md file'}
            </Button>
            <span className="text-xs text-text-tertiary">
              Max 5 MB · .md files only
            </span>
          </div>
          {form.content && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Content loaded ({form.content.length.toLocaleString('en-IN')} characters)
            </p>
          )}
        </div>

        {/* Content textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`content-${type}`}>
              Content
              <span className="ml-1 text-text-tertiary font-normal text-xs">(markdown supported)</span>
            </Label>
            {form.content && (
              <button
                type="button"
                onClick={onPreview}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            )}
          </div>
          <textarea
            id={`content-${type}`}
            value={form.content}
            onChange={(e) => onChange({ ...form, content: e.target.value })}
            disabled={disabled}
            rows={18}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono disabled:opacity-50"
            placeholder={`Paste or write your ${label} content here (markdown supported).\n\nExample:\n## Section 1\n\nYour terms content here…`}
          />
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={onSave}
            disabled={disabled || saving || !hasChanges}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}