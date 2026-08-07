import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  type SharedValue,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

/** Uiverse.io bike loader by fanishah — ported to Reanimated + react-native-svg. */
const never = { reduceMotion: ReduceMotion.Never as const };
const CYCLE_MS = 3000;
const EASE = Easing.bezier(0.42, 0, 0.58, 1);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);
const AnimatedPath = Animated.createAnimatedComponent(Path);

function useDashOffset(
  progress: SharedValue<number>,
  from: number,
  mid: number,
  to: number,
) {
  return useAnimatedProps(() => ({
    strokeDashoffset: interpolate(
      progress.value,
      [0, 0.33, 0.67, 1],
      [from, mid, mid, to],
    ),
  }));
}

function Tire({
  progress,
  color,
}: {
  progress: SharedValue<number>;
  color: string;
}) {
  const props = useAnimatedProps(() => {
    const p = progress.value;
    return {
      strokeDashoffset: interpolate(
        p,
        [0, 0.33, 0.67, 1],
        [56.549, 0, 0, -56.549],
      ),
      rotation: interpolate(p, [0, 0.33, 0.67, 1], [0, 118.8, 241.2, 360]),
    };
  });

  return (
    <AnimatedCircle
      animatedProps={props}
      r={9}
      stroke={color}
      strokeWidth={1}
      strokeDasharray="56.549 56.549"
      fill="none"
      originX={0}
      originY={0}
    />
  );
}

function spokeDash(progress: SharedValue<number>) {
  'worklet';
  return interpolate(
    progress.value,
    [0, 0.33, 0.67, 1],
    [-31.416, -23.562, -23.562, -31.416],
  );
}

function pedalDash(progress: SharedValue<number>) {
  'worklet';
  return interpolate(
    progress.value,
    [0, 0.33, 0.67, 1],
    [-25.133, -21.991, -21.991, -25.133],
  );
}

function SpokesSpin({
  progress,
  color,
}: {
  progress: SharedValue<number>;
  color: string;
}) {
  const spinProps = useAnimatedProps(() => ({
    rotation: interpolate(progress.value, [0, 1], [0, 1080]),
  }));
  const spokeA = useAnimatedProps(() => ({
    strokeDashoffset: spokeDash(progress),
  }));
  const spokeB = useAnimatedProps(() => ({
    strokeDashoffset: spokeDash(progress),
  }));

  return (
    <AnimatedG animatedProps={spinProps} originX={0} originY={0}>
      <AnimatedCircle
        animatedProps={spokeA}
        r={5}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="31.416 31.416"
        fill="none"
      />
      <AnimatedCircle
        animatedProps={spokeB}
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

function PedalsSpin({
  progress,
  color,
}: {
  progress: SharedValue<number>;
  color: string;
}) {
  const spinProps = useAnimatedProps(() => ({
    rotation: interpolate(progress.value, [0, 1], [67.5, 1147.5]),
  }));
  const pedalA = useAnimatedProps(() => ({
    strokeDashoffset: pedalDash(progress),
  }));
  const pedalB = useAnimatedProps(() => ({
    strokeDashoffset: pedalDash(progress),
  }));

  return (
    <AnimatedG animatedProps={spinProps} originX={0} originY={0}>
      <AnimatedCircle
        animatedProps={pedalA}
        r={4}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="25.133 25.133"
        fill="none"
      />
      <AnimatedCircle
        animatedProps={pedalB}
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
 */
export function BikeLoader({ width = 132 }: BikeLoaderProps) {
  const progress = useSharedValue(0);
  const color = theme.colors.splashMark;
  const height = (width * 30) / 48;

  const bodyProps = useDashOffset(progress, 79, 0, -79);
  const frontProps = useDashOffset(progress, 19, 0, -19);
  const barsProps = useDashOffset(progress, 10, 0, -10);
  const seatProps = useDashOffset(progress, 5, 0, -5);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: EASE, ...never }),
      -1,
      false,
    );
  }, [progress]);

  return (
    <View
      style={[styles.stage, { width, height }]}
      accessibilityElementsHidden
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
            <Tire progress={progress} color={color} />
            <SpokesSpin progress={progress} color={color} />
          </G>
          <G transform="translate(24,19)">
            <PedalsSpin progress={progress} color={color} />
          </G>
          <G transform="translate(38.5,19)">
            <Tire progress={progress} color={color} />
            <SpokesSpin progress={progress} color={color} />
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
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: 'center',
  },
});
