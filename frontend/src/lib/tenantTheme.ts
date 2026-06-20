/** Tenant theme utilities — maps colorTheme hex to Tailwind-compatible classes. */

export interface TenantTheme {
  color: string
  colorHover: string
  gradientFrom: string
  gradientTo: string
  lightBg: string
  lightBorder: string
  lightText: string
}

const AURA_GOLD = '#c9a227'

const PRESETS: Record<string, TenantTheme> = {
  [AURA_GOLD]: {
    color: AURA_GOLD,
    colorHover: '#b8921f',
    gradientFrom: '#c9a227',
    gradientTo: '#f59e0b',
    lightBg: '#fef9c3',
    lightBorder: '#fde68a',
    lightText: '#92710a',
  },
  '#f97316': {
    color: '#f97316',
    colorHover: '#ea580c',
    gradientFrom: '#f97316',
    gradientTo: '#fbbf24',
    lightBg: '#fff7ed',
    lightBorder: '#fed7aa',
    lightText: '#c2410c',
  },
  '#3b82f6': {
    color: '#3b82f6',
    colorHover: '#2563eb',
    gradientFrom: '#3b82f6',
    gradientTo: '#60a5fa',
    lightBg: '#eff6ff',
    lightBorder: '#bfdbfe',
    lightText: '#1d4ed8',
  },
  '#10b981': {
    color: '#10b981',
    colorHover: '#059669',
    gradientFrom: '#10b981',
    gradientTo: '#34d399',
    lightBg: '#ecfdf5',
    lightBorder: '#a7f3d0',
    lightText: '#047857',
  },
  '#a855f7': {
    color: '#a855f7',
    colorHover: '#9333ea',
    gradientFrom: '#a855f7',
    gradientTo: '#c084fc',
    lightBg: '#faf5ff',
    lightBorder: '#e9d5ff',
    lightText: '#7e22ce',
  },
  '#ef4444': {
    color: '#ef4444',
    colorHover: '#dc2626',
    gradientFrom: '#ef4444',
    gradientTo: '#f87171',
    lightBg: '#fef2f2',
    lightBorder: '#fecaca',
    lightText: '#b91c1c',
  },
}

const DEFAULT_THEME = PRESETS[AURA_GOLD]

export function getTenantTheme(colorTheme?: string | null): TenantTheme {
  if (!colorTheme) return DEFAULT_THEME
  return PRESETS[colorTheme.toLowerCase()] ?? {
    color: colorTheme,
    colorHover: colorTheme,
    gradientFrom: colorTheme,
    gradientTo: colorTheme,
    lightBg: `${colorTheme}15`,
    lightBorder: `${colorTheme}40`,
    lightText: colorTheme,
  }
}

export function applyTenantCssVars(colorTheme?: string | null) {
  const theme = getTenantTheme(colorTheme)
  const root = document.documentElement
  root.style.setProperty('--tenant-color', theme.color)
  root.style.setProperty('--tenant-color-hover', theme.colorHover)
  root.style.setProperty('--tenant-gradient-from', theme.gradientFrom)
  root.style.setProperty('--tenant-gradient-to', theme.gradientTo)
}
