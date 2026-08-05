import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
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

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { PaperGrain } from './PaperGrain';

export interface AnimatedSplashProps {
  /** Called once the splash has played and faded out. */
  onFinish: () => void;
  /** Fired after the first frame is painted — hide the native splash then. */
  onReady?: () => void;
}

const ICON = require('../../../assets/images/icon.png');
const ICON_SIZE = 156;

const IN_MS = 700;
const WORD_DELAY = 240;
const WORD_MS = 460;
const TAG_DELAY = 420;
const TAG_MS = 420;
const HOLD_MS = 700;
const EXIT_MS = 320;

function anim(duration: number, easing: EasingFunction | EasingFunctionFactory) {
  return { duration, easing, reduceMotion: ReduceMotion.Never };
}

/**
 * Splash D — editorial: clay icon → wordmark → short tagline → fade.
 */
export function AnimatedSplash({ onFinish, onReady }: AnimatedSplashProps) {
  const root = useSharedValue(1);
  const mark = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => onReady?.());
    });

    mark.value = withTiming(1, anim(IN_MS, Easing.out(Easing.cubic)));
    word.value = withDelay(
      WORD_DELAY,
      withTiming(1, anim(WORD_MS, Easing.out(Easing.cubic))),
      ReduceMotion.Never,
    );
    tag.value = withDelay(
      TAG_DELAY,
      withTiming(1, anim(TAG_MS, Easing.out(Easing.cubic))),
      ReduceMotion.Never,
    );

    const doneAt = Math.max(IN_MS, WORD_DELAY + WORD_MS, TAG_DELAY + TAG_MS) + HOLD_MS;
    const timer = setTimeout(() => {
      root.value = withTiming(
        0,
        anim(EXIT_MS, Easing.in(Easing.quad)),
        (finished) => {
          if (finished) {
            runOnJS(onFinish)();
          }
        },
      );
    }, doneAt);

    return () => {
      cancelAnimationFrame(id);
      clearTimeout(timer);
    };
  }, [mark, onFinish, onReady, root, tag, word]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: root.value }));
  const markStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [{ scale: 0.9 + mark.value * 0.1 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 8 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: (1 - tag.value) * 6 }],
  }));

  return (
    <Animated.View style={[styles.fill, rootStyle]} pointerEvents="none">
      <PaperGrain style={styles.grain} />
      <View style={styles.center}>
        <Animated.View style={[styles.iconWrap, markStyle]}>
          <Image source={ICON} style={styles.icon} accessibilityIgnoresInvertColors />
        </Animated.View>
        <View style={styles.copy}>
          <Animated.Text style={[styles.wordmark, wordStyle]}>
            {strings.brand}
          </Animated.Text>
          <Animated.Text style={[styles.tagline, tagStyle]}>
            {strings.splashTagline}
          </Animated.Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grain: {
    opacity: 0.28,
  },
  center: {
    alignItems: 'center',
    // Editorial: more air between mark and type.
    gap: 36,
    paddingBottom: 48,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.2237,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  copy: {
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    ...theme.type.display,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    color: theme.colors.ink,
    letterSpacing: -0.5,
  },
  tagline: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.colors.inkSoft,
    letterSpacing: 0.4,
  },
});
