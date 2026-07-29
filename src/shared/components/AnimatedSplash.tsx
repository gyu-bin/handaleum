import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated';

import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { SPLASH_MAP_H, SPLASH_STAMP } from '@/shared/constants/splashPins';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { BrandMark } from './BrandMark';
import { PaperGrain } from './PaperGrain';
import { SplashStampPin } from './SplashStampPin';

export interface AnimatedSplashProps {
  /** Called once the splash has played and faded out. */
  onFinish: () => void;
  /** Fired after the first frame is painted — hide the native splash then. */
  onReady?: () => void;
}

const MAP_H = SPLASH_MAP_H;
const PIN_W = SPLASH_STAMP.frameW;
const PIN_H = SPLASH_STAMP.totalH;
const RIPPLE = 40;
const DROP_FROM = 52;

/**
 * One continuous stamp wave: pins cascade with heavy overlap so the sequence
 * reads as one motion, not five discrete pops.
 */
const MAP_IN_MS = 520;
const FIRST_STAMP_MS = 180;
const STAMP_EVERY_MS = 150;
const STAMP_FALL_MS = 560;
/** Brief hold so the stamped frame reads, then fade — keep short to avoid hitch. */
const HOLD_MS = 520;
const EXIT_FADE_MS = 280;

const PIN_COUNT = KOREA_SILHOUETTE.pins.length;
/** Shared 0→1 covers first stamp start through last stamp land. */
const STAMP_WAVE_MS =
  FIRST_STAMP_MS + (PIN_COUNT - 1) * STAMP_EVERY_MS + STAMP_FALL_MS;

function anim(duration: number, easing: EasingFunction | EasingFunctionFactory) {
  return { duration, easing, reduceMotion: ReduceMotion.Never };
}

/**
 * Pin driven by the shared stamp wave — no per-pin timers (avoids staggered
 * JS scheduling hitch that made landings feel choppy).
 */
function StampPin({
  name,
  x,
  y,
  index,
  wave,
}: {
  name: (typeof KOREA_SILHOUETTE.pins)[number]['name'];
  x: number;
  y: number;
  index: number;
  wave: SharedValue<number>;
}) {
  const pinStyle = useAnimatedStyle(() => {
    const startMs = FIRST_STAMP_MS + index * STAMP_EVERY_MS;
    const start = startMs / STAMP_WAVE_MS;
    const end = (startMs + STAMP_FALL_MS) / STAMP_WAVE_MS;
    const t = interpolate(wave.value, [start, end], [0, 1], Extrapolation.CLAMP);
    // Ease into the city — soft settle, not a slam.
    const eased = t * t * (3 - 2 * t);
    return {
      opacity: interpolate(eased, [0, 0.28], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: (eased - 1) * DROP_FROM }],
    };
  });

  const pingStyle = useAnimatedStyle(() => {
    const startMs = FIRST_STAMP_MS + index * STAMP_EVERY_MS;
    const land = (startMs + STAMP_FALL_MS - 90) / STAMP_WAVE_MS;
    const end = Math.min(1, land + 0.28);
    const t = interpolate(wave.value, [land, end], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: 0.4 * (1 - t),
      transform: [{ scale: 0.25 + t * 1.6 }],
    };
  });

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
        <SplashStampPin name={name} showRipples />
      </Animated.View>
    </>
  );
}

/**
 * Full-screen brand splash. Cream paper → dark map → cascading polaroid stamps →
 * fade into the app. Native splash must match canvas color with no icon.
 */
export function AnimatedSplash({ onFinish, onReady }: AnimatedSplashProps) {
  const mapW = MAP_H * KOREA_SILHOUETTE.aspect;

  const root = useSharedValue(1);
  const mark = useSharedValue(0);
  const word = useSharedValue(0);
  const wave = useSharedValue(0);

  useEffect(() => {
    // Wait two frames so AnimatedSplash is composited before native splash drops.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => onReady?.());
    });
    mark.value = withTiming(1, anim(MAP_IN_MS, Easing.out(Easing.cubic)));
    // One continuous wave drives every pin — smoother than five delayed timers.
    wave.value = withTiming(1, anim(STAMP_WAVE_MS, Easing.linear));
    // Wordmark with the map — brand name should read clearly, not as an afterthought.
    word.value = withDelay(
      MAP_IN_MS * 0.45,
      withTiming(1, anim(520, Easing.out(Easing.cubic))),
      ReduceMotion.Never,
    );

    const timer = setTimeout(() => {
      root.value = withTiming(
        0,
        anim(EXIT_FADE_MS, Easing.in(Easing.quad)),
        (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        },
      );
    }, STAMP_WAVE_MS + HOLD_MS);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, [mark, onFinish, onReady, root, wave, word]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 6 }],
  }));

  return (
    <Animated.View style={[styles.fill, rootStyle]} pointerEvents="none">
      <PaperGrain />
      <View style={styles.center}>
        <Animated.View style={[{ width: mapW, height: MAP_H }, markStyle]}>
          <BrandMark height={MAP_H} color={theme.colors.splashMark} />
          {KOREA_SILHOUETTE.pins.map((pin, i) => (
            <StampPin
              key={pin.name}
              name={pin.name}
              x={pin.fx * mapW}
              y={pin.fy * MAP_H}
              index={i}
              wave={wave}
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
    // Must match native splash backgroundColor — seamless handoff, no icon flash.
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
    borderWidth: 1.5,
    borderColor: theme.colors.white,
  },
  pin: {
    position: 'absolute',
  },
  wordmark: {
    ...theme.type.display,
    fontSize: 38,
    lineHeight: 44,
    fontFamily: theme.fonts.serif,
    fontWeight: '700',
    color: theme.colors.splashMark,
    letterSpacing: 2,
  },
});
