import { useCallback, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { AnimatedSplash } from '@/shared/components/AnimatedSplash';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { queryClient } from '@/lib/queryClient';
import { configurePurchases } from '@/lib/purchases';
import { theme } from '@/shared/constants/theme';

configurePurchases();

// Hold the native splash until AnimatedSplash paints — then hide for a seamless handoff.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  const onSplashReady = useCallback(() => {
    // Hide after the JS splash is on screen so the native icon never flashes.
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
          {splashDone ? null : (
            <AnimatedSplash onFinish={onSplashFinish} onReady={onSplashReady} />
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
});
