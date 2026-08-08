import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { G, Path, Polyline } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

/**
 * Brand bike mark — frame is static SVG; wheels/pedals are plain Views spun on
 * the UI thread. No rasterize (fights continuous rotate). No SVG inside spin.
 */
const never = { reduceMotion: ReduceMotion.Never as const };
const SPIN_MS = 1200;
const VB_W = 48;
const VB_H = 30;

export interface BikeLoaderProps {
  /** SVG display width in px (viewBox 48×30). */
  width?: number;
}

function WheelDisc({ color, size }: { color: string; size: number }) {
  const rim = Math.max(1.5, size * 0.08);
  const hub = Math.max(2, size * 0.14);
  return (
    <View style={[styles.wheelBox, { width: size, height: size }]}>
      <View
        style={[
          styles.wheelRim,
          {
            width: size * 0.92,
            height: size * 0.92,
            borderRadius: size,
            borderWidth: rim,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.spoke,
          {
            width: size * 0.72,
            height: rim,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.spoke,
          {
            width: rim,
            height: size * 0.72,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.hub,
          {
            width: hub,
            height: hub,
            borderRadius: hub,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

function PedalDisc({ color, size }: { color: string; size: number }) {
  const rim = Math.max(1.5, size * 0.1);
  return (
    <View style={[styles.wheelBox, { width: size, height: size }]}>
      <View
        style={[
          styles.wheelRim,
          {
            width: size * 0.55,
            height: size * 0.55,
            borderRadius: size,
            borderWidth: rim,
            borderColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.spoke,
          {
            width: size * 0.42,
            height: rim,
            backgroundColor: color,
            transform: [{ rotate: '35deg' }],
          },
        ]}
      />
    </View>
  );
}

/**
 * Brand loading mark — wheels never stop while mounted.
 */
export const BikeLoader = memo(function BikeLoader({
  width = 132,
}: BikeLoaderProps) {
  const turn = useSharedValue(0);
  const color = theme.colors.splashMark;
  const height = (width * VB_H) / VB_W;
  const sx = width / VB_W;
  const wheelPx = 20 * sx;

  useEffect(() => {
    // 0→1 loop avoids 360° wrap seams that look like a hitch.
    turn.value = 0;
    turn.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear, ...never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(turn);
    };
  }, [turn]);

  const wheelSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));
  const pedalSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${67.5 + turn.value * 360}deg` }],
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
      pointerEvents="none"
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
        style={[
          styles.spinPart,
          left,
          { width: wheelPx, height: wheelPx },
          wheelSpinStyle,
        ]}
      >
        <WheelDisc color={color} size={wheelPx} />
      </Animated.View>
      <Animated.View
        style={[
          styles.spinPart,
          mid,
          { width: wheelPx, height: wheelPx },
          pedalSpinStyle,
        ]}
      >
        <PedalDisc color={color} size={wheelPx} />
      </Animated.View>
      <Animated.View
        style={[
          styles.spinPart,
          right,
          { width: wheelPx, height: wheelPx },
          wheelSpinStyle,
        ]}
      >
        <WheelDisc color={color} size={wheelPx} />
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
  wheelBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelRim: {
    position: 'absolute',
  },
  spoke: {
    position: 'absolute',
  },
  hub: {
    position: 'absolute',
  },
});
