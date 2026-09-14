import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BrandMark, PinGlyph } from '@/shared/components/BrandMark';
import { KOREA_SILHOUETTE } from '@/shared/constants/brandMark';
import { theme } from '@/shared/constants/theme';

const MAP_HEIGHT = 292;
const MAP_WIDTH = MAP_HEIGHT * KOREA_SILHOUETTE.aspect;
const STAGE_WIDTH = 252;
const STAGE_HEIGHT = 330;
const MAP_LEFT = (STAGE_WIDTH - MAP_WIDTH) / 2;
const ROUTE_WIDTH = STAGE_WIDTH;
const PIN_SIZE = 34;
const PIN_WIDTH = PIN_SIZE * (24 / 32);
const REDUCE_MOTION = ReduceMotion.System;

function Pin({ x, y, style }: { x: number; y: number; style: object }) {
  return (
    <Animated.View
      style={[
        styles.pin,
        { left: x - PIN_WIDTH / 2 - 2, top: y - PIN_SIZE - 4 },
        style,
      ]}
    >
      <PinGlyph size={PIN_SIZE + 4} color={theme.colors.surface} />
      <View style={styles.pinFront}>
        <PinGlyph size={PIN_SIZE} color={theme.colors.splashMark} />
      </View>
    </Animated.View>
  );
}

export function LaunchSplash({ onFinished }: { onFinished: () => void }) {
  const map = useSharedValue(0);
  const firstPin = useSharedValue(0);
  const route = useSharedValue(0);
  const secondPin = useSharedValue(0);
  const brand = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});

    map.value = withTiming(1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
      reduceMotion: REDUCE_MOTION,
    });
    firstPin.value = withDelay(
      250,
      withSequence(
        withTiming(1.1, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
          reduceMotion: REDUCE_MOTION,
        }),
        withTiming(1, {
          duration: 100,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: REDUCE_MOTION,
        }),
      ),
    );
    route.value = withDelay(
      450,
      withTiming(1, {
        duration: 550,
        easing: Easing.inOut(Easing.cubic),
        reduceMotion: REDUCE_MOTION,
      }),
    );
    secondPin.value = withDelay(
      900,
      withSequence(
        withTiming(1.1, {
          duration: 150,
          easing: Easing.out(Easing.cubic),
          reduceMotion: REDUCE_MOTION,
        }),
        withTiming(1, {
          duration: 100,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: REDUCE_MOTION,
        }),
      ),
    );
    brand.value = withDelay(
      1050,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
        reduceMotion: REDUCE_MOTION,
      }),
    );
    fade.value = withDelay(
      1450,
      withTiming(
        1,
        {
          duration: 300,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: REDUCE_MOTION,
        },
        (finished) => {
          if (finished) {
            runOnJS(onFinished)();
          }
        },
      ),
    );

    return () => {
      [map, firstPin, route, secondPin, brand, fade].forEach(cancelAnimation);
    };
  }, [brand, fade, firstPin, map, onFinished, route, secondPin]);

  const mapStyle = useAnimatedStyle(() => ({
    opacity: map.value,
    transform: [{ translateY: (1 - map.value) * 8 }],
  }));
  const firstPinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(firstPin.value, 1),
    transform: [{ scale: firstPin.value }],
  }));
  const routeStyle = useAnimatedStyle(() => ({ width: ROUTE_WIDTH * route.value }));
  const secondPinStyle = useAnimatedStyle(() => ({
    opacity: Math.min(secondPin.value, 1),
    transform: [{ scale: secondPin.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: (1 - brand.value) * 8 }],
  }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));

  return (
    <Animated.View
      accessible
      accessibilityLabel="한달음 시작 중"
      style={[styles.screen, screenStyle]}
    >
      <View style={styles.content}>
        <View style={styles.stage}>
          <Animated.View style={[styles.map, mapStyle]}>
            <BrandMark height={MAP_HEIGHT} color={theme.colors.waterLight} />
          </Animated.View>
          <Animated.View style={[styles.routeClip, routeStyle]}>
            <Svg width={STAGE_WIDTH} height={STAGE_HEIGHT}>
              <Path
                d="M82 242 C87 202 104 189 127 181 C151 173 163 152 167 111"
                fill="none"
                stroke={theme.colors.splashMark}
                strokeDasharray="8 10"
                strokeLinecap="round"
                strokeWidth={4}
              />
            </Svg>
          </Animated.View>
          <Pin x={82} y={242} style={firstPinStyle} />
          <Pin x={167} y={111} style={secondPinStyle} />
        </View>
        <Animated.View style={[styles.brand, brandStyle]}>
          <Text style={styles.wordmark}>한달음</Text>
          <Text style={styles.tagline}>한 달의 순간을, 지도 위에</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  content: {
    alignItems: 'center',
    marginTop: -12,
  },
  stage: {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
  },
  map: {
    position: 'absolute',
    top: 12,
    left: MAP_LEFT,
  },
  routeClip: {
    position: 'absolute',
    height: STAGE_HEIGHT,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    width: PIN_WIDTH + 4,
    height: PIN_SIZE + 4,
  },
  pinFront: {
    position: 'absolute',
    left: 2,
    bottom: 0,
  },
  brand: {
    alignItems: 'center',
    marginTop: 18,
  },
  wordmark: {
    color: theme.colors.splashMark,
    fontFamily: theme.fonts.sans,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -1.2,
    lineHeight: 40,
  },
  tagline: {
    marginTop: 2,
    color: theme.colors.splashMark,
    fontFamily: theme.fonts.sans,
    fontSize: theme.type.micro.fontSize,
    fontWeight: '500',
    letterSpacing: 0.2,
    lineHeight: theme.type.micro.lineHeight,
  },
});
