import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppTheme, lightTheme, darkTheme, Theme, ThemePreference, THEME_STORAGE_KEY } from '../utils/theme';

// ─── Context ─────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: AppTheme;
  resolved: Theme; // 'light' | 'dark'
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTheme(preference: ThemePreference, system: ReturnType<typeof useColorScheme>): Theme {
  if (preference === 'system') return (system ?? 'light') as Theme;
  return preference;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
      setLoaded(true);
    }).catch(() => {
      setLoaded(true);
    });
  }, []);

  const resolved: Theme = resolveTheme(preference, system);
  const theme = resolved === 'dark' ? darkTheme : lightTheme;

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPreferenceState(p);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, p).catch(() => {});
  }, []);

  // Provide placeholder until AsyncStorage loads to avoid flash
  if (!loaded) return null;

  const dark = resolved === 'dark';
  return (
    <ThemeContext.Provider
      value={{ theme, resolved, isDark: dark, preference, setPreference, toggleTheme: () => setPreference(dark ? 'light' : 'dark') }}
    >
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