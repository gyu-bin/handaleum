import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
} from 'react-native-reanimated';

import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { BrandMark, PinGlyph } from './BrandMark';

export interface AnimatedSplashProps {
  /** Called once the splash has played and faded out. */
  onFinish: () => void;
}

const MAP_H = 232;
const PIN_H = 30;
const PIN_W = PIN_H * (24 / 32);
const RIPPLE = 36;
/** How far above its resting spot each pin starts before dropping. */
const DROP_FROM = 48;
/**
 * Map fade-in, then one stamp per city. Stamps begin before the map fade ends
 * and overlap each other (fall > cadence) so the sequence reads as one motion,
 * not five separate pops.
 */
const MAP_IN_MS = 380;
const FIRST_STAMP_MS = 300;
const STAMP_EVERY_MS = 340;
const STAMP_FALL_MS = 420;
/** Beat between the last stamp landing and the fade into the app. */
const EXIT_BEAT_MS = 260;

/**
 * This is the one branded moment of the launch, so the animation always plays:
 * ReduceMotion.Never opts these tweens out of the OS "reduce motion" setting,
 * which would otherwise jump every value to its end state and leave a frozen
 * map on screen.
 */
function anim(duration: number, easing: EasingFunction | EasingFunctionFactory) {
  return { duration, easing, reduceMotion: ReduceMotion.Never };
}

/**
 * One city stamp: the pin accelerates straight down and stops dead on the city
 * (single hit, no bounce), with a locator ping spreading from the impact.
 */
function StampPin({ x, y, delay }: { x: number; y: number; delay: number }) {
  const drop = useSharedValue(0);
  const ping = useSharedValue(0);

  useEffect(() => {
    // Quick through the middle, decelerating into the landing — the pin
    // settles onto the city instead of slamming into it.
    drop.value = withDelay(
      delay,
      withTiming(1, anim(STAMP_FALL_MS, Easing.bezier(0.4, 0, 0.2, 1))),
      ReduceMotion.Never,
    );
    // Ping starts just before full rest so the two motions blend.
    ping.value = withDelay(
      delay + STAMP_FALL_MS - 80,
      withTiming(1, anim(560, Easing.out(Easing.quad))),
      ReduceMotion.Never,
    );
  }, [delay, drop, ping]);

  const pinStyle = useAnimatedStyle(() => ({
    // Fade in over the first third of the fall — a hard 0→1 pop at the drop
    // start is what makes the sequence feel choppy.
    opacity: Math.min(1, drop.value * 3),
    transform: [{ translateY: (drop.value - 1) * DROP_FROM }],
  }));
  const pingStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ping.value),
    transform: [{ scale: 0.3 + ping.value * 1.7 }],
  }));

  return (
    <>
      <Animated.View
        style={[
          styles.ping,
          { left: x - RIPPLE / 2, top: y - RIPPLE / 2 },
          pingStyle,
        ]}
      />
      <Animated.View
        style={[styles.pin, { left: x - PIN_W / 2, top: y - PIN_H }, pinStyle]}
      >
        <PinGlyph size={PIN_H} />
      </Animated.View>
    </>
  );
}

/**
 * Full-screen brand splash played once at launch, on top of the app. The map
 * fades in at full size (no scaling — size changes read as glitches), then five
 * pins stamp onto it city by city (서울→강릉→부산→광주→제주), each with one
 * locator ping. A timer (not the animation chain) drives dismissal.
 */
export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const mapW = MAP_H * KOREA_SILHOUETTE.aspect;

  const root = useSharedValue(1);
  const mark = useSharedValue(0);
  const word = useSharedValue(0);

  const lastLandAt =
    FIRST_STAMP_MS +
    (KOREA_SILHOUETTE.pins.length - 1) * STAMP_EVERY_MS +
    STAMP_FALL_MS;

  useEffect(() => {
    mark.value = withTiming(1, anim(MAP_IN_MS, Easing.out(Easing.cubic)));
    // Wordmark rises while the stamps are still landing, so nothing waits.
    word.value = withDelay(
      FIRST_STAMP_MS + STAMP_EVERY_MS * 2,
      withTiming(1, anim(400, Easing.out(Easing.quad))),
      ReduceMotion.Never,
    );

    // The moment the last pin lands (plus one beat), fade straight into the app.
    const timer = setTimeout(() => {
      root.value = withTiming(0, anim(320, Easing.in(Easing.quad)), (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      });
    }, lastLandAt + EXIT_BEAT_MS);
    return () => clearTimeout(timer);
  }, [lastLandAt, mark, root, word, onFinish]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.fill, rootStyle]} pointerEvents="none">
      <View style={styles.center}>
        <Animated.View style={[{ width: mapW, height: MAP_H }, markStyle]}>
          <BrandMark height={MAP_H} />
          {KOREA_SILHOUETTE.pins.map((pin, i) => (
            <StampPin
              key={pin.name}
              x={pin.fx * mapW}
              y={pin.fy * MAP_H}
              delay={FIRST_STAMP_MS + i * STAMP_EVERY_MS}
            />
          ))}
        </Animated.View>
        <Animated.Text style={[styles.wordmark, wordStyle]}>
          {strings.brand}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.canvas,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  ping: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  pin: {
    position: 'absolute',
    ...theme.shadows.card,
  },
  wordmark: {
    ...theme.type.display,
    fontFamily: theme.fonts.serif,
    fontWeight: '700',
    color: theme.colors.ink,
    letterSpacing: 1,
  },
});
