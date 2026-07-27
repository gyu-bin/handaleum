import type { MapThemeId } from '@/features/photos/types';

/**
 * Paper-map color palette. MapSvg / MapCanvas frame colors must come from here.
 *
 * Tuned toward the Figma survey-map mock: warm parchment land, soft sky-water,
 * charcoal ink borders, muted mountain/pine accents. Zoom stays SVG — tone
 * only, not a raster swap of the illustrated Seoul canvas.
 *
 * `dawn` is the only palette. The keyed shape is kept so a future theme pack
 * can add entries without a rewrite.
 */
export type MapPalette = {
  id: MapThemeId;
  label: string;
  /** Swatch color, for a palette picker if one is ever reintroduced. */
  swatch: string;
  water: string;
  land: string;
  /** Slightly deeper land wash for drop-shadow / relief. */
  landDeep: string;
  landShadow: string;
  border: string;
  provinceStroke: string;
  cityStroke: string;
  labelProvince: string;
  labelCity: string;
  labelMinor: string;
  /** Sketch mountain strokes (Figma gray peaks). */
  mountain: string;
  /** Sketch pine strokes (Figma muted green). */
  pine: string;
  /** Survey teardrop pin (Figma Map Home). */
  pin: string;
  /** Cream chip under a visit pin. */
  pinChipBg: string;
  frameBg: string;
  frameBorder: string;
};

export const MAP_THEMES: Record<MapThemeId, MapPalette> = {
  dawn: {
    id: 'dawn',
    label: '새벽',
    swatch: '#3A5A78',
    // Soft sky-sea against warm hanji land (Figma survey map).
    water: '#BFD7E8',
    land: '#F5EBD6',
    landDeep: '#E9DFC8',
    landShadow: 'rgba(55,48,40,0.12)',
    border: '#C5D0DA',
    // Charcoal ink — readable district lines like the mock.
    provinceStroke: '#3A3F46',
    cityStroke: '#5C6570',
    labelProvince: '#5A6B7A',
    labelCity: '#2C3E50',
    labelMinor: '#5A6B7A',
    mountain: '#6B6E72',
    pine: '#6B7A5E',
    pin: '#1A1F26',
    pinChipBg: '#F6F0E4',
    frameBg: '#BFD7E8',
    frameBorder: '#C5D0DA',
  },
};

export const DEFAULT_MAP_THEME_ID: MapThemeId = 'dawn';

export function getMapPalette(id: MapThemeId): MapPalette {
  return MAP_THEMES[id] ?? MAP_THEMES.dawn;
}
