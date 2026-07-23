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
 * Compact pill dock for home destinations. Paper-map identity: text only,
 * sand underline on press (concept C, sized down).
 */
export function HomeNavBar({ items }: HomeNavBarProps) {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {items.map((item) => (
          <Pressable
            key={String(item.href)}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
          >
            {({ pressed }) => (
              <>
                <Text
                  style={[styles.label, pressed && styles.labelPressed]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <View
                  style={[styles.underline, pressed && styles.underlineVisible]}
                />
              </>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    paddingHorizontal: 4,
    paddingVertical: 2,
    ...theme.shadows.card,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
    gap: 3,
  },
  itemPressed: {
    opacity: 1,
  },
  label: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelPressed: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
  underline: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  underlineVisible: {
    backgroundColor: theme.colors.sand,
  },
});
