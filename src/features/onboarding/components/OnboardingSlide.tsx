import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface OnboardingSlideProps {
  /** Full page width (one slide per screen). */
  width: number;
  /** Brand visual for this step. */
  art: ReactNode;
  title: string;
  body: string;
}

/** One full-width onboarding page: a brand visual over a title and body line. */
export function OnboardingSlide({ width, art, title, body }: OnboardingSlideProps) {
  return (
    <View style={[styles.slide, { width }]}>
      <View style={styles.artWrap}>{art}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
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
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
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
