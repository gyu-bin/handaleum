import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

import { BikeLoader } from './BikeLoader';

export interface LoadingViewProps {
  /** Optional line under the mark. Defaults to the common loading string. */
  message?: string;
}

/**
 * Brand loading — bike on cream paper (min hold is call-site via useHeldBusy).
 * No PaperGrain here: full-bleed grain decode fights the spin under album sync.
 */
export function LoadingView({
  message = strings.common.loading,
}: LoadingViewProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.center} collapsable={false}>
        <BikeLoader width={132} />
        <Text style={styles.brand} accessibilityRole="header">
          {strings.brand}
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginTop: -24,
  },
  brand: {
    marginTop: theme.spacing.md,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 4,
    color: theme.colors.splashMark,
  },
  message: {
    ...theme.type.micro,
    fontFamily: theme.fonts.sans,
    color: theme.colors.subtle,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
