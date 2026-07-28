import { useCallback, useEffect, useRef, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { applyOtaUpdateIfAvailable } from '@/lib/applyOtaUpdate';
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

  const animDoneRef = useRef(false);
  const otaGateRef = useRef(false);
  const justUpdatedRef = useRef(false);
  const finishingRef = useRef(false);

  const tryFinishSplash = useCallback(() => {
    if (finishingRef.current) {
      return;
    }
    if (!animDoneRef.current || !otaGateRef.current) {
      return;
    }
    finishingRef.current = true;
    setSplashDone(true);
    if (justUpdatedRef.current) {
      setOtaDoneToast(true);
    }
  }, []);

  useEffect(() => {
    justUpdatedRef.current = consumeOtaJustApplied();

    let cancelled = false;
    void (async () => {
      const result = await applyOtaUpdateIfAvailable((phase) => {
        if (cancelled) {
          return;
        }
        setOtaToastPersistent(true);
        setOtaToastMessage(
          phase === 'updating' ? strings.ota.updating : strings.ota.checking,
        );
      });
      if (cancelled) {
        return;
      }
      if (result.kind === 'reloading') {
        // App restarts — leave toast up until reload.
        return;
      }
      setOtaToastMessage(null);
      setOtaToastPersistent(false);
      otaGateRef.current = true;
      tryFinishSplash();
    })();

    return () => {
      cancelled = true;
    };
  }, [tryFinishSplash]);

  const onSplashReady = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  const onSplashFinish = useCallback(() => {
    animDoneRef.current = true;
    tryFinishSplash();
  }, [tryFinishSplash]);

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
