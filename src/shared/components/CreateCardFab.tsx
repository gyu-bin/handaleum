import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

/**
 * Journal create control — paper chip + ink tick, not a Material FAB.
 * Same mark on the home map and 내 회고.
 */
export function CreateCardFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={strings.cards.createTitle}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <View style={styles.tick} />
      <Text style={styles.label}>{strings.cards.createTitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    ...theme.shadows.raised,
  },
  tick: {
    width: 2,
    height: 16,
    backgroundColor: theme.colors.ink,
  },
  label: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    color: theme.colors.ink,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
