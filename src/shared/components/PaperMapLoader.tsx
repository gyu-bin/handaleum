import { memo, useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { PinGlyph } from '@/shared/components/BrandMark';
import { theme } from '@/shared/constants/theme';

const FOLDED_MAP_ARTWORK = require('../../../assets/images/folded-korea-paper-map.png');
const VIEWBOX_W = 180;
const VIEWBOX_H = 121;
const CYCLE_MS = 1120;
const FINAL_FRAME = 0.88;

function clamp01(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function phase(value: number, start: number, end: number): number {
  'worklet';
  return clamp01((value - start) / (end - start));
}

function LoaderPin({ size }: { size: number }) {
  const outerSize = size + 2;
  const outerWidth = outerSize * (24 / 32);
  return (
    <View style={{ width: outerWidth, height: outerSize }}>
      <PinGlyph size={outerSize} color={theme.colors.surface} />
      <View style={[styles.pinFront, { left: 1, bottom: 0 }]}>
        <PinGlyph size={size} color={theme.colors.splashMark} />
      </View>
    </View>
  );
}

export interface PaperMapLoaderProps {
  /** Display width in px; the artwork keeps the source illustration ratio. */
  width?: number;
}

/**
 * Shared loading mark: the supplied folded Korea-map illustration opens, then
 * receives the same quiet pins and hand-drawn route as the app icon.
 */
export const PaperMapLoader = memo(function PaperMapLoader({
  width = 184,
}: PaperMapLoaderProps) {
  const reduceMotion = useReducedMotion();
  const cycle = useSharedValue(0);
  const scale = width / VIEWBOX_W;
  const height = VIEWBOX_H * scale;

  useEffect(() => {
    if (reduceMotion) {
      cycle.value = FINAL_FRAME;
      return () => cancelAnimation(cycle);
    }

    cycle.value = 0;
    cycle.value = withRepeat(
      withTiming(1, {
        duration: CYCLE_MS,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => cancelAnimation(cycle);
  }, [cycle, reduceMotion]);

  const stageStyle = useAnimatedStyle(() => {
    const enter = phase(cycle.value, 0, 0.09);
    const reset = phase(cycle.value, 0.91, 1);
    return { opacity: enter * (1 - reset) };
  });
  const mapStyle = useAnimatedStyle(() => {
    const enter = phase(cycle.value, 0, 0.1);
    return {
      transform: [
        { translateY: (1 - enter) * 5 * scale },
        { scale: 0.78 + enter * 0.22 },
      ],
    };
  });
  const unfoldStyle = useAnimatedStyle(() => {
    const unfold = phase(cycle.value, 0.1, 0.3);
    return { transform: [{ scaleX: 0.32 + unfold * 0.68 }] };
  });
  const pinOneStyle = useAnimatedStyle(() => {
    const appear = phase(cycle.value, 0.31, 0.43);
    return { opacity: appear, transform: [{ scale: appear }] };
  });
  const routeStyle = useAnimatedStyle(() => ({
    opacity: phase(cycle.value, 0.42, 0.48),
    width: VIEWBOX_W * scale * phase(cycle.value, 0.42, 0.64),
  }));
  const pinTwoStyle = useAnimatedStyle(() => {
    const appear = phase(cycle.value, 0.63, 0.74);
    return { opacity: appear, transform: [{ scale: appear }] };
  });

  const pinSize = 18 * scale;
  const pinWidth = (pinSize + 2) * (24 / 32);

  return (
    <Animated.View
      accessibilityElementsHidden
      collapsable={false}
      pointerEvents="none"
      style={[styles.stage, { width, height }, stageStyle]}
    >
      <Animated.View style={[styles.mapLayer, mapStyle]}>
        <Animated.View style={[styles.paperArtwork, unfoldStyle]}>
          <Image source={FOLDED_MAP_ARTWORK} resizeMode="contain" style={styles.mapImage} />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.routeClip, { height, width: 0 }, routeStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
          <Path
            d="M52 85 C65 70 75 76 88 65 C103 52 116 59 132 44"
            fill="none"
            stroke={theme.colors.splashMark}
            strokeDasharray="5 5"
            strokeLinecap="round"
            strokeWidth={2}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.pin,
          { left: 52 * scale - pinWidth / 2, top: 85 * scale - pinSize - 2 },
          pinOneStyle,
        ]}
      >
        <LoaderPin size={pinSize} />
      </Animated.View>
      <Animated.View
        style={[
          styles.pin,
          { left: 132 * scale - pinWidth / 2, top: 44 * scale - pinSize - 2 },
          pinTwoStyle,
        ]}
      >
        <LoaderPin size={pinSize} />
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
    position: 'relative',
  },
  mapLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  paperArtwork: {
    ...StyleSheet.absoluteFillObject,
  },
  mapImage: {
    height: '100%',
    width: '100%',
  },
  routeClip: {
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  },
  pin: {
    position: 'absolute',
  },
  pinFront: {
    position: 'absolute',
  },
});
