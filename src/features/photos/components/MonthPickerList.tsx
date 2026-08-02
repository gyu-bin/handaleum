import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  formatProPriceKrw,
  IS_MONETIZATION_LIVE,
} from '@/shared/constants/pricing';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { prefetchMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import type { MonthKey, MonthSummary } from '../types';
import {
  JournalCoastSketch,
  JournalTravelStamp,
} from './MonthPickerJournalDecor';

export interface MonthPickerListProps {
  summaries: MonthSummary[];
  selected: MonthKey;
  onSelect: (month: MonthKey) => void;
  canOpenMonth: (month: MonthKey) => boolean;
}

function yearOf(month: MonthKey): string {
  return month.slice(0, 4);
}

function monthKey(year: string, monthNum: number): MonthKey {
  return `${year}-${String(monthNum).padStart(2, '0')}` as MonthKey;
}

type MonthCell = {
  month: MonthKey;
  monthNum: number;
  count: number;
};

/**
 * Journal-style picker: year stepper + two-column 1–12 month rows.
 * Empty months (0 photos) are muted and not selectable.
 */
export function MonthPickerList({
  summaries,
  selected,
  onSelect,
  canOpenMonth,
}: MonthPickerListProps) {
  const router = useRouter();

  const countByMonth = useMemo(() => {
    const map = new Map<MonthKey, number>();
    for (const s of summaries) {
      map.set(s.month, s.totalCount);
    }
    return map;
  }, [summaries]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const s of summaries) {
      set.add(yearOf(s.month));
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [summaries]);

  const [year, setYear] = useState(() => {
    const selectedYear = yearOf(selected);
    if (years.includes(selectedYear)) {
      return selectedYear;
    }
    return years[0] ?? selectedYear;
  });

  const yearIndex = years.indexOf(year);
  const canPrev = yearIndex >= 0 && yearIndex < years.length - 1;
  const canNext = yearIndex > 0;

  const cells: MonthCell[] = useMemo(() => {
    const out: MonthCell[] = [];
    for (let m = 1; m <= 12; m++) {
      const key = monthKey(year, m);
      out.push({
        month: key,
        monthNum: m,
        count: countByMonth.get(key) ?? 0,
      });
    }
    return out;
  }, [countByMonth, year]);

  const leftCol = cells.slice(0, 6);
  const rightCol = cells.slice(6, 12);

  const goYear = (dir: -1 | 1) => {
    const idx = years.indexOf(year);
    if (idx < 0) {
      return;
    }
    // years sorted newest → oldest; dir -1 = older, +1 = newer
    const next = years[idx - dir];
    if (next) {
      setYear(next);
    }
  };

  const renderCell = (cell: MonthCell) => {
    const empty = cell.count <= 0;
    const locked = !empty && !canOpenMonth(cell.month);
    const isSelected = cell.month === selected;
    const disabled = empty || locked;

    return (
      <Pressable
        key={cell.month}
        onPress={() => {
          if (disabled) {
            return;
          }
          prefetchMonthlyPhotos(cell.month);
          onSelect(cell.month);
          router.back();
        }}
        disabled={disabled}
        style={({ pressed }) => [
          styles.monthRow,
          isSelected && !disabled && styles.monthRowSelected,
          pressed && !disabled && styles.monthRowPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isSelected }}
        accessibilityLabel={
          locked
            ? `${strings.months.monthOnly(cell.monthNum)}, ${strings.months.proOnly}`
            : `${strings.months.monthOnly(cell.monthNum)}, ${strings.months.photoCount(cell.count)}`
        }
      >
        <Text
          style={[
            styles.monthLabel,
            empty && styles.monthMuted,
            locked && styles.monthMuted,
            isSelected && !disabled && styles.monthLabelSelected,
          ]}
        >
          {strings.months.monthOnly(cell.monthNum)}
          <Text style={styles.dot}> · </Text>
          {locked ? (
            <Text style={styles.proInline}>{strings.months.proOnly}</Text>
          ) : (
            <Text style={[styles.count, empty && styles.countMuted]}>
              {strings.months.photoCount(cell.count)}
            </Text>
          )}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <JournalCoastSketch size={78} />
        <View style={styles.heroCenter}>
          <Text style={styles.heroTitle}>{strings.months.journalTitle}</Text>
          <Text style={styles.heroSubtitle}>
            {strings.months.journalSubtitle}
          </Text>
        </View>
        <JournalTravelStamp size={68} />
      </View>

      {IS_MONETIZATION_LIVE ? (
        <Text style={styles.hint}>
          {strings.months.freeWindowHint(formatProPriceKrw())}
        </Text>
      ) : null}

      <View style={styles.yearRow}>
        <Pressable
          onPress={() => goYear(-1)}
          disabled={!canPrev}
          hitSlop={12}
          style={({ pressed }) => [
            styles.yearChevronBtn,
            (!canPrev || pressed) && styles.yearChevronDim,
          ]}
          accessibilityRole="button"
          accessibilityLabel={strings.months.prevYear}
        >
          <Text style={styles.yearChevron}>‹</Text>
        </Pressable>
        <Text style={styles.yearLabel}>{strings.months.yearLabel(year)}</Text>
        <Pressable
          onPress={() => goYear(1)}
          disabled={!canNext}
          hitSlop={12}
          style={({ pressed }) => [
            styles.yearChevronBtn,
            (!canNext || pressed) && styles.yearChevronDim,
          ]}
          accessibilityRole="button"
          accessibilityLabel={strings.months.nextYear}
        >
          <Text style={styles.yearChevron}>›</Text>
        </Pressable>
      </View>

      <View style={styles.dottedRule} />

      <View style={styles.grid}>
        <View style={styles.col}>{leftCol.map(renderCell)}</View>
        <View style={styles.col}>{rightCol.map(renderCell)}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  heroCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  heroTitle: {
    fontFamily: theme.fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: theme.colors.ink,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  hint: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 16,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  yearChevronBtn: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChevronDim: {
    opacity: 0.28,
  },
  yearChevron: {
    fontSize: 28,
    lineHeight: 32,
    color: theme.colors.sand,
    fontWeight: '300',
  },
  yearLabel: {
    fontFamily: theme.fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    color: theme.colors.ink,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'center',
  },
  dottedRule: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    borderStyle: 'dashed',
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  col: {
    flex: 1,
  },
  monthRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  monthRowSelected: {
    backgroundColor: theme.colors.accentSoft,
    marginHorizontal: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.sm,
  },
  monthRowPressed: {
    opacity: 0.75,
  },
  monthLabel: {
    fontFamily: theme.fonts.serif,
    fontSize: 17,
    lineHeight: 24,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  monthLabelSelected: {
    color: theme.colors.accent,
  },
  monthMuted: {
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  dot: {
    color: theme.colors.subtle,
    fontWeight: '400',
  },
  count: {
    fontFamily: theme.fonts.serif,
    color: theme.colors.sand,
    fontWeight: '700',
  },
  countMuted: {
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  proInline: {
    fontFamily: theme.fonts.serif,
    color: theme.colors.accent,
    fontWeight: '700',
  },
});
