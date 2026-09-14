import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import type { StampsCollected } from '../types';
import { sidoEn } from '../utils/sidoLabels';
import { TravelStamp } from './TravelStamp';

export interface StampBookHomeProps {
  sidos: string[];
  collected: StampsCollected;
  visitedSidoCount: number;
  onSelectSido: (sido: string) => void;
}

/**
 * Travel stamp-book home — 3-col seal grid (sheet layout).
 */
export function StampBookHome({
  sidos,
  collected,
  onSelectSido,
}: StampBookHomeProps) {
  const visited = (sido: string) =>
    Object.values(collected).some((e) => e?.sido === sido);

  return (
    <View style={styles.root}>
      <View style={styles.book}>
        {sidos.map((sido) => {
          const on = visited(sido);
          return (
            <Pressable
              key={sido}
              onPress={() => onSelectSido(sido)}
              accessibilityRole="button"
              accessibilityLabel={`${sido}${on ? '' : ' 미방문'}`}
              style={({ pressed }) => [
                styles.cell,
                pressed && styles.pressed,
              ]}
            >
              <TravelStamp
                name={sido}
                nameEn={sidoEn(sido)}
                stampKey={sido}
                level="sido"
                collected={on}
                size="book"
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  book: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
  },
  cell: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.55,
  },
});
