import { memo, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

/**
 * Uiverse.io bike loader — wheels spin on UI-thread Views forever.
 * Rasterize spinning layers so JS load (album sync) does not hitch the spin.
 */
const never = { reduceMotion: ReduceMotion.Never as const };
/** Slightly slower = fewer wrap hits, reads smoother under load. */
const SPIN_MS = 1400;
const VB_W = 48;
const VB_H = 30;
const WHEEL_VB = 20;

export interface BikeLoaderProps {
  /** SVG display width in px (viewBox 48×30). */
  width?: number;
}

function WheelMark({ color, size }: { color: string; size: number }) {
  const c = WHEEL_VB / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${WHEEL_VB} ${WHEEL_VB}`}>
      <G
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        transform={`translate(${c},${c})`}
      >
        <Circle r={9} />
        <Circle
          r={5}
          strokeDasharray="31.416 31.416"
          strokeDashoffset={-23.562}
        />
        <Circle
          r={5}
          strokeDasharray="31.416 31.416"
          strokeDashoffset={-23.562}
          rotation={180}
          originX={0}
          originY={0}
        />
      </G>
    </Svg>
  );
}

function PedalMark({ color, size }: { color: string; size: number }) {
  const c = WHEEL_VB / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${WHEEL_VB} ${WHEEL_VB}`}>
      <G
        fill="none"
        stroke={color}
        strokeWidth={1}
        strokeLinecap="round"
        transform={`translate(${c},${c})`}
      >
        <Circle
          r={4}
          strokeDasharray="25.133 25.133"
          strokeDashoffset={-21.991}
        />
        <Circle
          r={4}
          strokeDasharray="25.133 25.133"
          strokeDashoffset={-21.991}
          rotation={180}
          originX={0}
          originY={0}
        />
      </G>
    </Svg>
  );
}

const spinLayerProps =
  Platform.OS === 'ios'
    ? ({ shouldRasterizeIOS: true } as const)
    : ({ renderToHardwareTextureAndroid: true } as const);

/**
 * Brand loading mark — frame stays drawn; wheels/pedals never stop spinning.
 */
export const BikeLoader = memo(function BikeLoader({
  width = 132,
}: BikeLoaderProps) {
  const spin = useSharedValue(0);
  const color = theme.colors.splashMark;
  const height = (width * VB_H) / VB_W;
  const sx = width / VB_W;
  const wheelPx = WHEEL_VB * sx;

  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: SPIN_MS, easing: Easing.linear, ...never }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(spin);
    };
  }, [spin]);

  // Numeric degrees (not template string) — smoother UI-thread updates.
  const wheelSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  const pedalSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${67.5 + spin.value}deg` }],
  }));

  const left = {
    left: 9.5 * sx - wheelPx / 2,
    top: 19 * (height / VB_H) - wheelPx / 2,
  };
  const mid = {
    left: 24 * sx - wheelPx / 2,
    top: 19 * (height / VB_H) - wheelPx / 2,
  };
  const right = {
    left: 38.5 * sx - wheelPx / 2,
    top: 19 * (height / VB_H) - wheelPx / 2,
  };

  return (
    <View
      style={[styles.stage, { width, height }]}
      accessibilityElementsHidden
      collapsable={false}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${VB_W} ${VB_H}`}>
        <G
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
        >
          <Polyline points="14 3,18 3" />
          <Polyline points="16 3,24 19,9.5 19,18 8,34 7,24 19" />
          <Path d="m30,2h6s1,0,1,1-1,1-1,1" />
          <Polyline points="32.5 2,38.5 19" />
        </G>
      </Svg>

      <Animated.View
        {...spinLayerProps}
        style={[
          styles.spinPart,
          left,
          { width: wheelPx, height: wheelPx },
          wheelSpinStyle,
        ]}
      >
        <WheelMark color={color} size={wheelPx} />
      </Animated.View>
      <Animated.View
        {...spinLayerProps}
        style={[
          styles.spinPart,
          mid,
          { width: wheelPx, height: wheelPx },
          pedalSpinStyle,
        ]}
      >
        <PedalMark color={color} size={wheelPx} />
      </Animated.View>
      <Animated.View
        {...spinLayerProps}
        style={[
          styles.spinPart,
          right,
          { width: wheelPx, height: wheelPx },
          wheelSpinStyle,
        ]}
      >
        <WheelMark color={color} size={wheelPx} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    position: 'relative',
  },
  spinPart: {
    position: 'absolute',
  },
});
