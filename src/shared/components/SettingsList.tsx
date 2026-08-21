import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

/**
 * Grouped-list primitives for settings-shaped screens: a grey section label
 * above one paper card, rows separated by an inset hairline.
 *
 * Rows sit on `shellSurface`, so these belong on the shell background — not on
 * the map or on a paper sheet.
 */

const CARD_PAD = theme.spacing.md;

export interface SettingsSectionProps {
  label: string;
  children: ReactNode;
}

export function SettingsSection({ label, children }: SettingsSectionProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.shellSubtle }]}>
        {label}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.shellSurface, borderColor: colors.hairline },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** Hairline between rows, inset to the row text. */
export function SettingsDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.hairline }]} />;
}

export interface SettingsRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  /** Show the disclosure caret. Defaults to true when `onPress` is given. */
  chevron?: boolean;
  /** Secondary actions (해제, 복원) sit quieter than the rest of the card. */
  muted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Replaces the value/caret slot — used for switches. */
  trailing?: ReactNode;
}

export function SettingsRow({
  title,
  subtitle,
  value,
  chevron,
  muted = false,
  disabled = false,
  onPress,
  trailing,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const showChevron = chevron ?? Boolean(onPress);
  const body = (
    <>
      <View style={styles.rowCopy}>
        <Text
          style={[
            styles.rowTitle,
            { color: muted ? colors.shellSubtle : colors.shellInk },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: colors.shellSubtle }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <View style={styles.rowTrailing}>
          {value ? (
            <Text style={[styles.rowValue, { color: colors.shellInkSoft }]}>
              {value}
            </Text>
          ) : null}
          {showChevron ? (
            <Text style={[styles.chevron, { color: colors.shellSubtle }]}>›</Text>
          ) : null}
        </View>
      )}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, disabled && styles.rowDisabled]}>{body}</View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && { backgroundColor: colors.shellChip },
        disabled && styles.rowDisabled,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * Full-width slot inside a card for anything that is not a plain row
 * (chip pickers, sliders). Matches row padding so it stays on the grid.
 */
export function SettingsCustomRow({ children }: { children: ReactNode }) {
  return <View style={styles.customRow}>{children}</View>;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginLeft: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  card: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: CARD_PAD,
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: CARD_PAD,
    paddingVertical: 13,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  rowCopy: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    ...theme.type.body,
    fontFamily: theme.fonts.sans,
    fontWeight: '500',
  },
  rowSub: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    lineHeight: 16,
  },
  rowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  chevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 19,
    lineHeight: 21,
    fontWeight: '400',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingHorizontal: CARD_PAD,
    paddingVertical: 12,
    minHeight: 54,
  },
});
