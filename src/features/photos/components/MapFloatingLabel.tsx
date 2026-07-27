import { Text } from 'react-native';

import type { MapPalette } from '@/shared/constants/mapThemes';
import { theme } from '@/shared/constants/theme';

import {
  labelPixelWidth,
  MAP_LABEL_SIZE,
  screenLabelStyle,
  type LabelTier,
} from '../utils/mapLabelStyle';
import type { MapDetail } from './MapSvg';

export function labelBoxSize(text: string, tier: LabelTier): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(28, Math.ceil(labelPixelWidth(text, MAP_LABEL_SIZE)) + 10),
    height: MAP_LABEL_SIZE + 10,
  };
}

export interface MapFloatingLabelProps {
  text: string;
  tier: LabelTier;
  detail: MapDetail;
  palette: MapPalette;
}

/**
 * Soft survey-map place name — ink on parchment.
 * No chip, no text-shadow (shadow shimmered while the camera moved).
 * Visit chips live on ClusterPin (Figma Map Home), not here.
 */
export function MapFloatingLabel({
  text,
  tier,
  detail,
  palette,
}: MapFloatingLabelProps) {
  const s = screenLabelStyle(palette, detail, tier);
  return (
    <Text
      numberOfLines={1}
      allowFontScaling={false}
      style={{
        fontSize: s.size,
        lineHeight: s.size + 2,
        fontWeight: s.weight,
        color: s.color,
        opacity: s.opacity,
        fontFamily: theme.fonts.sans,
        textAlign: 'center',
      }}
    >
      {text}
    </Text>
  );
}
