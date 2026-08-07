import { Image, StyleSheet, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

const SNEAKER = require('../../../assets/icons/stamp-sneaker.png');

export interface StampSneakerIconProps {
  size?: number;
  color?: string;
  /** Soft emphasis when tab is active (tint already carries weight). */
  active?: boolean;
}

/**
 * Nav stamp mark — reference sneaker (tilted, motion lines).
 * Footprints kept in `StampShoeIcon` for swap-back.
 */
export function StampSneakerIcon({
  size = 22,
  color = theme.colors.ink,
  active = false,
}: StampSneakerIconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Image
        source={SNEAKER}
        style={{
          width: size,
          height: size,
          tintColor: color,
          opacity: active ? 1 : 0.92,
        }}
        resizeMode="contain"
        accessibilityElementsHidden
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
