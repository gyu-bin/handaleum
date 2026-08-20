import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

export type ButtonVariant = 'primary' | 'accent' | 'sand' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';
/** Paper sheets keep the light palette; shell sits on the dark gray background. */
export type ButtonSurface = 'shell' | 'paper';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  surface?: ButtonSurface;
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
  surface = 'shell',
  disabled,
  style,
  ...pressableProps
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const isSolid = variant === 'primary' || variant === 'accent' || variant === 'sand';
  const onPaper = surface === 'paper';
  const fill = onPaper ? theme.colors.ink : colors.shellInk;
  const onFill = onPaper ? theme.colors.surface : colors.canvas;
  const outline = onPaper ? theme.colors.ink : colors.shellInk;
  const hairline = onPaper ? theme.colors.hairline : colors.hairline;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        isSolid && { backgroundColor: fill },
        variant === 'secondary' && [
          styles.secondary,
          {
            backgroundColor: onPaper ? theme.colors.surface : 'transparent',
            borderColor: hairline,
          },
        ],
        variant === 'ghost' && styles.ghost,
        isSolid && !isDisabled && theme.shadows.raised,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={!isSolid ? outline : onFill} />
      ) : (
        <Text
          style={[
            styles.label,
            isSolid && { color: onFill },
            (variant === 'secondary' || variant === 'ghost') && {
              color: outline,
            },
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
  secondary: {
    borderWidth: 1,
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
});
