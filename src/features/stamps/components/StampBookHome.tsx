import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';

import type { StampsCollected } from '../types';
import { sidoEn } from '../utils/sidoLabels';
import { TravelStamp, stampInkForKey } from './TravelStamp';

function tiltForName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 17;
  }
  return h - 8;
}

export interface StampBookHomeProps {
  sidos: string[];
  collected: StampsCollected;
  visitedSidoCount: number;
  onSelectSido: (sido: string) => void;
}

/**
 * Travel stamp-book home — 3-col seal grid.
 */
export function StampBookHome({
  sidos,
  collected,
  visitedSidoCount,
  onSelectSido,
}: StampBookHomeProps) {
  const shell = useShellInk();

  const visited = (sido: string) =>
    Object.values(collected).some((e) => e?.sido === sido);

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <View style={styles.introText}>
          <Text style={[styles.title, shell.ink]}>
            {strings.stamps.myBookTitle}
          </Text>
          <Text style={[styles.subtitle, shell.soft]}>
            {strings.stamps.footprintCount(visitedSidoCount)}
          </Text>
        </View>
      </View>

      <View style={styles.book}>
        {sidos.map((sido) => {
          const on = visited(sido);
          const tilt = on ? tiltForName(sido) : 0;
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
              <View style={{ transform: [{ rotate: `${tilt}deg` }] }}>
                <TravelStamp
                  name={sido}
                  nameEn={sidoEn(sido)}
                  collected={on}
                  size="book"
                  ink={stampInkForKey(sido)}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footer, shell.subtle]}>
        {strings.stamps.bookFooter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: theme.spacing.lg,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  introText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: theme.fonts.sans,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
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
  footer: {
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: 0.55,
  },
});
