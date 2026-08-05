import { FlatList, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import { StampBadge } from './StampBadge';

export type CityStampUnit = {
  id: string;
  name: string;
  collected: boolean;
  animateIn: boolean;
  tiltDeg: number;
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
  onReplay?: (id: string) => void;
}

const COLS = 3;

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/**
 * One-page sido contents: leaf 시/군 as stamps, multi-구 cities as labeled groups.
 * Always 3 columns per row.
 */
export function CityStampSections({
  sections,
  replayNonce = {},
  onReplay,
}: CityStampSectionsProps) {
  return (
    <FlatList
      data={sections}
      keyExtractor={(item) => item.city}
      contentContainerStyle={styles.list}
      renderItem={({ item: section }) => {
        const rows = chunkRows(section.units, COLS);
        return (
          <View style={styles.section}>
            {section.showHeader ? (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{section.city}</Text>
                <Text style={styles.headerCount}>
                  {section.collected}/{section.total}
                </Text>
              </View>
            ) : null}
            {rows.map((row, rowIndex) => (
              <View key={`${section.city}-r${rowIndex}`} style={styles.row}>
                {row.map((unit) => {
                  const nonce = replayNonce[unit.id] ?? 0;
                  return (
                    <View key={`${unit.id}-${nonce}`} style={styles.cell}>
                      <StampBadge
                        name={unit.name}
                        collected={unit.collected}
                        animateIn={unit.animateIn || nonce > 0}
                        tiltDeg={unit.tiltDeg}
                        onPress={
                          unit.collected && onReplay
                            ? () => onReplay(unit.id)
                            : undefined
                        }
                      />
                    </View>
                  );
                })}
                {row.length < COLS
                  ? Array.from({ length: COLS - row.length }, (_, i) => (
                      <View key={`pad-${i}`} style={styles.cell} />
                    ))
                  : null}
              </View>
            ))}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  headerTitle: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
  },
  headerCount: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '600',
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
});
