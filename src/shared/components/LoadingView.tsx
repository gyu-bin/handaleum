import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

export interface LoadingViewProps {
  /** Optional line under the spinner. Defaults to the common loading string. */
  message?: string;
}

/**
 * Brand loading screen: wordmark + spinner on the canvas background.
 * Shared across screens so every "불러오는 중" state looks the same.
 */
export function LoadingView({ message = strings.common.loading }: LoadingViewProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.wordmark}>{strings.brand}</Text>
        <ActivityIndicator color={theme.colors.accent} style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  wordmark: {
    fontFamily: theme.fonts.serif,
    fontSize: 30,
    fontWeight: '700',
    color: theme.colors.ink,
    letterSpacing: -0.5,
  },
  spinner: {
    transform: [{ scale: 1.1 }],
  },
  message: {
    fontSize: 13,
    color: theme.colors.subtle,
    letterSpacing: 1,
  },
});
