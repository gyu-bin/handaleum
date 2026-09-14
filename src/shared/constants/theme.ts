/**
 * Design tokens — dual system:
 * - UI chrome: cream paper + design-sheet slate navy (2026-09-13 sheet).
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

    // Ink / type — design sheet slate navy + muted blue ladder
    ink: '#33475B',
    inkSoft: '#5A7188',
    subtle: '#8AA3BB',

    /** Text/icons on the shell background (light = ink; dark mode flips via resolveTheme). */
    shellInk: '#33475B',
    shellInkSoft: '#5A7188',
    shellSubtle: '#8AA3BB',
    /** Chips/buttons that sit on the shell (back control). */
    shellChip: '#EFE6DA',
    /** Grouped-list card that sits on the shell (settings). Lifts off `background`. */
    shellSurface: '#FFFBF5',
    /**
     * Switch "on" track. Cannot be `shellInk`: in dark mode that resolves to a
     * near-white, which swallows the light thumb and leaves a blank pill.
     * Stays a filled ink that reads against a light thumb in both themes.
     */
    shellSwitchOn: '#33475B',

    /**
     * Splash / loading brand mark — same slate navy as UI ink (sheet).
     */
    splashMark: '#33475B',
    /** 발도장 seal ink (passport stamp). */
    stampInk: '#33475B',
    stampInkMuted: '#8AA3BB',
    stampInkWash: 'rgba(51,71,91,0.10)',
    stampInkSoft: 'rgba(138,163,187,0.35)',
    /**
     * Regional stamp inks — paper dyes matched to 발도장 sheet.
     * Visit = full hue; unvisited = muted gray seal (same anatomy).
     */
    stampInkCoral: '#E0453C',
    stampInkSunset: '#E06A35',
    stampInkAmber: '#E0922E',
    stampInkOlive: '#6B9A45',
    stampInkForest: '#3D9A55',
    stampInkTeal: '#2A9A88',
    stampInkSky: '#3B9AD9',
    stampInkIndigo: '#4558A8',
    stampInkPlum: '#9A4AB0',
    stampInkRose: '#E04A8A',
    stampInkCocoa: '#9A6A45',
    stampInkSlate: '#33475B',
    stampInkClay: '#E07058',
    stampInkMoss: '#5AAA4A',
    stampInkSea: '#2A88B8',
    stampInkWine: '#C04588',
    stampInkSand: '#C09050',
    /** Unvisited seal ink (full anatomy, faint). */
    stampInkEmpty: '#C5CDD6',

    /**
     * Design-sheet point color — sparse highlights only (not a second chrome accent).
     */
    point: '#E8C4A9',
    pointSoft: 'rgba(232,196,169,0.35)',

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
    landShadow: 'rgba(51,71,91,0.06)',
    mapLabel: '#5A7188',
    labelHalo: 'rgba(251,249,244,0.95)',
    border: '#D5DCE2',
    hairline: '#E8E4DC',
    panelBorder: 'rgba(51,71,91,0.12)',

    /** Stamp glance-map pastel washes (mockup option 2). */
    stampWashCapital: '#C5DCCF',
    stampWashGangwon: '#E8B5A4',
    stampWashChungcheong: '#E2D4B6',
    stampWashJeolla: '#C5C49A',
    stampWashGyeongsang: '#B7C8DB',
    stampWashJeju: '#E4C47A',

    white: '#FFFFFF',
    /**
     * Legacy warm tokens — prefer `ink` / `point` / `stampInk` in new code.
     * `sand` → point (sheet highlight). `terracotta` → stampInk.
     */
    sand: '#E8C4A9',
    terracotta: '#33475B',
    terracottaSoft: 'rgba(51,71,91,0.10)',
    /** Unseen tab dot — notification red so it reads against navy icons. */
    notify: '#E24B4A',
    /** Progress track / empty stamp outline. */
    line: '#E8E4DC',
    overlay: 'rgba(251,249,244,0.88)',
    overlayDark: 'rgba(51,71,91,0.45)',
    labelBg: 'rgba(251,249,244,0.9)',
    selectedGlow: 'rgba(51,71,91,0.18)',
    shadow: 'rgba(51,71,91,0.10)',
  },
  /**
   * Graduated ink ladder — slate navy at fixed fractions of strength.
   */
  tint: {
    full: 'rgba(51,71,91,0.92)',
    strong: 'rgba(51,71,91,0.62)',
    mid: 'rgba(51,71,91,0.30)',
    soft: 'rgba(51,71,91,0.16)',
    faint: 'rgba(51,71,91,0.10)',
  },
  fonts: {
    // System until Pretendard assets are approved/bundled (sheet: Pretendard KR).
    serif: 'System',
    sans: 'System',
  },
  /**
   * Type scale — aligned toward sheet H1 28 / H2 20 / H3 16 / Body 15 / Caption 13.
   * Exemptions: card export templates, fixed-size control glyphs, TextInput fontSize-only.
   */
  type: {
    /** The single loud thing on a screen (sheet H1 ≈ 28). */
    display: { fontSize: 28, lineHeight: 36, letterSpacing: -0.6 },
    /**
     * Two-line opening statement.
     */
    lede: { fontSize: 24, lineHeight: 34, letterSpacing: -0.8 },
    /** Screen and section titles (sheet H2). */
    title: { fontSize: 20, lineHeight: 26, letterSpacing: -0.4 },
    /** Subsection (sheet H3). */
    subtitle: { fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
    /** Running text (sheet Body). */
    body: { fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
    /** Chips, buttons, list rows (sheet Caption). */
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
      shadowColor: '#33475B',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    raised: {
      shadowColor: '#33475B',
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
