import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '@/api/client'
import { accountLockedEmitter } from '@/events/accountLockedEvents'
import type { AuthUser } from '@/types'

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (tokens: { accessToken: string; refreshToken: string }, user: AuthUser) => void
  logout: () => void
  updateUser: (updates: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('auth_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('access_token'))
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback((tokens: { accessToken: string; refreshToken: string }, userData: AuthUser) => {
    localStorage.setItem('access_token', tokens.accessToken)
    localStorage.setItem('refresh_token', tokens.refreshToken)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    setToken(tokens.accessToken)
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem('auth_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  // Rehydrate and refresh user from API on startup
  useEffect(() => {
    if (!token) return
    setIsLoading(true)
    authApi.me()
      .then(({ user: u }) => {
        const authUser: AuthUser = { ...u, token }
        login({ accessToken: token, refreshToken: localStorage.getItem('refresh_token') ?? token }, authUser)
      })
      .catch(() => {
        logout()
      })
      .finally(() => setIsLoading(false))
  }, [token])

  // Auto-logout when the user is suspended/banned mid-session
  useEffect(() => {
    const unsubscribe = accountLockedEmitter.on(() => {
      logout()
    })
    return unsubscribe
  }, [logout])

  // Heartbeat: probe /auth/me every 30s so bans are detected even during idle
  useEffect(() => {
    if (!token) return
    const interval = setInterval(async () => {
      try {
        await authApi.me()
      } catch (e: any) {
        if (e?.response?.status === 423) {
          accountLockedEmitter.emit(e.response.data)
          logout()
        }
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [token, logout])

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}