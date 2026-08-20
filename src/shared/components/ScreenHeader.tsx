import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useTheme } from '@/shared/theme/ThemeProvider';

export interface ScreenHeaderProps {
  title: string;
  /** Optional trailing element (e.g. an action link). */
  trailing?: React.ReactNode;
  /** Override the default back behavior (router.back()). */
  onBack?: () => void;
  /** Hide the back control (title stays optically centered). */
  hideBack?: boolean;
}

/**
 * Journal top bar — title is centered on the screen; side slots balance chrome.
 */
export function ScreenHeader({
  title,
  trailing,
  onBack,
  hideBack = false,
}: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const showBack = !hideBack;

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.hairline,
        },
      ]}
    >
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            onPress={() => (onBack ? onBack() : router.back())}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={strings.common.back}
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.backPressed,
            ]}
          >
            <Text style={[styles.chevron, { color: colors.shellInk }]}>‹</Text>
            <Text style={[styles.backLabel, { color: colors.shellInk }]}>
              {strings.common.back}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text
        style={[styles.title, { color: colors.shellInk }]}
        numberOfLines={1}
        pointerEvents="none"
      >
        {title}
      </Text>

      <View style={[styles.side, styles.sideEnd]}>{trailing}</View>
    </View>
  );
}

const HIT = 40;
/** Keep left/right chrome similar so absolute title reads as screen-centered. */
const SIDE_MIN = 96;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  side: {
    flex: 1,
    minWidth: SIDE_MIN,
    minHeight: HIT,
    zIndex: 1,
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  backBtn: {
    minWidth: HIT,
    height: HIT,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 2,
    alignSelf: 'flex-start',
  },
  backPressed: {
    opacity: 0.7,
  },
  chevron: {
    fontFamily: theme.fonts.sans,
    fontSize: 22,
    lineHeight: 24,
    marginTop: -1,
  },
  backLabel: {
    ...theme.type.label,
    fontFamily: theme.fonts.sans,
    fontWeight: '600',
  },
  title: {
    ...theme.type.title,
    fontFamily: theme.fonts.serif,
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: SIDE_MIN + theme.spacing.md,
    textAlign: 'center',
    fontWeight: '700',
    zIndex: 0,
  },
});
