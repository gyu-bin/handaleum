import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

/** Uiverse.io bike loader by fanishah — fewer animated SVG nodes for device FPS. */
const never = { reduceMotion: ReduceMotion.Never as const };
const SPIN_MS = 1100;
const DRAW_MS = 2800;
const DRAW_EASE = Easing.bezier(0.45, 0.05, 0.55, 0.95);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function useDashOffset(
  draw: SharedValue<number>,
  from: number,
  mid: number,
  to: number,
) {
  return useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      draw.value,
      [0, 0.32, 0.68, 1],
      [from, mid, mid, to],
    ),
  }));
}

/** One spin transform for tire + spokes (was 2–3 animated rotators per wheel). */
function Wheel({
  spin,
  draw,
  color,
}: {
  spin: SharedValue<number>;
  draw: SharedValue<number>;
  color: string;
}) {
  const spinProps = useAnimatedProps(() => ({
    rotation: spin.value * 360,
  }));
  const tireDash = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      draw.value,
      [0, 0.32, 0.68, 1],
      [56.549, 0, 0, -56.549],
    ),
  }));
  const spokeDash = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      draw.value,
      [0, 0.32, 0.68, 1],
      [-31.416, -23.562, -23.562, -31.416],
    ),
  }));

  return (
    <AnimatedG animatedProps={spinProps} originX={0} originY={0}>
      <AnimatedCircle
        animatedProps={tireDash}
        r={9}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="56.549 56.549"
        fill="none"
      />
      <AnimatedCircle
        animatedProps={spokeDash}
        r={5}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="31.416 31.416"
        fill="none"
      />
      <AnimatedCircle
        animatedProps={spokeDash}
        r={5}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="31.416 31.416"
        fill="none"
        rotation={180}
        originX={0}
        originY={0}
      />
    </AnimatedG>
  );
}

function Pedals({
  spin,
  draw,
  color,
}: {
  spin: SharedValue<number>;
  draw: SharedValue<number>;
  color: string;
}) {
  const spinProps = useAnimatedProps(() => ({
    rotation: 67.5 + spin.value * 360,
  }));
  const pedalDash = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      draw.value,
      [0, 0.32, 0.68, 1],
      [-25.133, -21.991, -21.991, -25.133],
    ),
  }));

  return (
    <AnimatedG animatedProps={spinProps} originX={0} originY={0}>
      <AnimatedCircle
        animatedProps={pedalDash}
        r={4}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="25.133 25.133"
        fill="none"
      />
      <AnimatedCircle
        animatedProps={pedalDash}
        r={4}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="25.133 25.133"
        fill="none"
        rotation={180}
        originX={0}
        originY={0}
      />
    </AnimatedG>
  );
}

export interface BikeLoaderProps {
  /** SVG display width in px (viewBox 48×30). */
  width?: number;
}

/**
 * Brand loading mark — stroke-draw bike (Uiverse / fanishah), cream splash ink.
 * Look unchanged; spin is linear and wheels share one rotation node each.
 */
export const BikeLoader = memo(function BikeLoader({
  width = 132,
}: BikeLoaderProps) {
  const spin = useSharedValue(0);
  const draw = useSharedValue(0);
  const color = theme.colors.splashMark;
  const height = (width * 30) / 48;

  const bodyProps = useDashOffset(draw, 79, 0, -79);
  const frontProps = useDashOffset(draw, 19, 0, -19);
  const barsProps = useDashOffset(draw, 10, 0, -10);
  const seatProps = useDashOffset(draw, 5, 0, -5);

  useEffect(() => {
    spin.value = 0;
    draw.value = 0;
    spin.value = withRepeat(
      withTiming(1, { duration: SPIN_MS, easing: Easing.linear, ...never }),
      -1,
      false,
    );
    draw.value = withRepeat(
      withTiming(1, { duration: DRAW_MS, easing: DRAW_EASE, ...never }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(draw);
    };
  }, [draw, spin]);

  return (
    <View
      style={[styles.stage, { width, height }]}
      accessibilityElementsHidden
      collapsable={false}
    >
      <Svg width={width} height={height} viewBox="0 0 48 30">
        <G
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1}
        >
          <G transform="translate(9.5,19)">
            <Wheel spin={spin} draw={draw} color={color} />
          </G>
          <G transform="translate(24,19)">
            <Pedals spin={spin} draw={draw} color={color} />
          </G>
          <G transform="translate(38.5,19)">
            <Wheel spin={spin} draw={draw} color={color} />
          </G>
          <AnimatedPolyline
            animatedProps={seatProps}
            points="14 3,18 3"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="5 5"
            fill="none"
          />
          <AnimatedPolyline
            animatedProps={bodyProps}
            points="16 3,24 19,9.5 19,18 8,34 7,24 19"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="79 79"
            fill="none"
          />
          <AnimatedPath
            animatedProps={barsProps}
            d="m30,2h6s1,0,1,1-1,1-1,1"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="10 10"
            fill="none"
          />
          <AnimatedPolyline
            animatedProps={frontProps}
            points="32.5 2,38.5 19"
            stroke={color}
            strokeWidth={1}
            strokeDasharray="19 19"
            fill="none"
          />
        </G>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
  },
});
