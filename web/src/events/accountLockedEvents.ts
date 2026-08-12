export interface AccountLockedInfo {
  status: 'suspended' | 'banned'
  reason: string | null
  suspendedAt: string | null
  bannedAt: string | null
  suspendedUntil: string | null
}

type Listener = (info: AccountLockedInfo) => void
const listeners = new Set<Listener>()

export const accountLockedEmitter = {
  on(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  emit(info: AccountLockedInfo) {
    listeners.forEach((l) => l(info))
  },
}

export function parseAccountLocked(body: unknown): AccountLockedInfo | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const rawStatus = String(b.status ?? '')
  if (rawStatus !== 'suspended' && rawStatus !== 'banned') return null
  return {
    status: rawStatus,
    reason: typeof b.reason === 'string' ? b.reason : null,
    suspendedAt: typeof b.suspendedAt === 'string' ? b.suspendedAt : null,
    bannedAt: typeof b.bannedAt === 'string' ? b.bannedAt : null,
    suspendedUntil: typeof b.suspendedUntil === 'string' ? b.suspendedUntil : null,
  }
}