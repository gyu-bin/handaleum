import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import {
  SPLASH_PIN_IMAGES,
  SPLASH_PIN_TILT,
  SPLASH_STAMP,
} from '@/shared/constants/splashPins';
import { theme } from '@/shared/constants/theme';

export interface SplashStampPinProps {
  name: keyof typeof SPLASH_PIN_IMAGES;
  /** When false, skip the concentric tip rings (animated ping handles it). */
  showRipples?: boolean;
}

/**
 * Polaroid-style map stamp: photo frame + city label + teardrop tip.
 * Tip is at the bottom-center of the component for city anchoring.
 */
export function SplashStampPin({
  name,
  showRipples = true,
}: SplashStampPinProps) {
  const { frameW, frameH, photo, padX, padTop, padBottom, tailH, tailW, totalH } =
    SPLASH_STAMP;
  const tilt = SPLASH_PIN_TILT[name];

  return (
    <View style={[styles.root, { width: frameW, height: totalH }]}>
      <View style={[styles.stamp, { transform: [{ rotate: `${tilt}deg` }] }]}>
        <View style={[styles.frame, { width: frameW, height: frameH }]}>
          <Image
            source={SPLASH_PIN_IMAGES[name]}
            style={{
              width: photo,
              height: photo,
              marginTop: padTop,
              marginHorizontal: padX,
            }}
            resizeMode="cover"
          />
          <Text
            style={[styles.label, { height: padBottom - 1 }]}
            numberOfLines={1}
          >
            {name}
          </Text>
        </View>
        <Svg
          width={tailW}
          height={tailH}
          viewBox={`0 0 ${tailW} ${tailH}`}
          style={styles.tail}
        >
          <Path
            d={`M0 0 L${tailW} 0 L${tailW / 2} ${tailH} Z`}
            fill={theme.colors.white}
          />
        </Svg>
      </View>
      {showRipples ? (
        <Svg
          width={28}
          height={28}
          viewBox="0 0 28 28"
          style={[styles.ripples, { left: (frameW - 28) / 2 }]}
          pointerEvents="none"
        >
          <Circle
            cx={14}
            cy={14}
            r={4}
            stroke={theme.colors.white}
            strokeWidth={1}
            fill="none"
            opacity={0.55}
          />
          <Circle
            cx={14}
            cy={14}
            r={7.5}
            stroke={theme.colors.white}
            strokeWidth={1}
            fill="none"
            opacity={0.35}
          />
          <Circle
            cx={14}
            cy={14}
            r={11}
            stroke={theme.colors.white}
            strokeWidth={1}
            fill="none"
            opacity={0.2}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  stamp: {
    alignItems: 'center',
    ...theme.shadows.card,
  },
  frame: {
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    overflow: 'hidden',
  },
  label: {
    ...theme.type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.2,
    color: theme.colors.ink,
    textAlign: 'center',
    marginTop: 1,
  },
  tail: {
    marginTop: -1,
  },
  ripples: {
    position: 'absolute',
    bottom: -14,
  },
});
