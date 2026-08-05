import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface VisitChipRowProps {
  labels: string[];
  /** Muted styling for the bottom scope bar, where the chips are secondary. */
  tone?: 'accent' | 'quiet';
}

/**
 * Place labels as hairline ticks — not lifestyle pills (Plan A).
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
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.panelBorder,
  },
  chipQuiet: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.panelBorder,
  },
  chipText: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  chipTextQuiet: {
    fontWeight: '500',
    color: theme.colors.inkSoft,
  },
});
