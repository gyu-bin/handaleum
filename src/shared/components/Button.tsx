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
 * Shared button. Primary/accent = ink fill (Plan A single accent).
 * Sand = rare warm event. Secondary = outlined. Ghost = ink text.
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

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        variant === 'primary' && styles.primary,
        variant === 'accent' && styles.primary,
        variant === 'sand' && styles.primary,
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
          color={!isSolid ? theme.colors.ink : theme.colors.surface}
        />
      ) : (
        <Text
          style={[
            styles.label,
            isSolid && styles.labelOnSolid,
            variant === 'secondary' && styles.labelInk,
            variant === 'ghost' && styles.labelGhost,
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
    borderRadius: theme.radius.sm,
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
    fontFamily: theme.fonts.sans,
    fontSize: theme.type.body.fontSize,
    letterSpacing: theme.type.body.letterSpacing,
    // Spreading theme.type.body lineHeight clips Hangul bottoms in padded Pressable
    // (same issue as RegionChips — keep line box taller than the glyph).
    lineHeight: 22,
    includeFontPadding: false,
    fontWeight: '700',
    textAlignVertical: 'center',
  },
  labelOnSolid: {
    color: theme.colors.surface,
  },
  labelInk: {
    color: theme.colors.ink,
  },
  labelGhost: {
    color: theme.colors.ink,
  },
});
