import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';
import { useShellInk } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

export interface RegionChipsProps {
  sidos: string[];
  selected: string;
  onSelect: (sido: string) => void;
}

const CHIP_H = 30;

/**
 * Horizontal 시·도 chip row. Selected chip fills with ink (Plan A).
 * Fixed chip height + generous scroll padding so Hangul is not clipped.
 */
export function RegionChips({ sidos, selected, onSelect }: RegionChipsProps) {
  const shell = useShellInk();
  const { colors } = useTheme();
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
              hitSlop={{ top: 6, right: 4, bottom: 6, left: 4 }}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.shellChip,
                  borderColor: colors.hairline,
                },
                active && {
                  backgroundColor: colors.shellInk,
                  borderColor: colors.shellInk,
                },
              ]}
            >
              <Text
                style={[
                  styles.label,
                  shell.soft,
                  active && { color: colors.canvas, fontWeight: '700' },
                ]}
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
    height: CHIP_H + 10,
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 5,
    alignItems: 'center',
    flexDirection: 'row',
  },
  chip: {
    height: CHIP_H,
    paddingHorizontal: 10,
    marginRight: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  label: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.type.label.fontSize,
    // Match chip inner box — avoid theme.label lineHeight which clips Hangul.
    lineHeight: 16,
    includeFontPadding: false,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    textAlignVertical: 'center',
  },
  labelActive: {
    color: theme.colors.surface,
  },
});
