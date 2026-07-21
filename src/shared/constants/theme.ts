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
    // Sea reads as sky, not as paper — the cream is kept for land so the
    // coastline separates on hue as well as on value.
    water: '#CBE0EF',
    waterLight: '#DCEAF4',
    waterDeep: '#B5D2E6',
    landShadow: 'rgba(44,62,80,0.06)',
    mapLabel: '#5A6B7A',
    labelHalo: 'rgba(251,249,244,0.95)',
    border: '#D5DCE2',
    hairline: '#E8E4DC',
    panelBorder: 'rgba(44,62,80,0.12)',

    white: '#FFFFFF',
    /**
     * Warm accent. Budget: once per screen. If it appears twice, one of the
     * two is not the most important thing on the screen.
     */
    sand: '#C9A961',
    overlay: 'rgba(251,249,244,0.88)',
    overlayDark: 'rgba(44,62,80,0.45)',
    labelBg: 'rgba(251,249,244,0.9)',
    selectedGlow: 'rgba(58,90,120,0.22)',
    shadow: 'rgba(44,62,80,0.10)',
  },
  /**
   * Graduated ink ladder — the single ink at fixed fractions of strength.
   * Structure is drawn with these, never with a new hue. Full strength is
   * reserved for the one element that matters most in a given view.
   */
  tint: {
    full: 'rgba(44,62,80,0.92)',
    strong: 'rgba(44,62,80,0.62)',
    mid: 'rgba(44,62,80,0.30)',
    soft: 'rgba(44,62,80,0.16)',
    faint: 'rgba(44,62,80,0.10)',
  },
  fonts: {
    // Pretendard / MaruBuri 도입 전까지 시스템 대체 (폰트 파일 추가 시 교체)
    serif: 'Georgia',
    sans: 'System',
  },
  /**
   * Type scale — decisive steps, nothing hedging in between. One display per
   * screen carries the voice; everything else is evidence. Any size not in
   * this ladder is a bug, with three deliberate exemptions:
   *
   * 1. Card export templates (CardTemplateFeed/Story) compose against a fixed
   *    pixel canvas, so their type is locked to that composition, not to UI.
   * 2. Glyphs inside fixed-size controls — pin counts, swatch checks, zoom
   *    buttons, thumbnail badges — are graphics sized to their container.
   * 3. TextInput takes `type.<step>.fontSize` only. Spreading the whole token
   *    adds lineHeight, which mis-centers input text vertically on Android.
   */
  type: {
    /** The single loud thing on a screen. */
    display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
    /** Screen and section titles. */
    title: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
    /** Running text. */
    body: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
    /** Chips, buttons, list rows. */
    label: { fontSize: 13, lineHeight: 17, letterSpacing: 0.1 },
    /** Notices, captions, units. Smallest legible grade. */
    micro: { fontSize: 11, lineHeight: 15, letterSpacing: 0.3 },
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
