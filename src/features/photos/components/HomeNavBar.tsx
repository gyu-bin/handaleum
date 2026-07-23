import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { theme } from '@/shared/constants/theme';

export interface HomeNavItem {
  href: Href;
  label: string;
}

export interface HomeNavBarProps {
  items: HomeNavItem[];
}

/**
 * Pill dock for home destinations (concept C). Paper surface, sand press mark.
 * Sits below the map panel as a quiet instrument strip — not a heavy tab bar.
 */
export function HomeNavBar({ items }: HomeNavBarProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {items.map((item, index) => (
          <View key={String(item.href)} style={styles.slot}>
            {index > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
            >
              {({ pressed }) => (
                <View style={styles.itemInner}>
                  <Text
                    style={[styles.label, pressed && styles.labelPressed]}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>
                  <View
                    style={[
                      styles.underline,
                      pressed && styles.underlineVisible,
                    ]}
                  />
                </View>
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    paddingVertical: 4,
    paddingHorizontal: 2,
    ...theme.shadows.raised,
  },
  slot: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 10,
    backgroundColor: theme.colors.hairline,
  },
  item: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: theme.radius.pill,
  },
  itemPressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    letterSpacing: -0.2,
    fontSize: 12,
    lineHeight: 16,
  },
  labelPressed: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  underline: {
    width: 16,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: theme.tint.faint,
  },
  underlineVisible: {
    backgroundColor: theme.colors.sand,
  },
});
