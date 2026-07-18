import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MAP_THEME_IDS, MAP_THEMES } from '@/shared/constants/mapThemes';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import type { MapThemeId } from '../types';

export interface MapThemePickerProps {
  themeId: MapThemeId;
  onChange: (id: MapThemeId) => void;
}

/**
 * Compact paper-palette swatches (dawn / ink / warm).
 */
export function MapThemePicker({ themeId, onChange }: MapThemePickerProps) {
  return (
    <View
      style={styles.row}
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.map.themePicker}
    >
      {MAP_THEME_IDS.map((id) => {
        const palette = MAP_THEMES[id];
        const selected = id === themeId;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={palette.label}
            hitSlop={6}
            style={({ pressed }) => [
              styles.swatch,
              { backgroundColor: palette.swatch },
              selected && styles.swatchSelected,
              pressed && styles.swatchPressed,
            ]}
          >
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  swatchSelected: {
    borderColor: theme.colors.ink,
  },
  swatchPressed: {
    opacity: 0.75,
  },
  check: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
});
