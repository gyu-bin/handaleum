/**
 * Design tokens — dawn-blue paper map (확정 2026-07-18).
 * Infographic paper feel: cream paper, deep blue ink, soft border strokes.
 * All colors in the app must come from this file. No hardcoded colors elsewhere.
 */
export const theme = {
  colors: {
    // Paper surfaces
    background: '#FBF9F4',
    surface: '#FBF9F4',
    surfaceAlt: '#F2EDE4',
    canvas: '#EFEAE2',

    // Ink / type
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#93A1AD',

    // Dawn blue accent
    accent: '#3A5A78',
    accentSoft: 'rgba(58,90,120,0.12)',

    // Paper map
    land: '#F2EDE4',
    landLight: '#F7F3EC',
    landDeep: '#EBE4D8',
    landEdge: '#D5DCE2',
    water: '#FBF9F4',
    waterLight: '#FBF9F4',
    waterDeep: '#F5F1EA',
    landShadow: 'rgba(44,62,80,0.06)',
    mapLabel: '#5A6B7A',
    labelHalo: 'rgba(251,249,244,0.95)',
    border: '#D5DCE2',
    hairline: '#E8E4DC',
    panelBorder: 'rgba(44,62,80,0.12)',

    white: '#FFFFFF',
    sun: '#E8D9A8',
    overlay: 'rgba(251,249,244,0.88)',
    overlayDark: 'rgba(44,62,80,0.45)',
    labelBg: 'rgba(251,249,244,0.9)',
    selectedGlow: 'rgba(58,90,120,0.22)',
    shadow: 'rgba(44,62,80,0.10)',
  },
  fonts: {
    // Pretendard / MaruBuri 도입 전까지 시스템 대체 (폰트 파일 추가 시 교체)
    serif: 'Georgia',
    sans: 'System',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 20,
    card: 24,
    pill: 99,
  },
  shadows: {
    card: {
      shadowColor: '#2C3E50',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    raised: {
      shadowColor: '#2C3E50',
      shadowOpacity: 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
  },
} as const;

export type Theme = typeof theme;
