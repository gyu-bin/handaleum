import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface ScreenHeaderProps {
  title: string;
  /** Optional trailing element (e.g. an action link). */
  trailing?: React.ReactNode;
  /** Override the default back behavior (router.back()). */
  onBack?: () => void;
}

/**
 * Shared top bar with a back affordance and title, for pushed routes.
 */
export function ScreenHeader({ title, trailing, onBack }: ScreenHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (onBack ? onBack() : router.back())}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={strings.common.back}
        style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
      >
        <Text style={styles.chevron}>‹</Text>
        <Text style={styles.backLabel}>{strings.common.back}</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const HIT = 40;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  backBtn: {
    minWidth: HIT,
    height: HIT,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
  },
  backPressed: {
    opacity: 0.7,
  },
  chevron: {
    color: theme.colors.ink,
    fontSize: 22,
    lineHeight: 24,
    marginTop: -1,
  },
  backLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  trailing: {
    minWidth: HIT + 24,
    alignItems: 'flex-end',
  },
});
