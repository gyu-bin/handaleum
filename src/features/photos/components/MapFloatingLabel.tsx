import { StyleSheet, Text } from 'react-native';

import type { MapPalette } from '@/shared/constants/mapThemes';
import { theme } from '@/shared/constants/theme';

import {
  PLACE_STAMP_SIZE,
  SCREEN_LABEL_SIZE,
  screenLabelStyle,
  type LabelTier,
} from '../utils/mapLabelStyle';
import type { MapDetail } from './MapSvg';

const CHAR_WIDTH = 0.75;

export function labelBoxSize(text: string, tier: LabelTier): {
  width: number;
  height: number;
} {
  const size = SCREEN_LABEL_SIZE[tier];
  return {
    width: Math.max(28, Math.ceil(text.length * size * CHAR_WIDTH) + 10),
    height: size + 10,
  };
}

export function stampBoxSize(text: string): { width: number; height: number } {
  return {
    width: Math.max(28, Math.ceil(text.length * PLACE_STAMP_SIZE * CHAR_WIDTH) + 10),
    height: PLACE_STAMP_SIZE + 24,
  };
}

export interface MapFloatingLabelProps {
  text: string;
  tier: LabelTier;
  detail: MapDetail;
  palette: MapPalette;
}

/** Constant on-screen place name — sized by the parent inverse-scale box. */
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
        opacity: Math.max(0.6, s.opacity),
        fontFamily: theme.fonts.sans,
        textAlign: 'center',
        textShadowColor: theme.colors.labelHalo,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
      }}
    >
      {text}
    </Text>
  );
}

export interface MapPlaceStampProps {
  text: string;
}

export function MapPlaceStamp({ text }: MapPlaceStampProps) {
  return (
    <Text numberOfLines={1} allowFontScaling={false} style={styles.stamp}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  stamp: {
    marginTop: 12,
    fontSize: PLACE_STAMP_SIZE,
    lineHeight: PLACE_STAMP_SIZE + 2,
    fontWeight: '600',
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    opacity: 0.85,
    textAlign: 'center',
    textShadowColor: theme.colors.labelHalo,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
