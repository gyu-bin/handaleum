import { useCallback, useEffect, useState } from 'react';
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
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { OtaToast } from '@/shared/components/OtaToast';
import { strings } from '@/shared/constants/strings';
import { theme } from '@/shared/constants/theme';

configurePurchases();

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [otaToastMessage, setOtaToastMessage] = useState<string | null>(null);
  const [otaToastPersistent, setOtaToastPersistent] = useState(false);
  const [otaDoneToast, setOtaDoneToast] = useState(false);

  useEffect(() => {
    // No animated pin/map splash — drop native splash as soon as the tree mounts.
    void SplashScreen.hideAsync().catch(() => {});

    if (consumeOtaJustApplied()) {
      setOtaDoneToast(true);
    }

    return startOtaAutoApply({
      onProgress: (phase) => {
        setOtaToastPersistent(true);
        setOtaToastMessage(
          phase === 'updating' ? strings.ota.updating : strings.ota.checking,
        );
      },
      onSettled: (result) => {
        if (result.kind === 'reloading') {
          return;
        }
        setOtaToastMessage(null);
        setOtaToastPersistent(false);
      },
    });
  }, []);

  const hideOtaDoneToast = useCallback(() => setOtaDoneToast(false), []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }} />
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
