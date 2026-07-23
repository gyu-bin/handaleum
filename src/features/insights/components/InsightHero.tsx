import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface InsightHeroProps {
  placesCount: number;
  newPlacesCount: number | null;
  placesLabel: string;
  newPlacesLabel: string;
  newPlacesHiddenHint?: string;
}

/** Two big numbers at the top of the insights screen. */
export function InsightHero({
  placesCount,
  newPlacesCount,
  placesLabel,
  newPlacesLabel,
  newPlacesHiddenHint,
}: InsightHeroProps) {
  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <Text style={styles.value}>{placesCount}</Text>
        <Text style={styles.label}>{placesLabel}</Text>
      </View>
      <View style={styles.card}>
        {newPlacesCount == null ? (
          <>
            <Text style={styles.valueMuted}>—</Text>
            <Text style={styles.label}>
              {newPlacesHiddenHint ?? newPlacesLabel}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.value}>{newPlacesCount}</Text>
            <Text style={styles.label}>{newPlacesLabel}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
    gap: 6,
  },
  value: {
    ...theme.type.display,
    color: theme.colors.ink,
    fontWeight: '800',
  },
  valueMuted: {
    ...theme.type.display,
    color: theme.colors.subtle,
    fontWeight: '600',
  },
  label: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
});
