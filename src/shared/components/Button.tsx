import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/shared/constants/theme';

export type ButtonVariant = 'primary' | 'accent' | 'sand' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Extra container style (e.g. margins). */
  style?: ViewStyle;
}

/**
 * Shared button. Primary = ink, accent = journal terracotta, sand = warm gold,
 * secondary = outlined, ghost = text terracotta. Map-on-canvas CTAs may still
 * pass variant="accent" sparingly; prefer terracotta for journal UI.
 */
export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled,
  style,
  ...pressableProps
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const isSolid = variant === 'primary' || variant === 'accent' || variant === 'sand';
  const labelOnLight = variant === 'sand';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        variant === 'primary' && styles.primary,
        variant === 'accent' && styles.accent,
        variant === 'sand' && styles.sand,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        isSolid && !isDisabled && theme.shadows.raised,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator
          color={labelOnLight || !isSolid ? theme.colors.ink : theme.colors.surface}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelOnSolid,
            variant === 'accent' && styles.labelOnSolid,
            variant === 'sand' && styles.labelInk,
            variant === 'secondary' && styles.labelInk,
            variant === 'ghost' && styles.labelAccent,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.ink,
  },
  accent: {
    backgroundColor: theme.colors.terracotta,
  },
  sand: {
    backgroundColor: theme.colors.sand,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.hairline,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...theme.type.body,
    fontFamily: theme.fonts.serif,
    fontWeight: '700',
  },
  labelOnSolid: {
    color: theme.colors.surface,
  },
  labelInk: {
    color: theme.colors.ink,
  },
  labelAccent: {
    color: theme.colors.terracotta,
  },
});

