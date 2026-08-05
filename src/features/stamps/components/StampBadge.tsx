import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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

export interface StampBadgeProps {
  name: string;
  collected: boolean;
  /** Play press-in stamp animation once (newly earned). */
  animateIn?: boolean;
  /** Deterministic slight rotation for collected stamps (−8…8 deg). */
  tiltDeg?: number;
  onPress?: () => void;
  /** Larger seal for earn overlay. */
  size?: 'grid' | 'hero';
}

const DROP_FROM = 42;
const SLAM_MS = 300;
const SETTLE_MS = 110;
const never = { reduceMotion: ReduceMotion.Never as const };

/**
 * Rubber-stamp seal: double ring + serif name. Slam drops from above with
 * ink bloom — no spring bounce.
 */
export function StampBadge({
  name,
  collected,
  animateIn = false,
  tiltDeg = 0,
  onPress,
  size = 'grid',
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
      withTiming(0.28, { duration: SLAM_MS, easing: Easing.in(Easing.quad), ...never }),
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
    opacity: interpolate(bloom.value, [0, 0.15, 1], [0, 0.4, 0]),
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.55, 1.55]) }],
  }));

  const bloom2Style = useAnimatedStyle(() => ({
    opacity: interpolate(bloom.value, [0, 0.2, 1], [0, 0.22, 0]),
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
      <Animated.View style={[styles.shadow, shadowStyle]} />
      {animateIn ? (
        <>
          <Animated.View style={[styles.bloom, bloom2Style]} />
          <Animated.View style={[styles.bloom, bloomStyle]} />
        </>
      ) : null}
      <Animated.View style={[styles.sealWrap, sealStyle]}>
        <SealFace name={name} hero={hero} />
      </Animated.View>
    </View>
  ) : (
    <View
      style={[styles.slot, styles.emptySlot]}
      accessibilityLabel={strings.stamps.uncollected}
    >
      <Text style={styles.question}>{strings.stamps.slotUnknown}</Text>
      <Text style={styles.emptyName} numberOfLines={1}>
        {name}
      </Text>
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

function SealFace({ name, hero }: { name: string; hero: boolean }) {
  const dim = hero ? 120 : 96;
  const short = name.length > 4 ? name.slice(0, 4) : name;
  return (
    <View style={{ width: dim, height: dim, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={dim} height={dim} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={46} fill={theme.colors.terracottaSoft} />
        <Circle
          cx={50}
          cy={50}
          r={44}
          stroke={theme.colors.terracotta}
          strokeWidth={3.2}
          fill="none"
        />
        <Circle
          cx={50}
          cy={50}
          r={37}
          stroke={theme.colors.terracotta}
          strokeWidth={1.4}
          fill="none"
          strokeDasharray="2.5 3.5"
          opacity={0.85}
        />
        {/* Small tick marks like a wax seal edge */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + Math.cos(rad) * 40;
          const y1 = 50 + Math.sin(rad) * 40;
          const x2 = 50 + Math.cos(rad) * 43.5;
          const y2 = 50 + Math.sin(rad) * 43.5;
          return (
            <Path
              key={deg}
              d={`M ${x1} ${y1} L ${x2} ${y2}`}
              stroke={theme.colors.terracotta}
              strokeWidth={1.6}
              strokeLinecap="round"
              opacity={0.7}
            />
          );
        })}
      </Svg>
      <View style={styles.nameOverlay} pointerEvents="none">
        <Text
          style={[styles.sealText, hero && styles.sealTextHero]}
          numberOfLines={2}
        >
          {short}
        </Text>
      </View>
    </View>
  );
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
  },
  slotHero: {
    width: 140,
    height: 140,
    aspectRatio: undefined,
  },
  emptySlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
  },
  sealWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    position: 'absolute',
    width: '55%',
    height: '55%',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.ink,
  },
  bloom: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: theme.colors.terracotta,
  },
  nameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sealText: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 16,
    color: theme.colors.terracotta,
    fontWeight: '700',
    textAlign: 'center',
  },

  sealTextHero: {
    fontSize: 18,
    lineHeight: 22,
  },
  question: {
    ...theme.type.title,
    color: theme.colors.subtle,
    fontWeight: '300',
  },
  emptyName: {
    ...theme.type.micro,
    color: theme.colors.subtle,
    marginTop: 2,
  },
});
