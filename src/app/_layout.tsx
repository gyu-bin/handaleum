import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { startOtaAutoApply } from '@/lib/applyOtaUpdate';
import { configurePurchases } from '@/lib/purchases';
import { consumeOtaJustApplied } from '@/lib/otaUpdateFlag';
import { queryClient } from '@/lib/queryClient';
import { AnimatedSplash } from '@/shared/components/AnimatedSplash';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { OtaToast } from '@/shared/components/OtaToast';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

configurePurchases();

// Hold the native splash until AnimatedSplash paints — then hide for a seamless handoff.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const [otaToastMessage, setOtaToastMessage] = useState<string | null>(null);
  const [otaToastPersistent, setOtaToastPersistent] = useState(false);
  const [otaDoneToast, setOtaDoneToast] = useState(false);

  const finishingRef = useRef(false);

  useEffect(() => {
    if (consumeOtaJustApplied()) {
      setOtaDoneToast(true);
    }

    // Startup + foreground return + periodic while open. Never blocks splash.
    return startOtaAutoApply({
      onProgress: (phase) => {
        setOtaToastPersistent(true);
        setOtaToastMessage(
          phase === 'updating' ? strings.ota.updating : strings.ota.checking,
        );
      },
      onSettled: (result) => {
        if (result.kind === 'reloading') {
          // App restarts — leave toast up until reload.
          return;
        }
        setOtaToastMessage(null);
        setOtaToastPersistent(false);
      },
    });
  }, []);

  const onSplashReady = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onSplashFinish = useCallback(() => {
    if (finishingRef.current) {
      return;
    }
    finishingRef.current = true;
    setSplashDone(true);
  }, []);

  const hideOtaDoneToast = useCallback(() => setOtaDoneToast(false), []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }} />
            {splashDone ? null : (
              <AnimatedSplash onFinish={onSplashFinish} onReady={onSplashReady} />
            )}
            <OtaToast
              visible={otaToastMessage != null}
              message={otaToastMessage ?? ''}
              persistent={otaToastPersistent}
            />
            <OtaToast
              visible={otaDoneToast}
              message={strings.ota.done}
              onHidden={hideOtaDoneToast}
            />
          </QueryClientProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.canvas,
  },
});
