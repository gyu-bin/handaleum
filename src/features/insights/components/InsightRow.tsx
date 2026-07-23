import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

export interface InsightRowProps {
  title: string;
  value: string;
  /** When true, blur/obscure value and show a Pro badge. */
  locked?: boolean;
  lockedTag?: string;
}

export function InsightRow({
  title,
  value,
  locked = false,
  lockedTag = '프로',
}: InsightRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.trailing}>
        {locked ? (
          <>
            <Text style={styles.lockedValue} accessibilityElementsHidden>
              {'••••'}
            </Text>
            <View style={styles.proBadge}>
              <Text style={styles.proText}>{lockedTag}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.value} numberOfLines={2}>
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.hairline,
    ...theme.shadows.card,
  },
  title: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    fontWeight: '600',
    flexShrink: 0,
    maxWidth: '42%',
  },
  trailing: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  value: {
    ...theme.type.body,
    color: theme.colors.ink,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  lockedValue: {
    ...theme.type.body,
    color: theme.colors.subtle,
    fontWeight: '700',
    letterSpacing: 2,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accentSoft,
  },
  proText: {
    ...theme.type.label,
    color: theme.colors.accent,
    fontWeight: '800',
    fontSize: 11,
  },
});
