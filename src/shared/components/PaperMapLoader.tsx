import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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

const VIEWBOX_W = 150;
const VIEWBOX_H = 100;
const CYCLE_MS = 1120;
const FINAL_FRAME = 0.9;

function clamp01(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function phase(value: number, start: number, end: number): number {
  'worklet';
  return clamp01((value - start) / (end - start));
}

function PaperPanel({ side }: { side: 'left' | 'center' | 'right' }) {
  const path =
    side === 'left'
      ? 'M2 8 L45 0 L45 63 L2 70 Z'
      : side === 'center'
        ? 'M2 0 L45 8 L45 70 L2 63 Z'
        : 'M2 8 L45 0 L45 70 L2 63 Z';
  const fold = side === 'center' ? 'M23.5 4 L23.5 66' : 'M8 14 L39 8';

  return (
    <Svg width="100%" height="100%" viewBox="0 0 47 70">
      <Path d={path} fill={theme.colors.waterLight} />
      <Path
        d={path}
        fill="none"
        stroke={theme.colors.surface}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      <Path
        d={fold}
        fill="none"
        stroke={theme.colors.border}
        strokeWidth={0.8}
        opacity={0.9}
      />
      <Path
        d="M10 24 C18 18 27 29 38 21 M9 43 C18 36 27 47 38 39"
        fill="none"
        stroke={theme.colors.water}
        strokeWidth={1.2}
        opacity={0.72}
      />
    </Svg>
  );
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
  /** Display width in px; the artwork keeps a 3:2 aspect ratio. */
  width?: number;
}

/**
 * Small, repeatable loading mark: a folded paper map opens into a completed
 * month journey. The static final frame honors the OS Reduce Motion setting.
 */
export const PaperMapLoader = memo(function PaperMapLoader({
  width = 128,
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
    const enter = phase(cycle.value, 0, 0.15);
    const reset = phase(cycle.value, 0.94, 1);
    return {
      opacity: Math.min(1, enter * 2.2) * (1 - reset),
    };
  });
  const mapStyle = useAnimatedStyle(() => {
    const enter = phase(cycle.value, 0, 0.15);
    return { transform: [{ scale: 0.84 + enter * 0.16 }] };
  });
  const leftPanelStyle = useAnimatedStyle(() => {
    const unfold = phase(cycle.value, 0.15, 0.35);
    return {
      transform: [
        { translateX: (1 - unfold) * 22 * scale },
        { scaleX: 0.28 + unfold * 0.72 },
      ],
    };
  });
  const centerPanelStyle = useAnimatedStyle(() => {
    const unfold = phase(cycle.value, 0.15, 0.35);
    return { transform: [{ scaleX: 0.48 + unfold * 0.52 }] };
  });
  const rightPanelStyle = useAnimatedStyle(() => {
    const unfold = phase(cycle.value, 0.15, 0.35);
    return {
      transform: [
        { translateX: -(1 - unfold) * 22 * scale },
        { scaleX: 0.28 + unfold * 0.72 },
      ],
    };
  });
  const pinOneStyle = useAnimatedStyle(() => {
    const appear = phase(cycle.value, 0.35, 0.48);
    return {
      opacity: appear,
      transform: [{ scale: appear }],
    };
  });
  const routeStyle = useAnimatedStyle(() => ({
    width: VIEWBOX_W * scale * phase(cycle.value, 0.46, 0.65),
  }));
  const pinTwoStyle = useAnimatedStyle(() => {
    const appear = phase(cycle.value, 0.64, 0.75);
    return {
      opacity: appear,
      transform: [{ scale: appear }],
    };
  });

  const panelW = 47 * scale;
  const panelH = 70 * scale;
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
        <Animated.View
          style={[
            styles.panel,
            { left: 8 * scale, top: 21 * scale, width: panelW, height: panelH },
            leftPanelStyle,
          ]}
        >
          <PaperPanel side="left" />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { left: 52 * scale, top: 15 * scale, width: panelW, height: panelH },
            centerPanelStyle,
          ]}
        >
          <PaperPanel side="center" />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            { left: 96 * scale, top: 21 * scale, width: panelW, height: panelH },
            rightPanelStyle,
          ]}
        >
          <PaperPanel side="right" />
        </Animated.View>
      </Animated.View>

      <Animated.View style={[styles.routeClip, { height, width: 0 }, routeStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}>
          <Path
            d="M48 73 C56 59 69 64 78 57 C88 49 96 54 104 39"
            fill="none"
            stroke={theme.colors.splashMark}
            strokeDasharray="5 6"
            strokeLinecap="round"
            strokeWidth={1.8}
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.pin,
          { left: 48 * scale - pinWidth / 2, top: 73 * scale - pinSize - 2 },
          pinOneStyle,
        ]}
      >
        <LoaderPin size={pinSize} />
      </Animated.View>
      <Animated.View
        style={[
          styles.pin,
          { left: 104 * scale - pinWidth / 2, top: 39 * scale - pinSize - 2 },
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
  panel: {
    position: 'absolute',
  },
  routeClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
  },
  pinFront: {
    position: 'absolute',
  },
});
