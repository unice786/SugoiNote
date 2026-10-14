/**
 * Paleta y medidas de SugoiNote.
 *
 * Estos valores están ports literal de wwwroot/css/_tokens.css para que la app
 * móvil se vea prácticamente igual que la web. Si se cambia un token en el CSS,
 * hay que cambiarlo también aquí.
 */

export type Tema = 'claro' | 'oscuro';

/**
 * Se declara el tipo a mano en vez de usar `typeof claro`. Con `as const` los
 * valores se vuelven literales ("#f5f6fa") y el tema oscuro deja de ser asignable.
 */
export type Colores = {
  bgApp: string;
  bgSidebar: string;
  bgSurface: string;
  bgSurfaceHover: string;
  bgElevated: string;
  bgInset: string;
  bgCode: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  accent: string;
  accentHover: string;
  accentContrast: string;

  success: string;
  warning: string;
  danger: string;
  info: string;

  borderSubtle: string;
  borderDefault: string;

  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
};

const claro: Colores = {
  bgApp: '#f5f6fa',
  bgSidebar: '#ffffff',
  bgSurface: '#ffffff',
  bgSurfaceHover: '#f2f3f8',
  bgElevated: '#eef0f6',
  bgInset: '#eceef4',
  bgCode: '#f6f7fb',

  textPrimary: '#1c2033',
  textSecondary: '#4b5163',
  textMuted: '#646b7d',
  textInverse: '#ffffff',

  accent: '#7c3aed',
  accentHover: '#6d28d9',
  accentContrast: '#ffffff',

  success: '#15803d',
  warning: '#b45309',
  danger: '#dc2626',
  info: '#1d4ed8',

  borderSubtle: 'rgba(16, 24, 40, 0.07)',
  borderDefault: 'rgba(16, 24, 40, 0.13)',

  shadowSm: '#00000014',
  shadowMd: '#0000001a',
  shadowLg: '#00000026',
};

const oscuro: Colores = {
  bgApp: '#0a0b10',
  bgSidebar: '#0d0f18',
  bgSurface: '#13151f',
  bgSurfaceHover: '#181a26',
  bgElevated: '#1a1d2e',
  bgInset: '#0d0f1a',
  bgCode: '#0a0c14',

  textPrimary: '#f1f5f9',
  textSecondary: '#c3c9d6',
  textMuted: '#9aa3b5',
  textInverse: '#0a0b10',

  accent: '#8b5cf6',
  accentHover: '#7c3aed',
  accentContrast: '#ffffff',

  success: '#4ade80',
  warning: '#fbbf24',
  danger: '#ff6b6b',
  info: '#60a5fa',

  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.09)',

  shadowSm: '#0000004d',
  shadowMd: '#00000066',
  shadowLg: '#0000008c',
};

export const temas: Record<Tema, Colores> = { claro, oscuro };

export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const espaciado = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * En móvil no existen las media queries, pero sí hace falta un poco de margen
 * lateral para que el contenido no quede pegado al borde en pantallas anchas.
 */
export const ANCHO_MAX_CONTENIDO = 640;