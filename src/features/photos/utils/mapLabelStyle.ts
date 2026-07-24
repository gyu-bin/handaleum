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
 * Fixed on-screen sizes — labels ride MapCameraLayer outside the zoom transform,
 * so they must not depend on camera scale. Keep in sync with collideLabels.
 */
export const SCREEN_LABEL_SIZE: Record<LabelTier, number> = {
  0: 11,
  1: 12,
  2: 11,
  3: 10,
};

export const PLACE_STAMP_SIZE = 11;

export function screenLabelStyle(
  palette: MapPalette,
  detail: MapDetail,
  tier: LabelTier,
): ScreenLabelStyle {
  const size = SCREEN_LABEL_SIZE[tier];
  if (detail === 'overview') {
    const byTier: Record<LabelTier, ScreenLabelStyle> = {
      0: { size, opacity: 0.35, weight: '500', color: palette.labelProvince },
      1: { size, opacity: 0.55, weight: '600', color: palette.labelCity },
      2: { size, opacity: 0.4, weight: '500', color: palette.labelProvince },
      3: { size, opacity: 0.35, weight: '500', color: palette.labelMinor },
    };
    return byTier[tier];
  }
  if (detail === 'region') {
    const byTier: Record<LabelTier, ScreenLabelStyle> = {
      0: { size, opacity: 0.5, weight: '600', color: palette.labelProvince },
      1: { size, opacity: 0.7, weight: '600', color: palette.labelCity },
      2: { size, opacity: 0.58, weight: '500', color: palette.labelCity },
      3: { size, opacity: 0.5, weight: '500', color: palette.labelMinor },
    };
    return byTier[tier];
  }
  const byTier: Record<LabelTier, ScreenLabelStyle> = {
    0: { size, opacity: 0.35, weight: '500', color: palette.labelProvince },
    1: { size, opacity: 0.7, weight: '600', color: palette.labelCity },
    2: { size, opacity: 0.65, weight: '600', color: palette.labelCity },
    3: { size, opacity: 0.58, weight: '500', color: palette.labelMinor },
  };
  return byTier[tier];
}
