import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'

// ─── Annam.ai theme colors ────────────────────────────────────────────────────
// These mirror the CSS custom-property values in index.css :root / .dark so
// any component reading from `useTheme().colors` (e.g. inline-styled chart
// elements) sees the same hex values as the Tailwind classes.

const lightColors = {
  background: '#FAFAFA',
  foreground: '#171717',
  card: '#FFFFFF',
  cardForeground: '#171717',
  popover: '#FFFFFF',
  popoverForeground: '#171717',
  primary: '#22C55E',
  primaryForeground: '#FFFFFF',
  secondary: '#F5F5F5',
  secondaryForeground: '#171717',
  muted: '#F5F5F5',
  mutedForeground: '#737373',
  accent: '#F5F5F5',
  accentForeground: '#171717',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  border: '#E5E5E5',
  input: '#F5F5F5',
  ring: '#22C55E',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  surface: '#FFFFFF',
  surfaceVariant: '#F5F5F5',
  heroBg: '#22C55E',
  heroFg: '#FFFFFF',
  text: '#171717',
  textSecondary: '#737373',
  textTertiary: '#999999',
  borderSubtle: '#E5E5E5',
  focus: '#22C55E',
  chart1: '#22C55E',
  chart2: '#3B82F6',
  chart3: '#EF4444',
  chart4: '#F59E0B',
  chart5: '#24D366',
}

const darkColors = {
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  card: '#171717',
  cardForeground: '#FAFAFA',
  popover: '#171717',
  popoverForeground: '#FAFAFA',
  primary: '#22C55E',
  primaryForeground: '#FFFFFF',
  secondary: '#1F1F1F',
  secondaryForeground: '#FAFAFA',
  muted: '#1F1F1F',
  mutedForeground: '#A3A3A3',
  accent: '#262626',
  accentForeground: '#FAFAFA',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  border: '#262626',
  input: '#1F1F1F',
  ring: '#22C55E',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  surface: '#171717',
  surfaceVariant: '#212121',
  heroBg: '#1A4D2E',
  heroFg: '#E0F7E9',
  text: '#FAFAFA',
  textSecondary: '#A3A3A3',
  textTertiary: '#737373',
  borderSubtle: '#262626',
  focus: '#22C55E',
  chart1: '#22C55E',
  chart2: '#3B82F6',
  chart3: '#EF4444',
  chart4: '#F59E0B',
  chart5: '#24D366',
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
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  toggleTheme: () => {},
  // eslint-disable-next-line @typescript-eslint/no-empty-function
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
    try { localStorage.setItem(STORAGE_KEY, t) } catch { /* storage unavailable */ }
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