import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';
import { useShellBackground } from '@/shared/hooks/useShellBackground';
import { useTheme } from '@/shared/theme/ThemeProvider';

import { LoadProgressBanner } from './LoadProgressBanner';
import { PaperMapLoader } from './PaperMapLoader';

export interface LoadingViewProps {
  /** Optional line under the mark. Defaults to the common loading string. */
  message?: string;
  /** When set, map loader + hairline progress. `total === 0` pulses. */
  progress?: { done: number; total: number };
}

/**
 * Brand loading — folded map on cream paper (min/max hold is call-site via
 * useHeldBusy). No PaperGrain here: full-bleed grain decode competes with
 * album sync on first paint.
 */
export function LoadingView({
  message = strings.common.loading,
  progress,
}: LoadingViewProps) {
  const shellBg = useShellBackground();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, shellBg]} edges={['top', 'left', 'right']}>
      <View style={styles.center} collapsable={false}>
        <PaperMapLoader width={128} />
        {progress ? (
          <View style={styles.progress}>
            <LoadProgressBanner
              label={message}
              done={progress.done}
              total={progress.total}
            />
          </View>
        ) : (
          <Text style={[styles.message, { color: colors.shellSubtle }]}>
            {message}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginTop: -24,
  },
  message: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  progress: {
    alignSelf: 'stretch',
    maxWidth: 240,
    marginTop: theme.spacing.xs,
  },
});
