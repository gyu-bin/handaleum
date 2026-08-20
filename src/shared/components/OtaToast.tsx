import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

export interface OtaToastProps {
  visible: boolean;
  message: string;
  /** When true, stays visible until `visible` becomes false (download phase). */
  persistent?: boolean;
  onHidden?: () => void;
  durationMs?: number;
}

/** Bottom pill toast — OTA “업데이트 중” / “업데이트 완료” (High-noon pattern). */
export function OtaToast({
  visible,
  message,
  persistent = false,
  onHidden,
  durationMs = 2200,
}: OtaToastProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      translateY.value = 8;
      return;
    }

    opacity.value = withTiming(1, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 180,
      easing: Easing.out(Easing.quad),
    });

    if (persistent) {
      return;
    }

    const hide = setTimeout(() => {
      opacity.value = withTiming(0, {
        duration: 200,
        easing: Easing.in(Easing.quad),
      });
      translateY.value = withTiming(6, { duration: 200 });
      setTimeout(() => onHidden?.(), 220);
    }, durationMs);

    return () => {
      clearTimeout(hide);
    };
  }, [visible, persistent, durationMs, onHidden, opacity, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 16 }]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: colors.shellInk,
            borderColor: colors.hairline,
          },
          animStyle,
        ]}
      >
        <Text style={[styles.text, { color: colors.canvas }]}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 200,
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.tint.mid,
  },
  text: {
    ...theme.type.micro,
    color: theme.colors.background,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
