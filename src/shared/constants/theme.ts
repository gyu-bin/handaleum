/**
 * Design tokens — dual system:
 * - UI chrome: Dawn Survey (cream paper + single slate ink). Plan A 2026-08-05.
 * - Map canvas / pins: dawn-blue paper map (land / water / accent) — do not retint for UI.
 * - Dark mode: settings switch (not system). Shell only; surface + map stay light.
 * All colors in the app must come from this file. No hardcoded colors elsewhere.
 */
export const theme = {
  colors: {
    // Journal paper surfaces (UI screens + chrome)
    background: '#F7F1E8',
    surface: '#FFFBF5',
    surfaceAlt: '#EFE6DA',
    canvas: '#EFEAE2',

    // Ink / type — the only UI accent (philosophy: no second accent)
    ink: '#2C3E50',
    inkSoft: '#5A6B7A',
    subtle: '#93A1AD',

    /** Text/icons on the shell background (light = ink; dark mode flips via resolveTheme). */
    shellInk: '#2C3E50',
    shellInkSoft: '#5A6B7A',
    shellSubtle: '#93A1AD',
    /** Chips/buttons that sit on the shell (back control). */
    shellChip: '#EFE6DA',

    /**
     * Splash / loading brand mark — slate navy from the stamp splash reference.
     * Map silhouette + wordmark share this; keep separate from UI ink.
     */
    splashMark: '#33475B',

    /**
     * Map land/water system only — journal UI uses `ink`, not this.
     */
    accent: '#3A5A78',
    accentSoft: 'rgba(58,90,120,0.12)',

    // Paper map (dawn-blue system — leave alone when restyling UI)
    land: '#F2EDE4',
    landLight: '#F7F3EC',
    landDeep: '#EBE4D8',
    landEdge: '#D5DCE2',
    water: '#CBE0EF',
    waterLight: '#DCEAF4',
    waterDeep: '#B5D2E6',
    landShadow: 'rgba(44,62,80,0.06)',
    mapLabel: '#5A6B7A',
    labelHalo: 'rgba(251,249,244,0.95)',
    border: '#D5DCE2',
    hairline: '#E8E4DC',
    panelBorder: 'rgba(44,62,80,0.12)',

    /** Stamp glance-map pastel washes (mockup option 2). */
    stampWashCapital: '#C5DCCF',
    stampWashGangwon: '#E8B5A4',
    stampWashChungcheong: '#E2D4B6',
    stampWashJeolla: '#C5C49A',
    stampWashGyeongsang: '#B7C8DB',
    stampWashJeju: '#E4C47A',

    white: '#FFFFFF',
    /**
     * Legacy warm tokens — Plan A / single navy theme: alias to ink.
     * Prefer `ink` / `tint.*` in new code.
     */
    sand: '#2C3E50',
    terracotta: '#2C3E50',
    terracottaSoft: 'rgba(44,62,80,0.10)',
    /**
     * Unseen badge — same navy family (no second brand hue).
     */
    notify: '#2C3E50',
    /** Progress track / empty stamp outline. */
    line: '#E8E4DC',
    overlay: 'rgba(251,249,244,0.88)',
    overlayDark: 'rgba(44,62,80,0.45)',
    labelBg: 'rgba(251,249,244,0.9)',
    selectedGlow: 'rgba(44,62,80,0.18)',
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
    // Single clean system sans for all UI (Plan A follow-up).
    // `serif` kept as an alias so old call sites stay valid.
    serif: 'System',
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
   *
   * Prefer `theme.fonts.sans`. `serif` is an alias of System (no Georgia).
   */
  type: {
    /** The single loud thing on a screen. */
    display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
    /**
     * Two-line opening statement. `display` overflows to three lines at this
     * length in Korean; this step keeps the break where the writing intends it.
     */
    lede: { fontSize: 27, lineHeight: 38, letterSpacing: -1.1 },
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

/** Runtime theme — shell tokens may resolve to dark literals at runtime. */
export type Theme = Omit<typeof theme, 'colors'> & {
  colors: { [K in keyof typeof theme.colors]: string };
};
