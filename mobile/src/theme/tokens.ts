export interface ThemeTokens {
  isDark: boolean;
  bgApp: string;
  bgSidebar: string;
  bgSurface: string;
  bgSurfaceHover: string;
  bgElevated: string;
  bgInset: string;
  bgInset2: string;
  bgCode: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  accent: string;
  accentHover: string;
  accentSoft: string;
  accentSoft2: string;
  accentSoft3: string;
  accentDeep: string;
  accentTint: string;
  accentTint2: string;
  accentContrast: string;

  success: string;
  successSoft: string;
  warning: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;

  onSurface02: string;
  onSurface03: string;
  onSurface04: string;
  onSurface05: string;
  onSurface06: string;
  onSurface08: string;
  onSurface10: string;
  onSurface15: string;

  scrim25: string;
  scrim30: string;
  scrim45: string;
  scrim50: string;
  scrim60: string;
  scrim65: string;
  scrim70: string;

  purpleGlow: string;

  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
}

export const lightTokens: ThemeTokens = {
  isDark: false,
  bgApp: '#f5f6fa',
  bgSidebar: '#ffffff',
  bgSurface: '#ffffff',
  bgSurfaceHover: '#f2f3f8',
  bgElevated: '#eef0f6',
  bgInset: '#eceef4',
  bgInset2: '#e5e8f0',
  bgCode: '#f6f7fb',

  textPrimary: '#1c2033',
  textSecondary: '#4b5163',
  textMuted: '#646b7d',
  textInverse: '#ffffff',

  accent: '#7c3aed',
  accentHover: '#6d28d9',
  accentSoft: '#5b21b6',
  accentSoft2: '#4c1d95',
  accentSoft3: '#8b5cf6',
  accentDeep: '#ede9fe',
  accentTint: '#ddd6fe',
  accentTint2: '#ede9fe',
  accentContrast: '#ffffff',

  success: '#15803d',
  successSoft: '#15803d',
  warning: '#b45309',
  danger: '#dc2626',
  dangerSoft: '#b91c1c',
  info: '#1d4ed8',
  infoSoft: '#1e40af',

  borderSubtle: 'rgba(16, 24, 40, 0.07)',
  borderDefault: 'rgba(16, 24, 40, 0.13)',
  borderStrong: 'rgba(124, 58, 237, 0.45)',

  onSurface02: 'rgba(16, 24, 40, 0.02)',
  onSurface03: 'rgba(16, 24, 40, 0.03)',
  onSurface04: 'rgba(16, 24, 40, 0.04)',
  onSurface05: 'rgba(16, 24, 40, 0.05)',
  onSurface06: 'rgba(16, 24, 40, 0.06)',
  onSurface08: 'rgba(16, 24, 40, 0.08)',
  onSurface10: 'rgba(16, 24, 40, 0.10)',
  onSurface15: 'rgba(16, 24, 40, 0.15)',

  scrim25: 'rgba(0, 0, 0, 0.25)',
  scrim30: 'rgba(0, 0, 0, 0.30)',
  scrim45: 'rgba(0, 0, 0, 0.45)',
  scrim50: 'rgba(0, 0, 0, 0.50)',
  scrim60: 'rgba(0, 0, 0, 0.60)',
  scrim65: 'rgba(0, 0, 0, 0.65)',
  scrim70: 'rgba(0, 0, 0, 0.70)',

  purpleGlow: 'rgba(124, 58, 237, 0.15)',

  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
};

export const darkTokens: ThemeTokens = {
  isDark: true,
  bgApp: '#0a0b10',
  bgSidebar: '#0d0f18',
  bgSurface: '#13151f',
  bgSurfaceHover: '#181a26',
  bgElevated: '#1a1d2e',
  bgInset: '#0d0f1a',
  bgInset2: '#111320',
  bgCode: '#0a0c14',

  textPrimary: '#f1f5f9',
  textSecondary: '#c3c9d6',
  textMuted: '#9aa3b5',
  textInverse: '#0a0b10',

  accent: '#8b5cf6',
  accentHover: '#7c3aed',
  accentSoft: '#c4b5fd',
  accentSoft2: '#a78bfa',
  accentSoft3: '#9d6ff8',
  accentDeep: '#2d1f5e',
  accentTint: '#e9d5ff',
  accentTint2: '#f3e8ff',
  accentContrast: '#ffffff',

  success: '#4ade80',
  successSoft: '#86efac',
  warning: '#fbbf24',
  danger: '#ff6b6b',
  dangerSoft: '#ffb4b4',
  info: '#60a5fa',
  infoSoft: '#93c5fd',

  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.09)',
  borderStrong: 'rgba(139, 92, 246, 0.45)',

  onSurface02: 'rgba(255, 255, 255, 0.02)',
  onSurface03: 'rgba(255, 255, 255, 0.03)',
  onSurface04: 'rgba(255, 255, 255, 0.04)',
  onSurface05: 'rgba(255, 255, 255, 0.05)',
  onSurface06: 'rgba(255, 255, 255, 0.06)',
  onSurface08: 'rgba(255, 255, 255, 0.08)',
  onSurface10: 'rgba(255, 255, 255, 0.10)',
  onSurface15: 'rgba(255, 255, 255, 0.15)',

  scrim25: 'rgba(0, 0, 0, 0.25)',
  scrim30: 'rgba(0, 0, 0, 0.30)',
  scrim45: 'rgba(0, 0, 0, 0.45)',
  scrim50: 'rgba(0, 0, 0, 0.50)',
  scrim60: 'rgba(0, 0, 0, 0.60)',
  scrim65: 'rgba(0, 0, 0, 0.65)',
  scrim70: 'rgba(0, 0, 0, 0.70)',

  purpleGlow: 'rgba(139, 92, 246, 0.18)',

  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
};