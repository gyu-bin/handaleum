import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { PaperGrain } from './PaperGrain';

export interface LoadingViewProps {
  /** Optional line under the mark. Defaults to the common loading string. */
  message?: string;
}

const ICON = require('../../../assets/images/icon.png');
const ICON_SIZE = 96;

/**
 * Brand loading — same clay icon as splash/app icon, soft breath.
 */
export function LoadingView({ message = strings.common.loading }: LoadingViewProps) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      true,
    );
  }, [breath]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + breath.value * 0.04 }],
    opacity: 0.88 + breath.value * 0.12,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <PaperGrain style={styles.grain} />
      <View style={styles.center}>
        <Animated.View style={[styles.iconWrap, iconStyle]}>
          <Image source={ICON} style={styles.icon} accessibilityIgnoresInvertColors />
        </Animated.View>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  grain: {
    opacity: 0.35,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.2237,
    overflow: 'hidden',
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  message: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
});
