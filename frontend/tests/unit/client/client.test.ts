import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cache,
  clearRegistrationToken,
  getErrorMessage,
  getRegistrationToken,
  parseQuestionRejected,
  request,
  setRegistrationToken,
} from '@/client/client'
import { accountLockedEmitter, sessionExpiredEmitter } from '@/events/accountLockedEvents'
import { setAnveshanScope } from '@/stores/anveshanMode'
import { setTesterScope } from '@/stores/testerMode'

const BASE = '/api/v1'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('client/request', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    cache.invalidate()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    setAnveshanScope('all')
    setTesterScope('all')
    vi.useRealTimers()
  })

  // Returns the URL and init of the nth fetch call.
  const call = (n = 0) => {
    const [url, init] = fetchMock.mock.calls[n]
    return { url: String(url), headers: (init?.headers ?? {}) as Record<string, string>, init }
  }

  describe('headers', () => {
    it('sends JSON and the bearer token when signed in', async () => {
      localStorage.setItem('access_token', 'abc')
      fetchMock.mockResolvedValue(json({ ok: true }))

      await request('/profile', {}, false)

      expect(call().url).toBe(`${BASE}/profile`)
      expect(call().headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc' })
    })

    it('omits Authorization when signed out', async () => {
      fetchMock.mockResolvedValue(json({}))

      await request('/faqs', {}, false)

      expect(call().headers).not.toHaveProperty('Authorization')
    })

    it('lets callers override headers', async () => {
      fetchMock.mockResolvedValue(json({}))

      await request('/auth/register', { method: 'POST', headers: { Authorization: 'Bearer temp' } }, false)

      expect(call().headers.Authorization).toBe('Bearer temp')
    })
  })

  describe('staff mode scopes', () => {
    it('adds anveshanScope and tester to supported list endpoints', async () => {
      setAnveshanScope('only')
      setTesterScope('exclude')
      fetchMock.mockResolvedValue(json({ items: [] }))

      await request('/admin/users?page=2', {}, false)

      const url = new URL(call().url, 'http://x')
      expect(url.pathname).toBe(`${BASE}/admin/users`)
      expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', anveshanScope: 'only', tester: 'exclude' })
    })

    it('sends only the tester scope to the Anveshan-only feedback list', async () => {
      setAnveshanScope('only')
      setTesterScope('only')
      fetchMock.mockResolvedValue(json({ items: [] }))

      await request('/feedbacks/anveshan', {}, false)

      expect(call().url).toBe(`${BASE}/feedbacks/anveshan?tester=only`)
    })

    it('leaves writes and unsupported paths untouched', async () => {
      setAnveshanScope('only')
      fetchMock.mockImplementation(async () => json({}))

      await request('/admin/users', { method: 'POST' }, false)
      await request('/notifications', {}, false)

      expect(call(0).url).toBe(`${BASE}/admin/users`)
      expect(call(1).url).toBe(`${BASE}/notifications`)
    })
  })

  describe('caching', () => {
    it('serves repeated GETs from the cache', async () => {
      fetchMock.mockImplementation(async () => json({ value: 1 }))

      const first = await request('/crops')
      const second = await request('/crops')

      expect(second).toEqual(first)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    // Known gap: request() starts the fetch before handing it to deduplicate(), so two
    // concurrent GETs still hit the network twice. This flips to passing once fixed.
    it.fails('sends concurrent identical GETs only once', async () => {
      fetchMock.mockImplementation(async () => json({ value: 1 }))

      await Promise.all([request('/crops'), request('/crops')])

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('bypasses the cache when asked', async () => {
      fetchMock.mockImplementation(async () => json({}))

      await request('/auth/me', {}, false)
      await request('/auth/me', {}, false)

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('refetches after the cache is invalidated', async () => {
      fetchMock.mockImplementation(async () => json({}))

      await request('/faqs/visible')
      cache.invalidate('/faqs')
      await request('/faqs/visible')

      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('errors', () => {
    it('throws an error with status, body and the server message', async () => {
      fetchMock.mockResolvedValue(json({ message: 'Question text too long' }, 400))

      await expect(request('/questions', { method: 'POST' }, false)).rejects.toMatchObject({
        message: 'Question text too long',
        status: 400,
        data: { message: 'Question text too long' },
      })
    })

    it('falls back to a generic message for non-JSON error bodies', async () => {
      fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 404 }))

      await expect(request('/x', {}, false)).rejects.toMatchObject({ message: 'Request failed with 404', status: 404 })
    })

    it('does not retry client errors', async () => {
      fetchMock.mockResolvedValue(json({}, 422))

      await expect(request('/x', { method: 'POST' }, false)).rejects.toMatchObject({ status: 422 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('retries server errors twice with backoff before giving up', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      fetchMock.mockImplementation(async () => json({ message: 'down' }, 503))

      const result = request('/x', {}, false)
      const assertion = expect(result).rejects.toMatchObject({ status: 503 })
      await vi.runAllTimersAsync()
      await assertion

      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('recovers when a retry succeeds', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      fetchMock.mockResolvedValueOnce(json({}, 502)).mockResolvedValueOnce(json({ ok: true }))

      const result = request('/x', {}, false)
      await vi.runAllTimersAsync()

      await expect(result).resolves.toEqual({ ok: true })
    })

    it('emits an account locked event on 423', async () => {
      const listener = vi.fn()
      const unsubscribe = accountLockedEmitter.on(listener)
      fetchMock.mockResolvedValue(json({ status: 'banned', reason: 'Abuse' }, 423))

      await expect(request('/questions', {}, false)).rejects.toMatchObject({ status: 423 })

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ status: 'banned', reason: 'Abuse' }))
      unsubscribe()
    })
  })

  describe('token refresh', () => {
    beforeEach(() => {
      localStorage.setItem('access_token', 'expired')
      localStorage.setItem('refresh_token', 'refresh-1')
    })

    it('refreshes once on 401, stores the new tokens and retries with them', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ message: 'expired' }, 401))
        .mockResolvedValueOnce(json({ accessToken: 'fresh', refreshToken: 'refresh-2' }))
        .mockResolvedValueOnce(json({ items: [1] }))

      await expect(request('/notifications', {}, false)).resolves.toEqual({ items: [1] })

      expect(call(1).url).toBe(`${BASE}/auth/refresh`)
      expect(JSON.parse(String(call(1).init?.body))).toEqual({ refreshToken: 'refresh-1' })
      expect(call(2).headers.Authorization).toBe('Bearer fresh')
      expect(localStorage.getItem('access_token')).toBe('fresh')
      expect(localStorage.getItem('refresh_token')).toBe('refresh-2')
    })

    it('ends the session when the refresh token is rejected', async () => {
      const listener = vi.fn()
      const unsubscribe = sessionExpiredEmitter.on(listener)
      fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ code: 'SESSION_REVOKED' }, 401))

      await expect(request('/notifications', {}, false)).rejects.toMatchObject({ status: 401 })

      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it('keeps the login when refresh fails for another reason, such as a 503', async () => {
      const listener = vi.fn()
      const unsubscribe = sessionExpiredEmitter.on(listener)
      fetchMock.mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json({ message: 'down' }, 503))

      await expect(request('/notifications', {}, false)).rejects.toMatchObject({ status: 401 })

      expect(listener).not.toHaveBeenCalled()
      expect(localStorage.getItem('refresh_token')).toBe('refresh-1')
      unsubscribe()
    })

    it.each(['/auth/verify-otp', '/auth/refresh'])('never refreshes for %s', async (path) => {
      fetchMock.mockResolvedValue(json({ message: 'Invalid OTP' }, 401))

      await expect(request(path, { method: 'POST' }, false)).rejects.toMatchObject({ status: 401 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not try to refresh without a refresh token', async () => {
      localStorage.removeItem('refresh_token')
      fetchMock.mockResolvedValue(json({}, 401))

      await expect(request('/notifications', {}, false)).rejects.toMatchObject({ status: 401 })

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})

describe('client helpers', () => {
  describe('registration token', () => {
    it('stores the token in session and local storage and clears both', () => {
      setRegistrationToken('temp')

      expect(sessionStorage.getItem('registration_token')).toBe('temp')
      expect(getRegistrationToken()).toBe('temp')

      clearRegistrationToken()

      expect(getRegistrationToken()).toBeNull()
    })

    it('falls back to local storage when the tab session was lost', () => {
      localStorage.setItem('registration_token', 'from-local')

      expect(getRegistrationToken()).toBe('from-local')
    })
  })

  describe('parseQuestionRejected', () => {
    const rejected = (category?: string, reason?: unknown) => ({
      status: 422,
      data: { error: 'QUESTION_REJECTED', category, reason },
    })

    it.each(['ABUSIVE', 'NOT_AGRICULTURE'])('reads the %s category', (category) => {
      expect(parseQuestionRejected(rejected(category, 'why'))).toEqual({ category, reason: 'why' })
    })

    it('maps unknown categories to OTHER and non-string reasons to null', () => {
      expect(parseQuestionRejected(rejected('SPAM', 42))).toEqual({ category: 'OTHER', reason: null })
    })

    it.each([
      null,
      'error',
      { status: 400, data: { error: 'QUESTION_REJECTED' } },
      { status: 422, data: { error: 'VALIDATION' } },
    ])('ignores %p', (error) => {
      expect(parseQuestionRejected(error)).toBeNull()
    })
  })

  describe('getErrorMessage', () => {
    it('prefers the Error message', () => {
      expect(getErrorMessage(new Error('Boom'), 'fallback')).toBe('Boom')
    })

    it('reads data.message from error-like objects', () => {
      expect(getErrorMessage({ data: { message: 'From API' } }, 'fallback')).toBe('From API')
    })

    it.each([undefined, 'text', { data: {} }])('uses the fallback for %p', (error) => {
      expect(getErrorMessage(error, 'fallback')).toBe('fallback')
    })
  })
})
