import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  formatProPriceKrw,
  IS_MONETIZATION_LIVE,
} from '@/shared/constants/pricing';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { prefetchMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import type { MonthKey, MonthSummary } from '../types';
import { JournalDottedRule } from './MonthPickerJournalDecor';

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
 * Journal month picker matching the approved sample:
 * hero art + year stepper + two-column 1–12 list (0장 muted).
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
          style={[styles.monthName, empty && styles.muted, locked && styles.muted]}
        >
          {strings.months.monthOnly(cell.monthNum)}
        </Text>
        <Text style={[styles.sepDot, empty && styles.muted]}> · </Text>
        {locked ? (
          <Text style={styles.proInline}>{strings.months.proOnly}</Text>
        ) : (
          <Text style={[styles.count, empty && styles.muted]}>
            {strings.months.photoCount(cell.count)}
          </Text>
        )}
        {isSelected && !disabled ? <View style={styles.selectedMark} /> : null}
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{strings.months.journalTitle}</Text>
        <Text style={styles.heroSubtitle}>
          {strings.months.journalSubtitle}
        </Text>
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
          hitSlop={14}
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
          hitSlop={14}
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

      <JournalDottedRule />

      <View style={styles.grid}>
        <View style={styles.col}>{leftCol.map(renderCell)}</View>
        <View style={styles.colGap} />
        <View style={styles.col}>{rightCol.map(renderCell)}</View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  heroTitle: {
    fontFamily: theme.fonts.serif,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: theme.colors.ink,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.inkSoft,
    marginTop: 6,
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
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  yearChevronBtn: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearChevronDim: {
    opacity: 0.25,
  },
  yearChevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 30,
    lineHeight: 34,
    color: theme.colors.ink,
    fontWeight: '400',
  },
  yearLabel: {
    fontFamily: theme.fonts.serif,
    fontSize: 24,
    lineHeight: 30,
    color: theme.colors.ink,
    fontWeight: '700',
    minWidth: 110,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
  },
  col: {
    flex: 1,
  },
  colGap: {
    width: theme.spacing.lg,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  monthRowPressed: {
    opacity: 0.65,
  },
  monthName: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  sepDot: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.inkSoft,
  },
  count: {
    fontFamily: theme.fonts.sans,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.terracotta,
    fontWeight: '700',
  },
  muted: {
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  proInline: {
    fontFamily: theme.fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.terracotta,
    fontWeight: '700',
  },

  selectedMark: {
    marginLeft: 'auto',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.terracotta,
  },
});
