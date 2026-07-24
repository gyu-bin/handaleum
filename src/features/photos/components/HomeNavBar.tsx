import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { theme } from '@/shared/constants/theme';

export interface HomeNavItem {
  href: Href;
  label: string;
  icon: 'calendar' | 'play' | 'card' | 'chart';
}

export interface HomeNavBarProps {
  items: HomeNavItem[];
}

function NavIcon({ name, active }: { name: HomeNavItem['icon']; active: boolean }) {
  const color = active ? theme.colors.ink : theme.colors.inkSoft;
  const stroke = 1.6;
  if (name === 'calendar') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={3.5} y={5} width={17} height={15} rx={2.5} stroke={color} strokeWidth={stroke} />
        <Path d="M3.5 10h17" stroke={color} strokeWidth={stroke} />
        <Path d="M8 3.5v3M16 3.5v3" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      </Svg>
    );
  }
  if (name === 'play') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={stroke} />
        <Path d="M10.2 8.8l6 3.2-6 3.2V8.8z" fill={color} />
      </Svg>
    );
  }
  if (name === 'card') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Rect x={4} y={5} width={16} height={14} rx={2} stroke={color} strokeWidth={stroke} />
        <Path d="M4 9.5h16M8 13.5h5" stroke={color} strokeWidth={stroke} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 18V11M10 18V7M15 18v-5M20 18V9"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Floating paper dock with icon + label (home concept B chrome).
 */
export function HomeNavBar({ items }: HomeNavBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, theme.spacing.sm) },
      ]}
    >
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
              <View style={[styles.itemInner, pressed && styles.itemInnerPressed]}>
                <NavIcon name={item.icon} active={pressed} />
                <Text
                  style={[styles.label, pressed && styles.labelPressed]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </View>
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
    paddingTop: theme.spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.panelBorder,
    paddingVertical: 6,
    paddingHorizontal: 6,
    ...theme.shadows.raised,
  },
  item: {
    flex: 1,
    borderRadius: theme.radius.lg,
  },
  itemPressed: {
    // highlight lives on the inner chip
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: theme.radius.md,
  },
  itemInnerPressed: {
    backgroundColor: theme.colors.landLight,
  },
  label: {
    ...theme.type.micro,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  labelPressed: {
    color: theme.colors.ink,
    fontWeight: '700',
  },
});
