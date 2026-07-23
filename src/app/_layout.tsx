import { useCallback, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

import { AnimatedSplash } from '@/shared/components/AnimatedSplash';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { queryClient } from '@/lib/queryClient';
import { initSentry, Sentry } from '@/lib/sentry';

initSentry();

// Hold the native splash so the animated one takes over without a blank flash.
void SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // Reveal the JS tree; the AnimatedSplash overlay covers it until it finishes.
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onSplashFinish = useCallback(() => setSplashDone(true), []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }} />
          {splashDone ? null : <AnimatedSplash onFinish={onSplashFinish} />}
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default Sentry.wrap(RootLayout);
