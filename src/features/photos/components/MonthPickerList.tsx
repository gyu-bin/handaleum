import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { strings } from '@/shared/constants/strings';
import { formatProPriceKrw, IS_MONETIZATION_LIVE } from '@/shared/constants/pricing';
import { theme } from '@/shared/constants/theme';

import { prefetchMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import type { MonthKey, MonthSummary } from '../types';

export interface MonthPickerListProps {
  summaries: MonthSummary[];
  selected: MonthKey;
  onSelect: (month: MonthKey) => void;
  canOpenMonth: (month: MonthKey) => boolean;
}

export function MonthPickerList({
  summaries,
  selected,
  onSelect,
  canOpenMonth,
}: MonthPickerListProps) {
  const router = useRouter();

  return (
    <FlatList
      data={summaries}
      keyExtractor={(item) => item.month}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        IS_MONETIZATION_LIVE ? (
          <Text style={styles.hint}>
            {strings.months.freeWindowHint(formatProPriceKrw())}
          </Text>
        ) : null
      }
      renderItem={({ item }) => {
        const isSelected = item.month === selected;
        const locked = !canOpenMonth(item.month);
        return (
          <Pressable
            onPress={() => {
              if (locked) {
                return;
              }
              prefetchMonthlyPhotos(item.month);
              onSelect(item.month);
              router.back();
            }}
            disabled={locked}
            style={({ pressed }) => [
              styles.row,
              isSelected && styles.rowSelected,
              locked && styles.rowLocked,
              pressed && !locked && styles.rowPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked, selected: isSelected }}
            accessibilityLabel={
              locked
                ? `${item.month}, ${strings.months.proOnly}`
                : item.month
            }
          >
            <Text
              style={[
                styles.month,
                isSelected && styles.monthSelected,
                locked && styles.monthLocked,
              ]}
            >
              {item.month}
            </Text>
            <View style={styles.right}>
              {locked ? (
                <View style={styles.proBadge}>
                  <Text style={styles.proText}>{strings.months.proOnly}</Text>
                </View>
              ) : (
                <Text style={[styles.count, isSelected && styles.countSelected]}>
                  {strings.months.photoCount(item.totalCount)}
                </Text>
              )}
              {isSelected && !locked ? (
                <Text style={styles.check}>✓</Text>
              ) : null}
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
  hint: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
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
  rowLocked: {
    opacity: 0.72,
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
  monthLocked: {
    color: theme.colors.subtle,
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
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accentSoft,
  },
  proText: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '800',
    fontSize: 11,
  },
  sep: {
    height: theme.spacing.sm,
  },
});
