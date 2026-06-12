// ─── Design Tokens ───────────────────────────────────────────────────────────
// Matches the formal CSS custom-property specification provided by the designer.
// All colour references use OKLCH; approximated here as sRGB hex for React Native.
// Spacing, radius, shadows, and typography follow the same scale.

export const tokens = {
  // ── Typography ──────────────────────────────────────────────────────────────
  fontSans: 'System', // Outfit loaded via asset — fall back to system
  fontSerif: 'Georgia',
  fontMono: 'monospace',

  // ── Radius ──────────────────────────────────────────────────────────────────
  radiusXs: 4,
  radius: 8, // 0.5rem
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusFull: 9999,

  // ── Shadows (light mode) ─────────────────────────────────────────────────────
  shadowXs: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.09, shadowRadius: 2, elevation: 1 },
  shadowSm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.17, shadowRadius: 3, elevation: 2 },
  shadowMd: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.17, shadowRadius: 4, elevation: 3 },
  shadowLg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.17, shadowRadius: 6, elevation: 4 },
  shadowXl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.17, shadowRadius: 10, elevation: 6 },
  shadow2xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.43, shadowRadius: 16, elevation: 8 },

  // ── Spacing (0.25rem base) ───────────────────────────────────────────────────
  spacing1: 4,
  spacing2: 8,
  spacing3: 12,
  spacing4: 16,
  spacing5: 20,
  spacing6: 24,
  spacing8: 32,
  spacing10: 40,
} as const;

// ─── Theme type ───────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark';

export interface AppTheme {
  theme: Theme;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    popover: string;
    popoverForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    muted: string;
    mutedForeground: string;
    accent: string;
    accentForeground: string;
    destructive: string;
    destructiveForeground: string;
    border: string;
    input: string;
    ring: string;
    chart1: string;
    chart2: string;
    chart3: string;
    chart4: string;
    chart5: string;
    sidebar: string;
    sidebarForeground: string;
    sidebarPrimary: string;
    sidebarPrimaryForeground: string;
    sidebarAccent: string;
    sidebarAccentForeground: string;
    sidebarBorder: string;
    sidebarRing: string;
    // Semantic aliases for component use
    surface: string;      // main card/sheet background
    surfaceVariant: string; // secondary surface (input bg, badge bg)
    text: string;         // primary readable text
    textSecondary: string; // muted/secondary text
    textTertiary: string; // placeholder, disabled text
    borderSubtle: string; // dividers, input borders
    focus: string;        // focus ring
    success: string;      // positive / completed
    warning: string;      // warning / pending
    error: string;        // destructive / error
  };
}

// ─── Light theme ──────────────────────────────────────────────────────────────

export const lightTheme: AppTheme = {
  theme: 'light',
  colors: {
    // Base
    background: '#FAFAFA',
    foreground: '#111827',
    // Card / Popover
    card: '#FFFFFF',
    cardForeground: '#111827',
    popover: '#FFFFFF',
    popoverForeground: '#111827',
    // Primary (teal-green — agricultural)
    primary: '#0D9488',          // oklch(0.8348 0.1302 160.908)
    primaryForeground: '#FFFFFF',
    // Secondary
    secondary: '#F3F4F6',
    secondaryForeground: '#111827',
    // Muted
    muted: '#F9FAFB',
    mutedForeground: '#6B7280',
    // Accent
    accent: '#F3F4F6',
    accentForeground: '#111827',
    // Destructive
    destructive: '#DC2626',      // oklch(0.5523 0.1927 32.7272)
    destructiveForeground: '#FFFFFF',
    // Border / Input / Ring
    border: '#E5E7EB',
    input: '#F9FAFB',
    ring: '#0D9488',
    // Charts
    chart1: '#0D9488',
    chart2: '#0891B2',
    chart3: '#7C3AED',
    chart4: '#D97706',
    chart5: '#059669',
    // Sidebar
    sidebar: '#FFFFFF',
    sidebarForeground: '#374151',
    sidebarPrimary: '#0D9488',
    sidebarPrimaryForeground: '#FFFFFF',
    sidebarAccent: '#F3F4F6',
    sidebarAccentForeground: '#111827',
    sidebarBorder: '#E5E7EB',
    sidebarRing: '#0D9488',
    // Semantic aliases
    surface: '#FFFFFF',
    surfaceVariant: '#F3F4F6',
    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    borderSubtle: '#E5E7EB',
    focus: '#0D9488',
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
  },
};

// ─── Dark theme ───────────────────────────────────────────────────────────────

export const darkTheme: AppTheme = {
  theme: 'dark',
  colors: {
    background: '#0F172A',
    foreground: '#F1F5F9',
    card: '#1E293B',
    cardForeground: '#F1F5F9',
    popover: '#1E293B',
    popoverForeground: '#F1F5F9',
    primary: '#2DD4BF',          // oklch(0.4365 0.1044 156.7556)
    primaryForeground: '#042F2E',
    secondary: '#1E293B',
    secondaryForeground: '#F1F5F9',
    muted: '#1E293B',
    mutedForeground: '#94A3B8',
    accent: '#334155',
    accentForeground: '#F1F5F9',
    destructive: '#F87171',      // oklch(0.3123 0.0852 29.7877)
    destructiveForeground: '#450A0A',
    border: '#334155',
    input: '#1E293B',
    ring: '#2DD4BF',
    chart1: '#2DD4BF',
    chart2: '#38BDF8',
    chart3: '#A78BFA',
    chart4: '#FBBF24',
    chart5: '#34D399',
    sidebar: '#0F172A',
    sidebarForeground: '#94A3B8',
    sidebarPrimary: '#2DD4BF',
    sidebarPrimaryForeground: '#042F2E',
    sidebarAccent: '#1E293B',
    sidebarAccentForeground: '#F1F5F9',
    sidebarBorder: '#334155',
    sidebarRing: '#2DD4BF',
    // Semantic aliases
    surface: '#1E293B',
    surfaceVariant: '#334155',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    borderSubtle: '#334155',
    focus: '#2DD4BF',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
  },
};