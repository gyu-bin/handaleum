import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';

import { Button } from './Button';

export interface StateViewProps {
  /** Large glyph/emoji shown above the message (optional). */
  icon?: string;
  title: string;
  /** Secondary line under the title (optional). */
  description?: string;
  /** When set, renders a retry/action button. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Centered empty/error state shared across screens: optional icon, title,
 * description, and one action button. Replaces the ad-hoc "text + retry"
 * blocks that were duplicated per screen.
 */
export function StateView({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: StateViewProps) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          variant="secondary"
          size="md"
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  icon: {
    fontSize: 44,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    color: theme.colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  action: {
    marginTop: theme.spacing.md,
    minWidth: 140,
  },
});
