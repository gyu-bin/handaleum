import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useStamps } from '@/features/stamps/hooks/useStamps';
import { StampSneakerIcon } from '@/shared/components/StampSneakerIcon';
import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

export interface HomeNavItem {
  href: Href;
  label: string;
  icon: 'calendar' | 'play' | 'card' | 'chart' | 'stamp';
  /** Red notify dot (e.g. unseen 발도장). */
  badge?: boolean;
}

export interface HomeNavBarProps {
  items: HomeNavItem[];
}

function pathMatches(pathname: string, href: Href): boolean {
  const target = String(href);
  if (target === '/') {
    return pathname === '/' || pathname === '';
  }
  return pathname === target || pathname.startsWith(`${target}/`);
}

function NavIcon({
  name,
  active,
}: {
  name: HomeNavItem['icon'];
  active: boolean;
}) {
  const { colors } = useTheme();
  const color = active ? colors.shellInk : colors.shellInkSoft;
  const stroke = 2.2;
  const size = 20;
  if (name === 'calendar') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect
          x={3.5}
          y={5}
          width={17}
          height={15}
          rx={2.5}
          stroke={color}
          strokeWidth={stroke}
        />
        <Path d="M3.5 10h17" stroke={color} strokeWidth={stroke} />
        <Path
          d="M8 3.5v3M16 3.5v3"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (name === 'play') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={stroke} />
        <Path d="M10.2 8.8l6 3.2-6 3.2V8.8z" fill={color} />
      </Svg>
    );
  }
  if (name === 'card') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect
          x={4}
          y={5}
          width={16}
          height={14}
          rx={2}
          stroke={color}
          strokeWidth={stroke}
        />
        <Path
          d="M4 9.5h16M8 13.5h5"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  if (name === 'stamp') {
    return (
      <StampSneakerIcon
        size={20}
        color={color}
        active={active}
      />
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
 * Bottom dock — flat hairline bar, ink weight for active (Plan A).
 * Stamp badge subscribes here so sync notifyStampsChanged doesn't re-render the map.
 */
function StampBadge() {
  const { unseenCount } = useStamps();
  const { colors } = useTheme();
  if (unseenCount <= 0) {
    return null;
  }
  return (
    <View style={[styles.badge, { borderColor: colors.background }]} />
  );
}

export function HomeNavBar({ items }: HomeNavBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, 4),
          backgroundColor: colors.background,
          borderTopColor: colors.hairline,
        },
      ]}
    >
      <View style={styles.bar}>
        {items.map((item) => {
          const active = pathMatches(pathname, item.href);
          return (
            <Pressable
              key={String(item.href)}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
            >
              <View style={styles.itemInner}>
                <View style={styles.iconWrap}>
                  <NavIcon name={item.icon} active={active} />
                  {item.icon === 'stamp' ? (
                    <StampBadge />
                  ) : item.badge ? (
                    <View
                      style={[
                        styles.badge,
                        { borderColor: colors.background },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.label,
                    { color: colors.shellInkSoft },
                    active && styles.labelActive,
                    active && { color: colors.shellInk },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {active ? (
                  <View
                    style={[
                      styles.activeTick,
                      { backgroundColor: colors.shellInk },
                    ]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 46,
    paddingBottom: 2,
  },
  item: {
    flex: 1,
    maxWidth: 88,
  },
  itemPressed: {
    opacity: 0.7,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingVertical: 2,
    minHeight: 44,
  },
  iconWrap: {
    width: 22,
    height: 22,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -1,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.notify,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.surface,
  },
  label: {
    fontFamily: theme.fonts.sans,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: -0.15,
    fontWeight: '600',
  },
  labelActive: {
    fontWeight: '700',
  },
  activeTick: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },
});
