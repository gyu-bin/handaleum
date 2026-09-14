import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

import { StampBadge } from './StampBadge';

export interface StampEarnOverlayProps {
  /** Display names to celebrate, in order. */
  names: string[];
  onDone: () => void;
}

const DROP_FROM = 72;
const SLAM_MS = 300;
const SETTLE_MS = 110;
const HOLD_MS = 560;
const never = { reduceMotion: ReduceMotion.Never as const };

/**
 * Earn overlay — seal drops onto cream paper, soft ink bloom, short copy.
 * Intentionally not a game-reward popup.
 */
export function StampEarnOverlay({ names, onDone }: StampEarnOverlayProps) {
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const squash = useSharedValue(1.15);
  const bloom = useSharedValue(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const name = names[index];
  const finished = names.length === 0 || index >= names.length;

  useEffect(() => {
    if (finished) {
      onDoneRef.current();
      return;
    }
    progress.value = 0;
    squash.value = 1.15;
    bloom.value = 0;
    progress.value = withTiming(1, {
      duration: SLAM_MS,
      easing: Easing.in(Easing.poly(3)),
      ...never,
    });
    squash.value = withSequence(
      withTiming(0.95, {
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
    bloom.value = withDelay(
      SLAM_MS - 40,
      withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic),
        ...never,
      }),
    );
    const t = setTimeout(() => {
      setIndex((i) => i + 1);
    }, SLAM_MS + SETTLE_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, [bloom, finished, index, name, progress, squash]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 5),
    transform: [
      { translateY: (1 - progress.value) * -DROP_FROM },
      { scale: squash.value },
      {
        rotate: `${interpolate(progress.value, [0, 1], [-10, -3])}deg`,
      },
    ],
  }));

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: interpolate(bloom.value, [0, 0.2, 1], [0, 0.4, 0]),
    transform: [{ scale: interpolate(bloom.value, [0, 1], [0.5, 1.7]) }],
  }));

  if (finished || !name) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <View style={styles.card}>
          <View style={styles.stage}>
            <Animated.View style={[styles.bloomRing, bloomStyle]} />
            <Animated.View style={stampStyle}>
              <StampBadge
                name={name}
                stampKey={name}
                level="neighborhood"
                collected
                size="hero"
                tiltDeg={-3}
              />
            </Animated.View>
          </View>
          <Text style={styles.title}>{strings.stamps.earned(name)}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 280,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.stampInkSoft,
  },
  title: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.stampInk,
    fontWeight: '700',
    textAlign: 'center',
  },
  stage: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloomRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.colors.stampInkMuted,
  },
});
