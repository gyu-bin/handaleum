import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '@/shared/constants/theme';

export interface LoadProgressBannerProps {
  label: string;
  done: number;
  total: number;
}

/**
 * Hairline progress + caption. `total === 0` runs an indeterminate pulse.
 */
export function LoadProgressBanner({
  label,
  done,
  total,
}: LoadProgressBannerProps) {
  const indeterminate = total <= 0;
  const pulse = useSharedValue(0);
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = withTiming(indeterminate ? 0 : Math.min(1, done / total), {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
  }, [done, fill, indeterminate, total]);

  useEffect(() => {
    if (!indeterminate) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [indeterminate, pulse]);

  const fillStyle = useAnimatedStyle(() => {
    if (indeterminate) {
      return {
        width: '32%',
        transform: [{ translateX: (pulse.value * 2.2 - 0.2) * 120 }],
      };
    }
    return {
      width: `${Math.round(fill.value * 100)}%`,
      transform: [{ translateX: 0 }],
    };
  });

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={
        indeterminate
          ? undefined
          : { min: 0, max: total, now: Math.min(done, total) }
      }
    >
      <Text style={styles.line} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: 6,
  },
  line: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    fontWeight: '500',
    textAlign: 'center',
  },
  track: {
    height: 2,
    backgroundColor: theme.colors.line,
    overflow: 'hidden',
    borderRadius: 1,
  },
  fill: {
    height: '100%',
    backgroundColor: theme.colors.ink,
  },
});
