import type { MapPalette } from '@/shared/constants/mapThemes';

import type { MapDetail } from '../components/MapSvg';

export type LabelTier = 0 | 1 | 2 | 3;

export type ScreenLabelStyle = {
  size: number;
  opacity: number;
  weight: '400' | '500' | '600';
  color: string;
};

/**
 * One on-screen size for every admin place name — hierarchy is color/opacity only.
 * Labels ride outside the zoom transform, so this must not depend on camera scale.
 * Keep in sync with collideLabels / ClusterPin place chips.
 */
export const MAP_LABEL_SIZE = 11;

export const SCREEN_LABEL_SIZE: Record<LabelTier, number> = {
  0: MAP_LABEL_SIZE,
  1: MAP_LABEL_SIZE,
  2: MAP_LABEL_SIZE,
  3: MAP_LABEL_SIZE,
};

/** Shared weight so bold vs regular don't read as different sizes. */
const MAP_LABEL_WEIGHT: ScreenLabelStyle['weight'] = '500';

/**
 * Approximate rendered label width in px. Hangul/CJK glyphs are ~full-width;
 * Latin and digits are much narrower. A single Latin ratio under-measured Korean
 * by ~40%, so collision boxes were too narrow and dense labels slipped through.
 */
export function labelPixelWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    em += /[가-힣ㄱ-ㆎ一-鿿]/.test(ch) ? 1.02 : 0.58;
  }
  return em * size;
}

export function screenLabelStyle(
  palette: MapPalette,
  detail: MapDetail,
  tier: LabelTier,
): ScreenLabelStyle {
  const size = MAP_LABEL_SIZE;
  const weight = MAP_LABEL_WEIGHT;
  if (detail === 'overview') {
    const byTier: Record<LabelTier, ScreenLabelStyle> = {
      0: { size, weight, opacity: 0.55, color: palette.labelProvince },
      1: { size, weight, opacity: 0.7, color: palette.labelCity },
      2: { size, weight, opacity: 0.55, color: palette.labelProvince },
      3: { size, weight, opacity: 0.5, color: palette.labelMinor },
    };
    return byTier[tier];
  }
  if (detail === 'region') {
    const byTier: Record<LabelTier, ScreenLabelStyle> = {
      0: { size, weight, opacity: 0.55, color: palette.labelProvince },
      1: { size, weight, opacity: 0.72, color: palette.labelCity },
      2: { size, weight, opacity: 0.65, color: palette.labelCity },
      3: { size, weight, opacity: 0.55, color: palette.labelMinor },
    };
    return byTier[tier];
  }
  const byTier: Record<LabelTier, ScreenLabelStyle> = {
    0: { size, weight, opacity: 0.45, color: palette.labelProvince },
    1: { size, weight, opacity: 0.7, color: palette.labelCity },
    2: { size, weight, opacity: 0.65, color: palette.labelCity },
    3: { size, weight, opacity: 0.6, color: palette.labelMinor },
  };
  return byTier[tier];
}
