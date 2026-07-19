import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface VisitChipRowProps {
  labels: string[];
  /** Muted styling for the bottom scope bar, where the chips are secondary. */
  tone?: 'accent' | 'quiet';
}

/**
 * Horizontally scrolling place chips. Shared by the header (this month's
 * places) and the bottom scope bar so both read as the same object at
 * different grains.
 */
export function VisitChipRow({ labels, tone = 'accent' }: VisitChipRowProps) {
  if (labels.length === 0) {
    return null;
  }

  const quiet = tone === 'quiet';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="list"
    >
      {labels.map((label) => (
        <View
          key={label}
          style={[styles.chip, quiet && styles.chipQuiet]}
          accessibilityRole="text"
        >
          <Text style={[styles.chipText, quiet && styles.chipTextQuiet]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
  },
  chipQuiet: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    color: theme.colors.accent,
  },
  chipTextQuiet: {
    fontWeight: '500',
    color: theme.colors.ink,
  },
});
