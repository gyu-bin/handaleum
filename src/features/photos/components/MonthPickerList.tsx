import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { prefetchMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import type { MonthKey, MonthSummary } from '../types';

export interface MonthPickerListProps {
  summaries: MonthSummary[];
  selected: MonthKey;
  onSelect: (month: MonthKey) => void;
}

export function MonthPickerList({ summaries, selected, onSelect }: MonthPickerListProps) {
  const router = useRouter();

  return (
    <FlatList
      data={summaries}
      keyExtractor={(item) => item.month}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isSelected = item.month === selected;
        return (
          <Pressable
            onPress={() => {
              // Kick off the month load before navigating back so the map
              // often has cache ready (or already fetching) on arrival.
              prefetchMonthlyPhotos(item.month);
              onSelect(item.month);
              router.back();
            }}
            style={({ pressed }) => [
              styles.row,
              isSelected && styles.rowSelected,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={[styles.month, isSelected && styles.monthSelected]}>
              {item.month}
            </Text>
            <View style={styles.right}>
              <Text style={[styles.count, isSelected && styles.countSelected]}>
                {strings.months.photoCount(item.totalCount)}
              </Text>
              {isSelected ? <Text style={styles.check}>✓</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.card,
  },
  rowSelected: {
    backgroundColor: theme.colors.accent,
  },
  rowPressed: {
    opacity: 0.9,
  },
  month: {
    ...theme.type.title,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  monthSelected: {
    color: theme.colors.surface,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  count: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    fontWeight: '600',
  },
  countSelected: {
    color: theme.colors.surface,
  },
  check: {
    color: theme.colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  sep: {
    height: theme.spacing.sm,
  },
});
