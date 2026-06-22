import { useState, useEffect } from 'react'
import { adminApi, getErrorMessage } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { SettingsSkeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Settings2, RefreshCw, Lock } from 'lucide-react'
import type { ConfigItem } from '@/types'

const CONFIG_META: Record<string, { label: string; suffix: string }> = {
  max_users_per_state:            { label: 'Max Users per State',       suffix: '' },
  min_withdrawal_amount:          { label: 'Min Withdrawal Amount',     suffix: ' \u20b9' },
  question_edit_window_seconds:   { label: 'Edit Window',                suffix: 's' },
  daily_question_limit:           { label: 'Daily Question Limit',       suffix: '/day' },
  ai_confidence_threshold:        { label: 'AI Confidence Threshold',    suffix: '%' },
  duplicate_similarity_threshold: { label: 'Duplicate Similarity',       suffix: '' },
  max_question_chars:             { label: 'Max Question Characters',   suffix: '' },
  max_image_size_mb:              { label: 'Max Image Size',             suffix: ' MB' },
}

const HIDDEN_CONFIG_KEYS = new Set(['video_max_duration_seconds', 'video_max_size_mb'])

export function SettingsPage() {
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'

  const [configs, setConfigs] = useState<ConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadConfigs() {
    try {
      const res = await adminApi.getConfig()
      setConfigs(res.items ?? [])
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to load configuration'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void loadConfigs() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await loadConfigs()
  }

  function openEdit(cfg: ConfigItem) {
    setEditKey(cfg.key)
    setEditValue(String(cfg.value))
  }

  async function handleSave() {
    if (!editKey) return
    const val = parseFloat(editValue)
    if (isNaN(val) || val < 0) {
      toast.error('Invalid value. Enter a non-negative number.')
      return
    }
    setSaving(true)
    try {
      await adminApi.updateConfig({ key: editKey, value: val })
      setConfigs((prev) =>
        prev.map((c) => (c.key === editKey ? { ...c, value: val } : c)),
      )
      toast.success('Configuration updated')
      setEditKey(null)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Update failed'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <SettingsSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-text flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            System Settings
          </h2>
          <p className="text-sm text-text-tertiary mt-1">
            Platform configuration values. Changes apply immediately and are audit-logged.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <Lock className="h-4 w-4 shrink-0" />
          Only <strong>super_admin</strong> can modify these settings.
        </div>
      )}

      {/* Config cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {configs
          .filter((cfg) => !HIDDEN_CONFIG_KEYS.has(cfg.key))
          .map((cfg) => {
            const meta = CONFIG_META[cfg.key]
            return (
              <Card key={cfg.key} className="shadow-xs">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-secondary truncate">
                        {meta?.label ?? cfg.key}
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-text tabular-nums">
                        {meta?.suffix === ' ₹' ? '₹' : ''}
                        {cfg.value}
                        {(meta?.suffix && meta?.suffix !== ' ₹') ? meta.suffix : ''}
                      </p>
                      {cfg.description && (
                        <p className="mt-1 text-xs text-text-tertiary">{cfg.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(cfg)}
                      disabled={!isSuperAdmin}
                      className="shrink-0 text-text-tertiary hover:text-text"
                    >
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {configs.length === 0 && !loading && (
        <p className="text-center text-sm text-text-secondary py-12">No configuration items found.</p>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editKey} onOpenChange={(o) => !o && setEditKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {editKey ? (CONFIG_META[editKey]?.label ?? editKey) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cfg-value">New Value</Label>
            <Input
              id="cfg-value"
              type="number"
              min={0}
              step="any"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditKey(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}