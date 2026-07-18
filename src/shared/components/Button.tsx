import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/shared/constants/theme';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost';
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
 * Shared button for the soft-minimal UI. Primary = solid ink, accent = brand
 * orange, secondary = outlined surface, ghost = text-only. Keeps every CTA in
 * the app on one visual system.
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
  const isSolid = variant === 'primary' || variant === 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        variant === 'primary' && styles.primary,
        variant === 'accent' && styles.accent,
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
          color={isSolid ? theme.colors.surface : theme.colors.ink}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelOnSolid,
            variant === 'accent' && styles.labelOnSolid,
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
    backgroundColor: theme.colors.accent,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  labelOnSolid: {
    color: theme.colors.surface,
  },
  labelInk: {
    color: theme.colors.ink,
  },
  labelAccent: {
    color: theme.colors.accent,
  },
});
