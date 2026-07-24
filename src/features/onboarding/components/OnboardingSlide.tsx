import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { theme } from '@/shared/constants/theme';

export interface OnboardingSlideProps {
  /** Full page width (one slide per screen). */
  width: number;
  /** This slide's page index, for parallax against scrollX. */
  index: number;
  /** Pager scroll offset in px, driven on the UI thread. */
  scrollX: SharedValue<number>;
  /** Brand visual for this step. */
  art: ReactNode;
  title: string;
  body: string;
}

/**
 * One full-width onboarding page. The art parallaxes (lags and shrinks) while
 * the text fades slightly earlier, so a swipe reads as layered paper.
 */
export function OnboardingSlide({
  width,
  index,
  scrollX,
  art,
  title,
  body,
}: OnboardingSlideProps) {
  const artStyle = useAnimatedStyle(() => {
    const pos = scrollX.value / width - index;
    return {
      opacity: interpolate(pos, [-1, 0, 1], [0.2, 1, 0.2], Extrapolation.CLAMP),
      transform: [
        { translateX: pos * width * 0.3 },
        { scale: interpolate(pos, [-1, 0, 1], [0.82, 1, 0.82], Extrapolation.CLAMP) },
      ],
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const pos = scrollX.value / width - index;
    return {
      opacity: interpolate(
        pos,
        [-0.7, 0, 0.7],
        [0, 1, 0],
        Extrapolation.CLAMP,
      ),
      transform: [{ translateX: pos * width * 0.12 }],
    };
  });

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.artWrap, artStyle]}>{art}</Animated.View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  artWrap: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  title: {
    ...theme.type.title,
    color: theme.colors.ink,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    lineHeight: 24,
  },
});
