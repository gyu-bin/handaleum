import { memo, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';

import { StampBadge } from './StampBadge';

export type CityStampUnit = {
  id: string;
  name: string;
  collected: boolean;
  /** First collected in the current calendar month. */
  isNew?: boolean;
  animateIn: boolean;
  tiltDeg: number;
  /** YYYY-MM when known from collection entry. */
  firstMonth?: string;
};

export type CityStampSection = {
  city: string;
  /** True when city has multiple 구 — may show section chrome. */
  grouped: boolean;
  /** Hide header when it duplicates the sido progress line (서울 등). */
  showHeader: boolean;
  collected: number;
  total: number;
  units: CityStampUnit[];
};

export interface CityStampSectionsProps {
  sections: CityStampSection[];
  /** Remount nonce so a collected stamp can replay its slam on tap. */
  replayNonce?: Record<string, number>;
  /** Stamp tap — open leaf detail (visited) or no-op. */
  onSelectUnit?: (unit: CityStampUnit) => void;
}

type VisitFilter = 'all' | 'visited' | 'unvisited';
type SortMode = 'name' | 'recent';

const COLS = 3;

const LeafCell = memo(function LeafCell({
  unit,
  nonce,
  onSelectUnit,
}: {
  unit: CityStampUnit;
  nonce: number;
  onSelectUnit?: (unit: CityStampUnit) => void;
}) {
  return (
    <View style={styles.cell}>
      <StampBadge
        name={unit.name}
        stampKey={unit.id}
        level="neighborhood"
        collected={unit.collected}
        isNew={unit.isNew}
        animateIn={unit.animateIn || nonce > 0}
        tiltDeg={unit.tiltDeg}
        size="leaf"
        onPress={onSelectUnit ? () => onSelectUnit(unit) : undefined}
      />
    </View>
  );
});

/**
 * L2 leaf board — visit filter + virtualized compact seals.
 */
export function CityStampSections({
  sections,
  replayNonce = {},
  onSelectUnit,
}: CityStampSectionsProps) {
  const shell = useShellInk();
  const [filter, setFilter] = useState<VisitFilter>('all');
  const [sort, setSort] = useState<SortMode>('name');

  const section = sections[0];
  const units = section?.units ?? [];

  const filtered = useMemo(() => {
    let next = units;
    if (filter === 'visited') {
      next = next.filter((u) => u.collected);
    } else if (filter === 'unvisited') {
      next = next.filter((u) => !u.collected);
    }
    next = [...next];
    if (sort === 'recent') {
      next.sort((a, b) => {
        if (a.collected !== b.collected) {
          return a.collected ? -1 : 1;
        }
        const am = a.firstMonth ?? '';
        const bm = b.firstMonth ?? '';
        if (am !== bm) {
          return bm.localeCompare(am);
        }
        return a.name.localeCompare(b.name, 'ko');
      });
    } else {
      next.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
    return next;
  }, [filter, sort, units]);

  const rows = useMemo(() => {
    const out: CityStampUnit[][] = [];
    for (let i = 0; i < filtered.length; i += COLS) {
      out.push(filtered.slice(i, i + COLS));
    }
    return out;
  }, [filtered]);

  const renderRow = ({ item, index }: ListRenderItemInfo<CityStampUnit[]>) => (
    <View style={styles.row}>
      {item.map((unit) => {
        const nonce = replayNonce[unit.id] ?? 0;
        return (
          <LeafCell
            key={`${unit.id}-${nonce}`}
            unit={unit}
            nonce={nonce}
            onSelectUnit={onSelectUnit}
          />
        );
      })}
      {item.length < COLS
        ? Array.from({ length: COLS - item.length }, (_, i) => (
            <View key={`pad-${index}-${i}`} style={styles.cell} />
          ))
        : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.segmentTrack}>
          {(
            [
              ['all', strings.stamps.filterAll],
              ['visited', strings.stamps.filterVisited],
              ['unvisited', strings.stamps.filterUnvisited],
            ] as const
          ).map(([key, label]) => {
            const on = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={[styles.segment, on && styles.segmentOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text
                  style={[styles.segmentText, on && styles.segmentTextOn]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sortRow}>
          {(
            [
              ['name', strings.stamps.sortAlpha],
              ['recent', strings.stamps.sortRecent],
            ] as const
          ).map(([key, label], index) => {
            const on = sort === key;
            return (
              <View key={key} style={styles.sortItem}>
                {index > 0 ? <Text style={styles.sortDot}>·</Text> : null}
                <Pressable
                  onPress={() => setSort(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  hitSlop={8}
                >
                  <Text style={[styles.sortText, on && styles.sortTextOn]}>
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>

      {section?.showHeader ? (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, shell.ink]}>{section.city}</Text>
          <Text style={[styles.headerCount, shell.subtle]}>
            {strings.stamps.leafVisitSummary(
              section.collected,
              Math.max(0, section.total - section.collected),
            )}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(_, index) => `row-${index}`}
        renderItem={renderRow}
        style={styles.list}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <Text style={[styles.empty, shell.subtle]}>
            {strings.stamps.filterEmpty}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  toolbar: {
    paddingHorizontal: theme.spacing.lg,
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  segmentTrack: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: theme.radius.pill,
  },
  segmentOn: {
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    ...theme.shadows.card,
  },
  segmentText: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.inkSoft,
    fontWeight: '500',
  },
  segmentTextOn: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 2,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortDot: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.subtle,
    marginHorizontal: 4,
  },
  sortText: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.subtle,
    fontWeight: '500',
  },
  sortTextOn: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTitle: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  headerCount: {
    fontFamily: theme.fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.stampInkMuted,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
  empty: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
});
