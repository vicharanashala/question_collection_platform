import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

// ─── Exact mobile theme colors ────────────────────────────────────────────────
// These must match mobile/src/utils/theme.ts lightTheme/darkTheme colors exactly.

const lightColors = {
  background: '#FAFAFA',
  foreground: '#111827',
  card: '#FFFFFF',
  cardForeground: '#111827',
  popover: '#FFFFFF',
  popoverForeground: '#111827',
  primary: '#0D9488',
  primaryForeground: '#FFFFFF',
  secondary: '#F3F4F6',
  secondaryForeground: '#111827',
  muted: '#F9FAFB',
  mutedForeground: '#6B7280',
  accent: '#F3F4F6',
  accentForeground: '#111827',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  border: '#E5E7EB',
  input: '#F9FAFB',
  ring: '#0D9488',
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  surface: '#FFFFFF',
  surfaceVariant: '#F3F4F6',
  heroBg: '#0D9488',
  heroFg: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  borderSubtle: '#E5E7EB',
  focus: '#0D9488',
  chart1: '#0D9488',
  chart2: '#0891B2',
  chart3: '#7C3AED',
  chart4: '#D97706',
  chart5: '#059669',
}

const darkColors = {
  background: '#0F172A',
  foreground: '#F1F5F9',
  card: '#1E293B',
  cardForeground: '#F1F5F9',
  popover: '#1E293B',
  popoverForeground: '#F1F5F9',
  primary: '#2DD4BF',
  primaryForeground: '#042F2E',
  secondary: '#1E293B',
  secondaryForeground: '#F1F5F9',
  muted: '#1E293B',
  mutedForeground: '#94A3B8',
  accent: '#334155',
  accentForeground: '#F1F5F9',
  destructive: '#F87171',
  destructiveForeground: '#450A0A',
  border: '#334155',
  input: '#1E293B',
  ring: '#2DD4BF',
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  surface: '#1F2D3D',
  surfaceVariant: '#2A3A4E',
  heroBg: '#1A4D47',
  heroFg: '#E0F7F4',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  borderSubtle: '#334155',
  focus: '#2DD4BF',
  chart1: '#2DD4BF',
  chart2: '#38BDF8',
  chart3: '#A78BFA',
  chart4: '#FBBF24',
  chart5: '#34D399',
}

export type ThemeColors = typeof lightColors

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme
  colors: ThemeColors
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  colors: lightColors,
  toggleTheme: () => {},
  setTheme: () => {},
})

const STORAGE_KEY = 'theme_preference'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (saved) return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  const colors = theme === 'dark' ? darkColors : lightColors

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.classList.toggle('dark', t === 'dark')
    try { localStorage.setItem(STORAGE_KEY, t) } catch {}
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'))
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}