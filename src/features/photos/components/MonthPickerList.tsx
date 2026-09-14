import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import {
  formatProPriceKrw,
  IS_MONETIZATION_LIVE,
} from '@/shared/constants/pricing';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';

import { AssetThumbImage } from './AssetThumbImage';
import { prefetchMonthlyPhotos } from '../hooks/useMonthlyPhotos';
import type { MonthKey, MonthSummary } from '../types';

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
  coverAssetId?: string;
};

const COLS = 3;
const GAP = 10;
const PHOTO_RADIUS = 6;

/**
 * Month archive — cream canvas with photo covers, not a date-picker list.
 */
export function MonthPickerList({
  summaries,
  selected,
  onSelect,
  canOpenMonth,
}: MonthPickerListProps) {
  const router = useRouter();
  const shell = useShellInk();
  const { width } = useWindowDimensions();
  const cellW = (width - theme.spacing.lg * 2 - GAP * (COLS - 1)) / COLS;
  const photoH = cellW * 1.15;

  const byMonth = useMemo(() => {
    const map = new Map<MonthKey, MonthSummary>();
    for (const s of summaries) {
      map.set(s.month, s);
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
      const summary = byMonth.get(key);
      out.push({
        month: key,
        monthNum: m,
        count: summary?.totalCount ?? 0,
        coverAssetId: summary?.coverAssetId,
      });
    }
    return out;
  }, [byMonth, year]);

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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
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
          <Text style={[styles.yearChevron, shell.ink]}>‹</Text>
        </Pressable>
        <Text style={[styles.yearLabel, shell.ink]}>{year}</Text>
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
          <Text style={[styles.yearChevron, shell.ink]}>›</Text>
        </Pressable>
      </View>

      {IS_MONETIZATION_LIVE ? (
        <Text style={[styles.hint, shell.soft]}>
          {strings.months.freeWindowHint(formatProPriceKrw())}
        </Text>
      ) : null}

      <View style={styles.grid}>
        {cells.map((cell) => {
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
                styles.cell,
                { width: cellW },
                pressed && !disabled && styles.cellPressed,
                empty && styles.cellEmpty,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: isSelected }}
              accessibilityLabel={
                locked
                  ? `${strings.months.monthOnly(cell.monthNum)}, ${strings.months.proOnly}`
                  : empty
                    ? `${strings.months.monthOnly(cell.monthNum)}, ${strings.months.noRecord}`
                    : `${strings.months.monthOnly(cell.monthNum)}, ${strings.months.photoCountLong(cell.count)}`
              }
            >
              <View
                style={[
                  styles.photoFrame,
                  {
                    width: cellW,
                    height: photoH,
                    borderRadius: PHOTO_RADIUS,
                  },
                  isSelected && !disabled && styles.photoSelected,
                ]}
              >
                {!empty && cell.coverAssetId ? (
                  <AssetThumbImage
                    assetId={cell.coverAssetId}
                    size={Math.ceil(cellW * 2)}
                    style={styles.photo}
                  />
                ) : (
                  <View style={styles.photoPlaceholder} />
                )}
              </View>
              <Text
                style={[
                  styles.monthName,
                  shell.ink,
                  (empty || locked) && styles.monthNameMuted,
                ]}
              >
                {strings.months.monthOnly(cell.monthNum)}
              </Text>
              <Text
                style={[
                  styles.count,
                  shell.soft,
                  (empty || locked) && styles.countMuted,
                ]}
              >
                {locked
                  ? strings.months.proOnly
                  : empty
                    ? strings.months.noRecord
                    : strings.months.photoCountLong(cell.count)}
              </Text>
            </Pressable>
          );
        })}
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
    paddingBottom: theme.spacing.xl + 56,
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
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '400',
  },
  yearLabel: {
    fontFamily: theme.fonts.sans,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    minWidth: 88,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  hint: {
    ...theme.type.micro,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    marginBottom: theme.spacing.sm,
  },
  cellEmpty: {
    opacity: 0.42,
  },
  cellPressed: {
    opacity: 0.72,
  },
  photoFrame: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  photoSelected: {
    borderColor: theme.colors.ink,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
  },
  monthName: {
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  monthNameMuted: {
    fontWeight: '500',
    color: theme.colors.subtle,
  },
  count: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  countMuted: {
    color: theme.colors.subtle,
  },
});
