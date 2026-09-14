import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import { StampBadge } from './StampBadge';

export type CityRow = {
  key: string;
  label: string;
  collected: number;
  total: number;
};

export interface CityListProps {
  cities: CityRow[];
  onSelect: (key: string) => void;
}

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

/**
 * L1 stamp book (구·시·군). Drill-down stays intact; the grid is a seal board.
 */
export function CityList({ cities, onSelect }: CityListProps) {
  return (
    <View style={styles.book}>
      {cities.map((row) => {
        const visited = row.collected > 0;
        return (
          <Pressable
            key={row.key}
            onPress={() => onSelect(row.key)}
            accessibilityRole="button"
            accessibilityLabel={`${row.label} ${
              visited ? `${row.collected}개 동네 도장 수집` : '미수집 도장'
            }`}
            style={({ pressed }) => [
              styles.cell,
              pressed && styles.cellPressed,
            ]}
          >
            <StampBadge
              name={row.label}
              collected={visited}
              tiltDeg={tiltForName(row.label)}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  book: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  cell: {
    width: '33.333%',
    minWidth: 0,
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingVertical: theme.spacing.sm,
  },
  cellPressed: {
    opacity: 0.58,
  },
});
