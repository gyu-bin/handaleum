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
 * Thumb-reachable navigation for the home hub. Text labels (not icons) to keep
 * the paper-map identity. The primary action (카드 만들기) stays a distinct CTA
 * above the map footer; this bar carries the secondary destinations only.
 */
export function HomeNavBar({ items }: HomeNavBarProps) {
  const router = useRouter();

  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable
          key={String(item.href)}
          onPress={() => router.push(item.href)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.card,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  item: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.card,
  },
  pressed: {
    backgroundColor: theme.colors.accentSoft,
  },
  label: {
    ...theme.type.label,
    color: theme.colors.ink,
    fontWeight: '600',
  },
});
