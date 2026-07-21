import type { MapThemeId } from '@/features/photos/types';

/**
 * Paper-map color palette. MapSvg / MapCanvas frame colors must come from here.
 *
 * `dawn` is the only palette, and that is the design: the dawn paper map is
 * what the app looks like, not something the user configures. The keyed shape
 * is kept so a future theme pack can add entries without a rewrite.
 */
export type MapPalette = {
  id: MapThemeId;
  label: string;
  /** Swatch color, for a palette picker if one is ever reintroduced. */
  swatch: string;
  water: string;
  land: string;
  landShadow: string;
  border: string;
  provinceStroke: string;
  cityStroke: string;
  labelProvince: string;
  labelCity: string;
  labelMinor: string;
  frameBg: string;
  frameBorder: string;
};

export const MAP_THEMES: Record<MapThemeId, MapPalette> = {
  dawn: {
    id: 'dawn',
    label: '새벽',
    swatch: '#3A5A78',
    water: '#CBE0EF',
    land: '#F2EDE4',
    landShadow: 'rgba(44,62,80,0.06)',
    border: '#D5DCE2',
    provinceStroke: '#5A6B7A',
    cityStroke: '#D5DCE2',
    labelProvince: '#5A6B7A',
    labelCity: '#2C3E50',
    labelMinor: '#5A6B7A',
    frameBg: '#CBE0EF',
    frameBorder: '#D5DCE2',
  },
};

export const DEFAULT_MAP_THEME_ID: MapThemeId = 'dawn';

export function getMapPalette(id: MapThemeId): MapPalette {
  return MAP_THEMES[id] ?? MAP_THEMES.dawn;
}
