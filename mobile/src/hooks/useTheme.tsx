import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { AppTheme, lightTheme, darkTheme, Theme } from '../utils/theme';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: AppTheme;
  resolved: Theme; // 'light' | 'dark'
  isDark: boolean;
  toggle: () => void;
  setMode: (m: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override system default. Useful for dev-mode toggles. */
  defaultMode?: Theme;
}

export function ThemeProvider({ children, defaultMode }: ThemeProviderProps) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [override, setOverride] = useState<Theme | null>(defaultMode ?? null);

  // Sync override with system when no override is set
  useEffect(() => {
    if (override !== null) return;
    // System colour scheme has changed; state update not strictly needed
    // since we always derive from [override ?? system ?? 'light']
  }, [system, override]);

  const resolved: Theme = (override ?? (system ?? 'light')) as Theme;
  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  const toggle = useCallback(() => {
    setOverride((prev) => (prev === 'dark' ? 'light' : prev === 'light' ? 'dark' : 'dark'));
  }, []);

  const setMode = useCallback((m: Theme) => {
    setOverride(m);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, isDark: resolved === 'dark', toggle, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}