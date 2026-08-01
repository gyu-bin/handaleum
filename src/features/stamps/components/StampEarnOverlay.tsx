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

import { MascotPin } from './MascotPin';
import { StampBadge } from './StampBadge';

export interface StampEarnOverlayProps {
  /** Display names to celebrate, in order. */
  names: string[];
  onDone: () => void;
}

const DROP_FROM = 88;
const SLAM_MS = 320;
const SETTLE_MS = 120;
const HOLD_MS = 520;
const never = { reduceMotion: ReduceMotion.Never as const };

/**
 * Earn overlay — rubber seal drops and slams with ink bloom.
 */
export function StampEarnOverlay({ names, onDone }: StampEarnOverlayProps) {
  const [index, setIndex] = useState(0);
  const progress = useSharedValue(0);
  const squash = useSharedValue(1.25);
  const flash = useSharedValue(0);
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
    squash.value = 1.28;
    flash.value = 0;
    progress.value = withTiming(1, {
      duration: SLAM_MS,
      easing: Easing.in(Easing.poly(3)),
      ...never,
    });
    squash.value = withSequence(
      withTiming(0.88, {
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
    flash.value = withDelay(
      SLAM_MS - 30,
      withSequence(
        withTiming(0.35, { duration: 60, ...never }),
        withTiming(0, { duration: 280, easing: Easing.out(Easing.quad), ...never }),
      ),
    );
    const t = setTimeout(() => {
      setIndex((i) => i + 1);
    }, SLAM_MS + SETTLE_MS + HOLD_MS);
    return () => clearTimeout(t);
  }, [finished, flash, index, name, progress, squash]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * 5),
    transform: [
      { translateY: (1 - progress.value) * -DROP_FROM },
      { scale: squash.value },
      {
        rotate: `${interpolate(progress.value, [0, 1], [-12, -4])}deg`,
      },
    ],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));

  if (finished || !name) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <View style={styles.card}>
          <MascotPin size={44} />
          <Text style={styles.title}>{strings.stamps.earned(name)}</Text>
          <View style={styles.stage}>
            <Animated.View style={[styles.flash, flashStyle]} />
            <Animated.View style={stampStyle}>
              <StampBadge name={name} collected size="hero" tiltDeg={-4} />
            </Animated.View>
          </View>
        </View>
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
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.card,
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadows.raised,
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  stage: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sand,
  },
});
