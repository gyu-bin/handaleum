import type { MapThemeId } from '@/features/photos/types';

/**
 * Paper-map color palettes. MapSvg / MapCanvas frame colors must come from here.
 * dawn = default (matches theme.ts); ink = cooler slate; warm = parchment.
 */
export type MapPalette = {
  id: MapThemeId;
  label: string;
  /** Swatch for the theme picker */
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
    water: '#FBF9F4',
    land: '#F2EDE4',
    landShadow: 'rgba(44,62,80,0.06)',
    border: '#D5DCE2',
    provinceStroke: '#5A6B7A',
    cityStroke: '#D5DCE2',
    labelProvince: '#5A6B7A',
    labelCity: '#2C3E50',
    labelMinor: '#5A6B7A',
    frameBg: '#FBF9F4',
    frameBorder: '#D5DCE2',
  },
  ink: {
    id: 'ink',
    label: '먹',
    swatch: '#2A3A48',
    water: '#F4F6F8',
    land: '#E8EDF1',
    landShadow: 'rgba(42,58,72,0.08)',
    border: '#C8D0D8',
    provinceStroke: '#3D4F5F',
    cityStroke: '#C8D0D8',
    labelProvince: '#4A5C6C',
    labelCity: '#1E2A34',
    labelMinor: '#5A6B7A',
    frameBg: '#F4F6F8',
    frameBorder: '#C8D0D8',
  },
  warm: {
    id: 'warm',
    label: '온기',
    swatch: '#8B6B4A',
    water: '#FBF7F0',
    land: '#F0E6D8',
    landShadow: 'rgba(80,55,30,0.07)',
    border: '#D9CBB8',
    provinceStroke: '#7A6548',
    cityStroke: '#D9CBB8',
    labelProvince: '#7A6548',
    labelCity: '#3D2E1F',
    labelMinor: '#8A7560',
    frameBg: '#FBF7F0',
    frameBorder: '#D9CBB8',
  },
};

export const MAP_THEME_IDS = Object.keys(MAP_THEMES) as MapThemeId[];

export const DEFAULT_MAP_THEME_ID: MapThemeId = 'dawn';

export function getMapPalette(id: MapThemeId): MapPalette {
  return MAP_THEMES[id] ?? MAP_THEMES.dawn;
}
