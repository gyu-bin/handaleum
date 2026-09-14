import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { TravelStamp, stampInkForKey } from './TravelStamp';

export interface StampBadgeProps {
  name: string;
  collected: boolean;
  /** First collected this calendar month. */
  isNew?: boolean;
  /** Play press-in stamp animation once (newly earned). */
  animateIn?: boolean;
  /** Deterministic slight rotation for collected stamps (−8…8 deg). */
  tiltDeg?: number;
  onPress?: () => void;
  /** Larger seal for earn overlay. */
  size?: 'grid' | 'hero';
  nameEn?: string;
}

const DROP_FROM = 42;
const SLAM_MS = 300;
const SETTLE_MS = 110;
const never = { reduceMotion: ReduceMotion.Never as const };

/**
 * Rubber-stamp seal on cream paper — slate navy / muted blue ink.
 * Slam drops from above with a short ink bloom (no game-y bounce).
 */
export function StampBadge({
  name,
  collected,
  isNew = false,
  animateIn = false,
  tiltDeg = 0,
  onPress,
  size = 'grid',
  nameEn,
}: StampBadgeProps) {
  const hero = size === 'hero';
  const ty = useSharedValue(animateIn && collected ? -DROP_FROM : 0);
  const scale = useSharedValue(animateIn && collected ? 1.2 : 1);
  const opacity = useSharedValue(animateIn && collected ? 0 : 1);
  const rotate = useSharedValue(animateIn && collected ? tiltDeg - 14 : tiltDeg);
  const bloom = useSharedValue(animateIn && collected ? 0 : 1);
  const shadow = useSharedValue(animateIn && collected ? 0.35 : 0.12);

  useEffect(() => {
    if (!animateIn || !collected) {
      return;
    }
    ty.value = withTiming(0, {
      duration: SLAM_MS,
      easing: Easing.in(Easing.poly(3)),
      ...never,
    });
    scale.value = withSequence(
      withTiming(0.9, {
        duration: SLAM_MS,
        easing: Easing.in(Easing.poly(3)),
        ...never,
      }),
      withTiming(1, {
        duration: SETTLE_MS,
        easing: Easing.out(Easing.quad),
        ...never,
      }),
    );
    opacity.value = withTiming(1, {
      duration: 70,
      easing: Easing.linear,
      ...never,
    });
    rotate.value = withTiming(tiltDeg, {
      duration: SLAM_MS,
      easing: Easing.in(Easing.cubic),
      ...never,
    });
    bloom.value = withDelay(
      SLAM_MS - 40,
      withTiming(1, {
        duration: 420,
        easing: Easing.out(Easing.cubic),
        ...never,
      }),
    );
    shadow.value = withSequence(
      withTiming(0.28, {
        duration: SLAM_MS,
        easing: Easing.in(Easing.quad),
        ...never,
      }),
      withTiming(0.1, { duration: SETTLE_MS, ...never }),
    );
  }, [
    animateIn,
    bloom,
    collected,
    opacity,
    rotate,
    scale,
    shadow,
    tiltDeg,
    ty,
  ]);

  const sealStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bloom.value, [0, 0.15, 1], [0, 0.35, 0]),
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.55, 1.55]) }],
  }));

  const bloom2Style = useAnimatedStyle(() => ({
    opacity: interpolate(bloom.value, [0, 0.2, 1], [0, 0.18, 0]),
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.45, 1.85]) }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadow.value,
    transform: [
      { translateY: ty.value * 0.15 + 6 },
      { scaleX: interpolate(scale.value, [0.9, 1.2], [1.05, 0.75]) },
      { scaleY: 0.35 },
    ],
  }));

  const body = collected ? (
    <View style={[styles.slot, hero && styles.slotHero]}>
      {animateIn ? (
        <>
          <Animated.View style={[styles.shadow, shadowStyle]} />
          <Animated.View
            style={[
              styles.bloom,
              { borderColor: theme.colors.stampInkMuted },
              bloom2Style,
            ]}
          />
          <Animated.View
            style={[
              styles.bloom,
              { borderColor: theme.colors.stampInk },
              bloomStyle,
            ]}
          />
        </>
      ) : null}
      <Animated.View style={[styles.sealWrap, sealStyle]}>
        <TravelStamp
          name={name}
          nameEn={nameEn}
          collected
          size={hero ? 'hero' : 'grid'}
          ink={stampInkForKey(name)}
          brand={Boolean(nameEn) || hero}
        />
      </Animated.View>
      {isNew && !hero ? (
        <View
          style={styles.newBadge}
          accessibilityLabel={strings.stamps.newBadgeA11y}
        >
          <Text style={styles.newBadgeText}>{strings.stamps.newBadge}</Text>
        </View>
      ) : null}
    </View>
  ) : (
    <View
      style={[styles.slot, hero && styles.slotHero]}
      accessibilityLabel={strings.stamps.uncollected}
    >
      <TravelStamp
        name={name}
        nameEn={nameEn}
        collected={false}
        size={hero ? 'hero' : 'grid'}
        brand={false}
      />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={styles.press}>
        {body}
      </Pressable>
    );
  }
  return <View style={styles.press}>{body}</View>;
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
    minWidth: 0,
  },
  slot: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xs,
    overflow: 'visible',
  },
  slotHero: {
    width: 140,
    height: 140,
    aspectRatio: undefined,
  },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    width: '48%',
    height: '18%',
    bottom: '18%',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.stampInk,
  },
  bloom: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: theme.radius.pill,
    borderWidth: 2,
  },
  newBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.colors.stampInk,
  },
  newBadgeText: {
    fontFamily: theme.fonts.sans,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.4,
    color: theme.colors.surface,
    fontWeight: '700',
  },
});
