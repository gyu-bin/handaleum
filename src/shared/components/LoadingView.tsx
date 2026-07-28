import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { SPLASH_MAP_H, SPLASH_STAMP } from '@/shared/constants/splashPins';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { BrandMark } from './BrandMark';
import { PaperGrain } from './PaperGrain';
import { SplashStampPin } from './SplashStampPin';

export interface LoadingViewProps {
  /** Optional line under the mark. Defaults to the common loading string. */
  message?: string;
}

// Same size as the splash mark so the splash → loading handoff is seamless:
// the loading screen IS the splash's final frame, with the ping kept alive.
const MAP_H = SPLASH_MAP_H;
const PIN_W = SPLASH_STAMP.frameW;
const PIN_H = SPLASH_STAMP.totalH;
const RIPPLE = 40;
/** One ping per city, hopping 서울→강릉→부산→광주→제주 on a loop. */
const PING_MS = 900;

const CITY_COUNT = KOREA_SILHOUETTE.pins.length;

/**
 * Brand loading screen: the fully-stamped map from the splash, with a locator
 * ping that hops from city to city while we wait. Shared across screens so
 * every "불러오는 중" state looks the same.
 */
export function LoadingView({ message = strings.common.loading }: LoadingViewProps) {
  const mapW = MAP_H * KOREA_SILHOUETTE.aspect;
  const xs = KOREA_SILHOUETTE.pins.map((p) => p.fx * mapW);
  const ys = KOREA_SILHOUETTE.pins.map((p) => p.fy * MAP_H);

  // 0..CITY_COUNT, integer part = which city pings, fraction = ping progress.
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(CITY_COUNT, {
        duration: PING_MS * CITY_COUNT,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => {
      cancelAnimation(cycle);
    };
  }, [cycle]);

  const pingStyle = useAnimatedStyle(() => {
    const idx = Math.min(Math.floor(cycle.value), CITY_COUNT - 1);
    const t = cycle.value - idx;
    return {
      left: xs[idx]! - RIPPLE / 2,
      top: ys[idx]! - RIPPLE / 2,
      opacity: 0.45 * (1 - t),
      transform: [{ scale: 0.3 + t * 1.7 }],
    };
  });

  return (
    <SafeAreaView style={styles.safe}>
      <PaperGrain />
      <View style={styles.center}>
        <View style={{ width: mapW, height: MAP_H }}>
          <BrandMark height={MAP_H} color={theme.colors.splashMark} />
          <Animated.View style={[styles.ping, pingStyle]} />
          {KOREA_SILHOUETTE.pins.map((pin) => (
            <View
              key={pin.name}
              style={[
                styles.pin,
                {
                  left: pin.fx * mapW - PIN_W / 2,
                  top: pin.fy * MAP_H - PIN_H,
                },
              ]}
            >
              <SplashStampPin name={pin.name} showRipples />
            </View>
          ))}
        </View>
        <Text style={styles.wordmark}>{strings.brand}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  ping: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    borderRadius: RIPPLE / 2,
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  pin: {
    position: 'absolute',
  },
  /** The loading screen has no content to compete with — the brand is the one loud thing here. */
  wordmark: {
    ...theme.type.display,
    fontSize: 38,
    lineHeight: 44,
    fontFamily: theme.fonts.serif,
    fontWeight: '700',
    color: theme.colors.splashMark,
    letterSpacing: 2,
  },
  message: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    letterSpacing: 1,
  },
});
