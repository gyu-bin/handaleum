import { useEffect } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

import { Button } from '@/shared/components/Button';
import { PaperGrain } from '@/shared/components/PaperGrain';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

/** Fluent Emoji Fire 3D (MIT, Microsoft). */
const STREAK_FLAME = require('../../../../assets/icons/streak-flame.png');

const DROP_FROM = 72;
const SLAM_MS = 380;
const never = { reduceMotion: ReduceMotion.Never as const };

export function StreakMilestoneOverlay({
  days,
  onDone,
}: {
  days: number;
  onDone: () => void;
}) {
  const progress = useSharedValue(0);
  const squash = useSharedValue(1.2);
  const glow = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    squash.value = 1.22;
    glow.value = 0;
    progress.value = withTiming(1, {
      duration: SLAM_MS,
      easing: Easing.out(Easing.cubic),
      ...never,
    });
    squash.value = withSequence(
      withTiming(0.92, {
        duration: SLAM_MS,
        easing: Easing.out(Easing.cubic),
        ...never,
      }),
      withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.quad),
        ...never,
      }),
    );
    glow.value = withDelay(
      SLAM_MS - 40,
      withSequence(
        withTiming(0.4, { duration: 80, ...never }),
        withTiming(0.12, {
          duration: 420,
          easing: Easing.out(Easing.quad),
          ...never,
        }),
      ),
    );
  }, [days, glow, progress, squash]);

  const flameStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 4),
    transform: [
      { translateY: (1 - progress.value) * -DROP_FROM },
      { scale: squash.value },
      {
        rotate: `${interpolate(progress.value, [0, 1], [-8, -2])}deg`,
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone}>
      <Pressable
        style={styles.backdrop}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={strings.common.confirm}
      >
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <PaperGrain />
          <Animated.View style={[styles.glow, glowStyle]} />
          <View style={styles.stage}>
            <Animated.View style={flameStyle}>
              <Image
                source={STREAK_FLAME}
                style={styles.flame}
                resizeMode="contain"
                accessibilityElementsHidden
              />
              <Text
                style={styles.count}
                allowFontScaling={false}
                accessibilityElementsHidden
              >
                {days}
              </Text>
            </Animated.View>
          </View>
          <Text style={styles.title}>{strings.streakMilestone.title(days)}</Text>
          <Text style={styles.body}>{strings.streakMilestone.body}</Text>
          <Button
            title={strings.common.confirm}
            variant="primary"
            size="md"
            surface="paper"
            onPress={onDone}
            style={styles.cta}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  glow: {
    position: 'absolute',
    top: 36,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: theme.colors.terracottaSoft,
  },
  stage: {
    width: 160,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    width: 120,
    height: 120,
  },
  count: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 46,
    textAlign: 'center',
    fontFamily: theme.fonts.sans,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.8,
    color: theme.colors.surface,
    textShadowColor: theme.colors.ink,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.sans,
    fontWeight: '700',
    color: theme.colors.ink,
    textAlign: 'center',
  },
  body: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  cta: {
    alignSelf: 'stretch',
  },
});
