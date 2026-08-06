import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

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

/** Minimal L1 list (구·시·군) — hairline rows, no cards. */
export function CityList({ cities, onSelect }: CityListProps) {
  return (
    <View style={styles.list}>
      {cities.map((row) => (
        <Pressable
          key={row.key}
          onPress={() => onSelect(row.key)}
          accessibilityRole="button"
          accessibilityLabel={`${row.label} ${row.collected}/${row.total}`}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.title}>{row.label}</Text>
          <Text style={styles.count}>
            {row.collected}/{row.total}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  rowPressed: {
    opacity: 0.55,
  },
  title: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '600',
  },
  count: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
});
