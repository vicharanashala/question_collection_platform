import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '@/stores/AuthContext'
import { accountLockedEmitter, sessionExpiredEmitter } from '@/events/accountLockedEvents'
import { PROFILE_DRAFT_KEY } from '@/utils/profileDraft'
import { buildAuthUser } from '../../utils/factories'

const me = vi.hoisted(() => vi.fn())
vi.mock('@/client/client', () => ({ authApi: { me: () => me() } }))

const renderAuth = () => renderHook(() => useAuth(), { wrapper: AuthProvider })

const user = buildAuthUser()
const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' }

describe('AuthProvider', () => {
  beforeEach(() => {
    me.mockReset()
    me.mockResolvedValue({ user })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts signed out without stored credentials and does not call the API', () => {
    const { result } = renderAuth()

    expect(result.current.isAuthenticated).toBe(false)
    expect(me).not.toHaveBeenCalled()
  })

  it('persists tokens and user on login', async () => {
    const { result } = renderAuth()

    act(() => result.current.login(tokens, user))

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))
    expect(localStorage.getItem('access_token')).toBe('access-1')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1')
    expect(JSON.parse(localStorage.getItem('auth_user') ?? '{}').id).toBe(user.id)
  })

  it('clears credentials and drafts on logout', () => {
    localStorage.setItem('public-ask-question-draft', 'draft')
    localStorage.setItem(PROFILE_DRAFT_KEY, '{}')
    const { result } = renderAuth()
    act(() => result.current.login(tokens, user))

    act(() => result.current.logout())

    expect(result.current.isAuthenticated).toBe(false)
    ;['access_token', 'refresh_token', 'auth_user', 'public-ask-question-draft', PROFILE_DRAFT_KEY].forEach((key) =>
      expect(localStorage.getItem(key)).toBeNull(),
    )
  })

  it('restores the session from storage and refreshes the user from the API', async () => {
    localStorage.setItem('access_token', 'stored')
    localStorage.setItem('auth_user', JSON.stringify(user))
    me.mockResolvedValue({ user: { ...user, name: 'Updated Name' } })

    const { result } = renderAuth()

    await waitFor(() => expect(result.current.user?.name).toBe('Updated Name'))
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('signs out when the stored session is no longer valid', async () => {
    localStorage.setItem('access_token', 'stale')
    localStorage.setItem('auth_user', JSON.stringify(user))
    me.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }))

    const { result } = renderAuth()

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false))
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('survives a corrupt stored user', () => {
    localStorage.setItem('auth_user', '{broken')

    expect(renderAuth().result.current.user).toBeNull()
  })

  it('merges profile updates into the user and storage', () => {
    const { result } = renderAuth()
    act(() => result.current.login(tokens, user))

    act(() => result.current.updateUser({ name: 'Asha' }))

    expect(result.current.user?.name).toBe('Asha')
    expect(JSON.parse(localStorage.getItem('auth_user') ?? '{}').name).toBe('Asha')
  })

  it('ignores profile updates while signed out', () => {
    const { result } = renderAuth()

    act(() => result.current.updateUser({ name: 'Asha' }))

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('auth_user')).toBeNull()
  })

  it.each([
    ['the account is locked', () => accountLockedEmitter.emit({ status: 'banned', reason: null, suspendedAt: null, bannedAt: null, suspendedUntil: null })],
    ['the session expires', () => sessionExpiredEmitter.emit()],
  ])('signs out when %s', (_case, trigger) => {
    const { result } = renderAuth()
    act(() => result.current.login(tokens, user))

    act(() => trigger())

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('signs out when the 30 second heartbeat reports a ban', async () => {
    vi.useFakeTimers()
    const { result } = renderAuth()
    act(() => result.current.login(tokens, user))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    me.mockRejectedValue(Object.assign(new Error('Locked'), { status: 423, data: { status: 'banned' } }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current.isAuthenticated).toBe(false)
  })

  it('keeps the session when the heartbeat fails for other reasons', async () => {
    vi.useFakeTimers()
    const { result } = renderAuth()
    act(() => result.current.login(tokens, user))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    me.mockRejectedValue(Object.assign(new Error('Offline'), { status: 503 }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(result.current.isAuthenticated).toBe(true)
  })

  it('throws a clear error when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // jsdom reports render errors on window as well; keep them out of the test output.
    const silence = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', silence)

    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider')
    window.removeEventListener('error', silence)
  })
})
