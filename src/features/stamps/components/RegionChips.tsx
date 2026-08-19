import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface RegionChipsProps {
  sidos: string[];
  selected: string;
  onSelect: (sido: string) => void;
}

const CHIP_H = 40;

/**
 * Horizontal 시·도 chip row. Selected chip fills with ink (Plan A).
 * Fixed chip height + generous scroll padding so Hangul is not clipped.
 */
export function RegionChips({ sidos, selected, onSelect }: RegionChipsProps) {
  const scrollRef = useRef<ScrollView>(null);
  const xFor = useRef<Record<string, number>>({});

  useEffect(() => {
    const x = xFor.current[selected];
    if (x == null) {
      return;
    }
    scrollRef.current?.scrollTo({
      x: Math.max(0, x - theme.spacing.lg),
      animated: true,
    });
  }, [selected]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {sidos.map((sido) => {
          const active = sido === selected;
          return (
            <Pressable
              key={sido}
              onPress={() => onSelect(sido)}
              onLayout={(e) => {
                xFor.current[sido] = e.nativeEvent.layout.x;
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text
                style={[styles.label, active && styles.labelActive]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {sido}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Isolate scroll clipping from neighbors.
    height: CHIP_H + 16,
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
  },
  chip: {
    height: CHIP_H,
    paddingHorizontal: 14,
    marginRight: theme.spacing.sm,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  label: {
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    // Match chip inner box — avoid theme.label lineHeight which clips Hangul.
    lineHeight: 20,
    includeFontPadding: false,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textAlignVertical: 'center',
  },
  labelActive: {
    color: theme.colors.surface,
  },
});

